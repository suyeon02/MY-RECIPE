import React, { useState } from 'react';
import { Clock, Heart, Youtube, Flame } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { extractYoutubeId } from '../utils/youtubeParser';

interface RecipeCardProps {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
  onToggleFav: (recipeId: number, e: React.MouseEvent) => void;
  variant?: 'grid' | 'list';
}

const CAT_EMOJIS: Record<string, string> = {
  '밑반찬': '🥗',
  '국·찌개': '🍲',
  '메인 요리': '🍖',
  '면·분식': '🍜',
  '밥·죽': '🍚',
  '간식·디저트': '🍰',
  '기타': '🍽️',
};

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onSelect,
  onToggleFav,
  variant = 'grid',
}) => {
  const [imgError, setImgError] = useState(false);
  const ytId = extractYoutubeId(recipe.url);
  const thumbnail = !imgError && (recipe.img || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null));
  const emoji = CAT_EMOJIS[recipe.cat] || '🍽️';

  if (variant === 'list') {
    return (
      <div
        onClick={() => onSelect(recipe)}
        className="group bg-white rounded-2xl p-3 shadow-xs hover:shadow-md border border-amber-100/80 flex items-center gap-3.5 cursor-pointer transition-all active:scale-[0.99]"
      >
        <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={recipe.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-3xl drop-shadow-xs">{emoji}</span>
          )}
          {recipe.min > 0 && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-semibold flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {recipe.min}분
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium mb-1">
            <span className="px-2 py-0.5 rounded-md bg-amber-100/70 font-semibold">{recipe.cat}</span>
            {ytId && (
              <span className="flex items-center gap-0.5 text-red-600 font-bold">
                <Youtube className="w-3 h-3 fill-current" />
                <span>유튜브</span>
              </span>
            )}
            {recipe.channel && <span className="text-stone-400 truncate">· {recipe.channel}</span>}
          </div>

          <h3 className="font-bold text-stone-900 text-sm leading-snug truncate group-hover:text-orange-600 transition-colors">
            {recipe.name}
          </h3>

          <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
            {recipe.summary || recipe.ing.split('\n').slice(0, 2).join(', ')}
          </p>
        </div>

        <button
          onClick={(e) => onToggleFav(recipe.id, e)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
            recipe.fav
              ? 'text-red-500 bg-red-50 hover:bg-red-100'
              : 'text-stone-300 hover:text-stone-500 bg-stone-50'
          }`}
          aria-label={recipe.fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          <Heart className={`w-4 h-4 ${recipe.fav ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(recipe)}
      className="group bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md border border-amber-100/80 flex flex-col cursor-pointer transition-all active:scale-[0.98]"
    >
      <div className="relative aspect-[16/10] overflow-hidden flex items-center justify-center bg-gradient-to-br from-amber-100/90 via-orange-100/80 to-amber-200/70">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={recipe.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
            <span className="text-4xl drop-shadow-xs">{emoji}</span>
          </div>
        )}

        {/* Category Pill */}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur shadow-xs text-stone-800 text-[10px] font-bold">
          {recipe.cat}
        </span>

        {/* Favorite Heart */}
        <button
          onClick={(e) => onToggleFav(recipe.id, e)}
          className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center shadow-xs backdrop-blur transition-all active:scale-90 ${
            recipe.fav
              ? 'bg-white text-red-500'
              : 'bg-white/80 text-stone-600 hover:text-stone-900'
          }`}
          aria-label={recipe.fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          <Heart className={`w-3.5 h-3.5 ${recipe.fav ? 'fill-current' : ''}`} />
        </button>

        {/* Time & Badges */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-semibold">
          {recipe.min > 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {recipe.min}분
            </span>
          ) : <span />}

          {ytId && (
            <span className="px-1.5 py-0.5 rounded-md bg-red-600/90 text-white flex items-center gap-0.5 font-bold">
              <Youtube className="w-2.5 h-2.5 fill-current" />
              요약
            </span>
          )}
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          {recipe.channel && (
            <p className="text-[10px] font-medium text-amber-700/80 mb-0.5 truncate">
              {recipe.channel}
            </p>
          )}
          <h3 className="font-bold text-stone-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
            {recipe.name}
          </h3>
        </div>

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.slice(0, 2).map((tag, idx) => (
              <span
                key={idx}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
