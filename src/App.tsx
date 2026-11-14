import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getPublicRecipes, savePublicRecipes, organizeRecipePhoto, extractYoutubeRecipe, askChef } from './firebase';

export interface Recipe {
  id: number;
  name: string;
  cat: string;
  min?: number | string; // 사용 안 함 (조리시간 삭제됨)
  serv: number;
  ing: string;
  sau: string;
  steps: string;
  tip: string;
  url: string;
  src: 'sns' | 'my' | 'photo' | 'ai';
  img?: string;
  t: number;
  fav?: number;
  cooked?: number;
  summary?: string;
  difficulty?: string;
  calories?: string;
  tags?: string[];
  channel?: string;
}

const CATS = ['밥·죽', '국·찌개·전골', '볶음', '조림', '구이·찜', '무침·샐러드', '전·튀김', '면·분식', '김치·장아찌', '양념', '디저트·음료'];
const EMJ = ['🍚', '🍲', '🍳', '🥘', '🍖', '🥗', '🍤', '🍜', '🥬', '🫙', '🍰'];

// ── 예전 카테고리 → 새 카테고리 ───────────────────────────────
// 이름만 바뀐 것은 그대로 옮기고, 사라진 분류(밑반찬·메인 요리·기타 등)는 요리 이름의 말로 짐작한다.
// 짐작할 수 없으면 예전 이름을 그대로 두어 레시피가 사라지거나 엉뚱한 분류로 가지 않게 한다.
const LEGACY_CAT: Record<string, string> = { '국·찌개': '국·찌개·전골', '간식·디저트': '디저트·음료' };
const CAT_KEYWORDS: [string, RegExp][] = [
  ['디저트·음료', /케이크|쿠키|마카롱|푸딩|타르트|스콘|머핀|브라우니|스무디|주스|에이드|라떼|아이스크림|빙수|젤리|음료|디저트/],
  ['면·분식', /면|국수|라면|라멘|우동|파스타|스파게티|수제비|냉면|떡볶이|라볶이|쫄면|짜장|짬뽕|순대|김밥|튀김우동|분식/],
  ['국·찌개·전골', /찌개|전골|국$|국 |탕$|탕 |국밥|스프|수프/],
  ['밥·죽', /볶음밥|비빔밥|덮밥|주먹밥|솥밥|리조또|필라프|오므라이스|밥$|밥 |죽$|죽 /],
  ['전·튀김', /튀김|부침|돈까스|돈가스|커틀릿|치킨|강정|탕수육|너겟|동그랑땡|전$|전 /],
  ['볶음', /볶음|닭갈비|제육|잡채|볶이/],
  ['조림', /조림|졸임/],
  ['구이·찜', /구이|찜|갈비|불고기|스테이크|바비큐|훈제|수육|보쌈|그릴|오븐/],
  ['무침·샐러드', /무침|샐러드|나물|냉채|생채|파절이|버무/],
  ['김치·장아찌', /김치|깍두기|장아찌|피클|절임|단무지|겉절이|동치미|짠지/],
  ['양념', /양념|소스|드레싱|다대기|장$|청$|기름$|오일/],
];
const guessCat = (text: string) => CAT_KEYWORDS.find(([, re]) => re.test(String(text || '')))?.[0] ?? '';
// keepOld=true: 짐작이 안 되면 예전 이름 유지(저장된 레시피용) / false: 비워 둠(새로 만드는 레시피용)
const normalizeCat = (cat: string, name = '', keepOld = true) => {
  if (CATS.includes(cat)) return cat;
  if (LEGACY_CAT[cat]) return LEGACY_CAT[cat];
  return guessCat(name) || guessCat(cat) || (keepOld ? cat || '' : '');
};
const catLabel = (cat: string) => cat || '미분류';
const SL: Record<string, string> = { sns: 'SNS', my: '직접 작성', photo: '사진', ai: 'AI' };
const TS = /^([0-9]{1,2}):([0-9]{2}) +(.*)$/;

// 예전 기본 예시 레시피(제육볶음·계란말이): 수정하지 않은 상태로 남아 있으면 제거한다
const isOldSeedRecipe = (r: Recipe) =>
  (r.id === 1 && r.name === '제육볶음') || (r.id === 2 && r.name === '계란말이');


const LOCAL_STORAGE_KEY = 'my_recipes_proto';

// 화면 비율(%) 조절 범위·단위·저장 키
const ZOOM_STORAGE_KEY = 'my_recipes_zoom';
const ZOOM_MIN = 70;
const ZOOM_MAX = 150;
const ZOOM_STEP = 10;

// 뒤로가기 두 번 종료: 첫 터치 때 '종료 확인용 항목'을 한 번만 깔아 두었다는 표시(탭 세션 동안 유지)
const EXIT_GUARD_KEY = 'my_recipes_exit_guard';

// ── 새로고침 복원 ──────────────────────────────────────────
// 브라우저는 새로고침해도 현재 history 항목의 state를 그대로 보관한다.
// 화면 이동 때 거기에 현재 화면(탭·레시피·필터)을 적어 두었다가, 다시 열릴 때 읽어서 그 화면으로 돌아간다.
const readRestoredNav = (): any | null => {
  try {
    const st = window.history.state;
    if (st && typeof st.idx === 'number' && typeof st.tab === 'string') return st;
  } catch {
    /* 읽을 수 없으면 홈에서 시작 */
  }
  return null;
};
const RESTORED_NAV = readRestoredNav();

// 스크롤 위치는 직접 관리한다: 화면을 이동하면 맨 위, 새로고침하면 직전 위치.
const SCROLL_KEY = 'my_recipes_scroll';
try {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
} catch {
  /* 무시 */
}
const scrollToTop = () => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.querySelector('main')?.scrollTo?.(0, 0);
};

// 저장돼 있던 조리시간(min) 값을 모든 레시피에서 제거
const stripMin = (list: Recipe[]): Recipe[] =>
  list
    .filter((r) => !isOldSeedRecipe(r))
    .map((r) => {
      const { min, ...rest } = r;
      return { ...rest, cat: normalizeCat(rest.cat, rest.name) } as Recipe;
    });

// Helper functions matching original prototype
const L = (s: string) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

// 내보내기용 조리 순서: 한 줄을 한 단계로 보고 "1. …  2. …" 로 번호를 새로 매긴다.
// 입력할 때 이미 붙인 번호(1. / 2) / ① / 3단계)는 떼고 다시 매기므로 번호가 겹치거나 틀어지지 않는다.
// 영상 시간(예: "1:30 양파를 볶는다")은 "양파를 볶는다 (영상 1:30)" 로 풀어 쓴다.
const formatStepsNumbered = (steps: string) => {
  const lines = L(steps);
  if (lines.length === 0) return '-';
  return lines
    .map((line, idx) => {
      const body = line.replace(/^\s*(?:\d+\s*[.)]|[①-⑳]|\d+\s*단계\s*[:.]?)\s*/, '');
      const t = body.match(TS);
      const text = t ? `${t[3]} (영상 ${Number(t[1])}:${t[2]})` : body;
      return `${idx + 1}. ${text}`;
    })
    .join('\n');
};

// 재료·양념용: 줄바꿈 또는 쉼표(,)로 구분. 1,000g 같은 숫자 천단위 쉼표는 유지
const LI = (s: string) =>
  String(s || '')
    .split(/\n|(?<!\d),|,(?!\d{3}(?!\d))|[，、]/)
    .map((x) => x.trim())
    .filter(Boolean);

// '반'으로 적힌 분량을 숫자로 바꾼다. (반죽·반찬·반으로 자르기 같은 말은 건드리지 않는다)
//   "반개"·"반 컵" → 0.5개·0.5컵   /   "1개 반"·"2큰술 반" → 1.5개·2.5큰술   /   "1과 반 개" → 1.5개
const HALF_UNITS = '개|쪽|컵|모|줌|봉지|봉|캔|통|단|마리|장|알|큰술|작은술|스푼|숟가락|숟갈|근|병|포기|조각|덩이|공기|스쿱|꼬집';
const normalizeHalf = (s: string) =>
  s
    .replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${HALF_UNITS})\\s*반(?![가-힣])`, 'g'), (_m, n, u) => `${+n + 0.5}${u}`)
    .replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*과\\s*반\\s*(${HALF_UNITS})`, 'g'), (_m, n, u) => `${+n + 0.5}${u}`)
    .replace(new RegExp(`(^|\\s)반\\s*(?=(?:${HALF_UNITS}))`, 'g'), (_m, pre) => `${pre}0.5`);

// 한글로 쓴 개수를 숫자로 바꾼다: "한 개"·"두개"·"고기한근" → 1개·2개·고기1근, "하나"·"둘" → 1개·2개
// (단위가 바로 붙은 경우만 바꾸므로 두부·한우·열무 같은 이름은 그대로. 네모·세모처럼 띄어쓰기 없는 '모'도 건드리지 않는다)
const KO_NUM: Record<string, number> = {
  한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
  열한: 11, 열두: 12, 열세: 13, 열네: 14, 열다섯: 15, 열여섯: 16, 열일곱: 17, 열여덟: 18, 열아홉: 19, 스무: 20, 스물: 20,
};
const KO_NUM_RE = Object.keys(KO_NUM).sort((a, b) => b.length - a.length).join('|');
const KO_SINGLE: Record<string, number> = { 하나: 1, 둘: 2, 셋: 3, 넷: 4 };
const COUNT_UNITS = `${HALF_UNITS}|잔|움큼|방울|뿌리|송이|줄기|팩|대|토막|덩어리`;
const normalizeKoreanCount = (s: string) =>
  s
    .replace(new RegExp(`(${KO_NUM_RE})(\\s*)(${COUNT_UNITS})(?=반(?![가-힣])|(?![가-힣]))`, 'g'), (m, w: string, sp: string, u: string) =>
      (w === '네' || w === '세') && u === '모' && !sp ? m : `${KO_NUM[w]}${u}`
    )
    .replace(/(^|\s)(하나|둘|셋|넷)(?![가-힣])/g, (_m, pre: string, w: string) => `${pre}${KO_SINGLE[w]}개`);

