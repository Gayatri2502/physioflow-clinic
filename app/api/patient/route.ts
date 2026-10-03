import {z} from 'zod';
import {actor,database,readAll,revision,atomicBatch,ClinicError,fail} from '../../../services/server';
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('book'),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^(0\d|1\d|2[0-3]):[0-5]\d$/)}),
 z.object({action:z.literal('reschedule'),id:z.string(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^(0\d|1\d|2[0-3]):[0-5]\d$/)}),
 z.object({action:z.literal('cancel'),id:z.string()}),
 z.object({action:z.literal('contact'),phone:z.string().regex(/^[+\d\s()-]{7,20}$/),address:z.string().max(1000),emergency:z.string().max(250)})
]);
export async function POST(req:Request){try{
 const a=await actor();if(a.role!=='Patient'||!a.patientId)throw new ClinicError('This action requires a linked patient account.',403);
 const p=input.parse(await req.json()),version=await revision(a.owner),rows=await readAll(a.owner),patient=rows.find(x=>x.id===a.patientId&&x.kind==='Patients');if(!patient)throw new ClinicError('Patient profile is unavailable.',403);
 const now=new Date().toISOString(),today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});let record:any;
 if(p.action==='book'||p.action==='reschedule'){
  const previous=p.action==='reschedule'?rows.find(x=>x.id===p.id&&x.kind==='Appointments'&&x.data.patientId===patient.id):undefined;
  if(p.action==='reschedule'&&(!previous||!['Scheduled','Confirmed'].includes(previous.data.Status)||previous.data.Date<today||(previous.data.Date===today&&previous.data.Time<=new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour12:false}).slice(0,5))))throw new ClinicError('This appointment cannot be rescheduled online.',403);
  if(p.date<today||!Number.isFinite(new Date(p.date).getTime()))throw new ClinicError('Choose a current or future appointment date.');
  const start=Number(p.time.slice(0,2))*60+Number(p.time.slice(3));const current=new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour12:false});if(p.date===today&&p.time<=current.slice(0,5))throw new ClinicError('Choose a future appointment time.');
  if(start<9*60||start+45>18*60)throw new ClinicError('Online appointment hours are 9 AM to 6 PM. Call reception for another time.');
  const doctor=rows.find(x=>x.kind==='Doctors'&&x.data.Name===patient.data.Therapist);if(!doctor||doctor.data.Availability==='On leave')throw new ClinicError('Your therapist is unavailable. Please contact reception.');
  if(rows.some(x=>x.kind==='Appointments'&&x.id!==previous?.id&&x.data.Date===p.date&&x.data.Therapist===doctor.data.Name&&!['Cancelled','No Show'].includes(x.data.Status)&&start<Number(x.data.Time.slice(0,2))*60+Number(x.data.Time.slice(3))+Number(x.data.Duration||45)&&Number(x.data.Time.slice(0,2))*60+Number(x.data.Time.slice(3))<start+45))throw new ClinicError('This time is unavailable. Choose another time or call reception.');
  record={id:previous?.id||crypto.randomUUID(),kind:'Appointments',created:previous?.created||now,data:{Patient:patient.data.Name,patientId:patient.id,Therapist:doctor.data.Name,doctorId:doctor.id,Department:patient.data.Department,departmentId:patient.data.departmentId,Date:p.date,Time:p.time,Duration:45,Type:'Follow-up',Status:'Scheduled',Source:'Patient portal'}};
 }else if(p.action==='cancel'){
  const apt=rows.find(x=>x.id===p.id&&x.kind==='Appointments'&&x.data.patientId===patient.id);if(!apt)throw new ClinicError('Appointment not found.',404);if(!['Scheduled','Confirmed'].includes(apt.data.Status)||apt.data.Date<today||(apt.data.Date===today&&apt.data.Time<=new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour12:false}).slice(0,5)))throw new ClinicError('Please contact reception to change this appointment.');record={...apt,data:{...apt.data,Status:'Cancelled'}};
 }else record={...patient,data:{...patient.data,Phone:p.phone,Address:p.address,'Emergency Contact':p.emergency}};
 const db=database(),statements=[db.prepare('INSERT INTO records(id,owner,kind,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE records.owner=excluded.owner').bind(record.id,a.owner,record.kind,JSON.stringify(record.data),record.created),db.prepare('INSERT INTO audits(id,owner,action,record_id,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.owner,a.email+' patient '+p.action,record.id,now)];
 if(p.action==='reschedule')statements.push(db.prepare('DELETE FROM record_links WHERE source=? AND owner=?').bind(record.id,a.owner));
 if(p.action==='book'||p.action==='reschedule')for(const relation of ['patientId','doctorId','departmentId'])if(record.data[relation])statements.push(db.prepare('INSERT INTO record_links(id,owner,source,target,relation) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.owner,record.id,record.data[relation],relation));
 await atomicBatch(a.owner,version,statements);return Response.json({ok:true});
 }catch(e){return fail(e instanceof z.ZodError?new ClinicError('Please check the form values.'):e);}}
