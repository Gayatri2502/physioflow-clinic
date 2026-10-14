import {build} from 'esbuild';
import {unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const live=process.argv.includes('--live');
process.env.FIREBASE_CLINIC_ID='auth-verification-'+randomUUID();
process.env.CLINIC_OWNER_EMAIL='owner@example.test';
if(live){
 if(!process.env.FIREBASE_CLI_DIR)throw new Error('Set FIREBASE_CLI_DIR to the installed firebase-tools directory for an authorized live test.');
 const {getGlobalDefaultAccount,getAccessToken}=require(process.env.FIREBASE_CLI_DIR+'/lib/auth.js');
 const account=getGlobalDefaultAccount();
 if(account?.user?.email!=='alphacentauric.ai@gmail.com')throw new Error('Sign Firebase CLI in as the PhysioFlow owner first.');
 const adminRequire=createRequire(require.resolve('firebase-admin'));
 const {Firestore}=adminRequire('@google-cloud/firestore');
 const cloudRequire=createRequire(adminRequire.resolve('@google-cloud/firestore'));
 const {OAuth2Client}=cloudRequire('google-auth-library');
 const authClient=new OAuth2Client();
 authClient.refreshHandler=async()=>{const token=await getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);return {access_token:token.access_token,expiry_date:Date.now()+3000000};};
 globalThis.__firestore=new Firestore({projectId:'physioflow-clinic-20261013',authClient});globalThis.__liveFirestore=true;
}else{
 await build({entryPoints:['tests/integration/fake-firestore.ts'],outfile:'tests/integration/fake-firestore-runtime.cjs',platform:'node',format:'cjs'});
 const {FakeFirestore}=require('./fake-firestore-runtime.cjs');
 globalThis.__firestore=new FakeFirestore();
}
const outfile='tests/integration/signup-lifecycle-runtime.cjs';
try{
 await build({entryPoints:['tests/integration/signup-lifecycle.ts'],outfile,bundle:true,platform:'node',format:'cjs',plugins:[{name:'signup-runtime',setup(b){
 b.onResolve({filter:/firebase-auth$/},()=>({path:'auth',namespace:'test'}));
 b.onResolve({filter:/firebase-admin$/},()=>({path:'admin',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='auth'?`export async function getFirebaseUser(){return globalThis.__testUser}`:`export const getFirestore=()=>globalThis.__firestore;`,loader:'js'}));
 }}]});
 await require('./signup-lifecycle-runtime.cjs').verification;
}finally{unlinkSync(outfile);if(!live)unlinkSync('tests/integration/fake-firestore-runtime.cjs');else await globalThis.__firestore.terminate();}
