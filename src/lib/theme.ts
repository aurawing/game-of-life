export type ThemeMode = 'dark' | 'light' | 'system';

export const THEME_LABELS: Record<ThemeMode, string> = {
  dark: '深色',
  light: '浅色',
  system: '跟随系统',
};

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'dark' || mode === 'light') return mode;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(mode: ThemeMode): 'dark' | 'light' {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a1220' : '#f3f6fb');
  return resolved;
}

export function readStoredThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem('dsh-agent-v1');
    const mode = raw ? (JSON.parse(raw) as { state?: { themeMode?: ThemeMode } }).state?.themeMode : undefined;
    if (mode === 'dark' || mode === 'light' || mode === 'system') return mode;
  } catch {
    /* keep default */
  }
  return 'dark';
}
