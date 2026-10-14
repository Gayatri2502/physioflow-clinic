import {build} from 'esbuild';
import {unlinkSync} from 'node:fs';
import assert from 'node:assert/strict';
const path='tests/document-policy-runtime.mjs';
try{
 await build({entryPoints:['lib/document-policy.ts'],outfile:path,platform:'node',format:'esm'});
 const {documentTypeMatches,validDocumentKey,documentFilename}=await import('./document-policy-runtime.mjs');
 assert.ok(documentTypeMatches(Buffer.from('%PDF-1.7'),'application/pdf'));
 assert.ok(documentTypeMatches(Buffer.from('89504e470d0a1a0a','hex'),'image/png'));
 assert.ok(documentTypeMatches(Buffer.from('ffd8ffe0','hex'),'image/jpeg'));
 assert.ok(documentTypeMatches(Buffer.from('RIFF0000WEBP'),'image/webp'));
 for(const type of ['application/pdf','image/png','image/jpeg','image/webp'])assert.equal(documentTypeMatches(Buffer.from('<script>bad</script>'),type),false);
 const key='physioflow/12345678-1234-1234-1234-123456789abc/report.pdf';
 assert.ok(validDocumentKey(key,'physioflow'));assert.equal(validDocumentKey(key,'another-clinic'),false);assert.equal(validDocumentKey('physioflow/../secret','physioflow'),false);
 assert.ok(documentFilename('x'.repeat(300)).length<=180);
 console.log('PASS document signatures, cross-clinic/path rejection and bounded filenames');
}finally{unlinkSync(path);}
