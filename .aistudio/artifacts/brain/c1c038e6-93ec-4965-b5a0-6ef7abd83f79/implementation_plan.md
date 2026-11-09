# 요리 시작하기 기능 제거 및 레시피 대표 사진 풀 박스(Cover) 적용

사용자가 선택한 결정에 따라 불필요한 **'요리 시작하기' 기능(타이머 및 단계별 조리 화면)**을 완전히 제거하고, 레시피 상세 화면의 상단 대표 사진 영역과 목록 카드를 **박스 전체에 여백 없이 꽉 차는 풀 블리드(Full-bleed, object-fit: cover)** 비주얼로 정돈합니다.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> 사용자가 Phase 1 질문을 통해 확정한 선택 사항입니다:
> - **요리 시작하기 기능 범위**: 상세 화면의 '🍳 요리 시작하기 (타이머 & 체크리스트)' 버튼과 단계별 타이머/체크리스트 전체화면(`cookState`)을 완전히 제거하여 간결하고 빠른 레시피 탐색 경험을 제공합니다.
> - **레시피 사진 박스 채우기 방식**: 박스 상하좌우에 빈 여백이나 레터박스가 생기지 않도록 `object-fit: cover` 및 `w-full h-full`을 적용하여 시각적으로 시원하고 완성도 높은 음식 사진을 노출합니다.

---

## 1. Overview & Core Concept

- **목적**:
  - 복잡하고 잘 쓰이지 않는 조리 모드 팝업/화면을 없애고, 본연의 레시피 확인(재료 분량 스케일링, 양념 비율, 조리 순서, 팁)에 집중하도록 UI를 단순화
  - 레시피의 시각적 매력을 극대화할 수 있도록 상단 대표 사진(유튜브 썸네일, 업로드 사진, 카테고리 테마)이 컨테이너에 빈틈없이 꽉 차도록 레이아웃 정비
- **사용자 가치**:
  - 화면 전환 없이 한눈에 들어오는 깔끔한 레시피 뷰
  - 요리 사진이 잘리거나 작게 줄어들지 않고 시각적 만족감을 주는 풀 비주얼 연출

---

## 2. User Experience & Visual Design

### A. 레시피 상세 화면 (Detail View)
1. **상단 히어로 사진 박스 (Hero Photo Box)**:
   - 높이: 260px의 안정적인 종횡비
   - 모서리: `rounded-3xl`의 부드러운 라운딩
   - 채우기: `object-fit: cover`, `width: 100%`, `height: 100%`를 적용하여 썸네일/사진이 박스 전면을 꽉 채움
   - 오버레이 액션 버튼: 우측 상단 수정(`✏️`) 및 삭제(`🗑️`) 버튼을 유리 모피즘(반투명 화이트 백드롭)으로 띄워 사진 위에서도 또렷하게 조작 가능
   - 영상 링크: 유튜브 영상이 있을 경우 하단 텍스트 링크(`원본 유튜브 영상에서 열기 ↗`)로 직관적 이동 제공
2. **요리 시작하기 버튼 제거**:
   - 기존의 커다란 오렌지색 '🍳 요리 시작하기 (타이머 & 체크리스트)' 버튼을 제거하여, 요리명과 카테고리 메타 바로 아래에서 인분 조절 스텝퍼와 재료 목록으로 자연스럽게 이어짐
   - 불필요한 스크롤이 줄어들고 재료와 양념 정보가 즉시 눈에 들어옴

### B. 조리 순서 (Cooking Steps)
- 순서 번호와 조리 단계 설명은 깔끔한 카드 형태로 유지
- 타임스탬프(`01:23`)가 있는 단계는 클릭 시 유튜브 영상으로 즉시 이동하여 필요한 구간만 빠르게 시청 가능

---

## 3. Key Product Decisions & Trade-Offs

- **결정 1: Cook Mode 상태 및 타이머 제거**
  - *선택*: `cookState`, `timerIntervalRef`, 타이머 카운트다운 관련 렌더링 코드를 정리
  - *이유*: 사용자 요구사항 충족 및 코드베이스 경량화, 모달/상태 전환 복잡도 제거
- **결정 2: 사진 표시 방식 (Cover vs Contain)**
  - *선택*: `object-fit: cover`를 사용하여 종횡비가 다른 다양한 유튜브 썸네일과 사용자 업로드 사진 모두에서 일관된 박스 채움 보장
  - *이유*: 검은색 빈 여백(pillarbox/letterbox)이 생기지 않아 세련된 모바일 푸드 매거진 느낌 부여

---

## 4. Technical Architecture & System Layout

```
┌────────────────────────────────────────────────────────┐
│                        App.tsx                         │
│                                                        │
│  State:                                                │
│  - recipes: Recipe[] (localStorage & Firebase)         │
│  - tab: 'home' | 'my' | 'imp' | 'ai'                   │
│  - viewRecipeId: number | null                         │
│  - editingRecipe: Partial<Recipe> | null               │
│  - servings: number (dynamic ingredient scaling)       │
│  - [REMOVED] cookState & timer                         │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│       Home / My Notes         │ │      RecipeDetailView         │
│                               │ │                               │
│ - Category filters            │ │ - Full-cover Hero Photo Box   │
│ - Full-fill thumbnails        │ │   (w-full h-full object-cover)│
│ - Quick SNS import CTA        │ │ - Servings Stepper (−/+)      │
│ - Instant recipe search       │ │ - Scaled Ingredients List     │
│                               │ │ - Cooking Steps & Timestamps  │
│                               │ │ - [REMOVED] Cook Mode Button  │
└───────────────────────────────┘ └───────────────────────────────┘
```

### 소스 코드 변경 대상
1. **`/src/App.tsx`**:
   - `cookState` 및 `timerIntervalRef` 상태와 타이머 `useEffect` 제거
   - `cookState` 렌더링 분기 제거
   - 레시피 상세 뷰에서 `<button className="bt">🍳 요리 시작하기...</button>` 버튼 제거
   - 상단 히어로 영역(`className="hero"`) 내부 이미지의 스타일을 `w-full h-full object-cover`로 확실하게 적용하여 박스 전체 채움 처리
   - 목록 카드(`.pc`, `.lc`) 썸네일도 빈틈없이 꽉 채워지도록 스타일 정리
2. **`/src/index.css`**:
   - `.hero`, `.hero img`, `.hero .pi`, `.ph img` 클래스의 `object-fit: cover` 및 `display: block` 스타일 보강
