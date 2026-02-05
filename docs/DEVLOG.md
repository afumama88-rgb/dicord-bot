# 開發日誌

## 專案資訊
- **開始日期**：2026-01-30
- **開發者**：Cyclone + Claude Opus 4.5
- **目的**：建立 Discord 自動化機器人，整合 Notion、Google Calendar、Gemini AI

---

## 2026-01-30：專案規劃與初始化

### 需求討論
- 使用者希望建立兩個主要功能：
  1. **資訊收集**：貼連結自動存到 Notion
  2. **行事曆助手**：AI 解析日期資訊，存到 Google Calendar + Notion

### 技術選型討論
- **問題**：Python vs JavaScript？
- **結論**：使用者選擇 JavaScript (discord.js)，理由是「反正你會寫，我不用擔心」

### Gemini API 版本問題
- **錯誤**：最初規劃使用 Gemini 1.5
- **使用者指正**：「有問題現在的 gemini 1.5 已經不能用了，請你在規劃之前仔細看最新的相關應用文件」
- **修正**：
  - 套件改用 `@google/genai` v1.37.0（`@google/generative-ai` 已棄用）
  - 模型改用 `gemini-2.5-flash`

---

## 2026-01-31：程式碼實作

### 模組匯出名稱不一致問題

開發過程中多次遇到模組匯出名稱不匹配的錯誤：

#### 錯誤 1：notion.js
```
SyntaxError: The requested module '../services/notion.js' does not provide an export named 'createNotionPage'
```
- **原因**：notion.js 匯出 `createInfoPage`，但 handler 引用 `createNotionPage`
- **修正**：統一函數名稱

#### 錯誤 2：apify.js
```
SyntaxError: The requested module '../services/apify.js' does not provide an export named 'getApifyActorForType'
```
- **原因**：函數名稱不存在
- **修正**：改用正確的 `scrapeSocialMedia` 和 `isApifyAvailable`

#### 錯誤 3：gemini.js
```
SyntaxError: The requested module '../services/gemini.js' does not provide an export named 'extractCalendarFromPdf'
```
- **原因**：PDF 提取函數未實作
- **修正**：新增 `extractCalendarFromPdf` 函數

#### 錯誤 4：google.js
```
SyntaxError: The requested module '../services/google.js' does not provide an export named 'createGoogleEvent'
```
- **原因**：google.js 匯出 `createCalendarEvent`，但 handler 引用 `createGoogleEvent`
- **修正**：統一函數名稱

> **教訓**：撰寫程式碼時應該先確認所有模組的匯出名稱一致，避免反覆修正。

### dotenv 未載入問題

```
Error: API key must be set when using the Gemini API.
```
- **原因**：`src/index.js` 沒有載入 dotenv
- **修正**：在 index.js 最上方加入 `import 'dotenv/config';`

### 環境變數名稱不一致

Bot 啟動後顯示各項設定「未設定」：
```
Bot 配置 {"infoCollectChannel":"未設定","calendarChannel":"未設定"...}
```
- **原因**：config.js 使用的變數名稱與 .env 不一致
- **範例**：
  - config 用 `CHANNEL_INFO_COLLECT`
  - .env 用 `DISCORD_INFO_COLLECT_CHANNEL_ID`
- **修正**：統一使用 `DISCORD_INFO_COLLECT_CHANNEL_ID` 格式

---

## 2026-01-31：Discord Bot 設定

### 設定流程
1. Discord Developer Portal 建立 Application
2. 建立 Bot 並取得 Token
3. 開啟 **Message Content Intent**（重要！）
4. OAuth2 URL Generator 設定權限
5. 邀請 Bot 到伺服器

### Bot 無回應問題
- **現象**：Bot 顯示在線，但不回應訊息
- **原因**：Bot 未被加入私人頻道的存取權限
- **解決**：在頻道設定 → 權限 → 新增 Bot

### 權限設定確認
需要勾選的 Bot Permissions：
- ✅ View Channels
- ✅ Send Messages
- ✅ Embed Links
- ✅ Read Message History
- ✅ Add Reactions

---

## 2026-01-31：Google OAuth 設定

### invalid_grant 錯誤（反覆出現）

