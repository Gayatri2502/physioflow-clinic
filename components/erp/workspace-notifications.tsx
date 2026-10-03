'use client';
import Link from './navigation-link';
import {canRead} from '../../permissions/roles';
import {money} from './config';
export default function WorkspaceNotifications({actor,records,onClose}:any){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),apps=records.filter((x:any)=>x.kind==='Appointments'),role=actor.role;
 const outstanding=records.filter((x:any)=>x.kind==='Billing').reduce((sum:number,x:any)=>sum+Math.max(0,Number(x.data.Balance||0)),0);
 const notices=role==='Patient'?[['Appointments',`${apps.filter((x:any)=>x.data.Date>=today&&!['Cancelled','Completed','No Show'].includes(x.data.Status)).length} upcoming appointments`],['Billing',`${money(outstanding)} outstanding on your invoices`]]:role==='Doctor / Physiotherapist'?[['Appointments',`${apps.filter((x:any)=>x.data.Date===today&&x.data.Status==='Checked-In').length} assigned patients waiting`],['Consultation',`${apps.filter((x:any)=>['In Treatment','Completed'].includes(x.data.Status)&&!records.some((r:any)=>r.kind==='Consultation'&&r.data.appointmentId===x.id)).length} visits awaiting consultation notes`]]:role==='Accountant'?[['Billing',`${money(outstanding)} outstanding`],['Schemes',`${records.filter((x:any)=>x.kind==='Schemes'&&['Submitted','Under Review'].includes(x.data['Claim Status'])).length} claims under review`]]:[['Appointments',`${apps.filter((x:any)=>x.data.Date===today&&x.data.Status==='Checked-In').length} patients checked in today`],['Appointments',`${apps.filter((x:any)=>x.data.Date>=today&&x.data.Status==='Scheduled').length} appointments awaiting confirmation`],['Billing',`${money(outstanding)} outstanding invoices`]];
 return <div className="notification-pop"><h3>Your updates</h3>{notices.filter(([module])=>canRead(role,module)).map(([module,label])=><Link key={label} href={'/'+module} onClick={onClose}><p>{label}</p></Link>)}</div>;
}
