import { ready } from 'https://lsong.org/scripts/dom.js';
import { query } from 'https://lsong.org/scripts/query.js';
import { parse } from 'https://lsong.org/scripts/marked.js';
import { notify } from 'https://lsong.org/scripts/notification.js';
import { OpenAI, Configuration } from 'https://lsong.org/openai.js/index.js';
import { registerServiceWorker } from 'https://lsong.org/scripts/service-worker.js';
import { h, render, useState, useEffect, useRef } from 'https://lsong.org/scripts/react/index.js';

import 'https://lsong.org/js/application.js';

const DEFAULT_KEY = ('sk-' + 'mFgbWOgjrV62S155UbaNT3BlbkFJLnYe7YMcaDiRYN9XzzLR');

const {
  q,
  key = DEFAULT_KEY,
  role: qrole = 'assistant',
} = query;

const configuration = new Configuration({
  api: "https://openai.lsong.org",
  apiKey: key,
});

const model = 'gpt-3.5-turbo';
const openai = new OpenAI(configuration);

const roles = {
  assistant: {
    "name": "👩🏼‍🎓 Assistant",
    "welcome_message": "👩🏼‍🎓 Hi, I'm <b>ChatGPT assistant</b>. How can I help you?",
    "prompt_start": "As an advanced chatbot named ChatGPT, your primary goal is to assist users to the best of your ability. This may involve answering questions, providing helpful information, or completing tasks based on user input. In order to effectively assist users, it is important to be detailed and thorough in your responses. Use examples and evidence to support your points and justify your recommendations or solutions. Remember to always prioritize the needs and satisfaction of the user. Your ultimate goal is to provide a helpful and enjoyable experience for the user."
  },

  code_assistant: {
    "name": "👩🏼‍💻 Code Assistant",
    "welcome_message": "👩🏼‍💻 Hi, I'm <b>ChatGPT code assistant</b>. How can I help you?",
    "prompt_start": "As an advanced chatbot named ChatGPT, your primary goal is to assist users to write code. This may involve designing/writing/editing/describing code or providing helpful information. Where possible you should provide code examples to support your points and justify your recommendations or solutions. Make sure the code you provide is correct and can be run without errors. Be detailed and thorough in your responses. Your ultimate goal is to provide a helpful and enjoyable experience for the user. Write code inside html code tags."
  },

  text_improver: {
    "name": "📝 Text Improver",
    "welcome_message": "📝 Hi, I'm <b>ChatGPT text improver</b>. Send me any text – I'll improve it and correct all the mistakes",
    "prompt_start": "As an advanced chatbot named ChatGPT, your primary goal is to correct spelling, fix mistakes and improve text sent by user. Your goal is to edit text, but not to change it's meaning. You can replace simplified A0-level words and sentences with more beautiful and elegant, upper level words and sentences. All your answers strictly follows the structure (keep html tags):\n<b>Edited text:</b>\n{EDITED TEXT}\n\n<b>Correction:</b>\n{NUMBERED LIST OF CORRECTIONS}"
  },

  movie_expert: {
    "name": "🎬 Movie Expert",
    "welcome_message": "🎬 Hi, I'm <b>ChatGPT movie expert</b>. How can I help you?",
    "prompt_start": "As an advanced movie expert chatbot named ChatGPT, your primary goal is to assist users to the best of your ability. You can answer questions about movies, actors, directors, and more. You can recommend movies to users based on their preferences. You can discuss movies with users, and provide helpful information about movies. In order to effectively assist users, it is important to be detailed and thorough in your responses. Use examples and evidence to support your points and justify your recommendations or solutions. Remember to always prioritize the needs and satisfaction of the user. Your ultimate goal is to provide a helpful and enjoyable experience for the user."
  },
};

const Message = ({ message }) => {
  const previewRef = useRef();
  useEffect(() => {
    previewRef.current.innerHTML = parse(message.content);
  }, [previewRef, message]);
  return h('div', { className: 'preview' }, [
    h('span', null, message.role),
    h('div', { ref: previewRef, className: `message-content` }),
  ]);
};

export function useEffectDidMount(effect, deps = []) {
  const isMounted = useRef(false);
  useEffect(() => {
    if (isMounted.current) return effect();
    else isMounted.current = true;
    return () => isMounted.current = false;
  }, deps);
}

const App = () => {
  const [role, setRole] = useState(qrole);
  const [prompts, setPrompts] = useState('');
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    const system = {
      role: 'system',
      content: roles[role].prompt_start
    };
    setMessages([system]);
  }, [role]);
  useEffect(() => {
    q && sendMessage(q);
  }, []);
  const sendMessage = async prompts => {
    messages.push({
      role: 'user',
      content: prompts,
    });
    setMessages([...messages]);
    const response = await openai.createChatCompletion({
      model,
      messages,
    });
    console.log('response', response);
    const { message } = response.choices[0];
    setMessages([...messages, message]);
    notify(document.title, {
      icon: `icon-x512.png`,
      body: message.content,
    });
  };
  const handleSubmit = async e => {
    e.preventDefault();
    sendMessage(prompts);
    setPrompts('');
  };
  return [
    h('h2', null, "ChatGPT"),
    h('ul', { className: 'messages' }, [
      messages.map(message => h('li', null, h(Message, { message }))),
    ]),
    h('form', { className: "flex", onSubmit: handleSubmit }, [
      h('select', { onChange: e => setRole(e.target.value) }, [
        Object.entries(roles).map(([k, x]) => h('option', {
          value: k,
          selected: role === k ? 'selected' : ''
        }, x.name)),
      ]),
      h('input', {
        value: prompts,
        className: "input",
        placeholder: "Enter something...",
        onInput: e => setPrompts(e.target.value),
      }),
      h('button', { className: "button button-primary" }, "Send"),
    ]),
    h('p', { className: 'copyright' }, `Based on OpenAI API (${model}).`)
  ]
}

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});

registerServiceWorker();
