/**
 * TMDB Metadata Resolver for Spanish Scrapers
 * Fetches titles (Spanish and Original) and release years for movies, series, and anime.
 */

const TMDB_API_KEY = '45dbdd51da578493e2504959ea4e058a'; // Common reliable TMDB key for streaming plugins
const BASE_TMDB_URL = 'https://api.themoviedb.org/3';

async function getMediaDetails(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  const isTv = mediaType === 'tv' || mediaType === 'series';
  const type = isTv ? 'tv' : 'movie';

  try {
    // 1. Fetch metadata in Spanish (Latino)
    const urlEs = `${BASE_TMDB_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const resEs = await fetch(urlEs);
    const dataEs = resEs.ok ? await resEs.json() : null;

    // 2. Fetch metadata in English / Original language for fallback & search matching
    const urlEn = `${BASE_TMDB_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const resEn = await fetch(urlEn);
    const dataEn = resEn.ok ? await resEn.json() : null;

    const spanishTitle = dataEs?.title || dataEs?.name || '';
    const englishTitle = dataEn?.title || dataEn?.name || '';
    const originalTitle = dataEs?.original_title || dataEs?.original_name || dataEn?.original_title || dataEn?.original_name || '';

    const releaseDate = dataEs?.release_date || dataEs?.first_air_date || dataEn?.release_date || dataEn?.first_air_date || '';
    const year = releaseDate ? releaseDate.split('-')[0] : '';

    return {
      tmdbId,
      mediaType: type,
      isTv,
      title: spanishTitle || englishTitle || originalTitle || 'Unknown Title',
      spanishTitle: spanishTitle,
      englishTitle: englishTitle,
      originalTitle: originalTitle,
      year: year,
      season: seasonNum ? parseInt(seasonNum, 10) : null,
      episode: episodeNum ? parseInt(episodeNum, 10) : null
    };
  } catch (error) {
    console.warn('[TMDB Resolver Error]:', error);
    return {
      tmdbId,
      mediaType: isTv ? 'tv' : 'movie',
      isTv,
      title: '',
      spanishTitle: '',
      englishTitle: '',
      originalTitle: '',
      year: '',
      season: seasonNum,
      episode: episodeNum
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getMediaDetails, TMDB_API_KEY };
}
