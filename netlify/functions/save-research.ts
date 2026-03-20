import { Pool } from 'pg';
import fetch from 'node-fetch';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper to embed text
async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-ada-002',
      input: text,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding error ${response.status}: ${err}`);
  }
  const data = (await response.json()) as any;
  return data.data[0].embedding;
}

// Simple chunker
function chunkText(text: string, size = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { query, result } = JSON.parse(event.body);

    // Create a document entry for the research
    const docResult = await pool.query(
      `INSERT INTO documents (filename, mime_type, size_bytes, file_path)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [`research-${query.slice(0, 50)}.txt`, 'text/plain', result.length, 'research']
    );
    const docId = docResult.rows[0].id;

    // Chunk and embed the result
    const chunks = chunkText(result);
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      await pool.query(
        `INSERT INTO doc_chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4)`,
        [docId, i, chunks[i], JSON.stringify(embedding)]
      );
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, documentId: docId }),
    };
  } catch (error) {
    console.error('Save research error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
