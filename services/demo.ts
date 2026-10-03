import {demoAccounts} from '../config/demo';
import {seed,doctors,departments} from '../components/erp/config';
import {derive,resolveReferences} from './domain/workflows';
import {visibleRecords} from './domain/access';
export function demoClinic(key:string){
 const account=demoAccounts.find(x=>x.key===key);if(!account)throw new Error('Choose a demo role.');
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),now=new Date().toISOString();
 const raw:any[]=seed().map(x=>({...x,created:now,data:{...x.data,Date:date,Duration:x.data.Duration||45}}));
 raw.push({id:'demo-settings',kind:'Settings',created:now,data:{Name:'PhysioFlow Demo Clinic',Address:'Sample clinic · Pune',Phone:'Demo contact',Email:'clinic@demo.physioflow.local','Invoice Footer':'DEMO — Sample invoice only'}},
 {id:'demo-plan',kind:'Plans',created:now,data:{Patient:'Aarav Patel',Therapist:doctors[0],Department:departments[0],Diagnosis:'Lumbar strain',Exercises:'Pelvic tilts: 3 sets of 10, as instructed by your therapist.',Precautions:'Stop if symptoms worsen and contact your therapist.','Sessions Recommended':10,Status:'Active'}},
 {id:'demo-document',kind:'Records',created:now,data:{Patient:'Aarav Patel',Therapist:doctors[0],Date:date,'Document Type':'Treatment document',Title:'Home exercise guide (sample)','Shared With Patient':'Yes'}});
 for(const item of demoAccounts)raw.push({id:'demo-user-'+item.key,kind:'Staff',created:now,data:{Name:item.name,Email:item.email,Role:item.role,Status:'Active',...(item.key==='doctor'?{Therapist:doctors[0]}:{}),...(item.key==='patient'?{Patient:'Aarav Patel',patientId:'PT-1042'}:{})}});
 const rows=derive(raw.map(x=>({...x,data:resolveReferences(x.data,raw)})));
 const actor={userId:'demo-'+account.key,owner:'demo-clinic',name:account.name,email:account.email,role:account.role,therapist:account.key==='doctor'?doctors[0]:'',patientId:account.key==='patient'?'PT-1042':''};
 return {actor,records:visibleRecords(rows,actor),audits:[]};
}
