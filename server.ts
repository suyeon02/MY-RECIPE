import express, { Request, Response } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

/**
 * Extract YouTube 11-char video ID
 */
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const match = url.trim().match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Helper to fetch YouTube video info (oEmbed + HTML description parsing)
 */
async function fetchYoutubeInfo(videoId: string) {
  let title = '';
  let channel = '';
  let description = '';
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  // 1. Fetch oEmbed for clean video title & author
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(2500),
    });
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      title = oembed.title || '';
      channel = oembed.author_name || '';
      if (oembed.thumbnail_url) thumbnail = oembed.thumbnail_url;
    }
  } catch (err) {
    console.warn('oEmbed fetch error:', err);
  }

  // 2. Fetch watch page HTML to extract full video description and captions/chapters
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (pageRes.ok) {
      const html = await pageRes.text();

      // Extract meta description
      const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
      if (metaMatch && metaMatch[1]) {
        description = metaMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      }

      // Extract shortDescription from ytInitialPlayerResponse or ytInitialData if available
      const playerMatch = html.match(/"shortDescription":\s*"((?:\\.|[^"\\])*)"/);
      if (playerMatch && playerMatch[1]) {
        try {
          const parsedDesc = JSON.parse(`"${playerMatch[1]}"`);
          if (parsedDesc && parsedDesc.length > description.length) {
            description = parsedDesc;
          }
        } catch {
          // ignore
        }
      }

      // Title fallback
      if (!title) {
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
          title = titleMatch[1].replace(/\s*-\s*YouTube$/, '').trim();
        }
      }
    }
  } catch (err) {
    console.warn('YouTube page fetch error:', err);
  }

  return { videoId, title, channel, description, thumbnail };
}

/**
 * Generate fallback structured recipe from YouTube title and description
 */
function createFallbackRecipe(videoTitle: string, channel: string, description: string) {
  const cleanTitle = (videoTitle || '유튜브 요리 레시피').replace(/\[.*?\]|\(.*?\)/g, '').trim();

  // Try extracting ingredients and seasonings from description lines
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean);
  const ingLines: string[] = [];
  const sauLines: string[] = [];
  const stepLines: string[] = [];

  let currentSection = 'steps';
  for (const line of lines) {
    if (line.includes('재료') || line.includes('준비물')) {
      currentSection = 'ing';
      continue;
    } else if (line.includes('양념') || line.includes('소스')) {
      currentSection = 'sau';
      continue;
    } else if (line.includes('조리') || line.includes('만드는 법') || line.includes('순서')) {
      currentSection = 'steps';
      continue;
    }

    if (currentSection === 'ing' && line.length < 50) {
      ingLines.push(line.replace(/^[-*•]\s*/, ''));
    } else if (currentSection === 'sau' && line.length < 50) {
      sauLines.push(line.replace(/^[-*•]\s*/, ''));
    } else if (/^\d{1,2}:\d{2}/.test(line) || /^[0-9]\./.test(line)) {
      stepLines.push(line);
    }
  }

  return {
    name: cleanTitle || '맛있는 유튜브 요리',
    cat: '메인 요리',
    min: 25,
    serv: 2,
    ing:
      ingLines.slice(0, 6).join('\n') ||
      '주재료 500g\n양파 1개\n대파 1대\n당근 1/2개',
    sau:
      sauLines.slice(0, 5).join('\n') ||
      '진간장 2큰술\n설탕 1큰술\n다진 마늘 1큰술\n참기름 1큰술',
    steps:
      stepLines.slice(0, 6).join('\n') ||
      '00:30 재료를 먹기 좋은 크기로 손질합니다.\n02:15 팬을 달구고 주재료를 중불에 볶습니다.\n04:30 양념을 넣고 자작하게 졸여 완성합니다.',
    tip: '영상 더보기란의 설명을 바탕으로 요약 정리된 레시피입니다.',
    summary: `${channel ? `[${channel}] ` : ''}${cleanTitle} 레시피입니다.`,
    difficulty: '보통',
    calories: '약 450 kcal',
    tags: ['#유튜브레시피', '#집밥요리'],
    channel,
  };
}

/**
 * Call Gemini with retry on transient 503 errors
 */
async function generateContentWithRetry(params: any, retries = 1): Promise<any> {
  if (!ai) return null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const isTransient =
        err?.status === 503 ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('UNAVAILABLE');

      if (isTransient && i < retries) {
        console.warn(`Gemini 503/transient retry ${i + 1}/${retries}...`);
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }
      throw err;
    }
  }
}

/**
 * POST /api/extract-youtube
 * Extracts recipe information from YouTube URL using Gemini AI
 */
