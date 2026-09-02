import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { prospectingService } from '../services/prospecting.js';
import { prospectOutreachService } from '../services/prospectOutreach.js';
import { prospectDiscoveryService } from '../services/prospectDiscovery.js';
import { createAgentActionProposal } from '../services/agentActions.js';

export const prospectingRouter=Router();
const fail=(res:any,error:unknown)=>{if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);const message=error instanceof Error?error.message:'Prospecting operation failed';return res.status(/not found/i.test(message)?404:/required|invalid|must|valid|incomplete|structured/i.test(message)?400:500).json({error:message});};

prospectingRouter.get('/prospects',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({prospects:await prospectingService.list(org,{search:String(req.query.search||''),stage:String(req.query.stage||'')})});}catch(e){return fail(res,e)}});
prospectingRouter.post('/prospects/discover',async(req,res)=>{try{await requireFleetOrganization(req);return res.json(await prospectDiscoveryService.discover(req.body??{}));}catch(e){return fail(res,e)}});
prospectingRouter.post('/prospects',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.status(201).json({prospect:await prospectingService.create(org,req.body??{})});}catch(e){return fail(res,e)}});
prospectingRouter.get('/prospects/:id',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.json(await prospectingService.get(org,req.params.id));}catch(e){return fail(res,e)}});
prospectingRouter.patch('/prospects/:id',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({prospect:await prospectingService.update(org,req.params.id,req.body??{})});}catch(e){return fail(res,e)}});
prospectingRouter.post('/prospects/:id/contacts',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.status(201).json({contact:await prospectingService.addContact(org,req.params.id,req.body??{})});}catch(e){return fail(res,e)}});
prospectingRouter.post('/prospects/:id/activities',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.status(201).json({activity:await prospectingService.addActivity(org,req.params.id,req.body??{})});}catch(e){return fail(res,e)}});
prospectingRouter.post('/prospects/:id/research',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({prospect:await prospectingService.research(org,req.params.id)});}catch(e){return fail(res,e)}});
prospectingRouter.post('/prospects/:id/outreach/draft',async(req,res)=>{try{const org=await requireFleetOrganization(req);const draft=await prospectOutreachService.draft(org,req.params.id,req.body??{});return res.json({draft,action:createAgentActionProposal('email.send',draft)});}catch(e){return fail(res,e)}});
prospectingRouter.post('/prospects/:id/convert',async(req,res)=>{try{const org=await requireFleetOrganization(req);return res.json(await prospectingService.convertToFleetAccount(org,req.params.id));}catch(e){return fail(res,e)}});
