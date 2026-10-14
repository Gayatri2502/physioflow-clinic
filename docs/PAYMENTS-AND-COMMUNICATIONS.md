# Payments and appointment communications

The implementation remains disabled until explicitly configured. No real charge, outbound call or WhatsApp message has been performed during implementation.

## Razorpay

Set server-only `RAZORPAY_ENABLED=true`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Start with test keys. Set automatic capture in Razorpay Dashboard. Register HTTPS `/api/payments/razorpay/webhook` for `payment.captured`, using the same webhook secret. Secrets never go into NEXT_PUBLIC variables or Postman exports.

Orders are created by the server from current invoice balance in INR paise. Patients can pay only their own invoices; staff need Payments permission. Checkout signatures use the server secret; webhook signatures cover raw request bytes. The server fetches the payment from Razorpay and checks captured status, amount, currency and order binding before creating a ledger entry. Posting is a Firestore transaction with the deterministic Razorpay payment ID, audit and clinic revision, preventing duplicate callback/webhook posting. Payments post on today's Asia/Kolkata accounting day and closed days reject posting. An invoice modified while checkout is open can require manual reconciliation; the provider may already have captured funds. Never treat HTTP verification failure as proof that funds were not captured. Review provider dashboard, reopen the day if appropriate, then replay the signed webhook or verification. No provider refund automation is included.

Tests cover signatures, exact capture matching, paise conversion and mocked transaction idempotency/closed-day protection. Full sandbox end-to-end testing, concurrent transaction tests and webhook replay against a configured Firestore environment must be completed before live enablement.

Official reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/ and https://razorpay.com/docs/webhooks/validate-test/

## Vapi phone appointment reminders

Vapi is a voice-call platform. It is separate from WhatsApp. Set `VAPI_ENABLED=true`, server-only `VAPI_PRIVATE_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID`. Use a dedicated published appointment-reminder assistant and imported outbound-capable number. Configure the assistant to disclose it is automated, use only `appointmentDate` and `appointmentTime`, and avoid asking for medical or payment details. This app does not configure Vapi tools to read/write the clinic database; do not attach scheduling mutation tools without authenticated and tenant-restricted callbacks.

Receptionist/admin explicitly confirms each call. The patient must have `Voice Call Consent=Yes`, `Consent Date` and `Consent Evidence` recorded and an international E.164 phone number. Only future Scheduled/Confirmed appointments qualify. One request is recorded per appointment slot and channel. An uncertain response is marked `needs_review`, and cannot be retried automatically. An accepted API request does not confirm that a call completed. Check the Vapi dashboard for delivery/call results. No bulk campaign or automatic scheduler is enabled.

Official reference: https://docs.vapi.ai/calls/outbound-calling and https://docs.vapi.ai/api-reference/calls/create

## Meta WhatsApp appointment reminders

Set `WHATSAPP_ENABLED=true`, server-only `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION` (supported configured version, such as `vXX.X`), `WHATSAPP_REMINDER_TEMPLATE`, and `WHATSAPP_TEMPLATE_LANGUAGE`. The business must own a WhatsApp Business Cloud API number and have an approved utility appointment-reminder template with exactly two text body placeholders: appointment date then time. No guessed Wapi endpoints are used.

Patient `WhatsApp Consent=Yes`, a real nonfuture `Consent Date` and `Consent Evidence` are required. Staff confirms manual sends; the template includes only appointment date/time. Optional automatic scheduling remains disabled by default. Signed Meta callbacks track sent/delivered/read/failed status with sender/recipient binding. See `AUTOMATIC-REMINDERS.md` for configuration, behavior, cleanup and validation. No WhatsApp calling is implemented.

Official Meta references: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api and https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/

## Internal API requests

All browser routes use the authenticated clinic session. `GET /api/communications?appointmentId=…` exposes request status only to operational staff. The reminder job uses a separate bearer secret; the Meta webhook uses its app signature and verification token. `/api/integrations` returns only enabled flags. `POST /api/payments/razorpay/orders` takes `{ "invoiceId": "…" }`; `/verify` takes `{ "orderId": "…", "paymentId": "…", "signature": "…" }`. `POST /api/communications` takes `{ "appointmentId": "…", "channel": "voice" | "whatsapp", "confirmed": true }`. Invalid/missing consent or unconfigured providers are rejected server-side. A Postman session cookie is required for protected endpoints; never export that cookie.
