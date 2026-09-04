import { Pool } from '@neondatabase/serverless';
import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, getFleetAccessContext, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { getTechnicianScope } from '../services/technicianAccess.js';

export const technicianRouter = Router();

technicianRouter.get('/me', async (req,res)=>{
  let pool:Pool|null=null;
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetPermission(req,'work_orders.execute');
    const access=await getFleetAccessContext(req);
    if(access.role!=='technician') return res.status(403).json({error:'Technician workspace is available to technician users'});
    const scope=await getTechnicianScope(req,organizationId);
    const url=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;
    if(!url)return res.status(503).json({error:'Database is not configured'});
    pool=new Pool({connectionString:url});
    const [profile,jobs]=await Promise.all([
      pool.query(`SELECT id,name,active,created_at AS "createdAt" FROM public.technicians WHERE organization_id=$1 AND id=$2 LIMIT 1`,[organizationId,scope.technicianId]),
      pool.query(`SELECT w.id,w.number,w.status,w.priority,w.complaint,w.scheduled_at AS "scheduledAt",w.requested_services AS "requestedServices",c.name AS "customerName",v.unit_number AS "unitNumber",v.year,v.make,v.model
        FROM public.work_orders w
        LEFT JOIN public.customers c ON c.organization_id=w.organization_id AND c.id=w.customer_id
        LEFT JOIN public.vehicles v ON v.organization_id=w.organization_id AND v.id=w.vehicle_id
        WHERE w.organization_id=$1 AND w.technician_id=$2 AND w.status NOT IN ('cancelled','canceled')
        ORDER BY CASE WHEN w.status IN ('in_progress','arrived','en_route') THEN 0 WHEN w.status IN ('assigned','scheduled') THEN 1 ELSE 2 END,
          w.scheduled_at NULLS LAST,w.updated_at DESC LIMIT 50`,[organizationId,scope.technicianId]),
    ]);
    const rows=jobs.rows;
    return res.json({
      role:'technician',profile:profile.rows[0]||null,
      summary:{assigned:rows.filter(x=>['assigned','scheduled'].includes(x.status)).length,inProgress:rows.filter(x=>['en_route','arrived','in_progress','review','authorization_pending','authorized'].includes(x.status)).length,completed:rows.filter(x=>['complete','completed'].includes(x.status)).length},
      jobs:rows,
    });
  }catch(error){if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);return res.status(500).json({error:error instanceof Error?error.message:'Technician dashboard failed'});}
  finally{if(pool)await pool.end();}
});
