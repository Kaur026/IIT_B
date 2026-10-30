# Prepared synthetic dashboard summary

The dashboard's **Team-prepared data snapshot** reads only
`GET /api/prepared-data/summary`. The endpoint aggregates the server-side
`B!/data` CSVs. It returns category totals for beneficiaries and counts for
centres, measurements, tasks/statuses, and referrals/states. It returns no
row-level values, identifiers, names, dates, centre/worker assignments, or
clinical evaluations.

This is explicitly `SYNTHETIC DATA / PROPOSED INTEGRATION`. The summary is a
global dataset snapshot: it has no role or centre filters, rejects all query
parameters, and is not an operational-user view. The route returns 404 unless
`B2_PREPARED_SUMMARY_PUBLIC=true` is set explicitly; the setting defaults to
false in every environment. Enabling it makes the global counts public to any
caller and requires project-owner approval. The endpoint is read-only and is
separate from protected B2 operational APIs, B1 screening data, and the
browser-local `mockStore` demo. The standard `B2_AUTH_MODE=disabled` behavior
remains in place for protected routes.

The backend validates expected CSV headers, non-empty unique primary IDs,
synthetic markers, and allowed category/task/referral states on each summary
request. Missing or invalid files produce a generic 503 response; there is no
mock fallback. The CSV files stay in the server repository/runtime and are not
copied to `frontend/public` or included in the Vite bundle. A deployment must
include the `B!/data` directory in the backend artifact. Do not expose a CSV
static-file route.

## Local configuration

Start the backend from the repository root with dependencies already
provisioned:

```powershell
python -m uvicorn B2.api:app --host 127.0.0.1 --port 8000
```

Set `VITE_B2_API_URL=http://127.0.0.1:8000` in the local frontend environment,
then start Vite from `frontend/`. This configuration serves the aggregate
dashboard snapshot. It does not enable protected B2 records or writes.

## Deployment boundary

Keep `B2_PREPARED_SUMMARY_PUBLIC=false` unless publication of the global
aggregate has been approved. If approved, set it to `true` only in the backend
hosting environment; do not add it to the frontend. The route must not be
extended with row details, identifiers, query-based centre/worker filters, or
operational-store counts without a separate authorization review. The Vite
build receives only the API origin; the CSV remains server-side. B2 protected
routes continue to return 401 while `B2_AUTH_MODE=disabled`.
