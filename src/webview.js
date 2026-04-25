/* global webviewApi */

(function () {
    'use strict';

    // ── State ────────────────────────────────────────────────────────────────
    const chatHistory = []; // { role: 'user'|'assistant', content: string }
    let isBusy = false;
    let currentProvider = 'cohere';
    let hasCohereApiKey = false;
    let hasGeminiApiKey = false;
    let hasOACompatApiKey = false;
    let apiKeySet = false;
    let allNotes = [];          // { id, title } – populated on init
    let attachedNotes = [];     // { id, title } – currently attached to the next message
    let pickerMode = null;      // 'attach' | 'mention'
    let atMentionStart = -1;    // textarea offset where the triggering @ sits
    let currentOACompatProvider = 'deepseek';
    let currentOABaseUrl = '';
    let currentOAModel = '';

    // ── Element refs ─────────────────────────────────────────────────────────
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatStatus = document.getElementById('chat-status');
    const providerSelect = document.getElementById('provider-select');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyInputLabel = document.getElementById('api-key-input-label');
    const providerStatusLabel = document.getElementById('provider-status-label');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const settingsStatus = document.getElementById('settings-status');
    const toggleVisBtn = document.getElementById('toggle-visibility-btn');
    const oaiCompatProviderSelect = document.getElementById('oai-compat-provider-select');
    const oaiBaseUrlInput = document.getElementById('oai-base-url-input');
    const oaiModelInput = document.getElementById('oai-model-input');
    const oaiCompatProviderGroup = document.getElementById('oai-compat-provider-group');
    const oaiBaseUrlGroup = document.getElementById('oai-base-url-group');
    const oaiModelGroup = document.getElementById('oai-model-group');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const actionCreateNote = document.getElementById('action-create-note');
    const actionGetSelected = document.getElementById('action-get-selected');
    const actionListNotebooks = document.getElementById('action-list-notebooks');
    const actionSaveChat = document.getElementById('action-save-chat');
    const saveChatOverlay = document.getElementById('save-chat-overlay');
    const saveChatTitle = document.getElementById('save-chat-title');
    const saveChatNotebook = document.getElementById('save-chat-notebook');
    const saveChatCancel = document.getElementById('save-chat-cancel');
    const saveChatConfirm = document.getElementById('save-chat-confirm');
    const attachBtn = document.getElementById('attach-btn');
    const attachedNotesEl = document.getElementById('attached-notes');
    const notePickerEl = document.getElementById('note-picker');
    const notePickerSearch = document.getElementById('note-picker-search');
    const notePickerList = document.getElementById('note-picker-list');
    const notePickerEmpty = document.getElementById('note-picker-empty');
    const chatFooter = document.querySelector('.chat-footer');
    const panelCloseBtn = document.getElementById('panel-close-btn');
    const panelHiddenOverlay = document.getElementById('panel-hidden-overlay');
    const tabBar = document.querySelector('.tab-bar');

    // ── Panel hide/show ──────────────────────────────────────────────────────
    var resizeObserver = new ResizeObserver(function () {
        chatMessages.style.bottom = chatFooter.offsetHeight + 'px';
    });
    resizeObserver.observe(chatFooter);

    // ── Panel hide/show ──────────────────────────────────────────────────────
    panelCloseBtn.addEventListener('click', function () {
        tabContents.forEach(function (c) { c.style.display = 'none'; });
        tabBar.classList.add('panel-hidden');
        panelHiddenOverlay.style.display = 'flex';
    });

    panelHiddenOverlay.addEventListener('click', function () {
        panelHiddenOverlay.style.display = 'none';
        tabContents.forEach(function (c) { c.style.display = ''; });
        tabBar.classList.remove('panel-hidden');
        var activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            var target = activeTab.getAttribute('data-tab');
            document.getElementById('tab-' + target).classList.add('active');
        }
    });

    // ── Tab switching ────────────────────────────────────────────────────────
    tabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            const target = btn.getAttribute('data-tab');
            tabBtns.forEach(function (b) { b.classList.remove('active'); });
            tabContents.forEach(function (c) { c.classList.remove('active'); });
            btn.classList.add('active');
            document.getElementById('tab-' + target).classList.add('active');
        });
    });

    // ── Show / hide API key ──────────────────────────────────────────────────
    toggleVisBtn.addEventListener('click', function () {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleVisBtn.textContent = '🙈';
        } else {
            apiKeyInput.type = 'password';
            toggleVisBtn.textContent = '👁';
        }
    });

    // ── Helpers ──────────────────────────────────────────────────────────────
    function setStatus(el, msg, isError, persistent) {
        el.textContent = msg;
        el.className = 'status-bar ' + (isError ? 'status-error' : 'status-ok');
        if (msg && !persistent) {
            setTimeout(function () { el.textContent = ''; el.className = 'status-bar'; }, 4000);
        }
    }

    function appendMessage(role, text, opts) {
        // Remove welcome message on first real message
        const welcome = chatMessages.querySelector('.welcome-msg');
        if (welcome) welcome.remove();

        const div = document.createElement('div');
        div.className = 'chat-msg ' + (role === 'user' ? 'msg-user' : 'msg-assistant');

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        bubble.appendChild(textSpan);

        // Show which notes were attached (user messages only)
        if (opts && opts.notes && opts.notes.length > 0 && role === 'user') {
            const notesRow = document.createElement('div');
            notesRow.className = 'msg-notes';
            opts.notes.forEach(function (n) {
                const tag = document.createElement('span');
                tag.className = 'msg-note-tag';
                tag.textContent = '📄 ' + n.title;
                notesRow.appendChild(tag);
            });
            bubble.appendChild(notesRow);
        }

        div.appendChild(bubble);
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendErrorBubble(text) {
        const div = document.createElement('div');
        div.className = 'chat-msg msg-error';
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble bubble-error';
        bubble.textContent = text;
        div.appendChild(bubble);
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function setBusy(busy) {
        isBusy = busy;
        sendBtn.disabled = busy;
        chatInput.disabled = busy;
        attachBtn.disabled = busy;
        setStatus(chatStatus, busy ? 'Thinking…' : '', false);
    }

    function isInvalidKeyError(errMsg) {
        const lower = (errMsg || '').toLowerCase();
        return (
            lower.includes('invalid api') ||
            lower.includes('unauthorized') ||
            lower.includes('401') ||
            lower.includes('authentication') ||
            lower.includes('forbidden') ||
            lower.includes('access denied') ||
            lower.includes('invalid token') ||
            lower.includes('expired')
        );
    }

    function getProviderLabel(provider) {
        if (provider === 'gemini') return 'Gemini';
        if (provider === 'openai_compat') {
            const presetMap = {
                deepseek: 'DeepSeek', kimi: 'Kimi', grok: 'Grok',
                openrouter: 'OpenRouter', custom: 'Custom',
            };
            return presetMap[currentOACompatProvider] || 'OpenAI-Compat';
        }
        return 'Cohere';
    }

    function refreshSelectedProviderState() {
        if (currentProvider === 'gemini') apiKeySet = hasGeminiApiKey;
        else if (currentProvider === 'openai_compat') apiKeySet = hasOACompatApiKey;
        else apiKeySet = hasCohereApiKey;
    }

    function updateProviderUi() {
        const label = getProviderLabel(currentProvider);
        providerSelect.value = currentProvider;
        providerStatusLabel.textContent = label + ' API Status:';
        apiKeyInputLabel.textContent = label + ' API Key';

        const isOpenAICompat = currentProvider === 'openai_compat';
        oaiCompatProviderGroup.style.display = isOpenAICompat ? 'block' : 'none';

        const isCustom = currentOACompatProvider === 'custom';
        oaiBaseUrlGroup.style.display = isOpenAICompat && isCustom ? 'block' : 'none';
        oaiModelGroup.style.display = isOpenAICompat && isCustom ? 'block' : 'none';

        if (isOpenAICompat) {
            oaiCompatProviderSelect.value = currentOACompatProvider;
            oaiBaseUrlInput.value = currentOABaseUrl;
            oaiModelInput.value = currentOAModel;
        }

        if (currentProvider === 'gemini') apiKeyInput.placeholder = 'AIza...';
        else if (currentProvider === 'openai_compat') apiKeyInput.placeholder = 'sk-...';
        else apiKeyInput.placeholder = 'co-...';

        refreshSelectedProviderState();
        setStatus(
            settingsStatus,
            apiKeySet
                ? '✅ ' + label + ' API key is configured.'
                : '⚠️ No ' + label + ' API key set yet.',
            !apiKeySet,
            true
        );
    }

    // ── Quick action buttons ──────────────────────────────────────────────────
    async function executeTool(toolName, args) {
        setBusy(true);
        try {
            const response = await webviewApi.postMessage({
                type: 'execute-tool',
                toolName,
                args,
            });
            setBusy(false);
            if (response && response.ok) {
                return response.result;
            } else {
                appendErrorBubble('❌ Tool error: ' + (response?.error || 'Unknown error'));
                return null;
            }
        } catch (e) {
            setBusy(false);
            appendErrorBubble('❌ Tool error: ' + (e.message || String(e)));
            return null;
        }
    }

    function renderToolResult(toolName, result) {
        let text = '';
        if (toolName === 'get_selected_note' && result && !result.error) {
            text = `📄 **${result.title}**\n\n${result.body}`;
        } else if (toolName === 'list_notebooks' && result && result.notebooks) {
            text = '📁 **Notebooks:**\n' + result.notebooks.map((n) => `- ${n.title}`).join('\n');
        } else if (toolName === 'create_note' && result && result.ok) {
            text = `✅ Note created: **${result.title}** (ID: ${result.note_id})`;
        } else if (toolName === 'search_notes' && result && result.notes) {
            if (result.notes.length === 0) {
                text = '🔍 No matching notes found.';
            } else {
                text = '🔍 **Search results:**\n' + result.notes.map((n) =>
                    `- **${n.title}**${n.body ? '\n  ' + n.body.substring(0, 200) + '…' : ''}`
                ).join('\n');
            }
        } else {
            text = JSON.stringify(result, null, 2);
        }
        appendMessage('assistant', text);
    }

    actionCreateNote.addEventListener('click', async function () {
        const title = prompt('Note title:');
        if (!title) return;
        const result = await executeTool('create_note', { title, body: '' });
        if (result) renderToolResult('create_note', result);
    });

    actionGetSelected.addEventListener('click', async function () {
        const result = await executeTool('get_selected_note', {});
        if (result) renderToolResult('get_selected_note', result);
    });

    actionListNotebooks.addEventListener('click', async function () {
        const result = await executeTool('list_notebooks', {});
        if (result) renderToolResult('list_notebooks', result);
    });

    // ── Save Chat to Note ──────────────────────────────────────────────────────
    function getChatText() {
        const msgs = chatMessages.querySelectorAll('.chat-msg .msg-bubble');
        const lines = [];
        msgs.forEach(function (bubble) {
            const parent = bubble.parentElement;
            const role = parent.classList.contains('msg-user') ? 'You' : 'AI';
            const span = bubble.querySelector('span');
            const text = span ? span.textContent : '';
            if (text.trim()) {
                lines.push('**' + role + ':** ' + text.trim());
            }
        });
        return lines.join('\n\n');
    }

    function generateChatTitle() {
        const msgs = chatMessages.querySelectorAll('.chat-msg.msg-user .msg-bubble span');
        for (var i = 0; i < msgs.length; i++) {
            var text = msgs[i].textContent.trim();
            if (text.length > 0) {
                var truncated = text.length > 60 ? text.substring(0, 57) + '…' : text;
                return 'Chat: ' + truncated;
            }
        }
        return 'Chat export - ' + new Date().toLocaleDateString();
    }

    function openSaveDialog() {
        saveChatTitle.value = generateChatTitle();
        saveChatNotebook.innerHTML = '<option value="" disabled selected>Loading notebooks…</option>';
        saveChatOverlay.style.display = 'flex';

        executeTool('list_notebooks', {}).then(function (result) {
            saveChatNotebook.innerHTML = '';
            if (result && result.notebooks && result.notebooks.length > 0) {
                saveChatNotebook.innerHTML = '<option value="">(none — save to default notebook)</option>';
                result.notebooks.forEach(function (nb) {
                    var opt = document.createElement('option');
                    opt.value = nb.id;
                    opt.textContent = nb.title;
                    saveChatNotebook.appendChild(opt);
                });
                saveChatNotebook.selectedIndex = 0;
            } else {
                saveChatNotebook.innerHTML = '<option value="">(no notebooks — save to default)</option>';
                saveChatNotebook.selectedIndex = 0;
            }
        });
    }

    function closeSaveDialog() {
        saveChatOverlay.style.display = 'none';
    }

    actionSaveChat.addEventListener('click', openSaveDialog);

    saveChatCancel.addEventListener('click', closeSaveDialog);

    saveChatOverlay.addEventListener('click', function (e) {
        if (e.target === saveChatOverlay) closeSaveDialog();
    });

    saveChatConfirm.addEventListener('click', async function () {
        var title = saveChatTitle.value.trim();
        if (!title) {
            appendErrorBubble('❌ Please enter a title for the note.');
            return;
        }
        var notebookId = saveChatNotebook.value || '';
        var body = getChatText();
        if (!body.trim()) {
            appendErrorBubble('❌ No messages to save.');
            closeSaveDialog();
            return;
        }
        closeSaveDialog();
        var result = await executeTool('create_note', {
            title: title,
            body: body,
            notebook_id: notebookId,
        });
        if (result) renderToolResult('create_note', result);
    });

    // ── Note list & picker ───────────────────────────────────────────────────
    async function loadNotesList() {
        try {
            const res = await webviewApi.postMessage({ type: 'get-notes-list' });
            if (res && res.ok) {
                allNotes = res.notes || [];
            }
        } catch (e) {
            console.error('AI Chat: failed to load notes list:', e);
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderChips() {
        attachedNotesEl.innerHTML = '';
        attachedNotes.forEach(function (note) {
            const chip = document.createElement('span');
            chip.className = 'note-chip';
            chip.innerHTML =
                '<span class="chip-icon">📄</span>' +
                '<span class="chip-title">' + escapeHtml(note.title) + '</span>' +
                '<button class="chip-remove" data-id="' + escapeHtml(note.id) + '" title="Remove">×</button>';
            chip.querySelector('.chip-remove').addEventListener('click', function () {
                detachNote(note.id);
            });
            attachedNotesEl.appendChild(chip);
        });
    }

    function attachNote(note) {
        if (attachedNotes.find(function (n) { return n.id === note.id; })) return;
        attachedNotes.push({ id: note.id, title: note.title });
        renderChips();
    }

    function detachNote(noteId) {
        attachedNotes = attachedNotes.filter(function (n) { return n.id !== noteId; });
        renderChips();
    }

    function renderPickerList(query) {
        const q = (query || '').toLowerCase().trim();
        const filtered = q
            ? allNotes.filter(function (n) { return n.title.toLowerCase().includes(q); })
            : allNotes;

        notePickerList.innerHTML = '';
        if (filtered.length === 0) {
            notePickerEmpty.style.display = 'block';
        } else {
            notePickerEmpty.style.display = 'none';
            filtered.slice(0, 18).forEach(function (note) {
                const li = document.createElement('li');
                li.className = 'note-picker-item';
                // Highlight query match in title
                if (q) {
                    const idx = note.title.toLowerCase().indexOf(q);
                    if (idx !== -1) {
                        li.innerHTML =
                            escapeHtml(note.title.substring(0, idx)) +
                            '<mark>' + escapeHtml(note.title.substring(idx, idx + q.length)) + '</mark>' +
                            escapeHtml(note.title.substring(idx + q.length));
                    } else {
                        li.textContent = note.title;
                    }
                } else {
                    li.innerHTML = '<span class="picker-note-icon">📄</span> ' + escapeHtml(note.title);
                }
                li.addEventListener('mousedown', function (e) {
                    e.preventDefault(); // prevent textarea blur
                    selectPickerNote(note);
                });
                notePickerList.appendChild(li);
            });
        }
    }

    function openNotePicker(mode, query) {
        pickerMode = mode;
        notePickerEl.style.display = 'flex';
        if (mode === 'attach') {
            notePickerSearch.value = query || '';
            setTimeout(function () { notePickerSearch.focus(); }, 0);
        }
        // Lazy-load notes if the list is still empty (initial load may have raced)
        if (allNotes.length === 0) {
            notePickerList.innerHTML = '<li class="note-picker-item" style="opacity:0.5">Loading notes…</li>';
            notePickerEmpty.style.display = 'none';
            loadNotesList().then(function () { renderPickerList(query || ''); });
        } else {
            renderPickerList(query || '');
        }
    }

    function closeNotePicker() {
        notePickerEl.style.display = 'none';
        pickerMode = null;
        atMentionStart = -1;
    }

    function selectPickerNote(note) {
        if (pickerMode === 'mention') {
            // Remove the @query text (from atMentionStart to current cursor position)
            const val = chatInput.value;
            const cursorPos = chatInput.selectionStart;
            chatInput.value = val.substring(0, atMentionStart) + val.substring(cursorPos);
            chatInput.selectionStart = atMentionStart;
            chatInput.selectionEnd = atMentionStart;
        }
        attachNote(note);
        closeNotePicker();
        chatInput.focus();
    }

    // ── Attach button ────────────────────────────────────────────────────────
    attachBtn.addEventListener('click', function () {
        if (notePickerEl.style.display !== 'none' && pickerMode === 'attach') {
            closeNotePicker();
            chatInput.focus();
        } else {
            openNotePicker('attach', '');
        }
    });

    // ── Note picker search box ───────────────────────────────────────────────
    notePickerSearch.addEventListener('input', function () {
        renderPickerList(notePickerSearch.value);
    });

    notePickerSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeNotePicker();
            chatInput.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            var first = notePickerList.querySelector('.note-picker-item');
            if (first) first.focus();
        }
    });

    // Allow keyboard navigation within the picker list
    notePickerList.addEventListener('keydown', function (e) {
        var items = Array.from(notePickerList.querySelectorAll('.note-picker-item'));
        var idx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (idx < items.length - 1) items[idx + 1].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (idx > 0) items[idx - 1].focus();
            else notePickerSearch.focus();
        } else if (e.key === 'Enter' && idx !== -1) {
            e.preventDefault();
            items[idx].dispatchEvent(new MouseEvent('mousedown'));
        } else if (e.key === 'Escape') {
            closeNotePicker();
            chatInput.focus();
        }
    });

    // Make picker items focusable for keyboard nav
    notePickerList.setAttribute('tabindex', '-1');

    // Close attach-mode picker when clicking outside it
    document.addEventListener('mousedown', function (e) {
        if (
            pickerMode === 'attach' &&
            !notePickerEl.contains(e.target) &&
            e.target !== attachBtn
        ) {
            closeNotePicker();
        }
    });

    // ── @ mention detection in the textarea ──────────────────────────────────
    chatInput.addEventListener('input', function () {
        if (isBusy) return;

        const val = chatInput.value;
        const pos = chatInput.selectionStart;
        const textBefore = val.substring(0, pos);

        // Walk backwards to find an unresolved @ that is at start-of-text or
        // preceded by whitespace, without a newline between it and the cursor.
        let foundAt = -1;
        for (let i = pos - 1; i >= 0; i--) {
            const ch = textBefore[i];
            if (ch === '\n') break;           // new line = no mention
            if (ch === '@') {
                if (i === 0 || /\s/.test(textBefore[i - 1])) {
                    foundAt = i;
                }
                break;
            }
        }

        if (foundAt !== -1) {
            const query = textBefore.substring(foundAt + 1);
            atMentionStart = foundAt;
            if (pickerMode !== 'mention') {
                openNotePicker('mention', query);
            } else {
                renderPickerList(query);
            }
        } else if (pickerMode === 'mention') {
            closeNotePicker();
        }
    });

    // ── Send chat message ────────────────────────────────────────────────────
    async function sendMessage() {
        if (isBusy) return;
        const text = chatInput.value.trim();
        if (!text) return;

        // Guard: API key not set
        if (!apiKeySet) {
            appendErrorBubble('⚠️ API key is not set for ' + getProviderLabel(currentProvider) + '. Please go to the Settings tab and save it first.');
            return;
        }

        // Snapshot attached notes and clear the input state
        const currentAttached = attachedNotes.slice();
        chatInput.value = '';
        attachedNotes = [];
        renderChips();
        closeNotePicker();

        appendMessage('user', text, { notes: currentAttached });
        setBusy(true);

        try {
            const response = await webviewApi.postMessage({
                type: 'chat',
                provider: currentProvider,
                message: text,
                history: chatHistory.slice(),
                attachedNoteIds: currentAttached.map(function (n) { return n.id; }),
            });

            setBusy(false);

            if (response && response.ok) {
                const reply = response.reply || '(no response)';
                appendMessage('assistant', reply);
                chatHistory.push({ role: 'user', content: text });
                chatHistory.push({ role: 'assistant', content: reply });
            } else {
                const errMsg = (response && response.error) ? response.error : 'Unknown error.';
                if (response && response.invalidApiKey) {
                    appendErrorBubble('❌ API key is not valid. Please check your ' + getProviderLabel(currentProvider) + ' API key in the Settings tab.');
                } else if (isInvalidKeyError(errMsg)) {
                    appendErrorBubble('❌ API key is not valid. Please check your ' + getProviderLabel(currentProvider) + ' API key in the Settings tab.');
                } else if (errMsg.toLowerCase().includes('no api key') || errMsg.toLowerCase().includes('not configured')) {
                    appendErrorBubble('⚠️ API key is not set for ' + getProviderLabel(currentProvider) + '. Please go to the Settings tab and save it first.');
                    apiKeySet = false;
                } else {
                    appendErrorBubble('❌ Error: ' + errMsg);
                }
            }
        } catch (e) {
            setBusy(false);
            appendErrorBubble('❌ Unexpected error: ' + (e.message || String(e)));
        }
    }

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ── Save settings ────────────────────────────────────────────────────────
    saveSettingsBtn.addEventListener('click', async function () {
        const key = apiKeyInput.value.trim();

        saveSettingsBtn.disabled = true;
        setStatus(settingsStatus, 'Saving…', false);

        try {
            const response = await webviewApi.postMessage({
                type: 'save-settings',
                provider: currentProvider,
                apiKey: key,
                oaiCompatProvider: currentOACompatProvider,
                oaiBaseUrl: currentOABaseUrl,
                oaiModel: currentOAModel,
            });

            if (response && response.ok) {
                if (key) {
                    if (currentProvider === 'gemini') hasGeminiApiKey = true;
                    else if (currentProvider === 'openai_compat') hasOACompatApiKey = true;
                    else hasCohereApiKey = true;
                }
                refreshSelectedProviderState();
                apiKeyInput.value = '';
                setStatus(settingsStatus, '✅ ' + getProviderLabel(currentProvider) + ' settings saved successfully!', false, true);
            } else {
                const errMsg = (response && response.error) ? response.error : 'Failed to save settings.';
                setStatus(settingsStatus, '❌ ' + errMsg, true);
            }
        } catch (e) {
            setStatus(settingsStatus, '❌ Unexpected error: ' + (e.message || String(e)), true);
        } finally {
            saveSettingsBtn.disabled = false;
        }
    });

    providerSelect.addEventListener('change', function () {
        currentProvider = providerSelect.value;
        updateProviderUi();
    });

    oaiCompatProviderSelect.addEventListener('change', function () {
        currentOACompatProvider = oaiCompatProviderSelect.value;
        const isCustom = currentOACompatProvider === 'custom';
        oaiBaseUrlGroup.style.display = isCustom ? 'block' : 'none';
        oaiModelGroup.style.display = isCustom ? 'block' : 'none';
        const presetMap = {
            deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
            kimi:     { baseUrl: 'https://api.moonshot.cn',   model: 'moonshot-v1-128k' },
            grok:     { baseUrl: 'https://api.x.ai',           model: 'grok-2' },
            openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat-v3' },
            custom:   { baseUrl: currentOABaseUrl, model: currentOAModel },
        };
        const preset = presetMap[currentOACompatProvider] || presetMap.custom;
        currentOABaseUrl = preset.baseUrl;
        currentOAModel = preset.model;
        oaiBaseUrlInput.value = currentOABaseUrl;
        oaiModelInput.value = currentOAModel;
        updateProviderUi();
    });

    // ── Load initial state ───────────────────────────────────────────────────
    async function init() {
        try {
            const response = await webviewApi.postMessage({ type: 'load-settings' });
            if (response) {
                currentProvider = response.provider === 'gemini' ? 'gemini' :
                                  response.provider === 'openai_compat' ? 'openai_compat' : 'cohere';
                hasCohereApiKey = !!response.hasCohereApiKey;
                hasGeminiApiKey = !!response.hasGeminiApiKey;
                hasOACompatApiKey = !!response.hasOACompatApiKey;
                currentOACompatProvider = response.oaiCompatProvider || 'deepseek';
                currentOABaseUrl = response.oaiBaseUrl || 'https://api.deepseek.com';
                currentOAModel = response.oaiModel || 'deepseek-chat';
                updateProviderUi();
            } else {
                apiKeySet = false;
                updateProviderUi();
            }

            // Show a prompt in chat to configure the selected provider key
            if (!apiKeySet) {
                const welcome = chatMessages.querySelector('.welcome-msg');
                if (welcome) {
                    const notice = document.createElement('p');
                    notice.className = 'welcome-sub api-warning';
                    notice.innerHTML = '⚠️ <strong>No API key set for ' + getProviderLabel(currentProvider) + '.</strong> Go to the <strong>Settings</strong> tab to add it.';
                    welcome.appendChild(notice);
                }
            }
        } catch (e) {
            console.error('AI Chat init error:', e);
        }

        // Load notes list for the picker (non-blocking)
        await loadNotesList();

        // Seed the initial footer height so messages aren't hidden behind it
        chatMessages.style.bottom = chatFooter.offsetHeight + 'px';
    }

    init();
})();
