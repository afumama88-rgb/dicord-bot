/**
 * 應用程式設定
 */

export const config = {
  // Discord 設定
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    infoCollectChannelId: process.env.DISCORD_INFO_COLLECT_CHANNEL_ID,
    calendarChannelId: process.env.DISCORD_CALENDAR_CHANNEL_ID
  },

  // Notion 設定
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseIds: {
      info: process.env.NOTION_DATABASE_ID_INFO,
      calendar: process.env.NOTION_DATABASE_ID_CALENDAR
    }
  },

  // Google 設定
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    redirectUri: 'http://localhost:3000/callback',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/tasks'
    ],
    timezone: 'Asia/Taipei'
  },

  // Gemini AI 設定
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  },

  // Apify 設定
  apify: {
    apiKey: process.env.APIFY_API_KEY,
    actors: {
      facebook: 'apify/facebook-posts-scraper',
      instagram: 'apify/instagram-api-scraper',
      threads: 'apify/threads-scraper'
    }
  },

  // 伺服器設定
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // 快取設定
  cache: {
    ttl: 3600,        // 1 小時
    checkPeriod: 600  // 10 分鐘
  }
};

/**
 * 驗證必要的環境變數
 */
export function validateConfig() {
  const required = [
    'DISCORD_TOKEN',
    'NOTION_API_KEY',
    'NOTION_DATABASE_ID_INFO',
    'GEMINI_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('缺少必要的環境變數:', missing.join(', '));
    console.error('請參考 .env.example 設定環境變數');
    process.exit(1);
  }

  // 警告選填但建議設定的變數
  const optional = [
    'NOTION_DATABASE_ID_CALENDAR',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'APIFY_API_KEY'
  ];

  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn('以下選填環境變數未設定（部分功能可能無法使用）:', missingOptional.join(', '));
  }
}

export default config;
