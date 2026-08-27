/**
 * Universal Dean Edwards / p,a,c,k,e,d JavaScript Unpacker
 * Handles packed Javascript strings commonly found in video streaming embeds.
 */
function unpackJS(packedCode) {
  if (!packedCode || typeof packedCode !== 'string' || !packedCode.includes('p,a,c,k,e,d')) {
    return packedCode || '';
  }

  try {
    const findPackedBlocks = (str) => {
      const blocks = [];
      let searchIdx = 0;
      while (true) {
        const start = str.indexOf('eval(function(p,a,c,k,e,d)', searchIdx);
        if (start === -1) break;
        let pos = start;
        let depth = 0;
        let inSQuote = false;
        let inDQuote = false;
        let escaped = false;

        for (; pos < str.length; pos++) {
          const char = str[pos];
          if (escaped) {
            escaped = false;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            continue;
          }
          if (!inDQuote && char === "'") {
            inSQuote = !inSQuote;
          } else if (!inSQuote && char === '"') {
            inDQuote = !inDQuote;
          }

          if (!inSQuote && !inDQuote) {
            if (char === '(') depth++;
            else if (char === ')') {
              depth--;
              if (depth === 0) {
                pos++;
                break;
              }
            }
          }
        }

        if (pos > start) {
          blocks.push(str.slice(start, pos));
        }
        searchIdx = pos;
      }
      return blocks;
    };

    const unpackBlock = (block) => {
      const closingIdx = block.indexOf('}(');
      if (closingIdx === -1) return null;

      let p = block.slice(block.indexOf('return p}(') + 10, closingIdx);
      // Extraer parámetros después de }(
      const paramsStr = block.slice(closingIdx + 2, block.lastIndexOf(')'));
      
      // Parsear: 'payload', a, c, 'k'.split('|'), e, d
      const firstQuote = paramsStr.indexOf("'");
      if (firstQuote === -1) return null;
      let payloadEnd = -1;
      let esc = false;
      for (let i = firstQuote + 1; i < paramsStr.length; i++) {
        if (esc) { esc = false; continue; }
        if (paramsStr[i] === '\\') { esc = true; continue; }
        if (paramsStr[i] === "'") { payloadEnd = i; break; }
      }
      if (payloadEnd === -1) return null;

      const payload = paramsStr.slice(firstQuote + 1, payloadEnd);
      const rest = paramsStr.slice(payloadEnd + 1).split(',');
      if (rest.length < 3) return null;

      const a = parseInt(rest[1].trim(), 10) || 62;
      const c = parseInt(rest[2].trim(), 10);
      const kMatch = paramsStr.match(/\.split\(['"]\|['"]\)/);
      if (!kMatch) return null;

      const kStr = paramsStr.slice(paramsStr.indexOf(rest[2]) + rest[2].length);
      const kStart = kStr.indexOf("'");
      const kEnd = kStr.indexOf(".split");
      if (kStart === -1 || kEnd === -1) return null;
      
      const keywords = kStr.slice(kStart + 1, kEnd - 1).split('|');

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
    };

    let result = packedCode;
    const blocks = findPackedBlocks(packedCode);
    for (const block of blocks) {
      const unpacked = unpackBlock(block);
      if (unpacked) {
        result = result.replace(block, unpacked);
      }
    }
    return result;
  } catch (err) {
    return packedCode;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { unpackJS };
}
