# Private clinical document storage

## Implemented and tested

The server upload/download API uses Firebase Admin Storage. Browser Storage access is denied by `storage.rules`; files have no public download tokens. Server permissions govern each request.

Uploads require same-origin requests and a Records-write role (owner, Clinic Admin, or doctor). PDF, PNG, JPEG and WebP files must be nonempty, at most 10 MB, and match their declared type's signature. Filenames are sanitized and bounded. Signatures reject obvious mismatches; this is not a malware scanner.

Downloads require a verified clinic identity and a valid object path under that clinic. Non-owner users must have a visible Records entry referencing the file. Patient visibility additionally requires an explicit Shared With Patient value of Yes. Downloads use attachment disposition, nosniff and private/no-store caching.

Automated tests cover upload/download round trips using mocked Storage, private versus shared patient files, forged file content, cross-site uploads, nonclinical upload rejection, unauthenticated downloads, cross-clinic paths, supported file signatures and filename bounds. TypeScript validation passed.

## Live activation remains blocked

On 14 October 2026, Firebase reports Billing Enabled: No. Creating a Firebase Storage bucket requires Blaze: https://firebase.google.com/docs/storage/web/start . No live bucket was created and no live Storage upload/download is claimed.

After the owner resolves billing:

1. Create the default bucket `physioflow-clinic-20261013.firebasestorage.app` in Mumbai (`asia-south1`) if offered and verify the actual returned bucket name/location.
2. Deploy `storage.rules` using Firebase CLI: `firebase deploy --only storage --project physioflow-clinic-20261013`.
3. Set FIREBASE_STORAGE_BUCKET to the actual bucket name. App Hosting configuration already contains the expected default name.
4. Confirm the backend runtime identity has the minimum object read/create permissions on this private bucket; avoid public access or browser credentials.
5. Run a small synthetic PDF through the deployed app. Verify owner/assigned clinician access, unshared patient denial, shared patient access, and denial for another patient, receptionist, accountant and anonymous users. Remove the synthetic file/record afterward.

Operational follow-ups: abandoned uploads can leave unreferenced objects; storage lifecycle cleanup and malware scanning are not implemented. Upload permission is clinic/role based; record visibility controls later access. No medical records were uploaded during this work.
