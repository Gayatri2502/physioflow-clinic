# Firebase data model

The selected application uses Native Firestore Admin SDK transactions. Its read/write API is compatible with Standard Firestore and Enterprise Native; the remote database edition and location must be approved before provisioning. No collections need to be created with dummy documents: Firestore materializes a collection when the first authorized record is written.

| Path | Contents |
|---|---|
| `clinics/{clinicId}` | Stable clinic namespace; owner email, creation time, optimistic `version`, monotonic `patientSequence`/`invoiceSequence`, optional migration lock |
| `clinics/{clinicId}/records/{recordId}` | `id`, `kind`, `created`, `data` |
| `clinics/{clinicId}/audits/{auditId}` | Actor/action, record reference and timestamp |
| `clinics/{clinicId}/paymentOrders/{razorpayOrderId}` | Invoice/patient binding, INR minor-unit amount, creation status and verified posting details |
| `clinics/{clinicId}/contactRequests/{requestKey}` | Appointment/channel/slot binding, requester, pending/accepted/needs-review status and provider identifier |
| Private Storage: `{clinicId}/{uploadId}/{filename}` | PDFs and supported images, limited to 10 MB; streamed only through authorized application endpoints |

The stable clinic key is independent of Google user ID. Google establishes identity; the owner email and active Staff membership determine role. `Patients`, `Appointments`, `Doctors`, `Departments`, `Consultation`, `Treatments`, `Plans`, `Packages`, `Schemes`, `Billing`, `Payments`, `Records`, `Settings` and `Staff` retain their existing form fields in `components/erp/config.ts`. `validation/records.ts` validates records; `app/api/accounting/route.ts` validates advances, credit allocations, refund requests and daily closings. Reference keys (`patientId`, `doctorId`, `departmentId`, `invoiceId`, `appointmentId`, `packageId`, `schemeId`) remain inside record data and are checked against the clinic's records.

Every clinic mutation increments the clinic revision within the same transaction as its records and audit entry. Stale snapshots reject rather than overwrite. Patient and invoice sequences are advanced within that transaction and are never derived from live record counts. Existing identifiers cannot be edited. Delete protection rejects linked records and preserves posted payments and paid invoices. Patient-visible records and nonclinical staff fields are filtered server-side.

Single-field indexes support kind equality and created-date ordering; no composite indexes are needed for current queries. All records are currently loaded for existing cross-record calculations; server pagination is a future scaling improvement. Direct browser Firestore and Storage access is denied by the security rules. Privileged Admin SDK operations depend on server authorization and IAM, not these rules.

The project is designed to start empty. No sample dataset or demo account is provisioned. The owner creates clinic settings, departments, doctors and staff through the application. The legacy-sample maintenance endpoint only removes explicitly marked sample records after checking dependencies; it cannot create samples.
