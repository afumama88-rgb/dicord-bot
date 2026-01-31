# Discord Bot 完整設計文件 v2.0

> 建立日期：2025-01-30
> 最後更新：2025-01-30
> 技術選型：Node.js + Discord.js v14.25.1
> 部署平台：Zeabur

---

## 目錄

1. [系統架構總覽](#1-系統架構總覽)
2. [技術選型與版本](#2-技術選型與版本)
3. [Discord Server 結構](#3-discord-server-結構)
4. [功能一：資訊收集](#4-功能一資訊收集)
5. [功能二：行事曆助手](#5-功能二行事曆助手)
6. [Notion 資料庫設計](#6-notion-資料庫設計)
7. [Discord 互動元件設計](#7-discord-互動元件設計)
8. [錯誤處理策略](#8-錯誤處理策略)
9. [環境變數配置](#9-環境變數配置)
10. [專案檔案結構](#10-專案檔案結構)
11. [部署規劃](#11-部署規劃)
12. [未來擴充](#12-未來擴充)

---

## 1. 系統架構總覽

### 1.1 整體架構圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            使用者互動層                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │ #資訊收集   │  │ #行事曆助手  │  │ #bot-通知   │                      │
│  │ 頻道        │  │ 頻道        │  │ 頻道        │                      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                      │
└─────────┼────────────────┼────────────────┼─────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Discord Bot (Node.js + discord.js 14.25.1)          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        事件處理層 (Events)                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │messageCreate │  │interaction   │  │messageReaction│             │ │
│  │  │監聽新訊息     │  │Create        │  │Add           │              │ │
│  │  │              │  │按鈕/選單互動  │  │反應事件       │              │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │ │
│  └─────────┼─────────────────┼─────────────────┼──────────────────────┘ │
│            │                 │                 │                        │
│            ▼                 ▼                 ▼                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        處理器層 (Handlers)                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │UrlHandler    │  │MediaHandler  │  │TextHandler   │              │ │
│  │  │處理各類連結   │  │處理圖片/PDF  │  │處理純文字    │              │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │ │
│  └─────────┼─────────────────┼─────────────────┼──────────────────────┘ │
│            │                 │                 │                        │
│            ▼                 ▼                 ▼                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        服務層 (Services)                            │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │ │
│  │  │ Notion  │ │ Google  │ │ Gemini  │ │ Apify   │ │Scraper  │      │ │
│  │  │ Service │ │ Service │ │ Service │ │ Service │ │Service  │      │ │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘      │ │
│  └───────┼───────────┼───────────┼───────────┼───────────┼────────────┘ │
└──────────┼───────────┼───────────┼───────────┼───────────┼──────────────┘
           │           │           │           │           │
           ▼           ▼           ▼           ▼           ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Notion     │ │   Google     │ │   Gemini     │ │   Apify      │
│   API        │ │ Calendar API │ │   API        │ │   API        │
│   v2025-09-03│ │ Tasks API    │ │ 2.5-flash    │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 1.2 資料流向

**資訊收集流程：**
```
使用者貼連結 → Bot 偵測 URL 類型 → 對應爬蟲抓取 → AI 生成摘要 → 存入 Notion → 回覆 Embed
```

**行事曆助手流程：**
```
使用者傳送文字/圖片/PDF → Gemini 2.5 Flash 解析 → 提取日期資訊 → 顯示預覽 Embed
→ 使用者點選按鈕 → 建立 Google Calendar/Tasks + 存入 Notion → 回覆確認
```

---

## 2. 技術選型與版本

### 2.1 核心套件版本（2025-01-30 最新）

| 套件 | 版本 | 用途 | 備註 |
|------|------|------|------|
| `discord.js` | 14.25.1 | Discord Bot 框架 | 最新穩定版 |
| `@google/genai` | 1.37.0 | Gemini AI API | **新版套件**，取代已棄用的 @google/generative-ai |
| `@notionhq/client` | 5.7.0 | Notion API | 對應 API v2025-09-03 |
| `googleapis` | latest | Google Calendar/Tasks | OAuth2 認證 |
| `apify-client` | latest | 社群媒體爬蟲 | FB/IG/Threads |
| `cheerio` | latest | 靜態網頁解析 | 輕量快速 |
| `playwright` | latest | 動態網頁爬蟲 | 備用方案 |
| `pdf-parse` | latest | PDF 文字提取 | - |

### 2.2 Gemini 模型選擇

| 模型 | 用途 | 備註 |
|------|------|------|
| `gemini-2.5-flash` | **主要使用** | 穩定、價格低、速度快 |
| `gemini-3-flash-preview` | 備用升級 | 效能更好但仍在預覽 |

**⚠️ 重要：`@google/generative-ai` 已棄用，必須使用 `@google/genai`**

### 2.3 API 版本對應

| 服務 | API 版本 | SDK 版本 |
|------|---------|---------|
| Notion | 2025-09-03 | v5.7.0 |
| Discord | v10 | discord.js 14.25.1 |
| Google Calendar | v3 | googleapis latest |
| Google Tasks | v1 | googleapis latest |

---

## 3. Discord Server 結構

### 3.1 頻道配置

```
📁 ═══ 自動化工具 ═══
├── #資訊收集          [文字頻道]
│   └── 用途：貼連結（YT/FB/IG/Threads/網頁）、文字筆記
│   └── Bot 權限：讀取訊息、發送訊息、嵌入連結、添加反應、管理訊息
│
├── #行事曆助手        [文字頻道]
│   └── 用途：丟文字/圖片/PDF，AI 解析後建立行事曆
│   └── Bot 權限：讀取訊息、發送訊息、嵌入連結、附加檔案、添加反應
│
└── #bot-通知          [文字頻道]
    └── 用途：Bot 系統訊息、錯誤回報
    └── Bot 權限：發送訊息、嵌入連結
```

### 3.2 Bot 權限需求

**Developer Portal 設定：**
1. 進入 Bot 頁面
2. 開啟 **Privileged Gateway Intents**:
   - ✅ MESSAGE CONTENT INTENT（必須！）
   - ✅ SERVER MEMBERS INTENT（選填）

**程式碼 Intents 設定：**
```javascript
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,      // 必須在 Portal 開啟
    GatewayIntentBits.GuildMessageReactions
  ]
});
```

**OAuth2 邀請連結權限（Permissions Integer: 277025770560）：**
- Read Messages/View Channels
- Send Messages
- Embed Links
- Attach Files
- Add Reactions
- Use External Emojis
- Manage Messages
- Read Message History

---

## 4. 功能一：資訊收集

### 4.1 支援的內容類型

| 類型 | 偵測方式 | 處理方法 | Notion type 欄位 |
|------|---------|---------|-----------------|
| YouTube | `youtube.com`, `youtu.be` | oEmbed + 縮圖 URL | `YT` |
| Facebook | `facebook.com`, `fb.watch` | Apify Scraper | `FB` |
| Instagram | `instagram.com` | Apify Scraper | `IG` |
| Threads | `threads.net` | Apify Scraper | `TH` |
| 一般網頁 | 其他 URL | Cheerio + Readability | `網路文章` |
| 純文字筆記 | 無 URL | 直接存入 | `文字速記` |

### 4.2 URL 解析邏輯

```javascript
// utils/urlParser.js

const URL_PATTERNS = {
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/
  ],
  facebook: [
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.+/,
    /(?:https?:\/\/)?(?:www\.)?fb\.watch\/.+/,
    /(?:https?:\/\/)?(?:www\.)?fb\.com\/.+/
  ],
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/
  ],
  threads: [
    /(?:https?:\/\/)?(?:www\.)?threads\.net\/@?[\w.]+\/post\/([a-zA-Z0-9_-]+)/
  ]
};

/**
 * 解析 URL 類型
 * @param {string} url - 要解析的 URL
 * @returns {{ type: string, url: string, match: RegExpMatchArray | null } | null}
 */
function parseUrl(url) {
  for (const [type, patterns] of Object.entries(URL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return { type, url, match: url.match(pattern) };
      }
    }
  }

  // 如果是有效 URL 但不符合上述，視為一般網頁
  if (/^https?:\/\/.+/.test(url)) {
    return { type: 'web', url, match: null };
  }

  return null;
}

/**
 * 從文字中提取所有 URL
 * @param {string} text - 要解析的文字
 * @returns {string[]}
 */
function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<>\"{}|\\^`\[\]]+/g;
  return text.match(urlRegex) || [];
}

module.exports = { parseUrl, extractUrls, URL_PATTERNS };
```

### 4.3 YouTube 處理（無需 API Key）

```javascript
// services/youtube.js

/**
 * 從 YouTube URL 提取影片 ID
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * 使用 oEmbed 取得 YouTube 影片資訊（免費、無需 API Key）
 */
async function getYouTubeInfo(url) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('無效的 YouTube URL');

  // 方法一：oEmbed API（最穩定）
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

  try {
    const response = await fetch(oembedUrl);
    if (!response.ok) throw new Error('oEmbed 請求失敗');

    const data = await response.json();

    return {
      title: data.title,
      author: data.author_name,
      authorUrl: data.author_url,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      url: url,
      videoId: videoId,
      type: 'YT'
    };
  } catch (error) {
    // 備用方案：直接構建基本資訊
    return {
      title: '無法取得標題',
      author: '未知',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      url: url,
      videoId: videoId,
      type: 'YT'
    };
  }
}

module.exports = { extractVideoId, getYouTubeInfo };
```

### 4.4 社群媒體處理（Apify）

```javascript
// services/apify.js

const { ApifyClient } = require('apify-client');

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_KEY
});

const APIFY_ACTORS = {
  facebook: 'apify/facebook-posts-scraper',
  instagram: 'apify/instagram-api-scraper',
  threads: 'apify/threads-scraper'
};

/**
 * 使用 Apify 爬取社群媒體貼文
 * @param {string} url - 貼文 URL
 * @param {'facebook' | 'instagram' | 'threads'} platform - 平台類型
 */
async function scrapeSocialMedia(url, platform) {
  const actorId = APIFY_ACTORS[platform];
  if (!actorId) throw new Error(`不支援的平台: ${platform}`);

  try {
    const run = await apifyClient.actor(actorId).call({
      startUrls: [{ url }],
      resultsLimit: 1
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error('無法取得貼文內容');
    }

    const post = items[0];

    return {
      title: post.text?.slice(0, 100) || '無標題',
      description: post.text || '',
      thumbnail: post.imageUrl || post.thumbnailUrl || post.displayUrl,
      author: post.authorName || post.ownerUsername || post.username,
      url: url,
      type: platform.toUpperCase().slice(0, 2), // FB, IG, TH
      likes: post.likesCount || post.likeCount,
      comments: post.commentsCount || post.commentCount,
      timestamp: post.timestamp || post.takenAt
    };
  } catch (error) {
    console.error(`Apify 爬取失敗 (${platform}):`, error.message);

    // 降級處理：只儲存 URL
    return {
      title: `${platform} 貼文`,
      description: '無法擷取內容',
      url: url,
      type: platform.toUpperCase().slice(0, 2),
      error: error.message
    };
  }
}

module.exports = { scrapeSocialMedia, APIFY_ACTORS };
```

### 4.5 一般網頁處理

```javascript
// services/scraper.js

const cheerio = require('cheerio');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

/**
 * 爬取一般網頁內容
 * @param {string} url - 網頁 URL
 */
async function scrapeWebPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  // 使用 Cheerio 提取 Open Graph 標籤
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');

  // 使用 Readability 提取主要內容
  let article = null;
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    article = reader.parse();
  } catch (e) {
    console.warn('Readability 解析失敗:', e.message);
  }

  return {
    title: ogTitle || article?.title || $('title').text() || '未知標題',
    description: ogDescription || article?.excerpt || '',
    content: article?.textContent?.slice(0, 5000), // 限制長度
    thumbnail: ogImage,
    author: article?.byline || $('meta[name="author"]').attr('content'),
    url: url,
    type: '網路文章',
    siteName: ogSiteName
  };
}

module.exports = { scrapeWebPage };
```

### 4.6 反應互動功能

```javascript
// events/messageReactionAdd.js

const REACTION_ACTIONS = {
  '📌': 'markImportant',    // 標記重要 → Notion priority: 高
  '✅': 'markRead',         // 標記已讀 → Notion status: 已讀
  '🗑️': 'deleteFromNotion', // 從 Notion 刪除（封存）
};

/**
 * 處理反應事件
 */
async function handleReactionAdd(reaction, user, notionService) {
  // 忽略 Bot 自己的反應
  if (user.bot) return;

  const action = REACTION_ACTIONS[reaction.emoji.name];
  if (!action) return;

  // 從 Embed footer 取得 Notion page ID
  const embed = reaction.message.embeds[0];
  if (!embed?.footer?.text) return;

  const match = embed.footer.text.match(/ID: ([a-f0-9-]+)/);
  if (!match) return;

  const notionPageId = match[1];

  try {
    switch (action) {
      case 'markImportant':
        await notionService.updatePage(notionPageId, {
          '優先級': { select: { name: '高' } }
        });
        break;

      case 'markRead':
        await notionService.updatePage(notionPageId, {
          'status': { select: { name: '已讀' } }
        });
        break;

      case 'deleteFromNotion':
        await notionService.archivePage(notionPageId);
        await reaction.message.react('🗑️');
        break;
    }
  } catch (error) {
    console.error('反應處理失敗:', error);
  }
}

module.exports = { handleReactionAdd, REACTION_ACTIONS };
```

---

## 5. 功能二：行事曆助手

### 5.1 支援的輸入類型

| 輸入類型 | 處理方式 | 範例 |
|---------|---------|------|
| 純文字 | Gemini 2.5 Flash 解析 | 「下週三下午兩點要開會」 |
| 圖片 | Gemini 2.5 Flash Vision | 研習海報照片 |
| PDF | pdf-parse 轉文字 + Gemini | 公文 PDF 檔案 |

### 5.2 Gemini 服務（使用新版 @google/genai）

```javascript
// services/gemini.js

const { GoogleGenAI } = require('@google/genai');
const fs = require('node:fs');

// 初始化 Gemini 客戶端
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 模型設定（可透過環境變數切換）
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * 行事曆資訊提取 Prompt
 */
const CALENDAR_EXTRACTION_PROMPT = `
你是一個專業的行政助理，專門從文字或圖片中提取行事曆相關資訊。

請從以下內容中提取：
1. 活動/任務名稱
2. 日期（請轉換為 YYYY-MM-DD 格式）
3. 時間（如有，請轉換為 HH:MM 格式）
4. 結束時間（如有）
5. 地點（如有）
6. 重要截止日期（如報名截止日）
7. 聯絡人資訊（如有）
8. 這是「活動」還是「任務」？
   - 活動：有明確的舉辦時間，需要出席
   - 任務：需要在某個期限前完成的事項

請以 JSON 格式回覆，不要包含 markdown code block：
{
  "title": "活動/任務名稱",
  "type": "event" | "task",
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:MM" | null,
  "endDate": "YYYY-MM-DD" | null,
  "endTime": "HH:MM" | null,
  "location": "地點" | null,
  "deadline": "YYYY-MM-DD" | null,
  "deadlineDescription": "截止事項說明" | null,
  "contact": {
    "name": "聯絡人" | null,
    "phone": "電話" | null,
    "email": "信箱" | null
  },
  "priority": "高" | "中" | "低",
  "summary": "50字以內的摘要",
  "confidence": 0.0-1.0
}

如果無法確定某個欄位，請設為 null。
如果內容中沒有任何日期資訊，請將 confidence 設為 0。

今天日期：${new Date().toISOString().split('T')[0]}
`;

/**
 * 從文字中提取行事曆資訊
 * @param {string} text - 要分析的文字
 */
async function extractCalendarFromText(text) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: CALENDAR_EXTRACTION_PROMPT },
      { text: `\n\n以下是要分析的內容：\n${text}` }
    ]
  });

  return parseGeminiResponse(response.text);
}

/**
 * 從圖片中提取行事曆資訊
 * @param {Buffer} imageBuffer - 圖片 Buffer
 * @param {string} mimeType - 圖片 MIME 類型
 */
async function extractCalendarFromImage(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: CALENDAR_EXTRACTION_PROMPT },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      }
    ]
  });

  return parseGeminiResponse(response.text);
}

