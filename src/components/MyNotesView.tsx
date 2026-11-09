import React, { useState } from 'react';
import { Search, Filter, Youtube, Heart, Clock } from 'lucide-react';
import { Recipe, RecipeCategory } from '../types/recipe';
import { RecipeCard } from './RecipeCard';

interface MyNotesViewProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleFav: (recipeId: number, e: React.MouseEvent) => void;
  selectedCategory: RecipeCategory | '';
  onSelectCategory: (cat: RecipeCategory | '') => void;
}

const CATEGORIES: (RecipeCategory | '')[] = [
  '',
  '밑반찬',
  '국·찌개',
  '메인 요리',
  '면·분식',
  '밥·죽',
  '간식·디저트',
  '기타',
];

export const MyNotesView: React.FC<MyNotesViewProps> = ({
  recipes,
  onSelectRecipe,
  onToggleFav,
  selectedCategory,
  onSelectCategory,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'fav' | 'youtube' | 'recentCooked'>('all');

  const filtered = recipes.filter((r) => {
    if (selectedCategory && r.cat !== selectedCategory) return false;
    if (filterType === 'fav' && !r.fav) return false;
    if (filterType === 'youtube' && !r.url.includes('youtu')) return false;
    if (filterType === 'recentCooked' && !r.cooked) return false;

    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.ing.toLowerCase().includes(q) ||
      r.sau.toLowerCase().includes(q) ||
      (r.tags && r.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="space-y-4 pb-28">
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-stone-900 leading-tight">
          내 요리 보관함 📖
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          유튜브에서 정리한 요리와 직접 적은 레시피를 모아뒀어요
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="요리명, 재료, 태그로 검색..."
          className="w-full bg-white pl-10 pr-4 py-3 rounded-2xl border border-amber-200/80 text-sm font-medium text-stone-800 placeholder:text-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 bg-stone-100 rounded-full w-5 h-5 flex items-center justify-center"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c || 'all'}
            onClick={() => onSelectCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === c
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-amber-100/80'
            }`}
          >
            {c || '전체 요리'}
          </button>
        ))}
      </div>

      {/* Filter Badges */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setFilterType('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            filterType === 'all'
              ? 'bg-stone-800 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          최신 저장순
        </button>
        <button
          onClick={() => setFilterType(filterType === 'fav' ? 'all' : 'fav')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
            filterType === 'fav'
              ? 'bg-red-500 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Heart className="w-3 h-3 fill-current" />
          <span>즐겨찾기</span>
        </button>
        <button
          onClick={() => setFilterType(filterType === 'youtube' ? 'all' : 'youtube')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
            filterType === 'youtube'
              ? 'bg-red-600 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Youtube className="w-3 h-3 fill-current" />
          <span>유튜브 요약</span>
        </button>
      </div>

      {/* List Count and items */}
      <div className="pt-1">
        <p className="text-xs text-stone-500 font-semibold mb-2.5">
          총 <strong className="text-orange-600 font-bold">{filtered.length}</strong>개의 레시피
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-amber-200 p-6">
            <p className="text-3xl mb-2">📖</p>
            <p className="font-bold text-stone-800 text-sm">저장된 레시피가 없어요</p>
            <p className="text-xs text-stone-500 mt-1">상단의 검색어를 지우거나 새 레시피를 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
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
