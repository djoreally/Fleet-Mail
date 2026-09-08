import{and,eq,sql}from'drizzle-orm';
import{getDb}from'../../db/index.js';
import{authorizations,dispatchAssignments,fluidUsage,inspections,partUsage,serviceLines,workOrders}from'../../db/drizzleSchema.js';

const BLANK_PRESERVE_FIELDS=new Set(['requestedServices','purchaseOrderNumber','odometer','engineHours','scheduledAt','customerNotes','technicianNotes','diagnosis','laborMinutes','travelMinutes','locationId','technicianId']);
export function sanitizeWorkOrderManagementPatch(input:Record<string,unknown>){
 if(Object.prototype.hasOwnProperty.call(input,'status'))throw new Error('Work-order lifecycle status must be changed through Dispatch or Technician execution');
 const output:Record<string,unknown>={};
 for(const[key,value]of Object.entries(input)){
  if(key==='vehicleId'||key==='customerId'||key==='organizationId'||key==='completedAt')continue;
  if(BLANK_PRESERVE_FIELDS.has(key)&&value==='')continue;
  output[key]=value;
 }
 return output;
}
export async function assertWorkOrderDeletable(organizationId:string,id:string){
 const db=getDb();if(!db)throw new Error('DATABASE_URL is not configured');
 const[row]=await db.select({status:workOrders.status}).from(workOrders).where(and(eq(workOrders.organizationId,organizationId),eq(workOrders.id,id))).limit(1);
 if(!row)throw new Error('Work order was not found');
 if(!['draft','scheduled'].includes(row.status))throw new Error('Only draft or scheduled work orders can be deleted; cancel operational work instead');
 const[counts]=await db.select({inspections:sql<number>`count(distinct ${inspections.id})`,authorizations:sql<number>`count(distinct ${authorizations.id})`,serviceLines:sql<number>`count(distinct ${serviceLines.id})`,parts:sql<number>`count(distinct ${partUsage.id})`,fluids:sql<number>`count(distinct ${fluidUsage.id})`,dispatches:sql<number>`count(distinct ${dispatchAssignments.id})`}).from(workOrders)
  .leftJoin(inspections,and(eq(inspections.organizationId,organizationId),eq(inspections.workOrderId,id)))
  .leftJoin(authorizations,and(eq(authorizations.organizationId,organizationId),eq(authorizations.workOrderId,id)))
  .leftJoin(serviceLines,and(eq(serviceLines.organizationId,organizationId),eq(serviceLines.workOrderId,id)))
  .leftJoin(partUsage,and(eq(partUsage.organizationId,organizationId),eq(partUsage.workOrderId,id)))
  .leftJoin(fluidUsage,and(eq(fluidUsage.organizationId,organizationId),eq(fluidUsage.workOrderId,id)))
  .leftJoin(dispatchAssignments,and(eq(dispatchAssignments.organizationId,organizationId),eq(dispatchAssignments.workOrderId,id)))
  .where(and(eq(workOrders.organizationId,organizationId),eq(workOrders.id,id)));
 if(Number(counts?.inspections||0)+Number(counts?.authorizations||0)+Number(counts?.serviceLines||0)+Number(counts?.parts||0)+Number(counts?.fluids||0)+Number(counts?.dispatches||0)>0)throw new Error('Work order has execution history and cannot be deleted; cancel it instead');
}
