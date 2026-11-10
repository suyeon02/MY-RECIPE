import React, { useState } from 'react';
import { Search, Sparkles, Youtube, ArrowRight, Play, Flame } from 'lucide-react';
import { Recipe, RecipeCategory } from '../types/recipe';
import { RecipeCard } from './RecipeCard';

interface HomeViewProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleFav: (recipeId: number, e: React.MouseEvent) => void;
  onQuickImportUrl: (url: string) => void;
  onOpenImport: () => void;
  onFilterByCategory: (category: RecipeCategory | '') => void;
}

const CATEGORIES: { name: RecipeCategory; emoji: string }[] = [
  { name: '밑반찬', emoji: '🥗' },
  { name: '국·찌개', emoji: '🍲' },
  { name: '메인 요리', emoji: '🍖' },
  { name: '면·분식', emoji: '🍜' },
  { name: '밥·죽', emoji: '🍙' },
  { name: '간식·디저트', emoji: '🍰' },
  { name: '기타', emoji: '🍽️' },
];

const SAMPLE_LINKS = [
  { title: '백종원 제육볶음', url: 'https://www.youtube.com/watch?v=kYJpA7b5bW4', tag: '인기 레시피' },
  { title: '뚝딱이형 김치찌개', url: 'https://www.youtube.com/watch?v=0k571R12X3Y', tag: '국물 요리' },
  { title: '성시경 브리치즈 파스타', url: 'https://www.youtube.com/watch?v=L9vB249qZ2A', tag: '간단 양식' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  recipes,
  onSelectRecipe,
  onToggleFav,
  onQuickImportUrl,
  onOpenImport,
  onFilterByCategory,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    onQuickImportUrl(inputUrl.trim());
    setInputUrl('');
  };

  const filteredRecipes = recipes.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.ing.toLowerCase().includes(q) ||
      r.sau.toLowerCase().includes(q) ||
      (r.tags && r.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  const favorites = recipes.filter((r) => r.fav);
  const youtubeRecipes = recipes.filter((r) => r.src === 'sns' || r.url.includes('youtu'));

  return (
    <div className="space-y-6 pb-28">
      {/* Hero Welcome & Quick Link Import Bar */}
      <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-amber-600 rounded-3xl p-5 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 text-orange-100 text-xs font-semibold mb-1">
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>AI 기반 실시간 레시피 추출</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight leading-snug">
            유튜브 요리 영상 링크로<br />
            깔끔한 레시피 정리 🍳
          </h2>
          <p className="text-xs text-orange-100 mt-1.5 leading-relaxed">
            영상 더보기란의 재료와 양념, 조리 순서를 타임스탬프와 함께 자동 요약합니다.
          </p>

          {/* Quick Input Bar */}
          <form onSubmit={handleQuickSubmit} className="mt-4">
            <div className="relative flex items-center">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="유튜브 영상 또는 쇼츠 링크 붙여넣기"
                className="w-full bg-white text-stone-900 placeholder:text-stone-400 pl-4 pr-24 py-3 rounded-2xl text-xs sm:text-sm font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-bold shadow-sm hover:opacity-95 active:scale-95 flex items-center gap-1 transition-all"
              >
                <span>요약하기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* 1-Click Sample Chips */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-orange-200 flex items-center gap-1">
              <Youtube className="w-3 h-3" /> 추천 영상:
            </span>
            {SAMPLE_LINKS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onQuickImportUrl(sample.url)}
                className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white text-[11px] font-medium backdrop-blur transition-all flex items-center gap-1"
              >
                <span>{sample.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="요리명 또는 재료 검색 (예: 삼겹살, 된장찌개)"
          className="w-full bg-white pl-10 pr-4 py-3 rounded-2xl border border-amber-200/80 text-sm font-medium text-stone-800 placeholder:text-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 bg-stone-100 rounded-full w-5 h-5 flex items-center justify-center"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Icons Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1">
            <span>카테고리</span>
          </h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onFilterByCategory(cat.name)}
              className="ct"
            >
              <span className="cat-icon">
                {cat.emoji}
              </span>
              <span className="cat-label">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* YouTube Summarized Recipe Highlights */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-bold text-stone-900 text-base flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>유튜브 영상 요약 레시피</span>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {youtubeRecipes.length}개
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {youtubeRecipes.slice(0, 4).map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onSelect={onSelectRecipe}
              onToggleFav={onToggleFav}
            />
          ))}
        </div>
      </div>

      {/* Favorites Section if any */}
      {favorites.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-1.5">
              <span>❤️ 내가 찜한 레시피</span>
              <span className="text-xs font-semibold text-stone-500">({favorites.length})</span>
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {favorites.map((recipe) => (
              <div key={recipe.id} className="w-44 flex-shrink-0">
                <RecipeCard
                  recipe={recipe}
                  onSelect={onSelectRecipe}
                  onToggleFav={onToggleFav}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All / Filtered Recipe List */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-bold text-stone-900 text-base">
            {searchQuery ? `'${searchQuery}' 검색 결과` : '전체 레시피'}
            <span className="text-xs font-semibold text-stone-500 ml-1.5">
              ({filteredRecipes.length})
            </span>
          </h3>
          <button
            onClick={onOpenImport}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
          >
            <span>+ 새 레시피</span>
          </button>
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-amber-200 p-6">
            <p className="text-3xl mb-2">🍳</p>
            <p className="font-bold text-stone-800 text-sm">해당하는 레시피를 찾을 수 없어요</p>
            <p className="text-xs text-stone-500 mt-1">유튜브 링크를 붙여넣어 새 레시피를 추가해보세요!</p>
            <button
              onClick={onOpenImport}
              className="mt-4 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold shadow-sm"
            >
              🔗 SNS 링크 가져오기
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                variant="list"
                onSelect={onSelectRecipe}
                onToggleFav={onToggleFav}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

