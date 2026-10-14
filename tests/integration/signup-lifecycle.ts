import assert from 'node:assert/strict';
import {requestSignup,signupStatus,reviewSignup,listSignupRequests,signupRoles} from '../../services/auth/signup';
import {actor} from '../../services/server';
import {roleMatchesAccount} from '../../services/auth/roles';
import {canWrite} from '../../permissions/roles';
const state=globalThis as any;
const db=state.__firestore;
const clinic=db.collection('clinics').doc(process.env.FIREBASE_CLINIC_ID!);
const owner={userId:'verification-owner',email:'owner@example.test',displayName:'Verification Owner'};
const asOwner=()=>{state.__testUser=owner};
async function main(){
 try {
 asOwner();assert.equal((await actor()).role,'Super Admin');
 for(const selected of signupRoles){
 const user={userId:'verification-'+selected.key,email:selected.key+'@example.test',displayName:'Synthetic '+selected.role};
 state.__testUser=user;
 await assert.rejects(actor(),{status:403});
 await assert.rejects(requestSignup('super-admin'),{status:400});
 await requestSignup(selected.key);
 await requestSignup('clinic-admin');
 assert.equal((await signupStatus()).request?.requestedRole,selected.role);
 assert.equal((await signupStatus()).request?.status,'pending');
 await assert.rejects(actor(),{status:403});
 await assert.rejects(listSignupRequests(),{status:403});
 await assert.rejects(reviewSignup(user.userId,'approve'),{status:403});
 let linkedId:string|undefined;
 if(['Patient','Doctor / Physiotherapist'].includes(selected.role)){
 linkedId='linked-'+selected.key;
 await clinic.collection('records').doc(linkedId).set({id:linkedId,kind:selected.role==='Patient'?'Patients':'Doctors',created:new Date().toISOString(),data:{Name:'Synthetic linked '+selected.role}});
 }
 asOwner();await reviewSignup(user.userId,'approve',linkedId);
 state.__testUser=null;await assert.rejects(actor(),{status:401});
 state.__testUser={...user}; // Fresh identity lookup after approval; no client role state.
 const assigned=await actor();assert.equal(assigned.role,selected.role);
 assert.equal((await signupStatus()).request?.status,'approved');
 assert.equal(roleMatchesAccount(selected.key,assigned.role),true);
 assert.equal(roleMatchesAccount('super-admin',assigned.role),false);
 assert.equal(canWrite(assigned.role,'Staff'),false);
 await assert.rejects(reviewSignup(user.userId,'approve',linkedId),{status:403});
 await clinic.collection('records').doc('signup_'+user.userId).update({'data':{...(await clinic.collection('records').doc('signup_'+user.userId).get()).data()!.data,Status:'Inactive'}});
 await assert.rejects(actor(),{status:403});
 }
 state.__testUser={userId:'verification-rejected',email:'rejected@example.test',displayName:'Synthetic Rejected'};
 await requestSignup('receptionist');asOwner();await reviewSignup('verification-rejected','reject');
 state.__testUser={userId:'verification-rejected',email:'rejected@example.test',displayName:'Synthetic Rejected'};
 assert.equal((await signupStatus()).request?.status,'rejected');await assert.rejects(actor(),{status:403});
 console.log('PASS all five signup roles: pending isolation, owner-only approval, fresh-login assignment, admin escalation rejection, persistence reads, inactive and rejected access denial');
 } finally {
 if(state.__liveFirestore){
 await db.recursiveDelete(clinic);
 assert.equal((await clinic.get()).exists,false);
 for(const name of ['accessRequests','records','audits'])assert.equal((await clinic.collection(name).limit(1).get()).empty,true);
 console.log('PASS live Firestore temporary test clinic and subcollections removed');
 }
 }
}
export const verification=main();