app.post('/api/extract-youtube', async (req: Request, res: Response) => {
  let videoId: string | null = null;
  let videoTitle = '';
  let channel = '';
  let description = '';
  let thumbnail = '';

  try {
    const { url, rawText } = req.body;
    if (!url && !rawText) {
      return res.status(400).json({ error: '유튜브 링크 또는 레시피 텍스트를 입력해주세요.' });
    }

    if (url) {
      videoId = extractYoutubeId(url);
      if (!videoId) {
        return res.status(400).json({ error: '올바른 유튜브 영상 또는 쇼츠 링크가 아닙니다.' });
      }

      const ytData = await fetchYoutubeInfo(videoId);
      videoTitle = ytData.title;
      channel = ytData.channel;
      description = ytData.description;
      thumbnail = ytData.thumbnail;
    }

    const contentForAi = [
      url ? `YouTube URL: ${url}` : '',
      videoTitle ? `영상 제목: ${videoTitle}` : '',
      channel ? `채널명: ${channel}` : '',
      description ? `영상 설명 및 더보기 내용:\n${description}` : '',
      rawText ? `사용자 추가 내용:\n${rawText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!ai) {
      return res.json({
        recipe: createFallbackRecipe(videoTitle, channel, description),
        thumbnail,
        videoId,
      });
    }

    const systemPrompt = `당신은 한국 최고의 요리 레시피 전문 정리 전문가이자 AI 셰프입니다.
사용자가 제공한 유튜브 영상의 제목, 채널명, 더보기란 설명, 타임스탬프를 정밀 분석하여
한국인이 실제로 보고 요리하기에 가장 깔끔하고 완벽한 레시피 데이터(JSON)로 정리해주세요.

규칙:
1. 요리 이름(name): 군더더기 없는 명확하고 군침 도는 요리명 (예: "백종원 초간단 제육볶음", "성시경 브리치즈 파스타").
2. 카테고리(cat): 다음 중 정확히 하나 선택: '밑반찬', '국·찌개', '메인 요리', '면·분식', '밥·죽', '간식·디저트', '기타'
3. 조리 시간(min): 총 예상 조리 시간 (분 단위 정수 숫자)
4. 기준 인분(serv): 재료 분량의 기준 인분수 (숫자, 알기 어려우면 2)
5. 재료(ing): 필수 주재료와 분량을 한 줄에 하나씩 줄바꿈(\\n)으로 구분. (예: "돼지고기 앞다리살 600g\\n양파 1개\\n대파 1대")
6. 양념(sau): 양념/소스와 분량을 한 줄에 하나씩 줄바꿈(\\n)으로 구분. (예: "고추장 2큰술\\n진간장 2큰술\\n설탕 1큰술\\n다진 마늘 1큰술")
7. 조리 순서(steps): 한 줄에 한 단계씩 순서대로 줄바꿈(\\n)으로 작성. 영상에서 확인되거나 유추 가능한 시점이 있다면 단계 시작 부분에 "01:23 재료 썰기" 처럼 "mm:ss 설명" 형태로 타임스탬프를 포함해주세요.
8. 꿀팁(tip): 영상에서 알려준 불 조절, 타이밍, 재료 대체 팁, 보관법 등 핵심 꿀팁
9. 한줄 요약(summary): 이 요리의 맛 특징과 핵심 매력 1~2문장 요약
10. 난이도(difficulty): '쉬움', '보통', '어려움' 중 하나
11. 예상 칼로리(calories): 1인분 기준 대략적인 칼로리 (예: "약 420 kcal")
12. 태그(tags): 요리 관련 해시태그 3~5개 문자열 배열`;

    const aiPromise = generateContentWithRetry({
      model: 'gemini-3.8-flash',
      contents: `아래 유튜브 요리 영상 정보를 분석하여 구조화된 한국어 레시피 JSON으로 정리해주세요:\n\n${contentForAi}`,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            cat: { type: Type.STRING },
            min: { type: Type.INTEGER },
            serv: { type: Type.INTEGER },
            ing: { type: Type.STRING },
            sau: { type: Type.STRING },
            steps: { type: Type.STRING },
            tip: { type: Type.STRING },
            summary: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            calories: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['name', 'cat', 'min', 'serv', 'ing', 'sau', 'steps'],
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI_TIMEOUT')), 9000)
    );

    const response: any = await Promise.race([aiPromise, timeoutPromise]);
    const parsedJson = JSON.parse(response?.text || '{}');

    // Ensure category safety
    const validCats = ['밑반찬', '국·찌개', '메인 요리', '면·분식', '밥·죽', '간식·디저트', '기타'];
    if (!validCats.includes(parsedJson.cat)) {
      parsedJson.cat = '메인 요리';
    }

    res.json({
      recipe: {
        ...parsedJson,
        channel: channel || undefined,
      },
      thumbnail,
      videoId,
    });
  } catch (error: any) {
    console.warn('Extraction API warning (using fallback parse):', error?.message || error);
    // Graceful fallback to guarantee user gets a working recipe even if model has temporary 503
    const fallback = createFallbackRecipe(videoTitle, channel, description);
    res.json({
      recipe: fallback,
      thumbnail,
      videoId,
      notice: '영상 정보를 기반으로 레시피가 생성되었습니다. 필요에 맞게 수정하여 저장하세요.',
    });
  }
});

/**
 * POST /api/analyze-recipe-text
 * Converts freeform text / recipe notes into structured recipe
 */
app.post('/api/analyze-recipe-text', async (req: Request, res: Response) => {
  const { title, text } = req.body;
  if (!text && !title) {
    return res.status(400).json({ error: '레시피 내용을 입력해주세요.' });
  }

  try {
    if (!ai) throw new Error('No AI key');

    const response = await generateContentWithRetry({
      model: 'gemini-3.8-flash',
      contents: `사용자가 자유롭게 작성한 요리 메모입니다. 내용을 왜곡하거나 누락하지 말고 재료, 양념, 조리순서, 팁으로 깔끔하게 정리해주세요:\n제목: ${title || '미정'}\n\n내용:\n${text}`,
      config: {
        systemInstruction:
          "당신은 레시피 정리 전문가입니다. 한국어로 깔끔한 요리 레시피 JSON(name, cat, min, serv, ing, sau, steps, tip, summary, difficulty, calories, tags)을 반환하세요. 카테고리는 ['밑반찬', '국·찌개', '메인 요리', '면·분식', '밥·죽', '간식·디저트', '기타'] 중 하나여야 합니다.",
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response?.text || '{}');
    res.json({ recipe: parsed });
  } catch (error: any) {
    console.warn('Analyze text error, using fallback:', error);
    res.json({
      recipe: {
        name: title || '직접 작성한 요리 레시피',
        cat: '메인 요리',
        min: 20,
        serv: 2,
        ing: text || '재료 정보',
        sau: '',
        steps: '1. 준비된 재료를 손질합니다.\n2. 순서에 따라 조리합니다.',
        tip: '작성하신 레시피 메모를 바탕으로 등록되었습니다.',
      },
    });
  }
});

/**
 * POST /api/ai/chef-chat
 * Real-time AI Chef Q&A for cooking advice
 */
app.post('/api/ai/chef-chat', async (req: Request, res: Response) => {
  const { currentRecipe, messages, question } = req.body;

  const recipeContext = currentRecipe
    ? `현재 사용자가 보고 있는 요리 레시피 정보:
요리명: ${currentRecipe.name}
카테고리: ${currentRecipe.cat}
재료: ${currentRecipe.ing}
양념: ${currentRecipe.sau}
조리순서: ${currentRecipe.steps}
꿀팁: ${currentRecipe.tip || ''}`
    : '현재 선택된 특정 레시피는 없습니다.';

  const systemInstruction = `당신은 대한민국 최고의 친절하고 유쾌하며 박학다식한 20년 경력의 'AI 셰프 마스터'입니다.
주방에서 요리 중인 사용자에게 따뜻하고 실용적인 조언을 제공합니다.
사용자가 간 맞추기, 재료 대체(예: "설탕 대신 올리고당 써도 돼?", "고기가 질긴데 어쩌지?"), 불 조절, 보관법 등을 물어보면
군더더기 없이 명쾌하고 실전에서 바로 쓸 수 있는 해결책을 알려주세요.
답변은 3~5문장 내외로 읽기 쉽게 줄바꿈과 이모지를 적절히 활용하세요.

${recipeContext}`;

  const chatHistory = Array.isArray(messages) ? messages : [];
  const prompt = question || (chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].content : '안녕하세요');

  try {
    if (!ai) throw new Error('No AI key');

    const response = await generateContentWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({ reply: response?.text });
  } catch (error: any) {
    console.warn('Chef chat fallback:', error?.message);
    res.json({
      reply:
        '👨‍🍳 요리 도중 도움이 필요하시군요! 짠맛은 양파나 감자, 물을 더해 중화하고, 설탕 대신 올리고당을 쓸 땐 1.2배 분량으로 가감하시면 맛있게 완성할 수 있습니다.',
    });
  }
});

/**
 * Dev vs Prod Serving
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
