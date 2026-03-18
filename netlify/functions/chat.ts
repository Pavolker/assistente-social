import fetch from 'node-fetch';

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { message, history } = JSON.parse(event.body);

    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    const systemPrompt = `Você é um Agente de IA especializado em Serviço Social no Brasil.
Seu objetivo é auxiliar a Flavia, uma assistente social dedicada, em seus estudos e prática profissional.
Seu tom deve ser profissional, empático, ético e educativo.
Você domina temas como: Seguridade Social (Saúde, Assistência Social, Previdência), LOAS, ECA, Estatuto do Idoso, Estatuto da Pessoa com Deficiência, Ética Profissional, Projeto Ético-Político, e instrumentais técnico-operativos.
Sempre cite legislações quando relevante.
Responda em Português do Brasil.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: message },
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

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: reply }),
    };
  } catch (error) {
    console.error('Chat error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
}