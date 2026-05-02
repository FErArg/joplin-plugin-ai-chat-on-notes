# AGENTS.md — joplin-plugin-ai-note-assistant

Single-package Joplin plugin: an AI chat panel that talks to notes via Cohere or Gemini.

## Build & dev commands

| Command | What it does |
|---|---|
| `npm run dist` | Full build: compile TypeScript, copy static assets to `dist/`, create `.jpl` archive + `.json` manifest in `publish/` |
| `npm run updateVersion` | Bump patch version in both `package.json` and `src/manifest.json` |
| `npm run prepare` | Runs `npm run dist` automatically (used before publish) |

Three sequential webpack passes: `buildMain` → `buildExtraScripts` → `createArchive`.

No test, lint, or typecheck scripts exist. No CI.

## Architecture

- **`src/index.ts`** — Single entrypoint (`joplin.plugins.register({ onStart })`). Registers settings, creates a webview panel, and handles all IPC messages (`save-settings`, `load-settings`, `get-notes-list`, `chat`).
- **AI providers**: Cohere (`command-r-plus-08-2024`), Gemini (auto-discovers models with fallback list), and OpenAI-Compatible (DeepSeek, Kimi, Grok, OpenRouter, or custom base URL + model).
- **`src/webview.js`** — Client-side JS for the panel (chat UI, settings UI, @-mention picker, note attachment). Runs in an iframe inside Joplin. Communicates via `webviewApi.postMessage()`.
- **`src/webview.css`** — Panel styles. Uses Joplin CSS variables (`--joplin-color`, `--joplin-background-color`, etc.) for theme adaptation. Since v1.1.4, most component CSS is handled by [oat](https://oat.ink) (~8KB, zero-dependency semantic UI library).
- **`api/`** — Auto-generated Joplin plugin API type declarations (from `generator-joplin`). Import as `import joplin from 'api'`.
- **`plugin.config.json`** — `extraScripts: []` (no extra compiled scripts currently).
- **`src/oat/`** — oat UI library assets (`oat.min.css`, `oat.min.js`) copied from `@knadh/oat` for the webview panel.

## Key conventions

- **AI providers**: Cohere (`command-r-plus-08-2024`) and Gemini (auto-discovers available models via API, falls back through a static candidate list). Provider + encrypted API key stored in Joplin settings (`aiProvider`, `encryptedCohereApiKey`, `encryptedGeminiApiKey`).
- **API key encryption**: AES-256-GCM, key derived from hardcoded material+salt via `scrypt`, random 96-bit IV per save. Format: `base64(iv):base64(tag):base64(ciphertext)`.
- **Tool calling** (OpenAI-compatible only): `search_notes`, `get_note`, `create_note`, `append_to_note`, `replace_note_body`, `delete_note`, `rename_note`, `list_notebooks`, `get_selected_note`, `list_tags`, `add_tags_to_note`.
- **Note context**: Attached notes are body-truncated at 4000 chars each. Fallback (no attachment) loads 30 recent notes truncated at 2000 chars each. Global note picker paginates up to 2000 notes (100/page, max 20 pages).
- **`.gitignore`**: `dist/`, `node_modules/`, `/publish`. Never commit these.
- **`package.json` `files`**: only `publish`. The `.npmignore` excludes everything except the publish artifacts.

## Gotchas

- `npm run update` calls `yo joplin` globally — requires `generator-joplin` installed globally. Will overwrite `webpack.config.js`.
- The `api/` directory is aliased as `api` in webpack resolve — always import as `from 'api'`, **not** as a relative path.
- The plugin manifest version lives in **two** places: `package.json` and `src/manifest.json`. `npm run updateVersion` keeps them in sync; manual edits must update both.
- No TypeScript `strict` mode in `tsconfig.json` — only `"target": "es2015"`, `"module": "commonjs"`, `"jsx": "react"`.
- **oat integration**: Tab navigation uses `<ot-tabs>` WebComponent (listens for `ot-tabs-change` event); Save Chat dialog uses native `<dialog closedby="any">` (open with `showModal()`, close with `close()`).
