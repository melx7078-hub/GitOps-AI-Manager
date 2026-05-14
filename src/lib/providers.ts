import { AIProvider } from '@/src/store/settings';

export const AI_PROVIDERS: { id: AIProvider; name: string; defaultUrl: string }[] = [
  { id: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { id: 'groq', name: 'Groq', defaultUrl: 'https://api.groq.com/openai/v1' },
  { id: 'anthropic', name: 'Anthropic', defaultUrl: 'https://api.anthropic.com' },
  { id: 'mistral', name: 'Mistral', defaultUrl: 'https://api.mistral.ai/v1' },
  { id: 'gemini', name: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
  { id: 'ollama', name: 'Ollama', defaultUrl: 'http://localhost:11434/v1' },
  { id: 'custom', name: 'Custom (OpenAI Compatible)', defaultUrl: '' },
];
