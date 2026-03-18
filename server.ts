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

// Helper to call OpenRouter API
async function callOpenRouter(model: string, messages: any[]) {
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
  // OpenRouter returns choices[0].message.content
  return data.choices?.[0]?.message?.content || '';
}

// Chat endpoint – uses a system prompt for the assistant role
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  const model = process.env.OPENROUTER_MODEL || 'openrouter/anthropic/claude-3.5-sonnet';
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

  try {
    const reply = await callOpenRouter(model, messages);
    res.json({ text: reply });
  } catch (error: any) {
    console.error('Chat error:', error);
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
