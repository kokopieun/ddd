// Simple in-memory store (in production, use Redis/Vercel KV)
const tasks = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId } = req.query;
    
    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    const task = tasks.get(taskId) || {
      taskId,
      status: 'unknown',
      message: 'Task not found'
    };

    res.status(200).json({
      success: true,
      ...task
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Helper to update task status
export function updateTaskStatus(taskId, status, message, data = {}) {
  tasks.set(taskId, {
    taskId,
    status,
    message,
    updatedAt: new Date().toISOString(),
    ...data
  });
}
