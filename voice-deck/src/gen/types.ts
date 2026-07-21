import type { Slide, SlidePatch } from '../types'

export interface GenContext {
  windowText: string
  slide: Slide
}

export interface GenProvider {
  readonly name: string
  generate(ctx: GenContext): Promise<SlidePatch>
}
