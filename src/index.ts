import joplin from 'api';
import { SettingItemType } from 'api/types';
import * as crypto from 'crypto';
import * as https from 'https';

// ─── Tool system ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolProperty = any;

interface Tool {
	name: string;
	description: string;
	parameters: {
		properties: Record<string, ToolProperty>;
		required: string[];
	};
}

const TOOLS: Tool[] = [
	{
		name: 'search_notes',
		description: 'Search Joplin notes by a text query. Returns matching notes with their title and body (truncated to 500 chars).',
		parameters: {
			properties: {
				query: { type: 'string', description: 'Text to search for in note titles and bodies.' },
			},
			required: ['query'],
		},
	},
	{
		name: 'get_note',
		description: 'Get the full content of a specific note by its ID.',
		parameters: {
			properties: {
				note_id: { type: 'string', description: 'The ID of the note to retrieve.' },
			},
			required: ['note_id'],
		},
	},
	{
		name: 'create_note',
		description: 'Create a new note in Joplin. Specify a title and optional body content.',
		parameters: {
			properties: {
				title: { type: 'string', description: 'Title of the new note.' },
				body: { type: 'string', description: 'Body content of the note (markdown supported).' },
				notebook_id: { type: 'string', description: 'Optional notebook ID to place the note in. If omitted, uses the default notebook.' },
			},
			required: ['title'],
		},
	},
	{
		name: 'append_to_note',
		description: 'Append text content to the end of an existing note.',
		parameters: {
			properties: {
				note_id: { type: 'string', description: 'The ID of the note to append to.' },
				content: { type: 'string', description: 'Text to append to the note body.' },
			},
			required: ['note_id', 'content'],
		},
	},
	{
		name: 'replace_note_body',
		description: 'Replace the entire body of an existing note with new content.',
		parameters: {
			properties: {
				note_id: { type: 'string', description: 'The ID of the note whose body will be replaced.' },
				body: { type: 'string', description: 'The new body content (markdown supported).' },
			},
			required: ['note_id', 'body'],
		},
	},
	{
		name: 'delete_note',
		description: 'Permanently delete a note from Joplin.',
		parameters: {
			properties: {
				note_id: { type: 'string', description: 'The ID of the note to delete.' },
			},
			required: ['note_id'],
		},
	},
	{
		name: 'rename_note',
		description: 'Rename a note by changing its title.',
		parameters: {
			properties: {
				note_id: { type: 'string', description: 'The ID of the note to rename.' },
				new_title: { type: 'string', description: 'The new title for the note.' },
			},
			required: ['note_id', 'new_title'],
		},
	},
	{
		name: 'list_notebooks',
		description: 'List all notebooks (folders) in the Joplin workspace.',
		parameters: {
			properties: {},
			required: [],
		},
	},
	{
		name: 'get_selected_note',
		description: 'Get the note that is currently open/selected in Joplin.',
		parameters: {
			properties: {},
			required: [],
		},
	},
	{
		name: 'list_tags',
		description: 'List all tags in the Joplin workspace.',
		parameters: {
			properties: {},
			required: [],
		},
	},
	{
		name: 'add_tags_to_note',
		description: 'Add one or more tags to a note.',
		parameters: {
			properties: {
				note_id: { type: 'string', description: 'The ID of the note to tag.' },
				tags: { type: 'array', description: 'List of tag names to add.', items: { type: 'string' } },
			},
			required: ['note_id', 'tags'],
		},
	},
];

