import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredientLine, scaleAmountText, formatScaledNumber, scaleIngredientsText } from './recipeScaler';

test('formatScaledNumber formats fractions and decimals cleanly', () => {
  assert.equal(formatScaledNumber(0.5), '1/2');
  assert.equal(formatScaledNumber(0.25), '1/4');
  assert.equal(formatScaledNumber(1.5), '1.5');
  assert.equal(formatScaledNumber(2), '2');
  assert.equal(formatScaledNumber(600), '600');
});

test('scaleAmountText scales amounts correctly with factor', () => {
  // Doubling (factor = 2)
  assert.equal(scaleAmountText('600g', 2), '1200g');
  assert.equal(scaleAmountText('2큰술', 2), '4큰술');
  assert.equal(scaleAmountText('1/2개', 2), '1개');
  assert.equal(scaleAmountText('1개', 2), '2개');

  // Halving (factor = 0.5)
  assert.equal(scaleAmountText('600g', 0.5), '300g');
  assert.equal(scaleAmountText('1개', 0.5), '1/2개');
  assert.equal(scaleAmountText('2큰술', 0.5), '1큰술');
});

test('parseIngredientLine separates name and quantity properly', () => {
  const parsed1 = parseIngredientLine('돼지고기 앞다리살 600g', 1.5);
  assert.equal(parsed1.name, '돼지고기 앞다리살');
  assert.equal(parsed1.amount, '600g');
  assert.equal(parsed1.scaledAmount, '900g');

  const parsed2 = parseIngredientLine('양파 1개', 2);
  assert.equal(parsed2.name, '양파');
  assert.equal(parsed2.amount, '1개');
  assert.equal(parsed2.scaledAmount, '2개');

  const parsedWithoutAmount = parseIngredientLine('후추 약간', 2);
  assert.equal(parsedWithoutAmount.name, '후추 약간');
  assert.equal(parsedWithoutAmount.amount, '');
});

test('scaleIngredientsText scales entire multiline recipe text', () => {
  const original = `돼지고기 앞다리살 600g
양파 1개
대파 1대
후추 약간`;

  const scaled = scaleIngredientsText(original, 4, 2); // 2인분 -> 4인분 (factor = 2)
  const lines = scaled.split('\n');

  assert.equal(lines[0], '돼지고기 앞다리살 1200g');
  assert.equal(lines[1], '양파 2개');
  assert.equal(lines[2], '대파 2대');
  assert.equal(lines[3], '후추 약간');
});
