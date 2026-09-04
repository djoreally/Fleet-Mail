import { Pool } from '@neondatabase/serverless';
import { Router } from 'express';
import { requireFleetOrganization, fleetAuthFailure } from '../services/fleetAuth.js';
import { financialReadModelService } from '../services/financialReadModel.js';

export const dashboardRouter = Router();

const asNumber=(value:unknown)=>Number(value||0);

/**
 * Organization-scoped operational dashboard. This endpoint intentionally uses
 * only canonical Fleet OS records. It does not infer mileage, telematics, or
 * connected-vehicle state that Fleet OS does not currently possess.
 */
dashboardRouter.get('/dashboard', async (req,res)=>{
  let organizationId:string;
  try{organizationId=await requireFleetOrganization(req);}catch(error){return fleetAuthFailure(res,error);}
  const url=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;
  if(!url)return res.status(503).json({error:'Database is not configured'});
  const pool=new Pool({connectionString:url});
  try{
    const [countsResult,upcomingResult,reviewResult,authorizationResult,overdueResult,followUpResult,pipelineResult,recentResult,financials]=await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*) FROM public.customers WHERE organization_id=$1 AND status='active') AS fleet_accounts,
        (SELECT COUNT(*) FROM public.vehicles WHERE organization_id=$1 AND status='active') AS vehicles,
        (SELECT COUNT(*) FROM public.work_orders WHERE organization_id=$1 AND status NOT IN ('complete','completed','closed','cancelled','canceled')) AS open_work_orders,
        (SELECT COUNT(*) FROM public.prospects WHERE organization_id=$1 AND converted_customer_id IS NULL AND stage NOT IN ('lost','converted','won')) AS active_prospects`,[organizationId]),
      pool.query(`SELECT a.id,a.starts_at,a.status,c.name AS customer_name,v.unit_number,w.number AS work_order_number
        FROM public.appointments a
        LEFT JOIN public.customers c ON c.organization_id=a.organization_id AND c.id=a.customer_id
        LEFT JOIN public.vehicles v ON v.organization_id=a.organization_id AND v.id=a.vehicle_id
        LEFT JOIN public.work_orders w ON w.organization_id=a.organization_id AND w.id=a.work_order_id
        WHERE a.organization_id=$1 AND a.starts_at>=NOW() AND a.starts_at<NOW()+INTERVAL '24 hours'
          AND a.status NOT IN ('cancelled','canceled')
        ORDER BY a.starts_at ASC LIMIT 12`,[organizationId]),
      pool.query(`SELECT w.id,w.number,c.name AS customer_name,v.unit_number
        FROM public.work_orders w
        LEFT JOIN public.customers c ON c.organization_id=w.organization_id AND c.id=w.customer_id
        LEFT JOIN public.vehicles v ON v.organization_id=w.organization_id AND v.id=w.vehicle_id
        WHERE w.organization_id=$1 AND w.status='review'
        ORDER BY w.updated_at DESC LIMIT 5`,[organizationId]),
      pool.query(`SELECT a.id,w.number,c.name AS customer_name
        FROM public.authorizations a
        JOIN public.work_orders w ON w.organization_id=a.organization_id AND w.id=a.work_order_id
        LEFT JOIN public.customers c ON c.organization_id=w.organization_id AND c.id=w.customer_id
        WHERE a.organization_id=$1 AND a.status='pending'
        ORDER BY a.created_at ASC LIMIT 5`,[organizationId]),
      pool.query(`SELECT i.id,i.number,i.balance_due,c.name AS customer_name,i.due_at
        FROM public.invoices i
        JOIN public.customers c ON c.organization_id=i.organization_id AND c.id=i.customer_id
        WHERE i.organization_id=$1 AND COALESCE(i.balance_due,0)>0 AND i.due_at<NOW() AND i.status<>'void'
        ORDER BY i.due_at ASC LIMIT 5`,[organizationId]),
      pool.query(`SELECT p.id,p.company_name,p.next_follow_up_at,p.stage
        FROM public.prospects p
        WHERE p.organization_id=$1 AND p.converted_customer_id IS NULL AND p.next_follow_up_at IS NOT NULL
          AND p.next_follow_up_at<=NOW() AND p.stage NOT IN ('lost','converted','won')
        ORDER BY p.next_follow_up_at ASC LIMIT 5`,[organizationId]),
      pool.query(`SELECT stage,COUNT(*)::int AS count
        FROM public.prospects WHERE organization_id=$1 AND converted_customer_id IS NULL AND stage NOT IN ('lost','converted','won')
        GROUP BY stage ORDER BY COUNT(*) DESC,stage ASC`,[organizationId]),
      pool.query(`SELECT w.id,w.number,w.status,w.updated_at,c.name AS customer_name,v.unit_number
        FROM public.work_orders w
        LEFT JOIN public.customers c ON c.organization_id=w.organization_id AND c.id=w.customer_id
        LEFT JOIN public.vehicles v ON v.organization_id=w.organization_id AND v.id=w.vehicle_id
        WHERE w.organization_id=$1 ORDER BY w.updated_at DESC LIMIT 6`,[organizationId]),
      financialReadModelService.dashboard(organizationId),
    ]);

    const counts=countsResult.rows[0]||{};
    const attention:any[]=[];
    for(const row of reviewResult.rows)attention.push({kind:'work_order_review',title:`${row.number} needs review`,subtitle:[row.customer_name,row.unit_number?`Unit ${row.unit_number}`:null].filter(Boolean).join(' · '),severity:'warning',target:'work-orders'});
    for(const row of authorizationResult.rows)attention.push({kind:'authorization',title:`${row.number} awaiting authorization`,subtitle:row.customer_name||'Fleet account authorization pending',severity:'warning',target:'work-orders'});
    for(const row of overdueResult.rows)attention.push({kind:'invoice_overdue',title:`Invoice ${row.number} is overdue`,subtitle:`${row.customer_name} · $${Number(row.balance_due||0).toFixed(2)} outstanding`,severity:'critical',target:'financials'});
    for(const row of followUpResult.rows)attention.push({kind:'prospect_follow_up',title:`Follow up with ${row.company_name}`,subtitle:`Pipeline stage: ${String(row.stage||'new').replace(/_/g,' ')}`,severity:'info',target:'prospects'});

    const stages=Object.fromEntries(pipelineResult.rows.map(row=>[String(row.stage||'new'),asNumber(row.count)]));
    return res.json({
      generatedAt:new Date().toISOString(),
      summary:{fleetAccounts:asNumber(counts.fleet_accounts),vehicles:asNumber(counts.vehicles),openWorkOrders:asNumber(counts.open_work_orders),activeProspects:asNumber(counts.active_prospects)},
      attention:attention.slice(0,12),
      upcomingOperations:upcomingResult.rows.map(row=>({id:String(row.id),startsAt:row.starts_at,status:String(row.status||'scheduled'),customerName:row.customer_name||null,unitNumber:row.unit_number||null,workOrderNumber:row.work_order_number||null})),
      financials:{outstanding:financials.summary.outstanding,overdue:financials.summary.overdue,collected:financials.summary.collected},
      pipeline:{total:asNumber(counts.active_prospects),followUpDue:followUpResult.rowCount||0,stages},
      recentActivity:recentResult.rows.map(row=>({id:String(row.id),number:String(row.number),status:String(row.status),customerName:row.customer_name||null,unitNumber:row.unit_number||null,updatedAt:row.updated_at})),
    });
  }catch(error){console.error('Dashboard read failed',error instanceof Error?error.message:error);return res.status(500).json({error:'Dashboard data could not be loaded'});}finally{await pool.end();}
});
