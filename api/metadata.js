import fetch from 'node-fetch';

export default async function handler(req, res) {
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
    const { scribdUrl } = req.body;
    
    if (!scribdUrl) {
      return res.status(400).json({ error: 'Missing scribdUrl' });
    }

    const metadata = await extractScribdMetadata(scribdUrl);
    
    res.status(200).json({
      success: true,
      metadata,
      note: 'This extracts publicly available metadata only'
    });

  } catch (error) {
    console.error('Metadata extraction error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function extractScribdMetadata(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.scribd.com/',
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    return {
      title: extractTitle(html),
      author: extractAuthor(html),
      pageCount: extractPageCount(html),
      description: extractDescription(html),
      docId: extractDocId(url),
      url: url,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1]
      .replace(/\s*\|\s*Scribd\s*$/i, '')
      .replace(/\s*-\s*Scribd\s*$/i, '')
      .trim();
  }
  return 'Unknown Document';
}

function extractAuthor(html) {
  const authorMatch = html.match(/"author":\s*"([^"]+)"/) || 
                     html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
  return authorMatch ? authorMatch[1] : 'Unknown Author';
}

function extractPageCount(html) {
  const pageMatch = html.match(/"page_count":\s*(\d+)/) || 
                   html.match(/"total_pages":\s*(\d+)/);
  return pageMatch ? parseInt(pageMatch[1]) : null;
}

function extractDescription(html) {
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  return descMatch ? descMatch[1] : null;
}

function extractDocId(url) {
  const match = url.match(/\/(?:document|doc|embeds)\/(\d+)/);
  return match ? match[1] : 'unknown';
}
