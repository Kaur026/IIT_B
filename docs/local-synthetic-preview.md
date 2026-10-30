# Local synthetic prepared-data API preview

This is a backend-only local developer inspection tool for the validated
synthetic files under `B!/data`. It is not production authentication,
authorization, or an operational workflow. It reads source files without
writing them and uses a separate `/api/preview/prepared-data/` namespace. The
frontend dashboard does not connect to this API; its beneficiary and summary
views use the deterministic browser-local mock store. The preview does not use
`mockStore`, browser local storage, or the prototype SQLite database for its
displayed records.

## Local setup

Use two PowerShell terminals from the repository root. The preview launcher
refuses deployed/CI markers, requires a development/local environment and
disabled auth, and binds Uvicorn to `127.0.0.1`. It sets `B2_DB_PATH=:memory:`
for that Python process before importing the normal API app, so it will not
touch the developer's prototype database. This setting does not change the
normal application defaults.

Backend terminal:

```powershell
$env:B2_ENV = 'development'
$env:B2_PREPARED_PREVIEW_ENABLED = 'true'
$env:B2_AUTH_MODE = 'disabled'
$env:B2_PREPARED_ROWS_ENABLED = 'false'
$env:B2_PREPARED_SUMMARY_PUBLIC = 'false'
$env:B2_PREPARED_PREVIEW_PORT = '8000'
& 'C:\Users\Farhan Shaikh\anaconda3\python.exe' -m B2.local_preview
```

The frontend has no route or dashboard mode for this preview API. Use a local
HTTP client to call the endpoints below when inspecting the backend preview.

## Endpoints and request limits

- `GET /api/preview/prepared-data/datasets` returns all 12 dataset keys,
  labels, row counts, exposed fields, withheld fields and reasons, and
  allowlisted filter/sort fields. It accepts no query parameters.
- `GET /api/preview/prepared-data/{dataset_key}` returns one page of source
  records. Supported keys are `age_bands_reference`, `beneficiaries`,
  `centres`, `measurements`, `tasks`, `referrals`, `home_visits`,
  `maternal_profiles`, `service_records`, `review_history`,
  `verification_records`, and `workers`.
- Pagination: `limit` defaults to 25 (range 1-100); `offset` defaults to 0
  (maximum 1,000,000).
- Optional exact-value filtering uses the dataset's declared `filter_by` and
  `filter_value`. Sorting uses declared `sort_by` and `sort_order` (`asc` or
  `desc`). Unknown fields and unexpected parameters are rejected.
- Responses use `Cache-Control: no-store`; errors do not include CSV rows.

The dashboard groups all 12 datasets by their source purpose, shows catalog
record totals, and requests a dataset page only when that dataset is opened.
Rows retain the original source values and are limited to the API field
allowlist. It does not infer joins between datasets or calculate clinical
interpretations. The exposed and excluded field lists and reasons are documented in
[`prepared-dataset-data-dictionary.md`](prepared-dataset-data-dictionary.md).
The schema reader validates the complete CSV set and in-file relationships;
the preview does not infer cross-dataset or external-system mappings. The
prepared CSVs remain read-only and separate from B1 data, operational B2
records, browser demo records, and prototype SQLite data.

## Security and disabling

`B2_PREPARED_PREVIEW_ENABLED` defaults to false. The route namespace is
separate from existing `/api/prepared-data/*` routes and never changes their
auth, row-access, or summary gates. The preview is denied unless the explicit
switch is true, `B2_ENV` is `development` or `local`, `B2_AUTH_MODE=disabled`,
the existing row and public-summary gates are false, and no recognized
deployment/CI marker is active. Requests must have loopback client, Host, and
server addresses and may not contain forwarded-IP headers. The launcher binds
only to loopback and refuses unsafe environment settings.

Stop the backend process with Ctrl+C. For a running shell, clear only the
preview variables if desired:

```powershell
Remove-Item Env:B2_PREPARED_PREVIEW_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:B2_PREPARED_PREVIEW_PORT -ErrorAction SilentlyContinue
```

Do not set the preview switch in hosting configuration, expose Uvicorn through
a reverse proxy/tunnel, or deploy this endpoint. The preview deliberately
supports disabled application authentication because it is restricted to an
explicit local process and loopback network. It is not a substitute for the
trusted identity, role, organizational scope, worker, and prepared-ID
crosswalk repositories required before protected row endpoints can be
enabled. Synthetic source data does not itself grant publication approval.
