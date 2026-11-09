import React, { useState } from 'react';
import { ArrowLeft, Save, Youtube, Clock, Users, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Recipe, RecipeCategory } from '../types/recipe';

interface RecipeEditorProps {
  recipe: Partial<Recipe>;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

const CATEGORIES: RecipeCategory[] = [
  '밑반찬',
  '국·찌개',
  '메인 요리',
  '면·분식',
  '밥·죽',
  '간식·디저트',
  '기타',
];

export const RecipeEditor: React.FC<RecipeEditorProps> = ({
  recipe,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(recipe.name || '');
  const [cat, setCat] = useState<RecipeCategory>(recipe.cat || '메인 요리');
  const [min, setMin] = useState<number>(recipe.min || 20);
  const [serv, setServ] = useState<number>(recipe.serv || 2);
  const [ing, setIng] = useState(recipe.ing || '');
  const [sau, setSau] = useState(recipe.sau || '');
  const [steps, setSteps] = useState(recipe.steps || '');
  const [tip, setTip] = useState(recipe.tip || '');
  const [url, setUrl] = useState(recipe.url || '');
  const [img, setImg] = useState(recipe.img || '');
  const [difficulty, setDifficulty] = useState<'쉬움' | '보통' | '어려움'>(recipe.difficulty || '보통');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('요리명을 입력해주세요.');

    const finalRecipe: Recipe = {
      id: recipe.id || Date.now(),
      name: name.trim(),
      cat,
      src: recipe.src || (url ? 'sns' : 'my'),
      url: url.trim(),
      min: Number(min) || 20,
      serv: Number(serv) || 2,
      ing: ing.trim(),
      sau: sau.trim(),
      steps: steps.trim(),
      tip: tip.trim(),
      summary: recipe.summary || '',
      difficulty,
      calories: recipe.calories,
      tags: recipe.tags || ['#레시피'],
      img: img || recipe.img || '',
      fav: recipe.fav || 0,
      t: recipe.t || Date.now(),
      channel: recipe.channel,
    };

    onSave(finalRecipe);
  };

  return (
    <div className="pb-32 space-y-4">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-[#fcfbf9]/95 backdrop-blur-md -mx-4 px-4 py-2.5 flex items-center justify-between border-b border-amber-100">
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-full bg-white border border-amber-200 text-stone-700 flex items-center justify-center active:scale-95 shadow-sm"
          aria-label="취소"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-stone-900 text-base">
          {recipe.id ? '레시피 수정' : '새 레시피 작성'}
        </h2>
        <button
          onClick={handleSubmit}
          className="px-3.5 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span>저장</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs space-y-1">
          <label className="text-xs font-bold text-stone-700 block">
            요리명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 백종원의 초간단 제육볶음"
            className="w-full text-base font-bold text-stone-900 bg-amber-50/50 px-3.5 py-2.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Category & Cooking time & Servings */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              카테고리
            </label>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as RecipeCategory)}
              className="w-full bg-amber-50/50 px-3 py-2 rounded-xl border border-amber-200 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              난이도
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full bg-amber-50/50 px-3 py-2 rounded-xl border border-amber-200 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="쉬움">쉬움</option>
              <option value="보통">보통</option>
              <option value="어려움">어려움</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              조리 시간 (분)
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min={1}
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                className="w-full bg-amber-50/50 pl-9 pr-3 py-2 rounded-xl border border-amber-200 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              기준 인분수
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min={1}
                value={serv}
                onChange={(e) => setServ(Number(e.target.value))}
                className="w-full bg-amber-50/50 pl-9 pr-3 py-2 rounded-xl border border-amber-200 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs space-y-1">
          <label className="text-xs font-bold text-stone-700 block">
            필수 재료 (한 줄에 재료명과 분량 입력)
          </label>
          <p className="text-[11px] text-stone-400 mb-1">예: 돼지고기 앞다리살 600g (인분수 변경 시 자동 계산됩니다)</p>
          <textarea
            rows={5}
            value={ing}
            onChange={(e) => setIng(e.target.value)}
            placeholder="돼지고기 600g&#10;양파 1개&#10;대파 1대"
            className="w-full bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400 leading-relaxed font-mono"
          />
        </div>

        {/* Seasonings */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs space-y-1">
          <label className="text-xs font-bold text-stone-700 block">
            양념 및 소스 (한 줄에 하나씩)
          </label>
          <textarea
            rows={4}
            value={sau}
            onChange={(e) => setSau(e.target.value)}
            placeholder="고추장 2큰술&#10;진간장 2큰술&#10;설탕 1큰술&#10;다진 마늘 1큰술"
            className="w-full bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400 leading-relaxed font-mono"
          />
        </div>

        {/* Cooking Steps */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs space-y-1">
          <label className="text-xs font-bold text-stone-700 block">
            조리 순서 (한 줄에 한 단계)
          </label>
          <p className="text-[11px] text-stone-400 mb-1">
            앞에 02:15 처럼 영상 시간(mm:ss)을 적으면 단계 클릭 시 영상이 자동 이동합니다.
          </p>
          <textarea
            rows={6}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="00:30 양파와 대파를 먹기 좋게 썬다&#10;01:45 팬에 고기를 넣고 센 불에 볶는다&#10;03:20 양념을 넣고 3분간 졸인다"
            className="w-full bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400 leading-relaxed font-mono"
          />
        </div>

        {/* Secret Tip */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs space-y-1">
          <label className="text-xs font-bold text-stone-700 block flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>나만의 요리 꿀팁</span>
          </label>
          <textarea
            rows={3}
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            placeholder="센 불에서 빠르게 볶아야 채소에서 물이 나오지 않고 아삭합니다."
            className="w-full bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400 leading-relaxed"
          />
        </div>

        {/* Video Link */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs space-y-1">
          <label className="text-xs font-bold text-stone-700 block flex items-center gap-1">
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>원본 영상 링크</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full bg-amber-50/50 px-3.5 py-2.5 rounded-xl border border-amber-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-black text-sm shadow-md shadow-orange-500/25 transition-all"
          >
            레시피 저장하기
          </button>
        </div>
      </form>
    </div>
  );
};
