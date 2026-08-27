/**
 * AnimeFLV Scraper for Nuvio
 * Source: storm-ext AnimeflvProvider
 * Content: Anime Series, Movies y OVAs (Subtitulado y Audio Latino)
 */

const TMDB_API_KEY = '45dbdd51da578493e2504959ea4e058a';
const BASE_URL = 'https://www3.animeflv.net';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': BASE_URL + '/',
  'Accept': '*/*'
};

// Helper: Unpack packed JavaScript
function unpackJS(str) {
  if (!str || !str.includes('p,a,c,k,e,d')) return str || '';
  try {
    const start = str.indexOf('eval(function(p,a,c,k,e,d)');
    if (start === -1) return str;
    const closingIdx = str.indexOf('}(', start);
    if (closingIdx === -1) return str;
    const params = str.slice(closingIdx + 2, str.lastIndexOf(')'));
    const q1 = params.indexOf("'");
    let q2 = -1, esc = false;
    for (let i = q1 + 1; i < params.length; i++) {
      if (esc) { esc = false; continue; }
      if (params[i] === '\\') { esc = true; continue; }
      if (params[i] === "'") { q2 = i; break; }
    }
    if (q1 === -1 || q2 === -1) return str;
    const payload = params.slice(q1 + 1, q2);
    const rest = params.slice(q2 + 1).split(',');
    const a = parseInt(rest[1].trim(), 10) || 62;
    const c = parseInt(rest[2].trim(), 10);
    const kStr = params.slice(params.indexOf(rest[2]) + rest[2].length);
    const k1 = kStr.indexOf("'"), k2 = kStr.indexOf(".split");
    if (k1 === -1 || k2 === -1) return str;
    const keywords = kStr.slice(k1 + 1, k2 - 1).split('|');

    const baseDecode = (num, radix) => {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (num < radix) return chars[num] || num.toString(radix);
      return baseDecode(Math.floor(num / radix), radix) + (chars[num % radix] || (num % radix).toString(radix));
    };

    const dict = {};
    for (let i = 0; i < c; i++) {
      const key = baseDecode(i, a);
      dict[key] = keywords[i] || key;
    }
    return payload.replace(/\b\w+\b/g, (token) => dict[token] || token);
  } catch (e) {
    return str;
  }
}

