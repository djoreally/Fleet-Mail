import { Router } from 'express';
import { getAgentMailClient } from '../services/agentmail.js';
import { createAgentActionProposal, verifyAgentActionProposal, type AgentActionProposal } from '../services/agentActions.js';
import { AgentActionReplayError, claimAgentActionExecution, markAgentActionFailed, markAgentActionSucceeded } from '../services/agentActionExecutionStore.js';
import { googleFetch } from '../services/googleOAuth.js';
import { readGoogleTokens, writeGoogleTokens } from './google.js';
import { FleetAuthError, fleetAuthFailure, getFleetAccessContext, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { resolveOrganizationAgentMailInbox } from '../services/agentMailTenantBoundary.js';
import { createWorkOrder } from '../services/operationsPersistence.js';
import { workOrderExecutionService } from '../services/workOrderExecution.js';
import { workOrderCompletionService } from '../services/workOrderCompletion.js';
import { prospectingService } from '../services/prospecting.js';
import { prospectOutreachService } from '../services/prospectOutreach.js';
import { fleetCustomerMutations } from '../services/fleetCustomerMutations.js';
import { agentCrud } from '../services/agentCrud.js';
import { ScheduleDispatchService } from '../services/scheduleDispatch.js';
import { recordDispatchCreated, transitionDispatchStatus } from '../services/dispatchLifecycle.js';
import { syncDispatchTechnician, syncWorkOrderSchedule, syncWorkOrderTechnician, workOrderChain } from '../services/fleetServiceModel.js';

export const agentActionsRouter = Router();
const scheduleDispatch=new ScheduleDispatchService();

function executionMessage(proposal: AgentActionProposal, result: any) {
  const messages:Partial<Record<AgentActionProposal['kind'],string>>={
    'email.send':'The email was sent successfully.','calendar.create':'The calendar event was created successfully.','fleet.work_order.create':'The work order was created successfully.','fleet.work_order.update':'The work order was updated successfully.','fleet.work_order.delete':'The work order was deleted successfully.','fleet.work_order.transition':'The work order status was updated successfully.','fleet.authorization.decision':'The authorization decision was recorded successfully.','fleet.prospect.create':'The prospect was created successfully.','fleet.prospect.update':'The prospect was updated successfully.','fleet.prospect.delete':'The prospect was deleted successfully.','fleet.prospect.convert':'The prospect was converted to a Fleet Account successfully.','fleet.account.update':'The Fleet Account was updated successfully.','fleet.account.delete':'The Fleet Account was deleted successfully.','fleet.contact.update':'The contact was updated successfully.','fleet.contact.delete':'The contact was deleted successfully.','fleet.vehicle.update':'The vehicle was updated successfully.','fleet.vehicle.delete':'The vehicle was deleted successfully.','fleet.schedule.create':'The appointment was scheduled successfully.','fleet.schedule.update':'The appointment was updated successfully.','fleet.schedule.delete':'The appointment was deleted successfully.','fleet.dispatch.create':'The dispatch assignment was created successfully.','fleet.dispatch.update':'The dispatch assignment was updated successfully.','fleet.dispatch.transition':'The dispatch status was updated successfully.'
  };
  if(messages[proposal.kind])return messages[proposal.kind]!;
  if(proposal.kind==='fleet.account.create')return `${String(result?.customer?.name||proposal.payload.name)} is now available as a Fleet Account.`;
  if(proposal.kind==='fleet.contact.create')return `${String(result?.contact?.name||proposal.payload.name)} is now saved as a Fleet contact.`;
  if(proposal.kind==='fleet.vehicle.create')return `Vehicle ${String(result?.vehicle?.unit_number||proposal.payload.unitNumber)} is now linked to the Fleet account.`;
  if(proposal.kind==='fleet.customer.onboard'){const customer=String(result?.customer?.name||(proposal.payload.account as any)?.name||'The Fleet account');const vehicles=Number(result?.vehicles?.length||0);const contact=result?.contact?.name?` Contact ${String(result.contact.name)} is linked.`:'';const vehicleText=vehicles?` ${vehicles} vehicle${vehicles===1?'':'s'} ${vehicles===1?'is':'are'} linked.`:'';return `${customer} is ready in Fleet OS.${contact}${vehicleText}`;}
  return 'The confirmed action was completed successfully.';
}

agentActionsRouter.post('/propose', async (req, res) => {
  try { await requireFleetPermission(req,'agent.execute');const organizationId=await requireFleetOrganization(req);return res.status(201).json(createAgentActionProposal(req.body?.kind,req.body?.payload,organizationId)); }
  catch(error){if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);return res.status(400).json({error:error instanceof Error?error.message:'Invalid action proposal'});}
});

