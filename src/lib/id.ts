import { nanoid } from 'nanoid';

export function uid(prefix = 'id'): string {
  return `${prefix}_${nanoid(10)}`;
}

export function now(): number {
  return Date.now();
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function guessTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '新对话';
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean;
}
