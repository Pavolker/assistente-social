export async function getTasks() {
  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return await response.json();
  } catch (error) {
    console.error('Get tasks error:', error);
    return [];
  }
}

export async function saveTasks(tasks: any[]) {
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    });
    if (!response.ok) throw new Error('Failed to save tasks');
    return await response.json();
  } catch (error) {
    console.error('Save tasks error:', error);
    throw error;
  }
}