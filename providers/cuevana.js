/**
 * Cuevana Scraper for Nuvio
 * Source: storm-ext CuevanaProvider
 * Content: Películas y Series en Español Latino, Castellano y Subtitulado
 */

const TMDB_API_KEY = '45dbdd51da578493e2504959ea4e058a';
const BASE_URL = 'https://wv3.cuevana3.eu';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': BASE_URL + '/',
  'Accept': '*/*'
};

// Helper: Unpack packed JavaScript (p,a,c,k,e,d)
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

// Helper: Video Host Resolver
async function resolveHostUrl(rawUrl, referer = BASE_URL) {
  if (!rawUrl) return null;
  const url = rawUrl.trim();
  const lower = url.toLowerCase();

  // Direct media
  if (lower.includes('.m3u8') || lower.includes('/master.m3u8')) {
    return { url, quality: '1080p', type: 'm3u8', headers: { 'Referer': referer } };
  }
  if (lower.match(/\.(mp4|mkv)(\?.*)?$/)) {
    return { url, quality: '1080p', type: 'mp4', headers: { 'Referer': referer } };
  }

  try {
    const res = await fetch(url, { headers: { ...HEADERS, 'Referer': referer } });
    if (!res.ok) return null;
    const html = await res.text();
    const unpacked = unpackJS(html);

    // 1. Streamwish / Wishonly
    if (lower.includes('streamwish') || lower.includes('wishonly') || lower.includes('swish')) {
      const m3u8 = unpacked.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) ||
                   unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m3u8) return { url: m3u8[1], quality: '1080p', type: 'm3u8', headers: { 'Referer': url } };
    }

    // 2. Vidmoly
    if (lower.includes('vidmoly')) {
      const match = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) ||
                    unpacked.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
      if (match) {
        const stream = match[1];
        return { url: stream, quality: '1080p', type: stream.includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': 'https://vidmoly.me/' } };
      }
    }

    // 3. Filemoon
    if (lower.includes('filemoon') || lower.includes('moonplayer')) {
      const match = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
      if (match) return { url: match[1], quality: '1080p', type: match[1].includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': url } };
    }

    // 4. Voe
    if (lower.includes('voe.sx') || lower.includes('weneverbeenfree') || lower.includes('sandratableother')) {
      const match = unpacked.match(/'hls'\s*:\s*'([^']+)'/) || unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (match) {
        let stream = match[1];
        if (stream.includes('base64') && typeof atob !== 'undefined') stream = atob(stream.split(',')[1] || stream);
        return { url: stream, quality: '1080p', type: 'm3u8', headers: { 'Referer': url } };
      }
    }

    // 5. Generic stream match
    const genMatch = unpacked.match(/https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*/i);
    if (genMatch) {
      const stream = genMatch[0];
      return { url: stream, quality: '1080p', type: stream.includes('.m3u8') ? 'm3u8' : 'mp4', headers: { 'Referer': url } };
    }
  } catch (e) {}

  return null;
}

