# Frontend demo

Standalone React/TypeScript application built with Vite. The beneficiary, measurement, queue, referral, rules, reports, and profile screens are an illustrative browser-local demo backed by `src/store/mockStore.ts`. Its deterministic synthetic cohort contains 600 beneficiaries: 24 children aged 0–6 months, 146 aged 6 months–3 years, 152 aged 3–6 years, 50 adolescent girls aged 10–19 years, 137 pregnant women, and 91 lactating mothers. Dashboard and report summaries use this same mock store. Separate development-only synthetic workflow pages call B2 through `src/services/b2Api.ts`; these workflows are not connected to the mock cohort.

## Requirements and setup

Install a current Node.js LTS release and npm, then from this directory run:

```powershell
npm install --legacy-peer-deps
npm run dev
```

Vite reports the local address; the manifest sets port `3000`. The peer-dependency flag is needed for the current dependency declarations. Supabase browser settings and the optional B2 API URL are documented in `.env.example`; browser configuration alone does not grant operational access. The Gemini/Express dependencies and inherited AI Studio text are not evidence of an implemented Gemini integration or server.

## Useful commands

```powershell
npm test
npm run lint
npm run build
npm run preview
```

`test` runs the Node built-in test runner for mock-store integrity and directory behavior, casework, auth lifecycle, B2 API client, and source-contract tests; `lint` runs `tsc --noEmit`; `build` creates a Vite production bundle in `dist`; `preview` serves that bundle locally. `clean` currently uses a Unix `rm` command and is not a Windows PowerShell setup command.

## Structure

- `src/App.tsx`: routes and page composition.
- `src/pages/`: route-level screens.
- `src/components/`: shared landing and portal UI.
- `src/context/`: simulated staff session and toast state.
- `src/store/mockStore.ts`: the canonical deterministic synthetic cohort, linked records, role-scoped accessors, actions, and browser persistence.
- `src/utils/beneficiaryDirectory.ts`: shared beneficiary search, filtering, and pagination helpers.
- `src/services/b1CsvDataSource.ts`: typed parser contract retained for source-contract tests only; the CSV is not loaded by the frontend application.
- `src/services/b2Api.ts`: separate bearer-token B2 operational client. Protected calls remain fail-closed under the normal disabled backend auth configuration.
- `src/utils/`: local casework calculations/validation and role navigation rules.
- `public/`: static illustrations and media.

Role selection is client-side demo behavior, not authentication or security enforcement. Legacy demo actions update mock local state only. AWW mock reads are limited to the assigned centre; LS, CDPO, and DPO retain their existing scope rules. B2 client tests use mocked `fetch`; they do not establish a live authorized journey. The B1 source test reads the checked-in CSV only from the Node test process; the browser build does not include or request it. The Prepared Data Overview and its dashboard API widget are not part of the frontend. Do not enable `B2_AUTH_MODE` until trusted identity, assignment, hierarchy, worker mapping, and operational storage adapters are approved and implemented. Clear the app's localStorage demo keys/reset through the UI only when you intentionally want a fresh browser demo fixture.
