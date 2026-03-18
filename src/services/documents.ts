export async function getDocuments() {
  try {
    const response = await fetch('/api/documents');
    if (!response.ok) throw new Error('Failed to fetch documents');
    return await response.json();
  } catch (error) {
    console.error('Get documents error:', error);
    return [];
  }
}