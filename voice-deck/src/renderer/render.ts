import type { Slide, SlidePatch } from '../types'

export function renderSlide(
  root: HTMLElement,
  slide: Slide,
  patches: SlidePatch[],
  direction: 1 | -1,
): void {
  const el = document.createElement('section')
  el.className = 'slide' + (slide.layout === 'title' ? ' slide--title' : '')

  const h = document.createElement('h1')
  h.textContent = slide.title
  el.appendChild(h)

  if (slide.bullets.length) {
    const ul = document.createElement('ul')
    slide.bullets.forEach((b, i) => {
      const li = document.createElement('li')
      li.textContent = b
      li.style.transitionDelay = `${150 + i * 120}ms`
      ul.appendChild(li)
    })
    el.appendChild(ul)
  }

  const patchWrap = document.createElement('div')
  patchWrap.className = 'patches'
  el.appendChild(patchWrap)
  for (const p of patches) patchWrap.appendChild(buildPatch(p, true))

  const old = root.querySelector<HTMLElement>('.slide')
  if (old) {
    old.classList.add(direction === 1 ? 'slide--out-left' : 'slide--out-right')
    setTimeout(() => old.remove(), 500)
  }

  el.classList.add(direction === 1 ? 'slide--enter-right' : 'slide--enter-left')
  root.appendChild(el)
  // двойной rAF: сначала стартовое состояние попадает в кадр, потом переход
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.classList.remove('slide--enter-right', 'slide--enter-left')
      el.classList.add('slide--shown')
    }),
  )
}

/** «Прорастание» сгенерированного контента на текущем слайде. */
export function appendPatch(root: HTMLElement, patch: SlidePatch): void {
  const wrap = root.querySelector<HTMLElement>('.slide .patches')
  if (!wrap) return
  const el = buildPatch(patch, false)
  wrap.appendChild(el)
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('patch--grown')))
}

function buildPatch(p: SlidePatch, grown: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = `patch patch--${p.kind}` + (grown ? ' patch--grown' : '')
  switch (p.kind) {
    case 'bullet': {
      el.textContent = p.text
      break
    }
    case 'quote': {
      el.textContent = `«${p.text}»`
      break
    }
    case 'stat': {
      const v = document.createElement('div')
      v.className = 'stat-value'
      v.textContent = p.value
      const l = document.createElement('div')
      l.className = 'stat-label'
      l.textContent = p.label
      el.append(v, l)
      break
    }
    case 'chart': {
      el.appendChild(buildChart(p.title, p.bars))
      break
    }
  }
  return el
}

function buildChart(title: string, bars: { label: string; value: number }[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'chart'
  const t = document.createElement('div')
  t.className = 'chart-title'
  t.textContent = title
  wrap.appendChild(t)

  const max = Math.max(...bars.map((b) => b.value), 1)
  const area = document.createElement('div')
  area.className = 'chart-bars'
  for (const b of bars.slice(0, 6)) {
    const col = document.createElement('div')
    col.className = 'chart-col'
    const bar = document.createElement('div')
    bar.className = 'chart-bar'
    bar.style.height = `${Math.max(6, Math.round((b.value / max) * 100))}%`
    const val = document.createElement('div')
    val.className = 'chart-val'
    val.textContent = String(b.value)
    const lab = document.createElement('div')
    lab.className = 'chart-label'
    lab.textContent = b.label
    col.append(val, bar, lab)
    area.appendChild(col)
  }
  wrap.appendChild(area)
  return wrap
}
