import {getFirebaseUser} from '../../app/firebase-auth';
import {getFirestore} from '../../lib/firebase-admin';
import {clinicId} from '../../db/schema';
import {actor,ClinicError} from '../server';
import {clinicRoles} from './roles';
export const signupRoles=clinicRoles.filter(x=>x.key!=='super-admin');
export async function signupStatus(){
 const user=await getFirebaseUser();if(!user)throw new ClinicError('Sign in with Google.',401);
 const clinic=getFirestore().collection('clinics').doc(clinicId());
 const request=await clinic.collection('accessRequests').doc(user.userId).get();
 return {email:user.email,request:request.exists?request.data():null};
}
export async function requestSignup(role:string){
 const user=await getFirebaseUser();if(!user)throw new ClinicError('Sign in with Google.',401);
 const selected=signupRoles.find(x=>x.key===role);if(!selected)throw new ClinicError('Choose an available clinic role.');
 const db=getFirestore(),clinic=db.collection('clinics').doc(clinicId()),ref=clinic.collection('accessRequests').doc(user.userId);
 return db.runTransaction(async tx=>{
 const current=await tx.get(clinic),previous=await tx.get(ref);
 if(current.data()?.migrationState==='importing')throw new ClinicError('Clinic migration is in progress.',503);
 if(previous.exists)return {ok:true,status:previous.data()!.status};
 tx.create(ref,{uid:user.userId,email:user.email.toLowerCase(),name:user.displayName,requestedRole:selected.role,status:'pending',created:new Date().toISOString()});
 return {ok:true,status:'pending'};
 });
}
export async function listSignupRequests(){const a=await actor();if(a.role!=='Super Admin')throw new ClinicError('Only the clinic owner can review signup requests.',403);const rows=await getFirestore().collection('clinics').doc(a.owner).collection('accessRequests').where('status','==','pending').limit(100).get();return rows.docs.map(x=>({...x.data(),id:x.id}));}
export async function reviewSignup(uid:string,decision:'approve'|'reject',linkedId?:string){
 const a=await actor();if(a.role!=='Super Admin')throw new ClinicError('Only the clinic owner can assign signup roles.',403);
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)||linkedId&&!/^[a-zA-Z0-9_-]{1,128}$/.test(linkedId))throw new ClinicError('Invalid account or record ID.');
 const db=getFirestore(),clinic=db.collection('clinics').doc(a.owner),ref=clinic.collection('accessRequests').doc(uid);
 return db.runTransaction(async tx=>{
 const current=await tx.get(clinic),request=await tx.get(ref),d=request.data();
 if(current.data()?.migrationState==='importing')throw new ClinicError('Clinic migration is in progress.',503);
 if(!d||d.status!=='pending')throw new ClinicError('Request is no longer pending.',409);
 if(!signupRoles.some(x=>x.role===d.requestedRole))throw new ClinicError('Invalid requested role.');
 const staff=await tx.get(clinic.collection('records').where('kind','==','Staff'));
 if(decision==='approve'&&staff.docs.some(x=>x.data().data.Email?.toLowerCase()===d.email))throw new ClinicError('An account assignment already exists. Edit it in Staff settings.',409);
 let linked:any=null;
 if(decision==='approve'&&['Patient','Doctor / Physiotherapist'].includes(d.requestedRole)){
 if(!linkedId)throw new ClinicError('Select the matching patient or doctor record.');
 linked=(await tx.get(clinic.collection('records').doc(linkedId))).data();
 if(linked?.kind!==(d.requestedRole==='Patient'?'Patients':'Doctors'))throw new ClinicError('The linked clinic record has the wrong type.');
 }
 const created=new Date().toISOString();
 if(decision==='approve')tx.create(clinic.collection('records').doc('signup_'+uid),{id:'signup_'+uid,kind:'Staff',created,data:{Name:d.name,Email:d.email,Role:d.requestedRole,Status:'Active',Therapist:linked?.kind==='Doctors'?linked.data.Name:'',Patient:linked?.kind==='Patients'?linked.data.Name:'',...(linked?.kind==='Patients'?{patientId:linkedId}:{})}});
 tx.update(ref,{status:decision==='approve'?'approved':'rejected',reviewed:created,reviewedBy:a.email});
 tx.create(clinic.collection('audits').doc(),{owner:a.owner,action:a.email+' '+decision+'d signup request',record_id:uid,created});
 tx.update(clinic,{version:Number(current.data()?.version||0)+1});
 return {ok:true};
 });
}
