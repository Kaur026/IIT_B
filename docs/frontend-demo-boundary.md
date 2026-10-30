# Frontend demo and identity boundary

The React/Vite application is a browser prototype. Its role personas are simulated in development builds only; they are not accounts, authentication, or proof of identity. Production builds show that sign-in is unavailable until a verified provider is connected. No password field or credential is accepted by this prototype.

Development persona sessions use the fixed synthetic IDs and organization assignments in `frontend/src/utils/permissions.ts` and `frontend/src/context/AuthContext.tsx`. Session state is stored in browser `localStorage`, contains no password or secret, and is validated against the role allow-list and expected synthetic ID when restored. Stored scope values are discarded and rebuilt from the role's demo assignment.

For developer-only dataset reset controls, run a development server and add `?demoTools=1` to the URL. These controls mutate only the synthetic browser store. They are hidden from DPO, System Administrator, and Rule Administrator personas. The role and scope checks throughout the frontend are usability controls only; the browser is not a security boundary.

The mock store persists synthetic records in browser `localStorage`. The frontend does not call the B2 API, B1 modules, Supabase, or another service. Its hierarchy mapping is limited to the included fixtures: `Sector-4` and `Project-Central` contain `AWC-702`, `AWC-703`, and `AWC-704`; AWW demo persona `AWW-409` is assigned to `AWC-702`. DPO screens expose aggregate summaries only and no case/audit line items by default.

Account/organization administration screens and Rule Administrator draft/submission screens are not implemented. Rule editing and approval remain unavailable. Genuine sign-in, trusted organizational assignments, and server-enforced authorization require a separately configured identity provider and backend integration. Medical Officer remains deferred.
