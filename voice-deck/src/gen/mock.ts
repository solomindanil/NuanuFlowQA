import type { GenContext, GenProvider } from './types'
import type { SlidePatch } from '../types'

const COMMAND_TAIL = /(покажи (это|цифру|цифры|график|диаграмму)( на слайде)?|добавь (это )?на слайд|put (it|this) on the slide).*$/i

/**
 * Локальный генератор без API: вытаскивает цифры/тезисы регулярками.
 * Демо работает даже без ключа и без сети.
 */
export class MockGen implements GenProvider {
  readonly name = 'mock'

  async generate({ windowText }: GenContext): Promise<SlidePatch> {
    const text = windowText.replace(COMMAND_TAIL, '').trim()
    const nums = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*([а-яa-z%]{2,})?/gi)]

    if (/график|диаграмм|chart/i.test(windowText) && nums.length >= 2) {
      return {
        kind: 'chart',
        title: 'Названные цифры',
        bars: nums.slice(-5).map((m, i) => ({
          label: m[2] ?? `№${i + 1}`,
          value: parseFloat(m[1].replace(',', '.')),
        })),
      }
    }

    if (nums.length) {
      const last = nums[nums.length - 1]
      const after = text.slice((last.index ?? 0) + last[1].length).trim()
      const label = after.split(/\s+/).slice(0, 4).join(' ') || 'из выступления'
      return { kind: 'stat', value: last[1], label }
    }

    const words = text.split(/\s+/).filter(Boolean)
    if (!words.length) return { kind: 'quote', text: '…' }
    return { kind: 'quote', text: words.slice(-12).join(' ') }
  }
}
