// Frontend Service: src/services/gemini.ts

type ChatHistoryMessage = {
  role: 'user' | 'assistant' | 'model';
  parts?: { text?: string }[];
  text?: string;
  content?: string;
};

type ChatStreamOptions = {
  onToken?: (chunk: string) => void;
};

function normalizeHistory(history: ChatHistoryMessage[] = []) {
  return history.slice(-8).flatMap((item) => {
    const role = item.role === 'model' ? 'assistant' : item.role;
    const text = item.parts?.[0]?.text || item.text || item.content || '';
    if (!text.trim()) return [];
    return [{ role, content: text }];
  });
}

export async function chatWithGemini(message: string, history: ChatHistoryMessage[], options: ChatStreamOptions = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  try {
    const normalizedHistory = normalizeHistory(history);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({ message, history: normalizedHistory }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return { text: data.text || 'Desculpe, tive um problema ao processar sua resposta.' };
    }

    if (!response.body) {
      const text = await response.text();
      return { text: text || 'Desculpe, tive um problema ao processar sua resposta.' };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          fullText += chunk;
          options.onToken?.(chunk);
        }
      }
      fullText += decoder.decode();
    } finally {
      reader.releaseLock();
    }

    return { text: fullText || 'Desculpe, tive um problema ao processar sua resposta.' };
  } catch (error) {
    console.error('Frontend Chat Error:', error);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function researchTopic(topic: string) {
  try {
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.text || 'Erro na pesquisa.',
      sources: data.sources || [],
    };
  } catch (error) {
    console.error('Frontend Research Error:', error);
    throw error;
  }
}
