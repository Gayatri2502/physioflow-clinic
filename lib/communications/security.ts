import {createHmac, timingSafeEqual} from 'node:crypto';
import {ClinicError} from '../../services/server';

export function equalSecret(value: string | null, expected: string | undefined) {
 if (!value || !expected) return false;
 const a = Buffer.from(value), b = Buffer.from(expected);
 return a.length === b.length && timingSafeEqual(a, b);
}
export function requireReminderJob(req: Request) {
 const secret = process.env.REMINDER_JOB_SECRET;
 if (!secret || secret.length < 32) throw new ClinicError('Reminder job authentication is not configured.', 503);
 if (!equalSecret(req.headers.get('authorization'), 'Bearer ' + secret)) throw new ClinicError('Invalid reminder job authorization.', 401);
}
export function verifyWhatsAppSignature(raw: Buffer, signature: string | null) {
 const secret = process.env.WHATSAPP_APP_SECRET;
 if (!secret) throw new ClinicError('WhatsApp webhook authentication is not configured.', 503);
 if (!signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
 const expected = createHmac('sha256', secret).update(raw).digest();
 return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export async function readWebhookBody(req: Request) {
 const limit = 256 * 1024;
 if (Number(req.headers.get('content-length') || 0) > limit) throw new ClinicError('Webhook payload is too large.', 413);
 const reader = req.body?.getReader();
 if (!reader) throw new ClinicError('Webhook body is required.');
 const chunks: Buffer[] = [];
 let size = 0;
 try {
  while (true) {
   const part = await reader.read();
   if (part.done) break;
   size += part.value.byteLength;
   if (size > limit) { await reader.cancel(); throw new ClinicError('Webhook payload is too large.', 413); }
   chunks.push(Buffer.from(part.value));
  }
 } finally { reader.releaseLock(); }
 return Buffer.concat(chunks);
}
