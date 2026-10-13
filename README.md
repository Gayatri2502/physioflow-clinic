# PhysioFlow Clinic

A single-clinic management application using Next.js, Firebase Authentication with Google sign-in, Firestore and private Firebase Storage. Patient, staff and clinical roles are enforced by the server. The source includes optional Razorpay payments, Vapi phone reminders and Meta WhatsApp template reminders. Those external integrations remain disabled until configured.

The application has no demo login, sample fallback or automatic sample creation. Test fixtures live only under `tests/` and never populate production Firebase.

## Local setup

Use Node.js 22 or newer and pnpm 11.25.0. Install with `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, and fill the Firebase public web configuration. Firebase Admin uses Application Default Credentials on the server; configure local credentials privately when running against real Firebase. Do not commit credentials or export authenticated Postman variables.

Run `pnpm dev` to serve on localhost. `pnpm build` and `pnpm start` run the standard Next.js production application. Docker is not required for development or Firebase App Hosting.

`pnpm typecheck` and `pnpm test` check authentication, clinic domain workflows with a transactional Firestore test double, and payment/contact policies. These tests do not contact live providers. Run actual Firebase emulator and provider sandbox tests before live use.

## Firebase and deployment

The project and web app are registered under `physioflow-clinic-20261013`; Google sign-in is enabled. The Standard Native Firestore database is provisioned in Mumbai (`asia-south1`), with rules and indexes deployed. Storage bucket creation and App Hosting deployment remain separate setup steps. See `docs/SETUP-CHECKLIST.md`. The new application is not yet deployed and the original Sites website is unchanged.

`apphosting.yaml` supplies public project configuration and bounded scaling. Use Firebase App Hosting Secret Manager references for payment/communications secrets; never put private keys in public environment variables. App Hosting and Firebase Storage need the Blaze plan. Billing must be explicitly enabled by the project owner before those resources are activated.

`firestore.rules` and `storage.rules` deny all direct client access. The Next.js server uses Firebase Admin and applies clinic membership and role checks on every protected operation. These rules do not constrain the Admin SDK, so server authorization and service-account IAM are essential. Protected pages redirect to Google sign-in, and unknown/unassigned users cannot read clinic records.

## Database shape and migration

See `docs/FIREBASE-SCHEMA.md` for collections and invariants. Firestore is a document database; SQL migrations are no longer the active runtime. The existing Sites infrastructure is retained in `legacy-sites/` for reference, along with the original Git history.

`scripts/firebase-data.mjs` supports offline SQLite export, Firebase export and explicit import into an empty clinic. Import validates and defaults to a dry run. It preserves IDs, clinical links, payments, audit entries and document mappings; imports lock the clinic until count verification completes. No live clinic data was transferred during this migration. Do not import old samples when preparing the empty clinic.

## API testing

Import `postman/PhysioFlow.postman_collection.json` into Postman. Read-only checks are enabled by default; mutations and external actions require deliberate opt-in. Sign in through the browser and use Postman's local cookie jar/Interceptor for the server session, or use the manual Firebase token exchange requests. The collection contains no tokens or keys. See `postman/README.md`.

## Payments and reminders

See `docs/PAYMENTS-AND-COMMUNICATIONS.md`. Razorpay is reconciled only after server-side signature/capture verification and an idempotent transaction. A captured payment that cannot be posted requires reconciliation, not an automatic second payment attempt. Vapi and WhatsApp require recorded channel-specific patient consent and a deliberate staff confirmation. API acceptance does not establish delivery. No automatic reminder scheduler, WhatsApp calls, or payment-provider refunds are implemented.
