/**
 * Video Host Extractors for Spanish Streaming Services
 * Extracts direct .m3u8 and .mp4 streams from common video hosts.
 */

const { unpackJS } = typeof require !== 'undefined' ? require('./unpacker') : { unpackJS: (s) => s };

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': '*/*'
};

async function fetchText(url, headers = {}) {
  try {
    const res = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...headers } });
    if (!res || !res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  }
}

// 1. Streamwish / Wishonly / Swish Extractor
async function extractStreamwish(url) {
  try {
    const html = await fetchText(url, { 'Referer': url });
    if (!html) return null;
    const unpacked = unpackJS(html);

    const m3u8Match = unpacked.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) ||
                      unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) ||
                      unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i);

    if (m3u8Match) {
      return {
        url: m3u8Match[1],
        quality: '1080p',
        type: 'm3u8',
        headers: { 'Referer': url, 'User-Agent': DEFAULT_HEADERS['User-Agent'] }
      };
    }
  } catch (e) {}
  return null;
}

// 2. Vidmoly Extractor
async function extractVidmoly(url) {
  try {
    const targetUrl = url.replace(/vidmoly\.(net|to|ru|is)/i, 'vidmoly.me');
    const html = await fetchText(targetUrl, { 'Referer': 'https://vidmoly.me/', 'Origin': 'https://vidmoly.me' });
    if (!html) return null;
    const unpacked = unpackJS(html);

    const match = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) ||
                  unpacked.match(/sources\s*:\s*\[["']([^"']+\.(?:m3u8|mp4)[^"']*)["']\]/i) ||
                  unpacked.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);

    if (match) {
      const streamUrl = match[1];
      return {
        url: streamUrl,
        quality: '1080p',
        type: streamUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        headers: { 'Referer': 'https://vidmoly.me/' }
      };
    }
  } catch (e) {}
  return null;
}

// 3. Filemoon / Moonplayer Extractor
async function extractFilemoon(url) {
  try {
    const html = await fetchText(url, { 'Referer': url });
    if (!html) return null;
    const unpacked = unpackJS(html);

    const match = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) ||
                  unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i);

    if (match) {
      const streamUrl = match[1];
      return {
        url: streamUrl,
        quality: '1080p',
        type: streamUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        headers: { 'Referer': url }
      };
    }
  } catch (e) {}
  return null;
}

// 4. Voe / Weneverbeenfree Extractor
async function extractVoe(url) {
  try {
    let currentUrl = url;
    let html = await fetchText(currentUrl);
    if (!html) return null;

    // Check for redirect inside script
    const redirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (redirectMatch) {
      currentUrl = redirectMatch[1];
      html = await fetchText(currentUrl);
    }

    const unpacked = unpackJS(html || '');
    const hlsMatch = unpacked.match(/'hls'\s*:\s*'([^']+)'/) ||
                     unpacked.match(/"hls"\s*:\s*"([^"]+)"/) ||
                     unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                     unpacked.match(/https?:\/\/[^"']+\.m3u8[^"']*/);

    if (hlsMatch) {
      let streamUrl = hlsMatch[1] || hlsMatch[0];
      if (streamUrl.includes('base64')) {
        try {
          const b64 = streamUrl.split(',')[1] || streamUrl;
          if (typeof atob !== 'undefined') streamUrl = atob(b64);
        } catch (e) {}
      }
      return {
        url: streamUrl,
        quality: '1080p',
        type: 'm3u8',
        headers: { 'Referer': currentUrl }
      };
    }
  } catch (e) {}
  return null;
}

