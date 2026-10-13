# Clinic records and document migration

Firestore Native stores `clinics/{FIREBASE_CLINIC_ID}` (default `physioflow`) with a numeric revision, and `records` and `audits` subcollections. Clinic identity does not change when the owner switches authentication providers. Record payloads, IDs, timestamps, ledger entries and audit history are retained. References stay in `data.*Id`; domain validation and the clinic revision transaction enforce relationships and concurrency. Transactions use the native Admin SDK; analytical pipelines are unnecessary for these server business operations.

The server is the only data gateway. Firebase client rules deny database and Storage access; signed-in users still need an Active staff record or the configured owner email. Configure `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_ID` (default `(default)`), `FIREBASE_CLINIC_ID`, `CLINIC_OWNER_EMAIL`, and `FIREBASE_STORAGE_BUCKET`. App Hosting uses Application Default Credentials. Local operators may use ADC or `FIREBASE_SERVICE_ACCOUNT_JSON`; keep credentials outside Git.

## Transfer existing D1 records

Obtain a read-only SQLite backup from the original Sites deployment. No deployment data is automatically available from the Git source.

```sh
node scripts/firebase-data.mjs from-sqlite --input clinic.sqlite --source-owner ORIGINAL_OWNER --output clinic.json
```

For each linked document, export its R2 object into a local backup folder and add `{ "key": "original-owner/object/filename.pdf", "path": "documents/filename.pdf", "contentType": "application/pdf" }` to the snapshot's `documents` array. Paths are relative to the snapshot. Import validation refuses to proceed if any linked document lacks a local backup. Original owner prefixes are rewritten to the stable clinic namespace.

```sh
node scripts/firebase-data.mjs import --input clinic.json
```

The default import validates only, never contacts Firebase, and never writes. Verify the record totals and retain the original backup. During a maintenance window, configure the target environment and explicitly apply:

```sh
node scripts/firebase-data.mjs import --input clinic.json --apply --confirm-project physioflow-clinic-20261013
```

The target clinic must be empty. The import locks API writes/reads during transfer, copies records/audits in bounded batches, uploads documents, verifies totals, then unlocks the clinic and increments its revision. A failed import remains locked; rerun the same snapshot to resume safely. Another snapshot or a populated clinic is refused. Do not edit clinic records manually during migration.

## Back up Firebase

```sh
node scripts/firebase-data.mjs export --output clinic-backup.json --documents-dir backup-documents
```

The record/audit export is read in a consistent transaction. Document downloads need Storage configuration. Backup files contain patient information, are created with owner-only permissions, and must remain outside the repository. Restore with the same validation and empty-target procedure. This tooling is provided and validated locally; no production patient data has been imported.
