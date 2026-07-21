import { normalize } from './normalize'

export type VoiceCommand =
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'goto'; index: number }
  | { kind: 'generate' }

const NUM_WORDS: Record<string, number> = {
  'один': 1, 'первый': 1,
  'два': 2, 'второй': 2,
  'три': 3, 'третий': 3,
  'четыре': 4, 'четвертый': 4,
  'пять': 5, 'пятый': 5,
  'шесть': 6, 'шестой': 6,
  'семь': 7, 'седьмой': 7,
  'восемь': 8, 'восьмой': 8,
  'девять': 9, 'девятый': 9,
  'десять': 10, 'десятый': 10,
}

/**
 * Явные голосовые команды. Формулировки нарочно «жёсткие» (не одиночное
 * «дальше»/«назад») — эти слова слишком часты в обычной речи.
 */
export function detectCommand(utterance: string): VoiceCommand | null {
  const t = normalize(utterance)
  if (!t) return null

  if (/(покажи (это|цифру|цифры|график|диаграмму)( на слайде)?|добавь (это )?на слайд|put (it|this) on the slide)/.test(t)) {
    return { kind: 'generate' }
  }

  const goto = t.match(/(?:слайд|slide) (?:номер |number )?(\d+|[а-я]+)/)
  if (goto) {
    const raw = goto[1]
    const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NUM_WORDS[raw] ?? 0
    if (n >= 1) return { kind: 'goto', index: n - 1 }
  }

  if (/(следующий слайд|идем дальше|поехали дальше|переключи дальше|next slide)/.test(t)) {
    return { kind: 'next' }
  }
  if (/(предыдущий слайд|вернись назад|слайд назад|previous slide|go back)/.test(t)) {
    return { kind: 'prev' }
  }
  return null
}