// 5. Streamtape Extractor
async function extractStreamtape(url) {
  try {
    const html = await fetchText(url, { 'Referer': 'https://streamtape.com/' });
    if (!html) return null;
    const unpacked = unpackJS(html);

    const match = unpacked.match(/robotlink['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*([^;]+)/);
    if (match) {
      let videoUrl = 'https:' + match[1];
      const parts = match[2].split('+');
      for (const part of parts) {
        const strMatch = part.match(/['"]([^'"]+)['"]/);
        if (strMatch) {
          let chunk = strMatch[1];
          const subMatch = part.match(/substring\((\d+)\)/);
          if (subMatch) {
            chunk = chunk.substring(parseInt(subMatch[1], 10));
          }
          videoUrl += chunk;
        }
      }
      return {
        url: videoUrl,
        quality: '720p',
        type: 'mp4',
        headers: { 'Referer': 'https://streamtape.com/' }
      };
    }
  } catch (e) {}
  return null;
}

// 6. YourUpload Extractor
async function extractYourUpload(url) {
  try {
    const embedUrl = url.includes('/watch/') ? url.replace('/watch/', '/embed/') : url;
    const html = await fetchText(embedUrl, { 'Referer': 'https://www.yourupload.com/' });
    if (!html) return null;

    const match = html.match(/file\s*:\s*['"]([^'"]+\.mp4[^'"]*)['"]/i) ||
                  html.match(/data-url\s*=\s*['"]([^'"]+\.mp4[^'"]*)['"]/i) ||
                  html.match(/property=["']og:video["']\s*content=["']([^"']+)["']/i);

    if (match) {
      let streamUrl = match[1];
      if (streamUrl.startsWith('/')) streamUrl = 'https://www.yourupload.com' + streamUrl;
      return {
        url: streamUrl,
        quality: '720p',
        type: 'mp4',
        headers: { 'Referer': 'https://www.yourupload.com/' }
      };
    }
  } catch (e) {}
  return null;
}

// 7. Mp4Upload Extractor
async function extractMp4Upload(url) {
  try {
    const embedUrl = url.includes('/embed-') ? url : url.replace(/\.com\/([a-zA-Z0-9]+)/, '.com/embed-$1.html');
    const html = await fetchText(embedUrl, { 'Referer': 'https://www.mp4upload.com/' });
    if (!html) return null;
    const unpacked = unpackJS(html);

    const match = unpacked.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i) ||
                  unpacked.match(/player\.src\(\s*\{\s*src:\s*["']([^"']+)["']/i);

    if (match) {
      return {
        url: match[1],
        quality: '1080p',
        type: 'mp4',
        headers: { 'Referer': 'https://www.mp4upload.com/' }
      };
    }
  } catch (e) {}
  return null;
}

// 8. Universal Router / Host Extractor
async function extractStream(rawUrl, referer = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();
  const lower = url.toLowerCase();

  // If direct stream URL already
  if (lower.includes('.m3u8') || lower.includes('/master.m3u8')) {
    return {
      url: url,
      quality: '1080p',
      type: 'm3u8',
      headers: referer ? { 'Referer': referer } : {}
    };
  }
  if (lower.match(/\.(mp4|mkv)(\?.*)?$/)) {
    return {
      url: url,
      quality: '1080p',
      type: 'mp4',
      headers: referer ? { 'Referer': referer } : {}
    };
  }

  // Route to known host extractor
  if (lower.includes('streamwish') || lower.includes('wishonly') || lower.includes('swish') || lower.includes('wishembed')) {
    return await extractStreamwish(url);
  }
  if (lower.includes('vidmoly')) {
    return await extractVidmoly(url);
  }
  if (lower.includes('filemoon') || lower.includes('moonplayer')) {
    return await extractFilemoon(url);
  }
  if (lower.includes('voe.sx') || lower.includes('weneverbeenfree') || lower.includes('sandratableother')) {
    return await extractVoe(url);
  }
  if (lower.includes('streamtape') || lower.includes('stape')) {
    return await extractStreamtape(url);
  }
  if (lower.includes('yourupload')) {
    return await extractYourUpload(url);
  }
  if (lower.includes('mp4upload')) {
    return await extractMp4Upload(url);
  }

  // Generic fallback: inspect page & unpack
  try {
    const html = await fetchText(url, referer ? { 'Referer': referer } : {});
    if (html) {
      const unpacked = unpackJS(html);
      const streamMatch = unpacked.match(/https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*/i) ||
                          unpacked.match(/file\s*:\s*["']([^"']+)["']/i);
      if (streamMatch) {
        const streamUrl = streamMatch[1] || streamMatch[0];
        return {
          url: streamUrl,
          quality: '1080p',
          type: streamUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
          headers: { 'Referer': url }
        };
      }
    }
  } catch (e) {}

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractStream,
    extractStreamwish,
    extractVidmoly,
    extractFilemoon,
    extractVoe,
    extractStreamtape,
    extractYourUpload,
    extractMp4Upload
  };
}
