# Firebase data model

The application uses Native Firestore Admin SDK transactions against the approved Standard database in Mumbai (`asia-south1`). The database and deny-direct-client rules/indexes are deployed. No collections need to be created with dummy documents: Firestore materializes a collection when the first authorized record is written.

| Path | Contents |
|---|---|
| `clinics/{clinicId}` | Stable clinic namespace; owner email, creation time, optimistic `version`, monotonic `patientSequence`/`invoiceSequence`, optional migration lock |
| `clinics/{clinicId}/records/{recordId}` | `id`, `kind`, `created`, `data` |
| `clinics/{clinicId}/audits/{auditId}` | Actor/action, record reference and timestamp |
| `clinics/{clinicId}/paymentOrders/{razorpayOrderId}` | Invoice/patient binding, INR minor-unit amount, creation status and verified posting details |
| `clinics/{clinicId}/contactRequests/{requestKey}` | Appointment/channel/slot binding, consent-checked requester/source, recipient hash, provider ID and preparing/requesting/accepted/sent/delivered/read/failed/needs-review status |
| `clinics/{clinicId}/contactMessages/{hashedProviderId}` | Provider message ID hash to contact request key, scoped to the clinic |
| `clinics/{clinicId}/contactReceipts/{hashedProviderId}` | Minimal signed delivery metadata, recipient hash and seven-day expiry; cleaned by jobs/webhooks |
| Private Storage: `{clinicId}/{uploadId}/{filename}` | PDFs and supported images, limited to 10 MB; streamed only through authorized application endpoints |

The stable clinic key is independent of Google user ID. Google establishes identity; the owner email and active Staff membership determine role. `Patients`, `Appointments`, `Doctors`, `Departments`, `Consultation`, `Treatments`, `Plans`, `Packages`, `Schemes`, `Billing`, `Payments`, `Records`, `Settings` and `Staff` retain their existing form fields in `components/erp/config.ts`. `validation/records.ts` validates records; `app/api/accounting/route.ts` validates advances, credit allocations, refund requests and daily closings. Reference keys (`patientId`, `doctorId`, `departmentId`, `invoiceId`, `appointmentId`, `packageId`, `schemeId`) remain inside record data and are checked against the clinic's records.

Every mutation of clinic records increments the clinic revision within the same transaction as its records and audit entry. Stale snapshots reject rather than overwrite. Patient and invoice sequences are advanced within that transaction and are never derived from live record counts. Existing identifiers cannot be edited. Delete protection rejects linked records and preserves posted payments and paid invoices. Patient-visible records and nonclinical staff fields are filtered server-side.

Automatic single-field indexes also support the scheduler's merged kind/date equality filters and receipt expiry queries; no composite indexes are needed for current queries. All records are currently loaded for existing cross-record calculations; server pagination is a future scaling improvement. Direct browser Firestore and Storage access is denied by the security rules. Privileged Admin SDK operations depend on server authorization and IAM, not these rules.

The project is designed to start empty. No sample dataset or demo account is provisioned. The owner creates clinic settings, departments, doctors and staff through the application. The legacy-sample maintenance endpoint only removes explicitly marked sample records after checking dependencies; it cannot create samples.

Contact-request and delivery metadata use their own transactions and do not change clinical record revisions. See [Automatic reminders](AUTOMATIC-REMINDERS.md) for status, deduplication and expiry behavior. The new metadata collections are created only when configured authorized traffic writes them; no dummy records were added.
