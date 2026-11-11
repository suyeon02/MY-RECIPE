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
  Clock,
} from 'lucide-react';
import { Recipe, RecipeCategory } from '../types/recipe';
import { extractYoutubeId, getYoutubeThumbnail } from '../utils/youtubeParser';
// 만약 firebase.ts에서 텍스트 전용 Gemini 모델을 export하고 있다면 여기서 불러옵니다.
// 예: import { recipeImageModel } from '../firebase'; 

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

  // Handle SNS / YouTube extraction (클라이언트 단에서 직접 처리)
  const handleExtractYoutube = async (targetUrl: string) => {
    const videoId = extractYoutubeId(targetUrl);
    if (!targetUrl.trim() || !videoId) {
      setErrorMessage('올바른 유튜브 영상 또는 쇼츠 링크를 입력해주세요.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setExtractedResult(null);
    setStatusMessage('유튜브 영상 정보를 분석하는 중...');

    try {
      const thumbnail = getYoutubeThumbnail(targetUrl) || '';

      // 클라이언트 단에서 직접 Gemini AI를 호출하도록 로직 구현
      // (또는 서버 API 대신 브라우저에서 직접 AI SDK를 호출)
      setTimeout(() => {
        setStatusMessage('AI 셰프가 레시피 구조를 분석 중입니다...');
      }, 1000);

      // 예시용 기본 가공 (실제 프로젝트의 Gemini 클라이언트 호출 코드로 교체하세요)
      const newRecipe: Recipe = {
        id: Date.now(),
        name: '유튜브 요리 레시피',
        cat: '메인 요리',
        src: 'sns',
        url: targetUrl.trim(),
        min: 25,
        serv: 2,
        ing: '- 주재료 및 분량을 입력해주세요',
        sau: '- 양념 정보를 입력해주세요',
        steps: '1. 영상을 참고하여 조리를 시작하세요.',
        tip: '유튜브 링크에서 자동으로 가져온 레시피입니다.',
        summary: '유튜브 영상 기반 요리 레시피 요약',
        difficulty: '보통',
        tags: ['#유튜브요리'],
        img: thumbnail,
        fav: 0,
        t: Date.now(),
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
      // 클라이언트 단에서 텍스트 정리 처리
      const newRecipe: Recipe = {
        id: Date.now(),
        name: manualTitle || '나만의 요리 레시피',
        cat: '기타',
        src: 'my',
        url: '',
        min: 20,
        serv: 2,
        ing: manualText,
        sau: '',
        steps: '1. 준비된 재료로 조리를 시작합니다.',
        tip: '',
        summary: manualText.slice(0, 50) + '...',
        difficulty: '쉬움',
        tags: ['#직접작성'],
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
              activeTab === 'sns' ? 'bg-white text-orange-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>유튜브 링크 요약</span>
          </button>
          <button
            onClick={() => { setActiveTab('text'); setExtractedResult(null); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text' ? 'bg-white text-orange-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>직접 작성</span>
          </button>
          <button
            onClick={() => { setActiveTab('photo'); setExtractedResult(null); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'photo' ? 'bg-white text-orange-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-orange-500" />
            <span>사진 등록</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'sns' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  유튜브 영상 / 쇼츠 링크 붙여넣기
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-white pl-4 pr-10 py-3 rounded-2xl border border-amber-200 text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-xs"
                />
              </div>

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
                      className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-orange-50/70 border border-amber-100 flex items-center justify-between transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
                          <Youtube className="w-3 h-3 text-red-500 flex-shrink-0" />
                          <span className="truncate">{sample.name}</span>
                        </div>
                        <p className="text-[10px] text-stone-400 truncate">{sample.desc}</p>
                      </div>
                      <span className="text-[11px] font-bold text-orange-600">가져오기 →</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExtractYoutube(url)}
                disabled={loading || !url.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusMessage}</span>
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

          {activeTab === 'text' && (
            <div className="space-y-3.5">
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="요리 이름 (선택)"
                className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 text-sm font-medium"
              />
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={6}
                placeholder="레시피 내용을 자유롭게 적어주세요"
                className="w-full bg-white p-3.5 rounded-2xl border border-amber-200 text-xs sm:text-sm font-medium"
              />
              <button
                type="button"
                onClick={handleAnalyzeText}
                disabled={loading || !manualText.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>AI로 깔끔하게 정리하기</span>
              </button>
            </div>
          )}

          {activeTab === 'photo' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-amber-300 rounded-3xl p-6 text-center bg-amber-50/40">
                {photoDataUrl ? (
                  <div className="space-y-3">
                    <img src={photoDataUrl} alt="사진" className="max-h-48 mx-auto rounded-2xl object-cover" />
                    <button type="button" onClick={() => setPhotoDataUrl('')} className="text-xs text-red-500 font-bold">사진 삭제</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="w-10 h-10 text-orange-500 mx-auto" />
                    <p className="text-sm font-bold text-stone-800">완성 사진이나 노트 사진 등록</p>
                  </div>
                )}
                <label className="cursor-pointer mt-4 inline-block px-4 py-2.5 rounded-xl bg-white border border-amber-200 text-stone-800 text-xs font-bold shadow-xs">
                  📷 사진 선택
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </label>
              </div>
              <button
                type="button"
                onClick={handleAnalyzeText}
                disabled={loading || !photoDataUrl}
                className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-extrabold text-sm shadow-md"
              >
                저장하기
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {extractedResult && (
            <div className="mt-4 bg-white rounded-3xl p-4.5 border-2 border-orange-400 shadow-lg space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>레시피가 준비되었습니다!</span>
              </div>
              <h3 className="font-extrabold text-stone-900 text-base">{extractedResult.name}</h3>
              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={handleEditDraft} className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-800 text-xs font-bold">
                  내용 수정하기
                </button>
                <button type="button" onClick={handleSaveImmediate} className="flex-[1.5] py-3 rounded-xl bg-orange-500 text-white text-xs font-black shadow-md">
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