// 단위 없이 숫자만 적은 경우("양파1", "마늘 4")의 단위를 재료 이름으로 짐작한다.
//   양념·액체류 → 큰술 / 세는 재료 → 개·쪽·대·모·마리·장 / 모르는 재료 → 숫자만 표시(단위를 지어내지 않는다)
const SEASONING_RE = /간장|된장|고추장|쌈장|막장|춘장|소금|설탕|후추|참기름|들기름|식용유|기름|식초|맛술|미림|청주|소주|올리고당|물엿|꿀|조청|케첩|케찹|마요네즈|머스타드|겨자|액젓|소스|가루|다진|깨|즙|시럽|버터|연유/;
const DEFAULT_COUNT_UNITS: [RegExp, string][] = [
  [/마늘/, '쪽'],
  [/대파/, '대'],
  [/두부/, '모'],
  [/팽이/, '봉'],
  [/새우|오징어/, '마리'],
  [/^김$|어묵|식빵|슬라이스|치즈|만두피|라이스페이퍼|또띠아/, '장'],
  [/양파|감자|고구마|당근|계란|달걀|버섯|표고|오이|호박|가지|토마토|파프리카|피망|고추|레몬|라임|사과|^배$|옥수수|양배추|^무$|브로콜리|아보카도|바나나/, '개'],
];
const withDefaultUnit = (name: string, amount: string) => {
  if (!/^(약\s*)?[\d½¼¾./~-]+$/.test(amount)) return amount; // 이미 단위가 있으면 그대로
  if (SEASONING_RE.test(name)) return `${amount}큰술`;
  const hit = DEFAULT_COUNT_UNITS.find(([re]) => re.test(name));
  return hit ? `${amount}${hit[1]}` : amount;
};

const splitIngredientLine = (line: string) => {
  const cleanLine = normalizeHalf(normalizeKoreanCount(line)).replace(/\(([\d½¼¾./~-]+)\)/g, '$1큰술');
  const match = cleanLine.match(/^(.*\S)\s+((?:약\s*)?[\d½¼¾][\d./½¼¾~\-]*\s*\S*)$/);
  if (match) {
    const name = match[1];
    const amount = withDefaultUnit(name, match[2].trim());
    return { name, amount };
  }
  const simpleMatch = cleanLine.match(/^(.*\S)\s+([\d.]+)$/);
  if (simpleMatch) {
    return { name: simpleMatch[1], amount: withDefaultUnit(simpleMatch[1], simpleMatch[2]) };
  }
  // 띄어쓰기 없이 붙여 쓴 경우: "고기1근", "버섯3개", "참기름1/2큰술"
  const tightMatch = cleanLine.match(/^(.*?[^\d\s½¼¾./~(\-])((?:약\s*)?[\d½¼¾][\d./½¼¾~\-]*\s*\S*)$/);
  if (tightMatch) {
    return { name: tightMatch[1], amount: withDefaultUnit(tightMatch[1], tightMatch[2].trim()) };
  }
  return { name: cleanLine, amount: '' };
};

const scaleIngredientAmount = (amount: string, ratio: number) => {
  if (!amount || ratio === 1) return amount;
  return amount.replace(/(약\s*)?(\d+(?:\.\d+)?|[½¼¾])(?:\/(\d+))?(\s*\S*)?/, (match, approx, value, denominator, unit) => {
    const fractionValues: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
    const numericValue = fractionValues[value] ?? Number(value);
    const scaled = (numericValue / (denominator ? Number(denominator) : 1)) * ratio;
    // 0.5 단위로 반올림 (분량이 0으로 사라지지 않도록 최소 0.5)
    const rounded = scaled > 0 ? Math.max(0.5, Math.round(scaled * 2) / 2) : 0;
    const resolvedUnit = unit ? unit.trim() : '';
    return `${approx || ''}${rounded}${resolvedUnit ? ' ' + resolvedUnit : ''}`;
  });
};

const INGREDIENT_ICONS: [RegExp, string][] = [
  [/돼지|삼겹|목살|앞다리|소고기|등심|불고기|고기/, '🥩'],
  [/닭/, '🍗'], [/양파/, '🧅'], [/파프리카|피망/, '🫑'], [/대파|쪽파|파/, '🌿'],
  [/마늘/, '🧄'], [/고추|청양/, '🌶️'], [/간장|된장|쌈장|소스|액젓/, '🫙'],
  [/설탕|올리고당|물엿|꿀/, '🍯'], [/소금|후추/, '🧂'], [/기름|참깨|들깨|깨/, '🫒'],
  [/계란|달걀/, '🥚'], [/두부/, '🧈'], [/김치|배추|시금치|상추|양배추/, '🥬'],
  [/감자/, '🥔'], [/고구마/, '🍠'], [/당근/, '🥕'], [/버섯/, '🍄'], [/호박|오이/, '🥒'],
  [/토마토/, '🍅'], [/쌀|밥/, '🍚'], [/면|국수|파스타|라면/, '🍜'], [/물|육수/, '💧'],
  [/우유/, '🥛'], [/버터/, '🧈'], [/치즈/, '🧀'], [/새우/, '🦐'],
  [/생선|고등어|멸치/, '🐟'], [/오징어/, '🦑'], [/식초|맛술|미림|술/, '🍶'],
  [/옥수수/, '🌽'], [/콩나물|숙주/, '🌱'],
];

const getIngredientIcon = (name: string) =>
  INGREDIENT_ICONS.find(([pattern]) => pattern.test(name))?.[1] || '🍽️';

const DownloadIcon = () => (
  <svg className="download-icon" width="32" stroke="#505050" strokeWidth="0.4" strokeLinejoin="round" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M4.97 12.97a.75.75 0 101.06 1.06L11 9.06v12.19a.75.75 0 001.5 0V9.06l4.97 4.97a.75.75 0 101.06-1.06l-6.25-6.25a.75.75 0 00-1.06 0l-6.25 6.25zM4.75 3.5a.75.75 0 010-1.5h14.5a.75.75 0 010 1.5H4.75z" />
  </svg>
);

const ZoomIcon = () => (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" />
    <path d="m16 16 4 4M11 8v6M8 11h6" />
  </svg>
);

// AI 분석 중 모달: 제목 글자가 하나씩 물결치고, 아래 안내 문구가 단계별로 바뀐다.
const AI_SNS_STEPS = ['영상과 더보기란을 읽고 있어요', '재료와 양념을 찾고 있어요', '조리 순서를 정리하고 있어요', '거의 다 됐어요, 잠시만요'];
const AI_PHOTO_STEPS = ['사진 속 글씨를 읽고 있어요', '재료와 양념을 나누고 있어요', '조리 순서를 정리하고 있어요', '거의 다 됐어요, 잠시만요'];

const AiLoadingModal = ({ title, steps }: { title: string; steps: string[] }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 3000);
    return () => clearInterval(timer);
  }, [steps.length]);

  let n = 0; // 글자마다 시작 시점을 조금씩 늦춰 물결처럼 보이게 한다
  return (
    <div className="mdl-bg ai-load-bg" role="alertdialog" aria-modal="true" aria-busy="true" aria-label={title}>
      <div className="ai-load">
        <div className="ai-load-emoji" aria-hidden="true">🍳</div>
        <div className="ai-load-title" aria-hidden="true">
          {title.split(' ').map((word, wi) => (
            <React.Fragment key={wi}>
              {wi > 0 && ' '}
              <span className="ai-word">
                {Array.from(word).map((ch) => {
                  const i = n++;
                  return (
                    <span key={i} style={{ '--i': i } as React.CSSProperties}>
                      {ch}
                    </span>
                  );
                })}
              </span>
            </React.Fragment>
          ))}
        </div>
        <p key={step} className="ai-load-step" role="status" aria-live="polite">
          {steps[step]}
        </p>
      </div>
    </div>
  );
};

const CopyIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path fillRule="evenodd" d="M4.75 3A1.75 1.75 0 003 4.75v9.5c0 .966.784 1.75 1.75 1.75h1.5a.75.75 0 000-1.5h-1.5a.25.25 0 01-.25-.25v-9.5a.25.25 0 01.25-.25h9.5a.25.25 0 01.25.25v1.5a.75.75 0 001.5 0v-1.5A1.75 1.75 0 0014.25 3h-9.5zm5 5A1.75 1.75 0 008 9.75v9.5c0 .966.784 1.75 1.75 1.75h9.5A1.75 1.75 0 0021 19.25v-9.5A1.75 1.75 0 0019.25 8h-9.5zM9.5 9.75a.25.25 0 01.25-.25h9.5a.25.25 0 01.25.25v9.5a.25.25 0 01-.25.25h-9.5a.25.25 0 01-.25-.25v-9.5z" />
  </svg>
);




const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    className="heart-icon"
    width="23"
    height="23"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke={filled ? 'none' : '#505050'}
    strokeWidth="0.4"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {filled ? (
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    ) : (
      <path
        fillRule="evenodd"
        d="M6.736 4C4.657 4 2.5 5.88 2.5 8.514c0 3.107 2.324 5.96 4.861 8.12a29.66 29.66 0 004.566 3.175l.073.041.073-.04c.271-.153.661-.38 1.13-.674.94-.588 2.19-1.441 3.436-2.502 2.537-2.16 4.861-5.013 4.861-8.12C21.5 5.88 19.343 4 17.264 4c-2.106 0-3.801 1.389-4.553 3.643a.75.75 0 01-1.422 0C10.537 5.389 8.841 4 6.736 4zM12 20.703l.343.667a.75.75 0 01-.686 0l.343-.667zM1 8.513C1 5.053 3.829 2.5 6.736 2.5 9.03 2.5 10.881 3.726 12 5.605 13.12 3.726 14.97 2.5 17.264 2.5 20.17 2.5 23 5.052 23 8.514c0 3.818-2.801 7.06-5.389 9.262a31.146 31.146 0 01-5.233 3.576l-.025.013-.007.003-.002.001-.344-.666-.343.667-.003-.002-.007-.003-.025-.013A29.308 29.308 0 0110 20.408a31.147 31.147 0 01-3.611-2.632C3.8 15.573 1 12.332 1 8.514z"
      />
    )}
  </svg>
);


const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#505050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);


const EditIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#505050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// 뒤로가기 화살표 SVG 아이콘
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M10.78 19.03a.75.75 0 01-1.06 0l-6.25-6.25a.75.75 0 010-1.06l6.25-6.25a.75.75 0 111.06 1.06L5.81 11.5h14.44a.75.75 0 010 1.5H5.81l4.97 4.97a.75.75 0 010 1.06z" />
  </svg>
);


// 갤러리 아이콘 (회색)
const GalleryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// 카메라 아이콘 (회색)
const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const YouTubeicon = () => (
  <svg width="50" height="50" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d10808">
    <title>YouTube icon</title>
    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
  </svg>
);