/**
 * 生成文字摘要（用於文字筆記標題）
 * @param {string} text - 要摘要的文字
 * @param {number} maxLength - 最大長度
 */
async function generateSummary(text, maxLength = 50) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: `請用不超過 ${maxLength} 個字摘要以下內容，只回覆摘要文字，不要加引號或其他格式：\n\n${text}` }
    ]
  });

  return response.text.trim().slice(0, maxLength);
}

/**
 * 解析 Gemini 回應
 */
function parseGeminiResponse(responseText) {
  // 移除可能的 markdown code block
  let jsonStr = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Gemini 回應解析失敗:', responseText);
    throw new Error('AI 回應格式錯誤');
  }
}

module.exports = {
  extractCalendarFromText,
  extractCalendarFromImage,
  generateSummary,
  MODEL
};
```

### 5.3 圖片處理流程

```javascript
// handlers/mediaHandler.js

const geminiService = require('../services/gemini');
const { cacheAnalysis } = require('../utils/cache');
const { createCalendarPreview } = require('../components/embeds/calendarPreviewEmbed');

// 支援的圖片類型
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif'
];

/**
 * 處理圖片訊息
 */
async function handleImageMessage(message) {
  const attachment = message.attachments.first();

  // 驗證檔案類型
  if (!SUPPORTED_IMAGE_TYPES.includes(attachment.contentType)) {
    return await message.reply('❌ 不支援的圖片格式。支援：JPG、PNG、GIF、WebP、HEIC');
  }

  // 驗證檔案大小（Gemini 限制 20MB）
  const MAX_SIZE = 20 * 1024 * 1024;
  if (attachment.size > MAX_SIZE) {
    return await message.reply('❌ 圖片太大，請使用小於 20MB 的圖片');
  }

  // 加上處理中反應
  await message.react('⏳');

  try {
    // 下載圖片
    const response = await fetch(attachment.url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 送給 Gemini Vision 解析
    const calendarData = await geminiService.extractCalendarFromImage(
      buffer,
      attachment.contentType
    );

    // 移除處理中反應
    await message.reactions.cache.get('⏳')?.remove();

    // 檢查信心度
    if (calendarData.confidence < 0.3) {
      return await message.reply({
        content: '⚠️ 無法從圖片中識別出日期資訊。\n請確認圖片內容清晰，或改用文字輸入。'
      });
    }

    // 快取解析結果（供按鈕互動使用，TTL 1 小時）
    await cacheAnalysis(message.id, calendarData);

    // 顯示預覽 Embed 和按鈕
    const { embed, components } = createCalendarPreview(calendarData);

    await message.reply({
      embeds: [embed],
      components: components
    });

  } catch (error) {
    console.error('圖片處理失敗:', error);
    await message.reactions.cache.get('⏳')?.remove();
    await message.react('❌');
    await message.reply(`❌ 處理失敗：${error.message}`);
  }
}

module.exports = { handleImageMessage, SUPPORTED_IMAGE_TYPES };
```

### 5.4 PDF 處理流程

```javascript
// handlers/mediaHandler.js (續)

const pdfParse = require('pdf-parse');

/**
 * 處理 PDF 訊息
 */
async function handlePdfMessage(message) {
  const attachment = message.attachments.first();

  // 驗證檔案類型
  if (attachment.contentType !== 'application/pdf') {
    return;
  }

  // 驗證檔案大小
  const MAX_SIZE = 10 * 1024 * 1024;
  if (attachment.size > MAX_SIZE) {
    return await message.reply('❌ PDF 太大，請使用小於 10MB 的檔案');
  }

  await message.react('⏳');

  try {
    // 下載 PDF
    const response = await fetch(attachment.url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 解析 PDF 文字
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    if (!text || text.trim().length < 10) {
      await message.reactions.cache.get('⏳')?.remove();
      return await message.reply('⚠️ 無法從 PDF 中提取文字。可能是掃描檔或圖片 PDF，請改用圖片方式上傳。');
    }

    // 送給 Gemini 解析
    const calendarData = await geminiService.extractCalendarFromText(text);

    await message.reactions.cache.get('⏳')?.remove();

    if (calendarData.confidence < 0.3) {
      return await message.reply('⚠️ 無法從 PDF 中識別出日期資訊');
    }

    await cacheAnalysis(message.id, calendarData);

    const { embed, components } = createCalendarPreview(calendarData);
    await message.reply({ embeds: [embed], components: components });

  } catch (error) {
    console.error('PDF 處理失敗:', error);
    await message.reactions.cache.get('⏳')?.remove();
    await message.react('❌');
    await message.reply(`❌ PDF 處理失敗：${error.message}`);
  }
}

module.exports = { handleImageMessage, handlePdfMessage, SUPPORTED_IMAGE_TYPES };
```

### 5.5 Google Calendar / Tasks 整合

```javascript
// services/google.js

const { google } = require('googleapis');

// OAuth2 設定
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);

// 設定 refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// 建立服務實例
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

/**
 * 建立 Google Calendar 活動
 * @param {Object} eventData - 活動資料
 */
async function createCalendarEvent(eventData) {
  const event = {
    summary: eventData.title,
    location: eventData.location || undefined,
    description: eventData.summary || undefined,
    start: {
      dateTime: eventData.startTime
        ? `${eventData.startDate}T${eventData.startTime}:00`
        : undefined,
      date: eventData.startTime ? undefined : eventData.startDate,
      timeZone: 'Asia/Taipei'
    },
    end: {
      dateTime: eventData.endTime
        ? `${eventData.endDate || eventData.startDate}T${eventData.endTime}:00`
        : eventData.startTime
          ? `${eventData.startDate}T${addHour(eventData.startTime)}:00`
          : undefined,
      date: eventData.startTime ? undefined : eventData.endDate || eventData.startDate,
      timeZone: 'Asia/Taipei'
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },    // 1 小時前
        { method: 'popup', minutes: 1440 }   // 1 天前
      ]
    }
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event
  });

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink
  };
}

