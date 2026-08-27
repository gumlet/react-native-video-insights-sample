# Gumlet Insights — React Native sample app

Reference integration for [`@gumlet/insights-react-native`](https://www.npmjs.com/package/@gumlet/insights-react-native) and [`@gumlet/insights-js-core`](https://www.npmjs.com/package/@gumlet/insights-js-core).

Use this repo as a **copy-paste starting point**: wrap `react-native-video` with `withGumletInsights`, pass a `workspace_id`, and verify `/license` plus playback beacons in your network inspector.

**Stack in this demo:** React Native **0.87**, `react-native-video` **6.x**, Insights RN SDK **2.x**, core **4.x**.

---

## Production integration (recommended)

### 1. Install packages

```bash
npm install @gumlet/insights-react-native @gumlet/insights-js-core
npm install react-native-video @react-native-async-storage/async-storage react-native-device-info react-native-uuid
cd ios && pod install && cd ..
```

Peer versions: React **≥ 17**, React Native **≥ 0.68**, `react-native-video` **≥ 5.2** (v6 recommended).

They are **peer dependencies** of `@gumlet/insights-react-native` — npm does not install them automatically. Your app must add them so Metro can resolve native modules at runtime.

#### Why each package is required

| Package | Role in Insights | If missing |
|---------|------------------|------------|
| **`react-native-video`** | The player you wrap with `withGumletInsights(Video)`. The SDK’s `ReactNativeVideoAdapter` listens to r-n-video callbacks (`onLoad`, `onPlaybackStateChanged`, `onBuffer`, `onSeek`, …) and maps them to Insights events. `player_software` / `player_software_version` on beacons come from this package. | No video surface to track; the HOC has nothing to attach to. |
| **`@react-native-async-storage/async-storage`** | Persists **`gumlet_session_id`**, **`gumlet_session_expiry`**, and **`gumlet_user_id`** across app launches. Controls when the session HTTP beacon fires (only when there is no valid stored session). `bumpSessionExpiry()` extends the 30‑minute sliding window on each event. | New session/user ids every launch; session beacon on every cold start; no stable `user_id`. |
| **`react-native-device-info`** | Supplies device identity and OS metadata for ingest: `getUniqueId()` (first-time user id), manufacturer, model, OS name/version, app bundle/version, device type, etc. Used in `collectDeviceData` → `meta_operating_system`, `meta_device_*` on every beacon. | Empty or `unknown` OS fields; weaker device attribution. Platform fallbacks cover some gaps, but unique user id still needs this or a stored value. |
| **`react-native-uuid`** | Generates UUIDs for **new session ids** when AsyncStorage has none (`uuid.v4()`). Metro CJS interop is handled inside the SDK. | Crash or failed init when minting a session id (`react-native-uuid.v4 is unavailable`). |

**Bundled by the SDK (you do not install separately):**

| Package | Role |
|---------|------|
| **`react-native-url-polyfill`** | Polyfills `URL` / `URLSearchParams` for ingest `fetch` calls in Hermes/Metro (not guaranteed in all RN builds). Imported automatically via `react-native-url-polyfill/auto` in the HOC. |

**Your app already has:** `react` and `react-native` (required peers of every RN library).

### 2. Babel (React Native 0.73+)

If Metro fails bundling core with **“Static class blocks are not enabled”**, add the class-static-block plugin (this demo already has it):

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['@babel/plugin-transform-class-static-block'],
};
```

Core is built with `target: es2019` for Metro/Hermes; you should not need extra transforms beyond the above.

### 3. Wrap your player

Pattern from [`App.tsx`](./App.tsx):

```tsx
import { useMemo, useState } from 'react';
import Video from 'react-native-video';
import withGumletInsights from '@gumlet/insights-react-native';

const TrackedVideo = withGumletInsights(Video);

const WORKSPACE_ID = 'YOUR_GUMLET_VIDEO_SOURCE_ID'; // required

export function PlayerScreen() {
  const [paused, setPaused] = useState(true);

  const config = useMemo(
    () => ({
      workspace_id: WORKSPACE_ID,
      screen_name: 'Home',
      screen_type: 'feed',
      debug: __DEV__, // optional — verbose logs in Metro (console.warn)
    }),
    [],
  );

  return (
    <TrackedVideo
      config={config}
      source={{ uri: 'https://example.com/stream.m3u8' }}
      paused={paused}
      muted={false}
      resizeMode="contain"
      style={{ width: '100%', aspectRatio: 16 / 9 }}
    />
  );
}
```

**Important:**

- **`workspace_id` is required** — your Gumlet video-source id (Mongo `_id`). Without it, `/license` fails and no events are sent.
- The HOC **always renders the `<Video>` immediately**; session/user ids resolve in the background (no blank placeholder).
- Do **not** put `key={source.uri}` on the tracked player for every load — that remounts analytics. Change `source` via props instead (as in this demo).
- Pass **`paused`** from React state so PLAY/PAUSE beacons match actual playback (`onPlaybackStateChanged` inside the SDK).

### 4. Optional — full custom metadata (QA / staging)

Core exports a frozen test config with every custom field populated:

```tsx
import { fullCustomAnalyticsConfig } from '@gumlet/insights-js-core';

