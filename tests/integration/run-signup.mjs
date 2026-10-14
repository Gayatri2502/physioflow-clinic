import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {unlinkSync} from 'node:fs';
const outfile = 'tests/integration/signup-check.cjs';
await build({entryPoints: ['tests/integration/signup-check.ts'], outfile, bundle: true, platform: 'node', format: 'cjs', plugins: [{name: 'reminder-test-runtime', setup(b) {
 b.onResolve({filter: /firebase-auth$/}, () => ({path: 'auth', namespace: 'test'}));
 b.onResolve({filter: /firebase-admin$/}, () => ({path: 'admin', namespace: 'test'}));
 b.onResolve({filter: /\/server$/}, () => ({path: 'actor', namespace: 'test'}));
 b.onLoad({filter: /.*/, namespace: 'test'}, args => ({contents: args.path === 'auth' ? `export async function getFirebaseUser(){return globalThis.__testUser}` : args.path === 'admin' ? `export const getFirestore=()=>globalThis.__firestore;` : `export class ClinicError extends Error {constructor(message,status=400){super(message);this.status=status}}; export async function actor(){if(!globalThis.__actor)throw new ClinicError('Sign in',401);return globalThis.__actor} export function fail(e){return Response.json({error:e instanceof ClinicError?e.message:'Service unavailable'},{status:e instanceof ClinicError?e.status:503})}`, loader: 'js'}));
}}]});
try {execFileSync(process.execPath, [outfile], {stdio: 'inherit'});} finally {unlinkSync(outfile);}
