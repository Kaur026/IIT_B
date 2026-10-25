<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2ad5b51f-a8b2-4716-9cba-e8fdd238cd89

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Poshan Action Layer in this repository

From the repository root, start the frontend with:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

The legacy peer flag is needed with the current manifest because Vite 8's optional esbuild peer range conflicts with the declared esbuild 0.25 range. The frontend is a standalone React/Vite app. Its sign-in is simulated, and workflow data is synthetic in-memory/localStorage demo data. It does not connect to the Python modules in `B1`, `B2`, or `member3_data_simulation`, and does not provide authenticated backend persistence.

Validate with `npm test` and `npm run build` from this directory.