多次遇到 Google OAuth 的 `invalid_grant` 錯誤。

#### 嘗試 1：懷疑 Token 過期
- **推測**：測試模式的 Token 7 天過期
- **使用者反饋**：「這個才剛剛設定好而已，哪來的七天？」
- **確認**：專案已是「實際運作中」狀態，非測試模式

#### 嘗試 2：Redirect URI 不一致
- **發現**：
  - `setup-google-auth.js` 使用 `/callback`
  - `config/index.js` 使用 `/oauth2callback`
- **修正**：統一使用 `/callback`

#### 最終解決：Token 貼錯格式
- **問題截圖顯示**：
  ```
  GOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN=1//0eQR...
  ```
- **原因**：使用者貼上時多複製了一次變數名稱
- **正確格式**：
  ```
  GOOGLE_REFRESH_TOKEN=1//0eQR...
  ```

> **教訓**：環境變數設定錯誤是常見問題，應該在文件中強調正確格式。

### Google API 費用問題

使用者發現 Google Cloud 帳單 $34.38 USD：
- **原因**：之前用 Gemini CLI 測試圖片生成
- **建議**：Discord Bot 改用 Free tier API Key
- **使用者的 API Keys**：
  - DocumentScan → Tier 1（付費）
  - BananaSplit → Free tier（免費）
- **解決**：改用 Free tier Key

---

## 2026-01-31：Notion 欄位對應

### 錯誤：欄位不存在

#### 行事曆資料庫
```
validation_error: '來源' is not a property that exists.
```
- **原因**：程式碼假設有 `來源` 欄位，但使用者的資料庫沒有
- **使用者的實際欄位**：Name、優先級、日期、狀態、類型
- **修正**：移除 `來源` 欄位，對應正確欄位

#### 資訊收集資料庫
```
validation_error: 'source' is not a property that exists.
```
- **原因**：同樣問題
- **使用者的實際欄位**：title、date、type、url、摘要、Author、photo
- **修正**：移除 `source` 欄位，新增 `摘要` 欄位

> **教訓**：每個使用者的 Notion 資料庫結構可能不同，程式應該更彈性或先查詢資料庫結構。

---

## 2026-01-31：Notion URL 問題

### 問題：桌面版無法開啟連結
- **現象**：Discord 回傳的 Notion 連結在桌面版瀏覽器無法開啟，手機版可以
- **原因**：Notion API 回傳的 URL 格式問題
- **修正**：自訂 `formatNotionUrl` 函數，使用標準格式

---

## 2026-01-31：行事曆訊息長度問題

### 問題：短訊息不觸發
- **現象**：`2/6下午開會`（7 字）不觸發，`2/6下午2:00開會`（11 字）才會
- **原因**：程式設定最低 10 個字
- **修正**：降低門檻為 5 個字

---

## 2026-01-31：部署到 Zeabur

### 流程
1. `git init` → `git add .` → `git commit`
2. `gh repo create dicord-bot --private`
3. Zeabur 連接 GitHub repo
4. 設定環境變數

### 環境變數設定錯誤
- **問題**：使用者直接複製整行 `GOOGLE_REFRESH_TOKEN=xxx`，導致變數名稱重複
- **解決**：在 Zeabur 的 Raw Editor 正確貼上

---

## 2026-01-31：每日通知功能

### 需求討論
- **使用者問**：「通知時間點你覺得當天才通知會不會有點太晚？」
- **決定**：兩次通知
  - 21:00 明日預覽
  - 08:00 當日提醒

### 資訊收集統計邏輯
- **使用者問**：「統計收藏資訊的邏輯是每個禮拜做統計還是每天？是讀取 Notion 資料庫的狀態？」
- **澄清**：資訊收集沒有狀態欄位，依 `date` 欄位篩選
- **決定**：同時顯示今日新增 + 本週累計

### 無行程時的處理
- **使用者問**：「如果遇到明日或當日沒有活動，是不是就不會觸發？」
- **回答**：會照常發送，顯示「無行程安排」

---

## 2026-02-01：Facebook 爬取問題修復

### 問題：Facebook 連結收集失敗