/**
 * 建立 Google Task
 * @param {Object} taskData - 任務資料
 */
async function createTask(taskData) {
  // 先取得預設任務清單
  const taskLists = await tasks.tasklists.list();
  const defaultList = taskLists.data.items?.[0];

  if (!defaultList) {
    throw new Error('找不到 Google Tasks 清單');
  }

  const task = {
    title: taskData.title,
    notes: taskData.summary || undefined,
    due: taskData.deadline
      ? new Date(taskData.deadline).toISOString()
      : taskData.startDate
        ? new Date(taskData.startDate).toISOString()
        : undefined
  };

  const response = await tasks.tasks.insert({
    tasklist: defaultList.id,
    resource: task
  });

  return {
    id: response.data.id,
    title: response.data.title
  };
}

/**
 * 輔助函式：時間加一小時
 */
function addHour(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const newHours = (hours + 1) % 24;
  return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

module.exports = { createCalendarEvent, createTask, oauth2Client };
```

### 5.6 按鈕互動處理

```javascript
// events/interactionCreate.js

const { cacheGet, cacheDelete } = require('../utils/cache');
const googleService = require('../services/google');
const notionService = require('../services/notion');
const { createSuccessEmbed } = require('../components/embeds/successEmbed');

/**
 * 處理行事曆相關按鈕互動
 */
async function handleCalendarInteraction(interaction) {
  const { customId } = interaction;

  // 取得原始訊息 ID（用於從 cache 取得資料）
  const originalMessageId = interaction.message.reference?.messageId;

  if (!originalMessageId) {
    return await interaction.reply({
      content: '❌ 無法找到原始訊息',
      ephemeral: true
    });
  }

  // 從 cache 取得解析資料
  const calendarData = await cacheGet(originalMessageId);

  if (!calendarData) {
    return await interaction.reply({
      content: '❌ 資料已過期，請重新傳送內容',
      ephemeral: true
    });
  }

  // 延遲回應（處理中）
  await interaction.deferUpdate();

  try {
    let result = {};

    switch (customId) {
      case 'calendar_add_event': {
        // 新增到 Google Calendar
        const event = await googleService.createCalendarEvent(calendarData);
        result.calendar = event;

        // 同時存入 Notion
        const notionPage = await notionService.createTaskPage({
          ...calendarData,
          type: '活動',
          googleLink: event.htmlLink
        });
        result.notion = notionPage;
        break;
      }

      case 'calendar_add_task': {
        // 新增到 Google Tasks
        const task = await googleService.createTask(calendarData);
        result.task = task;

        // 同時存入 Notion
        const notionPage = await notionService.createTaskPage({
          ...calendarData,
          type: '任務'
        });
        result.notion = notionPage;
        break;
      }

      case 'calendar_notion_only': {
        // 只存 Notion
        const notionPage = await notionService.createTaskPage(calendarData);
        result.notion = notionPage;
        break;
      }

      case 'calendar_cancel': {
        await cacheDelete(originalMessageId);
        return await interaction.editReply({
          content: '❌ 已取消',
          embeds: [],
          components: []
        });
      }
    }

    // 清除 cache
    await cacheDelete(originalMessageId);

    // 顯示成功訊息
    const successEmbed = createSuccessEmbed(result);
    await interaction.editReply({
      embeds: [successEmbed],
      components: []
    });

  } catch (error) {
    console.error('互動處理失敗:', error);
    await interaction.editReply({
      content: `❌ 操作失敗：${error.message}`,
      embeds: [],
      components: []
    });
  }
}

module.exports = { handleCalendarInteraction };
```

---

## 6. Notion 資料庫設計

### 6.1 資料庫 A：資訊收集

**使用你現有的 Line Agent 資料庫，新增 `source` 欄位區分來源**

| 欄位名稱 | 類型 | 說明 | 新增/保留 |
|---------|------|------|----------|
| `title` | Title | 文章/影片標題 | 保留 |
| `date` | Date | 儲存日期 | 保留 |
| `type` | Select | FB/IG/TH/YT/網路文章/文字速記 | 保留 |
| `url` | URL | 原始連結 | 保留 |
| `Author` | Multi-select | 作者/頻道名稱 | 保留 |
| `photo` | Files & media | 縮圖 | 保留 |
| `source` | Select | **Line / Discord** | **新增** |
| `status` | Select | 未讀/已讀（選填） | 選填新增 |

### 6.2 資料庫 B：行事曆/任務

**沿用你 document-processor-plus 的結構**

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `Name` | Title | 活動/任務名稱 |
| `日期` | Date | 活動日期或截止日 |
| `類型` | Select | 活動 / 任務 |
| `優先級` | Select | 高 / 中 / 低 |
| `狀態` | Select | 待處理 / 進行中 / 已完成 |
| `來源` | Select | Discord / 公文系統 / 手動 |
| `Google連結` | URL | Google Calendar/Tasks 連結 |

### 6.3 Notion 服務實作

```javascript
// services/notion.js

const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const INFO_DATABASE_ID = process.env.NOTION_DATABASE_ID_INFO;
const CALENDAR_DATABASE_ID = process.env.NOTION_DATABASE_ID_CALENDAR;

/**
 * 建立資訊收集頁面（#資訊收集 頻道用）
 */
async function createInfoPage(data) {
  const properties = {
    title: {
      title: [{ text: { content: data.title || '無標題' } }]
    },
    date: {
      date: { start: new Date().toISOString().split('T')[0] }
    },
    type: {
      select: { name: data.type || '網路文章' }
    },
    source: {
      select: { name: 'Discord' }
    }
  };

  // 選填欄位
  if (data.url) {
    properties.url = { url: data.url };
  }

  if (data.author) {
    properties.Author = {
      multi_select: [{ name: data.author }]
    };
  }

  const response = await notion.pages.create({
    parent: { database_id: INFO_DATABASE_ID },
    properties: properties,
    // 頁面內容
    children: buildInfoPageContent(data)
  });

  return {
    id: response.id,
    url: response.url
  };
}

/**
 * 建立行事曆/任務頁面（#行事曆助手 頻道用）
 */
async function createTaskPage(data) {
  const properties = {
    Name: {
      title: [{ text: { content: data.title } }]
    },
    '日期': {
      date: {
        start: data.startDate,
        end: data.endDate || undefined
      }
    },
    '類型': {
      select: { name: data.type === 'event' ? '活動' : '任務' }
    },
    '優先級': {
      select: { name: data.priority || '中' }
    },
    '狀態': {
      select: { name: '待處理' }
    },
    '來源': {
      select: { name: 'Discord' }
    }
  };

  if (data.googleLink) {
    properties['Google連結'] = { url: data.googleLink };
  }

  const response = await notion.pages.create({
    parent: { database_id: CALENDAR_DATABASE_ID },
    properties: properties,
    children: buildTaskPageContent(data)
  });

  return {
    id: response.id,
    url: response.url
  };
}

/**
 * 更新頁面屬性
 */
async function updatePage(pageId, properties) {
  return await notion.pages.update({
    page_id: pageId,
    properties: properties
  });
}

/**
 * 封存頁面（軟刪除）
 */
async function archivePage(pageId) {
  return await notion.pages.update({
    page_id: pageId,
    archived: true
  });
}

/**
 * 建立資訊頁面內容區塊
 */
function buildInfoPageContent(data) {
  const blocks = [];

  // 摘要（如果有）
  if (data.description) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: data.description.slice(0, 2000) } }]
      }
    });
  }

  // 分隔線
  blocks.push({ object: 'block', type: 'divider', divider: {} });

  // 來源標記
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '由 Discord Bot 自動建立' },
        annotations: { italic: true, color: 'gray' }
      }]
    }
  });

  return blocks;
}

