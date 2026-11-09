import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Youtube,
  Link as LinkIcon,
  FileText,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Clock,
  Play,
} from 'lucide-react';
import { Recipe, RecipeCategory } from '../types/recipe';
import { extractYoutubeId } from '../utils/youtubeParser';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecipe: (recipe: Recipe) => void;
  onOpenEditorWithDraft: (draft: Partial<Recipe>) => void;
  onToast: (msg: string) => void;
  initialUrl?: string;
}

type TabType = 'sns' | 'text' | 'photo';

const SAMPLE_LINKS = [
  {
    name: '백종원 제육볶음',
    desc: '불향 가득 백종원 만능 레시피',
    url: 'https://www.youtube.com/watch?v=kYJpA7b5bW4',
  },
  {
    name: '뚝딱이형 김치찌개',
    desc: '묵은지와 돼지고기의 깊은 국물',
    url: 'https://www.youtube.com/watch?v=0k571R12X3Y',
  },
  {
    name: '성시경 브리치즈 파스타',
    desc: '원팬으로 불 없이 만드는 파스타',
    url: 'https://www.youtube.com/watch?v=L9vB249qZ2A',
  },
];

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSaveRecipe,
  onOpenEditorWithDraft,
  onToast,
  initialUrl = '',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('sns');
  const [url, setUrl] = useState(initialUrl);
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [extractedResult, setExtractedResult] = useState<Recipe | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Handle SNS / YouTube extraction
  const handleExtractYoutube = async (targetUrl: string) => {
    if (!targetUrl.trim()) {
      setErrorMessage('유튜브 영상 또는 쇼츠 링크를 입력해주세요.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setExtractedResult(null);
    setStatusMessage('유튜브 영상 정보와 더보기란을 가져오는 중...');

    try {
      // Step 1: Request backend to fetch and summarize with Gemini
      const timerMsg = setTimeout(() => {
        setStatusMessage('AI 셰프가 재료, 양념, 조리순서와 타임스탬프를 요약 분석 중...');
      }, 1200);

      const res = await fetch('/api/extract-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });

      clearTimeout(timerMsg);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '레시피를 추출하지 못했습니다.');
      }

      const data = await res.json();
      const rData = data.recipe;

      const newRecipe: Recipe = {
        id: Date.now(),
        name: rData.name || '유튜브 요리 레시피',
        cat: (rData.cat as RecipeCategory) || '메인 요리',
        src: 'sns',
        url: targetUrl.trim(),
        min: Number(rData.min) || 20,
        serv: Number(rData.serv) || 2,
        ing: rData.ing || '',
        sau: rData.sau || '',
        steps: rData.steps || '',
        tip: rData.tip || '',
        summary: rData.summary || '',
        difficulty: rData.difficulty || '보통',
        calories: rData.calories || '',
        tags: rData.tags || ['#유튜브요리'],
        img: data.thumbnail || '',
        fav: 0,
        t: Date.now(),
        channel: data.recipe.channel || '',
      };

      setExtractedResult(newRecipe);
      setStatusMessage('레시피 추출 완료!');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '영상을 분석하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Freeform Text parsing
  const handleAnalyzeText = async () => {
    if (!manualText.trim()) {
      setErrorMessage('레시피 내용을 작성해주세요.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setExtractedResult(null);
    setStatusMessage('AI가 재료와 조리 순서를 정리하는 중...');

    try {
      const res = await fetch('/api/analyze-recipe-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: manualTitle, text: manualText }),
      });

      if (!res.ok) {
        throw new Error('정리에 실패했습니다.');
      }

      const data = await res.json();
      const rData = data.recipe;

      const newRecipe: Recipe = {
        id: Date.now(),
        name: rData.name || manualTitle || '나만의 요리 레시피',
        cat: (rData.cat as RecipeCategory) || '기타',
        src: 'my',
        url: '',
        min: Number(rData.min) || 20,
        serv: Number(rData.serv) || 2,
        ing: rData.ing || '',
        sau: rData.sau || '',
        steps: rData.steps || '',
        tip: rData.tip || '',
        summary: rData.summary || '',
        difficulty: rData.difficulty || '쉬움',
        tags: rData.tags || ['#직접작성'],
        img: photoDataUrl || '',
        fav: 0,
        t: Date.now(),
      };

      setExtractedResult(newRecipe);
    } catch (err: any) {
      setErrorMessage(err.message || '작성 내용을 정리하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
      onToast('사진이 등록되었습니다. 레시피 내용과 함께 저장해보세요.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveImmediate = () => {
    if (extractedResult) {
      onSaveRecipe(extractedResult);
      onToast(`'${extractedResult.name}' 레시피가 요리 노트에 저장되었습니다!`);
      onClose();
    }
  };

  const handleEditDraft = () => {
    if (extractedResult) {
      onOpenEditorWithDraft(extractedResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#fcfbf9] w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden border border-amber-100">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-amber-100/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900 leading-tight">
                레시피 추가 & SNS 요약
              </h2>
              <p className="text-[11px] text-stone-500">영상 링크를 넣으면 AI가 깔끔하게 정리해요</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-amber-100 bg-amber-50/50 p-1.5 gap-1.5">
          <button
            onClick={() => { setActiveTab('sns'); setExtractedResult(null); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'sns'
                ? 'bg-white text-orange-600 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>유튜브 링크 요약</span>
          </button>

          <button
            onClick={() => { setActiveTab('text'); setExtractedResult(null); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text'
                ? 'bg-white text-orange-600 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>직접 작성</span>
          </button>

          <button
            onClick={() => { setActiveTab('photo'); setExtractedResult(null); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'photo'
                ? 'bg-white text-orange-600 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-orange-500" />
            <span>사진 등록</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* SNS TAB */}
          {activeTab === 'sns' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  유튜브 영상 / 쇼츠 링크 붙여넣기
                </label>
                <div className="relative flex items-center">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-white pl-4 pr-10 py-3 rounded-2xl border border-amber-200 text-sm font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-xs"
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={() => setUrl('')}
                      className="absolute right-3 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Sample link chips */}
              <div>
                <p className="text-[11px] font-bold text-stone-500 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> 바로 체험해볼 수 있는 인기 레시피
                </p>
                <div className="space-y-1.5">
                  {SAMPLE_LINKS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setUrl(sample.url);
                        handleExtractYoutube(sample.url);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-orange-50/70 border border-amber-100 flex items-center justify-between transition-colors group active:scale-[0.99]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-stone-800 group-hover:text-orange-600 flex items-center gap-1">
                          <Youtube className="w-3 h-3 text-red-500 flex-shrink-0" />
                          <span className="truncate">{sample.name}</span>
                        </div>
                        <p className="text-[10px] text-stone-400 truncate">{sample.desc}</p>
                      </div>
                      <span className="text-[11px] font-bold text-orange-600 flex-shrink-0">
                        가져오기 →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExtractYoutube(url)}
                disabled={loading || !url.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 disabled:opacity-40 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusMessage || 'AI 분석 요약 중...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>유튜브 레시피 AI 요약하기</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TEXT TAB */}
          {activeTab === 'text' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  요리 이름 (선택)
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="예: 엄마표 소고기 미역국"
                  className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  레시피 내용 (재료, 순서 등을 자유롭게 적어주세요)
                </label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={6}
                  placeholder={`소고기 양지 200g, 불린 미역 2줌, 참기름 2큰술, 국간장 2큰술, 다진마늘 1큰술
1. 냄비에 참기름 두르고 소고기와 미역을 볶는다.
2. 물 1리터 붓고 20분간 푹 끓인다.
3. 국간장과 다진마늘로 간을 맞춘다.`}
                  className="w-full bg-white p-3.5 rounded-2xl border border-amber-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <button
                type="button"
                onClick={handleAnalyzeText}
                disabled={loading || !manualText.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 disabled:opacity-40 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI가 레시피로 정리 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>AI로 깔끔하게 정리하기</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* PHOTO TAB */}
          {activeTab === 'photo' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-amber-300 rounded-3xl p-6 text-center bg-amber-50/40">
                {photoDataUrl ? (
                  <div className="space-y-3">
                    <img
                      src={photoDataUrl}
                      alt="선택된 사진"
                      className="max-h-48 mx-auto rounded-2xl object-cover shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoDataUrl('')}
                      className="text-xs text-red-500 font-bold"
                    >
                      사진 삭제
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="w-10 h-10 text-orange-500 mx-auto" />
                    <p className="text-sm font-bold text-stone-800">
                      요리 완성 사진이나 손글씨 노트 사진 등록
                    </p>
                    <p className="text-xs text-stone-500">
                      사진을 등록하고 아래에서 내용을 적어 정리할 수 있어요.
                    </p>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-center gap-3">
                  <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-white border border-amber-200 text-stone-800 text-xs font-bold shadow-xs hover:bg-orange-50">
                    📷 사진 선택
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  요리 이름
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="요리명 (예: 홈메이드 수제 버거)"
                  className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  간단 메모
                </label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={3}
                  placeholder="재료와 조리 방법을 간단히 적어보세요"
                  className="w-full bg-white p-3 rounded-xl border border-amber-200 text-xs font-medium"
                />
              </div>

              <button
                type="button"
                onClick={handleAnalyzeText}
                disabled={loading || (!photoDataUrl && !manualText.trim())}
                className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-extrabold text-sm shadow-md disabled:opacity-40"
              >
                저장하기
              </button>
            </div>
          )}

          {/* Error Message display */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Extracted Preview Card */}
          {extractedResult && (
            <div className="mt-4 bg-white rounded-3xl p-4.5 border-2 border-orange-400 shadow-lg space-y-3 animate-fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>AI가 성공적으로 레시피를 요약 정리했습니다!</span>
              </div>

              <div className="flex gap-3 items-center">
                {extractedResult.img ? (
                  <img
                    src={extractedResult.img}
                    alt={extractedResult.name}
                    className="w-20 h-20 rounded-2xl object-cover bg-amber-50 flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-amber-100 text-3xl flex items-center justify-center flex-shrink-0">
                    🍳
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    {extractedResult.cat}
                  </span>
                  <h3 className="font-extrabold text-stone-900 text-base truncate mt-0.5">
                    {extractedResult.name}
                  </h3>
                  <p className="text-xs text-stone-500 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {extractedResult.min}분
                    </span>
                    <span>· {extractedResult.serv}인분 기준</span>
                  </p>
                </div>
              </div>

              {/* Summary or preview snippet */}
              {extractedResult.summary && (
                <p className="text-xs text-stone-600 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/50">
                  {extractedResult.summary}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-stone-50 p-2 rounded-xl">
                  <p className="font-bold text-stone-700 mb-0.5">주재료</p>
                  <p className="text-stone-500 truncate">{extractedResult.ing.split('\n').slice(0, 2).join(', ')}...</p>
                </div>
                <div className="bg-stone-50 p-2 rounded-xl">
                  <p className="font-bold text-stone-700 mb-0.5">양념</p>
                  <p className="text-stone-500 truncate">{extractedResult.sau.split('\n').slice(0, 2).join(', ') || '별도 양념 없음'}...</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleEditDraft}
                  className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors"
                >
                  내용 수정하기
                </button>
                <button
                  type="button"
                  onClick={handleSaveImmediate}
                  className="flex-[1.5] py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black shadow-md transition-colors"
                >
                  내 레시피로 저장하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
