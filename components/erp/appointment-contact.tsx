'use client';
import {useState, useEffect, useCallback} from 'react';

type ContactRequest = {id: string; channel: string; status: string; source: string; appointmentDate: string; appointmentTime: string; errorCodes: number[]};
type Config = {vapi?: {enabled: boolean}; whatsapp?: {enabled: boolean; automaticReminders: boolean; deliveryTracking: boolean}};
const labels: Record<string, string> = {preparing: 'Preparing — review if this persists', requesting: 'Awaiting provider response', accepted: 'Accepted — delivery unconfirmed', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Delivery failed — review provider dashboard', needs_review: 'Outcome uncertain — review provider dashboard', cancelled: 'Stopped before sending'};
export default function AppointmentContact({appointmentId, canSend = true}: {appointmentId: string; canSend?: boolean}) {
 const [open, setOpen] = useState(false), [config, setConfig] = useState<Config | null>(null);
 const [requests, setRequests] = useState<ContactRequest[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
 const load = useCallback(async (signal?: AbortSignal) => {
  const responses = await Promise.all([fetch('/api/integrations', {signal}), fetch('/api/communications?appointmentId=' + encodeURIComponent(appointmentId), {signal})]);
  const [settings, history] = await Promise.all(responses.map(r => r.json()));
  if (!responses[0].ok || !responses[1].ok) throw new Error(history.error || settings.error || 'Could not load reminder status.');
  setConfig(settings); setRequests(history.requests);
 }, [appointmentId]);
 useEffect(() => {
  if (!open) return;
  const controller = new AbortController();
  load(controller.signal).catch(e => {if (!controller.signal.aborted) setMessage(e.message)});
  return () => controller.abort();
 }, [open, load]);
 async function refresh() { setBusy(true); try { await load(); setMessage('Reminder status updated.'); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } }
 async function contact(channel: 'voice' | 'whatsapp') {
  if (!window.confirm(channel === 'voice' ? 'Place a Vapi phone call to this patient about the appointment? Patient voice-call consent must be recorded.' : 'Send the approved WhatsApp appointment reminder to this patient? Patient WhatsApp consent must be recorded.')) return;
  setBusy(true);
  try {
   const response = await fetch('/api/communications', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({appointmentId, channel, confirmed: true})});
   const data = await response.json();
   setMessage(data.message || data.error || 'Contact request failed.');
   await load();
  } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
 }
 return <div>
  <button type="button" className="text-link" aria-expanded={open} onClick={() => setOpen(x => !x)}>Reminders</button>
  {open && <div>
   <p>Appointment reminders</p>
   <button type="button" className="button secondary" disabled={busy || !canSend || !config?.vapi?.enabled} onClick={() => contact('voice')}>Call with Vapi</button>{' '}
   <button type="button" className="button secondary" disabled={busy || !canSend || !config?.whatsapp?.enabled} onClick={() => contact('whatsapp')}>Send WhatsApp reminder</button>{' '}
   <button type="button" className="text-link" disabled={busy} onClick={refresh}>Refresh status</button>
   {config && !config.vapi?.enabled && !config.whatsapp?.enabled && <p><small>Contact providers are not configured.</small></p>}
   {config?.whatsapp?.enabled && <p><small>Automatic WhatsApp reminders: {config.whatsapp.automaticReminders ? 'enabled' : 'disabled'}. Delivery tracking: {config.whatsapp.deliveryTracking ? 'configured' : 'not configured'}.</small></p>}
   {!canSend && <p><small>Sending requires a future scheduled or confirmed appointment.</small></p>}
   {!requests.length && config && <p><small>No contact requests recorded.</small></p>}
   {requests.length > 0 && <ul>{requests.map(request => <li key={request.id}>
    {request.channel === 'voice' ? 'Vapi call' : 'WhatsApp'} · {request.source} · {request.appointmentDate} {request.appointmentTime}: {request.channel === 'voice' && request.status === 'accepted' ? 'Accepted — check Vapi for the call result' : labels[request.status] || request.status}
    {request.errorCodes.length > 0 && ' (provider codes: ' + request.errorCodes.join(', ') + ')'}
   </li>)}</ul>}
   {message && <p role="status">{message}</p>}
  </div>}
 </div>;
}
