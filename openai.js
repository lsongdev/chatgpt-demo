async function parseError(response) {
  const fallback = `${response.status} ${response.statusText}`.trim();
  try {
    const data = await response.json();
    return new Error(data.error?.message || data.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

async function* readSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n');
      if (!data || data === '[DONE]') continue;
      yield JSON.parse(data);
    }
    if (done) break;
  }
}

export class OpenAI {
  constructor(profile) {
    this.profile = profile;
  }

  get headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.profile.apiKey) headers.Authorization = `Bearer ${this.profile.apiKey}`;
    return headers;
  }

  async request(path, options = {}) {
    const api = this.profile.api.replace(/\/$/, '');
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });
    if (!response.ok) throw await parseError(response);
    return response;
  }

  async getModels(signal) {
    const response = await this.request('/models', { signal });
    const data = await response.json();
    return data.data || data.models || [];
  }

  async chat({ model, system, messages, mcpServers = [], signal, onDelta, onStatus, approve }) {
    if (this.profile.mode === 'responses') {
      return this.responses({ model, system, messages, mcpServers, signal, onDelta, onStatus, approve });
    }
    return this.chatCompletions({ model, system, messages, signal, onDelta });
  }

  async chatCompletions({ model, system, messages, signal, onDelta }) {
    const input = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const response = await this.request('/chat/completions', {
      method: 'POST',
      signal,
      body: JSON.stringify({ model, messages: input, stream: true }),
    });

    let text = '';
    for await (const event of readSSE(response.body)) {
      const delta = event.choices?.[0]?.delta?.content || '';
      if (!delta) continue;
      text += delta;
      onDelta?.(delta, text);
    }
    return text;
  }

  async responses({ model, system, messages, mcpServers, signal, onDelta, onStatus, approve }) {
    const tools = mcpServers
      .filter(server => server.enabled !== false && server.url)
      .map((server, index) => ({
        type: 'mcp',
        server_label: server.name || `mcp_${index + 1}`,
        server_url: server.url,
        ...(server.authorization ? { authorization: server.authorization } : {}),
        require_approval: server.approval === 'never' ? 'never' : 'always',
      }));

    let input = messages;
    let previousResponseId;
    let text = '';

    while (true) {
      const body = {
        model,
        input,
        stream: true,
        ...(system ? { instructions: system } : {}),
        ...(tools.length ? { tools } : {}),
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      };
      const response = await this.request('/responses', {
        method: 'POST',
        signal,
        body: JSON.stringify(body),
      });

      const approvals = [];
      let responseId = previousResponseId;

      for await (const event of readSSE(response.body)) {
        if (event.type === 'response.output_text.delta') {
          text += event.delta || '';
          onDelta?.(event.delta || '', text);
        } else if (event.type === 'response.output_item.done') {
          const item = event.item;
          if (item?.type === 'mcp_approval_request') approvals.push(item);
          if (item?.type === 'mcp_call') onStatus?.(`${item.server_label || 'MCP'} · ${item.name || 'tool'}`);
        } else if (event.type === 'response.completed') {
          responseId = event.response?.id || responseId;
        } else if (event.type === 'response.failed') {
          throw new Error(event.response?.error?.message || 'Response failed');
        } else if (event.type === 'error') {
          throw new Error(event.message || event.error?.message || 'Response failed');
        }
      }

      if (!approvals.length) return text;
      if (!responseId) throw new Error('MCP approval requested without a response id');

      input = await Promise.all(approvals.map(async request => ({
        type: 'mcp_approval_response',
        approval_request_id: request.id,
        approve: await approve?.(request) !== false,
      })));
      previousResponseId = responseId;
      onStatus?.('Continuing after MCP approval…');
    }
  }
}
