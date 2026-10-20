# Production activation status — 20 October 2026

## Verified in provider dashboards

All 16 `physioflow_*_v1` English templates show **Active – Quality pending** in Meta WhatsApp Manager. Exact current text/category was captured in `integrations/whatsapp-templates.json`. The account is **Test WhatsApp Business Account**, not a production clinic sender. Production-account templates must be verified separately if a new WABA is created.

The Meta app is unpublished, its callback URL is empty, and it states production webhook data will not be delivered until publication. A reachable HTTPS backend is required before saving/verifying that callback.

Vapi Google sign-in now works under alphacentauric.ai@gmail.com. Created and published dedicated assistant `06a8892c-5c83-4cb3-8250-223dcbad6cb3`, version v2, named **PhysioFlow — Appointment Reminders**. Verified automation disclosure, bounded reminder instructions, 180-second maximum, and disabled recording/logging/transcript artifacts. Its provider model/voice/transcriber are dashboard defaults, not yet tuned or audio-tested. Other assistants were left unchanged. Vapi currently has no phone numbers. No carrier number was purchased/imported and no phone call was placed.

## Implemented in code

- Exact parameter bindings for all 16 template events. No clinical notes or document contents enter template parameters.
- Transactional outbox for confirmations, rescheduling, cancellation, no-show, invoice creation, posted payments/refunds and documents explicitly shared with patients. Razorpay settlement also queues its payment receipt atomically.
- Consent/record fingerprint checks before reservation and again before dispatch; pending events expire after 24 hours. Concurrent workers reserve one request. Uncertain sends require review rather than retry.
- Manual operational-event API `/api/communications/events` for outstanding balances, package balances, completed-visit feedback, service disruption and explicitly requested plan reminders. It binds values from persisted records and requires staff authorization plus confirmation; it does not accept arbitrary message text/parameters.
- Marketing mappings are not automatically dispatched. They need separate marketing consent and an outreach workflow. Requested care-plan reminders require an explicit Reminder Requested value; no recurring care-plan scheduler was configured.
- Scheduled worker processes appointment reminders plus the event queue. GitHub Actions workflow runs at a nominal 15-minute cadence only after repository variable REMINDER_SCHEDULER_ENABLED is true; scheduled Actions can be delayed and are not an exact-time guarantee.
- Operational staff can refresh Vapi outcomes via POST `/api/communications/voice-status` with requestId. Provider call, assistant and caller IDs must match; only outcome metadata is stored, not transcripts/recordings. The endpoint is API-only; no new call-results UI was added.

## Secrets and activation gates

Generated private local REMINDER_JOB_SECRET and WHATSAPP_WEBHOOK_VERIFY_TOKEN; set local VAPI_ASSISTANT_ID to the dedicated assistant. Secrets were not committed. Owner is configuring the Meta token/app secret and Vapi private key privately. No provider flags were enabled.

Before enabling jobs: deploy a backend, configure Meta production sender/WABA/token/app secret and published signed webhooks; verify the production template contract and controlled delivery. Set GitHub secrets REMINDER_URL (full HTTPS `/api/communications/reminders` URL) and REMINDER_JOB_SECRET matching the backend. Then enable the repository scheduler variable and backend reminder/event flags. Worker requests do not follow HTTP redirects or retry ambiguous provider sends.

Vapi needs an imported outbound-capable carrier number (Twilio, Vonage, Telnyx or SIP), credentials and a consenting test destination before a real call/result test.

Firebase reports **Billing Enabled: No**. Owner explicitly chose to keep billing disabled. Storage provisioning/live Storage tests and Firebase App Hosting remain blocked. Existing document permission/content tests pass against mocked storage; no live bucket/upload success is claimed.

Validation: full authentication, clinic, payment and integration suites passed; 22 integration unit checks plus 33 mocked reminder/event/call checks passed. Production build passed. No real messages or calls were sent. Meta API sync still returned HTTP 401 / code 190 on this date; browser approval evidence was retained without overwriting it with a failed API sync.
