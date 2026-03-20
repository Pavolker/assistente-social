import fetch from 'node-fetch';

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { topic } = JSON.parse(event.body);

    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    const prompt = `Pesquise profundamente sobre o seguinte tema no contexto do Serviço Social brasileiro: ${topic}.
Forneça um resumo estruturado, pontos principais da legislação e referências importantes.`;
    const messages = [
      { role: 'system', content: 'Você é um pesquisador especializado em Serviço Social no Brasil.' },
      { role: 'user', content: prompt },
    ];

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not set in environment');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as any;
    const reply = data.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: reply, sources: [] }),
    };
  } catch (error) {
    console.error('Research error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
}