// ─── Tool execution helpers ──────────────────────────────────────────────────
async function executeTool(toolName: string, args: Record<string, any>): Promise<any> {
	switch (toolName) {
		case 'search_notes': {
			const query = (args.query ?? '').trim();
			if (!query) return { notes: [] };
			const result = await joplin.data.get(['search'], {
				query,
				fields: ['id', 'title', 'body'],
			});
			const items = result.items ?? [];
			return {
				notes: items.map((n: any) => ({
					id: n.id,
					title: n.title,
					body: ((n.body ?? '').substring(0, 500)),
				})),
			};
		}

		case 'get_note': {
			const noteId = (args.note_id ?? '').trim();
			if (!noteId) return { error: 'note_id is required' };
			try {
				const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'title', 'body', 'created_time', 'updated_time'] });
				return note;
			} catch (e) {
				return { error: 'Note not found: ' + noteId };
			}
		}

		case 'create_note': {
			const title = (args.title ?? '').trim();
			if (!title) return { error: 'title is required' };
			const body = (args.body ?? '') as string;
			const parentId = (args.notebook_id ?? '') as string;
			const note = await joplin.data.post(['notes'], null, {
				title,
				body,
				...(parentId ? { parent_id: parentId } : {}),
			});
			return { ok: true, note_id: note.id, title: note.title };
		}

		case 'append_to_note': {
			const noteId = (args.note_id ?? '').trim();
			const content = (args.content ?? '') as string;
			if (!noteId || !content) return { error: 'note_id and content are required' };
			try {
				const note = await joplin.data.get(['notes', noteId], { fields: ['body'] });
				await joplin.data.put(['notes', noteId], null, { body: (note.body ?? '') + '\n\n' + content });
				return { ok: true, note_id: noteId };
			} catch (e) {
				return { error: 'Could not append to note: ' + noteId };
			}
		}

		case 'replace_note_body': {
			const noteId = (args.note_id ?? '').trim();
			const body = (args.body ?? '') as string;
			if (!noteId) return { error: 'note_id is required' };
			try {
				await joplin.data.put(['notes', noteId], null, { body });
				return { ok: true, note_id: noteId };
			} catch (e) {
				return { error: 'Could not replace note body: ' + noteId };
			}
		}

		case 'delete_note': {
			const noteId = (args.note_id ?? '').trim();
			if (!noteId) return { error: 'note_id is required' };
			try {
				await joplin.data.delete(['notes', noteId]);
				return { ok: true, note_id: noteId };
			} catch (e) {
				return { error: 'Could not delete note: ' + noteId };
			}
		}

		case 'rename_note': {
			const noteId = (args.note_id ?? '').trim();
			const newTitle = (args.new_title ?? '').trim();
			if (!noteId || !newTitle) return { error: 'note_id and new_title are required' };
			try {
				await joplin.data.put(['notes', noteId], null, { title: newTitle });
				return { ok: true, note_id: noteId, title: newTitle };
			} catch (e) {
				return { error: 'Could not rename note: ' + noteId };
			}
		}

		case 'list_notebooks': {
			const result = await joplin.data.get(['folders'], { fields: ['id', 'title', 'parent_id'] });
			return { notebooks: result.items ?? [] };
		}

		case 'get_selected_note': {
			const note = await joplin.workspace.selectedNote();
			if (!note) return { error: 'No note is currently selected' };
			return {
				id: note.id,
				title: note.title,
				body: (note.body ?? '').substring(0, 2000),
			};
		}

		case 'list_tags': {
			const result = await joplin.data.get(['tags'], { fields: ['id', 'title'] });
			return { tags: result.items ?? [] };
		}

		case 'add_tags_to_note': {
			const noteId = (args.note_id ?? '').trim();
			const tags: string[] = Array.isArray(args.tags) ? args.tags : [];
			if (!noteId || !tags.length) return { error: 'note_id and tags are required' };
			try {
				for (const tagName of tags) {
					const existing = await joplin.data.get(['tags'], { fields: ['id', 'title'] });
					const found = (existing.items ?? []).find((t: any) => t.title === tagName);
					let tagId: string;
					if (found) {
						tagId = found.id;
					} else {
						const created = await joplin.data.post(['tags'], null, { title: tagName });
						tagId = created.id;
					}
					await joplin.data.post(['tags', tagId, 'notes'], null, { id: noteId });
				}
				return { ok: true, note_id: noteId, tags_added: tags };
			} catch (e) {
				return { error: 'Could not add tags to note: ' + noteId };
			}
		}

		default:
			return { error: `Unknown tool: ${toolName}` };
	}
}

// ─── Encryption helpers ───────────────────────────────────────────────────────
// AES-256-GCM with a key derived from a fixed material + salt.
// The IV is random per-encryption, stored alongside the ciphertext.
// This keeps the API key safe at rest in Joplin's settings store.
const ENCRYPTION_MATERIAL = 'joplin-ai-chat-plugin-v1-aes-key';
const ENCRYPTION_SALT = 'joplin-ai-chat-plugin-v1-salt';

function deriveKey(): Buffer {
	return crypto.scryptSync(ENCRYPTION_MATERIAL, ENCRYPTION_SALT, 32);
}

