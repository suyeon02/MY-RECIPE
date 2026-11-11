import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { collection, deleteDoc, doc, getDocs, getFirestore, setDoc } from 'firebase/firestore';
import type { Recipe } from './App';
import { extractYoutubeId } from './youtubeParser';

const firebaseConfig = {
  apiKey: 'AIzaSyA6dmsBjFwR1e9lYXzGuPlEAmlx6PsdjjM',
  authDomain: 'my-recipe-3008f.firebaseapp.com',
  projectId: 'my-recipe-3008f',
  storageBucket: 'my-recipe-3008f.firebasestorage.app',
  messagingSenderId: '375766443670',
  appId: '1:375766443670:web:3c0438d32f264bd57384b7',
  measurementId: 'G-X08TQKJBPX',
};

const app = initializeApp(firebaseConfig);

// 👉 App Check 단일 초기화 및 중복 방지 처리
if (typeof window !== 'undefined') {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(
        import.meta.env.VITE_FIREBASE_APP_CHECK_KEY || '6LdvlhouAAAAAXredEPJ6-rbelrtW4ez6mOx4c4'
      ),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.log('App Check already initialized');
  }
}

const db = getFirestore(app);
const publicRecipes = collection(db, 'publicRecipes');
const ai = getAI(app, { backend: new GoogleAIBackend() });
const recipeImageModel = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  generationConfig: { responseMimeType: 'application/json' },
});

async function resizeRecipeImage(dataUrl: string, maxSize = 1600): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('사진을 처리하지 못했어요.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function organizeRecipePhoto(dataUrl: string) {
  const resizedDataUrl = await resizeRecipeImage(dataUrl);
  const base64 = resizedDataUrl.split(',')[1];
  if (!base64) throw new Error('사진 데이터를 읽지 못했어요.');
  const mimeType = 'image/jpeg';
  const prompt = '사진 속 레시피를 읽고 재료, 양념, 조리 순서로 정리해 JSON만 반환해. 사진에서 확인할 수 없는 내용은 추측하지 말고 빈 문자열로 둬. 형식: {"name":"요리 이름","cat":"카테고리","min":0,"serv":2,"ing":"재료와 분량, 줄바꿈 구분","sau":"양념과 분량, 줄바꿈 구분","steps":"조리 순서, 줄바꿈 구분","tip":"팁"}. 카테고리는 밑반찬/국·찌개/메인 요리/면·분식/밥·죽/간식·디저트/기타 중 하나로 해.';
  let result;
  try {
    result = await recipeImageModel.generateContent([prompt, {
      inlineData: { data: base64, mimeType },
    }]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/\b503\b|deadline expired/i.test(message)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    result = await recipeImageModel.generateContent([prompt, {
      inlineData: { data: base64, mimeType },
    }]);
  }
  return JSON.parse(result.response.text());
}

// ---------------------------------------------------------------------------
// 서버(/api/...) 없이 Gemini로 직접 처리하는 기능들 (GitHub Pages는 서버가 없어요)
// ---------------------------------------------------------------------------

async function generateWithRetry(parts: Parameters<typeof recipeImageModel.generateContent>[0]) {
  try {
    return await recipeImageModel.generateContent(parts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/\b503\b|deadline expired|overloaded/i.test(message)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await recipeImageModel.generateContent(parts);
  }
}

function parseJsonText(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI 응답을 해석하지 못했어요.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * 유튜브 링크 -> 레시피 추출. 기존 /api/extract-youtube 와 같은 모양({ recipe, videoId })을 돌려줘서
 * App.tsx 의 나머지 코드는 그대로 쓸 수 있어요. (공개/일부 공개 영상만 가능)
 */
export async function extractYoutubeRecipe(url: string) {
  const videoId = extractYoutubeId(url);
  if (!videoId) throw new Error('유튜브 링크만 지원해요.');
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const prompt = `이 요리 영상을 보고 레시피를 정리해 JSON만 반환해. 영상에서 확인할 수 없는 내용은 추측하지 말고 빈 문자열로 둬.
형식: {"name":"요리 이름","cat":"카테고리","min":25,"serv":2,"ing":"재료와 분량, 줄바꿈 구분","sau":"양념과 분량, 줄바꿈 구분","steps":"조리 순서, 줄바꿈 구분","tip":"팁","summary":"한 줄 소개","difficulty":"쉬움/보통/어려움 중 하나","calories":"1인분 예상 칼로리 (모르면 빈 문자열)","tags":["#태그"]}
규칙:
- steps는 각 줄 맨 앞에 그 단계가 영상에서 나오는 시간을 mm:ss 로 붙여. 예: 01:15 양념장을 만든다
- 재료와 양념은 한 줄에 하나씩 "이름 분량" 형태로 써. 예: 돼지고기 600g
- min은 조리 시간(분)을 숫자로, serv는 인분 수를 숫자로 써.
- 카테고리는 밑반찬/국·찌개/메인 요리/면·분식/밥·죽/간식·디저트/기타 중 하나로 해.`;

  const result = await generateWithRetry([
    { fileData: { mimeType: 'video/mp4', fileUri: watchUrl } },
    prompt,
  ]);
  return { recipe: parseJsonText(result.response.text()), videoId, thumbnail: '' };
}

/** 요리 도우미 채팅 (기존 /api/ai/chef-chat 대체) */
export async function askChef(
  question: string,
  currentRecipe: Recipe | undefined,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const history = messages
    .slice(-8)
    .map((m) => `${m.role === 'user' ? '사용자' : '요리 도우미'}: ${m.content}`)
    .join('\n');
  const recipeText = currentRecipe
    ? `현재 레시피: ${currentRecipe.name}\n재료: ${currentRecipe.ing}\n양념: ${currentRecipe.sau}\n조리 순서: ${currentRecipe.steps}`
    : '현재 선택한 레시피는 없어요.';
  const prompt = `너는 친절한 한국 요리 도우미야. 아래 레시피와 대화를 참고해서 마지막 질문에 3~5문장으로 짧고 실용적으로 한국어로 답해. JSON이 아니라 일반 문장으로 답해.\n\n${recipeText}\n\n대화:\n${history}\n\n질문: ${question}`;
  const chatModel = getGenerativeModel(ai, { model: 'gemini-3.5-flash-lite' });
  const result = await chatModel.generateContent(prompt);
  return result.response.text().trim();
}

export async function getPublicRecipes(localRecipes: Recipe[] = []): Promise<Recipe[]> {
  const snapshot = await getDocs(publicRecipes);
  const localById = new Map(localRecipes.map((recipe) => [String(recipe.id), recipe]));
  return snapshot.docs.map((item) => {
    const cloudRecipe = item.data() as Recipe;
    const localImage = localById.get(item.id)?.img;
    return cloudRecipe.img || !localImage ? cloudRecipe : { ...cloudRecipe, img: localImage };
  });
}

export async function savePublicRecipes(recipes: Recipe[]): Promise<void> {
  const existing = await getDocs(publicRecipes);
  const currentIds = new Set(recipes.map((recipe) => String(recipe.id)));
  await Promise.all(existing.docs.filter((item) => !currentIds.has(item.id)).map((item) => deleteDoc(item.ref)));
  await Promise.all(recipes.map((recipe) => {
    const safeRecipe = Object.fromEntries(
      Object.entries(recipe).filter(([key, value]) =>
        value !== undefined && !(key === 'img' && typeof value === 'string' && value.startsWith('data:'))
      )
    );
    return setDoc(doc(publicRecipes, String(recipe.id)), safeRecipe);
  }));
}