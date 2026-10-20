import {dispatchClinicMessages} from '../../../../lib/communications/event-dispatch';
import {fail} from '../../../../services/server';
import {runAutomaticReminders} from '../../../../lib/communications/server';
import {requireReminderJob} from '../../../../lib/communications/security';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(req: Request) {
 try {
  requireReminderJob(req);
  return Response.json({...await runAutomaticReminders(),events:await dispatchClinicMessages()}, {headers: {'Cache-Control': 'no-store'}});
 } catch (e) { return fail(e); }
}
