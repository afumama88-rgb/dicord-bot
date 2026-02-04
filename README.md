# Cyclone Discord Bot

Discord 自動化機器人，整合 Notion、Google Calendar、Gemini AI。

## 功能

### 📥 資訊收集
在指定頻道貼上連結，Bot 自動擷取內容並儲存至 Notion。

支援平台：
- YouTube
- Facebook
- Instagram
- Threads
- 一般網頁

### 📅 行事曆助手
發送包含日期資訊的文字/圖片/PDF，Bot 使用 Gemini AI 解析後：
- 建立 Google Calendar 事件
- 建立 Google Tasks 任務
- 儲存至 Notion

### 🔔 每日通知
自動定時發送通知：
- **21:00** 明日預覽
- **08:00** 當日提醒

內容包含：
- 7 天內行程 + 逾期未完成活動
- 所有未完成任務（含摘要）
- 資訊收集統計
- 打卡提醒連結
- Notion 資料庫快捷連結

### ⚡ Slash 指令

| 指令 | 功能 |
|------|------|
| `/ai` | AI 智慧解析 - 輸入文字自動判斷活動或任務 |
| `/notify` | 立即發送每日通知 |
| `/status` | 查看機器人狀態與設定 |
| `/add-event` | 手動新增活動到 Notion |
| `/add-task` | 手動新增任務到 Notion |
| `/today` | 查看今日行程與任務 |

## 技術架構

| 元件 | 技術 |
|-----|------|
| Bot 框架 | Discord.js v14 |
| AI 解析 | Google Gemini 2.5 Flash |
| 資料庫 | Notion API |
| 日曆整合 | Google Calendar / Tasks API |
| 網頁爬蟲 | Cheerio + Readability |
| 社群爬蟲 | Apify（選用）|
| 排程 | node-cron |
| 部署 | Zeabur |

## 安裝

```bash
# 複製專案
git clone https://github.com/cyclone-tw/dicord-bot.git
cd dicord-bot

# 安裝依賴
npm install

# 設定環境變數
cp .env.example .env
# 編輯 .env 填入各項設定

# 啟動開發模式
npm run dev
```

## 環境變數

```env
# Discord
DISCORD_TOKEN=你的 Bot Token
DISCORD_CLIENT_ID=你的 Application ID
DISCORD_INFO_COLLECT_CHANNEL_ID=資訊收集頻道 ID
DISCORD_CALENDAR_CHANNEL_ID=行事曆助手頻道 ID
DISCORD_NOTIFY_CHANNEL_ID=每日通知頻道 ID
DISCORD_NOTIFY_USER_ID=要標記的用戶 ID（選用）

# Notion
NOTION_API_KEY=你的 Notion Integration Token
NOTION_DATABASE_ID_INFO=資訊收集資料庫 ID
NOTION_DATABASE_ID_CALENDAR=行事曆資料庫 ID

# Gemini AI
GEMINI_API_KEY=你的 Gemini API Key

# Google OAuth（選用，用於 Calendar/Tasks）
GOOGLE_CLIENT_ID=OAuth Client ID
GOOGLE_CLIENT_SECRET=OAuth Client Secret
GOOGLE_REFRESH_TOKEN=Refresh Token

# Apify（選用，用於社群媒體爬蟲）
APIFY_API_KEY=你的 Apify Token
```

## Discord Bot 設定

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 建立 Application → Bot
3. 開啟 **Message Content Intent**（重要！）
4. OAuth2 → URL Generator → Scopes 勾選：
   - `bot`
   - `applications.commands`（Slash 指令需要）
5. Bot Permissions 勾選：
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Add Reactions
6. 使用產生的連結邀請 Bot 到伺服器
7. 記下 Application ID（設為 `DISCORD_CLIENT_ID`）

## Google OAuth 設定

```bash
# 設定好 CLIENT_ID 和 CLIENT_SECRET 後執行
npm run setup-google
```

瀏覽器會開啟授權頁面，完成後將取得的 `REFRESH_TOKEN` 貼到 `.env`。

## Notion 資料庫結構

### 資訊收集資料庫
| 欄位 | 類型 | 說明 |
|-----|------|------|
| title | Title | 標題 |
| date | Date | 收集日期 |
| type | Select | YT/FB/IG/TH/網路文章 |
| url | URL | 原始連結 |
| 摘要 | Text | 內容摘要 |
| Author | Multi-select | 作者 |

### 行事曆資料庫
| 欄位 | 類型 | 說明 |
|-----|------|------|
| Name | Title | 事件名稱 |
| 日期 | Date | 日期時間 |
| 類型 | Select | 活動/任務 |
| 狀態 | Select | 待處理/進行中/已完成 |
| 優先級 | Select | 高/中/低 |

## 部署到 Zeabur

1. 推送程式碼到 GitHub
2. Zeabur → New Project → Deploy from GitHub
3. 選擇 `dicord-bot` repo
4. 在 Variables 加入所有環境變數
5. 部署完成後 Bot 自動上線

## 開發

```bash
# 開發模式（自動重啟）
npm run dev

# 正式啟動
npm start
```

## 授權

MIT License

---

由 Cyclone 與 Claude Opus 4.5 共同開發
