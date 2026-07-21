const KEY_API = 'voice-deck:anthropic-key'
const KEY_LANG = 'voice-deck:lang'

export function getApiKey(): string {
  return localStorage.getItem(KEY_API) ?? ''
}

export function setApiKey(key: string): void {
  if (key) localStorage.setItem(KEY_API, key)
  else localStorage.removeItem(KEY_API)
}

export function getLang(): string {
  return localStorage.getItem(KEY_LANG) ?? 'ru-RU'
}

export function setLang(lang: string): void {
  localStorage.setItem(KEY_LANG, lang)
}
