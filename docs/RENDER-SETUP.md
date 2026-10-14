# Render Free with Firebase Spark

The owner selected Render Free for the first live Google signup test. Firebase billing remains disabled. `render.yaml` configures a free Node web service, production Next.js build, dynamic PORT and a lightweight health endpoint. Provider calls, payments and automatic messages are disabled.

1. Sign in to Render and connect only the private GitHub repository `Gayatri2502/physioflow-clinic`. Approve GitHub access deliberately. Select the free web-service plan; do not add paid instances or a payment method for this test.
2. Use the tracked Blueprint or its matching build/start commands. Set the public Firebase API key and app ID from the existing Firebase web app. These public client values must exist before build.
3. Configure `FIREBASE_SERVICE_ACCOUNT_JSON` privately as a Render environment secret. It must be a dedicated Firebase service account permitted to verify/revoke/create Auth sessions and access this project's Firestore. Do not commit its JSON or paste private keys into chat. Credential creation and access assignment require an explicit owner decision.
4. Add the actual Render serving hostname to Firebase Authentication authorized domains. Never add a protocol, path or port. Do not guess a domain before the service is created.
5. Test owner Google login/logout, first-time user signup, pending access denial, owner approval with patient/doctor record binding and all role restrictions. Use approved synthetic data only; do not import legacy samples.

Free services sleep after15minutes without inbound traffic and may take about a minute to resume. This deployment is for integration testing, not guaranteed always-on reminder delivery. Local files are ephemeral. Firebase Storage remains inactive; document uploads are not ready. No paid plan, Firebase billing, document store or messaging scheduler is enabled by this configuration.

Current blockers: Render account login/repository authorization, private server Firebase credentials, actual serving domain and live verification.
