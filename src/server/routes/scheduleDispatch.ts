import { Router, type Request, type Response } from 'express';
import { FleetOperationsError, ScheduleDispatchService } from '../services/scheduleDispatch.js';
import { fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { appointments, customers, dispatchAssignments, resources, technicians, vehicles, workOrders } from '../../db/drizzleSchema.js';

export const scheduleDispatchRouter = Router();
const service = new ScheduleDispatchService();
const db = () => { const value=getDb(); if(!value) throw new Error('Production database is not configured'); return value; };
const appointmentInput=(organizationId:string,input:any)=>({id:input.id||randomUUID(),organizationId,customerId:String(input.customerId),vehicleId:String(input.vehicleId),workOrderId:input.workOrderId?String(input.workOrderId):null,status:String(input.status||'scheduled'),startsAt:new Date(String(input.startsAt)),endsAt:new Date(String(input.endsAt)),notes:input.notes?String(input.notes):null});
const context = async (req: Request) => ({ organizationId: await requireFleetOrganization(req), authorization: req.header('authorization') });
const run = (handler: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  try { res.json(await handler(req)); }
  catch (error) {
    if (error instanceof FleetOperationsError) return res.status(error.status).json({ error: error.message });
    return fleetAuthFailure(res, error);
  }
};

scheduleDispatchRouter.get('/appointments', run(async req => { const c=await context(req); return db().select().from(appointments).where(eq(appointments.organizationId,c.organizationId)).orderBy(asc(appointments.startsAt)); }));
scheduleDispatchRouter.post('/appointments', run(async req => { const c=await context(req); const [created]=await db().insert(appointments).values(appointmentInput(c.organizationId,req.body)).returning(); return [created]; }));
scheduleDispatchRouter.patch('/appointments/:id', run(async req => { const c=await context(req); const values:any={updatedAt:new Date()}; if(req.body.status!=null)values.status=String(req.body.status);if(req.body.startsAt)values.startsAt=new Date(req.body.startsAt);if(req.body.endsAt)values.endsAt=new Date(req.body.endsAt);if(req.body.notes!==undefined)values.notes=req.body.notes||null;return db().update(appointments).set(values).where(and(eq(appointments.organizationId,c.organizationId),eq(appointments.id,req.params.id))).returning(); }));
scheduleDispatchRouter.delete('/appointments/:id', run(async req => { const c=await context(req); await db().delete(appointments).where(and(eq(appointments.organizationId,c.organizationId),eq(appointments.id,req.params.id))); return {deleted:true,id:req.params.id}; }));
scheduleDispatchRouter.get('/dispatch', run(async req => { const c=await context(req); return db().select().from(dispatchAssignments).where(eq(dispatchAssignments.organizationId,c.organizationId)); }));
scheduleDispatchRouter.post('/dispatch', run(async req => { const c=await context(req); const [created]=await db().insert(dispatchAssignments).values({id:randomUUID(),organizationId:c.organizationId,workOrderId:String(req.body.workOrderId),technicianId:String(req.body.technicianId),appointmentId:req.body.appointmentId||null,resourceId:req.body.resourceId||null,status:String(req.body.status||'assigned'),startsAt:req.body.startsAt?new Date(req.body.startsAt):null}).returning(); return [created]; }));
scheduleDispatchRouter.patch('/dispatch/:id', run(async req => { const c=await context(req); const values:any={};for(const [a,b] of [['status','status'],['technicianId','technicianId'],['appointmentId','appointmentId'],['resourceId','resourceId']] as const)if(req.body[a]!==undefined)values[b]=req.body[a]||null;if(req.body.startsAt!==undefined)values.startsAt=req.body.startsAt?new Date(req.body.startsAt):null;return db().update(dispatchAssignments).set(values).where(and(eq(dispatchAssignments.organizationId,c.organizationId),eq(dispatchAssignments.id,req.params.id))).returning(); }));
scheduleDispatchRouter.delete('/dispatch/:id', run(async req => { const c=await context(req); await db().delete(dispatchAssignments).where(and(eq(dispatchAssignments.organizationId,c.organizationId),eq(dispatchAssignments.id,req.params.id))); return {deleted:true,id:req.params.id}; }));
scheduleDispatchRouter.get('/references', run(async req => { const c=await context(req),database=db(); const [customerRows,vehicleRows,workRows,techRows,resourceRows,appointmentRows]=await Promise.all([database.select().from(customers).where(eq(customers.organizationId,c.organizationId)),database.select().from(vehicles).where(eq(vehicles.organizationId,c.organizationId)),database.select().from(workOrders).where(eq(workOrders.organizationId,c.organizationId)),database.select().from(technicians).where(eq(technicians.organizationId,c.organizationId)),database.select().from(resources).where(eq(resources.organizationId,c.organizationId)),database.select().from(appointments).where(eq(appointments.organizationId,c.organizationId))]); const snake=(row:any)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/[A-Z]/g,m=>`_${m.toLowerCase()}`),value])); return {customers:customerRows.map(snake),vehicles:vehicleRows.map(snake),work_orders:workRows.map(snake),technicians:techRows.map(snake),resources:resourceRows.map(snake),appointments:appointmentRows.map(snake)}; }));
