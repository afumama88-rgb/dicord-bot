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
 * 行事曆資訊提取 Prompt
 */
function getCalendarExtractionPrompt() {
  const today = new Date().toISOString().split('T')[0];

  return `你是一個專業的行政助理，專門從文字或圖片中提取行事曆相關資訊。

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
  "type": "event",
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endDate": "YYYY-MM-DD",
  "endTime": "HH:MM",
  "location": "地點",
  "deadline": "YYYY-MM-DD",
  "deadlineDescription": "截止事項說明",
  "contact": {
    "name": "聯絡人",
    "phone": "電話",
    "email": "信箱"
  },
  "priority": "中",
  "summary": "50字以內的摘要",
  "confidence": 0.8
}

注意事項：
- type 只能是 "event" 或 "task"
- priority 只能是 "高"、"中" 或 "低"
- confidence 是 0.0 到 1.0 之間的數字，表示你對解析結果的信心程度
- 如果無法確定某個欄位，請設為 null
- 如果內容中沒有任何日期資訊，請將 confidence 設為 0

今天日期：${today}`;
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
  // 先用 pdf-parse 提取文字
  const pdfData = await pdf(pdfBuffer);
  const text = pdfData.text;

  if (!text || text.trim().length === 0) {
    throw new Error('PDF 中沒有可讀取的文字');
  }

  // 用文字提取函數處理
  return await extractCalendarFromText(text);
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
      summary: parsed.summary || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
    };
  } catch (error) {
    console.error('Gemini 回應解析失敗:', responseText);
    throw new Error('AI 回應格式錯誤');
  }
}

export default {
  extractCalendarFromText,
  extractCalendarFromImage,
  extractCalendarFromPdf,
  generateSummary,
  MODEL
};
