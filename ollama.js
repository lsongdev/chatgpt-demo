import { parseJSONLines } from 'https://lsong.org/scripts/stream.js?v=1';

export class Ollama {
  /**
   * Creates an instance of Ollama.
   * @param {Object} config - The configuration for Ollama.
   * @param {string} config.host - The host URL for the API.
   * @param {string} [config.apiKey] - Optional API key for authentication.
   */
  constructor(config) {
    if (!config || !config.host) {
      throw new Error('Config with host is required');
    }
    this.config = config;
  }

  /**
   * Sends a request to the API.
   * @param {string} method - HTTP method ('GET', 'POST', etc.).
   * @param {string} path - API endpoint path.
   * @param {Object} [body] - Request payload.
   * @returns {Promise<Response>} - The Fetch API response object.
   */
  async request(method, path, body = null) {
    const { host, apiKey } = this.config;
    const url = `${host}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (apiKey) {
      options.headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (method !== 'GET' && body) {
      options.body = JSON.stringify(body);
    }
    return fetch(url, options);
  }

  async list() {
    const res = await this.request('GET', '/api/tags');
    const data = await res.json();
    return data.models;
  }

  /**
   * Generates a response using the API.
   * @param {Object} opts - Options for generation.
   * @returns {AsyncGenerator<Object, void, undefined>} - Async generator yielding JSON objects.
   */
  async *generate(opts) {
    const response = await this.request('POST', '/api/generate', opts);
    for await (const part of parseJSONLines(response.body.getReader())) {
      yield part;
    }
  }

  /**
   * Initiates a chat using the API.
   * @param {Object} opts - Options for the chat.
   * @returns {AsyncGenerator<Object, void, undefined>} - Async generator yielding JSON objects.
   */
  async *chat(opts) {
    const response = await this.request('POST', '/api/chat', opts);
    for await (const part of parseJSONLines(response.body.getReader())) {
      yield part;
    }
  }
}