import { useSettingsStore } from '@/src/store/settings';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  fetchModels: async (): Promise<{ id: string; name: string }[]> => {
    const { aiBaseUrl, aiApiKey } = useSettingsStore.getState();
    if (!aiBaseUrl || !aiApiKey) throw new Error('AI credentials not configured');

    const isAnthropic = aiBaseUrl.includes('anthropic.com');
    // Anthropic doesn't have a simple models endpoint in the same way, but we'll try the openai compatible one for others
    if (isAnthropic) {
      return [{ id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }, { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' }, {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'}];
    }
    
    // Default to OpenAI compatible /models
    const cleanBaseUrl = aiBaseUrl.endsWith('/') ? aiBaseUrl.slice(0, -1) : aiBaseUrl;
    let url = `${cleanBaseUrl}/models`;
    if (aiBaseUrl.includes('openai.com') && !aiBaseUrl.includes('/v1')) {
      url = `${cleanBaseUrl}/v1/models`;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${aiApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => ({ id: m.id, name: m.id }));
      }
      return [];
    } catch(err) {
       console.error("Failed model fetch, returning fallback", err);
       return [];
    }
  },

  chatCompletion: async (messages: AIMessage[]): Promise<string> => {
    const { aiBaseUrl, aiApiKey, aiModel } = useSettingsStore.getState();
    const isAnthropic = aiBaseUrl.includes('anthropic.com');
    const cleanBaseUrl = aiBaseUrl.endsWith('/') ? aiBaseUrl.slice(0, -1) : aiBaseUrl;

    if (isAnthropic) {
      // Anthropic format
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const userMessages = messages.filter(m => m.role !== 'system');
      
      const response = await fetch(`${cleanBaseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': aiApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'anthropic-dangerously-allow-browser': 'true' // Required for client side calls
        },
        body: JSON.stringify({
          model: aiModel || 'claude-3-5-sonnet-20240620',
          max_tokens: 4096,
          system: systemMessage,
          messages: userMessages,
        })
      });
      if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);
      const data = await response.json();
      return data.content[0].text;
    }

    // Default OpenAI structure
    let url = `${cleanBaseUrl}/chat/completions`;
    if (aiBaseUrl.includes('openai.com') && !aiBaseUrl.includes('/v1')) {
      url = `${cleanBaseUrl}/v1/chat/completions`;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages,
      }),
    });
    
    if (!response.ok) throw new Error(`AI Api error: ${await response.text()}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }
};