/**
 * 建立任務頁面內容區塊
 */
function buildTaskPageContent(data) {
  const blocks = [];

  // 摘要 Callout
  if (data.summary) {
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{ type: 'text', text: { content: data.summary } }],
        icon: { type: 'emoji', emoji: '📋' }
      }
    });
  }

  // 地點（如果有）
  if (data.location) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '📍 地點：' }, annotations: { bold: true } },
          { type: 'text', text: { content: data.location } }
        ]
      }
    });
  }

  // 聯絡資訊（如果有）
  if (data.contact && (data.contact.name || data.contact.phone || data.contact.email)) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: '聯絡資訊' } }]
      }
    });

    const contactLines = [];
    if (data.contact.name) contactLines.push(`承辦人：${data.contact.name}`);
    if (data.contact.phone) contactLines.push(`電話：${data.contact.phone}`);
    if (data.contact.email) contactLines.push(`信箱：${data.contact.email}`);

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: contactLines.join('\n') } }]
      }
    });
  }

  // 分隔線
  blocks.push({ object: 'block', type: 'divider', divider: {} });

  // 來源標記
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '由 Discord Bot 自動建立' },
        annotations: { italic: true, color: 'gray' }
      }]
    }
  });

  return blocks;
}

module.exports = {
  createInfoPage,
  createTaskPage,
  updatePage,
  archivePage
};
```

---

## 7. Discord 互動元件設計

### 7.1 資訊收集成功 Embed

```javascript
// components/embeds/infoCollectEmbed.js

