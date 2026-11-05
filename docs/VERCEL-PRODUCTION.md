# Vercel production

Project: `physioflow-clinic`, team `alphacentauricai-8714s-projects`. Node 24, Next.js, Mumbai functions. GitHub `Gayatri2502/physioflow-clinic`, production branch `main`.

The Vercel production runtime uses OIDC Workload Identity Federation to impersonate `physioflow-vercel@physioflow-clinic-20261013.iam.gserviceaccount.com`. The Google identity provider restricts the subject to this exact team/project/production environment. The service account has Firebase Authentication Admin and Firestore User roles, not project Owner. No Google personal refresh token, local ADC file or service-account private key is uploaded to Vercel.

Clinical document uploads use a private Vercel Blob store in Mumbai. Download requests retain authentication, clinic/path and patient/document visibility checks. Public Blob URLs are never returned. Maximum upload is 4 MB to fit Vercel's function request size; larger files are rejected before storage. Existing non-Vercel deployments can retain Firebase Storage by omitting the Blob token.

`GET /api/health` is a public liveness check. A bearer token matching `DEPLOYMENT_HEALTH_SECRET` enables read-only backend checks of Firebase Auth, Firestore and private document storage. It returns no patient records, credentials or identity information. Configure a monitor with this token privately. Secrets must stay in Vercel environment settings, never in Git or browser variables.

Razorpay, Vapi and WhatsApp remain disabled until provider credentials and sandbox tests are completed. Their existing routes, consent checks and idempotency policies are retained. Do not enable automatic messages merely to obtain a green deployment.

Verification covers the build, authentication/session policies, signup lifecycle, clinic and accounting workflows, provider-policy tests, deployment liveness/backend readiness and anonymous access denial. Actual owner Google OAuth needs a real interactive sign-in; no test bypass is added.

Repository ESLint currently has pre-existing errors across the legacy ERP components (including extensive `any` usage). TypeScript/build and functional tests pass independently; a passing build is not a claim that this lint debt is resolved.
