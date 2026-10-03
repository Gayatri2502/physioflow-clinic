'use client';
import Link from './navigation-link';
export default function AdminWorkspaceSummary({actor,records,audits}:any){
 const owner=actor.role==='Super Admin',staff=records.filter((x:any)=>x.kind==='Staff');
 return <section className="panel admin-workspace-summary"><div><h2>{owner?'Access & clinic oversight':'Daily clinic operations'}</h2><p>{owner?`${staff.filter((x:any)=>x.data.Status==='Active').length} active linked accounts · ${audits.length} recent audit entries`:`${records.filter((x:any)=>x.kind==='Doctors'&&x.data.Availability==='Available').length} therapists available · ${records.filter((x:any)=>x.kind==='Plans'&&x.data.Status==='Active').length} active treatment plans`}</p></div><div className="role-quick-actions">{owner?<><Link className="button secondary" href="/Settings?tab=Staff%20%26%20roles">Manage user access</Link><Link className="button secondary" href="/Settings?tab=Audit%20log">Review audit log</Link></>:<><Link className="button secondary" href="/Doctors">Team availability</Link><Link className="button secondary" href="/Appointments">Manage schedule</Link></>}<Link className="button secondary" href="/Reports">Clinic reports</Link></div></section>;
}
