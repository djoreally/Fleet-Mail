import React,{useEffect,useState}from'react';
import{fleetFetch}from'../../lib/fleetApi';
import{WorkOrderOperationsHub}from'./TechnicianWorkspace';
import{WorkOrdersCertifiedWorkspace}from'./WorkOrdersCertifiedWorkspace';

type Access={role?:string;permissions?:string[]};
export function CertifiedWorkOrderModule(){
 const[access,setAccess]=useState<Access|null>(null);
 useEffect(()=>{let live=true;fleetFetch('/api/access').then(async r=>{const data=await r.json().catch(()=>({}));if(live&&r.ok)setAccess(data)}).catch(()=>{});return()=>{live=false}},[]);
 if(access?.role==='technician')return <WorkOrderOperationsHub/>;
 return <WorkOrdersCertifiedWorkspace/>;
}
export default CertifiedWorkOrderModule;
