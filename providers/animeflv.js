// AnimeFLV / TioAnime Scraper for Nuvio
var TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
var BASE_URL = 'https://tioanime.com';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
var HEADERS = { 'User-Agent': UA, 'Referer': BASE_URL + '/', 'Accept': '*/*' };

function unpackJS(str) {
  if (!str || str.indexOf('p,a,c,k,e,d') === -1) return str || '';
  try {
    var start = str.indexOf('eval(function(p,a,c,k,e,d)');
    if (start === -1) return str;
    var closingIdx = str.indexOf('}(', start);
    if (closingIdx === -1) return str;
    var params = str.slice(closingIdx + 2, str.lastIndexOf(')'));
    var q1 = params.indexOf("'");
    var q2 = -1, esc = false;
    for (var i = q1 + 1; i < params.length; i++) {
      if (esc) { esc = false; continue; }
      if (params[i] === '\\') { esc = true; continue; }
      if (params[i] === "'") { q2 = i; break; }
    }
    if (q1 === -1 || q2 === -1) return str;
    var payload = params.slice(q1 + 1, q2);
    var rest = params.slice(q2 + 1).split(',');
    var a = parseInt(rest[1], 10) || 62;
    var c = parseInt(rest[2], 10);
    var kStr = params.slice(params.indexOf(rest[2]) + rest[2].length);
    var k1 = kStr.indexOf("'"), k2 = kStr.indexOf(".split");
    if (k1 === -1 || k2 === -1) return str;
    var keywords = kStr.slice(k1 + 1, k2 - 1).split('|');
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    function baseDecode(num, radix) {
      if (num < radix) return chars[num] || num.toString(radix);
      return baseDecode(Math.floor(num / radix), radix) + (chars[num % radix] || (num % radix).toString(radix));
    }
    var dict = {};
    for (var j = 0; j < c; j++) { var key = baseDecode(j, a); dict[key] = keywords[j] || key; }
    return payload.replace(/\b\w+\b/g, function(token) { return dict[token] || token; });
  } catch (e) { return str; }
}

async function resolveHostUrl(rawUrl, referer) {
  if (!rawUrl) return null;
  var url = rawUrl.trim();
  if (url.indexOf('//') === 0) url = 'https:' + url;
  var lower = url.toLowerCase();
  if (!referer) referer = BASE_URL;

  if (lower.indexOf('.m3u8') > -1) return { url: url, quality: '1080p', ref: referer };
  if (/\.(mp4|mkv)(\?.*)?$/.test(lower)) return { url: url, quality: '1080p', ref: referer };

  try {
    var h = { 'User-Agent': UA, 'Referer': referer, 'Accept': '*/*' };
    var res = await fetch(url, { headers: h });
    if (!res.ok) return null;
    var html = await res.text();
    var unpacked = unpackJS(html);

    if (lower.indexOf('yourupload') > -1) {
      var m = html.match(/file\s*:\s*['"]([^'"]+\.mp4[^'"]*)['"]/i) || html.match(/property=["']og:video["']\s*content=["']([^"']+)["']/i);
      if (m) {
        var sUrl = m[1];
        if (sUrl.indexOf('/') === 0) sUrl = 'https://www.yourupload.com' + sUrl;
        return { url: sUrl, quality: '720p', ref: 'https://www.yourupload.com/' };
      }
    }
    if (lower.indexOf('streamtape') > -1) {
      var m2 = unpacked.match(/robotlink['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*([^;]+)/);
      if (m2) {
        var videoUrl = 'https:' + m2[1];
        var parts = m2[2].split('+');
        for (var pi = 0; pi < parts.length; pi++) {
          var sm = parts[pi].match(/['"]([^'"]+)['"]/);
          if (sm) {
            var chunk = sm[1];
            var subM = parts[pi].match(/substring\((\d+)\)/);
            if (subM) chunk = chunk.substring(parseInt(subM[1], 10));
            videoUrl += chunk;
          }
        }
        return { url: videoUrl, quality: '720p', ref: 'https://streamtape.com/' };
      }
    }
    if (lower.indexOf('streamwish') > -1 || lower.indexOf('swish') > -1) {
      var m3 = unpacked.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*?)["']/i);
      if (m3) return { url: m3[1], quality: '1080p', ref: url };
    }
    var gm = unpacked.match(/https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/i);
    if (gm) return { url: gm[0], quality: '1080p', ref: url };
  } catch (e) {}
  return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  var streams = [];
  try {
    var isTv = mediaType === 'tv' || mediaType === 'series' || mediaType === 'anime';
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTv ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=es-MX';
    var tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) return [];
    var tmdbData = await tmdbRes.json();
    var title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name;
    var originalTitle = tmdbData.original_title || tmdbData.original_name || '';
    var year = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];
    var epNum = episode ? parseInt(episode, 10) : 1;
    if (!title) return [];

    var searchQueries = [title.replace(/:/g, ' ')];
    if (originalTitle) searchQueries.push(originalTitle.replace(/:/g, ' '));
    var animeSlug = null;

    for (var qi = 0; qi < searchQueries.length; qi++) {
      try {
        var sr = await fetch(BASE_URL + '/directorio?q=' + encodeURIComponent(searchQueries[qi]), { headers: HEADERS });
        if (sr.ok) {
          var sHtml = await sr.text();
          var slugRegex = /href=["']\/anime\/([^"']+)["']/gi;
          var sm;
          while ((sm = slugRegex.exec(sHtml)) !== null) {
            animeSlug = sm[1];
            break;
          }
        }
        if (animeSlug) break;
      } catch (e) {}
    }
    if (!animeSlug) return [];

    var epPageUrl = BASE_URL + '/ver/' + animeSlug + '-' + epNum;
    var epRes = await fetch(epPageUrl, { headers: HEADERS });
    if (!epRes.ok) return [];
    var epHtml = await epRes.text();

    var videosMatch = epHtml.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
    if (!videosMatch) return [];

    var videoArray;
    try { videoArray = JSON.parse(videosMatch[1]); } catch (e) { return []; }

    var tasks = [];
    for (var vi = 0; vi < videoArray.length; vi++) {
      var item = videoArray[vi];
      var serverName = item[0];
      var code = item[1];
      if (code && code.indexOf('mega.nz') === -1) {
        tasks.push((function(srvName, rawCode) {
          return (async function() {
            try {
              var stream = await resolveHostUrl(rawCode, epPageUrl);
              if (stream && stream.url) {
                streams.push({
                  name: 'AnimeFLV | ' + srvName + ' (Sub)',
                  title: title + ' - Ep ' + epNum + ' (' + (year || 'N/A') + ')',
                  url: stream.url,
                  quality: stream.quality || '1080p',
                  behaviorHints: {
                    notWebReady: true,
                    proxyHeaders: { request: { 'Referer': stream.ref || BASE_URL + '/', 'User-Agent': UA } }
                  }
                });
              }
            } catch (err) {}
          })();
        })(serverName, code));
      }
    }
    await Promise.all(tasks.map(function(p) { return p.catch(function() {}); }));
  } catch (error) {
    console.error('[AnimeFLV Error]:', error);
  }
  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
}
