import {canRead,registrationFields} from '../../permissions/roles';
import type {Actor,ClinicRecord} from '../../types/clinic';
const pick=(data:Record<string,any>,keys:string[])=>Object.fromEntries(Object.entries(data).filter(([k])=>keys.includes(k)));
export function visibleRecords(records:ClinicRecord[],a:Actor){
 let allowed=records.filter(x=>canRead(a.role,x.kind));
 if(a.role==='Doctor / Physiotherapist'){
  if(!a.therapist)return allowed.filter(x=>x.kind==='Settings');
  const patients=new Set(records.filter(x=>(x.kind==='Patients'&&x.data.Therapist===a.therapist)||x.data.Therapist===a.therapist).map(x=>x.kind==='Patients'?x.id:x.data.patientId).filter(Boolean));
  allowed=allowed.filter(x=>['Doctors','Departments','Settings'].includes(x.kind)||(x.kind==='Patients'?patients.has(x.id):patients.has(x.data.patientId)&&(!x.data.Therapist||x.data.Therapist===a.therapist)));
 }
 if(['Accountant','Receptionist'].includes(a.role))allowed=allowed.map(x=>x.kind==='Patients'?{...x,data:pick(x.data,[...registrationFields,'UHID','sample'])}:x);
 if(a.role==='Patient'){
  const patient=records.find(x=>x.kind==='Patients'&&x.id===a.patientId);
  allowed=allowed.filter(x=>x.kind==='Settings'||!!patient&&(x.kind==='Patients'?x.id===patient.id:x.kind==='Doctors'?x.data.Name===patient.data.Therapist:x.kind==='Departments'?x.data.Name===patient.data.Department:x.data.patientId===patient.id));
  allowed=allowed.filter(x=>x.kind!=='Records'||x.data['Shared With Patient']==='Yes');
  allowed=allowed.map(x=>({...x,data:x.kind==='Patients'?pick(x.data,[...registrationFields,'UHID']):x.kind==='Settings'?pick(x.data,['Name','Address','Phone','Email','Invoice Footer']):x.kind==='Doctors'?pick(x.data,['Name','Department','Availability']):x.kind==='Departments'?pick(x.data,['Name','Description']):x.kind==='Plans'?pick(x.data,['Patient','patientId','Therapist','Status','Exercises','Precautions','Sessions Recommended','Start Date','End Date']):x.kind==='Treatments'?pick(x.data,['Patient','patientId','Therapist','Date','Session Number','Home Exercises','Next Session','Duration']):x.kind==='Records'?pick(x.data,['Patient','patientId','Date','Title','Document Type','documentKey','filename']):pick(x.data,Object.keys(x.data).filter(k=>!['Notes','openingPaid','openingSessions','sample'].includes(k)))}));
 }
 return allowed;
}