```
收集失敗 - 無法處理此連結 - HTTP 400: Bad Request
```

### 診斷

1. Facebook/Instagram/Threads 會封鎖一般爬蟲
2. 需要使用 Apify 服務才能正確爬取
3. 原程式碼問題：當 Apify 失敗時會靜默降級到一般爬蟲，導致看到 HTTP 400 錯誤而非真正原因

### 原因

原程式碼邏輯：
```javascript
if (isApifyAvailable()) {
  try {
    return await scrapeSocialMedia(url, type);
  } catch (error) {
    return await scrapeWebPage(url); // 降級到一般爬蟲
  }
}
return await scrapeWebPage(url); // 直接用一般爬蟲
```

問題：
- 如果 `APIFY_API_KEY` 未設定，會直接跳到一般爬蟲
- Facebook 封鎖一般爬蟲，返回 HTTP 400
- 使用者看到的錯誤訊息無法反映真正原因

### 修正

```javascript
if (!isApifyAvailable()) {
  throw new Error(`${type.toUpperCase()} 需要設定 APIFY_API_KEY 才能爬取`);
}

const result = await scrapeSocialMedia(url, type);

if (!result.success) {
  throw new Error(result.error || `無法爬取 ${type} 內容`);
}

return result;
```

### 檢查清單

確認 Zeabur 上有正確設定 `APIFY_API_KEY`：
1. Zeabur Dashboard → 專案 → Variables
2. 確認有 `APIFY_API_KEY` 變數（不是 `APIFY_API_TOKEN`）
3. 確認值是正確的 Apify API Token
4. 重新部署後檢查 Bot 啟動日誌：`apifyService: '已設定'`

> **教訓**：靜默降級會隱藏真正的錯誤。對於必須使用特定服務的功能，應該明確報錯而非降級。

---

## 2026-02-01：社群媒體爬取全面修復

### Facebook `/share/` 連結格式問題

**問題**：Facebook share 連結無法識別
```
https://www.facebook.com/share/1GLJTsepmb/?mibextid=wwXIfr
```

**原因**：URL 解析器只認得 `/posts/`、`/videos/`、`/watch/` 等格式，沒有 `/share/`

**修正**：在 `urlParser.js` 新增 `/share/` 和 `m.facebook.com/story.php` 格式

### 作者欄位無法提取

**問題**：Discord Bot 無法抓到 Facebook 作者，顯示「未知」，但 Line Bot 可以抓到

**診斷**：對照 Line Bot 程式碼，發現欄位名稱不同

**修正**：對照 Line Bot 的欄位提取邏輯

| 平台 | 作者欄位優先級 |
|------|--------------|
| Facebook | `pageName` → `userName` → `name` → `user` → `groupTitle` |
| Instagram | `ownerUsername` → `username` → `owner.username` → URL 提取 |
| Threads | URL 提取優先 → `ownerUsername` → `username` → `author` |

### URL 重複處理問題

**問題**：同一個連結被處理兩次，產生兩個回覆

**修正**：在 `extractUrls` 加入 `Set` 去重複

### Apify Fallback 機制

**問題**：Apify 失敗時沒有備用方案

**修正**：新增 `scrapeMetaFallback` 函數
- 當 Apify 失敗時，嘗試從 HTML meta 標籤提取（og:title, og:description）
- Threads/IG 可從 URL 提取作者 (@username)

### Actor 更新

對照 Line Bot 使用的 Actor：
- Instagram: `apify/instagram-scraper`（原本用 `instagram-api-scraper`）
- Threads: `sinam7/threads-post-scraper`（原本用 `apify/threads-scraper`）

### 空內容偵測

**問題**：爬到空內容時嘗試存入 Notion，造成 `Received one or more errors`

**修正**：偵測空內容並顯示友善錯誤訊息
```
無法擷取此 Facebook 內容（可能需要登入）
```

### 日期欄位包含時間

**需求**：Notion 的 date 欄位要顯示幾點幾分

**修正**：從 `toISOString().split('T')[0]` 改為完整的 `toISOString()`

### Notion 資料驗證

**問題**：作者名稱含特殊字元導致 Notion API 錯誤

