/**
 * Cinecalidad Scraper for Nuvio
 * Source: storm-ext CinecalidadProvider
 * Content: PelÃ­culas en Alta DefiniciÃ³n (4K UHD, 1080p FHD) en EspaÃ±ol Latino
 */

const TMDB_API_KEY = '45dbdd51da578493e2504959ea4e058a';
const BASE_URL = 'https://cinecalidad.ms';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': BASE_URL + '/',
  'Accept': '*/*'
};

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

async function resolveHostUrl(rawUrl, referer = BASE_URL) {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (url.startsWith('//')) url = 'https:' + url;
  const lower = url.toLowerCase();

  if (lower.includes('.m3u8')) return { url, quality: '1080p', type: 'm3u8', headers: { 'Referer': referer } };
  if (lower.match(/\.(mp4|mkv)(\?.*)?$/)) return { url, quality: '1080p', type: 'mp4', headers: { 'Referer': referer } };

  try {
    const res = await fetch(url, { headers: { ...HEADERS, 'Referer': referer } });
    if (!res.ok) return null;
    const html = await res.text();
    const unpacked = unpackJS(html);

    if (lower.includes('streamwish') || lower.includes('wishonly') || lower.includes('swish')) {
      const m3u8 = unpacked.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) || unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m3u8) return { url: m3u8[1], quality: '1080p', type: 'm3u8', headers: { 'Referer': url } };
    }

    if (lower.includes('vidmoly')) {
      const match = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || unpacked.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
      if (match) {
        return { url: match[1], quality: '1080p', type: match[1].includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': 'https://vidmoly.me/' } };
      }
    }

    if (lower.includes('filemoon') || lower.includes('moonplayer')) {
      const match = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
      if (match) return { url: match[1], quality: '1080p', type: match[1].includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': url } };
    }

    if (lower.includes('voe.sx') || lower.includes('weneverbeenfree')) {
      const match = unpacked.match(/'hls'\s*:\s*'([^']+)'/) || unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (match) {
        let stream = match[1];
        if (stream.includes('base64') && typeof atob !== 'undefined') stream = atob(stream.split(',')[1] || stream);
        return { url: stream, quality: '1080p', type: 'm3u8', headers: { 'Referer': url } };
      }
    }

    const genMatch = unpacked.match(/https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*/i);
    if (genMatch) {
      const stream = genMatch[0];
      return { url: stream, quality: '1080p', type: stream.includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': url } };
    }
  } catch (e) {}

  return null;
}

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
  // Cinecalidad focuses heavily on Movies
  if (mediaType === 'tv' || mediaType === 'series') return [];

  const streams = [];

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) return [];
    const tmdbData = await tmdbRes.json();

    const title = tmdbData.title || tmdbData.original_title;
    const year = (tmdbData.release_date || '').split('-')[0];
    if (!title) return [];

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    const searchRes = await fetch(searchUrl, { headers: HEADERS });
    if (!searchRes.ok) return [];
    const searchHtml = await searchRes.text();

    const itemRegex = /<article[^>]*class=["'][^"']*item-movies[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
    let match;
    let movieUrl = null;

    while ((match = itemRegex.exec(searchHtml)) !== null) {
      const block = match[1];
      const linkMatch = block.match(/href=["']([^"']+)["']/i);
      if (linkMatch) {
        movieUrl = linkMatch[1];
        break;
      }
    }

    if (!movieUrl) return [];

    const movieRes = await fetch(movieUrl, { headers: HEADERS });
    if (!movieRes.ok) return [];
    const movieHtml = await movieRes.text();

    const serverLinks = [];
    const optRegex = /data-url=["']([^"']+)["']/gi;
    let optMatch;
    while ((optMatch = optRegex.exec(movieHtml)) !== null) {
      serverLinks.push(optMatch[1]);
    }

    const ifRegex = /<iframe[^>]*src=["']([^"']+)["']/gi;
    let ifm;
    while ((ifm = ifRegex.exec(movieHtml)) !== null) {
      if (!ifm[1].includes('youtube') && !ifm[1].includes('facebook')) {
        serverLinks.push(ifm[1]);
      }
    }

    const is4K = movieHtml.includes('4K') || movieHtml.includes('2160p') || title.includes('4K');
    const displayQuality = is4K ? '4K UHD' : '1080p FHD';

    const tasks = serverLinks.map(async (link) => {
      try {
        const stream = await resolveHostUrl(link, movieUrl);
        if (stream && stream.url) {
          streams.push({
            name: `Cinecalidad | ${displayQuality}`,
            title: `ðŸŽ¬ ${title} (${year || 'N/A'})\nðŸ’Ž Calidad: ${displayQuality} | ðŸŒ Audio: Latino | ðŸ“Œ Servidor Premium`,
            url: stream.url,
            quality: is4K ? '4K' : '1080p',
            type: stream.type || 'm3u8',
                  behaviorHints: { notWebReady: true, proxyHeaders: { request: stream.headers || { 'Referer': BASE_URL + '/' } } }
          });
        }
      } catch (e) {}
    });

    await Promise.all((tasks || []).map(p => p.catch(() => {})));
  } catch (error) {
    console.error('[Cinecalidad Error]:', error);
  }

  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
