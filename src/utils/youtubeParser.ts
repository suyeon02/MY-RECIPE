/**
 * YouTube and Video URL parsing utilities
 */

/**
 * Extract YouTube 11-char video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=kYJpA7b5bW4
 * - https://youtu.be/kYJpA7b5bW4
 * - https://www.youtube.com/shorts/kYJpA7b5bW4
 * - https://m.youtube.com/watch?v=kYJpA7b5bW4
 * - youtu.be/kYJpA7b5bW4?si=abc
 */
export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Get YouTube standard thumbnail URL
 */
export function getYoutubeThumbnail(url: string | null | undefined): string | null {
  const id = extractYoutubeId(url);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Check if a URL looks like an SNS/video link (YouTube, Instagram, TikTok, etc.)
 */
export function isSnsOrVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /youtu|instagram\.com|tiktok\.com|naver\.com|daum\.net/i.test(url);
}

export interface ParsedStep {
  stepNumber: number;
  raw: string;
  text: string;
  timeStr: string | null;
  seconds: number | null;
  timerMinutes: number | null;
}

/**
 * Parses timestamp from a step string.
 * Supports:
 * - "02:15 양파와 대파를 썬다" -> time: 02:15 (135s)
 * - "2:15 고기를 볶는다"
 * - "10분간 끓인다" -> detects 10 min cooking timer
 */
export function parseCookingStep(line: string, index: number): ParsedStep {
  const trimmed = line.trim();
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(.*)$/);

  let timeStr: string | null = null;
  let seconds: number | null = null;
  let text = trimmed;

  if (timeMatch) {
    const mins = parseInt(timeMatch[1], 10);
    const secs = parseInt(timeMatch[2], 10);
    timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    seconds = mins * 60 + secs;
    text = timeMatch[3];
  }

  // Detect timer indication in text (e.g. "8분 볶는다", "15분간 끓인다")
  const timerMatch = text.match(/(\d+)\s*분/);
  const timerMinutes = timerMatch ? parseInt(timerMatch[1], 10) : null;

  return {
    stepNumber: index + 1,
    raw: trimmed,
    text,
    timeStr,
    seconds,
    timerMinutes,
  };
}

/**
 * Format seconds into mm:ss
 */
export function formatSecondsToTime(totalSeconds: number): string {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
