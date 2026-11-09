import React from 'react';
import { Download, Sparkles, ChefHat } from 'lucide-react';

interface HeaderProps {
  onOpenExport: () => void;
  onOpenImport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenExport, onOpenImport }) => {
  return (
    <header className="sticky top-0 z-30 bg-[#fcfbf9]/90 backdrop-blur-md border-b border-amber-100/60 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shadow-orange-500/20">
          <ChefHat className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-amber-950 flex items-center gap-1.5 leading-none">
            MY RECIPE
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">AI</span>
          </h1>
          <p className="text-[11px] text-amber-700/80 font-medium leading-tight mt-0.5">SNS & 유튜브 요약 정리기</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenImport}
          className="px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-semibold shadow-sm flex items-center gap-1 transition-all"
          title="SNS 링크로 추가"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>링크 요약</span>
        </button>
        <button
          onClick={onOpenExport}
          className="w-8 h-8 rounded-full bg-white hover:bg-orange-50 active:scale-95 border border-amber-200 text-amber-800 flex items-center justify-center transition-all shadow-sm"
          title="레시피 내보내기"
          aria-label="레시피 내보내기"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
