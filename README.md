# AI Note Assistant: Joplin Plugin

An AI-powered chat panel for Joplin that lets you have a conversation with your notes. Ask questions, get summaries, brainstorm ideas, and dig into your knowledge base, all without leaving the editor.

---

## Features

- **Chat with your notes:** Ask anything and the assistant answers using the content of your Joplin notes as context.
- **Attach specific notes:** Click the 📎 button or type `@` in the message box to pick and attach individual notes to a prompt, so the AI focuses only on what you choose.
- **@ mention autocomplete:** Type `@` followed by any part of a note title to get an instant searchable dropdown. Select a note to pin it to the message.
- **Conversation memory:** The assistant remembers the full back-and-forth within a session, so you can ask follow-up questions naturally.
- **Multiple AI providers:** Choose between **Cohere**, **Google Gemini**, and **OpenAI-Compatible** (DeepSeek, Minimax, Kimi, Grok, OpenRouter, or custom).
- **Tool calling (OpenAI-Compat):** When using an OpenAI-compatible provider (like DeepSeek or Minimax), the assistant can create notes, search your notes, list notebooks, and more — directly from chat.
- **Quick action buttons:** New Note, Current Note, Notebooks, and Save Chat — one-click actions without typing.
- **Export chat to note:** Save the entire conversation to a new note in any notebook, with an auto-generated title.
- **Secure API key storage:** Your API keys are encrypted with **AES-256-GCM** (random 96-bit IV per save) before being stored, and are never kept in plain text.
- **Theme aware:** Automatically adapts to your Joplin theme (Light, Dark, Dracula, etc.) using native CSS variables.
- **Keyboard friendly:** Press `Enter` to send, `Shift+Enter` for a new line, and navigate the note picker entirely with the keyboard.

---

## Installation

### Via Joplin Plugin Marketplace (Recommended)

1. Open Joplin and go to **Tools › Options** (or **Joplin › Settings** on macOS).
2. Click **Plugins** in the left sidebar.
3. Search for **`joplin-plugin-ai-note-assistant`**.
4. Click **Install** and restart Joplin.

### Manual Installation

1. Download the `.jpl` file from the [GitHub Releases](https://github.com/developerzohaib786/joplin-plugin-ai-chat-on-notes/releases) page.
2. In Joplin, go to **Tools › Options › Plugins**.
3. Click the gear icon (top right) and select **Install from file**.
4. Select the downloaded `.jpl` file and restart Joplin.

---

## Setup

This plugin supports **Cohere**, **Google Gemini**, and **OpenAI-Compatible** providers (DeepSeek, Minimax, Kimi, Grok, OpenRouter, or custom).

### For Cohere or Gemini

1. Create a key at [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) or [Google AI Studio](https://aistudio.google.com/app/apikey).
2. In Joplin, open the **AI Note Assistant** panel and switch to the **⚙️ Settings** tab.
3. Select your provider (**Cohere** or **Gemini**).
4. Paste your key and click **Save Provider & Key**.
5. The status row will confirm when the selected provider key is configured.

### For OpenAI-Compatible (DeepSeek, Minimax, etc.)

1. Create a key from your provider's dashboard (DeepSeek at [platform.deepseek.com](https://platform.deepseek.com), Minimax at [platform.minimaxi.cn](https://platform.minimaxi.cn), etc.).
2. In the **⚙️ Settings** tab, select **OpenAI-Compatible** as the provider.
3. Choose a preset (DeepSeek, Minimax, Kimi, Grok, OpenRouter) or select **Custom** to enter a base URL and model name manually.
4. Paste your API key and click **Save Provider & Key**.

---

## How to Use

Once installed and configured, the **AI Note Assistant** panel appears automatically on the side.

### Asking a question (no attachment)

Type your question in the input box and press **Enter**. The assistant will use up to 30 of your most recent notes as background context to answer.

### Attaching specific notes

1. **Click the 📎 button** next to the input box to open the note picker dropdown.
2. Search by title and click a note to attach it. Repeat for multiple notes.
3. Attached notes appear as chips above the input. Click **×** on a chip to remove one.
4. Send your message — the assistant will use *only* the attached notes as context, giving you a more focused answer.

### @ mention shortcut

Type `@` directly in the message followed by part of the note title (e.g. `@project plan`). The picker opens automatically. Select a note with the mouse or keyboard — the `@query` text is removed and the note is attached as a chip.

### Keyboard shortcuts (in the note picker)

| Key | Action |
|-----|--------|
| `↓` / `↑` | Navigate the list |
| `Enter` | Select the focused note |
| `Escape` | Close the picker |

### Quick action buttons

- **📝 New Note** — Create a blank note (prompts for title).
- **📄 Current Note** — Get the currently selected note in Joplin.
- **📁 Notebooks** — List all notebooks.
- **💾 Save Chat** — Export the entire conversation to a new note. Select a notebook and edit the title before saving.

### Tool calling (OpenAI-Compatible providers only)

When using **DeepSeek**, **Minimax**, or another OpenAI-compatible provider, the assistant can call tools during the conversation:

- `search_notes` — Search your notes by keyword.
- `get_note` — Get a specific note by ID.
- `create_note` — Create a new note.
- `append_to_note` — Add content to an existing note.
- `replace_note_body` — Replace the body of a note.
- `delete_note` — Delete a note.
- `rename_note` — Rename a note.
- `list_notebooks` — List all notebooks.
- `get_selected_note` — Get the note currently selected in Joplin.
- `list_tags` — List all tags.
- `add_tags_to_note` — Add tags to a note.

The assistant decides when to call a tool based on your request.

---

## Technical Summary

| Detail | Value |
|--------|-------|
| AI Models | Cohere `command-r-plus-08-2024`, Gemini `gemini-1.5-flash`, DeepSeek `deepseek-chat`, Minimax `abab6.5s-chat`, OpenRouter (many models) |
| Tool Calling | Enabled for OpenAI-compatible providers only (DeepSeek, Minimax, Kimi, Grok, OpenRouter, custom) |
| Encryption | AES-256-GCM, key derived with `scrypt`, random 96-bit IV per save |
| Note fetching | Paginates through all notes (up to 2 000) for the picker; loads up to 30 notes as fallback context |
| Context window | 4 000 chars per attached note, 2 000 chars per fallback note |
| Min Joplin version | 3.5 |

---

## Credits

- **Original author:** [Zohaib Irshad](https://github.com/developerzohaib786)
- **Contributors:** [FErArg](https://github.com/FErArg), [Deepseek](https://deepseek.com), [Minimax](https://minimax.ai)

---

## License

MIT © [Zohaib Irshad](https://github.com/developerzohaib786)