agentActionsRouter.post('/execute', async (req, res) => {
  if(req.body?.confirmed!==true)return res.status(409).json({error:'Explicit confirmation is required'});
  let proposalId:string|null=null,organizationId:string|null=null;let claimed=false;
  try{
    await requireFleetPermission(req,'agent.execute');organizationId=await requireFleetOrganization(req);const proposal=verifyAgentActionProposal(req.body?.confirmationToken,organizationId);proposalId=proposal.id;await claimAgentActionExecution(organizationId,proposal);claimed=true;
    const finish=async(result:unknown)=>{await markAgentActionSucceeded(organizationId!,proposal.id,result);return res.json({executed:true,proposalId:proposal.id,kind:proposal.kind,result,message:executionMessage(proposal,result)});};
    const authorization=req.header('authorization');

    if(proposal.kind==='email.send'){await requireFleetPermission(req,'inbox.send');const prospectId=proposal.payload.prospectId?String(proposal.payload.prospectId):null;if(prospectId)await prospectingService.get(organizationId,prospectId);const client=getAgentMailClient() as any;if(!client)throw new Error('AgentMail is not configured');const inbox=await resolveOrganizationAgentMailInbox(req);const result=await client.inboxes.messages.send(inbox,{to:proposal.payload.to,subject:proposal.payload.subject,text:proposal.payload.text});if(prospectId){const externalMessageId=String(result?.message_id||result?.messageId||result?.id||'');await prospectOutreachService.recordSent(organizationId,prospectId,{to:proposal.payload.to,subject:proposal.payload.subject,text:proposal.payload.text,contactId:proposal.payload.contactId,externalMessageId});}return finish(result);}
    if(proposal.kind==='calendar.create'){await requireFleetPermission(req,'schedule.manage');const tokens=readGoogleTokens(req);if(!tokens)throw new Error('Connect Google before creating calendar events');const result=await googleFetch<any>('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',tokens,{method:'POST',body:JSON.stringify(proposal.payload)});writeGoogleTokens(res,result.tokens);return finish(result.data);}

    if(proposal.kind==='fleet.work_order.create'){await requireFleetPermission(req,'work_orders.manage');return finish(await createWorkOrder(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.work_order.update'){await requireFleetPermission(req,'work_orders.manage');return finish(await agentCrud.updateWorkOrder(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.work_order.delete'){await requireFleetPermission(req,'work_orders.manage');return finish(await agentCrud.deleteWorkOrder(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.work_order.transition'){await requireFleetPermission(req,'work_orders.manage');const status=String(proposal.payload.status);const result=['complete','completed'].includes(status)?await workOrderCompletionService.complete(organizationId,String(proposal.payload.workOrderId)):await workOrderExecutionService.transition(organizationId,String(proposal.payload.workOrderId),status);return finish(result);}
    if(proposal.kind==='fleet.authorization.decision'){await requireFleetPermission(req,'authorizations.manage');const decision=String(proposal.payload.decision) as 'authorized'|'rejected';return finish(await workOrderExecutionService.decideAuthorization(organizationId,String(proposal.payload.authorizationId),decision,proposal.payload));}

    if(proposal.kind==='fleet.prospect.create'){await requireFleetPermission(req,'prospects.manage');return finish(await agentCrud.createProspect(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.prospect.update'){await requireFleetPermission(req,'prospects.manage');return finish(await agentCrud.updateProspect(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.prospect.delete'){await requireFleetPermission(req,'prospects.manage');return finish(await agentCrud.deleteProspect(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.prospect.convert'){await requireFleetPermission(req,'prospects.manage');return finish(await prospectingService.convertToFleetAccount(organizationId,String(proposal.payload.prospectId)));}

    if(proposal.kind==='fleet.account.create'){await requireFleetPermission(req,'fleet_accounts.manage');return finish(await fleetCustomerMutations.createAccount(organizationId,proposal.payload as any));}
    if(proposal.kind==='fleet.account.update'){await requireFleetPermission(req,'fleet_accounts.manage');return finish(await agentCrud.updateAccount(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.account.delete'){await requireFleetPermission(req,'fleet_accounts.manage');return finish(await agentCrud.deleteAccount(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.contact.create'){await requireFleetPermission(req,'fleet_accounts.manage');return finish(await fleetCustomerMutations.createContact(organizationId,proposal.payload as any));}
    if(proposal.kind==='fleet.contact.update'){await requireFleetPermission(req,'fleet_accounts.manage');return finish(await agentCrud.updateContact(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.contact.delete'){await requireFleetPermission(req,'fleet_accounts.manage');return finish(await agentCrud.deleteContact(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.vehicle.create'){await requireFleetPermission(req,'vehicles.manage');return finish(await fleetCustomerMutations.createVehicle(organizationId,proposal.payload as any));}
    if(proposal.kind==='fleet.vehicle.update'){await requireFleetPermission(req,'vehicles.manage');return finish(await agentCrud.updateVehicle(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.vehicle.delete'){await requireFleetPermission(req,'vehicles.manage');return finish(await agentCrud.deleteVehicle(organizationId,proposal.payload));}
    if(proposal.kind==='fleet.customer.onboard'){await requireFleetPermission(req,'fleet_accounts.manage');const vehicles=Array.isArray(proposal.payload.vehicles)?proposal.payload.vehicles:[];if(vehicles.length)await requireFleetPermission(req,'vehicles.manage');return finish(await fleetCustomerMutations.onboard(organizationId,proposal.payload as any));}

    if(proposal.kind==='fleet.schedule.create'){await requireFleetPermission(req,'schedule.manage');const workOrderId=String(proposal.payload.workOrderId);const chain=await workOrderChain(organizationId,workOrderId);const result=await scheduleDispatch.createAppointment(organizationId,authorization,{...proposal.payload,workOrderId:chain.id,customerId:chain.customer_id,vehicleId:chain.vehicle_id,locationId:proposal.payload.locationId||chain.location_id||null,status:'scheduled'});await syncWorkOrderSchedule(organizationId,workOrderId,proposal.payload.startsAt);return finish(result);}
    if(proposal.kind==='fleet.schedule.update'){await requireFleetPermission(req,'schedule.manage');const {appointmentId,...body}=proposal.payload;const patch:any={...body};if(body.workOrderId){const chain=await workOrderChain(organizationId,String(body.workOrderId));Object.assign(patch,{workOrderId:chain.id,customerId:chain.customer_id,vehicleId:chain.vehicle_id});}return finish(await scheduleDispatch.updateAppointment(organizationId,authorization,String(appointmentId),patch));}
    if(proposal.kind==='fleet.schedule.delete'){await requireFleetPermission(req,'schedule.manage');return finish(await scheduleDispatch.deleteAppointment(organizationId,authorization,String(proposal.payload.appointmentId)));}

    if(proposal.kind==='fleet.dispatch.create'){await requireFleetPermission(req,'dispatch.manage');const access=await getFleetAccessContext(req);const result=await scheduleDispatch.createDispatch(organizationId,authorization,{...proposal.payload,status:'assigned'});await syncWorkOrderTechnician(organizationId,String(proposal.payload.workOrderId),String(proposal.payload.technicianId));const row=Array.isArray(result)?result[0]:result;if(row?.id)await recordDispatchCreated({organizationId,dispatchId:String(row.id),actorUserId:access.userId});return finish(result);}
    if(proposal.kind==='fleet.dispatch.update'){await requireFleetPermission(req,'dispatch.manage');const {dispatchId,...patch}=proposal.payload;const result=await scheduleDispatch.updateDispatch(organizationId,authorization,String(dispatchId),patch);await syncDispatchTechnician(organizationId,String(dispatchId));return finish(result);}
    if(proposal.kind==='fleet.dispatch.transition'){await requireFleetPermission(req,'dispatch.manage');const access=await getFleetAccessContext(req);return finish(await transitionDispatchStatus({organizationId,dispatchId:String(proposal.payload.dispatchId),nextStatus:String(proposal.payload.status),actorUserId:access.userId,notes:proposal.payload.notes?String(proposal.payload.notes):null}));}

    throw new Error('Unsupported agent action');
  }catch(error){if(claimed&&proposalId&&organizationId){await markAgentActionFailed(organizationId,proposalId,error).catch(markError=>console.error('Failed to persist agent action failure:',markError instanceof Error?markError.message:markError));}if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);if(error instanceof AgentActionReplayError)return res.status(error.status).json({error:error.message});const message=error instanceof Error?error.message:'Agent action failed';const invalid=/required|expired|changed|valid|Unsupported|Invalid|must|cannot|not found|does not belong|already belongs|history|converted/i.test(message);return res.status(invalid?400:502).json({error:message});}
});
