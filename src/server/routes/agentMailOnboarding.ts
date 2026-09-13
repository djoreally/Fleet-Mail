import { Router } from 'express';
import { agentMailTenantProvisioningService } from '../services/agentMailTenantProvisioning.js';
import { fleetAuthFailure, getFleetAccessContext, requireFleetOrganization, requireFleetRole } from '../services/fleetAuth.js';

export const agentMailOnboardingRouter=Router();

agentMailOnboardingRouter.get('/status',async(req,res)=>{
 try{
  const organizationId=await requireFleetOrganization(req);
  const access=await getFleetAccessContext(req);
  const status=await agentMailTenantProvisioningService.status(organizationId);
  return res.json({...status,organizationId,role:access.membershipRole,canProvision:['owner','admin'].includes(access.membershipRole)});
 }catch(error){return fleetAuthFailure(res,error);}
});

agentMailOnboardingRouter.post('/provision',async(req,res)=>{
 try{
  const organizationId=await requireFleetOrganization(req);
  await requireFleetRole(req,['owner','admin']);
  const result=await agentMailTenantProvisioningService.provision(organizationId,{
   businessName:String(req.body?.businessName||''),
   inboxUsername:String(req.body?.inboxUsername||''),
  });
  return res.json(result);
 }catch(error){return fleetAuthFailure(res,error);}
});
