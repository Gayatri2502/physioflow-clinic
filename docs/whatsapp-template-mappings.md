# Clinic WhatsApp mappings

The 16 submitted English template names map to event keys in `lib/communications/templates.mjs`. They cover reminders, booking confirmation, rescheduling, cancellation, missed visits, invoices, receipts, amounts due, refunds, package balances, requested plans, documents, feedback, service disruption, clinic updates and rebooking invitations.

Exact Meta body definitions and current approval statuses must be retrieved with `pnpm whatsapp:templates:sync`. The read-only command writes `integrations/whatsapp-templates.json` containing names, categories, language, statuses and body text; it omits access tokens, provider identifiers and example values. Review and deploy this file after syncing. Do not infer approval from submission.

The shared payload builder requires a matching approved definition, exact positional parameter count and international recipient number. Marketing templates, including Meta-reclassified templates, require separate marketing consent. Additional message workflows have mappings and payload validation but are not automatic sends: each needs its contextual parameter binding and authorization before activation.

Appointment reminders are wired to `appointment_reminder` (`physioflow_appointment_reminder_v1`) with parameters 1 = appointment date and 2 = appointment time in India time. The runtime rejects missing registry definitions, non-approved templates and marketing categories. Manual and automatic reminders share the same slot deduplication. Cancelled/past appointments and missing/revoked consent block sending. Uncertain provider outcomes require staff review rather than automatic retries.

## Activation checklist

1. Refresh the expired Meta token privately in `.env.local` or deployment secret settings. Never commit it.
2. Run template sync, inspect the exact reminder body and confirm APPROVED/UTILITY, then deploy the registry.
3. Finish HTTPS hosting, configure signed Meta webhook credentials and subscribe to message statuses.
4. Verify the production sender and a consenting test recipient before enabling `WHATSAPP_ENABLED`.
5. Configure a scheduler to POST `/api/communications/reminders` every 15 minutes using `Authorization: Bearer <REMINDER_JOB_SECRET>` (at least 32 characters). Keep the secret in scheduler settings.
6. Enable `WHATSAPP_AUTOMATIC_REMINDERS_ENABLED` after delivery tracking is verified. Defaults: 24-hour lead, 60-minute due window, five dispatch attempts per run.

No scheduler was created or patient message sent in this verification. Live template sync returned HTTP 401 / Meta code 190 on 14 October 2026 because the token expired. Provider flags remain disabled; hosted deployment is awaiting billing.

Validation: 17 integration unit checks, 29 reminder checks and TypeScript checks passed. Coverage includes concurrency, cancellation/rescheduling/consent changes, signed webhooks, sender/recipient binding, early receipts and out-of-order delivery events.
