import { getStorageBucket } from '../../../lib/firebase-admin';
import { actor, readAll, visible, fail, ClinicError } from '../../../services/server';
import { canWrite } from '../../../permissions/roles';
const maxSize = 10 * 1024 * 1024;
export async function POST(req: Request) {
  try {
    const u = await actor();
    if (!canWrite(u.role, 'Records')) throw new ClinicError('Your role cannot upload clinical documents.', 403);
    const data = await req.formData(), file = data.get('file');
    if (!(file instanceof File) || file.size > maxSize || !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new ClinicError('Choose a PDF, PNG, JPEG or WebP under 10 MB');
    const key = u.owner + '/' + crypto.randomUUID() + '/' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    await getStorageBucket().file(key).save(Buffer.from(await file.arrayBuffer()), { resumable: false, metadata: { contentType: file.type, cacheControl: 'private, no-store' } });
    return Response.json({ key });
  } catch (e) { return fail(e); }
}
export async function GET(req: Request) {
  try {
    const u = await actor(), key = new URL(req.url).searchParams.get('key');
    if (!key?.startsWith(u.owner + '/') || key.includes('/../')) return new Response('Not found', { status: 404 });
    const records = visible(await readAll(u.owner), u);
    if (u.role !== 'Super Admin' && !records.some(x => x.kind === 'Records' && x.data.documentKey === key)) return new Response('Not found', { status: 404 });
    const file = getStorageBucket().file(key);
    const [exists] = await file.exists();
    if (!exists) return new Response('Not found', { status: 404 });
    const [meta] = await file.getMetadata();
    if (Number(meta.size) > maxSize) throw new ClinicError('Document exceeds download size limit.', 413);
    const [body] = await file.download();
    return new Response(new Uint8Array(body), { headers: { 'Content-Type': meta.contentType || 'application/octet-stream', 'Content-Disposition': 'attachment; filename="' + key.split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g, '_') + '"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
