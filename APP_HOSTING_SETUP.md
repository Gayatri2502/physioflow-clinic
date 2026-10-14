# Firebase App Hosting deployment

Selected deployment target: Firebase App Hosting for project `physioflow-clinic-20261013`, repository `Gayatri2502/physioflow-clinic`, branch `main`.

## Prerequisite

App Hosting requires the Blaze plan and a linked Cloud Billing account. Spark with billing disabled cannot run App Hosting. Activation awaits the owner's billing decision. Blaze usage beyond applicable no-cost allowances can incur charges; instance limits are not a spending cap.

## Prepared configuration

`apphosting.yaml` contains Firebase client configuration, clinic owner mapping, zero minimum instances and a maximum of two instances. Razorpay, Vapi, WhatsApp and automatic reminders remain disabled until their production configuration is verified.

The Firebase Admin SDK uses Application Default Credentials on Google infrastructure. Do not upload or commit a service-account private key for App Hosting.

## Deployment and verification checklist

- Owner enables Blaze if approved.
- Connect only the PhysioFlow repository to App Hosting and select `main`.
- Create a backend in an available region; confirm runtime identity has the necessary Firestore and Authentication permissions.
- Deploy and inspect build/runtime logs and `/api/health`.
- Add the resulting deployment hostname to Firebase Authentication authorized domains.
- Verify Google sign-in, signup, sign-out and owner approval for each supported role. Confirm pending users cannot access clinic data or assign their own privileges.
- Verify clinic records persist in Firestore across page reloads.
- Configure document Storage separately before enabling document uploads.
- Configure provider secrets securely before enabling integrations and webhook endpoints.

No backend, billing upgrade, or live deployment is confirmed by this configuration file alone. Render configuration remains available as an alternative but is not the selected target.
