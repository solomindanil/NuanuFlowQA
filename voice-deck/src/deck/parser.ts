import type { Slide } from '../types'

/**
 * Формат колоды: markdown, слайды разделены строкой `---`.
 * Внутри слайда: `# Заголовок`, `- буллет`, и служебные комментарии
 * `<!-- anchors: фраза; фраза -->`, `<!-- notes: ... -->`, `<!-- layout: title -->`.
 */
export function parseDeck(md: string): Slide[] {
  const blocks = md
    .split(/^---\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean)

  return blocks.map((block, i) => {
    const slide: Slide = { id: i, layout: 'normal', title: '', bullets: [], anchors: [], notes: '' }
    for (const raw of block.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const comment = line.match(/^<!--\s*(\w+):\s*(.*?)\s*-->$/)
      if (comment) {
        const [, key, value] = comment
        if (key === 'anchors') {
          slide.anchors = value.split(';').map((s) => s.trim()).filter(Boolean)
        } else if (key === 'notes') {
          slide.notes = value
        } else if (key === 'layout' && value === 'title') {
          slide.layout = 'title'
        }
        continue
      }
      if (line.startsWith('# ')) slide.title = line.slice(2).trim()
      else if (line.startsWith('- ')) slide.bullets.push(line.slice(2).trim())
    }
    return slide
  })
}