function encryptApiKey(plaintext: string): string {
	const key = deriveKey();
	const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	// Format:  base64(iv):base64(tag):base64(ciphertext)
	return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptApiKey(stored: string): string {
	const [ivB64, tagB64, encB64] = stored.split(':');
	if (!ivB64 || !tagB64 || !encB64) throw new Error('Invalid encrypted API key format');
	const key = deriveKey();
	const iv = Buffer.from(ivB64, 'base64');
	const tag = Buffer.from(tagB64, 'base64');
	const encrypted = Buffer.from(encB64, 'base64');
	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ─── Cohere v2 Chat API ───────────────────────────────────────────────────────
interface CohereMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
	tool_call_id?: string;
}

type AiProvider = 'cohere' | 'gemini' | 'openai_compat';
type OACompatProvider = 'deepseek' | 'kimi' | 'grok' | 'openrouter' | 'custom';

const OA_COMPAT_PROVIDERS: Record<OACompatProvider, { baseUrl: string; model: string; label: string }> = {
	deepseek:   { baseUrl: 'https://api.deepseek.com',   model: 'deepseek-chat',        label: 'DeepSeek' },
	kimi:       { baseUrl: 'https://api.moonshot.cn',    model: 'moonshot-v1-128k',      label: 'Kimi (Moonshot)' },
	grok:       { baseUrl: 'https://api.x.ai',           model: 'grok-2',               label: 'Grok' },
	openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat-v3', label: 'OpenRouter' },
	custom:     { baseUrl: '',                           model: '',                     label: 'Custom' },
};

function callCohere(apiKey: string, messages: CohereMessage[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify({
			model: 'command-r-plus-08-2024',
			messages: messages,
		});

		const options: https.RequestOptions = {
			hostname: 'api.cohere.com',
			path: '/v2/chat',
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(body),
			},
		};

		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => {
				try {
					// Detect authentication failures immediately from HTTP status
					if (res.statusCode === 401 || res.statusCode === 403) {
						return reject(new Error('INVALID_API_KEY: The Cohere API key is invalid or unauthorized. Please check your key in the Settings tab.'));
					}

					const parsed = JSON.parse(data);
					// Cohere v2 response shape: { message: { content: [{ type: 'text', text: '...' }] } }
					const content = parsed?.message?.content;
					if (Array.isArray(content)) {
						const textBlock = content.find((c: any) => c.type === 'text');
						return resolve(textBlock?.text ?? 'No text response returned.');
					}
					// Fallback for error responses — check for auth-related messages
					const rawErr: string = parsed?.message ?? parsed?.detail ?? JSON.stringify(parsed);
					const lower = (typeof rawErr === 'string' ? rawErr : JSON.stringify(rawErr)).toLowerCase();
					if (lower.includes('invalid api') || lower.includes('unauthorized') || lower.includes('invalid token')) {
						return reject(new Error('INVALID_API_KEY: The Cohere API key is invalid. Please check your key in the Settings tab.'));
					}
					reject(new Error(`Cohere API error: ${rawErr}`));
				} catch (e: any) {
					reject(new Error(`Failed to parse Cohere response: ${e.message}`));
				}
			});
		});

		req.on('error', (e) => reject(new Error(`Network error: ${e.message}`)));
		req.write(body);
		req.end();
	});
}