const { EmbedBuilder } = require('discord.js');

const TYPE_COLORS = {
  'YT': 0xFF0000,       // YouTube 紅
  'FB': 0x1877F2,       // Facebook 藍
  'IG': 0xE4405F,       // Instagram 粉紅
  'TH': 0x000000,       // Threads 黑
  '網路文章': 0x00AA00,  // 綠色
  '文字速記': 0x808080   // 灰色
};

/**
 * 建立資訊收集成功 Embed
 */
function createInfoCollectEmbed(data) {
  const color = TYPE_COLORS[data.type] || 0x5865F2;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(truncate(data.title, 256))
    .setDescription(truncate(data.description, 200) || '無描述')
    .addFields(
      { name: '類型', value: data.type, inline: true },
      { name: '作者', value: data.author || '未知', inline: true },
      { name: '來源', value: 'Discord', inline: true }
    )
    .setFooter({ text: `Notion ID: ${data.notionPageId}` })
    .setTimestamp();

  if (data.url) {
    embed.setURL(data.url);
  }

  if (data.thumbnail) {
    embed.setThumbnail(data.thumbnail);
  }

  if (data.notionUrl) {
    embed.addFields({
      name: '📝 Notion',
      value: `[查看頁面](${data.notionUrl})`,
      inline: true
    });
  }

  return embed;
}

