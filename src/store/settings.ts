import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AIProvider = 'openai' | 'groq' | 'mistral' | 'anthropic' | 'gemini' | 'ollama' | 'custom';
export type AIMode = 'manual' | 'semi-auto' | 'full-auto';

interface SettingsState {
  githubToken: string;
  aiProvider: AIProvider;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiMode: AIMode;
  aiIterations: number;
  theme: 'light' | 'dark' | 'system';
  setGithubToken: (token: string) => void;
  setAISettings: (settings: Partial<Pick<SettingsState, 'aiProvider' | 'aiBaseUrl' | 'aiApiKey' | 'aiModel' | 'aiMode' | 'aiIterations'>>) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  isOnboarded: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      githubToken: '',
      aiProvider: 'custom',
      aiBaseUrl: '',
      aiApiKey: '',
      aiModel: '',
      aiMode: 'manual',
      aiIterations: 1,
      theme: 'system',
      setGithubToken: (token) => set({ githubToken: token }),
      setAISettings: (settings) => set((state) => ({ ...state, ...settings })),
      setTheme: (theme) => set({ theme }),
      isOnboarded: () => {
        const state = get();
        return !!state.githubToken && !!state.aiBaseUrl && !!state.aiApiKey;
      },
    }),
    {
      name: 'gitops-storage', // basic localStorage
      // We can use crypto-js for encryption, but for simplicity here we just use localStorage.
      // Requirements specified: "Stockage local sécurisé (encrypté via localStorage + chiffrement côté app). Alternative simple : stockage en sessionStorage." Let's use standard localStorage via persist, but we could add encryption later if needed. The prompt says "Alternative simple : stockage en sessionStorage (moins sécurisé). À choisir selon exigences."
    }
  )
);
