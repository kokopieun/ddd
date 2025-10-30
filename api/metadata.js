import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    let body;
    try {
      body = req.body;
      // Jika body adalah string, parse sebagai JSON
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON in request body'
      });
    }

    const { scribdUrl } = body;
    
    if (!scribdUrl) {
      return res.status(400).json({
        success: false, 
        error: 'Missing scribdUrl parameter'
      });
    }

    console.log('Extracting metadata for:', scribdUrl);

    const metadata = await extractScribdMetadata(scribdUrl);
    
    res.status(200).json({
      success: true,
      metadata,
      note: 'This extracts publicly available metadata only. Full content requires advanced tools.'
    });

  } catch (error) {
    console.error('Metadata extraction error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

async function extractScribdMetadata(url) {
  try {
    console.log('Fetching URL:', url);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.scribd.com/',
        'DNT': '1'
      },
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error('Unexpected content type: ' + contentType);
    }

    const html = await response.text();
    console.log('Successfully fetched HTML, length:', html.length);
    
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
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - Scribd took too long to respond');
    }
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}

function extractTitle(html) {
  try {
    // Method 1: Title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      let title = titleMatch[1]
        .replace(/\s*\|\s*Scribd\s*$/i, '')
        .replace(/\s*-\s*Scribd\s*$/i, '')
        .replace(/\s*on\s*Scribd\s*$/i, '')
        .trim();
      
      if (title && title.length > 0) {
        return title;
      }
    }

    // Method 2: Open Graph
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      return ogTitleMatch[1].trim();
    }

    // Method 3: h1 tag
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      return h1Match[1].trim();
    }

    return 'Unknown Document';
  } catch (error) {
    return 'Unknown Document';
  }
}

function extractAuthor(html) {
  try {
    const patterns = [
      /"author":\s*"([^"]+)"/,
      /"author_name":\s*"([^"]+)"/,
      /"creator":\s*"([^"]+)"/,
      /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i,
      /by\s+([^<|]+)(?=<|\||$)/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'Unknown Author';
  } catch (error) {
    return 'Unknown Author';
  }
}

function extractPageCount(html) {
  try {
    const patterns = [
      /"page_count":\s*(\d+)/,
      /"total_pages":\s*(\d+)/,
      /"pages":\s*(\d+)/,
      /"numberOfPages":\s*(\d+)/,
      /data-page-count=["'](\d+)["']/,
      /(\d+)\s+[Pp]ages/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const count = parseInt(match[1]);
        if (!isNaN(count) && count > 0) {
          return count;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function extractDescription(html) {
  try {
    const patterns = [
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      /"description":\s*"([^"]+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function extractDocId(url) {
  try {
    const match = url.match(/\/(?:document|doc|embeds)\/(\d+)/);
    return match ? match[1] : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}
