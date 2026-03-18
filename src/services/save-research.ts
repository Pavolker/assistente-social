export async function saveResearch(query: string, result: string) {
  try {
    const response = await fetch('/api/save-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, result }),
    });
    if (!response.ok) throw new Error('Failed to save research');
    return await response.json();
  } catch (error) {
    console.error('Save research error:', error);
    throw error;
  }
}