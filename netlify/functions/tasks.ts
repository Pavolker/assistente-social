import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function handler(event, context) {
  if (event.httpMethod === 'GET') {
    try {
      const { rows } = await pool.query('SELECT * FROM study_tasks ORDER BY date ASC');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      };
    } catch (error) {
      console.error('Get tasks error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const tasks = JSON.parse(event.body);
      // Assuming tasks is an array of task objects
      await pool.query('DELETE FROM study_tasks'); // Clear and replace
      for (const task of tasks) {
        await pool.query(
          'INSERT INTO study_tasks (id, title, topic, date, completed) VALUES ($1, $2, $3, $4, $5)',
          [task.id, task.title, task.topic, task.date, task.completed]
        );
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      };
    } catch (error) {
      console.error('Save tasks error:', error);
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