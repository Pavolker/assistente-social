import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function handler(event, context) {
  const { httpMethod, path, body } = event;
  const id = path.split('/').pop(); // Extract ID from path for single resource operations

  // GET all notes
  if (httpMethod === 'GET' && !id) {
    try {
      const { rows } = await pool.query('SELECT * FROM notes ORDER BY updated_at DESC');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      };
    } catch (error) {
      console.error('Get notes error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  // GET single note by ID
  if (httpMethod === 'GET' && id) {
    try {
      const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
      if (rows.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Note not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows[0]),
      };
    } catch (error) {
      console.error('Get note error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  // POST - Create new note
  if (httpMethod === 'POST') {
    try {
      const { title, content } = JSON.parse(body);
      if (!title || !content) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Title and content are required' }),
        };
      }
      const { rows } = await pool.query(
        'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
        [title, content]
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows[0]),
      };
    } catch (error) {
      console.error('Create note error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  // PUT - Update note
  if (httpMethod === 'PUT' && id) {
    try {
      const { title, content } = JSON.parse(body);
      if (!title || !content) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Title and content are required' }),
        };
      }
      const { rows } = await pool.query(
        'UPDATE notes SET title = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING *',
        [title, content, id]
      );
      if (rows.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Note not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows[0]),
      };
    } catch (error) {
      console.error('Update note error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  // DELETE - Delete note
  if (httpMethod === 'DELETE' && id) {
    try {
      const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [id]);
      if (rowCount === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Note not found' }),
        };
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      };
    } catch (error) {
      console.error('Delete note error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}
