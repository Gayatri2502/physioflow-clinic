# Clinic integration checks

Run `pnpm test:clinic`. The runner bundles the real API/domain code with an in-memory Firestore transaction double, mocked Google identity and private document storage. It does not contact live Firebase or external providers. Fixtures are isolated under this test directory and are not available to production routes.

Coverage includes registration, appointments/conflicts, clinical visits and follow-up rescheduling, treatment/plan records, package consumption, schemes, invoicing/payment/refund reconciliation, advances/credit, cash closing, every report type, private/shared document access, all role boundaries, authentication rejection, stale writes, rollback and migration locks. Regression assertions cover invalid dates/times, numbering after deletions and closed-day invoice moves.

This verifies application behavior, not actual Firestore deployment/IAM, Google browser redirects, provider delivery or browser layout. These require emulator/sandbox and deployed end-to-end verification before activation.
