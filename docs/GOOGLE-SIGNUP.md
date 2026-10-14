# Google sign-in and clinic signup

Google is the identity provider for both first-time signup and later sign-in. Firebase creates the Google identity on first use. An authenticated identity alone cannot access clinic records.

- `/login`: role-specific Google login. The server verifies the assigned role; choosing another role never expands access.
- `/signup`: authenticated Google users request Clinic Admin, Doctor / Physiotherapist, Receptionist, Accountant or Patient access. A request stays pending until the owner reviews it. Super Admin cannot be requested.
- `/access-requests`: only the configured clinic owner can list/review pending signup requests. Approving creates active Staff membership. Patient approval requires an existing matching Patients record; physiotherapist approval requires an existing Doctors record. The owner must verify identity before linking.
- Repeated signup submissions preserve the original request. Rejected users contact reception; owner-reviewed reapplication is a future improvement. Existing Staff assignments are managed through clinic settings rather than overwritten by signup.
- Signup/review writes are transactional; decisions are audited and approvals update clinic revision. Browser mutation routes require the same origin. Session tokens require verified Google identity, recent sign-in and CSRF protection; sign-out revokes sessions.

Billing remains disabled on the existing Spark project. Google authentication does not require the $300 Cloud trial. The eligible $300 trial lasts up to90days and links a trial billing account, moving Firebase to Blaze; it is distinct from Spark. No plan change occurred.

Validation: authentication policy/session tests and mocked signup checks passed; TypeScript and production build checked. Live login/signup/approval still requires deployed server Firebase credentials and an authorized serving domain. No real staff or patient signup records were created by tests.

Current limitations: pending signup list is capped at100, no email notification or automatic patient matching, and rejected requests are not automatically reopened. Signup requests do not grant access until a verified owner decision.
