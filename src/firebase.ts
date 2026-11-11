import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { collection, deleteDoc, doc, getDocs, getFirestore, setDoc } from 'firebase/firestore';
import type { Recipe } from './App';

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