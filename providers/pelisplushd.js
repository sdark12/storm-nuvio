// PelisPlus HD Scraper for Nuvio
var TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
var BASE_URL = 'https://pelisplushd.bz';
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

    if (lower.indexOf('streamwish') > -1 || lower.indexOf('wishonly') > -1 || lower.indexOf('swish') > -1 || lower.indexOf('hlswish') > -1) {
      var m = unpacked.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*?)["']/i);
      if (m) return { url: m[1], quality: '1080p', ref: url };
    }
    if (lower.indexOf('vidmoly') > -1) {
      var m2 = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*?)["']/i);
      if (m2) return { url: m2[1], quality: '1080p', ref: 'https://vidmoly.me/' };
    }
    if (lower.indexOf('filemoon') > -1 || lower.indexOf('moonplayer') > -1) {
      var m3 = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*?)["']/i);
      if (m3) return { url: m3[1], quality: '1080p', ref: url };
    }
    if (lower.indexOf('voe.sx') > -1 || lower.indexOf('weneverbeenfree') > -1) {
      var m4 = unpacked.match(/'hls'\s*:\s*'([^']+)'/) || unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*?)["']/i);
      if (m4) return { url: m4[1], quality: '1080p', ref: url };
    }
    var gm = unpacked.match(/https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/i);
    if (gm) return { url: gm[0], quality: '1080p', ref: url };
  } catch (e) {}
  return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  var streams = [];
  var isTv = mediaType === 'tv' || mediaType === 'series';
  try {
    var tmdbType = isTv ? 'tv' : 'movie';
    var tmdbUrl = 'https://api.themoviedb.org/3/' + tmdbType + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=es-MX';
    var tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) return [];
    var tmdbData = await tmdbRes.json();
    var title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name;
    var year = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];
    if (!title) return [];

    var searchRes = await fetch(BASE_URL + '/search?s=' + encodeURIComponent(title), { headers: HEADERS });
    if (!searchRes.ok) return [];
    var searchHtml = await searchRes.text();

    var targetLink = null;
    var itemRegex = /href=["']([^"']*(?:pelicula|serie)\/[^"']*)["']/gi;
    var match;
    while ((match = itemRegex.exec(searchHtml)) !== null) {
      var link = match[1];
      var isLinkTv = link.indexOf('/serie/') > -1;
      if (isTv === isLinkTv) {
        targetLink = link.indexOf('http') === 0 ? link : BASE_URL + link;
        break;
      }
    }
    if (!targetLink) return [];

    var targetPage = targetLink;
    if (isTv && season && episode) {
      targetPage = targetLink.replace(/\/$/, '') + '/temporada/' + season + '/episodio/' + episode;
    }

    var pageRes = await fetch(targetPage, { headers: HEADERS });
    if (!pageRes.ok) return [];
    var pageHtml = await pageRes.text();

    var embedTargets = [];
    var ifrRegex = /(?:iframe[^>]*src|data-video|data-src|video-url)=["']([^"']+)["']/gi;
    var ifm;
    while ((ifm = ifrRegex.exec(pageHtml)) !== null) {
      if (ifm[1].indexOf('http') > -1) embedTargets.push(ifm[1]);
    }

    var tasks = [];
    for (var ii = 0; ii < embedTargets.length; ii++) {
      tasks.push((function(src) {
        return (async function() {
          try {
            var stream = await resolveHostUrl(src, targetPage);
            if (stream && stream.url) {
              var epTag = isTv && season && episode ? ' S' + season + 'E' + episode : '';
              streams.push({
                name: 'PelisPlus HD (' + stream.quality + ')',
                title: title + epTag + ' (' + (year || 'N/A') + ') - Latino',
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
      })(embedTargets[ii]));
    }
    await Promise.all(tasks.map(function(p) { return p.catch(function() {}); }));
  } catch (error) {
    console.error('[PelisPlus Error]:', error);
  }
  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
}
