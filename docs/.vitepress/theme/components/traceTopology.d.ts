export interface TopologyNode { id: string; label: string; x: number; y: number; span: string }
export interface TopologyEdge { points: [number, number][]; to: number; async?: boolean; label?: string }
export declare const VIEW: { w: number; h: number }
export declare const TRACE_ID: string
export declare const NODE_RADIUS: number
export declare const HALO_RADIUS: number
export declare const nodes: TopologyNode[]
export declare const edges: TopologyEdge[]
export declare const ROLE: { edge: 0; ring: 1; halo: 2; dissolve: 3 }
export declare function edgePath(edge: TopologyEdge): string
export declare function cubicPoint(points: [number, number][], u: number): [number, number]
export declare function edgeLength(points: [number, number][], steps?: number): number
export declare function chainTone(x: number): number
export declare function sampleTopology(count: number, random: () => number): Float32Array
export declare function decodeRole(value: number): { role: number; node: number }
export declare function pairByX(xs: ArrayLike<number>, topology: Float32Array, stride?: number): Float32Array
