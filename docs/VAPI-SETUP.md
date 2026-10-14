# PhysioFlow phone calling setup

Prepared 14 October 2026. The app already has deliberate staff-confirmed Vapi calling with transactional appointment/consent checks and duplicate suppression. A dedicated assistant configuration is now prepared in `integrations/vapi-assistant.json`; it has not been created in the provider account. The existing Solar Desk assistant is not reused.

1. Sign in at https://dashboard.vapi.ai/. Google OAuth failed during this session in both the in-app browser and Chrome. Resolve the account sign-in yourself if needed.
2. Rotate the old private API key flagged in the Solar Desk setup notes. Enter the replacement directly into PhysioFlow's local `.env.local` as `VAPI_PRIVATE_KEY`; never paste it into chat or commit it. Do not copy the old exposed key.
3. Create a dedicated assistant using the tracked JSON as the configuration reference. Publish it, inspect its voice/language and behavior, and save its ID as `VAPI_ASSISTANT_ID`. It must introduce automation, ask whether speaking is appropriate, avoid appointment details before recipient agreement, and have no clinic mutation tools. Maximum duration: 180 seconds.
4. Import an existing outbound-capable carrier number with approved destination routing. Save its Vapi ID as `VAPI_PHONE_NUMBER_ID`. Free Vapi numbers support inbound calls only. Number purchase, credit purchases and recurring billing are not authorized by this setup task; review rates before any paid step.
5. Run `pnpm vapi:check`. It only lists assistants and numbers, verifies selected IDs, duration and obvious attached tools, and shows number suffixes. It does not place a call or prove India routing, safe behavior or carrier approval. The four checker/manifest tests use mocked data.
6. Keep `VAPI_ENABLED=false` until the server is deployed and a consenting owned test recipient and call-spending limit are agreed. Calling through the app requires a future Scheduled/Confirmed appointment, Voice Call Consent=Yes, a valid nonfuture consent date/evidence and an international phone number. Staff confirms the individual call.
7. Check the actual result in Vapi's dashboard. The app currently records API acceptance/uncertain outcomes; authenticated call-progress and end-of-call tracking remains pending. Acceptance does not prove anyone answered or heard the reminder.

For future webhook tracking, use a dedicated custom Bearer credential on the saved assistant's `server.url` and `server.credentialId`. Do not place a server URL into per-call assistantOverrides: Vapi may withhold saved credentials on that path. No webhook credential or URL was activated during this session.

Firebase billing remains disabled. No caller number, charge, live call or Vapi assistant was created in the provider account.

References: https://docs.vapi.ai/phone-calling , https://docs.vapi.ai/calls/outbound-calling , https://docs.vapi.ai/server-url/server-authentication .
