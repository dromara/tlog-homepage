import { reactive } from 'vue'

// Shared by the hero particles and the scroll journey. While `active`, scrolling
// from the hero morphs the wordmark particles into the journey's topology; once
// the journey pins, its SVG fades in over `handoff` (0…1) as the particles fade out.
export const COMPACT_QUERY = '(max-width: 1100px), (max-height: 700px)'
// Share of the journey's first step spent cross-fading particles into the SVG.
export const HANDOFF_STEP = 0.45

export const morphState = reactive({ active: false, handoff: 0 })
export const morphTargets: { journey: HTMLElement | null; topology: SVGSVGElement | null } = { journey: null, topology: null }
