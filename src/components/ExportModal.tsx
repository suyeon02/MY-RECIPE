import React, { useState } from 'react';
import { X, Copy, Share2, Check, Download, CheckSquare, Square } from 'lucide-react';
import { Recipe } from '../types/recipe';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  onToast: (msg: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  recipes,
  onToast,
}) => {
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    recipes.forEach((r) => {
      init[r.id] = true;
    });
    return init;
  });

  if (!isOpen) return null;

  const allSelected = recipes.length > 0 && recipes.every((r) => selectedIds[r.id]);

  const handleToggleAll = () => {
    const nextVal = !allSelected;
    const updated: Record<number, boolean> = {};
    recipes.forEach((r) => {
      updated[r.id] = nextVal;
    });
    setSelectedIds(updated);
  };

  const handleToggleOne = (id: number) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getExportText = () => {
    const selected = recipes.filter((r) => selectedIds[r.id]);
    if (selected.length === 0) return null;

    return selected
      .map(
        (r) => `====================
🍳 요리명: ${r.name}
카테고리: ${r.cat} | 조리시간: ${r.min || '-'}분 | 기준인분: ${r.serv || 2}인분
${r.url ? `원문 링크: ${r.url}\n` : ''}
[재료]
${r.ing}

${r.sau ? `[양념]\n${r.sau}\n` : ''}
[조리 순서]
${r.steps}

${r.tip ? `[나만의 꿀팁]\n${r.tip}` : ''}
====================`
      )
      .join('\n\n');
  };

  const handleCopy = () => {
    const text = getExportText();
    if (!text) {
      onToast('선택된 레시피가 없습니다.');
      return;
    }
    navigator.clipboard.writeText(text);
    onToast('클립보드에 복사되었습니다! 메모장에 붙여넣으세요.');
    onClose();
  };

  const handleShare = async () => {
    const text = getExportText();
    if (!text) {
      onToast('선택된 레시피가 없습니다.');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MY RECIPE 요리 모음',
          text,
        });
        onToast('공유되었습니다.');
        onClose();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-5 border border-amber-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-orange-500" />
            <h3 className="font-extrabold text-stone-900 text-base">레시피 내보내기</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-500 mt-2 mb-3">
          메모장이나 카카오톡으로 보관할 레시피를 선택해주세요.
        </p>

        {/* Toggle all button */}
        <div className="flex items-center justify-between pb-2">
          <button
            onClick={handleToggleAll}
            className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700"
          >
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            <span>{allSelected ? '전체 해제' : '전체 선택'}</span>
          </button>
          <span className="text-[11px] text-stone-400">
            총 {recipes.filter((r) => selectedIds[r.id]).length}개 선택됨
          </span>
        </div>

        {/* Recipe Checkbox List */}
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 my-2 pr-1">
          {recipes.map((r) => {
            const isChecked = !!selectedIds[r.id];
            return (
              <label
                key={r.id}
                className="py-2.5 flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-stone-300 group-hover:border-orange-400'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs font-bold text-stone-800 truncate">
                    {r.name}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-stone-400 flex-shrink-0">
                  {r.cat}
                </span>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleOne(r.id)}
                  className="hidden"
                />
              </label>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-amber-100 flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>클립보드 복사</span>
          </button>

          <button
            onClick={handleShare}
            className="flex-[1.2] py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>메모장 / 공유</span>
          </button>
        </div>
      </div>
    </div>
  );
};
