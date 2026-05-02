# Changelog

All notable changes to this plugin are documented in this file.

## [1.1.4] - 2026-05-02

### Added
- **oat UI integration**: Replaced custom CSS component library with [oat](https://oat.ink) (ultra-lightweight, zero-dependency, semantic HTML/CSS/JS UI library, ~8KB).
- **Native `<dialog>` element**: Save Chat dialog now uses the browser's native `<dialog>` with `closedby="any"` instead of a custom overlay div.
- **Semantic form fields**: All settings form inputs wrapped with `data-field` attribute for oat's automatic field styling.
- **oat WebComponent `<ot-tabs>`**: Tab navigation uses oat's WebComponent for accessibility and keyboard navigation.
- **oat CSS/JS assets**: `src/oat/oat.min.css` and `src/oat/oat.min.js` included in build.
- **Hide panel**: `✕` button collapses the panel into a minimal overlay. Click to restore.

### Changed
- **Buttons**: All buttons now use oat's semantic styling (`data-variant`, `outline`, `small`, `ghost`).
- **Chips/Badges**: Attached note chips use oat `badge outline` class.
- **Status alerts**: Status messages use `role="alert"` + `data-variant` instead of CSS modifier classes.
- **webview.css**: Reduced from 744 lines to ~350 lines; removed all oat-replaced component styles.
- **README updated** with oat UI information.

### Fixed
- **Tool calling**: Fixed `tool_call_id` missing error for OpenAI-compatible providers. Messages with `role: 'tool'` now properly include `tool_call_id` referencing the `tool_calls.id` from the assistant message.

## [1.1.3] - 2025-04-25

### Added
- **Tool calling**: Implemented tool calling loop for OpenAI-compatible providers.
- **Tools registry**: 11 tools: search_notes, get_note, create_note, append_to_note, replace_note_body, delete_note, rename_note, list_notebooks, get_selected_note, list_tags, add_tags_to_note.
- **OpenAI-Compatible provider**: Support for DeepSeek, Kimi, Grok, OpenRouter, and custom base URL + model.
- **execute-tool IPC**: Server-side tool execution with Joplin data API.

## [1.0.0] - 2024-xx-xx

### Added
- Initial release.
- Cohere and Google Gemini support.
- Note attachment picker.
- @ mention autocomplete.
- Conversation memory.
- AES-256-GCM encrypted API key storage.