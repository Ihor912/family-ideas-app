# Сімейна орбіта

A Ukrainian family adventure picker: choose a destination, launch a little rocket, and discover something to do together. The public React application contains **no private family activities**. Google sign-in and Firestore rules protect the collection and shared progress.

## Run locally

Use Node 24 (`nvm use`) and npm:

```sh
npm ci
cp .env.example .env.local
# Fill in your Firebase web app's public configuration.
npm run dev
```

Open the printed `/family-ideas-app/` URL. To preview the design without any cloud account, run `npm run dev:demo`. That development-only adapter uses invented examples and is eliminated from the production build. Its optional `?scenario=signed-out`, `unapproved`, `empty`, and `error` states support UI testing.

## Firebase setup (free Spark plan)

1. Create a Firebase project with Google Analytics disabled. Keep the Spark plan; this app does not need Cloud Storage, Functions, or a billing account.
2. Register a web app and copy its `apiKey`, `authDomain`, `projectId`, and `appId` into the corresponding `VITE_FIREBASE_*` values in `.env.local`. These values identify the client; security comes from the rules, not from hiding this config. Never use an administrator/service-account key in the frontend.
3. Create a **Standard** Firestore database in a European location, in production mode. Deploy the included rules and content/history index exemptions:

   ```sh
   npx firebase login
   npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
   ```

4. Enable Authentication → Google. Set an appropriate project support email. Add `localhost`, `127.0.0.1`, and `ihor912.github.io` under Authentication → Settings → Authorized domains. Google login uses a popup opened by the login button; allow popups for the app if your browser blocks it.
5. Prepare your private source with the migration command below. Create `content/current` using the structured `schemaVersion`, `categories` and `ideas` fields from the generated private JSON, following [the content migration guide](docs/content-migration.md). The document stores individual activity records, with no complete source Markdown. Do not commit this data.
6. Sign in to the app with an intended adult's Google account. Until approval it shows the access screen. In Authentication → Users, verify that person's email and copy their UID. Create `members/THAT_UID` with `active: true` (boolean). Repeat for other adults. Do not put the membership list in the repository. Setting `active: false` revokes access.
7. The app creates `draws/current` on the first successful draw. Do not manually initialize it; the app uses server timestamps and validated IDs.

Maintain individual ideas in Firestore under `content/current` → `ideas` → the idea's ID → `markdown`. Change category labels under `categories` → the category's ID → `name`, and use `order` for their display order. Keep the stored IDs when editing wording or moving an idea to another category: shared draw history then stays intact. The original Markdown is a private backup, not the live source after migration. Private content is held in memory only. Authentication and the sound preference persist on the current browser; signing out clears the private interface.

To validate a file locally without printing its contents:

```sh
npm run validate:private -- /absolute/path/to/ideas.md "Contents heading" "References heading"
npm run migrate:private -- /absolute/path/to/ideas.md "Contents heading" "References heading"
```

The migration command generates ignored `private/content-v2.json`, a Firestore REST payload, and a verification manifest. It preserves all existing category/activity IDs and does not modify Firebase, shared history, or the original file. Deploy the compatible app before replacing a legacy cloud document; see the guide for the backup and concurrency checks. The app continues to read legacy Markdown documents during this transition.

Keep every private source under ignored `private/` or outside the checkout. The original family source filename is explicitly ignored as well. Never import it into the build or place it in `public/`.

## State and drawing

- `useState` owns category and disclosure controls; a typed reducer owns draw/reveal phases.
- Small Context providers expose authentication and sound preferences. Custom hooks subscribe to the private collection and shared history.
- Every draw runs a Firestore transaction against the current collection and **one combined family history**. A draw in a category also counts in “All”, including across devices.
- An exhausted category offers an explicit new round. Reset removes only that category's seen IDs, then selects and saves atomically. Resetting “All” clears the collection's round. A committed draw counts even if the tab closes before its animation finishes.
- Membership rules enforce authorization and history document shape. Selection fairness is implemented in the trusted family client; rules do not validate randomness.
- Web Audio synthesizes short optional sounds; audio starts only from user interaction, defaults off, and fails silently when unavailable. Enabling sound plays a confirmation tone. Interrupted contexts resume before scheduling effects; switching sound off closes the context so the next enable can recover a stuck mobile audio session. The optional Audio Session API requests playback only for effects and restores its prior setting afterward. Reduced motion is separate from sound.

The initial import derives IDs from the source using SHA-256, then stores them as permanent map keys. Structured content validates category references, display order and activity fields; editing text does not derive a new ID. The renderer retains safe Markdown formatting and excludes raw HTML and images. The collection is limited to 900,000 serialized UTF-8 bytes, 64 categories and 1,000 activities, keeping it and the shared history below Firestore document limits.

## Verify

```sh
npm run check       # ESLint, TypeScript, unit tests, production build
npm run test:rules  # Java 21+ required; real Firestore Emulator tests
npx playwright install chromium webkit
npm run test:e2e    # desktop Chromium and mobile WebKit with invented data
node scripts/check-public-build.mjs
```

Rule tests cover denied/approved access, forbidden edits, concurrent draws/resets, structured migration preserving history, and content updates during transactions. Browser tests use the development-only adapter; real Google popup login and audible sound require a manual check on the intended desktop/mobile browsers. Do not capture private content in committed screenshots, traces, or logs.

## GitHub Pages

The site is built for `https://ihor912.github.io/family-ideas-app/`. For a fork, update Vite's base, favicon path, Firebase authorized hostname, and this documentation.

In repository Settings → Secrets and variables → Actions → **Variables**, set:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Select **GitHub Actions** in Settings → Pages → Source. The included workflow checks code, runs unit/Emulator/browser tests with synthetic data, builds, checks the public artifact boundary, and deploys after a push to `main`. Actions are pinned to release commit hashes. No Firebase admin credentials or family data are used by CI. If config is missing, the production site displays a setup screen rather than exposing demo data.

Deploy Firestore rules before the first public release. Rule changes need the explicit Firebase deployment command above; Pages deployments do not deploy cloud security rules. Keep the local original as your data backup. Monitor usage in the Firebase console; the app is designed for Spark quotas, but availability remains subject to the provider's free-plan limits.

Google login on a GitHub project site shares an origin with that account's other Pages projects. Only host trusted scripts under that origin, or move this app to its own custom domain if stronger browser-storage isolation is needed.