// Helper: Host Extractor
async function resolveHostUrl(rawUrl, referer = BASE_URL) {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (url.startsWith('//')) url = 'https:' + url;
  const lower = url.toLowerCase();

  if (lower.includes('.m3u8')) return { url, quality: '1080p', type: 'm3u8', headers: { 'Referer': referer } };
  if (lower.match(/\.(mp4|mkv)(\?.*)?$/)) return { url, quality: '1080p', type: 'mp4', headers: { 'Referer': referer } };

  try {
    // 1. Streamwish / Swish
    if (lower.includes('streamwish') || lower.includes('wishonly') || lower.includes('swish') || lower.includes('wishembed')) {
      const res = await fetch(url, { headers: { ...HEADERS, 'Referer': referer } });
      if (!res.ok) return null;
      const html = await res.text();
      const unpacked = unpackJS(html);
      const m3u8 = unpacked.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) || unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m3u8) return { url: m3u8[1], quality: '1080p', type: 'm3u8', headers: { 'Referer': url } };
    }

    // 2. Vidmoly
    if (lower.includes('vidmoly')) {
      const vUrl = url.replace(/vidmoly\.(net|to|ru|is)/i, 'vidmoly.me');
      const res = await fetch(vUrl, { headers: { ...HEADERS, 'Referer': 'https://vidmoly.me/' } });
      if (!res.ok) return null;
      const html = await res.text();
      const unpacked = unpackJS(html);
      const match = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || unpacked.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
      if (match) {
        const stream = match[1];
        return { url: stream, quality: '1080p', type: stream.includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': 'https://vidmoly.me/' } };
      }
    }

    // 3. YourUpload
    if (lower.includes('yourupload')) {
      const embedUrl = url.includes('/watch/') ? url.replace('/watch/', '/embed/') : url;
      const res = await fetch(embedUrl, { headers: { ...HEADERS, 'Referer': BASE_URL } });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/file\s*:\s*['"]([^'"]+\.mp4[^'"]*)['"]/i) || html.match(/property=["']og:video["']\s*content=["']([^"']+)["']/i);
        if (match) {
          let sUrl = match[1];
          if (sUrl.startsWith('/')) sUrl = 'https://www.yourupload.com' + sUrl;
          return { url: sUrl, quality: '720p', type: 'mp4', headers: { 'Referer': 'https://www.yourupload.com/' } };
        }
      }
    }

    // 4. Streamtape
    if (lower.includes('streamtape') || lower.includes('stape')) {
      const res = await fetch(url, { headers: { ...HEADERS, 'Referer': 'https://streamtape.com/' } });
      if (res.ok) {
        const html = await res.text();
        const unpacked = unpackJS(html);
        const match = unpacked.match(/robotlink['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*([^;]+)/);
        if (match) {
          let videoUrl = 'https:' + match[1];
          const parts = match[2].split('+');
          for (const p of parts) {
            const sm = p.match(/['"]([^'"]+)['"]/);
            if (sm) {
              let chunk = sm[1];
              const subMatch = p.match(/substring\((\d+)\)/);
              if (subMatch) chunk = chunk.substring(parseInt(subMatch[1], 10));
              videoUrl += chunk;
            }
          }
          return { url: videoUrl, quality: '720p', type: 'mp4', headers: { 'Referer': 'https://streamtape.com/' } };
        }
      }
    }

    // 5. Mp4Upload
    if (lower.includes('mp4upload')) {
      const embedUrl = url.includes('/embed-') ? url : url.replace(/\.com\/([a-zA-Z0-9]+)/, '.com/embed-$1.html');
      const res = await fetch(embedUrl, { headers: { ...HEADERS, 'Referer': BASE_URL } });
      if (res.ok) {
        const html = await res.text();
        const unpacked = unpackJS(html);
        const match = unpacked.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        if (match) return { url: match[1], quality: '1080p', type: 'mp4', headers: { 'Referer': 'https://www.mp4upload.com/' } };
      }
    }

    // Generic fallback
    const res = await fetch(url, { headers: { ...HEADERS, 'Referer': referer } });
    if (res.ok) {
      const html = await res.text();
      const unpacked = unpackJS(html);
      const m = unpacked.match(/https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*/i);
      if (m) {
        return { url: m[0], quality: '1080p', type: m[0].includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': url } };
      }
    }
  } catch (e) {}

  return null;
}

// Main getStreams Export
async function getStreams(tmdbId, mediaType = 'tv', season = 1, episode = 1) {
  const streams = [];

  try {
    // 1. Fetch metadata from TMDB
    const isTv = mediaType === 'tv' || mediaType === 'series' || mediaType === 'anime';
    const tmdbUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) return [];
    const tmdbData = await tmdbRes.json();

    const title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name;
    const originalTitle = tmdbData.original_title || tmdbData.original_name || '';
    const year = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];
    const epNum = episode ? parseInt(episode, 10) : 1;

    if (!title) return [];

    // 2. Search anime on AnimeFLV
    const searchQueries = [
      title.replace(/:/g, ' '),
      originalTitle.replace(/:/g, ' ')
    ].filter(Boolean);

    let animeSlug = null;

    for (const q of searchQueries) {
      try {
        const searchRes = await fetch(`${BASE_URL}/browse?q=${encodeURIComponent(q)}`, { headers: HEADERS });
        if (searchRes.ok) {
          const searchHtml = await searchRes.text();
          const itemRegex = /<ul[^>]*class=["'][^"']*ListAnimes[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i;
          const listMatch = searchHtml.match(itemRegex);
          if (listMatch) {
            const articleRegex = /<article[^>]*class=["']Anime[^"']*["']>([\s\S]*?)<\/article>/gi;
            let artMatch;
            while ((artMatch = articleRegex.exec(listMatch[1])) !== null) {
              const artContent = artMatch[1];
              const linkMatch = artContent.match(/href=["']\/anime\/([^"']+)["']/i);
              if (linkMatch) {
                animeSlug = linkMatch[1];
                break;
              }
            }
          }
        }
        if (animeSlug) break;
      } catch (e) {}
    }

    // Fallback: Quick Search API
    if (!animeSlug) {
      try {
        const qsRes = await fetch(`${BASE_URL}/api/animes/search`, {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `value=${encodeURIComponent(searchQueries[0])}`
        });
        if (qsRes.ok) {
          const qsData = await qsRes.json();
          if (Array.isArray(qsData) && qsData.length > 0 && qsData[0].slug) {
            animeSlug = qsData[0].slug;
          }
        }
      } catch (e) {}
    }

    if (!animeSlug) return [];

    // 3. Fetch episode page
    const epPageUrl = `${BASE_URL}/ver/${animeSlug}-${epNum}`;
    const epRes = await fetch(epPageUrl, { headers: HEADERS });
    if (!epRes.ok) return [];
    const epHtml = await epRes.text();

    // 4. Extract video servers from `var videos = { ... };`
    const videosMatch = epHtml.match(/var\s+videos\s*=\s*(\{[\s\S]*?\});/);
    if (!videosMatch) return [];

    let videoData;
    try {
      videoData = JSON.parse(videosMatch[1]);
    } catch (e) {
      return [];
    }

    const tasks = [];

    // Iterate through SUB (Subtitulado) and LAT / DUB (Doblaje)
    for (const [langKey, serverList] of Object.entries(videoData)) {
      if (!Array.isArray(serverList)) continue;
      const langLabel = langKey === 'LAT' ? 'Audio Latino' : (langKey === 'CAS' ? 'Castellano' : 'Sub EspaÃ±ol');

      for (const srv of serverList) {
        const code = srv.code || srv.url;
        const serverName = srv.title || srv.server || 'Server';

        if (code && !code.includes('mega.nz')) {
          tasks.push((async () => {
            try {
              const stream = await resolveHostUrl(code, epPageUrl);
              if (stream && stream.url) {
                streams.push({
                  name: `AnimeFLV | ${serverName} [${langLabel}]`,
                  title: `ðŸŽŒ ${title} - Episodio ${epNum} (${year || 'N/A'})\nðŸŒ ${langLabel} | âš¡ ${serverName} | ðŸŽžï¸ ${stream.type.toUpperCase()}`,
                  url: stream.url,
                  quality: stream.quality || '1080p',
                  type: stream.type || 'm3u8',
                  behaviorHints: { notWebReady: true, proxyHeaders: { request: stream.headers || { 'Referer': BASE_URL + '/' } } }
                });
              }
            } catch (err) {}
          })());
        }
      }
    }

    await Promise.all((tasks || []).map(p => p.catch(() => {})));
  } catch (error) {
    console.error('[AnimeFLV Scraper Error]:', error);
  }

  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
