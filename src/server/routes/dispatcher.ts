import { Pool } from '@neondatabase/serverless';
import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, getFleetAccessContext, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';

export const dispatcherRouter = Router();

dispatcherRouter.get('/me', async (req,res)=>{
  let pool:Pool|null=null;
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetPermission(req,'dispatch.view');
    const access=await getFleetAccessContext(req);
    if(access.role!=='dispatcher') return res.status(403).json({error:'Dispatcher workspace is available to dispatcher users'});
    const url=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;if(!url)return res.status(503).json({error:'Database is not configured'});
    pool=new Pool({connectionString:url});
    const [jobs,technicians,availability,pendingAuth]=await Promise.all([
      pool.query(`SELECT w.id,w.number,w.status,w.priority,w.scheduled_at AS "scheduledAt",w.technician_id AS "technicianId",c.name AS "customerName",v.unit_number AS "unitNumber",t.name AS "technicianName"
        FROM public.work_orders w
        LEFT JOIN public.customers c ON c.organization_id=w.organization_id AND c.id=w.customer_id
        LEFT JOIN public.vehicles v ON v.organization_id=w.organization_id AND v.id=w.vehicle_id
        LEFT JOIN public.technicians t ON t.organization_id=w.organization_id AND t.id=w.technician_id
        WHERE w.organization_id=$1 AND w.status NOT IN ('complete','completed','closed','cancelled','canceled')
        ORDER BY CASE WHEN w.technician_id IS NULL THEN 0 WHEN w.status IN ('en_route','arrived','in_progress') THEN 1 ELSE 2 END,w.scheduled_at NULLS LAST,w.updated_at DESC LIMIT 100`,[organizationId]),
      pool.query(`SELECT id,name,phone,skills,active FROM public.technicians WHERE organization_id=$1 AND active=true ORDER BY name`,[organizationId]),
      pool.query(`SELECT technician_id AS "technicianId",starts_at AS "startsAt",ends_at AS "endsAt",status FROM public.availability WHERE organization_id=$1 AND ends_at>=NOW() AND starts_at<NOW()+INTERVAL '7 days' ORDER BY starts_at`,[organizationId]),
      pool.query(`SELECT a.id,w.number,c.name AS "customerName",a.amount,a.created_at AS "createdAt" FROM public.authorizations a JOIN public.work_orders w ON w.organization_id=a.organization_id AND w.id=a.work_order_id LEFT JOIN public.customers c ON c.organization_id=w.organization_id AND c.id=w.customer_id WHERE a.organization_id=$1 AND a.status='pending' ORDER BY a.created_at LIMIT 20`,[organizationId]),
    ]);
    const rows=jobs.rows;
    return res.json({
      role:'dispatcher',
      summary:{unassigned:rows.filter(x=>!x.technicianId).length,today:rows.filter(x=>x.scheduledAt&&new Date(x.scheduledAt).toDateString()===new Date().toDateString()).length,inProgress:rows.filter(x=>['en_route','arrived','in_progress'].includes(x.status)).length,exceptions:rows.filter(x=>['review','authorization_pending'].includes(x.status)).length},
      queues:{unassigned:rows.filter(x=>!x.technicianId),today:rows.filter(x=>x.scheduledAt&&new Date(x.scheduledAt).toDateString()===new Date().toDateString()),inProgress:rows.filter(x=>['en_route','arrived','in_progress'].includes(x.status)),exceptions:rows.filter(x=>['review','authorization_pending'].includes(x.status))},
      technicians:technicians.rows,
      availability:availability.rows,
      pendingAuthorizations:pendingAuth.rows,
    });
  }catch(error){if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);return res.status(500).json({error:error instanceof Error?error.message:'Dispatcher dashboard failed'});}
  finally{if(pool)await pool.end();}
});
