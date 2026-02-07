/**
 * Gemini AI 服務
 * 使用 @google/genai 套件（新版 SDK）
 */

import { GoogleGenAI } from '@google/genai';
import pdf from 'pdf-parse';
import { config } from '../config/index.js';

// 初始化 Gemini 客戶端
const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

// 使用的模型
const MODEL = config.gemini.model;

/**
 * 取得台北時區的今天日期
 */
function getTaipeiToday() {
  const options = {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const formatter = new Intl.DateTimeFormat('zh-TW', options);
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

/**
 * 行事曆資訊提取 Prompt
 */
function getCalendarExtractionPrompt() {
  const today = getTaipeiToday();
  const rocYear = new Date().getFullYear() - 1911;

  return `你是一個專業的行政助理，專門從公文、通知、文字或圖片中提取行事曆相關資訊。

**重要：日期格式轉換**
- 民國年轉換：民國 ${rocYear} 年 = 西元 ${new Date().getFullYear()} 年
- 例如：114年2月6日 → 2025-02-06
- 例如：114/02/06 → 2025-02-06
- 所有日期請轉換為西元 YYYY-MM-DD 格式

請從以下內容中提取：
1. 活動/任務名稱（精簡主旨，30字內）
2. 日期（轉換為 YYYY-MM-DD 格式）
3. 時間（如有，轉換為 HH:MM 格式）
4. 結束時間（如有）
5. 地點（如有）
6. 重要截止日期（如報名截止日、繳交期限）
7. 聯絡人資訊（承辦人、電話、信箱）
8. 這是「活動」還是「任務」？判斷原則：「要出席/參加」→ 活動，「要完成/處理」→ 任務
   - 活動(event)：有明確的舉辦時間，需要「出席」或「參加」或「觀看」
     * 例：開會、上課、線上課程、直播、研習、講座、約會、聚餐、看電影、看醫生、面試、Webinar
     * 關鍵詞：開會、上課、課程、直播、研習、講座、約會、聚餐、活動、典禮、會議、YouTube、線上會議
     * 注意：只要有「課程」「直播」「上課」就是活動！
   - 任務(task)：需要在某個期限前「完成」的事項，通常是要「做」某件事
     * 例：繳交報告、買東西、報名、填表、回覆信件、付款、寄件
     * 關鍵詞：買、繳、交、寄、報名、填寫、完成、處理、提交
9. 提醒設定（如有提到「提醒我」、「通知我」等）
   - **情境A - 明確時間點**：「提醒我明天下午4點買東西」→ 提醒時間就是明天下午4點
   - **情境B - 提前通知**：「明天4點開會，2小時前提醒」→ 提醒時間 = 事件時間 - 2小時
   - 判斷邏輯：如果句子是「提醒我+時間+做某事」，用情境A；如果是「某事+時間前提醒」，用情境B

請以 JSON 格式回覆，不要包含 markdown code block：
{
  "title": "精簡的活動/任務名稱",
  "type": "event",
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endDate": "YYYY-MM-DD",
  "endTime": "HH:MM",
  "location": "地點",
  "deadline": "YYYY-MM-DD",
  "deadlineDescription": "截止事項說明（如：報名截止、資料繳交）",
  "contact": {
    "name": "承辦人姓名",
    "phone": "電話",
    "email": "信箱"
  },
  "priority": "中",
  "summary": "50字以內的摘要，說明這份公文要做什麼",
  "confidence": 0.8,
  "reminder": {
    "enabled": true,
    "mode": "exact",
    "exactTime": "YYYY-MM-DD HH:MM",
    "beforeMinutes": null,
    "description": "明天下午4點"
  }
}

reminder 欄位說明：
- enabled：如果使用者有提到要提醒，設為 true
- mode：「exact」表示明確時間點，「before」表示提前通知
- exactTime：當 mode=exact 時，填入要提醒的時間（YYYY-MM-DD HH:MM）
- beforeMinutes：當 mode=before 時，填入提前幾分鐘（1小時=60, 2小時=120, 1天=1440）
- description：原始的提醒描述

注意事項：
- type 只能是 "event" 或 "task"
- priority：有截止日期且較近的設為「高」，一般通知設為「中」，參考性質設為「低」
- confidence 是 0.0 到 1.0 之間的數字，表示你對解析結果的信心程度
- 如果無法確定某個欄位，請設為 null
- 如果內容中沒有任何日期資訊，請將 confidence 設為 0
- 公文中的「說明」段落通常包含重要日期和要求
- 「辦法」或「注意事項」段落通常包含報名/繳交方式
- reminder.enabled：如果使用者有提到要提醒，設為 true；沒提到設為 false
- reminder.beforeMinutes：提前幾分鐘提醒（1小時=60, 2小時=120, 1天=1440）
- reminder.description：原始的提醒描述（如「2小時前」）

今天日期：${today}（民國 ${rocYear} 年）`;
}

/**
 * 從文字中提取行事曆資訊
 * @param {string} text - 要分析的文字
 * @returns {Promise<Object>} 解析結果
 */
export async function extractCalendarFromText(text) {
  const prompt = getCalendarExtractionPrompt();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: prompt },
      { text: `\n\n以下是要分析的內容：\n${text}` }
    ]
  });

  return parseGeminiResponse(response.text);
}

