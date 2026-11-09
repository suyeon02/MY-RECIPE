import React, { useState, useRef, useEffect } from 'react';
import { ChefHat, Send, Sparkles, MessageSquare, Flame, Lightbulb, RefreshCw } from 'lucide-react';
import { Recipe } from '../types/recipe';

interface AiChefViewProps {
  recipes: Recipe[];
  currentRecipeId?: number;
  onSelectRecipe: (id: number) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

const PRESET_QUESTIONS = [
  '고기가 질긴데 어떻게 연하게 만들까?',
  '간장을 너무 많이 넣어서 짜! 어떻게 수습해?',
  '설탕 대신 알룰로스나 올리고당 넣어도 돼?',
  '남은 양념이나 고기는 어떻게 보관하면 좋아?',
  '매운맛을 줄이려면 뭘 더 넣어야 해?',
];

export const AiChefView: React.FC<AiChefViewProps> = ({
  recipes,
  currentRecipeId,
  onSelectRecipe,
}) => {
  const selectedRecipe = recipes.find((r) => r.id === currentRecipeId);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: selectedRecipe
        ? `안녕하세요! 👨‍🍳 AI 셰프입니다. 지금 보고 계신 **${selectedRecipe.name}** 요리에 대해 궁금한 점이나 대체 재료, 간 맞추기 팁이 있다면 무엇이든 편하게 물어보세요!`
        : `안녕하세요! 👨‍🍳 AI 셰프입니다. 오늘 하실 요리에 관해 재료 대체법, 불 조절, 양념 배합, 보관 팁 등 궁금한 점을 언제든 물어보세요!`,
      time: '방금',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || inputQuestion).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: q,
      time: '방금',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chef-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRecipe: selectedRecipe,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          question: q,
        }),
      });

      const data = await res.json();
      const reply = data.reply || '답변을 가져오지 못했습니다. 잠시 후 다시 질문해주세요.';

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: reply,
          time: '방금',
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: '셰프와의 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.',
          time: '방금',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-32 flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Header bar with recipe select */}
      <div className="bg-white rounded-2xl p-3 border border-amber-100 shadow-xs mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="text-xs font-bold text-stone-800">질문 대상 요리:</span>
        </div>

        <select
          value={currentRecipeId || ''}
          onChange={(e) => onSelectRecipe(Number(e.target.value) || 0)}
          className="text-xs font-semibold text-stone-800 bg-amber-50/70 border border-amber-200 px-3 py-1.5 rounded-xl max-w-[200px] truncate focus:outline-none"
        >
          <option value="">전체 / 일반 질문</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Preset Question Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-2">
        {PRESET_QUESTIONS.map((pq, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(pq)}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-orange-50 border border-amber-100/90 text-stone-700 text-xs font-medium whitespace-nowrap active:scale-95 shadow-xs transition-colors flex items-center gap-1"
          >
            <Lightbulb className="w-3 h-3 text-amber-500" />
            <span>{pq}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 bg-white rounded-3xl p-4 border border-amber-100/80 shadow-xs overflow-y-auto space-y-3.5">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-xl bg-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs text-xs font-bold">
                👨‍🍳
              </div>
            )}
            <div
              className={`max-w-[82%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium shadow-xs ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-tr-none'
                  : 'bg-amber-50/80 text-stone-800 border border-amber-100/90 rounded-tl-none'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-stone-400 text-xs font-medium py-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span>셰프가 최선의 레시피 해결책을 생각하는 중...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="mt-3 relative flex items-center"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder={selectedRecipe ? `'${selectedRecipe.name}'에 대해 물어보세요...` : '요리 팁, 대체 재료 등을 질문하세요...'}
          className="w-full bg-white pl-4 pr-12 py-3.5 rounded-2xl border border-amber-200 text-xs sm:text-sm font-medium text-stone-800 placeholder:text-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={loading || !inputQuestion.trim()}
          className="absolute right-2 w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white flex items-center justify-center active:scale-95 transition-all shadow-xs"
          aria-label="질문 전송"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
