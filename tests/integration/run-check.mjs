import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {unlinkSync} from 'node:fs';
const outfile='tests/integration/clinic-check.cjs';
await build({entryPoints:['tests/integration/clinic-check.ts'],outfile,bundle:true,platform:'node',format:'cjs',plugins:[{name:'firebase-test-runtime',setup(b){
 b.onResolve({filter:/firebase-admin$/},()=>({path:'admin',namespace:'test'}));
 b.onResolve({filter:/firebase-auth$/},()=>({path:'auth',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='admin'?`export const getFirestore=()=>globalThis.__firestore;export const getStorageBucket=()=>globalThis.__bucket;`:`export async function getFirebaseUser(){return globalThis.__testUser}`,loader:'js'}));
}}]});try{execFileSync(process.execPath,[outfile],{stdio:'inherit'})}finally{unlinkSync(outfile)}
