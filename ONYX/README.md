# ONYX

ONYX is a static multi-page PWA prototype for browser, iPhone, and desktop wrappers.

## What is included

- Landing page: `index.html`
- Login: `login.html`
- Register: `register.html`
- Player dashboard: `home.html`
- Profile: `profile.html`
- Settings: `settings.html`
- Queue: `queue.html`
- Shared UI and state: `assets/styles.css`, `assets/app.js`
- PWA files: `manifest.json`, `sw.js`
- Native bridge shim: `web-bridge.js`
- Zero-dependency local server: `server.js`

## Run locally

1. Make sure Node.js is installed.
2. Run `npm start`
3. Open `http://localhost:3000`

Windows shortcut:

- Run `start.bat`

## Current architecture

- Pure HTML/CSS/JS, no framework
- Local state via `localStorage`
- Listening history via `IndexedDB`
- PWA caching via service worker
- Theme system via CSS variables
- Demo player logic with queue and profile sync across pages

## Important product boundary

This prototype is prepared for:

- licensed music APIs
- user-provided API keys
- local media libraries
- internet radio or other legal streams

It intentionally does not implement bypasses, hidden token scraping, or unlicensed access to copyrighted catalogs.

## Good next steps for another AI

- Replace demo track data in `assets/app.js` with real backend/API integration
- Add real authentication and persistence
- Add cover images and richer audio playback
- Add build tooling if React/Vue/Tauri migration is needed
- Add deployment config for Vercel/Netlify if desired
