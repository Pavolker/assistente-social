// Frontend Service: src/services/gemini.ts

export async function chatWithGemini(message: string, history: any[]) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return { text: data.text || 'Desculpe, tive um problema ao processar sua resposta.' };
  } catch (error) {
    console.error('Frontend Chat Error:', error);
    throw error;
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