const config = {
  ...fullCustomAnalyticsConfig,
  workspace_id: WORKSPACE_ID,
  debug: true,
};
```

This demo uses that pattern to exercise `customData1`–`10`, user, video, and player fields on every beacon.

### 5. Configure before first run

Edit [`App.tsx`](./App.tsx):

| Constant | Purpose |
|----------|---------|
| `WORKSPACE_ID` | Your Gumlet video-source id |
| `DEMO_SOURCE_HLS` | HLS test stream (physical devices) |
| `DEMO_SOURCE_MP4` | MP4 fallback for Android emulators |

---

## Config reference

| Key | Required | Description |
|-----|----------|-------------|
| `workspace_id` | **Yes** | Gates `GET /license` |
| `property_id` | No | Legacy property id |
| `screen_name` | No | Maps to page URL metadata when unset |
| `screen_type` | No | Page type metadata |
| `debug` | No | License + beacon debug in Metro |
| `test` | No | Ephemeral random user/session (no AsyncStorage) |
| `customData1`…`10`, user/video/player fields | No | Same as web SDK — see [core docs](https://www.npmjs.com/package/@gumlet/insights-js-core) |

RN-only keys (`screen_name`, `screen_type`, etc.) are merged into device/player envelopes automatically; you do not send `player_name` — use `player_software` via the adapter.

---

## Session vs playback beacons

| When | What you see |
|------|----------------|
| **First launch** (no valid session in AsyncStorage) | v2 `event_family=session` (and v1 session mirror) **once** |
| **App reopen within ~30 min** | Same session id reused — **no** new session HTTP |
| **Each video load / Play** | `event_setup`, `event_player_ready`, `event_playback_ready`, play/pause/seek/rebuffer, etc. |

Session creation is **not** the same as `player_ready` or `player_init`. Those fire on every load.

To force a fresh session in dev:

```ts
import { clearIdentityForTests } from '@gumlet/insights-react-native';

await clearIdentityForTests(); // call before the tracked player mounts
```

---

## Run this demo

```bash
npm install
cd ios && pod install && cd ..
npm start -- --reset-cache
# other terminal:
npm run ios
# or
npm run android
```

After changing **`workspace_id`** and stream URIs in `App.tsx`, press **Play** and watch Metro (with `debug: true`) or Proxyman / Charles.

### What to verify

1. **`GET /license?workspace_id=…`** returns success (analytics enabled).
2. On **first install**: session beacon (`event_family=session` on v2).
3. On **Play**: playback events; device fields present (`meta_operating_system`, `orientation`, `player_software`, `player_software_version`).
4. **Pause / seek / rebuffer** produce the expected events (no spurious PLAY while paused).

Official ingest host: `https://ingest.gumlytics.com` (core default). For local ingest development, see [Local monorepo setup](#local-monorepo-setup-gumlet-developers) below.

### Android emulator note

Many emulators fail HLS AVC decode (`ERROR_CODE_DECODING_FAILED`). This demo auto-switches to MP4 on Android emulators; use a **physical device** or **API 34+** emulator for HLS testing.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No beacons | Check `workspace_id`; Metro for `[GumletInsights] Analytics disabled` |
| `npm ETARGET` for `@gumlet/insights-js-core@^4.0.1` | Use core **≥ 4.0.1** (`npm view @gumlet/insights-js-core versions`); clear cache: `npm cache clean --force && npm install` |
| Session on every navigation | Avoid remounting the HOC with `key={…}`; upgrade SDK (shared analytics instance) |
| False play/rebuffer on load | Upgrade to `@gumlet/insights-react-native@2` + core **≥ 4.0.1** |
| `LoadBundleFromServerError` / chunk load | Upgrade core **≥ 4.0.1** (static state-machine import) |
| `PlatformConstants` / wrong RN version in Metro | If using linked packages, see Metro `disableHierarchicalLookup` below |
| Physical device, no events | Ingest URL must be reachable from the device (not `localhost` unless port-forwarded) |

After any SDK upgrade:

```bash
npx react-native start --reset-cache
```

More detail: [insights-react-native README](https://github.com/gumlet/insights-react-native) · [Getting started](https://docs.gumlet.com/docs/insights-getting-started)

---

## Local monorepo setup (Gumlet developers)

This checkout uses **`file:`** dependencies and Metro `watchFolders` so you can iterate on SDK source without publishing to npm.

```json
"@gumlet/insights-js-core": "file:../insights-embed",
"@gumlet/insights-react-native": "file:../insights-react-native"
```

[`metro.config.js`](./metro.config.js) resolves linked packages from the repo root and **blocks hierarchical lookup** into nested `react-native` copies inside SDK `node_modules` (prevents TurboModule / `PlatformConstants` mismatches).

### One-time build

```bash
cd ../insights-embed && npm run build:release
cd ../insights-react-native && npm install && npm run build
cd ../GumletInsightsRNDemo && npm install
cd ios && pod install && cd ..
```

### After SDK edits

| Changed | Run |
|---------|-----|
| `insights-embed` | `npm run build:release` → reinstall/rebuild RN SDK → Metro `--reset-cache` |
| `insights-react-native` only | `npm run build` in that package → Metro `--reset-cache` |

Metro serves compiled **`dist/`**, not TypeScript `src/`. Always rebuild after SDK changes.

### Publishing path for apps

Production apps should **not** use `file:` deps. Publish order:

1. Tag/publish `@gumlet/insights-js-core` (e.g. **4.0.1+**)
2. Bump RN SDK to `"@gumlet/insights-js-core": "^4.0.1"` and publish `@gumlet/insights-react-native`
3. App: `npm install @gumlet/insights-react-native @gumlet/insights-js-core` from npm

---

## Architecture (short)

```
react-native-video
  → withGumletInsights (HOC)
      AsyncStorage session / user id
      device + player metadata (OS, orientation, r-n-video version)
      one gumlet.insights() instance per JS runtime
  → ReactNativeVideoAdapter
  → @gumlet/insights-js-core state machine
  → GET /license → v1 + v2 ingest beacons
```

---

## License

MIT © Gumlet Pte. Ltd.
