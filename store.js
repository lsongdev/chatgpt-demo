const STORAGE_KEY = 'chatgpt-demo:v2';

export const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createConversation(profileId = '') {
  const now = Date.now();
  return {
    id: uid(),
    title: 'New chat',
    profileId,
    model: '',
    system: '',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function defaults() {
  const profile = {
    id: uid(),
    name: 'OpenAI',
    api: 'https://api.openai.com/v1',
    apiKey: '',
    mode: 'responses',
    model: '',
  };
  const conversation = createConversation(profile.id);
  return {
    profiles: [profile],
    mcpServers: [],
    conversations: [conversation],
  };
}

export function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value?.profiles?.length || !Array.isArray(value.conversations)) return defaults();
    return {
      profiles: value.profiles,
      mcpServers: Array.isArray(value.mcpServers) ? value.mcpServers : [],
      conversations: value.conversations,
    };
  } catch {
    return defaults();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
