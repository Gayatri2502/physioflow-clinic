Clinic integration checks use an in-memory SQLite database and mocked identity/document storage. They never contact the live clinic or change production records.

Run from the project root:

```
node tests/integration/run-check.mjs
node tests/integration/clinic-check.cjs
```

Coverage includes role separation, medical-field preservation during reception edits, patient booking/rescheduling/cancellation, private and shared documents, clinical workflows, billing reconciliation, accounting controls, authentication and concurrent/stale writes.
