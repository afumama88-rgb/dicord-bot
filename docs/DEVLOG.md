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

## 待辦事項

- [ ] 手動觸發報告測試指令
- [ ] AI 對話頻道功能
- [ ] 圖片分析功能
- [ ] 提醒機器人功能
- [x] 修復 Facebook 爬取錯誤訊息

---

## 學到的經驗

1. **環境變數命名要統一**：從一開始就定好格式，避免混亂
2. **模組匯出名稱要一致**：寫完後應該全域檢查 import/export
3. **使用者的 Notion 結構要先確認**：不能假設欄位存在
4. **Google OAuth 很容易出錯**：Token 格式、憑證配對都要仔細
5. **錯誤訊息要仔細看**：大部分問題答案都在錯誤訊息裡
6. **避免靜默降級**：錯誤處理不應該隱藏真正的問題，應該明確告知使用者
