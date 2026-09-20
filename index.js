import { h, render } from 'https://esm.sh/preact@10.27.2';
import { useEffect, useRef, useState } from 'https://esm.sh/preact@10.27.2/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import { OpenAI } from './openai.js';
import { createConversation, loadState, saveState, uid } from './store.js';

const html = htm.bind(h);

function route() {
  const hash = location.hash || '#/';
  if (hash === '#/settings') return { page: 'settings' };
  const match = hash.match(/^#\/chat\/([^/]+)$/);
  return match ? { page: 'chat', id: match[1] } : { page: 'home' };
}

const titleFrom = text => text.trim().replace(/\s+/g, ' ').slice(0, 48) || 'New chat';

function App() {
  const [state, setState] = useState(loadState);
  const [locationState, setLocationState] = useState(route);

  useEffect(() => {
    const onHash = () => setLocationState(route());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => saveState(state), [state]);

  useEffect(() => {
    if (locationState.page !== 'home') return;
    const first = [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (first) location.hash = `#/chat/${first.id}`;
    else {
      const conversation = createConversation(state.profiles[0]?.id || '');
      setState(value => ({ ...value, conversations: [conversation] }));
      location.hash = `#/chat/${conversation.id}`;
    }
  }, [locationState.page]);

  const createChat = () => {
    const conversation = createConversation(state.profiles[0]?.id || '');
    setState(value => ({ ...value, conversations: [conversation, ...value.conversations] }));
    location.hash = `#/chat/${conversation.id}`;
  };

  const removeChat = id => {
    setState(value => ({ ...value, conversations: value.conversations.filter(item => item.id !== id) }));
    location.hash = '#/';
  };

  const updateConversation = (id, patch) => setState(value => ({
    ...value,
    conversations: value.conversations.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item),
  }));

  const chats = [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const current = locationState.page === 'chat' ? state.conversations.find(item => item.id === locationState.id) : null;

  useEffect(() => {
    if (locationState.page === 'chat' && !current) location.hash = '#/';
  }, [locationState.page, locationState.id, state.conversations.length]);

  return html`
    <div class="app">
      <aside class="sidebar">
        <div class="toolbar">
          <strong>ChatGPT Demo</strong>
          <button type="button" onClick=${createChat}>New</button>
        </div>
        <nav aria-label="Conversations">
          ${chats.map(chat => html`
            <a href=${`#/chat/${chat.id}`} aria-current=${current?.id === chat.id ? 'page' : undefined}>${chat.title}</a>
          `)}
          <hr />
          <a href="#/settings" aria-current=${locationState.page === 'settings' ? 'page' : undefined}>Settings</a>
        </nav>
      </aside>
      <main>
        ${locationState.page === 'settings'
          ? html`<${Settings} state=${state} setState=${setState} />`
          : current
            ? html`<${Chat} conversation=${current} profiles=${state.profiles} mcpServers=${state.mcpServers} update=${updateConversation} remove=${removeChat} />`
            : html`<p>Loading…</p>`}
      </main>
    </div>
  `;
}

function Chat({ conversation, profiles, mcpServers, update, remove }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const abortRef = useRef();
  const profile = profiles.find(item => item.id === conversation.profileId) || profiles[0];
  const model = conversation.model || profile?.model || '';

  useEffect(() => {
    if (!conversation.profileId && profile) update(conversation.id, { profileId: profile.id });
  }, [conversation.id, conversation.profileId, profile?.id]);

  const send = async event => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy || !profile) return;
    if (!model) {
      location.hash = '#/settings';
      return;
    }

    const userMessage = { id: uid(), role: 'user', content };
    const assistantMessage = { id: uid(), role: 'assistant', content: '' };
    const existing = conversation.messages;
    const messages = [...existing, userMessage, assistantMessage];
    setDraft('');
    setBusy(true);
    setStatus('Thinking…');
    update(conversation.id, {
      title: existing.length ? conversation.title : titleFrom(content),
      messages,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const client = new OpenAI(profile);
      await client.chat({
        model,
        system: conversation.system,
        messages: [...existing, userMessage].map(({ role, content }) => ({ role, content })),
        mcpServers,
        signal: controller.signal,
        onDelta: (_delta, full) => {
          update(conversation.id, {
            messages: [...existing, userMessage, { ...assistantMessage, content: full }],
          });
        },
        onStatus: setStatus,
        approve: request => Promise.resolve(confirm(
          `${request.server_label || 'MCP'} wants to call ${request.name || 'a tool'}:\n\n${request.arguments || ''}\n\nAllow this call?`
        )),
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        update(conversation.id, {
          messages: [...existing, userMessage, { ...assistantMessage, content: `Error: ${error.message}` }],
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStatus('');
    }
  };

  if (!profile) return html`<p>No API profile configured. <a href="#/settings">Open Settings</a>.</p>`;

  return html`
    <section>
      <div class="toolbar">
        <h1>${conversation.title}</h1>
        <button class="danger" type="button" onClick=${() => confirm('Delete this conversation?') && remove(conversation.id)}>Delete</button>
      </div>

      <div class="row">
        <label class="grow">API
          <select value=${profile.id} onChange=${event => update(conversation.id, { profileId: event.currentTarget.value, model: '' })}>
            ${profiles.map(item => html`<option value=${item.id}>${item.name}</option>`)}
          </select>
        </label>
        <label class="grow">Model
          <input type="text" value=${model} placeholder="Configure a model in Settings" onInput=${event => update(conversation.id, { model: event.currentTarget.value })} />
        </label>
      </div>

      <details>
        <summary>System prompt</summary>
        <textarea value=${conversation.system} placeholder="Optional instructions for this conversation" onInput=${event => update(conversation.id, { system: event.currentTarget.value })}></textarea>
      </details>

      <ol class="messages">
        ${conversation.messages.map(message => html`
          <li class=${`message message-${message.role}`} key=${message.id}>
            <header>${message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : message.role}</header>
            <div class="message-content">${message.content}</div>
          </li>
        `)}
      </ol>

      ${status && html`<p class="muted">${status}</p>`}
      <form onSubmit=${send}>
        <textarea autofocus value=${draft} placeholder="Send a message…" onInput=${event => setDraft(event.currentTarget.value)} onKeyDown=${event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}></textarea>
        <div class="toolbar">
          <small>${profile.mode === 'responses' ? 'Responses API' : 'Chat Completions'} · ${profile.api}</small>
          ${busy
            ? html`<button type="button" onClick=${() => abortRef.current?.abort()}>Stop</button>`
            : html`<button type="submit">Send</button>`}
        </div>
      </form>
    </section>
  `;
}

function Settings({ state, setState }) {
  const [models, setModels] = useState({});
  const [error, setError] = useState('');

  const updateProfile = (id, patch) => setState(value => ({
    ...value,
    profiles: value.profiles.map(item => item.id === id ? { ...item, ...patch } : item),
  }));

  const addProfile = () => setState(value => ({
    ...value,
    profiles: [...value.profiles, { id: uid(), name: 'API', api: '', apiKey: '', mode: 'chat', model: '' }],
  }));

  const removeProfile = id => setState(value => {
    if (value.profiles.length === 1) return value;
    const profiles = value.profiles.filter(item => item.id !== id);
    const fallback = profiles[0]?.id || '';
    return {
      ...value,
      profiles,
      conversations: value.conversations.map(chat => chat.profileId === id ? { ...chat, profileId: fallback, model: '' } : chat),
    };
  });

  const loadModels = async profile => {
    setError('');
    try {
      const data = await new OpenAI(profile).getModels();
      setModels(value => ({ ...value, [profile.id]: data.map(item => item.id || item.name || item).filter(Boolean) }));
    } catch (e) {
      setError(e.message);
    }
  };

  const updateMcp = (id, patch) => setState(value => ({
    ...value,
    mcpServers: value.mcpServers.map(item => item.id === id ? { ...item, ...patch } : item),
  }));

  const addMcp = () => setState(value => ({
    ...value,
    mcpServers: [...value.mcpServers, { id: uid(), name: 'MCP', url: '', authorization: '', approval: 'always', enabled: true }],
  }));

  return html`
    <section class="stack">
      <div class="toolbar">
        <h1>Settings</h1>
        <a href="#/">Back to chat</a>
      </div>
      <p class="muted">Configuration is stored only in this browser's localStorage. API and MCP servers must accept browser requests; do not use secrets here on a shared or untrusted device.</p>
      ${error && html`<p class="danger">${error}</p>`}

      <h2>API profiles</h2>
      ${state.profiles.map(profile => html`
        <fieldset key=${profile.id}>
          <legend>${profile.name || 'API'}</legend>
          <div class="stack">
            <label>Name <input type="text" value=${profile.name} onInput=${event => updateProfile(profile.id, { name: event.currentTarget.value })} /></label>
            <label>API base URL <input type="url" value=${profile.api} placeholder="https://api.openai.com/v1" onInput=${event => updateProfile(profile.id, { api: event.currentTarget.value })} /></label>
            <label>Secret <input type="password" value=${profile.apiKey} autocomplete="off" placeholder="Optional for local APIs" onInput=${event => updateProfile(profile.id, { apiKey: event.currentTarget.value })} /></label>
            <label>API mode
              <select value=${profile.mode} onChange=${event => updateProfile(profile.id, { mode: event.currentTarget.value })}>
                <option value="responses">Responses API (supports remote MCP)</option>
                <option value="chat">Chat Completions (widest compatibility)</option>
              </select>
            </label>
            <label>Default model
              <input list=${`models-${profile.id}`} type="text" value=${profile.model} placeholder="Model id" onInput=${event => updateProfile(profile.id, { model: event.currentTarget.value })} />
              <datalist id=${`models-${profile.id}`}>${(models[profile.id] || []).map(model => html`<option value=${model} />`)}</datalist>
            </label>
            <div class="row">
              <button type="button" onClick=${() => loadModels(profile)}>Load models</button>
              ${state.profiles.length > 1 && html`<button class="danger" type="button" onClick=${() => removeProfile(profile.id)}>Remove</button>`}
            </div>
          </div>
        </fieldset>
      `)}
      <button type="button" onClick=${addProfile}>Add API profile</button>

      <h2>Remote MCP</h2>
      <p class="muted">MCP is enabled only for profiles using the Responses API. Approval is requested before each tool call by default.</p>
      ${state.mcpServers.map(server => html`
        <fieldset key=${server.id}>
          <legend>${server.name || 'MCP'}</legend>
          <div class="stack">
            <label class="inline"><input type="checkbox" checked=${server.enabled !== false} onChange=${event => updateMcp(server.id, { enabled: event.currentTarget.checked })} /> Enabled</label>
            <label>Name <input type="text" value=${server.name} onInput=${event => updateMcp(server.id, { name: event.currentTarget.value })} /></label>
            <label>Server URL <input type="url" value=${server.url} placeholder="https://example.com/mcp" onInput=${event => updateMcp(server.id, { url: event.currentTarget.value })} /></label>
            <label>Authorization <input type="password" value=${server.authorization} autocomplete="off" placeholder="Optional OAuth/access token" onInput=${event => updateMcp(server.id, { authorization: event.currentTarget.value })} /></label>
            <label>Tool approval
              <select value=${server.approval || 'always'} onChange=${event => updateMcp(server.id, { approval: event.currentTarget.value })}>
                <option value="always">Ask every time</option>
                <option value="never">Auto approve</option>
              </select>
            </label>
            <button class="danger" type="button" onClick=${() => setState(value => ({ ...value, mcpServers: value.mcpServers.filter(item => item.id !== server.id) }))}>Remove MCP</button>
          </div>
        </fieldset>
      `)}
      <button type="button" onClick=${addMcp}>Add MCP server</button>
    </section>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