// Main getStreams Export
async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
  const streams = [];
  const isTv = mediaType === 'tv' || mediaType === 'series';

  try {
    // 1. Get TMDB Details in Spanish
    const tmdbUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) return [];
    const tmdbData = await tmdbRes.json();

    const title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name;
    const originalTitle = tmdbData.original_title || tmdbData.original_name || '';
    const year = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];

    if (!title) return [];

    // 2. Search in Cuevana
    const queries = [title];
    if (originalTitle && originalTitle.toLowerCase() !== title.toLowerCase()) {
      queries.push(originalTitle);
    }

    let searchHtml = '';
    for (const q of queries) {
      try {
        const searchRes = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q)}`, { headers: HEADERS });
        if (searchRes.ok) {
          searchHtml = await searchRes.text();
          if (searchHtml.includes('TPostMv')) break;
        }
      } catch (e) {}
    }

    if (!searchHtml) return [];

    // Parse Search Results with Regex
    const itemRegex = /<li[^>]*class=["'][^"']*TPostMv[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    let targetLink = null;

    while ((match = itemRegex.exec(searchHtml)) !== null) {
      const block = match[1];
      const linkMatch = block.match(/href=["']([^"']+)["']/i);
      const titleMatch = block.match(/<span[^>]*class=["']Title["'][^>]*>([^<]+)<\/span>/i);
      if (!linkMatch) continue;

      const link = linkMatch[1];
      const isItemTv = link.includes('/serie/');

      if (isTv === isItemTv) {
        targetLink = link.startsWith('http') ? link : `${BASE_URL}${link}`;
        break;
      }
    }

    if (!targetLink) return [];

    // 3. Navigate to Episode or Movie Page
    let contentPageUrl = targetLink;
    if (isTv && season && episode) {
      // Cuevana standard episode URL structure
      const baseSlug = targetLink.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');
      contentPageUrl = `${BASE_URL}/${baseSlug}/temporada/${season}/episodio/${episode}`;
    }

    let pageRes = await fetch(contentPageUrl, { headers: HEADERS });
    if (!pageRes.ok && isTv) {
      // Fallback: load main series page to find NEXT_DATA episode link
      const seriesRes = await fetch(targetLink, { headers: HEADERS });
      if (seriesRes.ok) {
        const seriesHtml = await seriesRes.text();
        const nextDataMatch = seriesHtml.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        if (nextDataMatch) {
          try {
            const nextJson = JSON.parse(nextDataMatch[1]);
            const seasons = nextJson?.props?.pageProps?.thisSerie?.seasons || [];
            const targetSeason = seasons.find(s => s.number === parseInt(season, 10));
            const targetEp = targetSeason?.episodes?.find(e => e.number === parseInt(episode, 10));
            if (targetEp?.url?.slug) {
              const epSlug = targetEp.url.slug.replace('series/', 'serie/').replace('seasons/', 'temporada/').replace('episodes/', 'episodio/');
              contentPageUrl = epSlug.startsWith('http') ? epSlug : `${BASE_URL}/${epSlug}`;
              pageRes = await fetch(contentPageUrl, { headers: HEADERS });
            }
          } catch (e) {}
        }
      }
    }

    if (!pageRes.ok) return [];
    const pageHtml = await pageRes.text();

    // 4. Extract Server Iframes
    const iframeMatches = [];
    const serverBlockRegex = /<li[^>]*class=["'][^"']*open_submenu[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi;
    let subMatch;

    while ((subMatch = serverBlockRegex.exec(pageHtml)) !== null) {
      const subBlock = subMatch[1];
      const langMatch = subBlock.match(/<span>([^<]+)<\/span>/i) || subBlock.match(/(Latino|Castellano|Subtitulado)/i);
      const lang = langMatch ? langMatch[1].trim() : 'Latino';

      const cliliRegex = /<li[^>]*data-tr=["']([^"']+)["'][^>]*>/gi;
      let cli;
      while ((cli = cliliRegex.exec(subBlock)) !== null) {
        iframeMatches.push({ iframeUrl: cli[1], lang });
      }
    }

    // Direct embed fallback if open_submenu structure varies
    if (iframeMatches.length === 0) {
      const genericTrRegex = /data-tr=["']([^"']+)["']/gi;
      let genTr;
      while ((genTr = genericTrRegex.exec(pageHtml)) !== null) {
        iframeMatches.push({ iframeUrl: genTr[1], lang: 'Latino' });
      }
    }

    // 5. Resolve Video URLs from Iframes
    const resolveTasks = iframeMatches.map(async ({ iframeUrl, lang }) => {
      try {
        const ifUrl = iframeUrl.startsWith('//') ? 'https:' + iframeUrl : (iframeUrl.startsWith('/') ? `${BASE_URL}${iframeUrl}` : iframeUrl);
        const ifRes = await fetch(ifUrl, { headers: HEADERS });
        if (!ifRes.ok) return;
        const ifHtml = await ifRes.text();

        // Extract redirect URL (var url = '...')
        const urlMatch = ifHtml.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/i) ||
                         ifHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i) ||
                         ifHtml.match(/<iframe[^>]*src=["']([^"']+)["']/i);

        if (urlMatch && urlMatch[1]) {
          const videoHostUrl = urlMatch[1];
          const stream = await resolveHostUrl(videoHostUrl, ifUrl);
          if (stream && stream.url) {
            const epTag = isTv && season && episode ? ` S${season}E${episode}` : '';
            streams.push({
              name: `Cuevana | ${lang} (${stream.quality})`,
              title: `🎬 ${title}${epTag} (${year || 'N/A'})\n🌐 Audio: ${lang} | 🎞️ ${stream.type.toUpperCase()} | 📌 Servidor Directo`,
              url: stream.url,
              quality: stream.quality || '1080p',
              type: stream.type || 'm3u8',
              headers: stream.headers || { 'Referer': BASE_URL + '/' },
              provider: 'cuevana'
            });
          }
        }
      } catch (err) {}
    });

    await Promise.allSettled(resolveTasks);
  } catch (error) {
    console.error('[Cuevana Scraper Error]:', error);
  }

  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
