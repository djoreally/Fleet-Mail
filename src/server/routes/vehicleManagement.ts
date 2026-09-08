import { Router } from 'express';
import { createVehicle, deleteVehicle, importVehicles, updateVehicle, VehicleStoreError } from '../services/vehicleStore.js';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { pagedVehicles } from '../services/operationalListPaging.js';

export const vehicleManagementRouter = Router();

function fail(res:any,error:unknown){
  if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);
  const status=error instanceof VehicleStoreError?error.status:/cursor/i.test(error instanceof Error?error.message:'')?400:500;
  return res.status(status).json({error:error instanceof Error?error.message:'Vehicle operation failed'});
}

vehicleManagementRouter.get('/vehicles',async(req,res)=>{
  try{
    const org=await requireFleetOrganization(req);
    const page=await pagedVehicles(org,{search:req.query.search??req.query.q,cursor:req.query.cursor,limit:req.query.limit});
    return res.json({organizationId:org,vehicles:page.items,nextCursor:page.nextCursor,hasMore:page.hasMore});
  }catch(error){return fail(res,error)}
});

vehicleManagementRouter.post('/vehicles',async(req,res)=>{
  try{
    const org=await requireFleetOrganization(req);
    await requireFleetPermission(req,'vehicles.manage');
    return res.status(201).json({vehicle:await createVehicle(req.body??{},org)});
  }catch(error){return fail(res,error)}
});

vehicleManagementRouter.post('/vehicles/import',async(req,res)=>{
  try{
    const org=await requireFleetOrganization(req);
    await requireFleetPermission(req,'vehicles.manage');
    const vehicles=await importVehicles(req.body?.vehicles,org);
    return res.status(201).json({vehicles,count:vehicles.length});
  }catch(error){return fail(res,error)}
});

vehicleManagementRouter.put('/vehicles/:id',async(req,res)=>{
  try{
    const org=await requireFleetOrganization(req);
    await requireFleetPermission(req,'vehicles.manage');
    return res.json({vehicle:await updateVehicle(req.params.id,req.body??{},org)});
  }catch(error){return fail(res,error)}
});

vehicleManagementRouter.delete('/vehicles/:id',async(req,res)=>{
  try{
    const org=await requireFleetOrganization(req);
    await requireFleetPermission(req,'vehicles.manage');
    await deleteVehicle(req.params.id,org);
    return res.status(204).end();
  }catch(error){return fail(res,error)}
});
