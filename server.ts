import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import { Document, Packer } from 'docx';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for file uploads
const upload = multer({ dest: uploadsDir });

// PostgreSQL connection pool (Railway DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize database: extensions and tables
async function initDb() {
  try {
    // Extensions
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "vector";');

    // Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT,
        uploaded_at TIMESTAMPTZ DEFAULT now(),
        file_path TEXT NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doc_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ DB init error:', err);
    process.exit(1);
  }
}


const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'model';
  content?: string;
  parts?: { text?: string }[];
  text?: string;
};

function normalizeHistory(history: ChatMessage[] = []) {
  return history.slice(-8).flatMap((item) => {
    const role = item.role === 'model' ? 'assistant' : item.role;
    const text = item.content || item.parts?.[0]?.text || item.text || '';
    if (!text.trim()) return [];
    if (role !== 'user' && role !== 'assistant') return [];
    return [{ role, content: text }];
  });
}

async function streamOpenRouterChat(
  model: string,
  messages: any[],
  onToken: (chunk: string) => void,
  options: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in environment');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45000);
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
        max_tokens: options.maxTokens ?? 900,
        temperature: options.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    if (!response.body) {
      throw new Error('OpenRouter stream unavailable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    for await (const chunk of response.body as any) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(payload) as any;
          const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
          if (delta) {
            fullText += delta;
            onToken(delta);
          }
        } catch {
          // Ignore malformed SSE payloads and keep streaming.
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
            fullText += delta;
            onToken(delta);
          }
        } catch {
          // Ignore malformed tail payloads.
        }
      }
    }

    return fullText;
  } finally {
    clearTimeout(timeout);
  }
}

// Helper to call OpenRouter API
async function callOpenRouter(model: string, messages: any[], options: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in environment');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45000);
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
        max_tokens: options.maxTokens ?? 900,
        temperature: options.temperature ?? 0.3,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }
    const data = (await response.json()) as any;
    // OpenRouter returns choices[0].message.content
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

// Chat endpoint – uses a system prompt for the assistant role
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
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

  try {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    (res as any).flushHeaders?.();

    let started = false;
    const reply = await streamOpenRouterChat(model, messages, (chunk) => {
      started = true;
      res.write(chunk);
    }, { maxTokens: 900, temperature: 0.3 });

    if (!started) {
      res.end(reply);
      return;
    }

    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
      return;
    }
    res.end();
  }
});

app.get('/api/documents', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, filename, mime_type, size_bytes, uploaded_at, file_path FROM documents ORDER BY uploaded_at DESC'
    );
    res.json(rows.map((row: any) => ({
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      uploaded_at: row.uploaded_at,
      file_path: row.file_path,
    })));
  } catch (error: any) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.get('/api/documents/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'SELECT id, filename, mime_type, size_bytes, uploaded_at, file_path FROM documents WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = rows[0];
    const chunks = await pool.query(
      'SELECT content FROM doc_chunks WHERE document_id = $1 ORDER BY chunk_index ASC LIMIT 3',
      [id]
    );

    const previewText = chunks.rows.map((row: any) => row.content).join('\n\n').trim();
    res.json({
      id: doc.id,
      filename: doc.filename,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      uploaded_at: doc.uploaded_at,
      file_path: doc.file_path,
      previewText: previewText || 'Sem conteúdo de pré-visualização disponível.',
      hasContent: chunks.rows.length > 0,
    });
  } catch (error: any) {
    console.error('Document preview error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Document delete error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/api/save-research', async (req, res) => {
  try {
    const { query, result } = req.body;
    if (!query || !result) {
      return res.status(400).json({ error: 'Query and result are required' });
    }

    const docResult = await pool.query(
      `INSERT INTO documents (filename, mime_type, size_bytes, file_path)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [`research-${String(query).slice(0, 50)}.txt`, 'text/plain', String(result).length, 'research']
    );
    const docId = docResult.rows[0].id;

    const chunks = chunkText(String(result));
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      await pool.query(
        `INSERT INTO doc_chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4)`,
        [docId, i, chunks[i], JSON.stringify(embedding)]
      );
    }

    res.json({ success: true, documentId: docId });
  } catch (error: any) {
    console.error('Save research error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

function classifyDocumentType(urlOrName: string, mimeType?: string) {
  const value = `${urlOrName} ${mimeType || ''}`.toLowerCase();
  if (value.includes('pdf')) return 'pdf';
  return 'site';
}

function sanitizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ');
}

async function searchWebDocuments(query: string) {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Web search error ${response.status}`);
  }

  const html = await response.text();
  const results: Array<{ id: string; title: string; url?: string; snippet?: string; type: 'pdf' | 'site'; source: 'web' }> = [];
  const resultBlockRegex = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?<div class="b_caption"><p class="b_lineclamp2">([\s\S]*?)<\/p>/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = resultBlockRegex.exec(html)) !== null && results.length < 8) {
    const url = blockMatch[1].replace(/&amp;/g, '&');
    const title = blockMatch[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    const snippet = blockMatch[3]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    results.push({
      id: `web-${results.length + 1}`,
      title,
      url,
      snippet,
      type: url.toLowerCase().includes('.pdf') ? 'pdf' : 'site',
      source: 'web',
    });
  }

  return results;
}

