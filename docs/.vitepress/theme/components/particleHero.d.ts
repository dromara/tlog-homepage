export interface Box { x: number; y: number; w: number; h: number }
export interface ParticleHeroOptions {
  measure: () => { text: Box & { font: string }; quiet: Box; topology?: Box | null }
  dark?: boolean
  reduced?: boolean
  seed?: number
  onAvailabilityChange?: (available: boolean) => void
}
export declare function createParticleHero(canvas: HTMLCanvasElement, options: ParticleHeroOptions): null | {
  setOptions(options: { dark?: boolean; reduced?: boolean }): void
  setScatter(value: number): void
  setMorph(value: number): void
  track(): void
  setParked(value: boolean): void
  rebuild(): boolean
  destroy(): void
}
