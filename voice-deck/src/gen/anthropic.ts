import type { GenContext, GenProvider } from './types'
import type { SlidePatch } from '../types'

const MODEL = 'claude-haiku-4-5'

const SYSTEM = `Ты — генератор контента для слайда живой презентации. По последним словам спикера верни РОВНО ОДИН JSON-объект без пояснений и без markdown, одного из видов:
{"kind":"stat","value":"23","label":"бага закрыто за неделю"}
{"kind":"bullet","text":"короткий тезис"}
{"kind":"quote","text":"короткая цитата"}
{"kind":"chart","title":"заголовок","bars":[{"label":"пн","value":4},{"label":"вт","value":7}]}
Выбирай самое выразительное: названа цифра → stat, перечисление чисел → chart, тезис → bullet или quote. Текст на языке спикера, максимально коротко.`

/**
 * Живая генерация через Claude Haiku прямо из браузера.
 * Ключ хранится только в localStorage пользователя.
 */
export class AnthropicGen implements GenProvider {
  readonly name = 'claude'

  constructor(private apiKey: string) {}

  async generate({ windowText, slide }: GenContext): Promise<SlidePatch> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              `Текущий слайд: ${JSON.stringify({ title: slide.title, bullets: slide.bullets })}\n` +
              `Последние слова спикера: ${windowText}`,
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic API: ${res.status}`)
    const data = (await res.json()) as { content?: { type: string; text?: string }[] }
    const text = data.content?.find((b) => b.type === 'text')?.text ?? ''
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    if (!json) throw new Error('в ответе модели нет JSON')
    const patch = JSON.parse(json) as SlidePatch
    if (!['bullet', 'stat', 'quote', 'chart'].includes(patch.kind)) {
      throw new Error(`неизвестный kind: ${String(patch.kind)}`)
    }
    return patch
  }
}
