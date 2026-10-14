# Your provider setup tasks

Updated 14 October 2026. The application code is implemented; provider activation and live end-to-end checks remain separate steps. Do not paste private keys into chat or GitHub.

## 1. Firebase database, documents and hosting

- Open [PhysioFlow Firebase](https://console.firebase.google.com/project/physioflow-clinic-20261013/overview). The project/web app exist and Google sign-in is enabled.
- Completed: you approved Standard Firestore in Mumbai (`asia-south1`); the database was provisioned and its database rules/indexes deployed. No patient or demo records were added.
- The owner chose to **keep Firebase billing disabled**. App Hosting and Firebase Storage remain inactive. Selecting a compatible Node host and document-storage option is a separate pending case.
- Deferred while billing stays disabled: private Firebase Storage and its `storage.rules` deployment. Firestore rules are already deployed; do not replace them with open/test-mode rules.
- After a hosting option is selected, deploy `Gayatri2502/physioflow-clinic`, add the actual serving domain to Firebase Authentication authorized domains and configure server-only Firebase Admin credentials/IAM. No paid Firebase hosting resource has been provisioned.
- Keep the new clinic empty. No demo data should be imported. First test owner Google sign-in/sign-out, empty settings, and denied access for an unassigned Google account. Only then create approved synthetic test records to verify sync.
- The original Sites website remains unchanged. Its old sample records have not been cleared live; the migration code removes demo routes/fallbacks and has an owner-only endpoint for clearing explicitly marked legacy sample records without deleting real records.

References: [App Hosting](https://firebase.google.com/docs/app-hosting), [Firestore](https://firebase.google.com/docs/firestore), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

## 2. Razorpay — begin in test mode

- Open [Razorpay Dashboard](https://dashboard.razorpay.com/) and switch to test mode.
- Generate a test Key ID and Key Secret. Put `RAZORPAY_KEY_SECRET` in the hosting secret manager; configure `RAZORPAY_KEY_ID` server-side too. Never use `NEXT_PUBLIC_` for payment secrets.
- Configure automatic capture. Create a webhook pointing to `https://YOUR-APP-DOMAIN/api/payments/razorpay/webhook`, subscribe to `payment.captured`, and choose a webhook secret. Store that same value as `RAZORPAY_WEBHOOK_SECRET`.
- Set `RAZORPAY_ENABLED=true` only on the test deployment initially.
- Test a partial/unpaid invoice, successful capture, failed checkout, tampered callback, repeated webhook and closed accounting day. Replayed callbacks/webhooks should create only one payment record.
- If payment capture succeeds but ledger posting fails, reconcile against Razorpay; do not charge again. Switch to live keys only after sandbox reconciliation passes. Provider-side refunds remain manual in this revision.

References: [Integration steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [Webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

## 3. Vapi — phone calls

- Open [Vapi Dashboard](https://dashboard.vapi.ai/). Vapi provides voice agents and phone calls; it is separate from WhatsApp messaging.
- Create a dedicated PhysioFlow appointment-reminder assistant. It should identify itself as automated, ask whether it is a suitable time, mention only appointment date/time, respect opt-out, and refer rescheduling to reception. Do not attach medical-record or payment tools.
- Connect an outbound-capable phone number. Record the assistant ID and phone number ID.
- Store the private key as `VAPI_PRIVATE_KEY`; set `VAPI_ASSISTANT_ID` and `VAPI_PHONE_NUMBER_ID` server-side. Keep `VAPI_ENABLED=false` until ready for an owned test number.
- Record patient `Voice Call Consent=Yes`, consent date/evidence and an international phone number. Confirm each test call from the appointment action. Check actual call completion in Vapi; API acceptance alone is not completion.

References: [Outbound calls](https://docs.vapi.ai/calls/outbound-calling), [Create call API](https://docs.vapi.ai/api-reference/calls/create).

## 4. Meta WhatsApp — appointment messages

- Create/select a Meta Business app with the WhatsApp product and connect your business phone number.
- Obtain the phone-number ID, supported Graph API version and an access token with the required messaging permission. Store the token as `WHATSAPP_ACCESS_TOKEN` in the secret manager.
- Have Meta approve a utility appointment-reminder template with **two text body parameters: appointment date, then appointment time**. Select its language.
- Configure `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_REMINDER_TEMPLATE` and `WHATSAPP_TEMPLATE_LANGUAGE`; keep `WHATSAPP_ENABLED=false` until testing.
- Record patient `WhatsApp Consent=Yes` plus consent date/evidence. Confirm one template send to an owned test number. Review message delivery separately.
- Completed in code: disabled automatic reminder scheduling, signed delivery-status callbacks and staff request history. Follow [Automatic reminders setup](AUTOMATIC-REMINDERS.md) for the app secret, business account ID, verification token and protected external cron. Live activation awaits configured hosting, Meta credentials/template and an owned-number sandbox test. WhatsApp calling and bulk campaigns remain pending. Vapi's dashboard link does not provide Meta WhatsApp credentials.

Reference: [Meta's WhatsApp API documentation](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

## 5. Postman

Import `postman/PhysioFlow.postman_collection.json`. Set the test deployment origin, authenticate with your Google account and use a local session cookie. Begin with read-only requests. Leave `allowMutations=false` and `allowExternalActions=false` until choosing an individual test. Never share exported session cookies, ID tokens or provider secrets.

## What to share back

Share the approved database edition/location, serving domain and provider setup status. Assistant/template IDs and public configuration may be supplied as needed. Enter private keys directly in hosting secrets; they do not need to be shared in chat. Live activation follows successful Firebase and provider sandbox checks.
