import {z} from 'zod';
import {ClinicError, fail} from '../../../../../services/server';
import {communicationsConfig, recordWhatsAppStatus, whatsappTrackingEnabled, pruneExpiredReceipts} from '../../../../../lib/communications/server';
import {equalSecret, readWebhookBody, verifyWhatsAppSignature} from '../../../../../lib/communications/security';
export const runtime = 'nodejs';
const statusSchema = z.object({id: z.string().min(1).max(512), status: z.string().max(30), recipient_id: z.string().regex(/^[1-9]\d{7,14}$/), timestamp: z.string().regex(/^\d{1,13}$/), errors: z.array(z.object({code: z.number().int().nonnegative()})).max(10).optional()});
const payloadSchema = z.object({object: z.literal('whatsapp_business_account'), entry: z.array(z.object({id: z.string().max(128), changes: z.array(z.object({field: z.string().max(128), value: z.object({messaging_product: z.string().optional(), metadata: z.object({phone_number_id: z.string().max(128)}).optional(), statuses: z.array(statusSchema).max(100).optional()})})).max(20)})).max(20)});
export async function GET(req: Request) {
 try {
  if (!whatsappTrackingEnabled()) throw new ClinicError('WhatsApp delivery tracking is not configured.', 503);
  const query = new URL(req.url).searchParams;
  if (query.get('hub.mode') !== 'subscribe' || !equalSecret(query.get('hub.verify_token'), process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)) throw new ClinicError('Invalid webhook verification token.', 403);
  const challenge = query.get('hub.challenge');
  if (!challenge || !/^\d{1,128}$/.test(challenge)) throw new ClinicError('Invalid webhook challenge.');
  return new Response(challenge, {headers: {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'}});
 } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
 try {
  if (!whatsappTrackingEnabled()) throw new ClinicError('WhatsApp delivery tracking is not configured.', 503);
  const raw = await readWebhookBody(req);
  if (!verifyWhatsAppSignature(raw, req.headers.get('x-hub-signature-256'))) throw new ClinicError('Invalid webhook signature.', 401);
  let json: unknown;
  try { json = JSON.parse(raw.toString('utf8')); } catch { throw new ClinicError('Invalid webhook JSON.'); }
  const input = payloadSchema.safeParse(json);
  if (!input.success) throw new ClinicError('Invalid WhatsApp webhook payload.');
  const config = communicationsConfig().whatsapp;
  const events = input.data.entry.filter(x => x.id === config.businessAccountId).flatMap(x => x.changes)
   .filter(x => x.field === 'messages' && x.value.messaging_product === 'whatsapp' && x.value.metadata?.phone_number_id === config.phoneNumberId)
   .flatMap(x => x.value.statuses || []);
  if (events.length > 100) throw new ClinicError('Too many status events.', 413);
  // Only delivery metadata is retained; inbound message text and clinical details are discarded.
  for (const event of events) await recordWhatsAppStatus(event, config.phoneNumberId);
  await pruneExpiredReceipts();
  return Response.json({ok: true}, {headers: {'Cache-Control': 'no-store'}});
 } catch (e) { return fail(e); }
}
