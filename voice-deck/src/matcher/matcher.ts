import { normalize } from './normalize'
import { trigrams, dice } from './trigram'
import type { Slide } from '../types'

export interface MatchTick {
  scores: number[]
  proposal: number | null
}

// Пороги консервативные: ложное переключение хуже пропущенного.
const SCORE_MIN = 0.2
const SCORE_MARGIN = 0.05
const ANCHOR_BONUS = 0.35
const CONFIRM_TICKS = 2
const FORWARD_SPAN = 3

/**
 * Сопоставляет скользящее окно транскрипта со слайдами.
 * Автопредложения — только вперёд (current+1..current+FORWARD_SPAN) и только
 * после CONFIRM_TICKS подряд тиков в пользу одного кандидата (гистерезис).
 */
export class SlideMatcher {
  private slideGrams: Set<string>[]
  private anchorTexts: string[][]
  private streakTarget = -1
  private streak = 0

  constructor(private slides: Slide[]) {
    this.anchorTexts = slides.map((s) => s.anchors.map((a) => normalize(a)).filter(Boolean))
    this.slideGrams = slides.map((s) =>
      trigrams(normalize([s.title, ...s.bullets, ...s.anchors].join(' '))),
    )
  }

  tick(windowText: string, current: number): MatchTick {
    const win = normalize(windowText)
    const winGrams = trigrams(win)
    const scores = this.slides.map((_, i) => {
      let score = dice(winGrams, this.slideGrams[i])
      if (this.anchorTexts[i].some((a) => a.length >= 4 && win.includes(a))) score += ANCHOR_BONUS
      return Math.min(1, score)
    })

    let best = -1
    let bestScore = 0
    const to = Math.min(this.slides.length - 1, current + FORWARD_SPAN)
    for (let i = current + 1; i <= to; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i]
        best = i
      }
    }

    let proposal: number | null = null
    if (best >= 0 && bestScore >= SCORE_MIN && bestScore >= (scores[current] ?? 0) + SCORE_MARGIN) {
      if (this.streakTarget === best) this.streak++
      else {
        this.streakTarget = best
        this.streak = 1
      }
      if (this.streak >= CONFIRM_TICKS) proposal = best
    } else {
      this.streakTarget = -1
      this.streak = 0
    }

    return { scores, proposal }
  }

  reset(): void {
    this.streakTarget = -1
    this.streak = 0
  }
}
