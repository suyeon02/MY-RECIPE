import React, { useState } from 'react';
import {
  ArrowLeft,
  Heart,
  Edit3,
  Trash2,
  Clock,
  Users,
  Flame,
  ChefHat,
  Play,
  ExternalLink,
  Share2,
  Check,
  Copy,
  Sparkles,
} from 'lucide-react';
import { Recipe } from '../types/recipe';
import { extractYoutubeId, parseCookingStep } from '../utils/youtubeParser';
import { parseIngredientLine } from '../utils/recipeScaler';

interface RecipeDetailViewProps {
  recipe: Recipe;
  onBack: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: number) => void;
  onToggleFav: (recipeId: number, e: React.MouseEvent) => void;
  onStartCooking: (recipe: Recipe, servings: number) => void;
  onAskChef: (recipe: Recipe) => void;
  onToast: (msg: string) => void;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe,
  onBack,
  onEdit,
  onDelete,
  onToggleFav,
  onStartCooking,
  onAskChef,
  onToast,
}) => {
  const [servings, setServings] = useState<number>(recipe.serv || 2);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const ytId = extractYoutubeId(recipe.url);
  const baseServings = recipe.serv || 2;
  const factor = servings / baseServings;

  // Handle ingredient check toggle
  const toggleCheck = (key: string) => {
    setCheckedIngredients((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Split lines
  const ingredientLines = recipe.ing.split('\n').filter((l) => l.trim().length > 0);
  const sauceLines = recipe.sau ? recipe.sau.split('\n').filter((l) => l.trim().length > 0) : [];
  const stepLines = recipe.steps.split('\n').filter((l) => l.trim().length > 0);

  // Jump to YouTube timestamp
  const handleJumpTimestamp = (seconds: number) => {
    const iframe = document.getElementById('yt-player-iframe') as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
        '*'
      );
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onToast(`영상 ${Math.floor(seconds / 60)}분 ${seconds % 60}초 구간으로 이동했습니다.`);
    } else if (recipe.url) {
      const targetUrl = `${recipe.url}${recipe.url.includes('?') ? '&' : '?'}t=${seconds}s`;
      window.open(targetUrl, '_blank');
    }
  };

  // Copy recipe to clipboard
  const handleCopyRecipe = () => {
    const text = `[MY RECIPE] ${recipe.name}
카테고리: ${recipe.cat} | 조리시간: ${recipe.min}분 | 기준: ${servings}인분
${recipe.url ? `원문 링크: ${recipe.url}\n` : ''}
[필수 재료]
${ingredientLines.map((line) => {
  const p = parseIngredientLine(line, factor);
  return p.amount ? `- ${p.name}: ${p.scaledAmount}` : `- ${p.name}`;
}).join('\n')}

${sauceLines.length > 0 ? `[양념]\n${sauceLines.map((line) => {
  const p = parseIngredientLine(line, factor);
  return p.amount ? `- ${p.name}: ${p.scaledAmount}` : `- ${p.name}`;
}).join('\n')}\n` : ''}
[조리 순서]
${stepLines.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

${recipe.tip ? `[셰프 꿀팁]\n${recipe.tip}` : ''}`;

    navigator.clipboard.writeText(text);
    onToast('레시피 내용이 클립보드에 복사되었습니다.');
  };

  return (
    <div className="pb-32 space-y-5">
      {/* Top Bar Navigation */}
      <div className="sticky top-0 z-20 bg-[#fcfbf9]/95 backdrop-blur-md -mx-4 px-4 py-2.5 flex items-center justify-between border-b border-amber-100">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white border border-amber-200 text-stone-700 flex items-center justify-center active:scale-95 shadow-sm"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyRecipe}
            className="w-9 h-9 rounded-full bg-white border border-amber-200 text-stone-700 flex items-center justify-center active:scale-95 shadow-sm"
            title="레시피 복사"
            aria-label="레시피 복사"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(recipe)}
            className="w-9 h-9 rounded-full bg-white border border-amber-200 text-stone-700 flex items-center justify-center active:scale-95 shadow-sm"
            title="레시피 수정"
            aria-label="레시피 수정"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => onToggleFav(recipe.id, e)}
            className={`w-9 h-9 rounded-full bg-white border border-amber-200 flex items-center justify-center active:scale-95 shadow-sm ${
              recipe.fav ? 'text-red-500' : 'text-stone-400'
            }`}
            aria-label={recipe.fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <Heart className={`w-4 h-4 ${recipe.fav ? 'fill-current' : ''}`} />
          </button>
          {showConfirmDelete ? (
            <button
              onClick={() => onDelete(recipe.id)}
              className="px-2.5 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-sm active:scale-95"
            >
              삭제 확인
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="w-9 h-9 rounded-full bg-white border border-amber-200 text-stone-400 hover:text-red-600 flex items-center justify-center active:scale-95 shadow-sm"
              title="레시피 삭제"
              aria-label="레시피 삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Video or Image Banner */}
      <div className="rounded-3xl overflow-hidden bg-stone-900 shadow-md relative aspect-video">
        {ytId ? (
          <iframe
            id="yt-player-iframe"
            src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1&playsinline=1&rel=0`}
            title={recipe.name}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : recipe.img ? (
          <img src={recipe.img} alt={recipe.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-orange-600">
            <span className="text-6xl mb-2">🍳</span>
            <span className="text-xs font-bold text-stone-600">등록된 영상이 없습니다</span>
          </div>
        )}
      </div>

      {/* Title & Meta */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 mb-1">
          <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
            {recipe.cat}
          </span>
          {recipe.difficulty && (
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700">
              난이도: {recipe.difficulty}
            </span>
          )}
          {recipe.calories && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800">
              {recipe.calories}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-black text-stone-900 leading-tight">
          {recipe.name}
        </h1>

        {recipe.channel && (
          <p className="text-xs text-stone-500 font-medium mt-1 flex items-center gap-1">
            <span>출처:</span>
            <span className="font-bold text-stone-700">{recipe.channel}</span>
            {recipe.url && (
              <a
                href={recipe.url}
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 underline text-[11px] ml-1 flex items-center gap-0.5"
              >
                <span>영상 열기</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </p>
        )}

        {recipe.summary && (
          <p className="text-xs text-stone-600 bg-amber-50/80 rounded-2xl p-3 mt-3 border border-amber-200/60 leading-relaxed font-medium">
            💬 {recipe.summary}
          </p>
        )}
      </div>

      {/* Servings Stepper & Info Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-amber-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
            <Clock className="w-4 h-4 text-orange-500" />
            <span>조리 {recipe.min || 20}분</span>
          </div>
          <div className="h-3 w-px bg-stone-200" />
          <div className="text-[11px] text-stone-500 font-medium">
            기준 {baseServings}인분 {factor !== 1 ? `(×${factor.toFixed(1)})` : ''}
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 bg-amber-50/80 p-1 rounded-xl border border-amber-200/70">
          <button
            onClick={() => setServings((prev) => Math.max(1, prev - 1))}
            className="w-7 h-7 rounded-lg bg-white border border-amber-200 text-stone-800 font-bold flex items-center justify-center active:scale-90 text-sm shadow-xs"
            aria-label="인분 줄이기"
          >
            −
          </button>
          <span className="min-w-12 text-center text-xs font-black text-amber-950">
            {servings}인분
          </span>
          <button
            onClick={() => setServings((prev) => Math.min(20, prev + 1))}
            className="w-7 h-7 rounded-lg bg-orange-500 text-white font-bold flex items-center justify-center active:scale-90 text-sm shadow-xs"
            aria-label="인분 늘리기"
          >
            +
          </button>
        </div>
      </div>

      {/* Ingredients Section */}
      <div className="bg-white rounded-3xl p-4.5 border border-amber-100/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>필수 재료</span>
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              {ingredientLines.length}가지
            </span>
          </h3>
          <span className="text-[11px] text-stone-400">체크하여 준비 완료 표시</span>
        </div>

        <div className="divide-y divide-stone-100">
          {ingredientLines.map((line, idx) => {
            const parsed = parseIngredientLine(line, factor);
            const isChecked = !!checkedIngredients[`ing-${idx}`];

            return (
              <label
                key={idx}
                className={`py-2.5 flex items-center justify-between cursor-pointer group transition-colors ${
                  isChecked ? 'opacity-40 line-through' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-stone-300 group-hover:border-orange-400'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-sm font-semibold text-stone-800">{parsed.name}</span>
                </div>
                {parsed.amount && (
                  <span className="text-sm font-bold text-orange-700 bg-orange-50/80 px-2.5 py-0.5 rounded-md">
                    {parsed.scaledAmount}
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheck(`ing-${idx}`)}
                  className="hidden"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Seasonings Section */}
      {sauceLines.length > 0 && (
        <div className="bg-white rounded-3xl p-4.5 border border-amber-100/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>양념 & 소스</span>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {sauceLines.length}가지
              </span>
            </h3>
          </div>

          <div className="divide-y divide-stone-100">
            {sauceLines.map((line, idx) => {
              const parsed = parseIngredientLine(line, factor);
              const isChecked = !!checkedIngredients[`sau-${idx}`];

              return (
                <label
                  key={idx}
                  className={`py-2.5 flex items-center justify-between cursor-pointer group transition-colors ${
                    isChecked ? 'opacity-40 line-through' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-stone-300 group-hover:border-amber-400'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className="text-sm font-semibold text-stone-800">{parsed.name}</span>
                  </div>
                  {parsed.amount && (
                    <span className="text-sm font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md">
                      {parsed.scaledAmount}
                    </span>
                  )}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(`sau-${idx}`)}
                    className="hidden"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Cooking Steps Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
            <span>조리 순서</span>
            <span className="text-xs text-stone-500 font-semibold">({stepLines.length}단계)</span>
          </h3>
          {ytId && (
            <span className="text-[11px] text-orange-600 font-semibold flex items-center gap-1">
              <Play className="w-3 h-3 fill-current" />
              시간 클릭 시 해당 구간 재생
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {stepLines.map((stepRaw, idx) => {
            const parsed = parseCookingStep(stepRaw, idx);

            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm flex items-start gap-3.5 hover:border-orange-300 transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-orange-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0 shadow-xs">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {parsed.timeStr && (
                      <button
                        onClick={() => parsed.seconds !== null && handleJumpTimestamp(parsed.seconds)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors"
                        title="해당 시간으로 영상 재생"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{parsed.timeStr}</span>
                      </button>
                    )}

                    {parsed.timerMinutes && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">
                        <Clock className="w-2.5 h-2.5" />
                        약 {parsed.timerMinutes}분
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-stone-800 font-medium leading-relaxed">
                    {parsed.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chef Tips Section */}
      {recipe.tip && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-4.5 border border-amber-200/80 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm mb-2">
            <ChefHat className="w-5 h-5 text-orange-600" />
            <span>셰프의 황금 꿀팁</span>
          </div>
          <p className="text-xs sm:text-sm text-amber-950/90 leading-relaxed font-medium">
            {recipe.tip}
          </p>
        </div>
      )}

      {/* Action Footer: Cook Mode & Ask AI Chef */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-amber-100 flex items-center gap-2.5 max-w-md mx-auto z-30 shadow-lg">
        <button
          onClick={() => onAskChef(recipe)}
          className="flex-1 py-3 px-3 rounded-2xl bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all"
        >
          <Sparkles className="w-4 h-4 text-orange-600" />
          <span>AI 셰프 질문</span>
        </button>

        <button
          onClick={() => onStartCooking(recipe, servings)}
          className="flex-[2] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-extrabold text-sm shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all"
        >
          <Flame className="w-4 h-4 stroke-[2.5]" />
          <span>요리 시작 모드</span>
        </button>
      </div>
    </div>
  );
};
