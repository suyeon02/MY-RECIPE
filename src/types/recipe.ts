export type RecipeCategory = '밑반찬' | '국·찌개' | '메인 요리' | '면·분식' | '밥·죽' | '간식·디저트' | '기타';

export type RecipeSource = 'sns' | 'my' | 'photo' | 'ai';

export interface Recipe {
  id: number;
  name: string;
  cat: RecipeCategory;
  src: RecipeSource;
  url: string;
  min: number;
  serv: number;
  ing: string;
  sau: string;
  steps: string;
  tip?: string;
  summary?: string;
  difficulty?: '쉬움' | '보통' | '어려움';
  calories?: string;
  tags?: string[];
  img?: string;
  fav?: number; // 1 or 0
  cooked?: number; // timestamp
  t: number; // created timestamp
  channel?: string;
}

export interface ExtractedRecipeData {
  name: string;
  cat: RecipeCategory;
  min: number;
  serv: number;
  ing: string;
  sau: string;
  steps: string;
  tip?: string;
  summary?: string;
  difficulty?: '쉬움' | '보통' | '어려움';
  calories?: string;
  tags?: string[];
  channel?: string;
  title?: string;
}
