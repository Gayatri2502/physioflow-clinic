# Automatic WhatsApp reminders and delivery tracking

Implemented 14 October 2026. Code and mocked checks are complete. Live sending, webhooks and cron are not activated. Firebase billing remains disabled by the owner's choice; no Firebase paid resources were provisioned.

## Behavior

The default policy sends one approved WhatsApp template approximately 24 hours before a future Scheduled/Confirmed appointment, within a 60-minute window. The clinic's timezone is Asia/Kolkata. Appointments booked after that window can still receive a deliberate staff reminder. Vapi calls remain manual.

Automatic sends are disabled by default. Both manual and automatic sends share one appointment-slot/channel request key. Transactions verify clinic migration state, appointment status/date/time, linked Patients record, channel-specific consent with a real nonfuture consent date/evidence and international phone number. A second check before provider dispatch stops a reserved request if the appointment, consent or phone changed. Only a proven stop before dispatch may be retried after correction. A timeout, failed delivery or uncertain outcome is held for review and never automatically retried. Cancellation after provider dispatch cannot recall a message; there is a small unavoidable gap between the final database check and the external HTTP request.

The Appointments table's **Reminders** action shows staff the latest request statuses, its manual/automatic source and appointment slot. **Refresh status** reads the latest saved result. Accepted, sent, delivered, read, failed and uncertain outcomes remain distinct. Vapi acceptance directs staff to the Vapi dashboard for the call result.

## Configure a test deployment

1. Set the existing sending variables: `WHATSAPP_ENABLED`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_REMINDER_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`. Use an approved utility template with exactly two body text parameters: appointment date, then time.
2. Add server-only `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET` and a separately generated `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. Private values belong in the deployment's secret manager.
3. In Meta, register HTTPS `https://YOUR-APP-DOMAIN/api/communications/whatsapp/webhook` with that verification token. Subscribe the correct WhatsApp Business Account/app to the `messages` webhook field. Test a template send to an owned test number with recorded consent. Verify accepted, delivered/read and a failure callback on the configured Graph version. Do not enable automation until that test passes.
4. Generate a different random `REMINDER_JOB_SECRET` of at least 32 characters. Configure an external cron service to POST to `/api/communications/reminders` with `Authorization: Bearer <REMINDER_JOB_SECRET>`. The route accepts no clinic, recipient or clock override from the caller. It is not a Firebase Cloud Function or Cloud Scheduler deployment.
5. Start with `WHATSAPP_AUTOMATIC_REMINDERS_ENABLED=false`. A successful authenticated job reports disabled and performs receipt expiry cleanup. Test the schedule on a controlled deployment, then explicitly set the flag to `true`. Defaults are `WHATSAPP_REMINDER_LEAD_HOURS=24`, `WHATSAPP_REMINDER_WINDOW_MINUTES=60`, `WHATSAPP_REMINDER_BATCH_SIZE=5`.
6. Run every five minutes initially and inspect the JSON counts. The batch allows 1–10 provider attempts per run; uncertain attempts consume the budget. If `remaining` is nonzero, run another job promptly or adjust frequency/capacity before appointments leave the window. At default frequency/batch, capacity is about 60 sends per hour. The server must permit job execution up to 300 seconds; the provider timeout is 15 seconds per attempt. Overlapping invocations are protected by the shared transaction reservation.

No schedule is created automatically. Configure this on whichever Node hosting is selected while Firebase billing remains disabled. App Hosting/Storage activation is a separate pending decision.

## Webhook security and receipt retention

The GET handshake checks the verification token and echoes the challenge. POST authenticates the exact raw bytes with `X-Hub-Signature-256` and the Meta app secret, and binds events to the configured business account and sending number. Payloads are capped at 256 KiB and 100 status events. Only status metadata is processed; inbound message content, raw payloads and error prose are discarded. Saved recipient identifiers are hashes. The send response's validated WhatsApp `wa_id` is used when Meta normalizes the input number.

`contactRequests` holds operational history. `contactMessages` maps a hashed provider message ID to its request. A minimal `contactReceipts` inbox handles callbacks arriving before the provider ID is saved. Stronger delivered/read evidence cannot regress on duplicate or out-of-order callbacks. Failure codes are numeric only.

Receipt inbox entries expire after seven days and are ignored after expiry. At most 100 expired entries are removed on each authenticated job or signed webhook. Physical deletion occurs on the next job/webhook; an idle deployment without either does not guarantee deletion at exactly seven days. Keep the cleanup cron running even when automatic sending is disabled. No Firestore TTL policy or billed scheduler was enabled.

The scheduler scans only the one or two appointment dates overlapping its due window, with a safety cap of 500 appointments on each date. It fails visibly above that cap. Historical records and already-requested appointments do not consume the send budget. A stale `preparing` or `requesting` state after a process crash requires provider review; do not blindly remove it or rerun the send.

## Validation

`pnpm test:integrations` includes 29 mocked reminder workflow checks plus the existing ten integration policy checks. They cover duplicate/concurrent reservations, consent changes, cancellation/rescheduling, migration locks, timeout suppression, signed webhook tampering, account/number/recipient binding, provider recipient normalization, early receipts, status ordering, expiry cleanup and staff-only history. Tests use an in-memory Firestore double and mocked fetch; they do not contact Meta, Vapi or Firebase. Native Firestore concurrency and provider sandbox tests remain required before live automation.

References: [Meta webhook verification](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/), [Meta's Cloud API Postman collection](https://raw.githubusercontent.com/WhatsApp/WhatsApp-Flows-Tools/main/postman/v1/whatsapp-cloud-api.postman_collection.json), [Meta's message response types](https://raw.githubusercontent.com/WhatsApp/WhatsApp-Nodejs-SDK/main/src/types/messages.ts).