function truncate(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength - 3) + '...' : str;
}

module.exports = { createInfoCollectEmbed, TYPE_COLORS };
```

### 7.2 行事曆預覽 Embed + 按鈕

```javascript
// components/embeds/calendarPreviewEmbed.js

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

/**
 * 建立行事曆預覽 Embed 和按鈕
 */
function createCalendarPreview(data) {
  const embed = new EmbedBuilder()
    .setColor(0x4285F4) // Google 藍
    .setTitle('📋 解析結果')
    .addFields(
      { name: '📌 標題', value: data.title || '未知', inline: false },
      { name: '📅 日期', value: formatDate(data.startDate), inline: true },
      { name: '🕐 時間', value: data.startTime || '未指定', inline: true },
      { name: '📍 地點', value: data.location || '未指定', inline: true }
    );

  // 截止日期（如果有）
  if (data.deadline) {
    embed.addFields({
      name: '⏰ 截止日期',
      value: `${formatDate(data.deadline)}${data.deadlineDescription ? ` (${data.deadlineDescription})` : ''}`,
      inline: false
    });
  }

  // 摘要（如果有）
  if (data.summary) {
    embed.addFields({
      name: '📝 摘要',
      value: data.summary,
      inline: false
    });
  }

  // 信心度
  const confidencePercent = Math.round((data.confidence || 0) * 100);
  embed.setFooter({
    text: `信心度：${confidencePercent}% | 請確認後選擇操作`
  });

  // 按鈕
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('calendar_add_event')
      .setLabel('📅 加到行事曆')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('calendar_add_task')
      .setLabel('✅ 加到 Tasks')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('calendar_notion_only')
      .setLabel('📝 只存 Notion')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('calendar_cancel')
      .setLabel('❌ 取消')
      .setStyle(ButtonStyle.Danger)
  );

  return {
    embed,
    components: [row1, row2]
  };
}

