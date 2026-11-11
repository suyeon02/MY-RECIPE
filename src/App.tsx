import React, { useState, useEffect } from 'react';
import { getPublicRecipes, savePublicRecipes, organizeRecipePhoto, extractYoutubeRecipe, askChef } from './firebase';

export interface Recipe {
  id: number;
  name: string;
  cat: string;
  min: number | string;
  serv: number;
  ing: string;
  sau: string;
  steps: string;
  tip: string;
  url: string;
  src: 'sns' | 'my' | 'photo' | 'ai';
  img?: string;
  t: number;
  fav?: number;
  cooked?: number;
  summary?: string;
  difficulty?: string;
  calories?: string;
  tags?: string[];
  channel?: string;
}

const CATS = ['밑반찬', '국·찌개', '메인 요리', '면·분식', '밥·죽', '간식·디저트', '기타'];
const EMJ = ['🥗', '🍲', '🍖', '🍜', '🍙', '🍰', '🍽️'];
const SL: Record<string, string> = { sns: 'SNS', my: '직접 작성', photo: '사진', ai: 'AI' };
const TS = /^([0-9]{1,2}):([0-9]{2}) +(.*)$/;

const SEED_RECIPES: Recipe[] = [
  {
    id: 1,
    name: '제육볶음',
    cat: '메인 요리',
    src: 'sns',
    url: 'https://www.youtube.com/watch?v=rb7ff_r6G6g',
    min: 25,
    serv: 2,
    ing: '돼지고기 앞다리살 600g,양파 1개,대파 1대',
    sau: '고추장 2큰술\n간장 2큰술\n설탕 1큰술\n다진 마늘 1큰술',
    steps: '00:30 양파와 대파를 먹기 좋게 썬다\n01:15 고추장·간장·설탕·마늘을 섞어 양념장을 만든다\n02:30 고기를 양념에 10분 재운다\n04:10 센 불에서 고기를 8분 볶는다\n06:20 양파와 대파를 넣고 3분 더 볶는다',
    tip: '센 불에서 빠르게 볶아야 고기가 질기지 않고 육즙이 살아있어요.',
    t: 1710000000000,
    fav: 1,
  },
  {
    id: 2,
    name: '계란말이',
    cat: '밑반찬',
    src: 'my',
    url: '',
    min: 10,
    serv: 2,
    ing: '계란 4개\n당근 1/4개\n대파 1/2대',
    sau: '소금 1꼬집\n맛술 1큰술',
    steps: '계란을 풀고 다진 채소와 양념을 섞는다\n약불에서 얇게 부어 5분간 돌돌 만다\n식힌 뒤 예쁘게 썬다',
    tip: '불이 너무 세면 탈 수 있으니 약불을 유지하세요.',
    t: 1709900000000,
    fav: 0,
  },
];


const LOCAL_STORAGE_KEY = 'my_recipes_proto';

// Helper functions matching original prototype
const L = (s: string) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

const splitIngredientLine = (line: string) => {
  const cleanLine = line.replace(/\(([\d½¼¾./~-]+)\)/g, '$1큰술');
  const match = cleanLine.match(/^(.*\S)\s+((?:약\s*)?[\d½¼¾][\d./½¼¾~\-]*\s*\S*)$/);
  if (match) {
    let name = match[1];
    let amount = match[2].trim();
    if (/^(약\s*)?[\d½¼¾./~-]+$/.test(amount)) {
      amount = `${amount}큰술`;
    }
    return { name, amount };
  }
  const simpleMatch = cleanLine.match(/^(.*\S)\s+([\d.]+)$/);
  if (simpleMatch) {
    return { name: simpleMatch[1], amount: `${simpleMatch[2]}큰술` };
  }
  return { name: cleanLine, amount: '' };
};

const scaleIngredientAmount = (amount: string, ratio: number) => {
  if (!amount || ratio === 1) return amount;
  return amount.replace(/(약\s*)?(\d+(?:\.\d+)?|[½¼¾])(?:\/(\d+))?(\s*\S*)?/, (match, approx, value, denominator, unit) => {
    const fractionValues: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
    const numericValue = fractionValues[value] ?? Number(value);
    const scaled = (numericValue / (denominator ? Number(denominator) : 1)) * ratio;
    const rounded = Number(scaled.toFixed(2));
    const resolvedUnit = unit ? unit.trim() : '';
    return `${approx || ''}${rounded}${resolvedUnit ? ' ' + resolvedUnit : ''}`;
  });
};

const INGREDIENT_ICONS: [RegExp, string][] = [
  [/돼지|삼겹|목살|앞다리|소고기|등심|불고기|고기/, '🥩'],
  [/닭/, '🍗'], [/양파/, '🧅'], [/파프리카|피망/, '🫑'], [/대파|쪽파|파/, '🌿'],
  [/마늘/, '🧄'], [/고추|청양/, '🌶️'], [/간장|된장|쌈장|소스|액젓/, '🫙'],
  [/설탕|올리고당|물엿|꿀/, '🍯'], [/소금|후추/, '🧂'], [/기름|참깨|들깨|깨/, '🫒'],
  [/계란|달걀/, '🥚'], [/두부/, '🧈'], [/김치|배추|시금치|상추|양배추/, '🥬'],
  [/감자/, '🥔'], [/고구마/, '🍠'], [/당근/, '🥕'], [/버섯/, '🍄'], [/호박|오이/, '🥒'],
  [/토마토/, '🍅'], [/쌀|밥/, '🍚'], [/면|국수|파스타|라면/, '🍜'], [/물|육수/, '💧'],
  [/우유/, '🥛'], [/버터/, '🧈'], [/치즈/, '🧀'], [/새우/, '🦐'],
  [/생선|고등어|멸치/, '🐟'], [/오징어/, '🦑'], [/식초|맛술|미림|술/, '🍶'],
  [/옥수수/, '🌽'], [/콩나물|숙주/, '🌱'],
];

const getIngredientIcon = (name: string) =>
  INGREDIENT_ICONS.find(([pattern]) => pattern.test(name))?.[1] || '🍽️';

const DownloadIcon = () => (
  <svg className="download-icon" width="32"  stroke="#505050"
strokeWidth="0.4"
strokeLinejoin="round" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M4.97 12.97a.75.75 0 101.06 1.06L11 9.06v12.19a.75.75 0 001.5 0V9.06l4.97 4.97a.75.75 0 101.06-1.06l-6.25-6.25a.75.75 0 00-1.06 0l-6.25 6.25zM4.75 3.5a.75.75 0 010-1.5h14.5a.75.75 0 010 1.5H4.75z" />
  </svg>
);

const CopyIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path fillRule="evenodd" d="M4.75 3A1.75 1.75 0 003 4.75v9.5c0 .966.784 1.75 1.75 1.75h1.5a.75.75 0 000-1.5h-1.5a.25.25 0 01-.25-.25v-9.5a.25.25 0 01.25-.25h9.5a.25.25 0 01.25.25v1.5a.75.75 0 001.5 0v-1.5A1.75 1.75 0 0014.25 3h-9.5zm5 5A1.75 1.75 0 008 9.75v9.5c0 .966.784 1.75 1.75 1.75h9.5A1.75 1.75 0 0021 19.25v-9.5A1.75 1.75 0 0019.25 8h-9.5zM9.5 9.75a.25.25 0 01.25-.25h9.5a.25.25 0 01.25.25v9.5a.25.25 0 01-.25.25h-9.5a.25.25 0 01-.25-.25v-9.5z" />
  </svg>
);


const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    className="heart-icon"
    width="23"
    height="23"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="#505050"
strokeWidth="0.4"
strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {filled ? (
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    ) : (
      <path
        fillRule="evenodd"
        d="M6.736 4C4.657 4 2.5 5.88 2.5 8.514c0 3.107 2.324 5.96 4.861 8.12a29.66 29.66 0 004.566 3.175l.073.041.073-.04c.271-.153.661-.38 1.13-.674.94-.588 2.19-1.441 3.436-2.502 2.537-2.16 4.861-5.013 4.861-8.12C21.5 5.88 19.343 4 17.264 4c-2.106 0-3.801 1.389-4.553 3.643a.75.75 0 01-1.422 0C10.537 5.389 8.841 4 6.736 4zM12 20.703l.343.667a.75.75 0 01-.686 0l.343-.667zM1 8.513C1 5.053 3.829 2.5 6.736 2.5 9.03 2.5 10.881 3.726 12 5.605 13.12 3.726 14.97 2.5 17.264 2.5 20.17 2.5 23 5.052 23 8.514c0 3.818-2.801 7.06-5.389 9.262a31.146 31.146 0 01-5.233 3.576l-.025.013-.007.003-.002.001-.344-.666-.343.667-.003-.002-.007-.003-.025-.013A29.308 29.308 0 0110 20.408a31.147 31.147 0 01-3.611-2.632C3.8 15.573 1 12.332 1 8.514z"
      />
    )}
  </svg>
);


const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#505050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);


const EditIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#505050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// 뒤로가기 화살표 SVG 아이콘
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M10.78 19.03a.75.75 0 01-1.06 0l-6.25-6.25a.75.75 0 010-1.06l6.25-6.25a.75.75 0 111.06 1.06L5.81 11.5h14.44a.75.75 0 010 1.5H5.81l4.97 4.97a.75.75 0 010 1.06z" />
  </svg>
);


// 갤러리 아이콘 (회색)
const GalleryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// 카메라 아이콘 (회색)
const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const YouTubeicon = () => (
  <svg width="50" height="50" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d10808">
    <title>YouTube icon</title>
    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
  </svg>
);

