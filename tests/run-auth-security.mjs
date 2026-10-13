import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {unlinkSync} from 'node:fs';
await build({entryPoints:['tests/auth-security.ts'],outfile:'tests/auth-security.cjs',bundle:true,platform:'node',format:'cjs'});
try{execFileSync(process.execPath,['tests/auth-security.cjs'],{stdio:'inherit'});}finally{unlinkSync('tests/auth-security.cjs');}