function formatDate(dateStr) {
  if (!dateStr) return '未指定';

  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    });
  } catch {
    return dateStr;
  }
}

module.exports = { createCalendarPreview };
```

### 7.3 成功 Embed

```javascript
// components/embeds/successEmbed.js

const { EmbedBuilder } = require('discord.js');

/**
 * 建立操作成功 Embed
 */
function createSuccessEmbed(result) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ 操作成功')
    .setTimestamp();

  const fields = [];

  if (result.calendar) {
    fields.push({
      name: '📅 Google Calendar',
      value: `[查看活動](${result.calendar.htmlLink})`,
      inline: true
    });
  }

  if (result.task) {
    fields.push({
      name: '✅ Google Tasks',
      value: '已新增任務',
      inline: true
    });
  }

  if (result.notion) {
    fields.push({
      name: '📝 Notion',
      value: `[查看頁面](${result.notion.url})`,
      inline: true
    });
  }

  embed.addFields(fields);

  return embed;
}

module.exports = { createSuccessEmbed };
```

---

## 8. 錯誤處理策略

### 8.1 錯誤分類與處理

| 錯誤類型 | 處理方式 | 使用者回饋 |
|---------|---------|-----------|
| 網路錯誤 | 重試 3 次 | 「⏳ 網路連線問題，正在重試...」 |
| API 限流 | 等待後重試 | 「⏳ 服務忙碌中，請稍後再試」 |
| 無效 URL | 直接回報 | 「❌ 無法辨識的連結格式」 |
| 爬蟲失敗 | 降級處理 | 「⚠️ 無法擷取內容，已儲存連結」 |
| AI 解析失敗 | 降級處理 | 「⚠️ AI 無法解析，請嘗試其他方式」 |
| Notion 錯誤 | 記錄 + 通知 | 「❌ 儲存失敗，請稍後再試」 |
| Google 錯誤 | 記錄 + 通知 | 「❌ Google 服務連線失敗」 |

### 8.2 重試機制

```javascript
// utils/retry.js

/**
 * 帶重試的非同步函式執行
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry = () => {}
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 不重試的錯誤類型
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        throw error;
      }

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        onRetry(attempt, waitTime, error);
        await sleep(waitTime);
      }
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { withRetry, sleep };
```

### 8.3 快取機制

```javascript
// utils/cache.js

const NodeCache = require('node-cache');

// TTL 1 小時，檢查週期 10 分鐘
const cache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600
});

/**
 * 儲存解析結果
 */
async function cacheAnalysis(messageId, data) {
  cache.set(`analysis:${messageId}`, data);
}

/**
 * 取得解析結果
 */
async function cacheGet(messageId) {
  return cache.get(`analysis:${messageId}`);
}

/**
 * 刪除快取
 */
async function cacheDelete(messageId) {
  cache.del(`analysis:${messageId}`);
}

module.exports = { cacheAnalysis, cacheGet, cacheDelete };
```

---

## 9. 環境變數配置

### 9.1 .env.example

```env
# ===== Discord =====
# 從 https://discord.com/developers/applications 取得
DISCORD_TOKEN=你的_Discord_Bot_Token
DISCORD_CLIENT_ID=你的_Discord_Application_ID

# ===== Notion =====
# 從 https://www.notion.so/my-integrations 取得
NOTION_API_KEY=你的_Notion_Integration_Token
NOTION_DATABASE_ID_INFO=資訊收集資料庫_ID
NOTION_DATABASE_ID_CALENDAR=行事曆資料庫_ID

# ===== Google OAuth =====
# 從 Google Cloud Console 取得
GOOGLE_CLIENT_ID=你的_Google_OAuth_Client_ID
GOOGLE_CLIENT_SECRET=你的_Google_OAuth_Client_Secret
GOOGLE_REFRESH_TOKEN=你的_Google_Refresh_Token

