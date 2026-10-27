// One request's topology, shared by the hero particles and the scroll journey so
// the shape the particles settle into is exactly the diagram drawn below.
// Coordinates are in the journey SVG's 620×430 viewBox.

export const VIEW = { w: 620, h: 430 }
export const TRACE_ID = '7302518846211904'
export const NODE_RADIUS = 20
export const HALO_RADIUS = 30

export const nodes = [
  { id: 'order', label: 'order-service', x: 96, y: 214, span: '0' },
  { id: 'inventory', label: 'inventory', x: 330, y: 84, span: '0.1' },
  { id: 'payment', label: 'payment', x: 330, y: 214, span: '0.2' },
  { id: 'risk', label: 'risk-engine', x: 540, y: 214, span: '0.2.1' },
  { id: 'async', label: 'async-1', x: 330, y: 352, span: '0' },
  { id: 'notify', label: 'notification', x: 540, y: 352, span: '0.3' },
]

const line = (a, b) => [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + (b[0] - a[0]) * 2 / 3, a[1] + (b[1] - a[1]) * 2 / 3], b]

// Every edge is a cubic Bézier; edge i lights node `to`. The async thread publishes the Kafka message.
export const edges = [
  { points: [[126, 200], [210, 120], [240, 90], [296, 86]], to: 1 },
  { points: line([130, 214], [296, 214]), to: 2 },
  { points: line([364, 214], [506, 214]), to: 3 },
  { points: [[126, 230], [210, 320], [240, 350], [296, 352]], to: 4, async: true },
  { points: line([364, 352], [506, 352]), to: 5, label: 'Kafka' },
]

const fmt = n => String(Math.round(n * 100) / 100)
export function edgePath(edge) {
  const [a, b, c, d] = edge.points
  return `M${fmt(a[0])} ${fmt(a[1])} C ${fmt(b[0])} ${fmt(b[1])}, ${fmt(c[0])} ${fmt(c[1])}, ${fmt(d[0])} ${fmt(d[1])}`
}

export function cubicPoint(points, u) {
  const v = 1 - u
  const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u
  return [
    a * points[0][0] + b * points[1][0] + c * points[2][0] + d * points[3][0],
    a * points[0][1] + b * points[1][1] + c * points[2][1] + d * points[3][1],
  ]
}

function cubicTangent(points, u) {
  const v = 1 - u
  const dx = 3 * v * v * (points[1][0] - points[0][0]) + 6 * v * u * (points[2][0] - points[1][0]) + 3 * u * u * (points[3][0] - points[2][0])
  const dy = 3 * v * v * (points[1][1] - points[0][1]) + 6 * v * u * (points[2][1] - points[1][1]) + 3 * u * u * (points[3][1] - points[2][1])
  const length = Math.hypot(dx, dy) || 1
  return [dx / length, dy / length]
}

export function edgeLength(points, steps = 48) {
  let total = 0, previous = points[0]
  for (let i = 1; i <= steps; i++) {
    const next = cubicPoint(points, i / steps)
    total += Math.hypot(next[0] - previous[0], next[1] - previous[1])
    previous = next
  }
  return total
}

// Position along the call chain, left (caller) to right (deepest callee): drives colour and the travelling pulse.
const minX = nodes[0].x, maxX = Math.max(...nodes.map(node => node.x))
export const chainTone = x => Math.min(1, Math.max(0, (x - minX) / (maxX - minX)))

// Roles in the particle buffer; `dissolve` marks wordmark particles that fade
// out instead of joining the diagram, which needs far fewer points than the letters.
export const ROLE = { edge: 0, ring: 1, halo: 2, dissolve: 3 }

/**
 * Scatter `count` points over the topology: thin lines along the edges, a bright
 * ring for every node and a faint halo around it. Returns [x/w, y/h, tone, code]
 * quadruples, where code = role + 10 × (node index + 1) — see decodeRole.
 */
export function sampleTopology(count, random) {
  const out = new Float32Array(count * 4)
  const lengths = edges.map(edge => edgeLength(edge.points))
  const total = lengths.reduce((sum, value) => sum + value, 0)
  for (let i = 0; i < count; i++) {
    const pick = random()
    let x, y, role, nodeIndex = -1
    if (pick < 0.46) {
      let target = random() * total, e = 0
      while (e < edges.length - 1 && target > lengths[e]) target -= lengths[e++]
      const u = random()
      const [px, py] = cubicPoint(edges[e].points, u)
      const [tx, ty] = cubicTangent(edges[e].points, u)
      const offset = (random() + random() - 1) * 2.4
      x = px - ty * offset
      y = py + tx * offset
      role = ROLE.edge
    } else {
      nodeIndex = Math.min(nodes.length - 1, Math.floor(random() * nodes.length))
      const node = nodes[nodeIndex]
      const angle = random() * Math.PI * 2
      const halo = pick >= 0.86
      const radius = halo ? HALO_RADIUS + (random() - 0.5) * 1.2 : NODE_RADIUS + (random() + random() - 1) * 1.6
      x = node.x + Math.cos(angle) * radius
      y = node.y + Math.sin(angle) * radius
      role = halo ? ROLE.halo : ROLE.ring
    }
    out[i * 4] = x / VIEW.w
    out[i * 4 + 1] = y / VIEW.h
    out[i * 4 + 2] = chainTone(x)
    out[i * 4 + 3] = role + 10 * (nodeIndex + 1)
  }
  return out
}

/** Split an encoded role back into its parts; node is -1 for edge points. */
export function decodeRole(value) {
  return { role: value % 10, node: Math.floor(value / 10) - 1 }
}

/**
 * Reorder topology points so the k-th glyph point (by x) pairs with the k-th
 * topology point (by x): "TLog" flows into the caller, "2.0" into the callees.
 * `xs` holds one x per glyph; `topology` uses `stride` floats per point.
 */
export function pairByX(xs, topology, stride = 4) {
  const count = Math.min(xs.length, topology.length / stride)
  const byX = (key, n) => Array.from({ length: n }, (_, i) => i).sort((a, b) => key(a) - key(b))
  const glyphOrder = byX(i => xs[i], count), topologyOrder = byX(i => topology[i * stride], count)
  const out = new Float32Array(count * stride)
  for (let k = 0; k < count; k++) {
    out.set(topology.subarray(topologyOrder[k] * stride, (topologyOrder[k] + 1) * stride), glyphOrder[k] * stride)
  }
  return out
}
