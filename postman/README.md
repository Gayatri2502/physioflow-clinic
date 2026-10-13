# Postman

Import `PhysioFlow.postman_collection.json`. Set `baseUrl` to the test deployment's origin (no trailing slash). Sign in with Google in the application, then sync that origin's cookies using your local Postman Interceptor/cookie jar. Alternatively, obtain a fresh Firebase Google ID token from your test client and run the manual CSRF/token exchange folder with `allowMutations=true`; the cookie jar must retain the CSRF and resulting session cookie.

The exported collection has empty token and session variables. Keep these only in local current values and never export/share populated variables. Provider secrets do not belong in Postman.

Start with the read-only folder. Unauthenticated responses should be 401, unassigned users 403. An assigned user should see only the records permitted by their role. Fill record/patient/invoice IDs from that authorized response when checking writes.

Mutation requests are skipped unless `allowMutations=true`. Calls, WhatsApp sends and payment requests additionally require `allowExternalActions=true`. Leave both false on production, and do not run the entire collection as a routine health check. Run external actions individually on a sandbox/test account with an owned test number and recorded consent.

Document uploads use `POST /api/documents` with multipart field `file`; select a local supported file smaller than 10 MB. Do not export private document contents. Test the Razorpay webhook using Razorpay's own signed sandbox delivery; this collection does not fabricate signatures or simulate proof of payment.
