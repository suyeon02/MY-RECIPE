import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Check, Clock, CheckCircle2 } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { parseCookingStep, formatSecondsToTime } from '../utils/youtubeParser';
import { parseIngredientLine } from '../utils/recipeScaler';

interface CookModeViewProps {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
  onFinish: () => void;
}

export const CookModeView: React.FC<CookModeViewProps> = ({
  recipe,
  servings,
  onClose,
  onFinish,
}) => {
  const steps = recipe.steps.split('\n').filter((l) => l.trim().length > 0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showIngredientsDrawer, setShowIngredientsDrawer] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  const factor = servings / (recipe.serv || 2);
  const currentStep = parseCookingStep(steps[currentStepIndex] || '', currentStepIndex);

  // When step changes, check if there's a timer mentioned in the step
  useEffect(() => {
    setIsTimerRunning(false);
    if (currentStep.timerMinutes) {
      setTimerSeconds(currentStep.timerMinutes * 60);
    } else {
      setTimerSeconds(0);
    }
  }, [currentStepIndex]);

  // Timer interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const ingredientLines = recipe.ing.split('\n').filter((l) => l.trim().length > 0);
  const sauceLines = recipe.sau ? recipe.sau.split('\n').filter((l) => l.trim().length > 0) : [];

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onFinish();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#191919] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-95 text-white/80 hover:text-white"
          aria-label="요리 모드 종료"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">
            COOKING MODE · {servings}인분
          </span>
          <h2 className="text-sm font-bold truncate max-w-[200px] text-white/90">
            {recipe.name}
          </h2>
        </div>

        <button
          onClick={() => setShowIngredientsDrawer(!showIngredientsDrawer)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            showIngredientsDrawer
              ? 'bg-orange-500 text-white'
              : 'bg-white/10 text-white/90 hover:bg-white/20'
          }`}
        >
          🧂 재료
        </button>
      </div>

      {/* Main Step Body */}
      <div className="flex-1 px-6 py-8 flex flex-col items-center justify-center text-center overflow-y-auto">
        {/* Progress step */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/20 text-orange-400 font-extrabold text-sm mb-6 border border-orange-500/30">
          <span>단계 {currentStepIndex + 1}</span>
          <span className="text-white/40">/</span>
          <span>{steps.length}</span>
        </div>

        {/* Step text */}
        <h1 className="text-2xl sm:text-3xl font-black leading-relaxed max-w-md text-white tracking-tight">
          {currentStep.text}
        </h1>

        {/* Timer Box if applicable */}
        {(currentStep.timerMinutes || timerSeconds > 0) && (
          <div className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-5 w-full max-w-xs flex flex-col items-center shadow-2xl">
            <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>조리 타이머</span>
            </div>

            <div className={`text-4xl font-mono font-black my-1 tracking-wider ${
              timerSeconds === 0 ? 'text-red-400 animate-bounce' : 'text-white'
            }`}>
              {formatSecondsToTime(timerSeconds)}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
                  isTimerRunning
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {isTimerRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isTimerRunning ? '일시정지' : '시작'}</span>
              </button>

              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds((currentStep.timerMinutes || 1) * 60);
                }}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 flex items-center justify-center"
                title="타이머 리셋"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Ingredients Drawer */}
      {showIngredientsDrawer && (
        <div className="absolute inset-x-0 bottom-24 top-16 bg-[#222]/95 backdrop-blur-xl z-20 p-5 overflow-y-auto border-t border-white/10 rounded-t-3xl shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-orange-400">
              재료 및 계량 확인 ({servings}인분 기준)
            </h3>
            <button
              onClick={() => setShowIngredientsDrawer(false)}
              className="text-xs text-white/60 hover:text-white"
            >
              닫기 ✕
            </button>
          </div>

          <div className="space-y-4 text-left">
            <div>
              <p className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">주재료</p>
              <div className="space-y-1.5">
                {ingredientLines.map((line, idx) => {
                  const p = parseIngredientLine(line, factor);
                  const isChecked = !!checkedIngredients[`ing-${idx}`];
                  return (
                    <label
                      key={idx}
                      onClick={() => setCheckedIngredients((prev) => ({ ...prev, [`ing-${idx}`]: !prev[`ing-${idx}`] }))}
                      className={`flex items-center justify-between p-2.5 rounded-xl bg-white/5 cursor-pointer text-xs font-semibold ${
                        isChecked ? 'opacity-40 line-through' : ''
                      }`}
                    >
                      <span className="text-white/90">{p.name}</span>
                      <span className="text-orange-300 font-bold">{p.scaledAmount || p.amount}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {sauceLines.length > 0 && (
              <div>
                <p className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">양념 & 소스</p>
                <div className="space-y-1.5">
                  {sauceLines.map((line, idx) => {
                    const p = parseIngredientLine(line, factor);
                    const isChecked = !!checkedIngredients[`sau-${idx}`];
                    return (
                      <label
                        key={idx}
                        onClick={() => setCheckedIngredients((prev) => ({ ...prev, [`sau-${idx}`]: !prev[`sau-${idx}`] }))}
                        className={`flex items-center justify-between p-2.5 rounded-xl bg-white/5 cursor-pointer text-xs font-semibold ${
                          isChecked ? 'opacity-40 line-through' : ''
                        }`}
                      >
                        <span className="text-white/90">{p.name}</span>
                        <span className="text-amber-300 font-bold">{p.scaledAmount || p.amount}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Step Control Buttons */}
      <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur flex items-center gap-3">
        <button
          onClick={handlePrevStep}
          disabled={currentStepIndex === 0}
          className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none active:scale-95 font-bold text-sm flex items-center justify-center gap-1 text-white transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>이전</span>
        </button>

        <button
          onClick={handleNextStep}
          className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 font-black text-sm flex items-center justify-center gap-1.5 text-white shadow-lg shadow-orange-500/30 transition-all"
        >
          <span>{currentStepIndex === steps.length - 1 ? '요리 완료 🎉' : '다음 단계'}</span>
          {currentStepIndex < steps.length - 1 && <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};
