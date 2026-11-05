import {put, get as getBlob} from '@vercel/blob';
import {validOrigin} from '../../../services/auth/policy';
import {DOCUMENT_MAX_BYTES,documentTypeMatches,documentFilename,validDocumentKey} from '../../../lib/document-policy';
import { getStorageBucket } from '../../../lib/firebase-admin';
import { actor, readAll, visible, fail, ClinicError } from '../../../services/server';
import { canWrite } from '../../../permissions/roles';
export const runtime='nodejs';
const maxSize=DOCUMENT_MAX_BYTES;
export async function POST(req: Request) {
  try {
    if(!validOrigin(req))throw new ClinicError('Invalid request origin.',403);
    if(Number(req.headers.get('content-length')||0)>maxSize+65536)throw new ClinicError('Document exceeds upload size limit.',413);
    const u = await actor();
    if (!canWrite(u.role, 'Records')) throw new ClinicError('Your role cannot upload clinical documents.', 403);
    const data = await req.formData(), file = data.get('file');
    if (!(file instanceof File) || file.size===0 || file.size > maxSize || !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new ClinicError('Choose a PDF, PNG, JPEG or WebP under 4 MB');
    const bytes=Buffer.from(await file.arrayBuffer());
    if(!documentTypeMatches(bytes,file.type))throw new ClinicError('File contents do not match the selected PDF or image type.');
    const key = u.owner + '/' + crypto.randomUUID() + '/' + documentFilename(file.name);
    if(process.env.BLOB_READ_WRITE_TOKEN)await put(key,bytes,{access:'private',addRandomSuffix:false,contentType:file.type});
    else await getStorageBucket().file(key).save(bytes, { resumable: false, metadata: { contentType: file.type, cacheControl: 'private, no-store' } });
    return Response.json({ key });
  } catch (e) { return fail(e); }
}
export async function GET(req: Request) {
  try {
    const u = await actor(), key = new URL(req.url).searchParams.get('key');
    if (!key || !validDocumentKey(key,u.owner)) return new Response('Not found', { status: 404 });
    const records = visible(await readAll(u.owner), u);
    if (u.role !== 'Super Admin' && !records.some(x => x.kind === 'Records' && x.data.documentKey === key)) return new Response('Not found', { status: 404 });
    if(process.env.BLOB_READ_WRITE_TOKEN){
      const blob=await getBlob(key,{access:'private',useCache:false});
      if(!blob||blob.statusCode!==200)return new Response('Not found',{status:404});
      if(blob.blob.size>maxSize)throw new ClinicError('Document exceeds download size limit.',413);
      return new Response(blob.stream,{headers:{'Content-Type':blob.blob.contentType,'Content-Disposition':'attachment; filename="'+key.split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g,'_')+'"','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
    }
    const file = getStorageBucket().file(key);
    const [exists] = await file.exists();
    if (!exists) return new Response('Not found', { status: 404 });
    const [meta] = await file.getMetadata();
    if (Number(meta.size) > maxSize) throw new ClinicError('Document exceeds download size limit.', 413);
    const [body] = await file.download();
    return new Response(new Uint8Array(body), { headers: { 'Content-Type': meta.contentType || 'application/octet-stream', 'Content-Disposition': 'attachment; filename="' + key.split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g, '_') + '"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