**修正**：
- 新增 `sanitizeAuthor` 函數清理特殊字元
- 移除逗號（multi_select 分隔符）
- 限制長度 100 字元

---

## 2026-02-01：AI 標題生成與時區修正

### AI 生成標題

**需求**：社群媒體貼文標題使用 AI 摘要，而非直接截取前 100 字

**實作**：在 `gemini.js` 新增 `generatePostTitle` 函數
- 內容 ≤30 字直接用原文
- 內容 >30 字用 Gemini 生成 25 字以內摘要

### 時間戳記時區問題

**問題**：Notion 頁面顯示的「建立時間」是 UTC，不是台北時間

**修正**：使用 `Intl.DateTimeFormat` 指定 `Asia/Taipei` 時區

### 每日通知新增功能

1. **打卡提醒連結**：每日通知底部加入 Discord 打卡頻道連結
2. **標記用戶**：新增 `DISCORD_NOTIFY_USER_ID` 環境變數，發送通知時 @ 標記
3. **7天+逾期顯示**：
   - 行程：顯示 7 天內 + 逾期未完成
   - 任務：顯示所有未完成（排除「已完成」）
   - 逾期項目以 ⚠️ 標記、日期加刪除線
4. **任務摘要**：每個任務下方顯示 📝 摘要（限 50 字）
5. **Notion 資料庫連結**：行程與任務區塊底部加入「開啟 Notion」快捷連結

---

## 2026-02-01：Slash 指令功能

### 新增 Discord Slash 指令

| 指令 | 功能 |
|------|------|
| `/notify` | 立即發送每日通知（可選 preview/reminder） |
| `/status` | 查看機器人狀態與設定 |
| `/add-event` | 新增活動到 Notion |
| `/add-task` | 新增任務到 Notion |
| `/today` | 查看今日行程與逾期任務 |

### 實作架構

```
src/commands/
├── index.js      # 指令註冊與管理
├── notify.js     # /notify
├── status.js     # /status
├── addEvent.js   # /add-event
├── addTask.js    # /add-task
└── today.js      # /today
```

---

## 2026-02-01：Notion SDK 版本錯誤（重大 Bug）

### 問題

每日通知查詢 Notion 資料庫失敗：
```
notion.databases.query is not a function
```

### 原因

**Claude 給了不存在的版本號！**

`package.json` 中設定：
```json
"@notionhq/client": "^5.7.0"  // ❌ 這個版本根本不存在！
```

實際上 `@notionhq/client` 最新版本是 `2.x`，從來沒有 5.x 版本。

### 修正

```json
"@notionhq/client": "^2.2.15"  // ✅ 正確版本
```

> **教訓**：AI 給的套件版本號不一定正確，應該先到 npm 確認版本是否存在。特別是當 AI 聲稱「使用最新版本」時更要小心。

---

## 2026-02-02：公文 PDF 解析優化

### 問題 1：PDF 公文無法解析

```
行事曆解析失敗 {"error":"無法從內容中提取有效的日期資訊","contentType":"pdf"}
```

### 原因

原本的提示詞沒有說明如何處理民國年格式（如 114年2月6日）。

### 修正

參考 `document-processor-plus` Python 專案的處理邏輯，優化 Gemini 提示詞：

1. **民國年轉換說明**：明確告訴 AI 如何轉換（114年 → 2025年）
2. **多種日期格式**：支援 `114年2月6日`、`114/02/06`、`2025-02-06` 等格式
3. **公文結構提示**：說明「說明」段落通常包含重要日期
4. **優先級判斷**：有截止日期且較近的設為「高」

### 問題 2：PDF 解析後內容不完整

**現象**：
- 只抓到公文發文日期，沒抓到內文中的 deadline
- Notion 頁面完全空白，沒有摘要

**原因**：
1. `pdf-parse` 提取文字不完整
2. Gemini 回傳 `summary` 但 buttonHandler 使用 `description`（欄位名稱不匹配）
3. 若只有 deadline 沒有 startDate，會判定為「無日期」

### 修正

