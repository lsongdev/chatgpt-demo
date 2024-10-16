import { ready } from 'https://lsong.org/scripts/dom/index.js';
import { query } from 'https://lsong.org/scripts/query.js';
import { parse } from 'https://lsong.org/scripts/marked.js';
import { OpenAI, Configuration } from './openai.js';

const {
  user = '',
  system = '',
  assistant = '',
} = query;

const providers = {
  openai: {
    name: 'OpenAI',
    api: 'https://oai.lsong.org/v1',
    apiKey: ('c97f2b499aeb46eb' + 'be29aef5a2052906'),
  },
  ollama: {
    name: 'Ollama',
    api: 'https://ollama.lsong.org/v1',
    apiKey: '',
  }
};

const history = [];

// DOM Elements
let form, systemInput, userInput, messageList, modelsSelect, temperatureInput, rolesSelect;

// Helper Functions
function createMessageElement(role, content) {
  const messageElement = document.createElement('li');
  messageElement.className = `message-role-${role}`;
  messageElement.innerHTML = parse(content);
  return messageElement;
}

async function appendMessage(role, content) {
  const messageElement = createMessageElement(role, content);
  messageList.appendChild(messageElement);
  history.push({ role, content });
  return messageElement;
};

const clearHistory = () => {
  history.length = 0;
  messageList.innerHTML = '';
};

async function handleSend() {
  if (history.length === 0 && systemInput.value) {
    await appendMessage('system', systemInput.value);
  }
  const userContent = userInput.value.trim();
  if (!userContent) return;  // Prevent empty messages

  await appendMessage('user', userContent);

  const selectedModel = modelsSelect.value;
  const [selectedProvider, model] = selectedModel.split(':');
  const temperature = parseFloat(temperatureInput.value) || 1.0;
  const configuration = new Configuration({
    api: providers[selectedProvider].api,
    apiKey: providers[selectedProvider].apiKey,
  });
  const openai = new OpenAI(configuration);
  const response = await openai.createChatCompletion({
    model,
    messages: history,
    temperature,
    stream: true,
  });
  const assistantMessage = await appendMessage('assistant', '');
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || '';
    assistantMessage.innerHTML = parse(history[history.length - 1].content += content);
  }
  userInput.value = '';
  userInput.focus();
}

async function populateModels() {
  for (const provider of Object.keys(providers)) {
    const openai = new OpenAI({
      api: providers[provider].api,
      apiKey: providers[provider].apiKey,
    })
    const models = await openai.getModels();
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = `${provider}:${model.id}`;
      option.textContent = `${providers[provider].name} - ${model.id}`;
      modelsSelect.appendChild(option);
    });
  }
}

const populateRoles = async () => {
  const response = await fetch('./roles.json');
  const roles = await response.json();
  for (const key of Object.keys(roles)) {
    const role = roles[key];
    const option = document.createElement('option');
    option.value = key;
    option.textContent = role.name;
    rolesSelect.appendChild(option);
  }
  rolesSelect.addEventListener('change', () => {
    const role = roles[rolesSelect.value];
    if (!role) {
      systemInput.value = '';
      return
    }
    clearHistory();
    systemInput.value = role.prompt_start;
    appendMessage('system', role.prompt_start);
    appendMessage('assistant', role.welcome_message);
  });
};

async function initializeChat() {
  await populateModels();
  await populateRoles();
  if (system) {
    systemInput.value = system;
    await appendMessage('system', system);
  }
  if (assistant) {
    await appendMessage('assistant', assistant);
  }
  if (user) {
    userInput.value = user;
    await handleSend();
  }
}

// Main Function
ready(async () => {
  // Initialize DOM elements
  form = document.getElementById('form');
  systemInput = document.getElementById('system');
  userInput = document.getElementById('user');
  messageList = document.getElementById('messages');
  modelsSelect = document.getElementById('models');
  temperatureInput = document.getElementById('temperature');
  rolesSelect = document.getElementById('roles');

  // Set up event listeners
  form.addEventListener('submit', async e => {
    e.preventDefault();
    await handleSend();
  });

  // Initialize chat
  await initializeChat();
});