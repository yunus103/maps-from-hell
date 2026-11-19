import type { L10n, Lang } from './types';

const KEY = 'mfh.lang';

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'tr') return saved;
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let lang: Lang = initial();
const listeners = new Set<(l: Lang) => void>();

export const getLang = (): Lang => lang;

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // Not persisted this session.
  }
  for (const f of listeners) f(l);
}

export function onLangChange(f: (l: Lang) => void) {
  listeners.add(f);
}

// Localised text with {name} placeholders filled.
export function tx(s: L10n, params?: Record<string, string | number>): string {
  let out = s[lang];
  if (params) for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}