1. **PDF 直接送給 Gemini**：不再依賴 `pdf-parse`，直接把 PDF 作為 inlineData 送給 Gemini 分析
2. **新增 description 別名**：`parseGeminiResponse` 回傳時同時提供 `summary` 和 `description`
3. **智慧日期處理**：若無 startDate 但有 deadline，自動使用 deadline 作為日期

### 新增：打卡模板

每日通知的打卡提醒新增可複製模板：
```
2026-02-02
:todo:
:todo:
:todo:
@cyclonetw
```

### 優化：打卡模板獨立訊息

**問題**：模板嵌在 Embed 內，複製時會連同整個通知一起複製

**修正**：
1. 模板改為獨立的純文字訊息發送
2. Embed 內只顯示「打卡模板在下方訊息，可直接複製」
3. 日期使用台北時區（`Intl.DateTimeFormat` + `Asia/Taipei`）
4. 模板使用 code block（` ``` `）包裹，更直覺易複製

**最終格式**：
```
\`\`\`
2026-02-02
:todo:
:todo:
:todo:
@cyclonetw.
\`\`\`
```

### 調整：通知排程時間

| 類型 | 原本 | 改為 |
|------|------|------|
| 🌙 明日預覽 | 21:00 | 22:00 |
| ☀️ 當日提醒 | 08:00 | 06:00 |

時區維持台北時間 (Asia/Taipei)。

---

## 2026-02-04：/add-task 指令修復

### 問題

使用 `/add-task` 指令時出現錯誤：
```
❌ 新增失敗：body failed validation: body.properties.日期.date.start should be a string, instead was null
```

### 原因

當使用者使用 `/add-task` 新增任務但有提供 deadline 時，程式碼邏輯正確傳遞日期。但 `createTaskPage` 函數的日期屬性總是被包含在 properties 物件中，即使值為 `null`：

```javascript
// 原本的程式碼
'日期': {
  date: {
    start: data.startDate,  // 可能是 null
    end: data.endDate || undefined
  }
}
```

Notion API 不接受 `null` 作為日期值，必須是有效的日期字串或完全省略該屬性。

### 修正

在 `src/services/notion.js` 的 `createTaskPage` 函數中，只有當 `startDate` 存在時才加入日期屬性：

```javascript
// 只有當日期存在時才加入日期屬性（Notion 不接受 null）
if (data.startDate) {
  properties['日期'] = {
    date: {
      start: data.startDate,
      end: data.endDate || undefined
    }
  };
}
```

> **教訓**：Notion API 對於可選欄位，應該完全省略而非傳入 `null`。在建構 properties 物件時要先檢查值是否存在。

---

## 2026-02-04：新增 /ai 智慧解析指令

### 需求

使用者希望有一個更直覺的方式新增活動/任務，不需要手動選擇類型和填寫各欄位，只要輸入一段文字描述，讓 AI 自動判斷。

### 實作

新增 `/ai` Slash 指令：

```
/ai 明天下午兩點開會要帶筆電
/ai 禮拜五前要交報告
/ai 2/14 情人節晚餐 信義區餐廳
```

**流程**：
1. 使用者輸入文字描述
2. 呼叫 Gemini AI 分析（使用現有的 `extractCalendarFromText`）
3. AI 自動判斷：
   - 類型：活動 (event) 或 任務 (task)
   - 日期、時間、地點
   - 優先級
   - 摘要
4. 顯示預覽，包含 AI 信心指數
5. 使用者選擇：Google 日曆 / Google 任務 / 僅存 Notion / 取消
6. 確認後建立

**與現有指令的差別**：

| 指令 | 用途 | 特點 |
|------|------|------|
| `/add-event` | 手動新增活動 | 需填寫各欄位 |
| `/add-task` | 手動新增任務 | 需填寫各欄位 |
| `/ai` | AI 智慧解析 | 輸入文字，自動判斷 |

**優點**：
- 只需 2 個字的指令名稱，打字最快
- 不需要選擇類型，AI 自動判斷
- 不需要分別填寫日期、時間、地點，AI 自動提取
- 顯示 AI 信心指數，讓使用者知道解析可靠度

---

## 2026-02-05：任務提醒功能

### 需求

使用者希望能在新增任務時設定提醒，例如：
```
/ai 明天下午3點開會，2小時前提醒我
```