async function searchLocalDocuments(query: string) {
  const searchTerm = `%${sanitizeSearchQuery(query).toLowerCase()}%`;
  const { rows } = await pool.query(
    `
      SELECT DISTINCT ON (d.id)
        d.id,
        d.filename,
        d.mime_type,
        d.file_path,
        d.uploaded_at,
        COALESCE(
          NULLIF(
            regexp_replace(
              substring(lower(c.content) from 1 for 240),
              E'\\s+',
              ' ',
              'g'
            ),
            ''
          ),
          ''
        ) AS snippet
      FROM documents d
      LEFT JOIN doc_chunks c ON c.document_id = d.id
      WHERE lower(d.filename) LIKE $1
         OR lower(c.content) LIKE $1
      ORDER BY d.id, d.uploaded_at DESC
      LIMIT 20
    `,
    [searchTerm]
  );

  return rows.map((row: any) => ({
    id: row.id,
    title: row.filename,
    url: row.file_path ? `/api/documents/${row.id}/download` : undefined,
    snippet: row.snippet || '',
    type: classifyDocumentType(row.filename, row.mime_type),
    source: 'local' as const,
    mime_type: row.mime_type,
    file_path: row.file_path,
    uploaded_at: row.uploaded_at,
  }));
}

app.get('/api/documents/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      const localDocuments = await searchLocalDocuments('');
      return res.json({ query: q, results: [], localDocuments });
    }

    const [localDocuments, webResults] = await Promise.all([
      searchLocalDocuments(q),
      searchWebDocuments(q).catch((error) => {
        console.error('Web search error:', error);
        return [];
      }),
    ]);

    const results = [...localDocuments, ...webResults];

    res.json({
      query: q,
      results,
      localDocuments,
      webResults,
    });
  } catch (error: any) {
    console.error('Document search error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT filename, file_path, mime_type FROM documents WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = rows[0];
    if (doc.file_path === 'research') {
      const contentResult = await pool.query(
        'SELECT content FROM doc_chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
        [id]
      );
      const text = contentResult.rows.map((row: any) => row.content).join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.filename || 'research.txt'}"`);
      return res.send(text);
    }

    if (!doc.file_path) {
      return res.status(404).json({ error: 'Document file unavailable' });
    }

    return res.download(doc.file_path, doc.filename);
  } catch (error: any) {
    console.error('Document download error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Research endpoint – similar but without a long history, just a user query
app.post('/api/research', async (req, res) => {
  const { topic } = req.body;
  const model = process.env.OPENROUTER_MODEL || 'openrouter/anthropic/claude-3.5-sonnet';
  const prompt = `Pesquise profundamente sobre o seguinte tema no contexto do Serviço Social brasileiro: ${topic}.
Forneça um resumo estruturado, pontos principais da legislação e referências importantes.`;
  const messages = [
    { role: 'system', content: 'Você é um pesquisador especializado em Serviço Social no Brasil.' },
    { role: 'user', content: prompt },
  ];
  try {
    const reply = await callOpenRouter(model, messages);
    // OpenRouter does not provide grounding metadata; we return empty sources array.
    res.json({ text: reply, sources: [] });
  } catch (error: any) {
    console.error('Research error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

/**
 * Helper: extract plain text from supported file types.
 */
async function extractText(filePath: string, mime: string): Promise<string> {
  if (mime === 'application/pdf') {
    const data = await fs.promises.readFile(filePath);
    // Correct usage for the new PDFParse ESM library:
    const parser = new PDFParse({ data });
    const result = await parser.getText();
    return result.text;
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mime === 'application/msword') {
    // DOCX parsing would require a specialized library like 'mammoth' or 'textract'.
    // For now, we return empty string to avoid crashes.
    return '';
  }
  // Fallback for txt and others
  return await fs.promises.readFile(filePath, 'utf8');
}

/**
 * Simple chunker – splits text into ~2000‑character pieces.
 */
function chunkText(text: string, size = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

/**
 * Call OpenRouter embeddings endpoint.
 * Returns a Float32Array of the embedding vector.
 */
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
      model: 'openrouter/anthropic/claude-3.5-sonnet', // adjust if you have a dedicated embedding model
      input: text,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding error ${response.status}: ${err}`);
  }
  const data = (await response.json()) as any;
  // Assuming response.data[0].embedding is an array of numbers
  return data.data[0].embedding;
}

/**
 * Endpoint: upload a document, extract text, chunk, embed, store.
 */
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { originalname, mimetype, size, filename } = file;
    const storedPath = path.resolve(uploadsDir, filename);

    // Extract text
    const rawText = await extractText(storedPath, mimetype);
    if (!rawText) return res.status(500).json({ error: 'Failed to extract text' });

    // Insert document metadata
    const docResult = await pool.query(
      `INSERT INTO documents (filename, mime_type, size_bytes, file_path)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [originalname, mimetype, size, storedPath]
    );
    const docId = docResult.rows[0].id;

    // Chunk and embed
    const chunks = chunkText(rawText);
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      await pool.query(
        `INSERT INTO doc_chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4)`,
        [docId, i, chunks[i], embedding]
      );
    }

    res.json({ success: true, documentId: docId, chunks: chunks.length });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * RAG query endpoint – retrieves top‑k similar chunks and sends them to the LLM.
 */
app.post('/api/rag/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    // Embed the query
    const queryEmbedding = await embedText(query);

    // Retrieve top‑k similar chunks (k=5)
    const { rows } = await pool.query(
      `SELECT content, embedding <=> $1 AS distance
       FROM doc_chunks
       ORDER BY distance ASC
       LIMIT 5`,
      [queryEmbedding]
    );
    const context = rows.map((r: any) => r.content).join('\n---\n');

    // Build RAG prompt
    const systemPrompt = `Você é um agente de IA especializado em Serviço Social no Brasil. Use o contexto abaixo para responder à pergunta do usuário.`;
    const ragPrompt = `${systemPrompt}\n\nContexto:\n${context}\n\nPergunta: ${query}`;
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: ragPrompt },
    ];
    const model = process.env.OPENROUTER_MODEL || 'openrouter/anthropic/claude-3.5-sonnet';
    const answer = await callOpenRouter(model, messages);

    res.json({ answer, sources: rows });
  } catch (err: any) {
    console.error('RAG query error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Notes endpoints - CRUD for study notes
 */

// Get all notes
app.get('/api/notes', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notes ORDER BY updated_at DESC'
    );
    res.json(rows);
  } catch (err: any) {
    console.error('Get notes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a single note by ID
app.get('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(rows[0]);
  } catch (err: any) {
    console.error('Get note error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new note
app.post('/api/notes', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    res.json(rows[0]);
  } catch (err: any) {
    console.error('Create note error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update an existing note
app.put('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const { rows } = await pool.query(
      'UPDATE notes SET title = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING *',
      [title, content, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(rows[0]);
  } catch (err: any) {
    console.error('Update note error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server after DB is ready
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
