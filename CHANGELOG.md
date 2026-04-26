# Changelog

All notable changes to this plugin are documented in this file.

## [1.1.6] - 2025-04-25

### Added
- **Hide panel**: New `✕` button in the tab bar collapses the panel into a minimal overlay. Click the overlay to restore.
- New "Hide panel" feature documented in README.

### Fixed
- **Tool calling**: Fixed `tool_call_id` missing error for OpenAI-compatible providers. Messages with `role: 'tool'` now properly include `tool_call_id` referencing the `tool_calls.id` from the assistant message.

## [1.1.5] - 2025-04-25

### Added
- **Save Chat to Note**: New button exports the entire conversation to a new note. Select a notebook and edit the auto-generated title.
- **Quick action bar**: New buttons for "New Note", "Current Note", "Notebooks", "Save Chat".

### Changed
- Updated README with feature documentation for tool calling and quick actions.
- Added contributors: FErArg, Deepseek, Minimax.

## [1.1.4] - 2025-04-25

### Fixed
- **Invisible buttons**: Fixed low-contrast buttons in action bar and attach button. Now use accent color border and subtle background.

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