# Frontend demo

Standalone React/TypeScript application built with Vite. It contains a public landing/dashboard experience and simulated staff workflows for beneficiaries, measurements, action queues, referrals, rule settings, reports, and staff profiles. The records come from `src/store/mockStore.ts` and browser localStorage; this app does not call the Python modules in `B1`, `B2`, or `member3_data_simulation`.

## Requirements and setup

Install a current Node.js LTS release and npm, then from this directory run:

```powershell
npm install --legacy-peer-deps
npm run dev
```

Vite reports the local address; the manifest sets port `3000`. The peer-dependency flag is needed for the current dependency declarations. No environment file or API key is used by the implemented frontend. The Gemini/Express dependencies and inherited AI Studio text are not evidence of an implemented Gemini integration or server.

## Useful commands

```powershell
npm test
npm run lint
npm run build
npm run preview
```

`test` runs the Node built-in test runner against `src/utils/casework.test.ts`; `lint` runs `tsc --noEmit`; `build` creates a Vite production bundle in `dist`; `preview` serves that bundle locally. `clean` currently uses a Unix `rm` command and is not a Windows PowerShell setup command.

## Structure

- `src/App.tsx`: routes and page composition.
- `src/pages/`: route-level screens.
- `src/components/`: shared landing and portal UI.
- `src/context/`: simulated staff session and toast state.
- `src/store/mockStore.ts`: synthetic seed records, actions, and browser persistence.
- `src/utils/`: local casework calculations/validation and role navigation rules.
- `public/`: static illustrations and media.

Route guards and role selection are client-side demo behavior, not authentication or security enforcement. Some screen actions update mock local state only. There is no API contract, backend persistence, frontend integration test, or shared live dataset with B1/B2. Clear the app's localStorage demo keys/reset through the UI if you need a fresh browser fixture.
