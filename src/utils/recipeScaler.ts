/**
 * Recipe ingredient and seasoning scaler utility.
 * Parses strings like "돼지고기 앞다리살 600g", "고추장 2큰술", "양파 1/2개", "소금 1꼬집"
 * and scales them proportionally based on the target servings / base servings.
 */

export interface ParsedItem {
  raw: string;
  name: string;
  amount: string;
  scaledAmount: string;
}

/**
 * Format a scaled number cleanly:
 * e.g. 1.5 -> 1.5, 2.0 -> 2, 0.5 -> 1/2 or 0.5, round high numbers
 */
export function formatScaledNumber(num: number): string {
  if (num <= 0) return '0';
  // Common fractions
  if (Math.abs(num - 0.5) < 0.01) return '1/2';
  if (Math.abs(num - 0.25) < 0.01) return '1/4';
  if (Math.abs(num - 0.75) < 0.01) return '3/4';
  if (Math.abs(num - 0.33) < 0.02) return '1/3';
  if (Math.abs(num - 0.67) < 0.02) return '2/3';

  if (num >= 10) {
    return String(Math.round(num));
  } else if (num >= 1) {
    const rounded = Math.round(num * 10) / 10;
    return String(rounded);
  } else {
    const rounded = Math.round(num * 100) / 100;
    return String(rounded);
  }
}

/**
 * Scale numbers found within an amount string (e.g. "600g", "2큰술", "1/2개", "1~2스푼")
 */
export function scaleAmountText(amountText: string, factor: number): string {
  if (factor === 1 || !amountText) return amountText;

  // Replace fraction like 1/2 or single numbers
  return amountText.replace(/([0-9]+(?:\.[0-9]+)?)(?:\/([0-9]+))?/g, (_match, numerator, denominator) => {
    const num = denominator ? (parseFloat(numerator) / parseFloat(denominator)) : parseFloat(numerator);
    if (isNaN(num)) return _match;
    const scaled = num * factor;
    return formatScaledNumber(scaled);
  });
}

/**
 * Parse an ingredient line like "돼지고기 600g" or "양파 1개" into name and amount
 */
export function parseIngredientLine(line: string, factor: number = 1): ParsedItem {
  const trimmed = line.trim();
  if (!trimmed) {
    return { raw: '', name: '', amount: '', scaledAmount: '' };
  }

  // Regex to match quantity pattern at the end of the line:
  // e.g. "돼지고기 앞다리살 600g", "대파 1/2대", "물 500ml", "진간장 2큰술"
  const match = trimmed.match(/^(.+?)\s+([0-9][0-9/.~-]*\s*[a-zA-Z가-힣%]*)$/);

  if (match) {
    const name = match[1].trim();
    const amount = match[2].trim();
    const scaled = scaleAmountText(amount, factor);
    return {
      raw: trimmed,
      name,
      amount,
      scaledAmount: scaled,
    };
  }

  // If no clear numeric amount (e.g., "소금 약간", "후추 톡톡")
  return {
    raw: trimmed,
    name: trimmed,
    amount: '',
    scaledAmount: '',
  };
}

/**
 * Scale a multiline string of ingredients or seasonings
 */
export function scaleIngredientsText(text: string, currentServings: number, baseServings: number): string {
  if (!text || currentServings === baseServings || baseServings <= 0) return text;
  const factor = currentServings / baseServings;

  return text
    .split('\n')
    .map((line) => {
      const parsed = parseIngredientLine(line, factor);
      if (parsed.amount) {
        return `${parsed.name} ${parsed.scaledAmount}`;
      }
      return line;
    })
    .join('\n');
}
