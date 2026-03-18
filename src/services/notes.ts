export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function getNotes(): Promise<Note[]> {
  try {
    const response = await fetch('/api/notes');
    if (!response.ok) throw new Error('Failed to fetch notes');
    return await response.json();
  } catch (error) {
    console.error('Get notes error:', error);
    throw error;
  }
}

export async function getNoteById(id: string): Promise<Note> {
  try {
    const response = await fetch(`/api/notes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch note');
    return await response.json();
  } catch (error) {
    console.error('Get note error:', error);
    throw error;
  }
}

export async function createNote(title: string, content: string): Promise<Note> {
  try {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) throw new Error('Failed to create note');
    return await response.json();
  } catch (error) {
    console.error('Create note error:', error);
    throw error;
  }
}

export async function updateNote(id: string, title: string, content: string): Promise<Note> {
  try {
    const response = await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) throw new Error('Failed to update note');
    return await response.json();
  } catch (error) {
    console.error('Update note error:', error);
    throw error;
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/notes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete note');
  } catch (error) {
    console.error('Delete note error:', error);
    throw error;
  }
}
