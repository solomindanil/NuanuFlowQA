export function trigrams(text: string): Set<string> {
  const s = `  ${text}  `
  const grams = new Set<string>()
  for (let i = 0; i < s.length - 2; i++) grams.add(s.slice(i, i + 3))
  return grams
}

/** Коэффициент Сёренсена — Дайса по множествам триграмм. */
export function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const g of a) if (b.has(g)) inter++
  return (2 * inter) / (a.size + b.size)
}