/**
 * 從圖片中提取行事曆資訊
 * @param {Buffer} imageBuffer - 圖片 Buffer
 * @param {string} mimeType - 圖片 MIME 類型
 * @returns {Promise<Object>} 解析結果
 */
export async function extractCalendarFromImage(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');
  const prompt = getCalendarExtractionPrompt();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: prompt },
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
 * 從 PDF 中提取行事曆資訊
 * @param {Buffer} pdfBuffer - PDF Buffer
 * @returns {Promise<Object>} 解析結果
 */
export async function extractCalendarFromPdf(pdfBuffer) {
  const base64Pdf = pdfBuffer.toString('base64');
  const prompt = getCalendarExtractionPrompt();

  console.log(`[Gemini] 直接分析 PDF，大小: ${Math.round(pdfBuffer.length / 1024)} KB`);

  try {
    // 直接把 PDF 送給 Gemini 分析（Gemini 支援 PDF）
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf
          }
        }
      ]
    });

    console.log(`[Gemini] PDF 分析完成`);
    return parseGeminiResponse(response.text);

  } catch (error) {
    console.error(`[Gemini] PDF 直接分析失敗: ${error.message}`);

    // Fallback: 如果直接分析失敗，嘗試用 pdf-parse 提取文字
    console.log(`[Gemini] 嘗試用 pdf-parse 提取文字...`);
    const pdfData = await pdf(pdfBuffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      throw new Error('PDF 中沒有可讀取的文字');
    }

    console.log(`[Gemini] 提取到 ${text.length} 字元，送交分析`);
    return await extractCalendarFromText(text);
  }
}

/**
 * 生成文字摘要
 * @param {string} text - 要摘要的文字
 * @param {number} maxLength - 最大長度
 * @returns {Promise<string>} 摘要文字
 */
export async function generateSummary(text, maxLength = 50) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        text: `請用不超過 ${maxLength} 個字摘要以下內容，只回覆摘要文字，不要加引號或其他格式：\n\n${text}`
      }
    ]
  });

  return response.text.trim().slice(0, maxLength);
}

/**
 * 解析 Gemini 回應
 * @param {string} responseText - Gemini 回應文字
 * @returns {Object} 解析後的 JSON 物件
 */
function parseGeminiResponse(responseText) {
  // 移除可能的 markdown code block
  let jsonStr = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // 嘗試找到 JSON 物件
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // 確保必要欄位存在
    const summary = parsed.summary || null;

    // 處理提醒設定
    const reminder = parsed.reminder || { enabled: false };

    return {
      title: parsed.title || '未知標題',
      type: parsed.type === 'task' ? 'task' : 'event',
      startDate: parsed.startDate || null,
      startTime: parsed.startTime || null,
      endDate: parsed.endDate || null,
      endTime: parsed.endTime || null,
      location: parsed.location || null,
      deadline: parsed.deadline || null,
      deadlineDescription: parsed.deadlineDescription || null,
      contact: parsed.contact || { name: null, phone: null, email: null },
      priority: ['高', '中', '低'].includes(parsed.priority) ? parsed.priority : '中',
      summary: summary,
      description: summary,  // 別名，供 buttonHandler 使用
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reminder: {
        enabled: reminder.enabled === true,
        mode: reminder.mode === 'exact' ? 'exact' : 'before',
        exactTime: reminder.exactTime || null,
        beforeMinutes: typeof reminder.beforeMinutes === 'number' ? reminder.beforeMinutes : null,
        description: reminder.description || null
      }
    };
  } catch (error) {
    console.error('Gemini 回應解析失敗:', responseText);
    throw new Error('AI 回應格式錯誤');
  }
}

/**
 * 為社群媒體貼文生成標題
 * @param {string} content - 貼文內容
 * @param {string} platform - 平台名稱 (facebook/instagram/threads)
 * @returns {Promise<string>} 標題（20字內）
 */
export async function generatePostTitle(content, platform = '') {
  // 確保 content 是字串
  if (!content) {
    return null;
  }

  // 如果不是字串，嘗試轉換
  if (typeof content !== 'string') {
    if (typeof content === 'object') {
      content = JSON.stringify(content);
    } else {
      content = String(content);
    }
  }

  if (content.trim().length === 0) {
    return null;
  }

  // 如果內容很短，直接用原文
  if (content.length <= 30) {
    return content.trim();
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          text: `請用一句話（最多25個中文字）摘要以下社群媒體貼文的主題或重點。
只回覆摘要文字，不要加引號、標點符號開頭、或其他格式。
如果內容是對話或閒聊，提取主要話題。

貼文內容：
${content.slice(0, 1000)}`
        }
      ]
    });

    const title = response.text
      .trim()
      .replace(/^["「『]|["」』]$/g, '')  // 移除引號
      .replace(/^[，。、：；！？,.;:!?]+/, '')  // 移除開頭標點
      .slice(0, 50);

    return title || null;
  } catch (error) {
    console.error('Gemini 標題生成失敗:', error.message);
    return null;
  }
}

export default {
  extractCalendarFromText,
  extractCalendarFromImage,
  extractCalendarFromPdf,
  generateSummary,
  generatePostTitle,
  MODEL
};
