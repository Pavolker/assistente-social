function normalizeHistory(history = []) {
  return history.slice(-8).flatMap((item: any) => {
    const role = item.role === 'model' ? 'assistant' : item.role;
    const text = item.parts?.[0]?.text || item.text || item.content || '';
    if (!text.trim()) return [];
    if (role !== 'user' && role !== 'assistant') return [];
    return [{ role, content: text }];
  });
}

async function createOpenRouterStream(model: string, messages: any[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in environment');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 900,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    if (!response.body) {
      throw new Error('OpenRouter stream unavailable');
    }

    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controllerStream) {
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          for await (const chunk of response.body as any) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;

              try {
                const parsed = JSON.parse(payload) as any;
                const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
                if (delta) {
                  controllerStream.enqueue(encoder.encode(delta));
                }
              } catch {
                // Ignore malformed payloads and keep streaming.
              }
            }
          }

          const tail = buffer.trim();
          if (tail.startsWith('data:')) {
            const payload = tail.slice(5).trim();
            if (payload && payload !== '[DONE]') {
              try {
                const parsed = JSON.parse(payload) as any;
                const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
                if (delta) {
                  controllerStream.enqueue(encoder.encode(delta));
                }
              } catch {
                // Ignore malformed tail payloads.
              }
            }
          }

          controllerStream.close();
        } catch (error) {
          controllerStream.error(error);
        } finally {
          clearTimeout(timeout);
        }
      },
      cancel() {
        clearTimeout(timeout);
        controller.abort();
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { message, history } = await request.json();

    const model = process.env.OPENROUTER_CHAT_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    const systemPrompt = `Você é um Agente de IA especializado em Serviço Social no Brasil.
Seu objetivo é auxiliar a Flavia, uma assistente social dedicada, em seus estudos e prática profissional.
Seu tom deve ser profissional, empático, ético, objetivo e educativo.
Você domina temas como: Seguridade Social (Saúde, Assistência Social, Previdência), LOAS, ECA, Estatuto do Idoso, Estatuto da Pessoa com Deficiência, Ética Profissional, Projeto Ético-Político, e instrumentais técnico-operativos.
Responda de forma direta, com linguagem clara e respostas curtas quando possível.
Sempre cite legislações quando relevante e faça perguntas objetivas se faltar informação.
Responda em Português do Brasil.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...normalizeHistory(history || []),
      { role: 'user', content: message },
    ];

    const stream = await createOpenRouterStream(model, messages);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
