import test from 'node:test';
import assert from 'node:assert/strict';
import { extractYoutubeId, getYoutubeThumbnail, parseCookingStep, formatSecondsToTime } from './youtubeParser';

test('extractYoutubeId extracts 11-char ID from all standard formats', () => {
  const watchUrl = 'https://www.youtube.com/watch?v=kYJpA7b5bW4';
  assert.equal(extractYoutubeId(watchUrl), 'kYJpA7b5bW4');

  const shortUrl = 'https://youtu.be/kYJpA7b5bW4?si=abc123';
  assert.equal(extractYoutubeId(shortUrl), 'kYJpA7b5bW4');

  const shortsUrl = 'https://www.youtube.com/shorts/kYJpA7b5bW4';
  assert.equal(extractYoutubeId(shortsUrl), 'kYJpA7b5bW4');

  const mobileUrl = 'https://m.youtube.com/watch?v=kYJpA7b5bW4&t=10s';
  assert.equal(extractYoutubeId(mobileUrl), 'kYJpA7b5bW4');

  assert.equal(extractYoutubeId('https://example.com'), null);
});

test('getYoutubeThumbnail produces correct URL', () => {
  const url = 'https://www.youtube.com/watch?v=kYJpA7b5bW4';
  assert.equal(getYoutubeThumbnail(url), 'https://i.ytimg.com/vi/kYJpA7b5bW4/hqdefault.jpg');
});

test('parseCookingStep detects timestamp and timer', () => {
  const stepWithTimestamp = parseCookingStep('02:15 센 불에서 고기를 8분간 볶는다', 0);
  assert.equal(stepWithTimestamp.stepNumber, 1);
  assert.equal(stepWithTimestamp.timeStr, '02:15');
  assert.equal(stepWithTimestamp.seconds, 135);
  assert.equal(stepWithTimestamp.timerMinutes, 8);
  assert.equal(stepWithTimestamp.text, '센 불에서 고기를 8분간 볶는다');

  const stepPlain = parseCookingStep('양파와 대파를 송송 썬다', 1);
  assert.equal(stepPlain.stepNumber, 2);
  assert.equal(stepPlain.timeStr, null);
  assert.equal(stepPlain.seconds, null);
  assert.equal(stepPlain.timerMinutes, null);
  assert.equal(stepPlain.text, '양파와 대파를 송송 썬다');
});

test('formatSecondsToTime formats correctly', () => {
  assert.equal(formatSecondsToTime(0), '00:00');
  assert.equal(formatSecondsToTime(65), '01:05');
  assert.equal(formatSecondsToTime(600), '10:00');
});
