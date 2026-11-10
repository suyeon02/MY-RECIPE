import { createWorker } from 'tesseract.js';

export interface OrganizedRecipeText {
  title: string;
  ingredients: string;
  seasonings: string;
  steps: string;
  tip: string;
  recognizedCount: number;
}

export function organizeOcrText(rawText: string): OrganizedRecipeText {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•·▪●○◆◇▶▷-]+/, '').trim())
    .filter(Boolean);
  const result = {
    title: '',
    ingredients: [] as string[],
    seasonings: [] as string[],
    steps: [] as string[],
    tip: [] as string[],
  };
  let section: 'unknown' | 'ingredients' | 'seasonings' | 'steps' | 'tip' = 'unknown';
  let foundHeadings = false;

  const getHeading = (line: string) => {
    const value = line.replace(/[\[\]【】()]/g, '').replace(/[:：]$/, '').trim();
    if (/^(재료|재료와 분량|재료 및 분량|준비 재료|주재료|부재료)$/.test(value)) return 'ingredients';
    if (/^(양념|양념장|소스|양념 및 분량)$/.test(value)) return 'seasonings';
    if (/^(만드는 법|만드는 방법|만드는 순서|조리 순서|조리법|조리 방법|조리과정|조리 과정)$/.test(value)) return 'steps';
    if (/^(팁|요리 팁|조리 팁|참고|참고 사항)$/.test(value)) return 'tip';
    return '';
  };

  for (const line of lines) {
    const heading = getHeading(line);
    if (heading) {
      section = heading as typeof section;
      foundHeadings = true;
      continue;
    }
    if (!result.title && section === 'unknown' && line.length <= 36 && !/[0-9]{2,}/.test(line)) {
      result.title = line;
      continue;
    }
    if (section !== 'unknown') result[section].push(line);
  }

  if (!foundHeadings) {
    const content = lines.filter((line) => line !== result.title);
    const stepPattern = /(?:^\d+[.)、]|(?:넣고|넣은 뒤|끓|볶|섞|썰|굽|익혀|저어|뒤집|삶|데치|손질|담아|완성|조리한다|만든다))/;
    const seasoningPattern = /(?:간장|고추장|된장|고춧가루|소금|설탕|다진 마늘|마늘|참기름|식초|맛술|후추|액젓|올리고당|물엿|케첩|마요네즈)/;
    for (const line of content) {
      if (stepPattern.test(line)) result.steps.push(line.replace(/^\d+[.)、]\s*/, ''));
      else if (seasoningPattern.test(line)) result.seasonings.push(line);
      else result.ingredients.push(line);
    }
  } else if (!result.ingredients.length && !result.seasonings.length && !result.steps.length && !result.tip.length) {
    result.ingredients = lines.filter((line) => line !== result.title);
  }

  return {
    title: result.title,
    ingredients: result.ingredients.join('\n'),
    seasonings: result.seasonings.join('\n'),
    steps: result.steps.join('\n'),
    tip: result.tip.join('\n'),
    recognizedCount: result.ingredients.length + result.seasonings.length + result.steps.length + result.tip.length,
  };
}

export async function recognizeRecipeImage(image: string, onProgress: (progress: number) => void) {
  const worker = await createWorker(['kor', 'eng'], 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress(Math.round((message.progress || 0) * 100));
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return organizeOcrText(data.text || '');
  } finally {
    await worker.terminate();
  }
}
