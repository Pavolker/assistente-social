import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
    url: undefined,
    snippet: row.snippet || '',
    type: classifyDocumentType(row.filename, row.mime_type),
    source: 'local' as const,
    mime_type: row.mime_type,
    file_path: row.file_path,
    uploaded_at: row.uploaded_at,
  }));
}

export async function handler(event, context) {
  try {
    if (event.httpMethod === 'DELETE') {
      const id = event.path?.split('/').filter(Boolean).pop();
      if (!id) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing document id' }),
        };
      }

      const result = await pool.query('DELETE FROM documents WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Document not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    }

    if (event.httpMethod === 'GET' && event.path?.includes('/preview')) {
      const id = event.path?.split('/').filter(Boolean).slice(-2, -1)[0];
      if (!id) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing document id' }),
        };
      }

      const { rows } = await pool.query(
        'SELECT id, filename, mime_type, size_bytes, uploaded_at, file_path FROM documents WHERE id = $1',
        [id]
      );
      if (rows.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Document not found' }),
        };
      }

      const doc = rows[0];
      const chunks = await pool.query(
        'SELECT content FROM doc_chunks WHERE document_id = $1 ORDER BY chunk_index ASC LIMIT 3',
        [id]
      );
      const previewText = chunks.rows.map((row: any) => row.content).join('\n\n').trim();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          filename: doc.filename,
          mime_type: doc.mime_type,
          size_bytes: doc.size_bytes,
          uploaded_at: doc.uploaded_at,
          file_path: doc.file_path,
          previewText: previewText || 'Sem conteúdo de pré-visualização disponível.',
          hasContent: chunks.rows.length > 0,
        }),
      };
    }

    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const q = typeof event.queryStringParameters?.q === 'string' ? event.queryStringParameters.q.trim() : '';
    if (!q) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await searchLocalDocuments('')),
      };
    }

    const [localDocuments, webResults] = await Promise.all([
      searchLocalDocuments(q),
      searchWebDocuments(q).catch((error) => {
        console.error('Web search error:', error);
        return [];
      }),
    ]);

    const results = [...localDocuments, ...webResults];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, results, localDocuments, webResults }),
    };
  } catch (error) {
    console.error('Get documents error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
