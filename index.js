import { ready } from 'https://lsong.org/scripts/dom/index.js';
import { query } from 'https://lsong.org/scripts/query.js';
import { parse } from 'https://lsong.org/scripts/marked.js';
import { sample } from 'https://lsong.org/scripts/array.js';
import { OpenAI, Configuration } from './openai.js';

const {
  user = '',
  system = '',
  assistant = '',
} = query;

const apiKeys = [
  "086290c607e5420a5912536d219ced1f2b84327a94ca6ce0156983a5e11dee7f",
  "108d029e3b985ca7f1ded346cfc5474c8f73efaf18509699fbba951395a26307",
  "29382dc2ebd951d9ecaa425dcc746c3c5669e9a808461027f2f76c8a6dbc9ea9",
  "4227981450052530c0edf6418ce5596aa66ea93a3605d480366970c6111ea537",
  "5b588423b57a937c0aa6db21b5434634ed55ff3c7f51c528297e8d1f0a7b8dad",
  "63b40bfa60cf41afea3d6890a57df75d735f1a99fd7f4c02561cf1f6389901c9",
  "65fc4e4ac25c261d541938a01e5c981b1bcea9bda7f0dadd83e87c450153e2ea",
  "6d7fdc964cd7acb611747e995e4b965bdd662a90e3d165a64233f77eaadfc13d",
  "758e0717572c6edc458d2c0c79f210f6686e5e8faf414682c978888ea12c14bc",
  "7cb98894020c65079d0d0dc3f72142ac6b89e45c5a969cd086b1b3c40c94929a",
  "a8488b678076d25f2df9bc914d3121680cc334f07518b925d270660348024574",
  "b8be14c1f7135f45e18e1ee378beb65f7191c37831c97a46fe6d0cded46c5aa7",
  "d5bce776f8db8f28270eebf252ee5647e67634c8c29ff8cdac73cc2b15794b8b",
];

const providers = {
  azure: {
    name: 'Azure OpenAI',
    api: 'https://oai.lsong.org/v1',
    apiKey: ('c97f2b499aeb46eb' + 'be29aef5a2052906'),
  },
  openrouter: {
    name: 'OpenRouter',
    api: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-v1-' + sample(apiKeys, 1),

  },
  ollama: {
    name: 'Ollama',
    api: 'https://ollama.lsong.org/v1',
    apiKey: '',
  },
  // openai: {
  //   name: 'OpenAI',
  //   api: 'https://openai.lsong.org/v1',
  //   apiKey: 'sk-proj-' + 'ZVrIQAmhA-d5OZPgSlABepKV5zgcR6rRR0A2vKnO8O76X1nZpQD2YIWfUXxRYOECIiWGXTPZEvT3BlbkFJVw-SkbV23QJwwYNcZU3-qjUlirtO5SLSVTHvsKCZyOZCdJ9IOhJsnhS8hfHdYkAxRRnAB27i0A'
  // },
};

console.log('providers', providers);

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
  userInput.value = '';
  if (!userContent) return;  // Prevent empty messages

  await appendMessage('user', userContent);

  const selectedModel = modelsSelect.value;
  const [selectedProvider, model] = selectedModel.split(':');
  const temperature = parseFloat(temperatureInput.value) || 1.0;
  try {
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
      if (chunk.error && chunk.error.code != 0) {
        throw new Error(chunk.error.message);
      }
      const content = chunk.choices[0]?.delta?.content || '';
      assistantMessage.innerHTML = parse(history[history.length - 1].content += content);
    }
  } catch (err) {
    console.error(err);
    const messageElement = createMessageElement('system', err.message);
    messageList.appendChild(messageElement);
    history.pop(); // revert the user content to input element
    userInput.value = userContent;
  }
  userInput.focus();
}

async function populateModels() {
  for (const provider of Object.keys(providers)) {
    const openai = new OpenAI({
      api: providers[provider].api,
      apiKey: providers[provider].apiKey,
    })
    const models = await openai.getModels();
    const selected = modelsSelect.getAttribute('selected');
    console.log(selected);
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = `${provider}:${model.id}`;
      option.textContent = `${providers[provider].name} - ${model.id}`;
      option.selected = selected == option.value;
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
    history.push({ role: 'system', content: role.prompt });
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