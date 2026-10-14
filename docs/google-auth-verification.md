# Google signup and role verification — 14 October 2026

## Verified

- Automated session tests pass: verified Google identity required, fresh sign-in required, CSRF and same-origin checks, server-only session cookie, revoked session denial, and sign-out clearing the cookie and revoking sessions.
- All five signup roles tested through the actual signup and actor services: Clinic Admin, Doctor / Physiotherapist, Receptionist, Accountant, Patient.
- Pending users cannot become clinic actors or review/approve signup requests.
- Only the configured owner can approve or reject requests. Repeated signup cannot change the initially requested role. Super Admin cannot be requested.
- After approval, a fresh identity lookup resolves the stored assigned role. A mismatched Super Admin role selection fails; all non-owner roles are denied Staff writes and signup approval. Inactive and rejected accounts lose access.
- The same lifecycle suite passed against the live Firestore database in `physioflow-clinic-20261013`. Google identity was injected for this service-layer test; OAuth and session cookies were not simulated as live Firebase Authentication evidence.
- Live checks used a unique `auth-verification-*` clinic containing only synthetic identities. Cleanup verified the parent and accessRequests, records, and audits subcollections were empty. No demo records were added to the real clinic.
- Existing clinic integration tests passed for patient isolation, doctor assignment, reception clinical-field restrictions, accountant restrictions, and Clinic Admin Staff-write denial.
- TypeScript checks passed.

## Fixed deployed setting

The browser initially returned `auth/unauthorized-domain`. The live Authentication configuration did not include localhost despite the repository configuration listing it. Added `localhost` through the Authentication configuration API, preserving both existing Firebase domains, and confirmed the live configuration afterward.

## Real browser verification

After fixing the authorized domain, Google OAuth completed successfully against the real Firebase Authentication project. The session API returned 200, and the signed-in owner opened `/access-requests`. Selecting Patient for that owner showed the assigned Super Admin role and denied the mismatch.

Browser sign-out completed successfully. Revisiting `/access-requests` redirected to `/login?return_to=%2Faccess-requests`, confirming protected access was removed. The real clinic metadata document was created by the owner bootstrap and read back through the Firebase connector with version 0. No clinical or demo records were added.

The local test server used temporary, owner-only Application Default Credentials derived from the existing CLI sign-in; no new service-account key was created or committed. All payment, call and message integrations were disabled during verification. Hosted deployment remains pending billing; these results cover localhost and the live Firebase backend.

## Repeat tests

`pnpm test:auth` runs offline session and signup tests, including the full approval lifecycle.

For an explicit live test, set `FIREBASE_CLI_DIR` to the installed firebase-tools package directory and run `node tests/integration/run-signup-lifecycle.mjs --live`. This requires the CLI owner account and permission to create and remove synthetic verification documents. The runner cleans its temporary test clinic even when a check fails.
