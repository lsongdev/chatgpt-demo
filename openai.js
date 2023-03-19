import { readLines } from 'https://lsong.org/scripts/stream.js';

export class Configuration {
  constructor(config) {
    Object.assign(this, {
      api: 'https://api.openai.com/v1'
    }, config);
  }
}

export class OpenAI {
  constructor(config) {
    this.config = config;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      // 'OpenAI-Organization': config.organization,
      // 'OpenAI-Project': config.project,
    };
  }

  async getModels() {
    const response = await fetch(`${this.config.api}/models`, {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json(); 
    return data.data;
  }
  async createCompletion({ model, prompt, maxTokens, temperature }) {
    const url = `${this.config.api}/engines/${model}/completions`;
    const data = {
      prompt: prompt,
      max_tokens: maxTokens,
      temperature: temperature
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  }
  async createChatCompletion({ model, messages, stream = false, ...options }) {
    // https://platform.openai.com/docs/api-reference/introduction
    const response = await fetch(`${this.config.api}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model,
        stream,
        messages,
        ...options,
      })
    });

    if (!response.ok) {
      const { error } = await response.json();
      throw error;
    }

    if (!stream) return response.json();

    const reader = response.body.getReader();
    async function* parseOpenAILines(reader) {
      for await (let line of readLines(reader)) {
        const colmanIndex = line.indexOf(':');
        if (colmanIndex === -1) continue;
        const key = line.slice(0, colmanIndex);
        if (key !== 'data') continue;
        line = line.slice(colmanIndex + 1).trim();
        if (line === '[DONE]') return;
        yield JSON.parse(line);
      }
    }
    return parseOpenAILines(reader);
  }
}