function callGeminiWithModel(apiKey: string, apiVersion: 'v1beta' | 'v1', model: string, systemContent: string, messages: CohereMessage[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify({
			systemInstruction: {
				parts: [{ text: systemContent }],
			},
			contents: messages.map((m) => ({
				role: m.role === 'assistant' ? 'model' : 'user',
				parts: [{ text: m.content }],
			})),
		});

		const options: https.RequestOptions = {
			hostname: 'generativelanguage.googleapis.com',
			path: `/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(body),
			},
		};

		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => {
				try {
					if (res.statusCode === 401 || res.statusCode === 403) {
						return reject(new Error('INVALID_API_KEY: The Gemini API key is invalid or unauthorized. Please check your key in the Settings tab.'));
					}

					const parsed = JSON.parse(data);
					const parts = parsed?.candidates?.[0]?.content?.parts;
					if (Array.isArray(parts)) {
						const text = parts
							.filter((p: any) => typeof p?.text === 'string')
							.map((p: any) => p.text)
							.join('\n')
							.trim();
						if (text) return resolve(text);
					}

					const rawErr: string = parsed?.error?.message ?? parsed?.message ?? JSON.stringify(parsed);
					const lower = (typeof rawErr === 'string' ? rawErr : JSON.stringify(rawErr)).toLowerCase();
					if (
						lower.includes('api key') ||
						lower.includes('unauthorized') ||
						lower.includes('permission denied')
					) {
						return reject(new Error('INVALID_API_KEY: The Gemini API key is invalid. Please check your key in the Settings tab.'));
					}
					reject(new Error(`Gemini API error: ${rawErr}`));
				} catch (e: any) {
					reject(new Error(`Failed to parse Gemini response: ${e.message}`));
				}
			});
		});

		req.on('error', (e) => reject(new Error(`Network error: ${e.message}`)));
		req.write(body);
		req.end();
	});
}

function listGeminiGenerateContentModels(apiKey: string, apiVersion: 'v1beta' | 'v1'): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const options: https.RequestOptions = {
			hostname: 'generativelanguage.googleapis.com',
			path: `/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`,
			method: 'GET',
		};

		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => {
				try {
					if (res.statusCode === 401 || res.statusCode === 403) {
						return reject(new Error('INVALID_API_KEY: The Gemini API key is invalid or unauthorized. Please check your key in the Settings tab.'));
					}

					const parsed = JSON.parse(data);
					const models = Array.isArray(parsed?.models) ? parsed.models : [];
					const names = models
						.filter((m: any) => {
							const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
							const name = String(m?.name || '').toLowerCase();
							return methods.includes('generateContent') && name.includes('gemini');
						})
						.map((m: any) => String(m.name || ''))
						.map((name: string) => name.startsWith('models/') ? name.substring('models/'.length) : name)
						.filter((name: string) => !!name);

					resolve(names);
				} catch (e: any) {
					reject(new Error(`Failed to parse Gemini model list: ${e.message}`));
				}
			});
		});

		req.on('error', (e) => reject(new Error(`Network error: ${e.message}`)));
		req.end();
	});
}

async function callGemini(apiKey: string, systemContent: string, messages: CohereMessage[]): Promise<string> {
	const apiVersions: Array<'v1beta' | 'v1'> = ['v1beta', 'v1'];
	const staticCandidates = [
		'gemini-2.5-flash',
		'gemini-2.0-flash',
		'gemini-2.0-flash-lite',
		'gemini-1.5-flash-latest',
		'gemini-1.5-flash',
		'gemini-pro',
	];

	let lastError: Error | null = null;

	for (const apiVersion of apiVersions) {
		let discovered: string[] = [];
		try {
			discovered = await listGeminiGenerateContentModels(apiKey, apiVersion);
		} catch (e: any) {
			const errMsg = String(e?.message || '');
			if (errMsg.startsWith('INVALID_API_KEY:')) throw e;
		}

		const seen = new Set<string>();
		const orderedCandidates = [...discovered, ...staticCandidates].filter((model) => {
			if (!model || seen.has(model)) return false;
			seen.add(model);
			return true;
		});

		for (const model of orderedCandidates.slice(0, 16)) {
			try {
				return await callGeminiWithModel(apiKey, apiVersion, model, systemContent, messages);
			} catch (e: any) {
				const errMsg = String(e?.message || '');
				if (errMsg.startsWith('INVALID_API_KEY:')) throw e;
				lastError = new Error(`Model ${model} failed (${apiVersion}): ${errMsg}`);
			}
		}
	}

	throw new Error(lastError?.message || 'Gemini API error: no supported Gemini model is available for this API key/account.');
}

// ─── OpenAI-Compatible API ──────────────────────────────────────────────────
function toOpenAIToolFormat(tool: Tool): any {
	return {
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: {
				type: 'object',
				properties: tool.parameters.properties,
				required: tool.parameters.required,
			},
		},
	};
}

async function callOpenAICompat(
	baseUrl: string, model: string, apiKey: string, messages: CohereMessage[]
): Promise<string> {
	const systemMsg = messages.find((m) => m.role === 'system');
	type OpenAIMessage = {
		role: string;
		content: string;
		tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
		tool_call_id?: string;
	};
	const chatMessages: OpenAIMessage[] = messages.filter((m) => m.role !== 'system').map((m) => ({
		role: m.role,
		content: m.content,
		...(m.tool_calls ? { tool_calls: m.tool_calls as any } : {}),
		...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
	}));

	const toolDefs = TOOLS.map(toOpenAIToolFormat);
	const MAX_TOOL_ROUNDS = 10;

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		const body = JSON.stringify({
			model,
			messages: chatMessages,
			...(systemMsg && round === 0 ? { system: systemMsg.content } : {}),
			...(toolDefs.length ? { tools: toolDefs, tool_choice: 'auto' } : {}),
		});

		const urlBase = baseUrl.replace(/\/$/, '');
		const urlObj = new URL(`${urlBase}/chat/completions`);
		const response = await new Promise<any>((resolve, reject) => {
			const options: https.RequestOptions = {
				hostname: urlObj.hostname,
				path: urlObj.pathname,
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
				},
			};

			const req = https.request(options, (res) => {
				let data = '';
				res.on('data', (chunk) => { data += chunk; });
				res.on('end', () => {
					if (res.statusCode === 401 || res.statusCode === 403) {
						return reject(new Error('INVALID_API_KEY: The API key is invalid or unauthorized. Please check your key in the Settings tab.'));
					}
					if (res.statusCode !== 200 && res.statusCode !== 201) {
						try {
							const parsed = JSON.parse(data);
							const errMsg = parsed?.error?.message || parsed?.error?.code || JSON.stringify(parsed);
							const lower = String(errMsg).toLowerCase();
							if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('invalid')) {
								return reject(new Error('INVALID_API_KEY: ' + errMsg));
							}
							reject(new Error(`API error (${res.statusCode}): ${errMsg}`));
						} catch {
							reject(new Error(`API error: HTTP ${res.statusCode}`));
						}
						return;
					}
					try {
						resolve(JSON.parse(data));
					} catch (e: any) {
						reject(new Error(`Failed to parse response: ${e.message}`));
					}
				});
			});
			req.on('error', (e) => reject(new Error(`Network error: ${e.message}`)));
			req.write(body);
			req.end();
		});

		const choices = response?.choices;
		if (!Array.isArray(choices) || !choices.length) {
			throw new Error('No response choices returned from the API.');
		}

		const msg = choices[0]?.message;

		// Text response — done
		if (msg?.content && !msg?.tool_calls) {
			return msg.content.trim();
		}

		// Tool call — execute and loop
		const toolCalls = msg?.tool_calls;
		if (Array.isArray(toolCalls) && toolCalls.length > 0) {
			// Add the assistant's tool call message (must include tool_calls for the API to accept it)
			chatMessages.push({
				role: 'assistant',
				content: msg.content ?? '',
				tool_calls: toolCalls as any,
			});

			// Execute each tool call (usually one per round, but handle multiple)
			for (const tc of toolCalls) {
				const toolName: string = tc?.function?.name ?? '';
				let args: Record<string, any> = {};
				try {
					args = JSON.parse(tc.function.arguments ?? '{}');
				} catch { /* ignore parse errors */ }

				const result = await executeTool(toolName, args);
				chatMessages.push({
					role: 'tool',
					tool_call_id: tc.id,
					content: JSON.stringify(result),
				});
			}
			continue;
		}

		// No content and no tool calls
		throw new Error('No response content or tool calls returned from the API.');
	}

	throw new Error('Max tool call rounds exceeded. Please rephrase your request.');
}

// ─── Panel HTML ───────────────────────────────────────────────────────────────
function getPanelHtml(): string {
	return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link rel="stylesheet" href="webview.css"/>
</head>
<body>
  <!-- Tab navigation -->
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="chat" id="tab-chat-btn">
      <span class="tab-icon">💬</span> Chat
    </button>
    <button class="tab-btn" data-tab="settings" id="tab-settings-btn">
      <span class="tab-icon">⚙️</span> Settings
    </button>
  </div>

  <!-- ── Chat Tab ── -->
  <div class="tab-content active" id="tab-chat">
    <div class="chat-messages" id="chat-messages">
      <div class="welcome-msg">
        <div class="welcome-icon">🤖</div>
        <p>Hello! I can answer questions based on your Joplin notes.</p>
	        <p class="welcome-sub">Make sure you've saved an API key for your selected provider in the <strong>Settings</strong> tab first.</p>
      </div>
    </div>
    <div class="chat-footer">
      <div class="chat-footer-inner">
        <!-- Note picker dropdown (floats above input) -->
        <div id="note-picker" class="note-picker" style="display:none">
          <div class="note-picker-search-wrap">
            <span class="note-picker-icon">🔍</span>
            <input type="text" id="note-picker-search" placeholder="Search notes…" autocomplete="off" />
          </div>
          <ul id="note-picker-list" class="note-picker-list"></ul>
          <div id="note-picker-empty" class="note-picker-empty" style="display:none">No matching notes</div>
        </div>
        <!-- Attached note chips -->
        <div id="attached-notes" class="attached-notes"></div>
        <!-- Quick action buttons -->
        <div class="action-bar">
          <button id="action-create-note" class="action-btn" title="Create a new note">📝 New Note</button>
          <button id="action-get-selected" class="action-btn" title="Get the currently selected note">📄 Current Note</button>
          <button id="action-list-notebooks" class="action-btn" title="List all notebooks">📁 Notebooks</button>
          <button id="action-save-chat" class="action-btn" title="Save entire chat to a new note">💾 Save Chat</button>
        </div>
        <!-- Input row -->
        <div class="chat-input-row">
          <button id="attach-btn" class="attach-btn" title="Attach a note (or type @ in the message)">📎</button>
          <textarea
            id="chat-input"
            placeholder="Ask something… (@ to mention a note, Enter to send)"
            rows="2"
          ></textarea>
          <button id="send-btn" title="Send">&#9654;</button>
        </div>
        <div id="chat-status" class="status-bar"></div>
      </div>

      <!-- ── Save Chat Dialog ── -->
      <div id="save-chat-overlay" class="dialog-overlay" style="display:none">
        <div class="dialog-box">
          <h3 style="margin:0 0 12px">💾 Save Chat to Note</h3>
          <label style="display:block;font-size:12px;margin-bottom:4px">Title</label>
          <input id="save-chat-title" type="text" style="width:100%;padding:6px 8px;font-size:13px;border:1px solid var(--joplin-divider-color,#ccc);border-radius:6px;background:var(--joplin-background-color,#fff);color:var(--joplin-color,#333);margin-bottom:12px" />
          <label style="display:block;font-size:12px;margin-bottom:4px">Notebook</label>
          <select id="save-chat-notebook" style="width:100%;padding:6px 8px;font-size:13px;border:1px solid var(--joplin-divider-color,#ccc);border-radius:6px;background:var(--joplin-background-color,#fff);color:var(--joplin-color,#333);margin-bottom:16px"></select>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="save-chat-cancel" class="action-btn">Cancel</button>
            <button id="save-chat-confirm" class="action-btn" style="background:var(--chat-accent,#1d72b8);color:#fff;border-color:var(--chat-accent,#1d72b8)">💾 Save Note</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Settings Tab ── -->
  <div class="tab-content" id="tab-settings">
    <div class="settings-panel">
	      <h2>AI Provider Settings</h2>
      <p class="settings-desc">
	        Choose your provider, then enter your API key.
	        Get keys from <a href="https://dashboard.cohere.com/api-keys" target="_blank">Cohere</a>,
	        <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio (Gemini)</a>,
	        or the OpenAI-compatible provider of your choice.
	        Keys are encrypted with AES-256-GCM before storage.
      </p>

	      <div class="form-group">
	        <label for="provider-select">Provider</label>
	        <select id="provider-select">
	          <option value="cohere">Cohere</option>
	          <option value="gemini">Gemini</option>
	          <option value="openai_compat">OpenAI-Compatible</option>
	        </select>
	      </div>

	      <div class="form-group" id="oai-compat-provider-group" style="display:none">
	        <label for="oai-compat-provider-select">OpenAI-Compatible Provider</label>
	        <select id="oai-compat-provider-select">
	          <option value="deepseek">DeepSeek</option>
	          <option value="kimi">Kimi (Moonshot)</option>
	          <option value="grok">Grok</option>
	          <option value="openrouter">OpenRouter</option>
	          <option value="custom">Custom</option>
	        </select>
	      </div>

	      <div class="form-group" id="oai-base-url-group" style="display:none">
	        <label for="oai-base-url-input">Base URL</label>
	        <input type="text" id="oai-base-url-input" autocomplete="off" placeholder="https://api.example.com" />
	      </div>

	      <div class="form-group" id="oai-model-group" style="display:none">
	        <label for="oai-model-input">Model</label>
	        <input type="text" id="oai-model-input" autocomplete="off" placeholder="model-name" />
	      </div>

      <div class="form-group">
	        <label for="api-key-input" id="api-key-input-label">API Key</label>
        <div class="input-row">
          <input
            type="password"
            id="api-key-input"
            autocomplete="off"
	            placeholder="Paste API key…"
          />
          <button id="toggle-visibility-btn" class="icon-btn" title="Show/hide key">👁</button>
        </div>
      </div>

	      <button id="save-settings-btn" class="primary-btn">Save Provider &amp; Key</button>
      <div class="api-status-row">
	        <span class="form-label" id="provider-status-label">Provider Status:</span>
        <div id="settings-status" class="status-bar"></div>
      </div>

      <hr/>
      <div class="settings-info">
        <h3>About Security</h3>
        <ul>
          <li class="security-list">Your key is encrypted before storage.</li>
          <li class="security-list">A random 96-bit IV is generated for every save.</li>
          <li class="security-list">The key is never stored in plain text.</li>
        </ul>
      </div>
    </div>
  </div>

  <script src="webview.js"></script>
</body>
</html>
`.trim();
}

// ─── Plugin registration ──────────────────────────────────────────────────────
joplin.plugins.register({
	onStart: async function () {

		// Register settings section + one hidden setting for the encrypted key
		await joplin.settings.registerSection('aiChatSection', {
			label: 'AI Chat on Notes',
			iconName: 'fas fa-comment-alt',
		});

		await joplin.settings.registerSettings({
			aiProvider: {
				value: 'cohere',
				type: SettingItemType.String,
				section: 'aiChatSection',
				public: false,
				label: 'AI Provider',
				description: 'Selected AI provider managed by the AI Chat plugin.',
			},
			encryptedCohereApiKey: {
				value: '',
				type: SettingItemType.String,
				section: 'aiChatSection',
				public: false,                          // hidden from the standard settings UI
				label: 'Encrypted Cohere API Key',
				description: 'AES-256-GCM encrypted Cohere API key managed by the AI Chat plugin.',
			},
			encryptedGeminiApiKey: {
				value: '',
				type: SettingItemType.String,
				section: 'aiChatSection',
				public: false,
				label: 'Encrypted Gemini API Key',
				description: 'AES-256-GCM encrypted Gemini API key managed by the AI Chat plugin.',
			},
			oaiCompatProvider: {
				value: 'deepseek',
				type: SettingItemType.String,
				section: 'aiChatSection',
				public: false,
				label: 'OpenAI-Compat Provider',
				description: 'Which OpenAI-compatible provider is selected.',
			},
			oaiBaseUrl: {
				value: 'https://api.deepseek.com',
				type: SettingItemType.String,
				section: 'aiChatSection',
				public: false,
				label: 'OpenAI-Compat Base URL',
				description: 'Base URL for the OpenAI-compatible API endpoint.',
			},
			oaiModel: {
				value: 'deepseek-chat',
				type: SettingItemType.String,
				section: 'aiChatSection',
				public: false,
				label: 'OpenAI-Compat Model',
				description: 'Model identifier for the OpenAI-compatible API.',
			},
			encryptedOACompatApiKey: {
				value: '',
				type: SettingItemType.String,
				section: 'aiChatSection',
				public: false,
				label: 'Encrypted OpenAI-Compat API Key',
				description: 'AES-256-GCM encrypted API key for the OpenAI-compatible provider.',
			},
		});

		// ── Create panel ──────────────────────────────────────────────────────
		const panel = await joplin.views.panels.create('aiChatOnNotesPanel');
		await joplin.views.panels.setHtml(panel, getPanelHtml());
		await joplin.views.panels.addScript(panel, './webview.css');
		await joplin.views.panels.addScript(panel, './webview.js');

		// ── Message handler ───────────────────────────────────────────────────
		await joplin.views.panels.onMessage(panel, async (msg: any) => {

			// ── save-settings ─────────────────────────────────────────────────
			if (msg.type === 'save-settings') {
				try {
					const provider: AiProvider =
						msg.provider === 'gemini' ? 'gemini' :
						msg.provider === 'openai_compat' ? 'openai_compat' : 'cohere';

					let settingKey: string;
					if (provider === 'gemini') settingKey = 'encryptedGeminiApiKey';
					else if (provider === 'openai_compat') settingKey = 'encryptedOACompatApiKey';
					else settingKey = 'encryptedCohereApiKey';

					const rawKey = (msg.apiKey ?? '').trim();

					if (rawKey) {
						const encrypted = encryptApiKey(rawKey);
						await joplin.settings.setValue(settingKey, encrypted);
					} else {
						const existing = await joplin.settings.value(settingKey) as string;
						if (!existing || !existing.trim()) {
							const label = provider === 'gemini' ? 'Gemini' : provider === 'openai_compat' ? 'OpenAI-Compat' : 'Cohere';
							return { ok: false, error: `No ${label} API key saved yet. Enter a key first.` };
						}
					}

					await joplin.settings.setValue('aiProvider', provider);

					// Save sub-provider, base URL and model for OpenAI-compat
					if (provider === 'openai_compat') {
						const subProvider = (msg.oaiCompatProvider ?? 'deepseek') as OACompatProvider;
						const preset = OA_COMPAT_PROVIDERS[subProvider] ?? OA_COMPAT_PROVIDERS.custom;
						await joplin.settings.setValue('oaiCompatProvider', subProvider);
						await joplin.settings.setValue('oaiBaseUrl', msg.oaiBaseUrl ?? preset.baseUrl);
						await joplin.settings.setValue('oaiModel', msg.oaiModel ?? preset.model);
					}

					return { ok: true };
				} catch (e: any) {
					return { ok: false, error: e.message };
				}
			}

			// ── load-settings ─────────────────────────────────────────────────
			if (msg.type === 'load-settings') {
				const providerRaw = await joplin.settings.value('aiProvider') as string;
				const provider: AiProvider =
					providerRaw === 'gemini' ? 'gemini' :
					providerRaw === 'openai_compat' ? 'openai_compat' : 'cohere';
				const cohereStored = await joplin.settings.value('encryptedCohereApiKey') as string;
				const geminiStored = await joplin.settings.value('encryptedGeminiApiKey') as string;
				const oaiCompatStored = await joplin.settings.value('encryptedOACompatApiKey') as string;
				const oaiCompatProvider = await joplin.settings.value('oaiCompatProvider') as OACompatProvider;
				const oaiBaseUrl = await joplin.settings.value('oaiBaseUrl') as string;
				const oaiModel = await joplin.settings.value('oaiModel') as string;
				return {
					provider,
					hasCohereApiKey: !!(cohereStored && cohereStored.trim()),
					hasGeminiApiKey: !!(geminiStored && geminiStored.trim()),
					hasOACompatApiKey: !!(oaiCompatStored && oaiCompatStored.trim()),
					oaiCompatProvider: oaiCompatProvider || 'deepseek',
					oaiBaseUrl: oaiBaseUrl || OA_COMPAT_PROVIDERS.deepseek.baseUrl,
					oaiModel: oaiModel || OA_COMPAT_PROVIDERS.deepseek.model,
				};
			}

			// ── get-notes-list ────────────────────────────────────────────────
			if (msg.type === 'get-notes-list') {
				try {
					const allNotes: Array<{ id: string; title: string }> = [];
					let page = 1;
					let hasMore = true;
					while (hasMore) {
						const result = await joplin.data.get(['notes'], {
							fields: ['id', 'title'],
							limit: 100,
							page: page,
						});
						const items: Array<{ id: string; title: string }> = result.items ?? [];
						allNotes.push(...items);
						hasMore = !!result.has_more;
						page++;
						if (page > 20) break; // safety cap: 2 000 notes max
					}
					return { ok: true, notes: allNotes };
				} catch (e: any) {
					console.error('AI Chat get-notes-list error:', e.message);
					return { ok: false, notes: [], error: e.message };
				}
			}

			// ── chat ──────────────────────────────────────────────────────────
			if (msg.type === 'chat') {
				const providerRaw = (msg.provider ?? (await joplin.settings.value('aiProvider'))) as string;
				const provider: AiProvider =
					providerRaw === 'gemini' ? 'gemini' :
					providerRaw === 'openai_compat' ? 'openai_compat' : 'cohere';

				let settingKey: string;
				if (provider === 'gemini') settingKey = 'encryptedGeminiApiKey';
				else if (provider === 'openai_compat') settingKey = 'encryptedOACompatApiKey';
				else settingKey = 'encryptedCohereApiKey';

				const stored = await joplin.settings.value(settingKey) as string;
				if (!stored || !stored.trim()) {
					const label = provider === 'gemini' ? 'Gemini' : provider === 'openai_compat' ? 'OpenAI-Compat' : 'Cohere';
					return { ok: false, error: `No API key configured for ${label}. Open the Settings tab to add it.` };
				}

				let apiKey: string;
				try {
					apiKey = decryptApiKey(stored);
				} catch (e: any) {
					return { ok: false, error: `Could not decrypt API key: ${e.message}` };
				}

				// Fetch notes to build context:
				// If the user attached specific notes, load only those; otherwise load recent 30
				let notesContext = '';
				try {
					const attachedIds: string[] = msg.attachedNoteIds ?? [];
					if (attachedIds.length > 0) {
						const noteItems: Array<{ title: string; body: string }> = [];
						for (const id of attachedIds) {
							const note = await joplin.data.get(['notes', id], { fields: ['title', 'body'] });
							noteItems.push(note);
						}
						notesContext = noteItems
							.map((n) => `### ${n.title}\n${(n.body || '').substring(0, 4000)}`)
							.join('\n\n---\n\n');
					} else {
						const result = await joplin.data.get(['notes'], {
							fields: ['title', 'body'],
							limit: 30,
						});
						const items: Array<{ title: string; body: string }> = result.items ?? [];
						if (items.length > 0) {
							notesContext = items
								.map((n) => `### ${n.title}\n${(n.body || '').substring(0, 2000)}`)
								.join('\n\n---\n\n');
						}
					}
				} catch (e: any) {
					// Non-fatal — continue without notes context
					console.error('AI Chat: failed to load notes:', e.message);
				}

				// Build message array
				const attachedIds: string[] = msg.attachedNoteIds ?? [];
				const systemContent = notesContext
					? attachedIds.length > 0
						? `You are a helpful AI assistant. The user has attached the following specific Joplin notes for context. Answer based on these notes.\n\n${notesContext}`
						: `You are a helpful AI assistant. Answer the user's questions using the following Joplin notes as context.\n\n${notesContext}`
					: 'You are a helpful AI assistant. The user has no notes yet.';

				// Conversation history comes from the webview
				const history: CohereMessage[] = (msg.history ?? []).map((h: any) => ({
					role: h.role as 'user' | 'assistant',
					content: h.content as string,
				}));

				const messages: CohereMessage[] = [
					{ role: 'system', content: systemContent },
					...history,
					{ role: 'user', content: msg.message as string },
				];

				try {
					let reply: string;
					if (provider === 'gemini') {
						reply = await callGemini(apiKey, systemContent, messages.filter((m) => m.role !== 'system'));
					} else if (provider === 'openai_compat') {
						const baseUrl = await joplin.settings.value('oaiBaseUrl') as string;
						const model = await joplin.settings.value('oaiModel') as string;
						reply = await callOpenAICompat(baseUrl, model, apiKey, messages);
					} else {
						reply = await callCohere(apiKey, messages);
					}
					return { ok: true, reply };
				} catch (e: any) {
					const errMsg: string = e.message || 'Unknown error';
					if (errMsg.startsWith('INVALID_API_KEY:')) {
						return { ok: false, invalidApiKey: true, error: errMsg.replace('INVALID_API_KEY: ', '') };
					}
					return { ok: false, error: errMsg };
				}
			}

			// ── execute-tool ──────────────────────────────────────────────────
			if (msg.type === 'execute-tool') {
				const toolName = (msg.toolName ?? '') as string;
				const args = (msg.args ?? {}) as Record<string, any>;
				if (!toolName) return { ok: false, error: 'toolName is required' };
				try {
					const result = await executeTool(toolName, args);
					return { ok: true, result };
				} catch (e: any) {
					return { ok: false, error: e.message };
				}
			}

			// ── get-tools ────────────────���─────────────────────────────────────
			if (msg.type === 'get-tools') {
				return { ok: true, tools: TOOLS };
			}

			return { ok: false, error: 'Unknown message type' };
		});
	},
});

