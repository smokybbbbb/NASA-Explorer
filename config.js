/* ================================================
   NASA Explorer · config.js
   ================================================ */

const CONFIG = {
  apiKey:    localStorage.getItem('nasa_api_key') || 'nAx4egyzQuHZDpk9e7RHTZoZkReYfrUg3jNpMKkU',
  baseUrl:   'https://api.nasa.gov',
  imagesUrl: 'https://images-api.nasa.gov', // no API key required

  cache: {
    apod:       14 * 3600 * 1000, // 14h — changes once a day
    marsImages:  6 * 3600 * 1000, // 6h
    neo:         2 * 3600 * 1000, // 2h
  },

  mars: {
    query:      'mars perseverance surface',
    yearStart:  '2023',
    photoLimit: 12,
  },

  neo: {
    rangeDays:    6, // stay under NASA's 7-day max
    displayLimit: 12,
  },
};
