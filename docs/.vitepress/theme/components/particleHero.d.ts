export interface Box { x: number; y: number; w: number; h: number }
export interface ParticleHeroOptions {
  measure: () => { text: Box & { font: string }; quiet: Box }
  dark?: boolean
  reduced?: boolean
  seed?: number
}
export declare function createParticleHero(canvas: HTMLCanvasElement, options: ParticleHeroOptions): null | {
  setOptions(options: { dark?: boolean; reduced?: boolean }): void
  setScatter(value: number): void
  rebuild(): void
  destroy(): void
}
