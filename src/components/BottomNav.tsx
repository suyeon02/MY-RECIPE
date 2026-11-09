import React from 'react';
import { Home, BookOpen, PlusCircle, Bot } from 'lucide-react';

export type NavTab = 'home' | 'my' | 'import' | 'ai';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'home' as NavTab, label: '홈', icon: Home },
    { id: 'my' as NavTab, label: '요리 노트', icon: BookOpen },
    { id: 'import' as NavTab, label: '레시피 추가', icon: PlusCircle, highlight: true },
    { id: 'ai' as NavTab, label: 'AI 셰프', icon: Bot },
  ];

  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-xl shadow-amber-950/10 border border-amber-100 p-1.5 z-40 flex items-center justify-around">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        if (tab.highlight) {
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="relative -top-2 flex flex-col items-center group transition-transform active:scale-95"
              aria-label={tab.label}
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:from-amber-600 group-hover:to-orange-600">
                <Icon className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-orange-600 mt-0.5">{tab.label}</span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl transition-all ${
              isActive
                ? 'text-orange-600 font-bold bg-orange-50/70'
                : 'text-stone-500 hover:text-stone-800 font-medium'
            }`}
            aria-label={tab.label}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
