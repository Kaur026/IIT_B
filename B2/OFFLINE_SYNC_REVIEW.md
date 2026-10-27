# BE2 offline/sync architecture review — prototype boundary

**Status:** synthetic local demonstration only; no remote sync server is implemented or claimed. This note records the architecture gate from workflow Step 11, not a security approval.

## Implemented prototype behavior

- Queue files are written per synthetic demo actor under `B2/.offline/` (or `B2_OFFLINE_QUEUE_DIR`). The directory is git-ignored.
- Operations receive stable IDs and start as `pending`. Re-enqueuing an identical ID is idempotent; reusing the ID for different content is rejected.
- The simulator can report `synced`, `failed`, `conflict`, or `duplicate` using versioned synthetic server-state fixtures. `failed` operations can be retried. Conflicts require an explicit `retry_with_current_version` or `discard_pending_change` resolution, and every enqueue/attempt/retry/resolution is audited.
- Conflict handling never performs automatic last-write-wins. `retry_with_current_version` is an explicit demo choice and must be accompanied by review of the changed data before any real sync design is approved.
- The API does not send queued data over a network or apply generic queue payloads to protected database records. The response includes `remote_sync_enabled: false`.

## Required before real/offline deployment

1. Agree device ownership, local data minimization, encryption at rest, backup/remote-wipe, and retention with the security/privacy owners.
2. Define authenticated transport and server idempotency keys, authorization rechecks, queue schema/version migration, retry/backoff, and observability.
3. Specify field-level conflict review and resolution roles; never silently overwrite newer task, verification, referral, exception, or closure data.
4. Threat-model lost/shared devices and stale roles; audit conflict resolution without copying sensitive record content into logs.
5. Run a team architecture review and end-to-end tests on BE1/FE fixtures before replacing the simulator with a real adapter.

No credentials, Aadhaar numbers, OTPs, or real beneficiary data belong in the local queue. The queue is plain JSON and is therefore unsuitable for real personal data.