const extractYtId = (value: string) => {
  const input = String(value || '').trim();
  try {
    const parsed = new URL(input);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let id = parsed.searchParams.get('v') || '';
    if (!id && (host === 'youtu.be' || host === 'm.youtube.com' || host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com')) {
      id = parsed.pathname.match(/\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1] || '';
      if (!id && host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
  } catch { /* Try a permissive match for URLs without a scheme. */ }
  const match = input.match(/(?:youtu\.be\/|(?:watch\?[^#]*v=|(?:shorts|embed|live|v)\/))([A-Za-z0-9_-]{11})/i);
  return match?.[1] || '';
};

const getYtThumbnail = (id: string, quality = 'hqdefault') => 'https://i.ytimg.com/vi/' + id + '/' + quality + '.jpg';

const getEmoji = (cat: string) => {
  const idx = CATS.indexOf(cat);
  return idx >= 0 ? EMJ[idx] : '🍽️';
};

export default function App() {
  // Recipes list
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return stripMin(parsed);
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    return [];
  });

  const [cloudReady, setCloudReady] = useState(false);

  // Navigation & View States
  const [tab, setTab] = useState<'home' | 'my' | 'imp' | 'ai'>(() =>
    ['home', 'my', 'imp', 'ai'].includes(RESTORED_NAV?.tab) ? RESTORED_NAV.tab : 'home'
  );
  const [imp, setImp] = useState<'' | 'sns' | 'photo' | 'my' | 'ai'>(() =>
    ['sns', 'photo', 'my', 'ai'].includes(RESTORED_NAV?.imp) ? RESTORED_NAV.imp : ''
  );
  const [viewRecipeId, setViewRecipeId] = useState<number | null>(() => {
    const id = RESTORED_NAV?.viewRecipeId;
    return typeof id === 'number' && recipes.some((r) => r.id === id) ? id : null;
  });
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe> | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>(() => String(RESTORED_NAV?.filters?.q ?? ''));
  const [selectedCat, setSelectedCat] = useState<string>(() => {
    const c = String(RESTORED_NAV?.filters?.cat ?? '');
    return CATS.includes(c) ? c : '';
  });
  const [selectedFilter, setSelectedFilter] = useState<string>(() => String(RESTORED_NAV?.filters?.f ?? ''));

  // Servings stepper in Detail View
  const [servings, setServings] = useState(2);

  // SNS Import state
  const [snsUrl, setSnsUrl] = useState('');
  const [snsLoading, setSnsLoading] = useState(false);
  const [snsMessage, setSnsMessage] = useState('');

  // Direct edit state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftIngredients, setDraftIngredients] = useState('');
  const [draftSeasonings, setDraftSeasonings] = useState('');
  const [draftSteps, setDraftSteps] = useState('');
  const [draftTip, setDraftTip] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [photoAiError, setPhotoAiError] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState('');

  // Delete confirm id
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Export Modal state
  const [exportOpen, setExportOpen] = useState(() => !!RESTORED_NAV?.exportOpen);
  const [exportSelected, setExportSelected] = useState<Record<number, boolean>>({});

  // 레시피 삭제(선택) 페이지 state
  const [deleteMode, setDeleteMode] = useState(() => !!RESTORED_NAV?.deleteMode);
  const [deleteSelected, setDeleteSelected] = useState<Record<number, boolean>>({});
  const [deleteArmed, setDeleteArmed] = useState(false); // 삭제 확인(2단계) 대기 상태

  // Toast
  const [toastText, setToastText] = useState<string | null>(null);

  // AI Chef
  const [curChefRecipeId, setCurChefRecipeId] = useState<number | ''>('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chefInput, setChefInput] = useState('');
  const [chefLoading, setChefLoading] = useState(false);

  // 재료 리스트
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);

  // 화면 비율(%): 70% ~ 150%, 10% 단위. 마지막 설정은 기기에 저장해 다음 접속에도 유지한다.
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
      if (saved >= ZOOM_MIN && saved <= ZOOM_MAX) return Math.round(saved / ZOOM_STEP) * ZOOM_STEP;
    } catch {
      /* 저장값을 못 읽으면 기본값 사용 */
    }
    return 100;
  });
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(ZOOM_MAX, prev + ZOOM_STEP));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(ZOOM_MIN, prev - ZOOM_STEP));
  const handleZoomReset = () => setZoomLevel(100);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
    } catch (e) {
      console.warn('Zoom save error:', e);
    }
  }, [zoomLevel]);

  // 로고 줄의 돋보기 아이콘을 누르면 열리는 작은 비율 조절기
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!zoomOpen) return;
    const onDown = (e: PointerEvent) => {
      if (zoomWrapRef.current && !zoomWrapRef.current.contains(e.target as Node)) setZoomOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [zoomOpen]);

  const showToast = React.useCallback((msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText((curr) => (curr === msg ? null : curr));
    }, 2400);
  }, []);

  // ---------------------------------------------------------------
  // 브라우저/폰 뒤로가기 연동: 화면 이동(탭·레시피 보기·수정·추가·내보내기)마다
  // history 항목을 쌓고, 뒤로가기(popstate) 시 이전 화면으로 복원한다.
  // ---------------------------------------------------------------
  type NavSnap = { tab: string; imp: string; viewRecipeId: number | null; editing: boolean; exportOpen: boolean; deleteMode: boolean };
  const navKeyOf = (n: NavSnap) => `${n.tab}|${n.imp}|${n.viewRecipeId ?? ''}|${n.editing ? 1 : 0}|${n.exportOpen ? 1 : 0}|${n.deleteMode ? 1 : 0}`;
  const lastNavRef = useRef<{ key: string; idx: number; snap: NavSnap; prev?: NavSnap } | null>(null);
  const isEditing = !!editingRecipe;
  const exitArmedRef = useRef(false); // 첫 번째 뒤로가기 후 2초 동안 true
  const filtersRef = useRef({ q: '', cat: '', f: '' });
  filtersRef.current = { q: searchQuery, cat: selectedCat, f: selectedFilter };

  useEffect(() => {
    const snap: NavSnap = { tab, imp, viewRecipeId, editing: isEditing, exportOpen, deleteMode };
    const key = navKeyOf(snap);
    const last = lastNavRef.current;
    const filters = { q: searchQuery, cat: selectedCat, f: selectedFilter };
    if (!last) {
      // 새로고침으로 다시 열린 경우: 기록 번호를 이어받아 뒤로가기가 계속 맞게 동작하게 한다.
      const startIdx = RESTORED_NAV ? RESTORED_NAV.idx : 0;
      const startPrev = RESTORED_NAV ? RESTORED_NAV.prev : undefined;
      window.history.replaceState({ ...snap, idx: startIdx, prev: startPrev, filters }, '');
      lastNavRef.current = { key, idx: startIdx, snap, prev: startPrev };
      return;
    }
    if (last.key === key) return;
    const idx = last.idx + 1;
    window.history.pushState({ ...snap, idx, prev: last.snap, filters }, '');
    lastNavRef.current = { key, idx, snap, prev: last.snap };
  }, [tab, imp, viewRecipeId, isEditing, exportOpen, deleteMode]);

  useEffect(() => {
    // 현재 화면의 history 항목을 다시 쌓는다(종료 확인용 항목 위로 되돌아올 때 사용)
    const pushAppEntry = () => {
      const last = lastNavRef.current;
      if (!last) return;
      try {
        window.history.pushState({ ...last.snap, idx: last.idx, prev: last.prev, filters: filtersRef.current }, '');
      } catch {
        /* 무시 */
      }
    };
    const onPop = (e: PopStateEvent) => {
      const st = e.state;
      // 가장 처음 화면에서 뒤로가기를 누르면 '종료 확인용 항목'에 닿는다.
      if (st && st.guard) {
        if (exitArmedRef.current) {
          // 두 번째 뒤로가기 → 앱 종료: 설치형 앱(PWA)은 처음 항목을 벗어나면 앱이 닫힌다.
          try {
            window.close();
          } catch {
            /* 무시 */
          }
          window.history.back();
          // 브라우저 탭처럼 벗어날 곳이 없어 화면이 그대로 남으면 정상 상태로 되돌린다.
          setTimeout(() => {
            if (window.history.state && window.history.state.guard) pushAppEntry();
            exitArmedRef.current = false;
          }, 500);
          return;
        }
        exitArmedRef.current = true;
        showToast('한 번 더 누르면 앱이 종료돼요');
        pushAppEntry();
        setTimeout(() => {
          exitArmedRef.current = false;
        }, 2000);
        return;
      }
      if (!st || typeof st.idx !== 'number') return;
      // 수정 화면(editing)은 객체 상태라 복원할 수 없으므로 항상 닫는다.
      const snap: NavSnap = { tab: st.tab, imp: st.imp, viewRecipeId: st.viewRecipeId ?? null, editing: false, exportOpen: !!st.exportOpen, deleteMode: !!st.deleteMode };
      lastNavRef.current = { key: navKeyOf(snap), idx: st.idx, snap, prev: st.prev };
      setTab(snap.tab as any);
      setImp(snap.imp as any);
      setViewRecipeId(snap.viewRecipeId);
      setEditingRecipe(null);
      setExportOpen(snap.exportOpen);
      setDeleteMode(snap.deleteMode);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showToast]);

  // 종료 확인용 항목 만들기: 크롬은 사용자가 화면을 만지기 전에 앱이 쌓은 항목을 뒤로가기 때 건너뛰므로
  // 시작할 때가 아니라 '첫 터치·키 입력' 때 처음 화면 아래에 한 번만 깔아 둔다.
  useEffect(() => {
    const install = () => {
      window.removeEventListener('pointerdown', install, true);
      window.removeEventListener('keydown', install, true);
      try {
        if (sessionStorage.getItem(EXIT_GUARD_KEY)) return;
        const st = window.history.state;
        if (!st || st.idx !== 0 || st.guard) return; // 처음 화면(기록 번호 0)에서만
        window.history.replaceState({ guard: true }, '');
        window.history.pushState(st, '');
        sessionStorage.setItem(EXIT_GUARD_KEY, '1');
      } catch {
        /* 무시 */
      }
    };
    window.addEventListener('pointerdown', install, true);
    window.addEventListener('keydown', install, true);
    return () => {
      window.removeEventListener('pointerdown', install, true);
      window.removeEventListener('keydown', install, true);
    };
  }, []);

  // 검색어·카테고리가 바뀌면 현재 history 항목에도 반영(항목을 새로 쌓지는 않는다)
  useEffect(() => {
    try {
      const st = window.history.state;
      if (!st || typeof st.idx !== 'number') return;
      window.history.replaceState({ ...st, filters: { q: searchQuery, cat: selectedCat, f: selectedFilter } }, '');
    } catch {
      /* replaceState 횟수 제한 등은 무시 */
    }
  }, [searchQuery, selectedCat, selectedFilter]);

  // 화면을 이동하면 새 화면은 맨 위에서 시작한다. 새로고침 직후에는 직전 스크롤 위치로 복원한다.
  const scrollNavKey = `${tab}|${imp}|${viewRecipeId ?? ''}|${isEditing ? 1 : 0}|${exportOpen ? 1 : 0}|${deleteMode ? 1 : 0}`;
  const lastScrollKeyRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = lastScrollKeyRef.current;
    lastScrollKeyRef.current = scrollNavKey;
    if (prev === null) {
      try {
        const s = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || 'null');
        if (RESTORED_NAV && s && s.idx === RESTORED_NAV.idx && typeof s.y === 'number') window.scrollTo(0, s.y);
      } catch {
        /* 복원 실패 시 그대로 */
      }
      return;
    }
    if (prev !== scrollNavKey) scrollToTop();
  }, [scrollNavKey]);

  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ idx: lastNavRef.current?.idx ?? 0, y: window.scrollY }));
      } catch {
        /* 무시 */
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  // 폰 상단 상태바(시계·아이콘 줄) 색을 앱 배경색에 맞춘다. index.html 의 theme-color(주황)를 덮어쓰고 다크 모드 전환도 따라간다.
  useEffect(() => {
    const apply = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fafafa';
      const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
      let meta = metas[0];
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.removeAttribute('media');
      meta.content = bg;
      metas.slice(1).forEach((m) => m.remove());
    };
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, []);

  // 앱 안의 뒤로가기 버튼: 이동 기록이 있으면 history.back(), 없으면 fallback 실행
  const goBack = (fallback: () => void) => {
    if ((lastNavRef.current?.idx ?? 0) > 0) window.history.back();
    else fallback();
  };
  const closeExport = () => goBack(() => setExportOpen(false));

  // 삭제 페이지 열기/선택/삭제
  const openDeletePage = () => {
    setDeleteSelected({});
    setDeleteArmed(false);
    setDeleteMode(true);
  };
  const toggleDeleteItem = (id: number, checked: boolean) => {
    setDeleteArmed(false);
    setDeleteSelected((prev) => ({ ...prev, [id]: checked }));
  };
  const toggleAllDelete = () => {
    setDeleteArmed(false);
    const all = recipes.length > 0 && recipes.every((r) => deleteSelected[r.id]);
    const next: Record<number, boolean> = {};
    recipes.forEach((r) => {
      next[r.id] = !all;
    });
    setDeleteSelected(next);
  };
  const deleteSelectedRecipes = () => {
    const ids = recipes.filter((r) => deleteSelected[r.id]).map((r) => r.id);
    if (ids.length === 0) {
      showToast('삭제할 레시피를 선택해 주세요.');
      return;
    }
    if (!deleteArmed) {
      setDeleteArmed(true); // 한 번 더 눌러야 실제로 삭제
      return;
    }
    setRecipes((prev) => prev.filter((r) => !deleteSelected[r.id]));
    setDeleteSelected({});
    setDeleteArmed(false);
    goBack(() => setDeleteMode(false));
    showToast(`${ids.length}개의 레시피를 삭제했어요.`);
  };

  // Load the public shared recipe list on open; seed an empty collection from local recipes.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cloudRecipes = await getPublicRecipes(recipes);
        if (!active) return;
        if (cloudRecipes.length > 0) {
          setRecipes(stripMin(cloudRecipes));
        } else if (recipes.length > 0) {
          await savePublicRecipes(recipes);
        }
        if (active) setCloudReady(true);
      } catch (error) {
        console.error('Firebase recipe load failed:', error);
        if (active) showToast('Firebase 연결 실패: Firestore 규칙을 확인해 주세요.');
      }
    })();
    return () => { active = false; };
  // Existing local recipes provide first-use migration and browser-only photo fallback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cloudReady) return;
    const timer = setTimeout(() => {
      savePublicRecipes(recipes).catch((error) => {
        console.error('Firebase recipe save failed:', error);
        showToast('클라우드 저장에 실패했어요. Firestore 규칙을 확인해 주세요.');
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [recipes, cloudReady]);

  // Save recipes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recipes));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [recipes]);

  // Sync servings and reset video player / delete confirm when viewing recipe
  useEffect(() => {
    setIsPlayingVideo(false);
    setDeleteConfirmId(null);
    if (viewRecipeId) {
      const target = recipes.find((r) => r.id === viewRecipeId);
      if (target) setServings(Number(target.serv) || 2);
    }
  }, [viewRecipeId, recipes]);

  useEffect(() => {
    if (deleteConfirmId === null) return;
    const timer = setTimeout(() => setDeleteConfirmId(null), 3000);
    return () => clearTimeout(timer);
  }, [deleteConfirmId]);

  const toggleFav = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecipes((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const next = r.fav ? 0 : 1;
          showToast(next ? '즐겨찾기에 추가했어요 ♥' : '즐겨찾기에서 해제했어요');
          return { ...r, fav: next };
        }
        return r;
      })
    );
  };

  const handleDelete = (id: number) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);
    goBack(() => setViewRecipeId(null));
    showToast('레시피를 삭제했습니다.');
  };

  /**
   * CORE: SNS YouTube Extraction
   */
  const handleExtractSns = async (urlToExtract?: string) => {
    const targetUrl = (urlToExtract || snsUrl).trim();
    if (!targetUrl) {
      setSnsMessage('유튜브 링크를 입력해 주세요.');
      return;
    }
    if (!/youtu/i.test(targetUrl)) {
      setSnsMessage('유튜브 링크를 올바르게 입력해 주세요. (인스타그램은 아직 지원하지 않아요)');
      return;
    }

    setSnsLoading(true);
    setSnsMessage('유튜브 영상과 더보기란을 분석하여 레시피를 추출하는 중입니다... 🍳');

    try {
      const data = await extractYoutubeRecipe(targetUrl);
      const extracted = data.recipe || {};
      const parsedVideoId = extractYtId(targetUrl);
      const responseVideoId = typeof data.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(data.videoId) ? data.videoId : '';
      const videoId = parsedVideoId || responseVideoId;
      const thumbnail = videoId ? getYtThumbnail(videoId) : data.thumbnail || '';

      const newRecipe: Recipe = {
        id: Date.now(),
        name: extracted.name || '유튜브 요리 레시피',
        cat: normalizeCat(extracted.cat, extracted.name, false),
        serv: extracted.serv || 2,
        ing: Array.isArray(extracted.ing) ? extracted.ing.join('\n') : extracted.ing || '재료 정보',
        sau: Array.isArray(extracted.sau) ? extracted.sau.join('\n') : extracted.sau || '',
        steps: Array.isArray(extracted.steps) ? extracted.steps.join('\n') : extracted.steps || '맛있게 조리합니다.',
        tip: extracted.tip || '영상에서 소개된 요리 팁입니다.',
        summary: extracted.summary || '',
        difficulty: extracted.difficulty || '보통',
        calories: extracted.calories || '',
        tags: extracted.tags || ['#유튜브레시피'],
        url: targetUrl,
        src: 'sns',
        img: thumbnail,
        t: Date.now(),
        fav: 0,
      };

      setRecipes((prev) => [newRecipe, ...prev]);
      setSnsLoading(false);
      setSnsMessage('');
      setSnsUrl('');
      setImp('');
      setViewRecipeId(newRecipe.id);
      showToast('영상을 분석해 레시피로 저장했어요! 🎉');
    } catch (err: any) {
      console.error('SNS extract error:', err);
      setSnsLoading(false);
      setSnsMessage('');
      setSnsUrl('');

      // Fallback: open edit screen with partial info
      const fallbackYtId = extractYtId(targetUrl);
      setEditingRecipe({
        id: 0,
        name: '',
        cat: '',
        serv: 2,
        ing: '',
        sau: '',
        steps: '',
        tip: '',
        url: targetUrl,
        src: 'sns',
        img: fallbackYtId ? `https://i.ytimg.com/vi/${fallbackYtId}/hqdefault.jpg` : '',
      });
      setImp('');
      showToast('직접 레시피를 보완해 저장해 보세요.');
    }
  };

  // Direct manual save
  const handleSaveDirect = () => {
    if (!draftIngredients.trim() && !draftSeasonings.trim() && !draftSteps.trim()) {
      showToast('재료, 양념, 만드는 순서 중 하나 이상 입력해 주세요.');
      return;
    }
    const firstLine = (draftIngredients || draftSteps).trim().split('\n').filter(Boolean)[0] || '나만의 요리 노트';
    const newRecipe: Recipe = {
      id: Date.now(),
      name: draftTitle.trim() || firstLine.slice(0, 20),
      cat: normalizeCat('', draftTitle.trim() || firstLine.slice(0, 20), false),
      serv: 2,
      ing: draftIngredients,
      sau: draftSeasonings,
      steps: draftSteps,
      tip: draftTip,
      url: '',
      src: imp === 'photo' ? 'photo' : 'my',
      img: previewPhoto || '',
      t: Date.now(),
      fav: 0,
    };
    setRecipes((prev) => [newRecipe, ...prev]);
    setDraftTitle('');
    setDraftIngredients('');
    setDraftSeasonings('');
    setDraftSteps('');
    setDraftTip('');
    setPreviewPhoto('');
    setImp('');
    setViewRecipeId(newRecipe.id);
    showToast('새 레시피를 저장했어요.');
  };

  // Recipe Editor Save
  const handleSaveEditor = (formEl: HTMLFormElement) => {
    const formData = new FormData(formEl);
    const name = String(formData.get('name') || '').trim();
    if (!name) {
      showToast('요리명을 입력해 주세요');
      return;
    }

    const savedRecipe: Recipe = {
      id: editingRecipe?.id || Date.now(),
      name,
      cat: normalizeCat(String(formData.get('cat') || ''), name),
      serv: Number(formData.get('serv')) || 2,
      ing: LI(String(formData.get('ing') || '')).join('\n'),
      sau: LI(String(formData.get('sau') || '')).join('\n'),
      steps: String(formData.get('steps') || ''),
      tip: String(formData.get('tip') || ''),
      url: String(formData.get('url') || '').trim(),
      src: (editingRecipe?.src as any) || 'my',
      img: editingRecipe?.img || '',
      t: Date.now(),
      fav: editingRecipe?.fav || 0,
    };

    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === savedRecipe.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRecipe.id ? savedRecipe : r));
      }
      return [savedRecipe, ...prev];
    });

    const prevNav = lastNavRef.current?.prev;
    if (prevNav && !prevNav.editing && prevNav.viewRecipeId === savedRecipe.id) {
      // 레시피 상세에서 수정 → 저장: 수정 화면 기록을 닫고 상세로 돌아간다
      setEditingRecipe(null);
      window.history.back();
    } else {
      setEditingRecipe(null);
      setViewRecipeId(savedRecipe.id);
    }
    showToast('레시피를 저장했습니다.');
  };

  // Photo picker
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setPreviewPhoto(result);
      setEditingRecipe((prev) => (prev ? { ...prev, img: result } : null));
    };
    reader.readAsDataURL(file);
  };

  const handleRecognizePhoto = async () => {
    if (!previewPhoto) {
      showToast('먼저 레시피 사진을 선택해 주세요.');
      return;
    }
    setPhotoAiError('');
    setOcrLoading(true);
    try {
      const organized = await organizeRecipePhoto(previewPhoto);
      if (!organized || (!organized.ing && !organized.sau && !organized.steps)) {
        showToast('사진에서 레시피 내용을 찾지 못했어요. 더 선명한 사진으로 다시 시도해 주세요.');
        return;
      }
      if (organized.name) setDraftTitle(organized.name);
      setDraftIngredients(organized.ing || '');
      setDraftSeasonings(organized.sau || '');
      setDraftSteps(organized.steps || '');
      setDraftTip(organized.tip || '');
      showToast('AI가 사진을 레시피로 정리했어요. 결과를 확인해 주세요.');
    } catch (error) {
      console.error('Photo AI recognition failed:', error);
      const detail = error instanceof Error ? error.message : String(error);
      if (/429|quota exceeded|resource_exhausted|free_tier/i.test(detail)) {
        const retrySeconds = detail.match(/retry in\s+([0-9.]+)s/i)?.[1]
          || detail.match(/retryDelay["']?\s*:\s*["']([0-9.]+)s/i)?.[1];
        const wait = retrySeconds ? Math.ceil(Number(retrySeconds)) : 60;
        setPhotoAiError(`Gemini 무료 요청 한도(분당 5회)에 도달했어요. 약 ${wait}초 후 다시 시도해 주세요.`);
      } else {
        setPhotoAiError(detail);
      }
    } finally {
      setOcrLoading(false);
    }
  };

  // AI Chef Q&A
  const handleAskChef = async (queryText?: string) => {
    const question = (queryText || chefInput).trim();
    if (!question) return;

    const newMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...chatMessages,
      { role: 'user', content: question },
    ];
    setChatMessages(newMessages);
    setChefInput('');
    setChefLoading(true);

    const currentRecipe = recipes.find((r) => r.id === curChefRecipeId);

    try {
      const reply = await askChef(question, currentRecipe, newMessages);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply || '맛있게 조리해보세요!' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '👨‍🍳 간이 세다면 양파나 채소를 더하고, 설탕 대신 올리고당은 1.2배 분량으로 조절하시면 맛있게 완성됩니다.',
        },
      ]);
    } finally {
      setChefLoading(false);
    }
  };

  // Export Selected Text
  const getSelectedRecipesText = () => {
    const selected = recipes.filter((r) => exportSelected[r.id]);
    if (selected.length === 0) {
      showToast('선택된 레시피가 없어요');
      return null;
    }
    return selected
      .map(
        (r) =>
          `====================\n요리명: ${r.name}\n카테고리: ${catLabel(r.cat)}\n원문링크: ${r.url || '-'}\n\n[재료]\n${r.ing}\n\n[양념장]\n${r.sau || '-'}\n\n[조리순서]\n${formatStepsNumbered(r.steps)}\n\n[나만의 팁]\n${r.tip || '-'}\n====================`
      )
      .join('\n\n');
  };

  const copyRecipes = () => {
    const text = getSelectedRecipesText();
    if (!text) {
      showToast('내보낼 레시피를 선택해 주세요.');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast('클립보드에 복사되었어요! 메모장에 붙여넣으세요.');
        closeExport();
      })
      .catch(() => {
        showToast('복사에 실패했습니다.');
      });
  };

  // 선택한 레시피를 텍스트(.txt) 파일로 저장
  const saveAsTextFile = () => {
    const text = getSelectedRecipesText();
    if (!text) {
      showToast('내보낼 레시피를 선택해 주세요.');
      return;
    }
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileName = `내_레시피_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.txt`;
    // BOM(\uFEFF)을 붙여 윈도우 메모장에서도 한글이 깨지지 않게 저장
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    closeExport();
    showToast('텍스트 파일로 저장했어요.');
  };

  const toggleAllExport = () => {
    const all = recipes.every((r) => exportSelected[r.id]);
    const next: Record<number, boolean> = {};
    recipes.forEach((r) => {
      next[r.id] = !all;
    });
    setExportSelected(next);
  };

  // Filter recipes for 'my' and search
  const filteredRecipes = recipes.filter((r) => {
    const matchCat = !selectedCat || r.cat === selectedCat;
    const matchQuery =
      !searchQuery ||
      (r.name + r.ing + r.sau + (r.summary || '')).toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = selectedFilter === '즐겨찾기' ? !!r.fav : true;
    return matchCat && matchQuery && matchFilter;
  });

  const recentRecipes = [...recipes].sort((a, b) => b.t - a.t).slice(0, 6);
  const favoriteRecipes = recipes.filter((r) => r.fav);

  const currentViewingRecipe = recipes.find((r) => r.id === viewRecipeId);
  const deleteCount = recipes.filter((r) => deleteSelected[r.id]).length;
  const allDeleteSelected = recipes.length > 0 && recipes.every((r) => deleteSelected[r.id]);

  // Render thumbnail
  const renderThumbnail = (r: Recipe, className = 'ph') => {
    const ytId = extractYtId(r.url);
    const photoUrl = ytId ? getYtThumbnail(ytId) : r.img || '';

    if (photoUrl) {
      return (
        <div className={className}>
          <img
            src={photoUrl}
            alt={r.name}
            className="pi"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              const image = e.target as HTMLImageElement;
              const ytId = extractYtId(r.url);
              if (ytId && !image.src.includes('/mqdefault.jpg')) {
                image.src = getYtThumbnail(ytId, 'mqdefault');
                return;
              }
              image.style.display = 'none';
              const parent = image.parentElement;
              if (parent) {
                const fallback = parent.querySelector('.fallback-emoji') as HTMLElement;
                if (fallback) fallback.style.display = 'block';
              }
            }}
          />
          <span className="fallback-emoji" style={{ display: 'none' }}>
            {getEmoji(r.cat)}
          </span>
        </div>
      );
    }
    return <div className={className}>{getEmoji(r.cat)}</div>;
  };

  return (
    <div id="app" style={{ zoom: `${zoomLevel / 100}` } as React.CSSProperties}>
      {/* 1. Header (when not in edit mode or detail view) */}
      {!editingRecipe && !viewRecipeId && !deleteMode && (
        <div className="top">
          <b className="lg">MY RECIPE</b>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <div className="zoom-wrap" ref={zoomWrapRef}>
              <button
                type="button"
                className="ic-btn"
                onClick={() => setZoomOpen((v) => !v)}
                title="화면 비율"
                aria-label="화면 비율 조절"
                aria-expanded={zoomOpen}
                style={{ color: zoomLevel !== 100 ? 'var(--or)' : '#505050' }}
              >
                <ZoomIcon />
              </button>
              {zoomOpen && (
                /* 확대·축소해도 같은 크기로 보이도록 역배율 적용 */
                <div className="zoom-ctl zoom-pop" role="group" aria-label="화면 비율 조절" style={{ zoom: `${100 / zoomLevel}` }}>
                  <button type="button" onClick={handleZoomOut} disabled={zoomLevel <= ZOOM_MIN} aria-label="화면 줄이기">
                    −
                  </button>
                  <button
                    type="button"
                    className={`zoom-val${zoomLevel !== 100 ? ' changed' : ''}`}
                    onClick={handleZoomReset}
                    title="100%로 되돌리기"
                    aria-label={`현재 ${zoomLevel}%, 누르면 100%로 되돌리기`}
                  >
                    {zoomLevel}%
                  </button>
                  <button type="button" onClick={handleZoomIn} disabled={zoomLevel >= ZOOM_MAX} aria-label="화면 키우기">
                    +
                  </button>
                </div>
              )}
            </div>
            <span
              className="ic-btn"
              onClick={() => {
                const initialSel: Record<number, boolean> = {};
                recipes.forEach((r) => (initialSel[r.id] = true));
                setExportSelected(initialSel);
                setExportOpen(true);
              }}
              title="레시피 내보내기"
            >
              <DownloadIcon />
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main>
        {editingRecipe ? (
          /* =========================================================
              SCREEN 2: RECIPE EDITOR
             ========================================================= */
          <div className="recipe-edit-container">
            {/* 상단 뒤로가기(취소) 버튼 */}
            <div style={{ marginBottom: '16px', marginTop: '12px' }}>
              <button
                type="button"
                className="ic"
                onClick={() => goBack(() => setEditingRecipe(null))}
                title="수정 취소"
              >
                <BackIcon />
              </button>
            </div>
            <form
              className="recipe-editor-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditor(e.currentTarget);
              }}
            >
              <label className="fl">대표 사진</label>
              {editingRecipe.img && (
                <img
                  src={editingRecipe.img}
                  alt="미리보기"
                  style={{
                    width: '100%',
                    maxHeight: '220px',
                    objectFit: 'cover',
                    borderRadius: '20px',
                    marginBottom: '8px',
                  }}
                />
              )}
              <div className="row">
                <label className="bt o" htmlFor="ec" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <CameraIcon />
                  사진 찍기
                </label>
                <label className="bt o" htmlFor="eg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <GalleryIcon />
                  갤러리 선택
                </label>
              </div>
              <input id="ec" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
              <input id="eg" type="file" accept="image/*" hidden onChange={handlePhotoUpload} />

              <label className="fl">요리명</label>
              <input name="name" defaultValue={editingRecipe.name || ''} placeholder="요리 이름" />

              <label className="fl">카테고리</label>
              <select name="cat" defaultValue={editingRecipe.cat || ''}>
                {!CATS.includes(editingRecipe.cat || '') && (
                  <option value={editingRecipe.cat || ''}>{editingRecipe.cat || '카테고리 선택'}</option>
                )}
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label className="fl">기준 인분 (재료 분량이 몇 인분 기준인지)</label>
              <input name="serv" type="number" min={1} defaultValue={editingRecipe.serv || 2} />

              <label className="fl" htmlFor="editor-ingredients">재료</label>
              <textarea
                id="editor-ingredients"
                name="ing"
                rows={5}
                defaultValue={LI(editingRecipe.ing || '').join('\n')}
                placeholder="예: 돼지고기 300g, 양파 1/2개"
              />

              <label className="fl" htmlFor="editor-seasonings">양념장</label>
              <textarea
                id="editor-seasonings"
                name="sau"
                rows={4}
                defaultValue={LI(editingRecipe.sau || '').join('\n')}
                placeholder="예: 간장 2큰술, 고춧가루 1큰술"
              />
              <label className="fl">조리 순서 (한 줄에 한 단계 · 앞에 02:10 처럼 시간 표기 가능)</label>
              <textarea name="steps" id="e6" defaultValue={editingRecipe.steps || ''} />

              <label className="fl">나만의 요리 팁</label>
              <textarea name="tip" id="e7" defaultValue={editingRecipe.tip || ''} />

              <label className="fl">원본 영상 링크</label>
              <input name="url" defaultValue={editingRecipe.url || ''} placeholder="https://..." />

              <button type="submit" className="bt" style={{ marginTop: '20px' }}>
                저장
              </button>
            </form>
          </div>
        ) : viewRecipeId && currentViewingRecipe ? (
          /* =========================================================
              SCREEN 3: RECIPE DETAIL VIEW
             ========================================================= */
          <div className="recipe-detail">
            {/* 1. 상단 바: 뒤로가기 버튼 + [기존 유지] 하트 & 수정/삭제 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '12px' }}>
              {/* 왼쪽: 뒤로가기 버튼 */}
              <button
                type="button"
                className="ic"
                onClick={() => goBack(() => setViewRecipeId(null))}
                title="뒤로가기"
              >
                <BackIcon />
              </button>

              {/* 오른쪽: 기존에 있던 즐겨찾기, 수정, 삭제 버튼 (유지) */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="ic"
                  style={{ color: currentViewingRecipe.fav ? 'var(--or)' : '#80766a', background: 'var(--cd)' }}
                  onClick={(e) => toggleFav(currentViewingRecipe.id, e)}
                  title="즐겨찾기"
                >
                  <HeartIcon filled={!!currentViewingRecipe.fav} />
                </button>
                <button
                  type="button"
                  className="ic"
                  style={{ background: 'var(--cd)' }}
                  onClick={() => setEditingRecipe({ ...currentViewingRecipe })}
                  title="레시피 수정"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className={`ic ${deleteConfirmId === currentViewingRecipe.id ? 'rd' : ''}`}
                  style={{ background: deleteConfirmId === currentViewingRecipe.id ? '#e5484d' : 'var(--cd)' }}
                  onClick={() => handleDelete(currentViewingRecipe.id)}
                  title="레시피 삭제"
                >
                  {deleteConfirmId === currentViewingRecipe.id ? '삭제 확인' : <TrashIcon />}
                </button>
              </div>
            </div>

            {/* 2. 사진 (hero) 영역 - 사진 위에는 버튼 없음 */}
            <div className="hero">
              {isPlayingVideo && extractYtId(currentViewingRecipe.url) ? (
                <iframe
                  id="yp"
                  src={`https://www.youtube.com/embed/${extractYtId(currentViewingRecipe.url)}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`}
                  title={currentViewingRecipe.name}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    border: 0,
                  }}
                />
              ) : (
                <>
                  {currentViewingRecipe.img || extractYtId(currentViewingRecipe.url) ? (
                    <img
                      src={
                        currentViewingRecipe.src === 'sns' && extractYtId(currentViewingRecipe.url)
                          ? getYtThumbnail(extractYtId(currentViewingRecipe.url))
                          : currentViewingRecipe.img || getYtThumbnail(extractYtId(currentViewingRecipe.url))
                      }
                      alt={currentViewingRecipe.name}
                      className="pi"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                      onError={(e) => {
                        const image = e.target as HTMLImageElement;
                        const ytId = extractYtId(currentViewingRecipe.url);
                        if (ytId && !image.src.includes('/mqdefault.jpg')) {
                          image.src = getYtThumbnail(ytId, 'mqdefault');
                          return;
                        }
                        image.style.display = 'none';
                        const parent = image.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.hero-fallback-emoji') as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }
                      }}
                    />
                  ) : null}
                  <span
                    className="hero-fallback-emoji"
                    style={{
                      display: currentViewingRecipe.img || extractYtId(currentViewingRecipe.url) ? 'none' : 'block',
                    }}
                  >
                    {getEmoji(currentViewingRecipe.cat)}
                  </span>
                  {extractYtId(currentViewingRecipe.url) && (
                    <button
                      type="button"
                      className="play"
                      onClick={() => setIsPlayingVideo(true)}
                      title="영상 재생"
                    >
                      ▶
                    </button>
                  )}
                </>
              )}
            </div>

            {currentViewingRecipe.url && (
              <a
                className="s"
                href={currentViewingRecipe.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: '10px', color: 'var(--or)', fontWeight: 600 }}
              >
                원본 유튜브 영상에서 열기 ↗
              </a>
            )}

            <div className="rcp">
              <h2 className="title">{currentViewingRecipe.name}</h2>
              <div className="metabar">
                <p className="meta">
                  {catLabel(currentViewingRecipe.cat)} · {SL[currentViewingRecipe.src] || '레시피'}
                  {currentViewingRecipe.difficulty ? ` · 난이도 ${currentViewingRecipe.difficulty}` : ''}
                </p>
              </div>

              {/* 3. 재료 영역 (내용이 있을 때만 헤더와 인분 조절 표시) */}
              {(LI(currentViewingRecipe.ing).length > 0 || LI(currentViewingRecipe.sau).length > 0) && (
                <>
                  <div className="ingredient-head">
                    <h3 className="ingredient-heading">재료</h3>
                    <button
                      type="button"
                      className="ingredient-toggle-btn"
                      onClick={() => setIsIngredientsOpen((prev) => !prev)}
                    >
                      {isIngredientsOpen ? '숨기기 ▴' : '펼치기 ▾'}
                    </button>
                  </div>

                  <div className="serv-bar">
                    <span className="base-servings">
                      기준 {currentViewingRecipe.serv || 2}인분
                      {servings !== (currentViewingRecipe.serv || 2) && ` · 현재 ×${+(servings / (currentViewingRecipe.serv || 2)).toFixed(2)}`}
                    </span>
                  </div>

                  {isIngredientsOpen && (
                    <div className="ingredient-groups">
                      {[
                        { title: '재료', lines: LI(currentViewingRecipe.ing) },
                        { title: '양념장', lines: LI(currentViewingRecipe.sau) },
                      ].filter((group) => group.lines.length > 0).map((group, groupIdx) => (
                        <section className="ingredient-group" key={group.title}>
                          <div className="ingredient-group-head">
                            <h4 className="ingredient-group-title">{group.title}</h4>
                            {groupIdx === 0 && (
                              <div className="stepper">
                                <button type="button" onClick={() => setServings((n) => Math.max(1, n - 1))}>−</button>
                                <span id="sgn">{servings}인분</span>
                                <button type="button" onClick={() => setServings((n) => Math.min(20, n + 1))}>+</button>
                              </div>
                            )}
                          </div>
                          <div className="ingredient-list">
                            {group.lines.map((line, idx) => {
                              const ingredient = splitIngredientLine(line);
                              const factor = servings / (currentViewingRecipe.serv || 2);
                              const amount = scaleIngredientAmount(ingredient.amount, factor);
                              const amountParts = amount.match(/^(약\s*)?([0-9./½¼¾~-]+)\s*(.*)$/);
                              return (
                                <div key={`${group.title}-${idx}`} className="ing">
                                  <span className="tile">{getIngredientIcon(ingredient.name)}</span>
                                  <span className="nm">{ingredient.name}</span>
                                  {amount && (
                                    <span className="a">
                                      {amountParts ? `${amountParts[1] || ''}${amountParts[2]}` : amount}
                                      {amountParts?.[3] && <small>{amountParts[3]}</small>}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Steps (조리 순서가 존재할 때만 제목 표시) */}
              {L(currentViewingRecipe.steps).length > 0 && (
                <>
                  <h3>조리 순서</h3>
                  {currentViewingRecipe.url &&
                    L(currentViewingRecipe.steps).some((x) => TS.test(x.replace(/^\s*\d+\s*[.)]\s*/, ''))) && (
                      <p className="hint">시간이 표시된 단계를 누르면 영상이 그 구간으로 이동해요</p>
                    )}

                  {L(currentViewingRecipe.steps).map((step, idx) => {
                    const normalizedStep = step.replace(/^\s*\d+\s*[.)]\s*/, '');
                    const timeMatch = normalizedStep.match(TS);
                    const timeStr = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '';
                    const cleanStep = timeMatch ? timeMatch[3] : normalizedStep;
                    const totalSec = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : 0;
                    const videoTimestampUrl = currentViewingRecipe.url
                      ? `${currentViewingRecipe.url}${currentViewingRecipe.url.includes('?') ? '&' : '?'}t=${totalSec}`
                      : '';

                    return (
                      <div
                        key={idx}
                        className="card step"
                        style={{ cursor: timeMatch ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (timeMatch) {
                            const totalSec = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
                            const iframe = document.getElementById('yp') as HTMLIFrameElement;
                            if (iframe && iframe.contentWindow) {
                              iframe.contentWindow.postMessage(
                                JSON.stringify({ event: 'command', func: 'seekTo', args: [totalSec, true] }),
                                '*'
                              );
                              iframe.contentWindow.postMessage(
                                JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                                '*'
                              );
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else if (currentViewingRecipe.url) {
                              window.open(
                                `${currentViewingRecipe.url}${currentViewingRecipe.url.includes('?') ? '&' : '?'}t=${totalSec}`,
                                '_blank'
                              );
                            }
                          }
                        }}
                      >
                        <b className="num">{idx + 1}</b>
                        <div className="sb">
                          {timeStr && (videoTimestampUrl ? (
                            <a
                              className="chip"
                              href={videoTimestampUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              ▶ {timeStr}
                            </a>
                          ) : <span className="chip">{timeStr}</span>)}
                          <p>{cleanStep}</p>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Tips (요리 팁이 존재할 때만 제목 및 카드 표시) */}
              {currentViewingRecipe.tip && (
                <>
                  <h3>나만의 팁</h3>
                  <div className="card tip">
                    {currentViewingRecipe.tip}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : deleteMode ? (
          /* =========================================================
              SCREEN: RECIPE DELETE (선택 삭제)
             ========================================================= */
          <div className="delete-page">
            <div style={{ marginBottom: '16px', marginTop: '12px' }}>
              <button
                type="button"
                className="ic"
                onClick={() => goBack(() => setDeleteMode(false))}
                title="뒤로가기"
              >
                <BackIcon />
              </button>
            </div>
            <h2>레시피 삭제</h2>
            <p className="s exp-subtitle">삭제할 레시피를 선택해 주세요.</p>

            <div className="exp-selectbar">
              <button
                type="button"
                className={`exp-selectall${allDeleteSelected ? ' on' : ''}`}
                onClick={toggleAllDelete}
              >
                {allDeleteSelected ? '전체 해제' : '전체 선택'}
              </button>
              <span className="exp-count">{deleteCount}개 선택</span>
            </div>

            <div className="del-list">
              {recipes.length > 0 ? (
                recipes.map((r) => (
                  <label key={r.id} className={`exp-item${deleteSelected[r.id] ? ' done' : ''}`}>
                    <span className="exp-box">
                      <input
                        className="exp-check"
                        type="checkbox"
                        checked={!!deleteSelected[r.id]}
                        onChange={(e) => toggleDeleteItem(r.id, e.target.checked)}
                      />
                      <svg className="exp-check-icon" width="20px" height="20px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
                        <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                      </svg>
                    </span>
                    <span className="exp-name">{r.name}</span>
                    <span className="exp-category">{catLabel(r.cat)}</span>
                  </label>
                ))
              ) : (
                <p className="s" style={{ textAlign: 'center', marginTop: '30px' }}>
                  삭제할 레시피가 없어요.
                </p>
              )}
            </div>

            <button
              type="button"
              className="bt del-confirm-btn"
              disabled={deleteCount === 0}
              onClick={deleteSelectedRecipes}
            >
              {deleteArmed ? `${deleteCount}개 삭제 확인 (한 번 더 누르세요)` : `${deleteCount}개 삭제`}
            </button>
          </div>
        ) : tab === 'home' ? (
          /* =========================================================
              SCREEN 4: HOME TAB
             ========================================================= */
          <div className="home-screen">
            <p className="hi">좋은 하루예요 👋</p>
            <div className="hd">
              오늘은 어떤 <em>요리</em>를<br />
              해볼까요?
            </div>

            {/* Search Input */}
            <div className="sb">
              <i aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg></i>
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setSelectedCat('');
                    setSelectedFilter('');
                    setTab('my');
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>

            {/* Categories */}
            <h3 style={{ marginTop: '28px' }}>카테고리</h3>
            <div className="cats">
              <button
                className="ct"
                onClick={() => {
                  setSelectedCat('');
                  setSearchQuery(''); // 검색어 초기화
                  setTab('my');
                }}
              >
                <span className="cat-icon">📖</span>
                <span className="cat-label">전체</span>
              </button>
              {CATS.map((c, i) => (
                <button
                  key={c}
                  className="ct"
                  onClick={() => {
                    setSelectedCat(c);
                    setTab('my');
                  }}
                >
                  <span className="cat-icon">{EMJ[i]}</span>
                  <span className="cat-label">{c}</span>
                </button>
              ))}
            </div>

            {/* Recent Recipes */}
            <div className="recent-heading">
              <h3>최근 레시피</h3>
              <span>{recentRecipes.length}개 저장됨</span>
            </div>

            <div className="hs">
              {recentRecipes.length > 0 ? (
                recentRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="pc"
                    onClick={() => setViewRecipeId(r.id)}
                  >
                    <div className="ph">
                      {renderThumbnail(r, 'ph-inner')}
                      <span
                        className="hr"
                        onClick={(e) => toggleFav(r.id, e)}
                        style={{ color: r.fav ? 'var(--or)' : '#80766a' }}
                      >
                        <HeartIcon filled={!!r.fav} />
                      </span>
                    </div>

                    <div className="nm">
                      <div>{r.name}</div>
                      <div className="s">{catLabel(r.cat)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="s">레시피가 없어요</p>
              )}
            </div>

            {/* Favorites */}
            <h3>즐겨찾기</h3>
            {favoriteRecipes.length > 0 ? (
              <div className="hs">
                {favoriteRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="pc"
                    onClick={() => setViewRecipeId(r.id)}
                  >
                    <div className="ph">
                      {renderThumbnail(r, 'ph-inner')}
                      <span
                        className="hr"
                        onClick={(e) => toggleFav(r.id, e)}
                        style={{ color: r.fav ? 'var(--or)' : '#80766a' }}
                      >
                        <HeartIcon filled={!!r.fav} />
                      </span>
                    </div>
                    <div className="nm">
                      <div>{r.name}</div>
                      <div className="s">{catLabel(r.cat)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="s">♡를 눌러 즐겨찾기에 추가해요</p>
            )}
          </div>
        ) : tab === 'my' ? (
          /* =========================================================
              SCREEN 5: MY RECIPE NOTES TAB
             ========================================================= */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '5px 0 15px' }}>
              <h2 style={{ margin: 0 }}>요리 노트</h2>
              <button
                type="button"
                className="circ"
                aria-label={selectedFilter === '즐겨찾기' ? '전체 레시피 보기' : '즐겨찾기만 보기'}
                aria-pressed={selectedFilter === '즐겨찾기'}
                onClick={() => setSelectedFilter((curr) => (curr === '즐겨찾기' ? '' : '즐겨찾기'))}
                style={{ color: selectedFilter === '즐겨찾기' ? 'var(--or)' : '#80766a', fontSize: '24px' }}
              >
                <HeartIcon filled={selectedFilter === '즐겨찾기'} />
              </button>
            </div>
            <input
              placeholder="요리명 또는 재료 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {/* Category Chips: 1단 가로 슬라이드 */}
            <div className="chip-scroll">
              <button
                className={`ch ${selectedCat === '' ? 'on' : ''}`}
                onClick={() => setSelectedCat('')}
              >
                전체
              </button>
              {CATS.map((c) => (
                <button
                  key={c}
                  className={`ch ${selectedCat === c ? 'on' : ''}`}
                  onClick={() => setSelectedCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* 레시피 개수(왼쪽) · 삭제 버튼(오른쪽) */}
            <div className="note-meta">
              <span className="note-count">레시피 {filteredRecipes.length}개</span>
              <button
                type="button"
                className="note-del-btn"
                onClick={openDeletePage}
                disabled={recipes.length === 0}
              >
                삭제
              </button>
            </div>

            {/* Recipe List Cards */}
            <div className="recipe-note-list">
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="lc"
                    onClick={() => setViewRecipeId(r.id)}
                  >
                    {renderThumbnail(r, 'ph')}
                    <div className="nm">
                      <div>{r.name}</div>
                      <div className="s">
                        {catLabel(r.cat)} · {SL[r.src] || ''}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="s" style={{ textAlign: 'center', marginTop: '30px' }}>
                  등록된 레시피가 없어요.
                </p>
              )}
            </div>
          </div>
        ) : tab === 'imp' ? (
          /* =========================================================
              SCREEN 6: ADD RECIPE (SNS / PHOTO / MANUAL)
             ========================================================= */
          <div>
            {!imp ? (
              <div>
                <h2>레시피 추가</h2>

                <div className="recipe-choice-list">
                  <div className="cd mc recipe-choice" onClick={() => setImp('my')}>
                    <span className="mi">✏️</span>
                    <div className="recipe-choice-copy">
                      <b>직접 작성</b>
                      <div className="s">대충 적어도 AI가 깔끔하게 정리해줘요.</div>
                    </div>
                  </div>
                  <div className="cd mc recipe-choice" onClick={() => setImp('sns')}>
                    <span className="mi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <YouTubeicon />
                    </span>

                    <div className="recipe-choice-copy">
                      <b>SNS 링크로 가져오기</b>
                      <div className="s">유튜브 링크를 넣으면 AI가 레시피를 요약해줘요.</div>
                    </div>
                  </div>

                  <div className="cd mc recipe-choice" onClick={() => setImp('photo')}>
                    <span className="mi">📷</span>
                    <div className="recipe-choice-copy">
                      <b>사진으로 등록</b>
                      <div className="s">사진을 업로드하면 AI가 레시피를 완성해 줘요.</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : imp === 'sns' ? (
              /* CORE CHANGED COMPONENT: SNS RECIPE EXTRACTOR */
              <div>
                {/* 상단 뒤로가기 버튼 */}
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="ic"
                    onClick={() => {
                      setSnsUrl('');
                      setSnsMessage('');
                      goBack(() => setImp(''));
                    }}
                    title="뒤로가기"
                  >
                    <BackIcon />
                  </button>
                </div>
                <h2>SNS 링크로 가져오기</h2>

                <input
                  id="u"
                  value={snsUrl}
                  onChange={(e) => setSnsUrl(e.target.value)}
                  placeholder="유튜브 영상 또는 쇼츠 링크 붙여넣기"
                  disabled={snsLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExtractSns();
                  }}
                />

                <p className="s" style={{ margin: '20px 0 40px', lineHeight: 1.5 }}>
                  유튜브 영상의 <b>더보기란 설명과 영상 정보</b>를 AI가 정밀 분석해 재료, 양념 비율, 조리 순서(타임스탬프), 꿀팁까지 자동으로 요약 정리해 드립니다.
                </p>

                <button
                  className="bt"
                  style={{ marginTop: '8px' }}
                  disabled={snsLoading}
                  onClick={() => handleExtractSns()}
                >
                  {snsLoading ? '유튜브 영상 분석 및 요약 중... ⏳' : '레시피 가져오기'}
                </button>

                {snsMessage && (
                  <p
                    id="ms"
                    className="s"
                    style={{
                      marginTop: '12px',
                      color: snsLoading ? 'var(--or)' : 'var(--tx)',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {snsMessage}
                  </p>
                )}
              </div>
            ) : imp === 'my' ? (
              /* Direct Manual Entry */
              <div>
                {/* 상단 뒤로가기 버튼 */}
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="ic"
                    onClick={() => goBack(() => setImp(''))}
                    title="뒤로가기"
                  >
                    <BackIcon />
                  </button>
                </div>

                <h2>직접 작성</h2>

                <input
                  id="d"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="레시피 이름 (예: 우리집 김치찌개)"
                />

                <label className="fl" htmlFor="direct-ingredients">재료</label>
                <textarea
                  id="direct-ingredients"
                  rows={5}
                  value={draftIngredients}
                  onChange={(e) => setDraftIngredients(e.target.value)}
                  placeholder="예: 돼지고기 300g, 양파 1/2개"
                />

                <label className="fl" htmlFor="direct-seasonings">양념장</label>
                <textarea
                  id="direct-seasonings"
                  rows={4}
                  value={draftSeasonings}
                  onChange={(e) => setDraftSeasonings(e.target.value)}
                  placeholder="예: 간장 2큰술, 고춧가루 1큰술"
                />

                <label className="fl" htmlFor="direct-steps">만드는 순서</label>
                <textarea
                  id="direct-steps"
                  rows={5}
                  value={draftSteps}
                  onChange={(e) => setDraftSteps(e.target.value)}
                  placeholder="한 줄에 한 단계씩 적어 주세요."
                />

                <label className="fl" htmlFor="direct-tip">요리 팁 (선택)</label>
                <textarea
                  id="direct-tip"
                  value={draftTip}
                  onChange={(e) => setDraftTip(e.target.value)}
                  placeholder="보관 방법이나 맛있게 만드는 팁을 적어 주세요."
                />

                <label className="fl">대표 사진 (선택)</label>
                <div className="row">
                  <label className="bt o" htmlFor="my_fc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <CameraIcon />
                    사진 찍기
                  </label>
                  <label className="bt o" htmlFor="my_fg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <GalleryIcon />
                    갤러리 선택
                  </label>
                </div>
                <input id="my_fc" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
                <input id="my_fg" type="file" accept="image/*" hidden onChange={handlePhotoUpload} />

                {previewPhoto && (
                  <img
                    src={previewPhoto}
                    alt="미리보기"
                    style={{
                      width: '100%',
                      maxHeight: '220px',
                      objectFit: 'cover',
                      borderRadius: '20px',
                      margin: '8px 0',
                    }}
                  />
                )}

                <button className="bt" style={{ marginTop: '14px' }} onClick={handleSaveDirect}>
                  저장하기
                </button>
              </div>
            ) : imp === 'photo' ? (
              /* Photo Register Entry */
              <div>
                {/* 상단 뒤로가기 버튼 */}
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="ic"
                    onClick={() => goBack(() => setImp(''))}
                    title="뒤로가기"
                  >
                    <BackIcon />
                  </button>
                </div>
                <h2>사진으로 등록</h2>
                <div className="row">
                  <label className="bt o" htmlFor="p_fc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <CameraIcon /> 사진 찍기
                  </label>
                  <label className="bt o" htmlFor="p_fg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <GalleryIcon /> 갤러리 선택
                  </label>
                </div>
                <input id="p_fc" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
                <input id="p_fg" type="file" accept="image/*" hidden onChange={handlePhotoUpload} />

                {previewPhoto ? (
                  <>
                    <img
                      src={previewPhoto}
                      alt="선택한 레시피 사진"
                      style={{ width: '100%', maxHeight: '260px', borderRadius: '16px', margin: '8px 0', objectFit: 'cover' }}
                    />
                    <button className="bt o" type="button" style={{ marginTop: '10px' }} onClick={handleRecognizePhoto} disabled={ocrLoading}>
                      {ocrLoading ? 'AI가 사진 내용을 정리하는 중…' : '✨ AI로 사진 레시피 정리'}
                    </button>
                    <p className="s" style={{ marginTop: '6px' }}>AI가 정리한 내용을 아래에 채웠어요.<br/> 저장 전에 확인하고 수정해 주세요.</p>
                    {photoAiError && <p role={'alert'} className={'s'} style={{ color: '#c62828', overflowWrap: 'anywhere' }}>AI 오류: {photoAiError}</p>}
                    <label className="fl" htmlFor="photo-title">요리명</label>
                    <input id="photo-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="예: 된장찌개" />

                    <label className="fl" htmlFor="photo-ingredients">재료</label>
                    <textarea
                      id="photo-ingredients"
                      rows={5}
                      value={draftIngredients}
                      onChange={(e) => setDraftIngredients(e.target.value)}
                      placeholder="예: 돼지고기 300g, 양파 1/2개"
                    />

                    <label className="fl" htmlFor="photo-seasonings">양념장</label>
                    <textarea
                      id="photo-seasonings"
                      rows={4}
                      value={draftSeasonings}
                      onChange={(e) => setDraftSeasonings(e.target.value)}
                      placeholder="예: 간장 2큰술, 고춧가루 1큰술"
                    />

                    <label className="fl" htmlFor="photo-steps">만드는 순서</label>
                    <textarea id="photo-steps" value={draftSteps} onChange={(e) => setDraftSteps(e.target.value)} placeholder="한 줄에 한 단계씩 적어 주세요." />

                    <label className="fl" htmlFor="photo-tip">요리 팁 (선택)</label>
                    <textarea id="photo-tip" value={draftTip} onChange={(e) => setDraftTip(e.target.value)} placeholder="사진에 적힌 팁이나 나만의 팁을 적어 주세요." />

                    <button className="bt" style={{ marginTop: '14px' }} onClick={handleSaveDirect}>사진과 함께 레시피 등록</button>
                  </>
                ) : (
                  <p className="s" style={{ marginTop: '28px' }}>사진을 고른 뒤 AI 정리 버튼을 누르면 레시피 항목으로 정리돼요.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : tab === 'ai' ? (
          /* =========================================================
              SCREEN 7: AI CHEF CONSULTATION
             ========================================================= */
          <div>
            {/* 상단 뒤로가기 버튼 */}
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className="ic"
                onClick={() => goBack(() => setImp(''))}
                title="뒤로가기"
              >
                <BackIcon />
              </button>
            </div>
            <h2>AI 셰프</h2>
            <select
              value={curChefRecipeId}
              onChange={(e) => setCurChefRecipeId(Number(e.target.value) || '')}
            >
              <option value="">현재 레시피 없음 (일반 질문)</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <div style={{ margin: '12px 0' }}>
              {[
                '고기가 질긴데 어떻게 해야 할까?',
                '간장을 너무 많이 넣었어',
                '설탕 대신 올리고당 써도 될까?',
                '4인분을 2인분으로 줄여줘',
              ].map((t) => (
                <button
                  key={t}
                  className="ch"
                  onClick={() => handleAskChef(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ minHeight: '120px' }}>
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`bb ${m.role}`}>
                  {m.content}
                </div>
              ))}
              {chefLoading && (
                <div className="bb assistant">
                  생각 중… 🍳
                </div>
              )}
            </div>

            <div className="row" style={{ marginTop: '14px' }}>
              <input
                id="qi"
                value={chefInput}
                onChange={(e) => setChefInput(e.target.value)}
                placeholder="질문을 입력하세요"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAskChef();
                }}
              />
              <button
                className="bt"
                style={{ width: '90px', flex: 'none' }}
                onClick={() => handleAskChef()}
                disabled={chefLoading}
              >
                전송
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Floating Bottom Navigation */}
      {!editingRecipe && !deleteMode && (
        <nav>
          {[
            ['home', './nav-icons/home.png', '홈'],
            ['imp', './nav-icons/add-recipe.png', '레시피 추가'],
            ['my', './nav-icons/notes.png', '요리 노트'],
          ].map(([k, icon, title]) => (
            <button
              key={k}
              className={tab === k ? 'on' : ''}
              aria-label={title}
              title={title}
              onClick={() => {
                scrollToTop();
                setViewRecipeId(null);
                setTab(k as any);
                setImp('');
                setSearchQuery(''); // 다른 탭 클릭 시 검색어 초기화
                setSelectedCat(''); // 요리 노트 카테고리는 항상 '전체'로 초기화
                setDeleteMode(false);
                setSnsUrl('');
                setSnsMessage('');
              }}
            >
              <span
                className="nav-icon"
                aria-hidden="true"
                style={{ WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` }}
              />
              {title}
            </button>
          ))}
        </nav>
      )}

      {/* AI 분석 중 모달 (유튜브 영상 / 사진 정리) */}
      {snsLoading && <AiLoadingModal title="AI가 영상을 분석하고 있어요..." steps={AI_SNS_STEPS} />}
      {ocrLoading && <AiLoadingModal title="AI가 사진을 정리하고 있어요..." steps={AI_PHOTO_STEPS} />}

      {/* Export Modal */}
      {exportOpen && (
        <div
          className="mdl-bg"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeExport();
          }}
        >
          <div className="mdl">
            <div className="mdl-h">
              <b> 레시피 내보내기</b>
              <button className="mdl-close" onClick={() => closeExport()}>
                ✕
              </button>
            </div>
            <p className="s exp-subtitle">
              내보낼 레시피를 고른 뒤,<br/>텍스트 파일(.txt)로 저장하거나 복사하세요.
            </p>

            <div className="exp-selectbar">
              <button
                className={`exp-selectall${recipes.length > 0 && recipes.every((r) => exportSelected[r.id]) ? ' on' : ''}`}
                onClick={toggleAllExport}
              >
                {recipes.length > 0 && recipes.every((r) => exportSelected[r.id])
                  ? '전체 해제'
                  : '전체 선택'}
              </button>
              <span className="exp-count">{recipes.filter((r) => exportSelected[r.id]).length}개 선택</span>
            </div>

            <div className="exp-list">
              {recipes.map((r) => (
                <label key={r.id} className={`exp-item${exportSelected[r.id] ? ' done' : ''}`}>
                  <span className="exp-box">
                    <input
                      className="exp-check"
                      type="checkbox"
                      checked={!!exportSelected[r.id]}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setExportSelected((prev) => ({ ...prev, [r.id]: checked }));
                      }}
                    />
                    <svg className="exp-check-icon" width="20px" height="20px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
                      <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  </span>
                  <span className="exp-name">{r.name}</span>
                  <span className="exp-category">{catLabel(r.cat)}</span>
                </label>
              ))}
            </div>

            <div className="exp-actions">
              <button
                className="exp-action exp-copy"
                onClick={copyRecipes}
              >
                복사하기
              </button>
              <button
                className="exp-action exp-share"
                onClick={saveAsTextFile}
              >
                텍스트 파일로 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastText && <div className="toast">{toastText}</div>}
    </div>
  );
}
