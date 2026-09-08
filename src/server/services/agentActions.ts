import crypto from 'node:crypto';

export type AgentActionKind =
  | 'email.send'
  | 'calendar.create'
  | 'fleet.work_order.create'
  | 'fleet.work_order.update'
  | 'fleet.work_order.delete'
  | 'fleet.work_order.transition'
  | 'fleet.authorization.decision'
  | 'fleet.prospect.create'
  | 'fleet.prospect.update'
  | 'fleet.prospect.delete'
  | 'fleet.prospect.convert'
  | 'fleet.account.create'
  | 'fleet.account.update'
  | 'fleet.account.delete'
  | 'fleet.contact.create'
  | 'fleet.contact.update'
  | 'fleet.contact.delete'
  | 'fleet.vehicle.create'
  | 'fleet.vehicle.update'
  | 'fleet.vehicle.delete'
  | 'fleet.schedule.create'
  | 'fleet.schedule.update'
  | 'fleet.schedule.delete'
  | 'fleet.dispatch.create'
  | 'fleet.dispatch.update'
  | 'fleet.dispatch.transition'
  | 'fleet.customer.onboard';

export interface AgentActionProposal {
  id: string;
  organizationId?: string;
  kind: AgentActionKind;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

function signingKey() {
  const secret = process.env.AGENT_ACTION_SECRET || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) throw new Error('Agent action signing is not configured');
  return crypto.createHash('sha256').update(secret).digest();
}
function requiredText(value: unknown, name: string, max = 10_000) { const text=String(value||'').trim(); if(!text)throw new Error(`${name} is required`); if(text.length>max)throw new Error(`${name} is too long`); return text; }
function optionalText(value: unknown, max = 10_000) { const text=String(value??'').trim(); return text?text.slice(0,max):undefined; }
function email(value: unknown) { const text=requiredText(value,'Recipient',320); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))throw new Error('Recipient must be a valid email address'); return text; }
function optionalEmail(value: unknown) { const text=optionalText(value,320); if(text&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))throw new Error('Email must be a valid email address'); return text; }
function isoDate(value: unknown, name: string) { const text=requiredText(value,name,64); const date=new Date(text); if(Number.isNaN(date.getTime()))throw new Error(`${name} must be a valid date and time`); return date.toISOString(); }
function optionalNumber(value: unknown, name: string) { if(value===undefined||value===null||value==='')return undefined; const number=Number(value); if(!Number.isFinite(number)||number<0)throw new Error(`${name} must be zero or greater`); return number; }
function optionalInteger(value: unknown, name: string) { const number=optionalNumber(value,name); if(number===undefined)return undefined; if(!Number.isInteger(number))throw new Error(`${name} must be a whole number`); return number; }
function bool(value: unknown, fallback=false) { if(value===undefined||value===null||value==='')return fallback; return value===true||value==='true'||value==='1'; }
function object(value: unknown) { return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}; }
function idPayload(source:Record<string,unknown>,key:string,label:string){return{[key]:requiredText(source[key],label,100)}}
function vehiclePayload(value: unknown, requireCustomer=true) { const source=object(value); const vin=optionalText(source.vin,17)?.toUpperCase(); if(vin&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new Error('VIN must be 17 characters and cannot contain I, O, or Q'); return { ...(requireCustomer?{customerId:requiredText(source.customerId,'Fleet account',100)}:{}), unitNumber:requiredText(source.unitNumber,'Vehicle unit number',100), vin, year:optionalInteger(source.year,'Vehicle year'), make:optionalText(source.make,100), model:optionalText(source.model,100), engine:optionalText(source.engine,160), mileage:optionalInteger(source.mileage,'Mileage'), engineHours:optionalInteger(source.engineHours,'Engine hours'), licensePlate:optionalText(source.licensePlate,50), registrationState:optionalText(source.registrationState,30), assignedDriver:optionalText(source.assignedDriver,160), department:optionalText(source.department,120), notes:optionalText(source.notes,2000), status:optionalText(source.status,40) }; }
function accountPayload(source:Record<string,unknown>,requireName=true){return{...(requireName?{name:requiredText(source.name,'Fleet account name',300)}:{name:optionalText(source.name,300)}),accountNumber:optionalText(source.accountNumber,80),primaryContactName:optionalText(source.primaryContactName,200),primaryContactEmail:optionalEmail(source.primaryContactEmail),phone:optionalText(source.phone,50),notes:optionalText(source.notes,2000),status:optionalText(source.status,40)}}
function contactPayload(source:Record<string,unknown>,requireAccount=true,requireName=true){return{...(requireAccount?{customerId:requiredText(source.customerId,'Fleet account',100)}:{}),...(requireName?{name:requiredText(source.name,'Contact name',300)}:{name:optionalText(source.name,300)}),email:optionalEmail(source.email),phone:optionalText(source.phone,50),role:optionalText(source.role,120),notes:optionalText(source.notes,2000),isPrimary:bool(source.isPrimary,true)}}

export function normalizeAgentAction(kind: unknown, raw: unknown): { kind: AgentActionKind; payload: Record<string, unknown>; summary: string } {
  const source=object(raw);
  if(kind==='email.send'){const payload={to:email(source.to),subject:requiredText(source.subject,'Subject',998),text:requiredText(source.text??source.body,'Email body',100000),prospectId:optionalText(source.prospectId,100),contactId:optionalText(source.contactId,100)};return{kind,payload,summary:`Send “${payload.subject}” to ${payload.to}`};}
  if(kind==='calendar.create'){const start=isoDate(source.start,'Start'),end=isoDate(source.end,'End');if(new Date(end)<=new Date(start))throw new Error('End must be after start');const attendees=Array.isArray(source.attendees)?source.attendees.slice(0,50).map(email):[];const payload={summary:requiredText(source.summary??source.title,'Event title',1000),description:optionalText(source.description,20000),location:optionalText(source.location,1000),start:{dateTime:start},end:{dateTime:end},attendees:attendees.map(address=>({email:address}))};return{kind,payload,summary:`Create “${payload.summary}” on ${new Date(start).toLocaleString('en-US',{timeZone:'UTC'})} UTC`};}
  if(kind==='fleet.work_order.create'){const payload={vehicleId:requiredText(source.vehicleId,'Vehicle',100),complaint:requiredText(source.complaint??source.requestedService,'Requested service',2000),requestedServices:Array.isArray(source.requestedServices)?source.requestedServices.slice(0,30).map(x=>String(x).trim()).filter(Boolean):optionalText(source.requestedServices,2000),purchaseOrderNumber:optionalText(source.purchaseOrderNumber,100),odometer:optionalNumber(source.odometer,'Odometer'),engineHours:optionalNumber(source.engineHours,'Engine hours'),scheduledAt:source.scheduledAt?isoDate(source.scheduledAt,'Scheduled time'):undefined,priority:optionalText(source.priority,30)??'routine',customerNotes:optionalText(source.customerNotes,2000),technicianNotes:optionalText(source.technicianNotes,2000)};return{kind,payload,summary:`Create a work order for vehicle ${payload.vehicleId}: ${payload.complaint}`};}
  if(kind==='fleet.work_order.update'){const payload={workOrderId:requiredText(source.workOrderId,'Work order',100),complaint:optionalText(source.complaint,2000),requestedServices:Array.isArray(source.requestedServices)?source.requestedServices.slice(0,30).map(x=>String(x).trim()).filter(Boolean):optionalText(source.requestedServices,2000),purchaseOrderNumber:optionalText(source.purchaseOrderNumber,100),odometer:optionalNumber(source.odometer,'Odometer'),engineHours:optionalNumber(source.engineHours,'Engine hours'),scheduledAt:source.scheduledAt?isoDate(source.scheduledAt,'Scheduled time'):undefined,priority:optionalText(source.priority,30),customerNotes:optionalText(source.customerNotes,2000),technicianNotes:optionalText(source.technicianNotes,2000)};return{kind,payload,summary:`Update work order ${payload.workOrderId}`};}
  if(kind==='fleet.work_order.delete'){const payload=idPayload(source,'workOrderId','Work order');return{kind,payload,summary:`Delete work order ${payload.workOrderId} if it has no protected execution history`};}
  if(kind==='fleet.work_order.transition'){const payload={workOrderId:requiredText(source.workOrderId,'Work order',100),status:requiredText(source.status,'Status',60)};return{kind,payload,summary:`Move work order ${payload.workOrderId} to ${payload.status.replaceAll('_',' ')}`};}
  if(kind==='fleet.authorization.decision'){const decision=requiredText(source.decision,'Decision',20);if(!['authorized','rejected'].includes(decision))throw new Error('Decision must be authorized or rejected');const payload={authorizationId:requiredText(source.authorizationId,'Authorization',100),decision,authorizedBy:optionalText(source.authorizedBy,200),authorizationMethod:optionalText(source.authorizationMethod,80),purchaseOrderNumber:optionalText(source.purchaseOrderNumber,100),notes:optionalText(source.notes,2000)};return{kind,payload,summary:`${decision==='authorized'?'Approve':'Reject'} authorization ${payload.authorizationId}`};}
  if(kind==='fleet.prospect.create'){const payload={companyName:requiredText(source.companyName,'Company name',300),website:optionalText(source.website,1000),industry:optionalText(source.industry,200),serviceArea:optionalText(source.serviceArea,500),estimatedFleetSize:optionalInteger(source.estimatedFleetSize,'Estimated fleet size'),generalEmail:optionalEmail(source.generalEmail),phone:optionalText(source.phone,100),notes:optionalText(source.notes,10000),stage:optionalText(source.stage,40)??'new',opportunityValue:optionalNumber(source.opportunityValue,'Opportunity value')};return{kind,payload,summary:`Add ${payload.companyName} as a prospect`};}
  if(kind==='fleet.prospect.update'){const payload={prospectId:requiredText(source.prospectId,'Prospect',100),companyName:optionalText(source.companyName,300),website:optionalText(source.website,1000),industry:optionalText(source.industry,200),serviceArea:optionalText(source.serviceArea,500),estimatedFleetSize:optionalInteger(source.estimatedFleetSize,'Estimated fleet size'),generalEmail:optionalEmail(source.generalEmail),phone:optionalText(source.phone,100),notes:optionalText(source.notes,10000),stage:optionalText(source.stage,40),opportunityValue:optionalNumber(source.opportunityValue,'Opportunity value')};return{kind,payload,summary:`Update prospect ${payload.prospectId}`};}
  if(kind==='fleet.prospect.delete'){const payload=idPayload(source,'prospectId','Prospect');return{kind,payload,summary:`Delete prospect ${payload.prospectId} if it has not been converted`};}
  if(kind==='fleet.prospect.convert'){const payload=idPayload(source,'prospectId','Prospect');return{kind,payload,summary:`Convert prospect ${payload.prospectId} into a Fleet Account`};}
  if(kind==='fleet.account.create'){const payload=accountPayload(source,true);return{kind,payload,summary:`Add ${payload.name} as a Fleet Account`};}
  if(kind==='fleet.account.update'){const payload={customerId:requiredText(source.customerId,'Fleet account',100),...accountPayload(source,false)};return{kind,payload,summary:`Update Fleet Account ${payload.customerId}`};}
  if(kind==='fleet.account.delete'){const payload=idPayload(source,'customerId','Fleet account');return{kind,payload,summary:`Delete Fleet Account ${payload.customerId} if service history permits`};}
  if(kind==='fleet.contact.create'){const payload=contactPayload(source,true,true);return{kind,payload,summary:`Add ${payload.name} as a Fleet contact`};}
  if(kind==='fleet.contact.update'){const payload={contactId:requiredText(source.contactId,'Contact',100),...contactPayload(source,false,false)};return{kind,payload,summary:`Update contact ${payload.contactId}`};}
  if(kind==='fleet.contact.delete'){const payload=idPayload(source,'contactId','Contact');return{kind,payload,summary:`Delete contact ${payload.contactId}`};}
  if(kind==='fleet.vehicle.create'){const payload=vehiclePayload(source,true);return{kind,payload,summary:`Add vehicle ${payload.unitNumber} to Fleet account ${payload.customerId}`};}
  if(kind==='fleet.vehicle.update'){const payload={vehicleId:requiredText(source.vehicleId,'Vehicle',100),...vehiclePayload({...source,unitNumber:source.unitNumber??'__preserve__'},false)};if(payload.unitNumber==='__preserve__')delete (payload as any).unitNumber;return{kind,payload,summary:`Update vehicle ${payload.vehicleId}`};}
  if(kind==='fleet.vehicle.delete'){const payload=idPayload(source,'vehicleId','Vehicle');return{kind,payload,summary:`Delete vehicle ${payload.vehicleId} if linked history permits`};}
  if(kind==='fleet.schedule.create'){const payload={workOrderId:requiredText(source.workOrderId,'Work order',100),startsAt:isoDate(source.startsAt,'Start'),endsAt:isoDate(source.endsAt,'End'),locationId:optionalText(source.locationId,100),notes:optionalText(source.notes,2000)};if(new Date(payload.endsAt)<=new Date(payload.startsAt))throw new Error('End must be after start');return{kind,payload,summary:`Schedule work order ${payload.workOrderId}`};}
  if(kind==='fleet.schedule.update'){const payload={appointmentId:requiredText(source.appointmentId,'Appointment',100),workOrderId:optionalText(source.workOrderId,100),startsAt:source.startsAt?isoDate(source.startsAt,'Start'):undefined,endsAt:source.endsAt?isoDate(source.endsAt,'End'):undefined,locationId:optionalText(source.locationId,100),notes:optionalText(source.notes,2000),status:optionalText(source.status,40)};return{kind,payload,summary:`Update appointment ${payload.appointmentId}`};}
  if(kind==='fleet.schedule.delete'){const payload=idPayload(source,'appointmentId','Appointment');return{kind,payload,summary:`Delete appointment ${payload.appointmentId}`};}
  if(kind==='fleet.dispatch.create'){const payload={workOrderId:requiredText(source.workOrderId,'Work order',100),appointmentId:optionalText(source.appointmentId,100),technicianId:requiredText(source.technicianId,'Technician',100),resourceId:optionalText(source.resourceId,100),startsAt:source.startsAt?isoDate(source.startsAt,'Start'):undefined};return{kind,payload,summary:`Assign work order ${payload.workOrderId} to technician ${payload.technicianId}`};}
  if(kind==='fleet.dispatch.update'){const payload={dispatchId:requiredText(source.dispatchId,'Dispatch',100),technicianId:optionalText(source.technicianId,100),resourceId:optionalText(source.resourceId,100),appointmentId:optionalText(source.appointmentId,100),startsAt:source.startsAt?isoDate(source.startsAt,'Start'):undefined};return{kind,payload,summary:`Update dispatch ${payload.dispatchId}`};}
  if(kind==='fleet.dispatch.transition'){const payload={dispatchId:requiredText(source.dispatchId,'Dispatch',100),status:requiredText(source.status,'Status',40),notes:optionalText(source.notes,2000)};return{kind,payload,summary:`Move dispatch ${payload.dispatchId} to ${payload.status.replaceAll('_',' ')}`};}
  if(kind==='fleet.customer.onboard'){const accountSource=object(source.account),contactSource=source.contact?object(source.contact):null,vehicles=Array.isArray(source.vehicles)?source.vehicles.slice(0,50).map(item=>vehiclePayload(item,false)):[];const payload={customerId:optionalText(source.customerId,100),account:accountPayload(accountSource,true),contact:contactSource?contactPayload(contactSource,false,true):undefined,vehicles};if(payload.customerId&&!payload.contact&&!payload.vehicles.length)throw new Error('Onboarding an existing Fleet account requires a contact or vehicle');const details=[payload.contact?'contact':'',payload.vehicles.length?`${payload.vehicles.length} vehicle${payload.vehicles.length===1?'':'s'}`:''].filter(Boolean).join(' and ');return{kind,payload,summary:`Onboard ${payload.account.name}${details?` with ${details}`:''}`};}
  throw new Error('Unsupported agent action');
}

export function createAgentActionProposal(kind: unknown, payload: unknown, organizationId?: string) {
  const normalized=normalizeAgentAction(kind,payload);const scopedOrganizationId=organizationId?requiredText(organizationId,'Fleet organization',100):undefined;const now=Date.now();const proposal:AgentActionProposal={id:crypto.randomUUID(),...(scopedOrganizationId?{organizationId:scopedOrganizationId}:{}),...normalized,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+10*60_000).toISOString()};const encoded=Buffer.from(JSON.stringify(proposal)).toString('base64url');const signature=crypto.createHmac('sha256',signingKey()).update(encoded).digest('base64url');return{proposal,confirmationToken:`${encoded}.${signature}`};
}
export function verifyAgentActionProposal(token: unknown, expectedOrganizationId?: string): AgentActionProposal {
  const [encoded,signature]=String(token||'').split('.');if(!encoded||!signature)throw new Error('A valid confirmation token is required');const expected=crypto.createHmac('sha256',signingKey()).update(encoded).digest();const actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw new Error('The action proposal was changed');const proposal=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')) as AgentActionProposal;if(new Date(proposal.expiresAt).getTime()<Date.now())throw new Error('The action proposal expired; review it again');if(expectedOrganizationId){const expectedOrg=requiredText(expectedOrganizationId,'Fleet organization',100);if(!proposal.organizationId||proposal.organizationId!==expectedOrg)throw new Error('The action proposal does not belong to this Fleet organization');}const validationPayload=proposal.kind==='calendar.create'?{...proposal.payload,start:(proposal.payload.start as any)?.dateTime,end:(proposal.payload.end as any)?.dateTime,attendees:Array.isArray(proposal.payload.attendees)?(proposal.payload.attendees as any[]).map(item=>item.email):[]}:proposal.payload;normalizeAgentAction(proposal.kind,validationPayload);return proposal;
}
