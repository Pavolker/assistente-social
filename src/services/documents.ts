export async function getDocuments() {
  try {
    const response = await fetch('/api/documents');
    if (!response.ok) throw new Error('Failed to fetch documents');
    const data = await response.json();
    return Array.isArray(data) ? data : data.localDocuments || [];
  } catch (error) {
    console.error('Get documents error:', error);
    return [];
  }
}

export type DocumentSearchResult = {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
  type: 'pdf' | 'site' | 'document';
  source: 'web' | 'local';
  mime_type?: string;
  file_path?: string;
  uploaded_at?: string;
};

export type SavedDocument = {
  id: string;
  filename: string;
  mime_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
  file_path?: string;
};

export async function searchDocuments(query: string) {
  try {
    const response = await fetch(`/api/documents/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search documents');
    return await response.json();
  } catch (error) {
    console.error('Search documents error:', error);
    return { results: [], localDocuments: [] };
  }
}

export async function getDocumentPreview(id: string) {
  try {
    const response = await fetch(`/api/documents/${id}/preview`);
    if (!response.ok) throw new Error('Failed to fetch document preview');
    return await response.json();
  } catch (error) {
    console.error('Get document preview error:', error);
    throw error;
  }
}

export async function deleteDocument(id: string) {
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete document');
    return await response.json();
  } catch (error) {
    console.error('Delete document error:', error);
    throw error;
  }
}