### 架構設計

選擇「Notion + 每分鐘檢查」方案：
- 不需要額外依賴（如 Redis）
- 資料持久化在 Notion
- 可在 Notion 查看/編輯提醒

### 實作內容

1. **修改 Gemini 提示詞**
   - 新增提醒時間提取（如「2小時前」、「30分鐘前」、「前一天」）
   - 轉換為分鐘數：1小時=60, 2小時=120, 1天=1440

2. **新增 Notion 欄位**（使用者需手動新增）
   - `提醒時間`（日期，含時間）
   - `已提醒`（勾選框）

3. **更新 Notion 服務**
   - `calculateReminderTime()`：根據事件時間和提前分鐘數計算提醒時間
   - `markReminderSent()`：標記提醒已發送

4. **建立提醒排程器** (`src/services/reminderScheduler.js`)
   - 每分鐘執行一次（node-cron）
   - 查詢條件：`提醒時間 <= 現在 AND 已提醒 = false AND 狀態 != 已完成`
   - 發送 Discord 通知（Embed 格式）
   - 標記為已提醒

5. **更新 /ai 指令**
   - 預覽中顯示提醒設定
   - 傳遞提醒資訊到 Notion

### 使用範例

```
/ai 明天下午3點開會，2小時前提醒我
/ai 禮拜五要交報告，前一天通知我
/ai 2/14 晚餐，30分鐘前提醒
```

### 擴展性

這個「每分鐘檢查」機制可以擴展為：
- 截止日提醒（任務快到期時自動通知）
- 定期任務（每週/每月提醒）
- 生日/紀念日提醒
- 網站監控、價格追蹤等

---

## 待辦事項

- [ ] AI 對話頻道功能
- [ ] 圖片分析功能
- [ ] 提醒機器人功能
- [x] 手動觸發報告測試指令（改用 /notify）
- [x] 修復 Facebook 爬取錯誤訊息
- [x] 修復社群媒體作者欄位提取
- [x] 新增 Fallback 機制
- [x] 日期欄位包含時間
- [x] AI 生成社群貼文標題
- [x] 每日通知標記用戶
- [x] Slash 指令功能
- [x] 修復 Notion SDK 版本錯誤
- [x] 公文 PDF 解析（支援民國年、直接送 Gemini）
- [x] 每日通知加入 Notion 連結
- [x] 每日打卡模板（獨立訊息、台北時區）
- [x] 修復 /add-task 日期欄位 null 值錯誤
- [x] 新增 /ai 智慧解析指令
- [x] 任務提醒功能（每分鐘檢查 + Discord 通知）

---

## 學到的經驗

1. **環境變數命名要統一**：從一開始就定好格式，避免混亂
2. **模組匯出名稱要一致**：寫完後應該全域檢查 import/export
3. **使用者的 Notion 結構要先確認**：不能假設欄位存在
4. **Google OAuth 很容易出錯**：Token 格式、憑證配對都要仔細
5. **錯誤訊息要仔細看**：大部分問題答案都在錯誤訊息裡
6. **避免靜默降級**：錯誤處理不應該隱藏真正的問題，應該明確告知使用者
7. **參考現有專案**：同樣功能的專案（如 Line Bot）可以直接對照欄位名稱和處理邏輯
8. **第三方 API 欄位名稱不統一**：Apify 不同 Actor 回傳的欄位名稱可能不同，需要逐一測試
9. **AI 給的版本號要驗證**：Claude 給了不存在的 `@notionhq/client@5.7.0`，實際最新是 `2.x`。永遠要到 npm 確認版本是否存在
10. **伺服器時區問題**：Zeabur/Railway 等平台預設 UTC，日期計算要明確指定時區
11. **PDF 直接送 AI 更可靠**：`pdf-parse` 提取文字可能不完整，Gemini 支援直接讀取 PDF（作為 inlineData），效果更好
12. **欄位名稱要統一**：前後端、不同模組之間的欄位名稱要一致（如 `summary` vs `description`），否則資料會遺失
13. **Notion API 不接受 null**：可選欄位若無值應完全省略，而非傳入 `null`。建構 properties 時要先檢查值是否存在再加入物件
