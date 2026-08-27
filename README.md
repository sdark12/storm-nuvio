# ⚡ Storm-Nuvio | Plugins y Scrapers en Español

Suite de proveedores de streaming en **Español Latino**, **Castellano**, **Anime** y **Doramas** adaptada desde la lógica de [storm-ext](https://github.com/redblacker8/storm-ext) (CloudStream 3) para la aplicación de streaming **[Nuvio](https://github.com/D3adlyRocket/All-in-One-Nuvio)**.

---

## 🚀 Instalación en Nuvio (Android, Android TV, iOS, Web)

1. Abre la aplicación **Nuvio**.
2. Ve al menú de **Settings** (Configuración) → **Local Scrapers** (o **Plugins**).
3. Pulsa en **Add Repository** (Agregar Repositorio) e introduce la URL directa a tu archivo `manifest.json`:
   ```text
   https://raw.githubusercontent.com/TU_USUARIO/storm-nuvio/main/manifest.json
   ```
4. Activa los scrapers que desees utilizar y ¡listo! Los enlaces en español aparecerán automáticamente al seleccionar cualquier película o serie.

---

## 📺 Proveedores Disponibles

| Proveedor | Idiomas | Tipos de Contenido | Calidad | Nuvio App | Nuvio TV |
| :--- | :--- | :--- | :--- | :---: | :---: |
| 🍿 **Cuevana** | 🇲🇽 Latino, 🇪🇸 Castellano, 🇯🇵 Sub | Películas y Series | 1080p / 720p | ✅ | ✅ |
| 🎌 **AnimeFLV** | 🇯🇵 Sub Español, 🇲🇽 Latino | Anime (Series, Movies, OVAs) | 1080p / 720p | ✅ | ✅ |
| 🎬 **PelisPlus HD** | 🇲🇽 Latino | Películas y Series | 1080p / 720p | ✅ | ✅ |
| 💎 **Cinecalidad** | 🇲🇽 Latino | Películas HD & 4K | 4K UHD / 1080p | ✅ | ✅ |
| ⚡ **JKAnime** | 🇯🇵 Sub Español | Anime | 1080p / 720p | ✅ | ✅ |
| 🌸 **DoramasFlix** | 🇰🇷 Coreano, 🇨🇳 Chino (Sub / Doblado) | K-Dramas / Doramas | 1080p / 720p | ✅ | ✅ |

---

## 🛠️ Arquitectura y Estructura del Proyecto

```text
storm-nuvio/
├── manifest.json                  # Manifiesto maestro para Nuvio
├── README.md                      # Documentación y guía de instalación
├── providers/                     # Scrapers independientes de cada sitio web
│   ├── cuevana.js                 # Lógica de Cuevana
│   ├── animeflv.js                # Lógica de AnimeFLV
│   ├── pelisplushd.js             # Lógica de PelisPlus HD
│   ├── cinecalidad.js             # Lógica de Cinecalidad 4K
│   ├── jkanime.js                 # Lógica de JKAnime
│   └── doramasflix.js             # Lógica de DoramasFlix
├── utils/                         # Herramientas de extracción y metadatos
│   ├── extractors.js              # Resolutor de hosts (Streamwish, Vidmoly, Filemoon, Voe, etc.)
│   ├── tmdb.js                    # Búsqueda y traducción de metadatos TMDB
│   └── unpacker.js                # Desempaquetador de scripts p,a,c,k,e,d
└── test/
    └── test-runner.html           # Entorno web para pruebas locales y reproductor de stream
```

---

## 🧪 Pruebas Locales (Test Runner)

Puedes probar los scrapers y verificar la reproducción de videos directamente en tu navegador sin necesidad de subir cambios a GitHub:

1. Abre el archivo `test/test-runner.html` en cualquier navegador web moderno (Chrome, Edge, Firefox).
2. Selecciona el proveedor, ingresa un TMDB ID (o usa uno de los ejemplos rápidos como *Deadpool & Wolverine*, *Attack on Titan*, *The Last of Us*).
3. Haz clic en **🚀 Probar Scraper** para inspeccionar las fuentes extraídas y reproducir el stream en el reproductor integrado.

---

## 🤝 Cómo agregar nuevos proveedores de Cloudstream (`storm-ext`)

Si encuentras otro proveedor en `storm-ext` (por ejemplo *HDFull*, *MonosChinos*, *SoloLatino*):

1. **Crea el archivo JS** en `providers/<nombre>.js`.
2. **Implementa `getStreams`**:
   ```javascript
   async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
     // 1. Obtener título en español de TMDB
     // 2. Buscar en la web de streaming
     // 3. Extraer iframes y resolverlos con resolveHostUrl()
     // 4. Retornar array de streams
     return [...];
   }
   module.exports = { getStreams };
   ```
3. **Registra el nuevo proveedor** en `manifest.json`.

---

## 📄 Licencia y Descargo de Responsabilidad

Este proyecto es exclusivamente para fines educativos y de investigación sobre interoperabilidad de plataformas de streaming. Los scrapers no almacenan ningún archivo multimedia en sus servidores.