# ===== Gemini AI =====
# 從 https://aistudio.google.com/apikey 取得
GEMINI_API_KEY=你的_Gemini_API_Key
GEMINI_MODEL=gemini-2.5-flash

# ===== Apify（選填）=====
# 從 https://console.apify.com/account/integrations 取得
APIFY_API_KEY=你的_Apify_API_Key

# ===== 伺服器設定 =====
PORT=3000
NODE_ENV=development
```

---

## 10. 專案檔案結構

```
discord-bot/
├── src/
│   ├── index.js                    # 入口點
│   │
│   ├── config/
│   │   └── index.js                # 設定管理
│   │
│   ├── events/                     # Discord 事件
│   │   ├── ready.js                # Bot 啟動
│   │   ├── messageCreate.js        # 新訊息
│   │   ├── interactionCreate.js    # 按鈕/選單互動
│   │   └── messageReactionAdd.js   # 反應事件
│   │
│   ├── handlers/                   # 訊息處理器
│   │   ├── infoCollectHandler.js   # #資訊收集 處理
│   │   ├── calendarHandler.js      # #行事曆助手 處理
│   │   ├── urlHandler.js           # URL 處理
│   │   ├── mediaHandler.js         # 圖片/PDF 處理
│   │   └── textHandler.js          # 純文字處理
│   │
│   ├── services/                   # 外部服務
│   │   ├── notion.js               # Notion API
│   │   ├── google.js               # Google Calendar/Tasks
│   │   ├── gemini.js               # Gemini AI
│   │   ├── apify.js                # Apify 爬蟲
│   │   ├── youtube.js              # YouTube 處理
│   │   └── scraper.js              # 網頁爬蟲
│   │
│   ├── components/                 # Discord 元件
│   │   └── embeds/
│   │       ├── infoCollectEmbed.js
│   │       ├── calendarPreviewEmbed.js
│   │       └── successEmbed.js
│   │
│   └── utils/                      # 工具函式
│       ├── urlParser.js
│       ├── cache.js
│       ├── retry.js
│       └── logger.js
│
├── scripts/
│   └── setup-google-auth.js        # Google OAuth 設定腳本
│
├── .env.example
├── .gitignore
├── package.json
├── zeabur.json
└── README.md
```

---

## 11. 部署規劃

### 11.1 package.json

```json
{
  "name": "discord-bot",
  "version": "1.0.0",
  "description": "Discord 自動化資訊收集與行事曆助手",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "discord.js": "^14.25.1",
    "@google/genai": "^1.37.0",
    "@notionhq/client": "^5.7.0",
    "googleapis": "^144.0.0",
    "apify-client": "^2.11.0",
    "cheerio": "^1.0.0",
    "@mozilla/readability": "^0.5.0",
    "jsdom": "^26.0.0",
    "pdf-parse": "^1.1.1",
    "node-cache": "^5.1.2",
    "dotenv": "^16.4.7",
    "express": "^4.21.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 11.2 zeabur.json

```json
{
  "build": {
    "type": "nodejs"
  },
  "start": {
    "command": "node src/index.js"
  }
}
```

### 11.3 入口點 (index.js)

```javascript
// src/index.js

import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import express from 'express';

// 事件處理
import { handleReady } from './events/ready.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { handleMessageReactionAdd } from './events/messageReactionAdd.js';

// 建立 Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// 註冊事件
client.once(Events.ClientReady, handleReady);
client.on(Events.MessageCreate, handleMessageCreate);
client.on(Events.InteractionCreate, handleInteractionCreate);
client.on(Events.MessageReactionAdd, handleMessageReactionAdd);

// 錯誤處理
client.on(Events.Error, (error) => {
  console.error('Discord Client Error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// 健康檢查伺服器（Zeabur 用）
const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    discord: client.isReady() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// 啟動 Bot
client.login(process.env.DISCORD_TOKEN);
```

---

## 12. 未來擴充

### 12.1 可能的新增功能

| 功能 | 說明 | 優先級 |
|------|------|--------|
| `/search` 指令 | 搜尋 Notion 資料庫 | 高 |
| n8n Webhook 整合 | 每日行事曆提醒 | 高 |
| Thread 筆記同步 | 討論串內容同步到 Notion | 中 |
| 多 Calendar 支援 | 選擇要加到哪個行事曆 | 中 |
| 語音轉文字 | Discord 語音訊息 | 低 |

### 12.2 與 n8n 整合點

```
n8n Workflow:
├── 每日早上 8:30
│   └── 掃描 Google Calendar/Tasks
│   └── 過濾未來 5 天項目
│   └── Discord Webhook → #bot-通知 頻道
│
└── 觸發條件：有新的未完成任務
    └── 發送提醒到 Discord
```

---

## 附錄：關鍵技術決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| Gemini SDK | @google/genai v1.37.0 | 新版 SDK，@google/generative-ai 已棄用 |
| Gemini 模型 | gemini-2.5-flash | 穩定、便宜、速度快、支援 Vision |
| Discord 框架 | discord.js 14.25.1 | 最新穩定版 |
| Notion SDK | @notionhq/client 5.7.0 | 對應 API v2025-09-03 |
| 網頁爬蟲 | Cheerio + Readability | 輕量、適合靜態頁面 |
| 社群爬蟲 | Apify | 穩定、沿用現有經驗 |
| 快取 | node-cache | 簡單、單機部署適用 |
| 部署 | Zeabur | 使用者熟悉 |

---

*文件版本：2.0*
*最後更新：2025-01-30*
*技術驗證日期：2025-01-30（所有 API 版本已確認為最新）*
