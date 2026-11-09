import React, { useState, useEffect } from 'react';

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
const EMJ = ['🥗', '🍲', '🍖', '🍜', '🍚', '🍰', '🍽️'];
const SL: Record<string, string> = { sns: 'SNS', my: '직접 작성', photo: '사진', ai: 'AI' };
const TS = /^(\d+):(\d\d)\s*/;

const SEED_RECIPES: Recipe[] = [
  {
    id: 1,
    name: '제육볶음',
    cat: '메인 요리',
    src: 'sns',
    url: 'https://www.youtube.com/watch?v=rb7ff_r6G6g',
    min: 25,
    serv: 2,
    ing: '돼지고기 앞다리살 600g\n양파 1개\n대파 1대',
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

const SAMPLE_VIDEOS = [
  { name: '🔥 백종원 제육볶음', url: 'https://www.youtube.com/watch?v=rb7ff_r6G6g' },
  { name: '🍝 성시경 브리치즈 파스타', url: 'https://www.youtube.com/watch?v=F0K0-9H88vM' },
  { name: '🍲 뚝딱이형 김치찌개', url: 'https://www.youtube.com/watch?v=hG9w-rNvdjE' },
];

const LOCAL_STORAGE_KEY = 'my_recipes_proto';

// Helper functions matching original prototype
const L = (s: string) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

const sc = (s: string, f: number) => {
  if (f === 1) return s;
  return s.replace(/([0-9]+(?:[.][0-9]+)?)(?:[/]([0-9]+))?/g, (_m, a, b) => {
    const n = (+a / (b ? +b : 1)) * f;
    return n >= 10 ? String(Math.round(n)) : String(+n.toFixed(n >= 1 ? 1 : 2));
  });
};

const extractYtId = (u: string) => {
  const m = (u || '').match(/(?:youtu\.be\/|v\/|watch\?v=|shorts\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : '';
};

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
  const [draftText, setDraftText] = useState('');
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
      if (target) {
        setServings(Number(target.serv) || 2);
      }
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
    if (!/youtu|instagr/i.test(targetUrl)) {
      setSnsMessage('유튜브나 인스타그램 링크를 올바르게 입력해 주세요.');
      return;
    }

    setSnsLoading(true);
    setSnsMessage('유튜브 영상과 더보기란을 분석하여 레시피를 추출하는 중입니다... 🍳');

    try {
      const response = await fetch('/api/extract-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!response.ok) {
        throw new Error('레시피 추출에 실패했습니다.');
      }

      const data = await response.json();
      const extracted = data.recipe || {};
      const videoId = data.videoId || extractYtId(targetUrl);
      const thumbnail = data.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');

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
    if (!draftText.trim()) {
      showToast('레시피 내용을 입력해 주세요.');
      return;
    }
    const lines = draftText.trim().split('\n').filter(Boolean);
    const newRecipe: Recipe = {
      id: Date.now(),
      name: draftTitle.trim() || lines[0].slice(0, 20) || '나만의 요리 노트',
      cat: '기타',
      min: 20,
      serv: 2,
      ing: draftText,
      sau: '',
      steps: draftText,
      tip: '',
      url: '',
      src: 'my',
      img: previewPhoto || '',
      t: Date.now(),
      fav: 0,
    };
    setRecipes((prev) => [newRecipe, ...prev]);
    setDraftTitle('');
    setDraftText('');
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
      const res = await fetch('/api/ai/chef-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          currentRecipe,
          messages: newMessages,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || '맛있게 조리해보세요!' },
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
          `====================\n요리명: ${r.name}\n카테고리: ${r.cat}\n조리시간: ${r.min || '-'}분\n기준인분: ${r.serv || 2}인분\n원문링크: ${r.url || '-'}\n\n[재료]\n${r.ing}\n\n[양념]\n${r.sau || '-'}\n\n[조리순서]\n${r.steps}\n\n[나만의 팁]\n${r.tip || '-'}\n====================`
      )
      .join('\n\n');
  };

  const copyRecipes = () => {
    const text = getSelectedRecipesText();
    if (!text) return;
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
    if (!text) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: '내 레시피 모음', text });
        setExportOpen(false);
      } catch (e: any) {
        if (e.name !== 'AbortError') copyRecipes();
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
    const photoUrl = r.img || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '');

    if (photoUrl) {
      return (
        <div className={className}>
          <img
            src={photoUrl}
            alt={r.name}
            className="pi"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
              const parent = (e.target as HTMLElement).parentElement;
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
              📥
            </span>
            <span
              className="ic-btn"
              onClick={() => showToast('새 알림이 없어요')}
              title="알림"
            >
              🔔
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
          <div>
            <div className="top" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <button className="bk" onClick={() => setEditingRecipe(null)}>
                ← 취소
              </button>
              <b>{editingRecipe.id ? '레시피 수정' : '레시피 정리'}</b>
            </div>

            <form
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
                <label className="bt o" htmlFor="ec">
                  📷 사진 찍기
                </label>
                <label className="bt o" htmlFor="eg">
                  🖼️ 갤러리 선택
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
          <div>
            <div className="top" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <button className="circ" onClick={() => setViewRecipeId(null)}>
                ←
              </button>
              <button
                className="circ"
                style={{ color: 'var(--or)' }}
                onClick={(e) => toggleFav(currentViewingRecipe.id, e)}
              >
                {currentViewingRecipe.fav ? '♥' : '♡'}
              </button>
            </div>

            {/* Hero Image Box - Fills entire container with cover */}
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
                        currentViewingRecipe.img ||
                        `https://i.ytimg.com/vi/${extractYtId(currentViewingRecipe.url)}/hqdefault.jpg`
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
                        (e.target as HTMLElement).style.display = 'none';
                        const parent = (e.target as HTMLElement).parentElement;
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

              {/* Action buttons on hero */}
              <span className="acts">
                <button
                  className="ic"
                  onClick={() => setEditingRecipe({ ...currentViewingRecipe })}
                  title="레시피 수정"
                >
                  ✏️
                </button>
                <button
                  className={`ic ${deleteConfirmId === currentViewingRecipe.id ? 'rd' : ''}`}
                  onClick={() => handleDelete(currentViewingRecipe.id)}
                  title="레시피 삭제"
                >
                  {deleteConfirmId === currentViewingRecipe.id ? '삭제 확인' : '🗑️'}
                </button>
              </span>
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

            <h2 style={{ margin: '16px 0 4px' }}>{currentViewingRecipe.name}</h2>
            <p className="s" style={{ margin: '0 0 16px' }}>
              {currentViewingRecipe.cat} · {SL[currentViewingRecipe.src] || '레시피'}
              {currentViewingRecipe.min ? ` · ${currentViewingRecipe.min}분` : ''}
              {currentViewingRecipe.difficulty ? ` · 난이도 ${currentViewingRecipe.difficulty}` : ''}
            </p>

            {/* Ingredients & Servings Stepper */}
            <div className="sec">
              <h3 style={{ color: 'var(--or)', margin: 0 }}>재료</h3>
              <div className="stepper">
                <button onClick={() => setServings((s) => Math.max(1, s - 1))}>−</button>
                <b id="sgn">{servings}인분</b>
                <button onClick={() => setServings((s) => Math.min(20, s + 1))}>+</button>
              </div>
            </div>

            <p id="sgf" className="s" style={{ margin: '4px 0 8px' }}>
              기준 {currentViewingRecipe.serv || 2}인분
              {servings !== (currentViewingRecipe.serv || 2) && (
                <> → 분량 ×{+(servings / (currentViewingRecipe.serv || 2)).toFixed(2)}</>
              )}
            </p>

            {/* Ingredients List with scaled amounts */}
            {L(currentViewingRecipe.ing).map((line, idx) => {
              const match = line.match(/^(.+?)\s+([0-9][0-9/.~-]*[^0-9\s]*)$/);
              const factor = servings / (currentViewingRecipe.serv || 2);
              const namePart = match ? match[1] : line;
              const amountPart = match ? sc(match[2], factor) : '';
              return (
                <div key={idx} className="ing">
                  <span>{namePart}</span>
                  {amountPart && <b>{amountPart}</b>}
                </div>
              );
            })}

            {/* Seasonings List */}
            {currentViewingRecipe.sau && (
              <>
                <h3 style={{ marginTop: '16px' }}>양념</h3>
                {L(currentViewingRecipe.sau).map((line, idx) => {
                  const match = line.match(/^(.+?)\s+([0-9][0-9/.~-]*[^0-9\s]*)$/);
                  const factor = servings / (currentViewingRecipe.serv || 2);
                  const namePart = match ? match[1] : line;
                  const amountPart = match ? sc(match[2], factor) : '';
                  return (
                    <div key={idx} className="ing">
                      <span>{namePart}</span>
                      {amountPart && <b>{amountPart}</b>}
                    </div>
                  );
                })}
              </>
            )}

            {/* Steps */}
            <h3 style={{ marginTop: '20px' }}>조리 순서</h3>
            {currentViewingRecipe.url &&
              L(currentViewingRecipe.steps).some((x) => TS.test(x)) && (
                <p className="s" style={{ margin: '-4px 0 8px' }}>
                  시간이 표시된 단계를 누르면 영상이 그 구간으로 이동해요
                </p>
              )}

            {L(currentViewingRecipe.steps).map((step, idx) => {
              const timeMatch = step.match(TS);
              const timeStr = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '';
              const cleanStep = step.replace(TS, '');

              return (
                <div
                  key={idx}
                  className="stp"
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
                  <b className="n">{idx + 1}</b>
                  <div>
                    {timeStr && <span className="tm">▶ {timeStr}</span>}
                    <span>{cleanStep}</span>
                  </div>
                </div>
              );
            })}

            {/* Tips */}
            {currentViewingRecipe.tip && (
              <>
                <h3 style={{ marginTop: '16px' }}>나만의 팁</h3>
                <div className="cd" style={{ fontSize: '15px', lineHeight: 1.6 }}>
                  {currentViewingRecipe.tip}
                </div>
              </>
            )}
          </div>
        ) : tab === 'home' ? (
          /* =========================================================
              SCREEN 4: HOME TAB
             ========================================================= */
          <div>
            <p className="hi">좋은 하루예요 👋</p>
            <div className="hd">
              오늘은 어떤 <em>요리</em>를<br />
              해볼까요? 🍳
            </div>

            {/* Search Input */}
            <div className="sb">
              <i>🔍</i>
              <input
                placeholder="요리명 또는 재료 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Big SNS Import CTA Button */}
            <button
              className="bt"
              style={{ margin: '14px 0' }}
              onClick={() => {
                setTab('imp');
                setImp('sns');
              }}
            >
              🔗 SNS 레시피 가져오기
            </button>

            {/* Categories */}
            <h3>카테고리</h3>
            <div className="cats">
              <button
                className="ct"
                onClick={() => {
                  setSelectedCat('');
                  setTab('my');
                }}
              >
                <span>📖</span>
                전체
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
                  <span>{EMJ[i]}</span>
                  {c}
                </button>
              ))}
            </div>

            {/* Recent Recipes */}
            <h3>최근 저장 레시피</h3>
            <div className="hs">
              {recentRecipes.length > 0 ? (
                recentRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="pc"
                    onClick={() => setViewRecipeId(r.id)}
                  >
                    <div className="ph">
                      {renderThumbnail(r)}
                      {r.min && <span className="pill">{r.min}분</span>}
                      <span
                        className="hr"
                        onClick={(e) => toggleFav(r.id, e)}
                      >
                        {r.fav ? '♥' : '♡'}
                      </span>
                    </div>
                    <div className="nm">{r.name}</div>
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
                      {renderThumbnail(r)}
                      {r.min && <span className="pill">{r.min}분</span>}
                      <span
                        className="hr"
                        onClick={(e) => toggleFav(r.id, e)}
                      >
                        {r.fav ? '♥' : '♡'}
                      </span>
                    </div>
                    <div className="nm">{r.name}</div>
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
            <h2>요리 노트</h2>
            <input
              placeholder="요리명 또는 재료 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Category Chips */}
            <div style={{ margin: '12px 0 6px' }}>
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

            {/* Filter Chips */}
            <div style={{ marginBottom: '12px' }}>
              <button
                className={`ch ${selectedFilter === '즐겨찾기' ? 'on' : ''}`}
                onClick={() =>
                  setSelectedFilter((curr) => (curr === '즐겨찾기' ? '' : '즐겨찾기'))
                }
              >
                ♥ 즐겨찾기만
              </button>
            </div>

            {/* Recipe List Cards */}
            <div>
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
                        {r.cat}
                        {r.min ? ` · ${r.min}분` : ''} · {SL[r.src] || ''}
                      </div>
                    </div>
                    <span
                      className="hr"
                      onClick={(e) => toggleFav(r.id, e)}
                    >
                      {r.fav ? '♥' : '♡'}
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
                <div className="cd mc" onClick={() => setImp('sns')}>
                  <span className="mi">🔗</span>
                  <div>
                    <b>SNS 링크로 가져오기</b>
                    <div className="s">유튜브 · 쇼츠 링크를 넣으면 AI가 레시피를 완벽 요약</div>
                  </div>
                </div>

                <div className="cd mc" onClick={() => setImp('photo')}>
                  <span className="mi">📷</span>
                  <div>
                    <b>사진으로 등록</b>
                    <div className="s">갤러리 · 카메라 · 손글씨 노트</div>
                  </div>
                </div>

                <div className="cd mc" onClick={() => setImp('my')}>
                  <span className="mi">✏️</span>
                  <div>
                    <b>직접 작성</b>
                    <div className="s">이름과 재료를 자유롭게 쓰면 깔끔하게 정리</div>
                  </div>
                </div>
              </div>
            ) : imp === 'sns' ? (
              /* CORE CHANGED COMPONENT: SNS RECIPE EXTRACTOR */
              <div>
                <button className="bk" onClick={() => setImp('')}>
                  ← 뒤로
                </button>
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

                <p className="s" style={{ margin: '8px 0 14px', lineHeight: 1.5 }}>
                  유튜브 영상의 <b>더보기란 설명과 영상 정보</b>를 AI가 정밀 분석해 재료, 양념 비율, 조리 순서(타임스탬프), 꿀팁까지 자동으로 요약 정리해 드립니다.
                </p>

                {/* Quick 1-Click Sample Link Chips for immediate testing */}
                <div style={{ marginBottom: '14px' }}>
                  <p className="s" style={{ fontWeight: 700, marginBottom: '6px' }}>
                    💡 빠른 테스트 링크 (터치하면 즉시 입력):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {SAMPLE_VIDEOS.map((vid) => (
                      <button
                        key={vid.name}
                        type="button"
                        className="sample-chip"
                        onClick={() => {
                          setSnsUrl(vid.url);
                          handleExtractSns(vid.url);
                        }}
                      >
                        {vid.name}
                      </button>
                    ))}
                  </div>
                </div>

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
                <button className="bk" onClick={() => setImp('')}>
                  ← 뒤로
                </button>
                <h2>직접 작성</h2>

                <input
                  id="d"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="레시피 이름 (예: 우리집 김치찌개)"
                />

                <textarea
                  id="tx"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="재료, 양념, 만드는 순서, 나만의 팁을 편하게 적어 주세요. 형식은 자유예요."
                />

                <label className="fl">대표 사진 (선택)</label>
                <div className="row">
                  <label className="bt o" htmlFor="my_fc">
                    📷 사진 찍기
                  </label>
                  <label className="bt o" htmlFor="my_fg">
                    🖼️ 갤러리 선택
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
                <button className="bk" onClick={() => setImp('')}>
                  ← 뒤로
                </button>
                <h2>사진으로 등록</h2>

                <div className="row">
                  <label className="bt o" htmlFor="p_fc">
                    📷 사진 찍기
                  </label>
                  <label className="bt o" htmlFor="p_fg">
                    🖼️ 갤러리 선택
                  </label>
                </div>
                <input id="p_fc" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
                <input id="p_fg" type="file" accept="image/*" hidden onChange={handlePhotoUpload} />

                {previewPhoto ? (
                  <img
                    src={previewPhoto}
                    alt="선택한 사진"
                    style={{
                      width: '100%',
                      maxHeight: '260px',
                      borderRadius: '16px',
                      margin: '8px 0',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}

                <p className="s">
                  {previewPhoto
                    ? '✅ 사진을 선택했어요. 아래 버튼을 눌러 레시피를 작성하세요.'
                    : '레시피 사진이나 요리책, 손글씨 노트를 촬영하거나 갤러리에서 골라 주세요.'}
                </p>

                <button
                  className="bt"
                  style={{ marginTop: '12px' }}
                  onClick={() => {
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
                      url: '',
                      src: 'photo',
                      img: previewPhoto,
                    });
                    setImp('');
                  }}
                >
                  상세 내용 작성하기
                </button>
              </div>
            ) : null}
          </div>
        ) : tab === 'ai' ? (
          /* =========================================================
              SCREEN 7: AI CHEF CONSULTATION
             ========================================================= */
          <div>
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
      {!editingRecipe && !viewRecipeId && (
        <nav>
          {[
            ['home', '🏠', '홈'],
            ['my', '📖', '요리 노트'],
            ['imp', '➕', '레시피 추가'],
          ].map(([k, icon, title]) => (
            <button
              key={k}
              className={tab === k ? 'on' : ''}
              onClick={() => {
                setTab(k as any);
                setImp('');
              }}
            >
              <b>{icon}</b>
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
              <b>📥 레시피 내보내기</b>
              <button className="mdl-close" onClick={() => setExportOpen(false)}>
                ✕
              </button>
            </div>
            <p className="s" style={{ margin: '0 0 10px' }}>
              저장할 레시피를 선택해 원하는 메모장에 공유하거나 복사하세요.
            </p>

            <div className="row" style={{ margin: '0 0 10px' }}>
              <button
                className="bt o"
                style={{ padding: '8px', fontSize: '14px', flex: 1, minHeight: '40px' }}
                onClick={toggleAllExport}
              >
                {recipes.length > 0 && recipes.every((r) => exportSelected[r.id])
                  ? '☑️ 전체 해제'
                  : '☑️ 전체 선택 / 해제'}
              </button>
            </div>

            <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '14px' }}>
              {recipes.map((r) => (
                <label key={r.id} className="ci" style={{ fontSize: '16px' }}>
                  <input
                    type="checkbox"
                    checked={!!exportSelected[r.id]}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setExportSelected((prev) => ({ ...prev, [r.id]: checked }));
                    }}
                  />
                  <span>
                    {r.name} ({r.cat})
                  </span>
                </label>
              ))}
            </div>

            <div className="row" style={{ margin: 0 }}>
              <button
                className="bt o"
                style={{ flex: 1, padding: '12px', fontSize: '15px', minHeight: '48px' }}
                onClick={copyRecipes}
              >
                📋 복사하기
              </button>
              <button
                className="bt"
                style={{ flex: 1, padding: '12px', fontSize: '15px', minHeight: '48px' }}
                onClick={shareToMemo}
              >
                📱 메모장으로 저장
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