const extractYtId = (value: string) => {
  const input = String(value || '').trim();
  try {
    const parsed = new URL(input);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let id = parsed.searchParams.get('v') || '';
    if (!id && (host === 'youtu.be' || host === 'm.youtube.com' || host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com')) {
      id = parsed.pathname.match(/\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1] || '';
      if (!id && host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
  } catch { /* Try a permissive match for URLs without a scheme. */ }
  const match = input.match(/(?:youtu\.be\/|(?:watch\?[^#]*v=|(?:shorts|embed|live|v)\/))([A-Za-z0-9_-]{11})/i);
  return match?.[1] || '';
};

const getYtThumbnail = (id: string, quality = 'hqdefault') => 'https://i.ytimg.com/vi/' + id + '/' + quality + '.jpg';

const getEmoji = (cat: string) => {
  const idx = CATS.indexOf(cat);
  return idx >= 0 ? EMJ[idx] : '🍽️';
};

export default function App() {
  // Recipes list
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    return SEED_RECIPES;
  });

  const [cloudReady, setCloudReady] = useState(false);

  // Navigation & View States
  const [tab, setTab] = useState<'home' | 'my' | 'imp' | 'ai'>('home');
  const [imp, setImp] = useState<'' | 'sns' | 'photo' | 'my' | 'ai'>('');
  const [viewRecipeId, setViewRecipeId] = useState<number | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe> | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');

  // Servings stepper in Detail View
  const [servings, setServings] = useState(2);

  // SNS Import state
  const [snsUrl, setSnsUrl] = useState('');
  const [snsLoading, setSnsLoading] = useState(false);
  const [snsMessage, setSnsMessage] = useState('');

  // Direct edit state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftIngredients, setDraftIngredients] = useState('');
  const [draftSeasonings, setDraftSeasonings] = useState('');
  const [draftSteps, setDraftSteps] = useState('');
  const [draftTip, setDraftTip] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [photoAiError, setPhotoAiError] = useState("");
    const [previewPhoto, setPreviewPhoto] = useState('');

  // Delete confirm id
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Export Modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSelected, setExportSelected] = useState<Record<number, boolean>>({});

  // Toast
  const [toastText, setToastText] = useState<string | null>(null);

  // AI Chef
  const [curChefRecipeId, setCurChefRecipeId] = useState<number | ''>('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chefInput, setChefInput] = useState('');
  const [chefLoading, setChefLoading] = useState(false);


//재료 리스트
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);

  // Load the public shared recipe list on open; seed an empty collection from local recipes.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cloudRecipes = await getPublicRecipes(recipes);
        if (!active) return;
        if (cloudRecipes.length) setRecipes(cloudRecipes);
        else await savePublicRecipes(recipes);
        if (active) setCloudReady(true);
      } catch (error) {
        console.error('Firebase recipe load failed:', error);
        if (active) showToast('Firebase 연결 실패: Firestore 규칙을 확인해 주세요.');
      }
    })();
    return () => { active = false; };
  // Existing local recipes provide first-use migration and browser-only photo fallback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cloudReady) return;
    savePublicRecipes(recipes).catch((error) => {
      console.error('Firebase recipe save failed:', error);
      showToast('클라우드 저장에 실패했어요. Firestore 규칙을 확인해 주세요.');
    });
  }, [recipes, cloudReady]);

  // Save recipes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recipes));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [recipes]);

  // Sync servings and reset video player when viewing recipe
  useEffect(() => {
    setIsPlayingVideo(false);
    if (viewRecipeId) {
      const target = recipes.find((r) => r.id === viewRecipeId);
      if (target) setServings(Number(target.serv) || 2);
    }
  }, [viewRecipeId, recipes]);

  const showToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText((curr) => (curr === msg ? null : curr));
    }, 2400);
  };

  const toggleFav = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecipes((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const next = r.fav ? 0 : 1;
          showToast(next ? '즐겨찾기에 추가했어요 ♥' : '즐겨찾기에서 해제했어요');
          return { ...r, fav: next };
        }
        return r;
      })
    );
  };

  const handleDelete = (id: number) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);
    setViewRecipeId(null);
    showToast('레시피를 삭제했습니다.');
  };

  /**
   * CORE: SNS YouTube Extraction
   * Replaced broken fetchYoutubeDetails & window.claude with real Gemini backend
   */
  const handleExtractSns = async (urlToExtract?: string) => {
    const targetUrl = (urlToExtract || snsUrl).trim();
    if (!targetUrl) {
      setSnsMessage('유튜브 링크를 입력해 주세요.');
      return;
    }
    if (!/youtu/i.test(targetUrl)) {
      setSnsMessage('유튜브 링크를 올바르게 입력해 주세요. (인스타그램은 아직 지원하지 않아요)');
      return;
    }

    setSnsLoading(true);
    setSnsMessage('유튜브 영상과 더보기란을 분석하여 레시피를 추출하는 중입니다... 🍳');

    try {
      const data = await extractYoutubeRecipe(targetUrl);
      const extracted = data.recipe || {};
      const parsedVideoId = extractYtId(targetUrl);
      const responseVideoId = typeof data.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(data.videoId) ? data.videoId : '';
      const videoId = parsedVideoId || responseVideoId;
      const thumbnail = videoId ? getYtThumbnail(videoId) : data.thumbnail || '';

      const newRecipe: Recipe = {
        id: Date.now(),
        name: extracted.name || '유튜브 요리 레시피',
        cat: CATS.includes(extracted.cat) ? extracted.cat : '메인 요리',
        min: extracted.min || 20,
        serv: extracted.serv || 2,
        ing: Array.isArray(extracted.ing) ? extracted.ing.join('\n') : extracted.ing || '재료 정보',
        sau: Array.isArray(extracted.sau) ? extracted.sau.join('\n') : extracted.sau || '',
        steps: Array.isArray(extracted.steps) ? extracted.steps.join('\n') : extracted.steps || '맛있게 조리합니다.',
        tip: extracted.tip || '영상에서 소개된 요리 팁입니다.',
        summary: extracted.summary || '',
        difficulty: extracted.difficulty || '보통',
        calories: extracted.calories || '',
        tags: extracted.tags || ['#유튜브레시피'],
        url: targetUrl,
        src: 'sns',
        img: thumbnail,
        t: Date.now(),
        fav: 0,
      };

      setRecipes((prev) => [newRecipe, ...prev]);
      setSnsLoading(false);
      setSnsMessage('');
      setSnsUrl('');
      setImp('');
      setViewRecipeId(newRecipe.id);
      showToast('영상을 분석해 레시피로 저장했어요! 🎉');
    } catch (err: any) {
      console.error('SNS extract error:', err);
      setSnsLoading(false);
      setSnsMessage('영상 추출 중 일시적인 오류가 발생했습니다. 수기 편집 화면으로 전환합니다.');

      // Fallback: open edit screen with partial info
      const fallbackYtId = extractYtId(targetUrl);
      setEditingRecipe({
        id: 0,
        name: '',
        cat: '기타',
        min: 20,
        serv: 2,
        ing: '',
        sau: '',
        steps: '',
        tip: '',
        url: targetUrl,
        src: 'sns',
        img: fallbackYtId ? `https://i.ytimg.com/vi/${fallbackYtId}/hqdefault.jpg` : '',
      });
      setImp('');
      showToast('직접 레시피를 보완해 저장해 보세요.');
    }
  };

  // Direct manual save
  const handleSaveDirect = () => {
    if (!draftIngredients.trim() && !draftSeasonings.trim() && !draftSteps.trim()) {
      showToast('재료, 양념, 만드는 순서 중 하나 이상 입력해 주세요.');
      return;
    }
    const firstLine = (draftIngredients || draftSteps).trim().split('\n').filter(Boolean)[0] || '나만의 요리 노트';
    const newRecipe: Recipe = {
      id: Date.now(),
      name: draftTitle.trim() || firstLine.slice(0, 20),
      cat: '기타',
      min: 20,
      serv: 2,
      ing: draftIngredients,
      sau: draftSeasonings,
      steps: draftSteps,
      tip: draftTip,
      url: '',
      src: imp === 'photo' ? 'photo' : 'my',
      img: previewPhoto || '',
      t: Date.now(),
      fav: 0,
    };
    setRecipes((prev) => [newRecipe, ...prev]);
    setDraftTitle('');
    setDraftIngredients('');
    setDraftSeasonings('');
    setDraftSteps('');
    setDraftTip('');
    setPreviewPhoto('');
    setImp('');
    setViewRecipeId(newRecipe.id);
    showToast('새 레시피를 저장했어요.');
  };

  // Recipe Editor Save
  const handleSaveEditor = (formEl: HTMLFormElement) => {
    const formData = new FormData(formEl);
    const name = String(formData.get('name') || '').trim();
    if (!name) {
      showToast('요리명을 입력해 주세요');
      return;
    }

    const savedRecipe: Recipe = {
      id: editingRecipe?.id || Date.now(),
      name,
      cat: String(formData.get('cat') || '기타'),
      min: Number(formData.get('min')) || 0,
      serv: Number(formData.get('serv')) || 2,
      ing: String(formData.get('ing') || ''),
      sau: String(formData.get('sau') || ''),
      steps: String(formData.get('steps') || ''),
      tip: String(formData.get('tip') || ''),
      url: String(formData.get('url') || '').trim(),
      src: (editingRecipe?.src as any) || 'my',
      img: editingRecipe?.img || '',
      t: Date.now(),
      fav: editingRecipe?.fav || 0,
    };

    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === savedRecipe.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRecipe.id ? savedRecipe : r));
      }
      return [savedRecipe, ...prev];
    });

    setEditingRecipe(null);
    setViewRecipeId(savedRecipe.id);
    showToast('레시피를 저장했습니다.');
  };

  // Photo picker
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewPhoto(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const handleRecognizePhoto = async () => {
    if (!previewPhoto) {
      showToast('먼저 레시피 사진을 선택해 주세요.');
      return;
    }
    setPhotoAiError('');
    setOcrLoading(true);
    try {
      const organized = await organizeRecipePhoto(previewPhoto);
      if (!organized || (!organized.ing && !organized.sau && !organized.steps)) {
        showToast('사진에서 레시피 내용을 찾지 못했어요. 더 선명한 사진으로 다시 시도해 주세요.');
        return;
      }
      if (organized.name) setDraftTitle(organized.name);
      setDraftIngredients(organized.ing || '');
      setDraftSeasonings(organized.sau || '');
      setDraftSteps(organized.steps || '');
      setDraftTip(organized.tip || '');
      showToast('AI가 사진을 레시피로 정리했어요. 결과를 확인해 주세요.');
    } catch (error) {
      console.error('Photo AI recognition failed:', error);
      const detail = error instanceof Error ? error.message : String(error);
      if (/429|quota exceeded|resource_exhausted|free_tier/i.test(detail)) {
        const retrySeconds = detail.match(/retry in\s+([0-9.]+)s/i)?.[1]
          || detail.match(/retryDelay["']?\s*:\s*["']([0-9.]+)s/i)?.[1];
        const wait = retrySeconds ? Math.ceil(Number(retrySeconds)) : 60;
        setPhotoAiError(`Gemini 무료 요청 한도(분당 5회)에 도달했어요. 약 ${wait}초 후 다시 시도해 주세요.`);
      } else {
        setPhotoAiError(detail);
      }
    } finally {
      setOcrLoading(false);
    }
  };

  // AI Chef Q&A
  const handleAskChef = async (queryText?: string) => {
    const question = (queryText || chefInput).trim();
    if (!question) return;

    const newMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...chatMessages,
      { role: 'user', content: question },
    ];
    setChatMessages(newMessages);
    setChefInput('');
    setChefLoading(true);

    const currentRecipe = recipes.find((r) => r.id === curChefRecipeId);

    try {
      const reply = await askChef(question, currentRecipe, newMessages);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply || '맛있게 조리해보세요!' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '👨‍🍳 간이 세다면 양파나 채소를 더하고, 설탕 대신 올리고당은 1.2배 분량으로 조절하시면 맛있게 완성됩니다.',
        },
      ]);
    } finally {
      setChefLoading(false);
    }
  };

  // Export Selected Text
  const getSelectedRecipesText = () => {
    const selected = recipes.filter((r) => exportSelected[r.id]);
    if (selected.length === 0) {
      showToast('선택된 레시피가 없어요');
      return null;
    }
    return selected
      .map(
        (r) =>
          `====================\n요리명: ${r.name}\n카테고리: ${r.cat}\n조리시간: ${r.min || '-'}분\n원문링크: ${r.url || '-'}\n\n[재료]\n${r.ing}\n\n[양념]\n${r.sau || '-'}\n\n[조리순서]\n${r.steps}\n\n[나만의 팁]\n${r.tip || '-'}\n====================`
      )
      .join('\n\n');
  };

  const copyRecipes = () => {
    const text = getSelectedRecipesText();
    if (!text) {
      showToast('내보낼 레시피를 선택해 주세요.');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast('클립보드에 복사되었어요! 메모장에 붙여넣으세요.');
        setExportOpen(false);
      })
      .catch(() => {
        showToast('복사에 실패했습니다.');
      });
  };

  const shareToMemo = async () => {
    const text = getSelectedRecipesText();
    if (!text) {
      showToast('내보낼 레시피를 선택해 주세요.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: '내 레시피 모음', text });
        setExportOpen(false);
        showToast('삼성노트에서 저장을 완료해 주세요.');
      } catch (e: any) {
        if (e.name === 'AbortError') {
          showToast('공유가 취소됐어요. 복사하기를 이용할 수 있어요.');
        } else {
          copyRecipes();
        }
      }
    } else {
      copyRecipes();
    }
  };

  const toggleAllExport = () => {
    const all = recipes.every((r) => exportSelected[r.id]);
    const next: Record<number, boolean> = {};
    recipes.forEach((r) => {
      next[r.id] = !all;
    });
    setExportSelected(next);
  };

  // Filter recipes for 'my' and search
  const filteredRecipes = recipes.filter((r) => {
    const matchCat = !selectedCat || r.cat === selectedCat;
    const matchQuery =
      !searchQuery ||
      (r.name + r.ing + r.sau + (r.summary || '')).toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = selectedFilter === '즐겨찾기' ? !!r.fav : true;
    return matchCat && matchQuery && matchFilter;
  });

  const recentRecipes = [...recipes].sort((a, b) => b.t - a.t).slice(0, 6);
  const favoriteRecipes = recipes.filter((r) => r.fav);

  const currentViewingRecipe = recipes.find((r) => r.id === viewRecipeId);

  // Render thumbnail
  const renderThumbnail = (r: Recipe, className = 'ph') => {
    const ytId = extractYtId(r.url);
    const photoUrl = ytId ? getYtThumbnail(ytId) : r.img || '';

    if (photoUrl) {
      return (
        <div className={className}>
          <img
            src={photoUrl}
            alt={r.name}
            className="pi"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              const image = e.target as HTMLImageElement;
              const ytId = extractYtId(r.url);
              if (ytId && !image.src.includes('/mqdefault.jpg')) {
                image.src = getYtThumbnail(ytId, 'mqdefault');
                return;
              }
              image.style.display = 'none';
              const parent = image.parentElement;
              if (parent) {
                const fallback = parent.querySelector('.fallback-emoji') as HTMLElement;
                if (fallback) fallback.style.display = 'block';
              }
            }}
          />
          <span className="fallback-emoji" style={{ display: 'none' }}>
            {getEmoji(r.cat)}
          </span>
        </div>
      );
    }
    return <div className={className}>{getEmoji(r.cat)}</div>;
  };

  return (
    <div id="app">
      {/* 1. Header (when not in edit mode or detail view) */}
      {!editingRecipe && !viewRecipeId && (
        <div className="top">
          <b className="lg">MY RECIPE</b>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              className="ic-btn"
              onClick={() => {
                const initialSel: Record<number, boolean> = {};
                recipes.forEach((r) => (initialSel[r.id] = true));
                setExportSelected(initialSel);
                setExportOpen(true);
              }}
              title="레시피 내보내기"
            >
              <DownloadIcon />
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main>
        {editingRecipe ? (
          /* =========================================================
              SCREEN 2: RECIPE EDITOR
             ========================================================= */
          <div className="recipe-edit-container">
            {/* 상단 뒤로가기(취소) 버튼 */}
            <div style={{ marginBottom: '16px', marginTop: '12px' }}>
              <button
                type="button"
                className="ic"
                style={{ background: 'var(--cd)' }}
                onClick={() => setEditingRecipe(null)}
                title="수정 취소"
              >
                <BackIcon />
              </button>
            </div>
            <form
              className="recipe-editor-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditor(e.currentTarget);
              }}
            >
              <label className="fl">대표 사진</label>
              {editingRecipe.img && (
                <img
                  src={editingRecipe.img}
                  alt="미리보기"
                  style={{
                    width: '100%',
                    maxHeight: '220px',
                    objectFit: 'cover',
                    borderRadius: '20px',
                    marginBottom: '8px',
                  }}
                />
              )}
              <div className="row">
                <label className="bt o" htmlFor="ec" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <CameraIcon />
                   사진 찍기
                </label>
                <label className="bt o" htmlFor="eg"style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <GalleryIcon />
                   갤러리 선택
                </label>
              </div>
              <input id="ec" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
              <input id="eg" type="file" accept="image/*" hidden onChange={handlePhotoUpload} />

              <label className="fl">요리명</label>
              <input name="name" defaultValue={editingRecipe.name || ''} placeholder="요리 이름" />

              <label className="fl">카테고리</label>
              <select name="cat" defaultValue={editingRecipe.cat || '기타'}>
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label className="fl">조리 시간 (분)</label>
              <input name="min" type="number" defaultValue={editingRecipe.min || ''} placeholder="예: 25" />

              <label className="fl">기준 인분 (재료 분량이 몇 인분 기준인지)</label>
              <input name="serv" type="number" min={1} defaultValue={editingRecipe.serv || 2} />

              <label className="fl">재료 및 분량 (한 줄에 하나씩)</label>
              <textarea name="ing" id="e4" defaultValue={editingRecipe.ing || ''} />

              <label className="fl">양념 및 분량</label>
              <textarea name="sau" id="e5" defaultValue={editingRecipe.sau || ''} />

              <label className="fl">조리 순서 (한 줄에 한 단계 · 앞에 02:10 처럼 시간 표기 가능)</label>
              <textarea name="steps" id="e6" defaultValue={editingRecipe.steps || ''} />

              <label className="fl">나만의 요리 팁</label>
              <textarea name="tip" id="e7" defaultValue={editingRecipe.tip || ''} />

              <label className="fl">원본 영상 링크</label>
              <input name="url" defaultValue={editingRecipe.url || ''} placeholder="https://..." />

              <button type="submit" className="bt" style={{ marginTop: '20px' }}>
                저장
              </button>
            </form>
          </div>
        ) : viewRecipeId && currentViewingRecipe ? (
          /* =========================================================
              SCREEN 3: RECIPE DETAIL VIEW
             ========================================================= */
      <div className="recipe-detail">
            {/* 1. 상단 바: 뒤로가기 버튼 + [기존 유지] 하트 & 수정/삭제 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '12px' }}>
              {/* 왼쪽: 뒤로가기 버튼 */}
              <button
                type="button"
                className="ic"
                style={{ background: 'var(--cd)' }}
                onClick={() => setViewRecipeId(null)}
                title="뒤로가기"
              >
                <BackIcon />
              </button>

              {/* 오른쪽: 기존에 있던 즐겨찾기, 수정, 삭제 버튼 (유지) */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="ic"
                  style={{ color: currentViewingRecipe.fav ? 'var(--or)' : 'var(--sub)', background: 'var(--cd)' }}
                  onClick={(e) => toggleFav(currentViewingRecipe.id, e)}
                  title="즐겨찾기"
                >
                  <HeartIcon filled={!!currentViewingRecipe.fav} />
                </button>
                <button
                  type="button"
                  className="ic"
                  style={{ background: 'var(--cd)' }}
                  onClick={() => setEditingRecipe({ ...currentViewingRecipe })}
                  title="레시피 수정"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className={`ic ${deleteConfirmId === currentViewingRecipe.id ? 'rd' : ''}`}
                  style={{ background: deleteConfirmId === currentViewingRecipe.id ? '#e5484d' : 'var(--cd)' }}
                  onClick={() => handleDelete(currentViewingRecipe.id)}
                  title="레시피 삭제"
                >
                  {deleteConfirmId === currentViewingRecipe.id ? '삭제 확인' : <TrashIcon />}
                </button>
              </div>
            </div>

            {/* 2. 사진 (hero) 영역 - 사진 위에는 버튼 없음 */}
            <div className="hero">
              {isPlayingVideo && extractYtId(currentViewingRecipe.url) ? (
                <iframe
                  id="yp"
                  src={`https://www.youtube.com/embed/${extractYtId(currentViewingRecipe.url)}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`}
                  title={currentViewingRecipe.name}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    border: 0,
                  }}
                />
              ) : (
                <>
                  {currentViewingRecipe.img || extractYtId(currentViewingRecipe.url) ? (
                    <img
                      src={
                        currentViewingRecipe.src === 'sns' && extractYtId(currentViewingRecipe.url)
                          ? getYtThumbnail(extractYtId(currentViewingRecipe.url))
                          : currentViewingRecipe.img || getYtThumbnail(extractYtId(currentViewingRecipe.url))
                      }
                      alt={currentViewingRecipe.name}
                      className="pi"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                      onError={(e) => {
                        const image = e.target as HTMLImageElement;
                        const ytId = extractYtId(currentViewingRecipe.url);
                        if (ytId && !image.src.includes('/mqdefault.jpg')) {
                          image.src = getYtThumbnail(ytId, 'mqdefault');
                          return;
                        }
                        image.style.display = 'none';
                        const parent = image.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.hero-fallback-emoji') as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }
                      }}
                    />
                  ) : null}
                  <span
                    className="hero-fallback-emoji"
                    style={{
                      display: currentViewingRecipe.img || extractYtId(currentViewingRecipe.url) ? 'none' : 'block',
                    }}
                  >
                    {getEmoji(currentViewingRecipe.cat)}
                  </span>
                  {extractYtId(currentViewingRecipe.url) && (
                    <button
                      type="button"
                      className="play"
                      onClick={() => setIsPlayingVideo(true)}
                      title="영상 재생"
                    >
                      ▶
                    </button>
                  )}
                </>
              )}
            </div>

            {currentViewingRecipe.url && (
              <a
                className="s"
                href={currentViewingRecipe.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: '10px', color: 'var(--or)', fontWeight: 600 }}
              >
                원본 유튜브 영상에서 열기 ↗
              </a>
            )}

            <div className="rcp">
              <h2 className="title">{currentViewingRecipe.name}</h2>
              <div className="metabar">
                <p className="meta">
                  {currentViewingRecipe.cat} · {SL[currentViewingRecipe.src] || '레시피'}
                  {currentViewingRecipe.difficulty ? ` · 난이도 ${currentViewingRecipe.difficulty}` : ''}
                </p>
                <div className="stepper">
                  <button onClick={() => setServings((n) => Math.max(1, n - 1))}>−</button>
                  <span id="sgn">{servings}인분</span>
                  <button onClick={() => setServings((n) => Math.min(20, n + 1))}>+</button>
                </div>
              </div>

              {/* 3. 재료 영역 (숨기기/펼치기 토글 기능 + CSS 버튼 적용) */}
              <h3 
                className="ingredient-heading" 
                onClick={() => setIsIngredientsOpen((prev) => !prev)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', marginTop: '20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span>재료</span>
                  <span className="base-servings">
                    기준 {currentViewingRecipe.serv || 2}인분
                    {servings !== (currentViewingRecipe.serv || 2) && ` · 현재 ×${+(servings / (currentViewingRecipe.serv || 2)).toFixed(2)}`}
                  </span>
                </div>
                <button type="button" className="ingredient-toggle-btn">
                  {isIngredientsOpen ? '숨기기 ▴' : '펼치기 ▾'}
                </button>
              </h3>

              {isIngredientsOpen && (
                <div className="ingredient-list">
                  {[...L(currentViewingRecipe.ing), ...L(currentViewingRecipe.sau)].length > 0
                    ? [...L(currentViewingRecipe.ing), ...L(currentViewingRecipe.sau)].map((line, idx) => {
                        const ingredient = splitIngredientLine(line);
                        const factor = servings / (currentViewingRecipe.serv || 2);
                        const amount = scaleIngredientAmount(ingredient.amount, factor);
                        const amountParts = amount.match(/^(약\s*)?([0-9./½¼¾~-]+)\s*(.*)$/);
                        return (
                          <div key={idx} className="ing">
                            <span className="tile">{getIngredientIcon(ingredient.name)}</span>
                            <span className="nm">{ingredient.name}</span>
                            {amount && (
                              <span className="a">
                                {amountParts ? `${amountParts[1] || ''}${amountParts[2]}` : amount}
                                {amountParts?.[3] && <small>{amountParts[3]}</small>}
                              </span>
                            )}
                          </div>
                        );
                      })
                    : <p className="hint">재료 정보가 없어요.</p>}
                </div>
              )}

              {/* Steps */}
              <h3>조리 순서</h3>
            {currentViewingRecipe.url &&
              L(currentViewingRecipe.steps).some((x) => TS.test(x.replace(/^\s*\d+\s*[.)]\s*/, ''))) && (
                <p className="hint">시간이 표시된 단계를 누르면 영상이 그 구간으로 이동해요</p>
              )}

            {L(currentViewingRecipe.steps).map((step, idx) => {
              const normalizedStep = step.replace(/^\s*\d+\s*[.)]\s*/, '');
              const timeMatch = normalizedStep.match(TS);
              const timeStr = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '';
              const cleanStep = timeMatch ? timeMatch[3] : normalizedStep;
              const totalSec = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : 0;
              const videoTimestampUrl = currentViewingRecipe.url
                ? `${currentViewingRecipe.url}${currentViewingRecipe.url.includes('?') ? '&' : '?'}t=${totalSec}`
                : '';

              return (
                <div
                  key={idx}
                  className="card step"
                  style={{ cursor: timeMatch ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (timeMatch) {
                      const totalSec = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
                      const iframe = document.getElementById('yp') as HTMLIFrameElement;
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage(
                          JSON.stringify({ event: 'command', func: 'seekTo', args: [totalSec, true] }),
                          '*'
                        );
                        iframe.contentWindow.postMessage(
                          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                          '*'
                        );
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      } else if (currentViewingRecipe.url) {
                        window.open(
                          `${currentViewingRecipe.url}${currentViewingRecipe.url.includes('?') ? '&' : '?'}t=${totalSec}`,
                          '_blank'
                        );
                      }
                    }
                  }}
                >
                  <b className="num">{idx + 1}</b>
                  <div className="sb">
                    {timeStr && (videoTimestampUrl ? (
                      <a
                        className="chip"
                        href={videoTimestampUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ▶ {timeStr}
                      </a>
                    ) : <span className="chip">{timeStr}</span>)}
                    <p>{cleanStep}</p>
                  </div>
                </div>
              );
            })}

            {/* Tips */}
            {currentViewingRecipe.tip && (
              <>
                <h3>나만의 팁</h3>
                <div className="card tip">
                  {currentViewingRecipe.tip}
                </div>
              </>
            )}
            </div>
          </div>
        ) : tab === 'home' ? (
          /* =========================================================
              SCREEN 4: HOME TAB
             ========================================================= */
          <div className="home-screen">
            <p className="hi">좋은 하루예요 👋</p>
            <div className="hd">
              오늘은 어떤 <em>요리</em>를<br />
              해볼까요? 🍳
            </div>

            {/* Search Input */}
            <div className="sb">
              <i aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg></i>
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setSelectedCat('');
                    setSelectedFilter('');
                    setTab('my');
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>

            {/* Big SNS Import CTA Button */}
            <button
              className="bt"
              style={{ margin: '14px 0px 32px 0px' }}
              onClick={() => {
                setTab('imp');
                setImp('sns');
              }}
            >
              SNS 레시피 가져오기
            </button>

            {/* Categories */}
            <h3>카테고리</h3>
            <div className="cats">
            <button
                className="ct"
                onClick={() => {
                  setSelectedCat('');
                  setSearchQuery(''); // 검색어 초기화
                  setTab('my');
                }}
              >
                <span className="cat-icon">📖</span>
                <span className="cat-label">전체</span>
              </button>
              {CATS.map((c, i) => (
                <button
                  key={c}
                  className="ct"
                  onClick={() => {
                    setSelectedCat(c);
                    setTab('my');
                  }}
                >
                  <span className="cat-icon">{EMJ[i]}</span>
                  <span className="cat-label">{c}</span>
                </button>
              ))}
            </div>

            {/* Recent Recipes */}
            <div className="recent-heading">
              <h3>최근 레시피</h3>
              <span>{recentRecipes.length}개 저장됨</span>
            </div>
            <div className="hs">
              {recentRecipes.length > 0 ? (
                recentRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="pc"
                    onClick={() => setViewRecipeId(r.id)}
                  >
                    <div className="ph">
                      {renderThumbnail(r, 'ph-inner')}
                      <span
                        className="hr"
                        onClick={(e) => toggleFav(r.id, e)}
                        style={{ color: r.fav ? 'var(--or)' : 'var(--sub)' }}
                      >
                        <HeartIcon filled={!!r.fav} />
                      </span>
                    </div>
                    <div className="nm">
                      <div>{r.name}</div>
                      <div className="s">{r.cat}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="s">레시피가 없어요</p>
              )}
            </div>

            {/* Favorites */}
            <h3>즐겨찾기</h3>
            {favoriteRecipes.length > 0 ? (
              <div className="hs">
                {favoriteRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="pc"
                    onClick={() => setViewRecipeId(r.id)}
                  >
                    <div className="ph">
                      {renderThumbnail(r, 'ph-inner')}
                      <span
                        className="hr"
                        onClick={(e) => toggleFav(r.id, e)}
                        style={{ color: r.fav ? 'var(--or)' : 'var(--sub)' }}
                      >
                        <HeartIcon filled={!!r.fav} />
                      </span>
                    </div>
                    <div className="nm">
                      <div>{r.name}</div>
                      <div className="s">{r.cat}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="s">♡를 눌러 즐겨찾기에 추가해요</p>
            )}
          </div>
        ) : tab === 'my' ? (
          /* =========================================================
              SCREEN 5: MY RECIPE NOTES TAB
             ========================================================= */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 20px' }}>
              <h2 style={{ margin: 0 }}>요리 노트</h2>
              <button
                type="button"
                className="circ"
                aria-label={selectedFilter === '즐겨찾기' ? '전체 레시피 보기' : '즐겨찾기만 보기'}
                aria-pressed={selectedFilter === '즐겨찾기'}
                onClick={() => setSelectedFilter((curr) => (curr === '즐겨찾기' ? '' : '즐겨찾기'))}
                style={{ color: selectedFilter === '즐겨찾기' ? 'var(--or)' : 'var(--sub)', fontSize: '24px' }}
              >
                <HeartIcon filled={selectedFilter === '즐겨찾기'} />
              </button>
            </div>
            <input
              placeholder="요리명 또는 재료 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {/* Category Chips */}
            <div style={{ margin: '20px 0 20px' }}>
              <button
                className={`ch ${selectedCat === '' ? 'on' : ''}`}
                onClick={() => setSelectedCat('')}
              >
                전체
              </button>
              {CATS.map((c) => (
                <button
                  key={c}
                  className={`ch ${selectedCat === c ? 'on' : ''}`}
                  onClick={() => setSelectedCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>


            {/* Recipe List Cards */}
            <div className="recipe-note-list">
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="lc"
                    onClick={() => setViewRecipeId(r.id)}
                  >
                    {renderThumbnail(r, 'ph')}
                    <div className="nm">
                      <div>{r.name}</div>
                      <div className="s">
                        {r.cat} · {SL[r.src] || ''}
                      </div>
                    </div>
                    <span
                      className="hr"
                      onClick={(e) => toggleFav(r.id, e)}
                      style={{ color: r.fav ? 'var(--or)' : 'var(--sub)' }}
                    >
                      <HeartIcon filled={!!r.fav} />
                    </span>
                  </div>
                ))
              ) : (
                <p className="s" style={{ textAlign: 'center', marginTop: '30px' }}>
                  등록된 레시피가 없어요.
                </p>
              )}
            </div>
          </div>
        ) : tab === 'imp' ? (
          /* =========================================================
              SCREEN 6: ADD RECIPE (SNS / PHOTO / MANUAL)
             ========================================================= */
          <div>
            {!imp ? (
              <div>
                <h2>레시피 추가</h2>
                <div className="recipe-choice-list">
                  <div className="cd mc recipe-choice" onClick={() => setImp('sns')}>
                    <span className="mi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <YouTubeicon /></span>
                    <div className="recipe-choice-copy">
                      <b>SNS 링크로 가져오기</b>
                      <div className="s">유튜브 · 쇼츠 링크를 넣으면 AI가 레시피를 요약해줘요.</div>
                    </div>
              
                  </div>

                  <div className="cd mc recipe-choice" onClick={() => setImp('photo')}>
                    <span className="mi">📷</span>
                    <div className="recipe-choice-copy">
                      <b>사진으로 등록</b>
                      <div className="s">사진이나 손글씨 노트를 업로드하면, AI가 레시피를 <br />완성해 줘요</div>
                    </div>
                   
                  </div>

                  <div className="cd mc recipe-choice" onClick={() => setImp('my')}>
                    <span className="mi">✏️</span>
                    <div className="recipe-choice-copy">
                      <b>직접 작성</b>
                      <div className="s">대충 적어도 AI가 요리 이름, 재료, 조리 순서에 맞춰 <br /> 깔끔하게 정리해줘요.</div>
                    </div>
                   
                  </div>
                </div>
              </div>
            ) : imp === 'sns' ? (
              /* CORE CHANGED COMPONENT: SNS RECIPE EXTRACTOR */
             <div>
    {/* 상단 뒤로가기 버튼 */}
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        className="ic"
        style={{ background: 'var(--cd)' }}
        onClick={() => setImp('')}
        title="뒤로가기"
      >
        <BackIcon />
      </button>
    </div>
<h2>SNS 링크로 가져오기</h2>

                <input
                  id="u"
                  value={snsUrl}
                  onChange={(e) => setSnsUrl(e.target.value)}
                  placeholder="유튜브 영상 또는 쇼츠 링크 붙여넣기"
                  disabled={snsLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExtractSns();
                  }}
                />

                <p className="s" style={{ margin: '20px 0 40px', lineHeight: 1.5 }}>
                  유튜브 영상의 <b>더보기란 설명과 영상 정보</b>를 AI가 정밀 분석해 재료, 양념 비율, 조리 순서(타임스탬프), 꿀팁까지 자동으로 요약 정리해 드립니다.
                </p>

                <button
                  className="bt"
                  style={{ marginTop: '8px' }}
                  disabled={snsLoading}
                  onClick={() => handleExtractSns()}
                >
                  {snsLoading ? '유튜브 영상 분석 및 요약 중... ⏳' : '레시피 가져오기'}
                </button>

                {snsMessage && (
                  <p
                    id="ms"
                    className="s"
                    style={{
                      marginTop: '12px',
                      color: snsLoading ? 'var(--or)' : 'var(--tx)',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {snsMessage}
                  </p>
                )}
              </div>
            ) : imp === 'my' ? (
              /* Direct Manual Entry */

              
              <div>
    {/* 상단 뒤로가기 버튼 */}
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        className="ic"
        style={{ background: 'var(--cd)' }}
        onClick={() => setImp('')}
        title="뒤로가기"
      >
        <BackIcon />
      </button>
    </div>

                
<h2>직접 작성</h2>

                <input
                  id="d"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="레시피 이름 (예: 우리집 김치찌개)"
                />

                <label className="fl" htmlFor="direct-ingredients">재료 및 분량</label>
                <textarea
                  id="direct-ingredients"
                  value={draftIngredients}
                  onChange={(e) => setDraftIngredients(e.target.value)}
                  placeholder="예: 돼지고기 300g, 양파 1/2개"
                />

                <label className="fl" htmlFor="direct-seasonings">양념 및 분량</label>
                <textarea
                  id="direct-seasonings"
                  value={draftSeasonings}
                  onChange={(e) => setDraftSeasonings(e.target.value)}
                  placeholder="예: 간장 2큰술, 고춧가루 1큰술"
                />

                <label className="fl" htmlFor="direct-steps">만드는 순서</label>
                <textarea
                  id="direct-steps"
                  value={draftSteps}
                  onChange={(e) => setDraftSteps(e.target.value)}
                  placeholder="한 줄에 한 단계씩 적어 주세요."
                />

                <label className="fl" htmlFor="direct-tip">요리 팁 (선택)</label>
                <textarea
                  id="direct-tip"
                  value={draftTip}
                  onChange={(e) => setDraftTip(e.target.value)}
                  placeholder="보관 방법이나 맛있게 만드는 팁을 적어 주세요."
                />

                <label className="fl">대표 사진 (선택)</label>
                <div className="row">
                  <label className="bt o" htmlFor="my_fc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <CameraIcon />
                     사진 찍기
                  </label>
                  <label className="bt o" htmlFor="my_fg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <GalleryIcon />
                    갤러리 선택
                  </label>
                </div>
                <input id="my_fc" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
                <input id="my_fg" type="file" accept="image/*" hidden onChange={handlePhotoUpload} />

                {previewPhoto && (
                  <img
                    src={previewPhoto}
                    alt="미리보기"
                    style={{
                      width: '100%',
                      maxHeight: '220px',
                      objectFit: 'cover',
                      borderRadius: '20px',
                      margin: '8px 0',
                    }}
                  />
                )}

                <button className="bt" style={{ marginTop: '14px' }} onClick={handleSaveDirect}>
                  저장하기
                </button>
              </div>
            ) : imp === 'photo' ? (
              /* Photo Register Entry */
             <div>
    {/* 상단 뒤로가기 버튼 */}
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        className="ic"
        style={{ background: 'var(--cd)' }}
        onClick={() => setImp('')}
        title="뒤로가기"
      >
        <BackIcon />
      </button>
    </div>
                <h2>사진으로 등록</h2>
                <div className="row">
                  <label className="bt o" htmlFor="p_fc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <CameraIcon /> 사진 찍기</label>
                  <label className="bt o" htmlFor="p_fg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <GalleryIcon /> 갤러리 선택</label>
                </div>
                <input id="p_fc" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
                <input id="p_fg" type="file" accept="image/*" hidden onChange={handlePhotoUpload} />

                {previewPhoto ? (
                  <>
                    <img
                      src={previewPhoto}
                      alt="선택한 레시피 사진"
                      style={{ width: '100%', maxHeight: '260px', borderRadius: '16px', margin: '8px 0', objectFit: 'cover' }}
                    />
                    <button className="bt o" type="button" style={{ marginTop: '10px' }} onClick={handleRecognizePhoto} disabled={ocrLoading}>
                      {ocrLoading ? 'AI가 사진 내용을 정리하는 중…' : '✨ AI로 사진 레시피 정리'}
                    </button>
                    <p className="s" style={{ marginTop: '6px' }}>AI가 정리한 내용을 아래에 채웠어요. 저장 전에 확인하고 수정해 주세요.</p>
                    {photoAiError && <p role={'alert'} className={'s'} style={{ color: '#c62828', overflowWrap: 'anywhere' }}>AI 오류: {photoAiError}</p>}
                    <label className="fl" htmlFor="photo-title">요리명</label>
                    <input id="photo-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="예: 된장찌개" />

                    <label className="fl" htmlFor="photo-ingredients">재료 및 분량</label>
                    <textarea id="photo-ingredients" value={draftIngredients} onChange={(e) => setDraftIngredients(e.target.value)} placeholder="한 줄에 하나씩 적어 주세요." />

                    <label className="fl" htmlFor="photo-seasonings">양념 및 분량</label>
                    <textarea id="photo-seasonings" value={draftSeasonings} onChange={(e) => setDraftSeasonings(e.target.value)} placeholder="한 줄에 하나씩 적어 주세요." />

                    <label className="fl" htmlFor="photo-steps">만드는 순서</label>
                    <textarea id="photo-steps" value={draftSteps} onChange={(e) => setDraftSteps(e.target.value)} placeholder="한 줄에 한 단계씩 적어 주세요." />

                    <label className="fl" htmlFor="photo-tip">요리 팁 (선택)</label>
                    <textarea id="photo-tip" value={draftTip} onChange={(e) => setDraftTip(e.target.value)} placeholder="사진에 적힌 팁이나 나만의 팁을 적어 주세요." />

                    <button className="bt" style={{ marginTop: '14px' }} onClick={handleSaveDirect}>사진과 함께 레시피 등록</button>
                  </>
                ) : (
                  <p className="s" style={{ marginTop: '28px' }}>사진을 고른 뒤 AI 정리 버튼을 누르면 레시피 항목으로 정리돼요.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : tab === 'ai' ? (
          /* =========================================================
              SCREEN 7: AI CHEF CONSULTATION
             ========================================================= */
          <div>
    {/* 상단 뒤로가기 버튼 */}
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        className="ic"
        style={{ background: 'var(--cd)' }}
        onClick={() => setImp('')}
        title="뒤로가기"
      >
        <BackIcon />
      </button>
    </div>
            <h2>AI 셰프</h2>
            <select
              value={curChefRecipeId}
              onChange={(e) => setCurChefRecipeId(Number(e.target.value) || '')}
            >
              <option value="">현재 레시피 없음 (일반 질문)</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <div style={{ margin: '12px 0' }}>
              {[
                '고기가 질긴데 어떻게 해야 할까?',
                '간장을 너무 많이 넣었어',
                '설탕 대신 올리고당 써도 될까?',
                '4인분을 2인분으로 줄여줘',
              ].map((t) => (
                <button
                  key={t}
                  className="ch"
                  onClick={() => handleAskChef(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ minHeight: '120px' }}>
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`bb ${m.role}`}>
                  {m.content}
                </div>
              ))}
              {chefLoading && (
                <div className="bb assistant">
                  생각 중… 🍳
                </div>
              )}
            </div>

            <div className="row" style={{ marginTop: '14px' }}>
              <input
                id="qi"
                value={chefInput}
                onChange={(e) => setChefInput(e.target.value)}
                placeholder="질문을 입력하세요"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAskChef();
                }}
              />
              <button
                className="bt"
                style={{ width: '90px', flex: 'none' }}
                onClick={() => handleAskChef()}
                disabled={chefLoading}
              >
                전송
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Floating Bottom Navigation */}
      {!editingRecipe && (
        <nav>
          {[
            ['home', './nav-icons/home.png', '홈'],
            ['imp', './nav-icons/add-recipe.png', '레시피 추가'],
            ['my', './nav-icons/notes.png', '요리 노트'],
          ].map(([k, icon, title]) => (
            <button
              key={k}
              className={tab === k ? 'on' : ''}
              aria-label={title}
              title={title}
             onClick={() => {
              setViewRecipeId(null);
              setTab(k as any);
              setImp('');
              setSearchQuery(''); // 다른 탭 클릭 시 검색어 초기화
            }}
            >
              <img className="nav-icon" src={icon} alt="" aria-hidden="true" />
              {title}
            </button>
          ))}
        </nav>
      )}

      {/* Export Modal */}
      {exportOpen && (
        <div
          className="mdl-bg"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExportOpen(false);
          }}
        >
          <div className="mdl">
            <div className="mdl-h">
              <b> 레시피 내보내기</b>
              <button className="mdl-close" onClick={() => setExportOpen(false)}>
                ✕
              </button>
            </div>
            <p className="s exp-subtitle">
              내보낼 레시피를 고른 뒤, 공유 창에서 Samsung Notes를 선택해 저장하세요.
            </p>

            <div className="exp-selectbar">
              <button
                className="exp-selectall"
                onClick={toggleAllExport}
              >
                {recipes.length > 0 && recipes.every((r) => exportSelected[r.id])
                  ? '전체 해제'
                  : '전체 선택'}
              </button>
              <span className="exp-count">{recipes.filter((r) => exportSelected[r.id]).length}개 선택</span>
            </div>

            <div className="exp-list">
              {recipes.map((r) => (
                <label key={r.id} className="exp-item">
                  <input
                    className="exp-check"
                    type="checkbox"
                    checked={!!exportSelected[r.id]}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setExportSelected((prev) => ({ ...prev, [r.id]: checked }));
                    }}
                  />
                  <span className="exp-name">{r.name}</span>
                  <span className="exp-category">{r.cat}</span>
                </label>
              ))}
            </div>

            <div className="exp-actions">
              <button
                className="exp-action exp-copy"
                onClick={copyRecipes}
              >
                 복사하기
              </button>
              <button
                className="exp-action exp-share"
                onClick={shareToMemo}
              >
                 삼성노트로 공유
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastText && <div className="toast">{toastText}</div>}
    </div>
  );
}


