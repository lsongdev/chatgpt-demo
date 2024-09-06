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
    const response = await fetch(`${this.config.api}/models`);
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
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    if (!stream) return response.json();

    const reader = response.body.getReader();
    async function* parseOpenAILines(reader) {
      for await (let line of readLines(reader)) {
        line = line.replace(/^data: /, '');
        if (line === '[DONE]') return;
        yield JSON.parse(line);
      }
    }
    return parseOpenAILines(reader);
  }
}
