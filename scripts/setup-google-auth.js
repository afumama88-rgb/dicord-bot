/**
 * Google OAuth 授權設定腳本
 * 執行此腳本以取得 Google Calendar/Tasks 的 refresh token
 *
 * 使用方式：
 * 1. 確保 .env 中已設定 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET
 * 2. 執行 `npm run setup-google`
 * 3. 按照提示在瀏覽器中授權
 * 4. 將取得的 refresh token 設定到 .env 的 GOOGLE_REFRESH_TOKEN
 */

import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks'
];

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ 請先在 .env 設定 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET');
    console.log('\n如何取得：');
    console.log('1. 前往 Google Cloud Console: https://console.cloud.google.com/');
    console.log('2. 建立或選擇專案');
    console.log('3. 啟用 Google Calendar API 和 Tasks API');
    console.log('4. 建立 OAuth 2.0 用戶端 ID (桌面應用程式)');
    console.log('5. 下載 JSON 並取得 client_id 和 client_secret');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // 強制顯示同意畫面以取得 refresh token
  });

  console.log('\n🔐 Google OAuth 授權設定');
  console.log('========================\n');

  // 建立本地伺服器接收回調
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>❌ 授權失敗</h1><p>${error}</p>`);
        console.error(`\n❌ 授權失敗: ${error}`);
        server.close();
        process.exit(1);
      }

      if (code) {
        try {
          const { tokens } = await oauth2Client.getToken(code);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <h1>✅ 授權成功！</h1>
            <p>你可以關閉此視窗並回到終端機。</p>
          `);

          console.log('\n✅ 授權成功！\n');
          console.log('請將以下內容加入你的 .env 檔案：\n');
          console.log('─'.repeat(50));
          console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
          console.log('─'.repeat(50));
          console.log('\n⚠️  請妥善保管此 token，不要公開分享\n');

          server.close();
          process.exit(0);

        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>❌ 取得 Token 失敗</h1><p>${err.message}</p>`);
          console.error(`\n❌ 取得 Token 失敗: ${err.message}`);
          server.close();
          process.exit(1);
        }
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(REDIRECT_PORT, async () => {
    console.log(`📡 本地伺服器已啟動於 http://localhost:${REDIRECT_PORT}`);
    console.log('\n🌐 正在開啟瀏覽器進行授權...');
    console.log('\n如果瀏覽器沒有自動開啟，請手動前往：');
    console.log(authUrl);

    try {
      await open(authUrl);
    } catch {
      console.log('\n⚠️  無法自動開啟瀏覽器，請手動複製上方網址');
    }
  });

  // 超時處理
  setTimeout(() => {
    console.log('\n⏰ 授權超時（5 分鐘）');
    server.close();
    process.exit(1);
  }, 5 * 60 * 1000);
}

main().catch(console.error);
