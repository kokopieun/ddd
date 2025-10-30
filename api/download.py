import { IncomingForm } from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { scribdUrl } = await parseBody(req);
    
    if (!scribdUrl) {
      return res.status(400).json({ error: 'Missing scribdUrl' });
    }

    // Validate Scribd URL
    if (!isValidScribdUrl(scribdUrl)) {
      return res.status(400).json({ error: 'Invalid Scribd URL' });
    }

    const taskId = generateTaskId();
    
    // Process in background (simulate)
    processDownload(taskId, scribdUrl);

    res.status(200).json({
      success: true,
      taskId,
      status: 'processing',
      message: 'Download started'
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm();
    form.parse(req, (err, fields) => {
      if (err) reject(err);
      resolve(fields);
    });
  });
}

function isValidScribdUrl(url) {
  try {
    const urlObj = new URL(url);
    const patterns = [
      /^https:\/\/www\.scribd\.com\/(document|doc)\/\d+/i,
      /^https:\/\/www\.scribd\.com\/embeds\/\d+/i
    ];
    return patterns.some(pattern => pattern.test(urlObj.href));
  } catch {
    return false;
  }
}

function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function processDownload(taskId, scribdUrl) {
  // Simulate processing - in real implementation, this would use queues
  console.log(`Processing task ${taskId} for URL: ${scribdUrl}`);
  
  // For now, we'll just extract metadata
  // In production, you'd use a background job queue
}
