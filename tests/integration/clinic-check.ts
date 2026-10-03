import assert from 'node:assert/strict';
import {validateDemoLogin,demoSessionRole,roleMatchesAccount} from '../../services/domain/demo-login';
import * as demoLoginApi from '../../app/api/demo-login/route';
import {demoClinic} from '../../services/demo';
import {demoAccounts} from '../../config/demo';
import {demoHref} from '../../components/erp/demo-navigation';
import {workspaceFor} from '../../permissions/workspaces';
import {roles,canRead,canWrite} from '../../permissions/roles';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import * as portal from '../../app/api/patient/route';
import * as api from '../../app/api/clinic/route';
import * as bootstrap from '../../app/api/clinic/bootstrap/route';
import * as accounting from '../../app/api/accounting/route';
import {creditBalance,dayCollection} from '../../services/domain/accounting';
import {revision,atomicBatch,database} from '../../services/server';
import * as docs from '../../app/api/documents/route';
import {reportData} from '../../services/domain/reports';
import {OWNER_EMAIL} from '../../config/clinic';
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
class Prepared {constructor(private sql:string,private params:any[]=[]){ }bind(...params:any[]){return new Prepared(this.sql,params)}async all(){return {results:sqlite.prepare(this.sql).all(...this.params)}}async first(){return sqlite.prepare(this.sql).get(...this.params)||null}async run(){return sqlite.prepare(this.sql).run(...this.params)}}
(globalThis as any).__db={prepare:(sql:string)=>new Prepared(sql),batch:async(items:Prepared[])=>{sqlite.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const blobs=new Map();(globalThis as any).__bucket={put:async(key:string,body:any,meta:any)=>blobs.set(key,{body,httpMetadata:meta.httpMetadata}),get:async(key:string)=>blobs.get(key)};
const owner={userId:'owner-1',email:OWNER_EMAIL,displayName:'Clinic Owner'};(globalThis as any).__testUser=owner;
const request=(body:any)=>new Request('https://clinic.test/api/clinic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function post(kind:string,data:any,id?:string,expected=200){const res=await api.POST(request({kind,data,id}));const result:any=await res.json();assert.equal(res.status,expected,JSON.stringify(result));return result;}
async function get(){const res=await api.GET();assert.equal(res.status,200);return await res.json() as any;}
(async()=>{
for(const account of demoAccounts){assert.equal(validateDemoLogin({role:account.key,email:account.email,password:account.password})?.key,account.key);assert.equal(validateDemoLogin({role:account.key,email:account.email,password:'incorrect'}),null);for(const other of demoAccounts.filter(x=>x.key!==account.key)){assert.equal(validateDemoLogin({role:other.key,email:account.email,password:account.password}),null);assert.equal(roleMatchesAccount(other.key,account.role),false);}assert.equal(roleMatchesAccount(account.key,account.role),true);const response=await demoLoginApi.POST(new Request('https://clinic.test/api/demo-login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://clinic.test'},body:JSON.stringify({role:account.key,email:account.email,password:account.password})}));assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie')!;assert.ok(cookie.includes('HttpOnly'));assert.equal(demoSessionRole(cookie),account.key);assert.equal((await demoLoginApi.GET(new Request('https://clinic.test/api/demo-login',{headers:{cookie}}))).status,200);}
assert.equal(validateDemoLogin({role:'super-admin',email:'doctor@demo.physioflow.local',password:'DoctorDemo2026!'}),null);assert.equal(demoSessionRole('physioflow_demo=patient%7C1'),null);assert.equal((await demoLoginApi.GET(new Request('https://clinic.test/api/demo-login'))).status,401);assert.equal((await demoLoginApi.POST(new Request('https://clinic.test/api/demo-login',{method:'POST',body:JSON.stringify({role:'super-admin',email:'doctor@demo.physioflow.local',password:'DoctorDemo2026!'})}))).status,401);assert.ok((await demoLoginApi.DELETE()).headers.get('Set-Cookie')?.includes('Max-Age=0'));
console.log('PASS: all six role credential combinations, mismatched roles/passwords, session expiry, sign-out and assigned clinic role checks.');

for(const account of demoAccounts){const demo=demoClinic(account.key);assert.equal(demo.actor.role,account.role);assert.equal(demo.actor.owner,'demo-clinic');assert.ok(demo.records.some(x=>x.kind==='Settings'));assert.ok(!demo.records.some(x=>x.data.documentKey));if(account.key==='patient'){assert.equal(demo.records.filter(x=>x.kind==='Patients').length,1);assert.ok(demo.records.every(x=>!x.data.patientId||x.data.patientId===demo.actor.patientId));}if(['receptionist','accountant'].includes(account.key))assert.ok(!demo.records.some(x=>x.kind==='Consultation'||x.kind==='Treatments'));}
assert.throws(()=>demoClinic('arbitrary-role'));assert.equal(demoHref('/Appointments'),'/demo/Appointments');assert.equal(demoHref('/Settings?tab=Audit%20log'),'/demo/Settings?tab=Audit%20log');assert.equal(demoHref('/login'),'/login');assert.equal(demoHref('/'),'/demo/Dashboard');

const titles=new Set();for(const role of roles){const workspace=workspaceFor(role);titles.add(workspace.title);assert.equal(workspace.navigation[0],'Dashboard');assert.ok(workspace.navigation.every(module=>canRead(role,module)));if('primary' in workspace&&workspace.primary)assert.ok(canWrite(role,workspace.primary));}assert.equal(titles.size,roles.length);assert.equal(workspaceFor('Unknown').navigation.length,0);assert.ok(!workspaceFor('Patient').navigation.includes('Reports'));assert.ok(!workspaceFor('Receptionist').navigation.includes('Consultation'));assert.ok(!workspaceFor('Accountant').navigation.includes('Treatments'));assert.ok(!workspaceFor('Doctor / Physiotherapist').navigation.includes('Accounting'));

let response=await bootstrap.POST(request({action:'sample'}));assert.equal(response.status,200,await response.text());let state=await get();assert.equal(state.records.filter((x:any)=>x.kind==='Patients').length,8);assert.equal(state.records.filter((x:any)=>x.kind==='Appointments').length,8);
const patient=await post('Patients',{Name:'Test Patient',Phone:'9876543210',Department:'Orthopedic Physiotherapy',Therapist:'Dr. Ananya Sharma'});assert.ok(patient.data.UHID);const base={Patient:'Test Patient',patientId:patient.id,Therapist:'Dr. Ananya Sharma',Department:'Orthopedic Physiotherapy'};
const appointment=await post('Appointments',{...base,Date:'2026-10-10',Time:'10:00',Duration:45,Type:'Clinic visit',Status:'Confirmed'});
await post('Appointments',{...base,Date:'2026-10-10',Time:'10:15',Duration:45,Status:'Scheduled'},undefined,400);
await post('Appointments',{...base,Date:'2026-10-10',Time:'11:00',Duration:45,Status:'Scheduled'});
const consultation=await post('Consultation',{...base,Appointment:appointment.id,Date:'2026-10-10',Diagnosis:'Lumbar strain','Pain Score':7,'Next Follow-up Date':'2026-10-17','Follow-up Time':'11:00'});state=await get();assert.equal(state.records.find((x:any)=>x.id===appointment.id).data.Status,'In Treatment');assert.ok(state.records.some((x:any)=>x.data.consultationId===consultation.id));
const pack=await post('Packages',{...base,Package:'Single Visit','Sessions Purchased':1,'Sessions Completed':0,Amount:1000,'Amount Paid':1000,Validity:'2027-01-01'});
await post('Treatments',{...base,Date:'2026-10-10',Appointment:appointment.id,'Linked Package':pack.id,'Session Number':1,Diagnosis:'Lumbar strain','Pain Score':5,Duration:45});state=await get();assert.equal(state.records.find((x:any)=>x.id===pack.id).data['Sessions Remaining'],0);assert.equal(state.records.find((x:any)=>x.id===appointment.id).data.Status,'Completed');
await post('Treatments',{...base,Date:'2026-10-11','Linked Package':pack.id,'Session Number':2,Diagnosis:'Lumbar strain','Pain Score':4,Duration:45},undefined,400);
const invoice=await post('Billing',{...base,Date:'2026-10-10',Service:'Physiotherapy Visit',Quantity:1,Rate:1000,Items:[{Service:'Support item',Quantity:2,Rate:100}],Discount:0,Tax:0,'Amount Paid':0});assert.equal(invoice.data.Balance,1200);
await post('Payments',{Patient:'Test Patient',Invoice:invoice.id,Amount:400,Date:'2026-10-10','Payment Method':'UPI',Status:'Paid'});state=await get();assert.equal(state.records.find((x:any)=>x.id===invoice.id).data.Balance,800);assert.equal(state.records.find((x:any)=>x.id===invoice.id).data.Status,'Partially Paid');
await post('Payments',{Patient:'Test Patient',Invoice:invoice.id,Amount:900,Date:'2026-10-10','Payment Method':'UPI',Status:'Paid'},undefined,400);
await post('Payments',{Patient:'Test Patient',Invoice:invoice.id,Amount:800,Date:'2026-10-11','Payment Method':'UPI',Status:'Paid'});state=await get();assert.equal(state.records.find((x:any)=>x.id===invoice.id).data.Status,'Paid');
await post('Payments',{Patient:'Test Patient',Invoice:invoice.id,Amount:100,Date:'2026-10-12','Payment Method':'UPI',Status:'Refunded'});state=await get();assert.equal(state.records.find((x:any)=>x.id===invoice.id).data.Balance,100);
await post('Schemes',{...base,Organization:'Employer scheme','Approved Sessions':5,'Approved Amount':5000,'Amount Claimed':6000,'Amount Received':0,'Claim Status':'Submitted'},undefined,400);
const claim=await post('Schemes',{...base,Organization:'Employer scheme','Authorization Number':'AUTH-1','Approved Sessions':5,'Approved Amount':5000,'Amount Claimed':2000,'Amount Received':500,'Claim Status':'Partially Approved',Validity:'2027-01-01'});assert.equal(claim.data['Outstanding Amount'],1500);
const del=await api.DELETE(new Request('https://clinic.test/api/clinic',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:patient.id})}));assert.equal(del.status,409); // protected dependency is surfaced as a recoverable rejection
await post('Staff',{Name:'Reception',Email:'reception@example.com',Role:'Receptionist',Status:'Active'});
await post('Staff',{Name:'Therapist',Email:'therapist@example.com',Role:'Doctor / Physiotherapist',Therapist:'Dr. Rahul Mehta',Status:'Active'});
(globalThis as any).__testUser={userId:'reception-1',email:'reception@example.com',displayName:'Reception'};state=await get();assert.equal(state.actor.role,'Receptionist');assert.ok(!state.records.some((x:any)=>x.kind==='Consultation'));assert.ok(!state.records.find((x:any)=>x.id===patient.id).data['Medical History']);await post('Treatments',{...base,Date:'2026-10-12',Diagnosis:'Test','Session Number':2,'Pain Score':3,Duration:45},undefined,403);
(globalThis as any).__testUser={userId:'therapist-1',email:'therapist@example.com',displayName:'Therapist'};state=await get();assert.ok(!state.records.some((x:any)=>x.id===patient.id));await post('Consultation',{...base,Date:'2026-10-12',Diagnosis:'Test','Pain Score':3},undefined,403);
(globalThis as any).__testUser=owner;state=await get();const daily=reportData('Daily Revenue',state.records,'2026-10-10','2026-10-12');assert.equal(daily.rows.length,3);assert.equal(daily.summary,'₹1,100 collected');assert.ok(reportData('Package Utilization',state.records,'','').rows.some(row=>row[0]==='Test Patient'&&row[4]===0));assert.ok(reportData('Scheme Outstanding Amount',state.records,'','').rows.some(row=>row[0]==='Employer scheme'&&row[6]==='₹1,500'));
const form=new FormData();form.append('file',new File(['report bytes'],'test.pdf',{type:'application/pdf'}));const upload=await docs.POST(new Request('https://clinic.test/api/documents',{method:'POST',body:form}));assert.equal(upload.status,200);const uploaded:any=await upload.json();await post('Records',{Patient:'Test Patient','Document Type':'Lab report',Title:'Test report',documentKey:uploaded.key,filename:'test.pdf'});const download=await docs.GET(new Request('https://clinic.test/api/documents?key='+encodeURIComponent(uploaded.key)));assert.equal(download.status,200);assert.equal(await download.text(),'report bytes');
async function account(data:any,status=200){const res=await accounting.POST(request(data));const result:any=await res.json();assert.equal(res.status,status,JSON.stringify(result));return result;}
await account({action:'advance',patientId:patient.id,amount:300,date:'2026-10-20',method:'Cash'});
state=await get();assert.equal(creditBalance(state.records,patient.id),300);
await account({action:'apply_credit',patientId:patient.id,invoiceId:invoice.id,amount:100,date:'2026-10-20'});
state=await get();assert.equal(creditBalance(state.records,patient.id),200);assert.equal(state.records.find((x:any)=>x.id===invoice.id).data.Balance,0);assert.equal(dayCollection(state.records,'2026-10-20').Cash,300);
await account({action:'apply_credit',patientId:patient.id,invoiceId:invoice.id,amount:10,date:'2026-10-20'},400);
const refund=await account({action:'request_refund',patientId:patient.id,amount:50,date:'2026-10-20',method:'Cash',notes:'Unused advance returned'});
await account({action:'approve_refund',requestId:refund.record.id,date:'2026-10-20'});
state=await get();assert.equal(creditBalance(state.records,patient.id),150);assert.equal(dayCollection(state.records,'2026-10-20').Cash,250);
await account({action:'approve_refund',requestId:refund.record.id,date:'2026-10-20'},400);
const closing=await account({action:'close_day',date:'2026-10-20',opening:100,counted:350,amount:''});assert.equal(closing.record.data.Variance,0);
await account({action:'advance',patientId:patient.id,amount:50,date:'2026-10-20',method:'Cash'},400);
await account({action:'reopen_day',requestId:closing.record.id,notes:'Reconcile late cash receipt'});
await account({action:'advance',patientId:patient.id,amount:50,date:'2026-10-20',method:'Cash'});
await account({action:'package_invoice',packageId:pack.id,date:'2026-10-21'});
await account({action:'package_invoice',packageId:pack.id,date:'2026-10-21'},400);
const savedRevision=await revision('owner-1');await atomicBatch('owner-1',savedRevision,[]);await assert.rejects(()=>atomicBatch('owner-1',savedRevision,[]),/Another staff member/);
console.log('PASS: advances, credit allocation without double-counting cash, refund approvals/idempotency, closing/reopening, package invoicing, and stale simultaneous-write rejection.');
// Role boundaries, linked patient actions and stale form protection.
(globalThis as any).__testUser=owner;
state=await get();let current=state.records.find((x:any)=>x.id===patient.id);
await post('Patients',{...current.data,'Medical History':'Private clinical history','Allergies':'Private allergy'},patient.id);
await post('Staff',{Name:'Patient access',Email:'patient@example.com',Role:'Patient',Patient:'Test Patient',patientId:patient.id,Status:'Active'});
const privateDoc=state.records.find((x:any)=>x.kind==='Records'&&x.data.documentKey===uploaded.key);
(globalThis as any).__testUser={userId:'reception-1',email:'reception@example.com',displayName:'Reception'};
state=await get();current=state.records.find((x:any)=>x.id===patient.id);assert.equal(current.data['Allergies'],undefined);
const receptionSave=await post('Patients',{...current.data,Phone:'9876543211','Medical History':'Attempted overwrite'},patient.id);assert.equal(receptionSave.data['Medical History'],undefined);
await post('Appointments',{...base,Date:'2099-10-10',Time:'10:00',Duration:45,Status:'Completed'},undefined,403);
response=await api.DELETE(new Request('https://clinic.test/api/clinic',{method:'DELETE',body:JSON.stringify({id:patient.id})}));assert.equal(response.status,403);
(globalThis as any).__testUser=owner;state=await get();current=state.records.find((x:any)=>x.id===patient.id);assert.equal(current.data['Medical History'],'Private clinical history');assert.equal(current.data.Allergies,'Private allergy');assert.equal(current.data.Phone,'9876543211');
const before={...current.data};await post('Patients',{...current.data,Phone:'9876543212'},patient.id);
response=await api.POST(request({kind:'Patients',id:patient.id,data:{...before,Phone:'9876543213'},expectedData:before}));assert.equal(response.status,409);
(globalThis as any).__testUser={userId:'patient-1',email:'patient@example.com',displayName:'Patient'};state=await get();assert.equal(state.actor.patientId,patient.id);assert.equal(state.records.filter((x:any)=>x.kind==='Patients').length,1);assert.ok(state.records.every((x:any)=>!x.data.patientId||x.data.patientId===patient.id));assert.ok(!state.records.some((x:any)=>['Staff','Consultation','Audit','Schemes','CashClosing'].includes(x.kind)));assert.ok(!state.records.some((x:any)=>x.kind==='Records'));assert.equal(state.records.find((x:any)=>x.id===patient.id).data['Medical History'],undefined);
response=await docs.GET(new Request('https://clinic.test/api/documents?key='+encodeURIComponent(uploaded.key)));assert.equal(response.status,404);
await post('Patients',{Name:'Blocked',Phone:'9876543210'},undefined,403);
response=await accounting.POST(request({action:'advance',patientId:patient.id,amount:100,method:'Cash'}));assert.equal(response.status,403);
response=await portal.POST(request({action:'book',date:'2099-10-10',time:'14:00'}));assert.equal(response.status,200,await response.text());state=await get();const patientAppointment=state.records.find((x:any)=>x.kind==='Appointments'&&x.data.Date==='2099-10-10');assert.equal(patientAppointment.data.patientId,patient.id);assert.equal(patientAppointment.data.Status,'Scheduled');
response=await portal.POST(request({action:'reschedule',id:patientAppointment.id,date:'2099-10-11',time:'14:00'}));assert.equal(response.status,200);state=await get();assert.equal(state.records.find((x:any)=>x.id===patientAppointment.id).data.Date,'2099-10-11');
response=await portal.POST(request({action:'cancel',id:'AP-1'}));assert.equal(response.status,404);
response=await portal.POST(request({action:'cancel',id:patientAppointment.id}));assert.equal(response.status,200);
(globalThis as any).__testUser=owner;state=await get();assert.equal(state.records.find((x:any)=>x.id===patientAppointment.id).data.Status,'Cancelled');await post('Records',{...privateDoc.data,'Shared With Patient':'Yes'},privateDoc.id);
(globalThis as any).__testUser={userId:'patient-1',email:'patient@example.com',displayName:'Patient'};state=await get();assert.ok(state.records.some((x:any)=>x.id===privateDoc.id));response=await docs.GET(new Request('https://clinic.test/api/documents?key='+encodeURIComponent(uploaded.key)));assert.equal(response.status,200);
(globalThis as any).__testUser=owner;
await post('Staff',{Name:'Accounts',Email:'accounts@example.com',Role:'Accountant',Status:'Active'});
(globalThis as any).__testUser={userId:'accounts-1',email:'accounts@example.com',displayName:'Accounts'};state=await get();assert.ok(!state.records.some((x:any)=>['Consultation','Treatments','Plans','Records','Staff'].includes(x.kind)));await post('Consultation',{...base,Date:'2099-10-10',Diagnosis:'Blocked','Pain Score':1},undefined,403);
(globalThis as any).__testUser={userId:'therapist-1',email:'therapist@example.com',displayName:'Therapist'};state=await get();const assignedPatient=state.records.find((x:any)=>x.kind==='Patients');assert.ok(assignedPatient);await post('Records',{Patient:assignedPatient.data.Name,patientId:assignedPatient.id,'Document Type':'Prescription',Title:'Assigned patient exercise prescription'});await post('Appointments',{Patient:assignedPatient.data.Name,Date:'2099-10-10',Time:'15:00',Therapist:'Dr. Rahul Mehta',Duration:45,Status:'Confirmed'},undefined,403);
console.log('PASS: patient isolation and booking/cancellation sync, private/shared documents, reception medical-field preservation, clinical/financial boundaries and stale form protection.');
(globalThis as any).__testUser=null;response=await api.GET();assert.equal(response.status,401);
console.log('PASS: CRUD, appointments/conflicts, consultation/follow-up, package consumption, payment/partial/refund reconciliation, claim validation, protected deletion, role isolation, report calculations, document upload/download and authentication.');
})().catch(e=>{console.error(e);process.exit(1)});
