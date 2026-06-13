import { useRef, useState, useEffect, useCallback } from 'react'
import type { HexCoord, HexCell, TerrainType, SiteType, EnemyColor } from '@/engine/types'
import type { MapState } from '@/engine/GameState'
import { useGameStore } from '@/store/gameStore'
import { getTileHexes } from '@/utils/hexMath'
import MapControls from './MapControls'

// ── Terrain palettes: [center, edge, detail] ──
const TERRAIN_PALETTE: Record<TerrainType, { center: string; edge: string; detail: string }> = {
  plains: { center: '#5f9450', edge: '#3c6332', detail: '#7dab6b' },
  hills: { center: '#a08562', edge: '#6e5a42', detail: '#bfa382' },
  forest: { center: '#39682f', edge: '#1f421b', detail: '#142e12' },
  wasteland: { center: '#7d6b46', edge: '#544730', detail: '#92805a' },
  desert: { center: '#d4b76a', edge: '#a18a4a', detail: '#e8d18f' },
  swamp: { center: '#4a5c47', edge: '#2e3c2d', detail: '#5e7558' },
  lake: { center: '#367494', edge: '#1f4a66', detail: '#5d9cc0' },
  mountain: { center: '#7e7e82', edge: '#525258', detail: '#a3a3a8' },
  sea: { center: '#1f4570', edge: '#122c4c', detail: '#3a6a99' },
  city: { center: '#9c5a28', edge: '#653a18', detail: '#b87a44' },
}

// Deterministic per-hex pseudo-random (stable across renders)
function hexHash(q: number, r: number, salt: number): number {
  let h = (q * 374761393 + r * 668265263 + salt * 2147483647) | 0
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return ((h >>> 0) % 10000) / 10000
}

const SITE_EMOJI: Record<SiteType, string> = {
  village: '\u{1F3D8}',
  monastery: '\u26EA',
  keep: '\u{1F3F0}',
  mageTower: '\u{1F52E}',
  dungeon: '\u{1F573}',
  tomb: '\u26B0',
  ancientRuins: '\u{1F3DA}',
  monsterDen: '\u{1F479}',
  spawningGrounds: '\u{1F409}',
  crystalMine: '\u26CF',
  magicalGlade: '\u{1F33F}',
  city: '\u{1F3D9}',
  portal: '\u{1F300}',
}

const ENEMY_DOT_COLOR: Record<EnemyColor, string> = {
  green: '#22c55e',
  grey: '#9ca3af',
  violet: '#a78bfa',
  brown: '#a16207',
  red: '#ef4444',
  white: '#e2e8f0',
}

const HEX_SIZE_DEFAULT = 40
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.0
const ZOOM_STEP = 0.1

interface HexMapProps {
  onHexClick?: (coord: HexCoord) => void
  explorePlacements?: HexCoord[] | null
  reachableHexes?: Map<string, number> | null
  selectedHex?: HexCoord | null
}

function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (1.5 * q)
  const y = size * (Math.sqrt(3) * 0.5 * q + Math.sqrt(3) * r)
  return { x, y }
}

function pixelToAxial(px: number, py: number, size: number): HexCoord {
  const q = (2 / 3 * px) / size
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / size
  const s = -q - r

  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)

  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)

  if (dq > dr && dq > ds) {
    rq = -rr - rs
  } else if (dr > ds) {
    rr = -rq - rs
  }

  return { q: rq, r: rr }
}

function drawHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const px = cx + size * Math.cos(angle)
    const py = cy + size * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

// Per-terrain decorative details, deterministic per hex
function drawTerrainDetail(
  ctx: CanvasRenderingContext2D,
  cell: HexCell,
  cx: number,
  cy: number,
  size: number,
) {
  const { q, r } = cell.coord
  const pal = TERRAIN_PALETTE[cell.terrain]
  const t = cell.terrain

  if (t === 'forest' || t === 'swamp') {
    // small fir-tree triangles
    const count = t === 'forest' ? 5 : 3
    for (let i = 0; i < count; i++) {
      const a = hexHash(q, r, i * 3) * Math.PI * 2
      const d = hexHash(q, r, i * 3 + 1) * size * 0.5
      const x = cx + Math.cos(a) * d
      const y = cy + Math.sin(a) * d
      const s = size * (0.13 + hexHash(q, r, i * 3 + 2) * 0.08)
      ctx.beginPath()
      ctx.moveTo(x, y - s)
      ctx.lineTo(x + s * 0.7, y + s * 0.6)
      ctx.lineTo(x - s * 0.7, y + s * 0.6)
      ctx.closePath()
      ctx.fillStyle = pal.detail
      ctx.fill()
    }
  } else if (t === 'mountain' || t === 'hills') {
    // ridge strokes
    const count = t === 'mountain' ? 3 : 2
    for (let i = 0; i < count; i++) {
      const x = cx + (hexHash(q, r, i * 5) - 0.5) * size * 0.9
      const y = cy + (hexHash(q, r, i * 5 + 1) - 0.3) * size * 0.6
      const s = size * (0.16 + hexHash(q, r, i * 5 + 2) * 0.14)
      ctx.beginPath()
      ctx.moveTo(x - s, y + s * 0.5)
      ctx.lineTo(x, y - s * 0.7)
      ctx.lineTo(x + s, y + s * 0.5)
      ctx.strokeStyle = pal.detail
      ctx.lineWidth = size * 0.045
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  } else if (t === 'lake' || t === 'sea') {
    // wave dashes
    for (let i = 0; i < 3; i++) {
      const x = cx + (hexHash(q, r, i * 7) - 0.5) * size * 0.8
      const y = cy + (i - 1) * size * 0.32 + (hexHash(q, r, i * 7 + 1) - 0.5) * size * 0.1
      const w = size * 0.32
      ctx.beginPath()
      ctx.moveTo(x - w, y)
      ctx.quadraticCurveTo(x - w * 0.5, y - size * 0.07, x, y)
      ctx.quadraticCurveTo(x + w * 0.5, y + size * 0.07, x + w, y)
      ctx.strokeStyle = pal.detail
      ctx.lineWidth = size * 0.035
      ctx.stroke()
    }
  } else if (t === 'desert' || t === 'wasteland' || t === 'plains') {
    // scattered speckles / tufts
    for (let i = 0; i < 6; i++) {
      const a = hexHash(q, r, i * 11) * Math.PI * 2
      const d = hexHash(q, r, i * 11 + 1) * size * 0.62
      const x = cx + Math.cos(a) * d
      const y = cy + Math.sin(a) * d
      ctx.beginPath()
      ctx.arc(x, y, size * (0.02 + hexHash(q, r, i * 11 + 2) * 0.025), 0, Math.PI * 2)
      ctx.fillStyle = pal.detail
      ctx.fill()
    }
  }
}

function drawHexCell(
  ctx: CanvasRenderingContext2D,
  cell: HexCell,
  cx: number,
  cy: number,
  size: number,
) {
  const pal = TERRAIN_PALETTE[cell.terrain]

  // \u2500\u2500 Unrevealed: fog tile \u2500\u2500
  if (!cell.isRevealed) {
    drawHexPath(ctx, cx, cy, size)
    const fog = ctx.createRadialGradient(cx, cy - size * 0.3, size * 0.1, cx, cy, size)
    fog.addColorStop(0, '#1d2742')
    fog.addColorStop(1, '#0d1322')
    ctx.fillStyle = fog
    ctx.fill()
    ctx.strokeStyle = 'rgba(74, 90, 130, 0.35)'
    ctx.lineWidth = 1.2
    ctx.stroke()
    // faint rune
    ctx.font = `${size * 0.5}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(120, 140, 185, 0.18)'
    ctx.fillText('?', cx, cy)
    return
  }

  // \u2500\u2500 Terrain body: radial gradient \u2500\u2500
  drawHexPath(ctx, cx, cy, size)
  const grad = ctx.createRadialGradient(cx - size * 0.2, cy - size * 0.25, size * 0.15, cx, cy, size * 1.05)
  grad.addColorStop(0, pal.center)
  grad.addColorStop(1, pal.edge)
  ctx.fillStyle = grad
  ctx.fill()

  // texture details (clipped to the hex)
  ctx.save()
  drawHexPath(ctx, cx, cy, size)
  ctx.clip()
  drawTerrainDetail(ctx, cell, cx, cy, size)
  // bottom-edge ambient shade for a tiled, physical feel
  const shade = ctx.createLinearGradient(cx, cy - size, cx, cy + size)
  shade.addColorStop(0, 'rgba(255,255,255,0.07)')
  shade.addColorStop(0.45, 'rgba(255,255,255,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.22)')
  drawHexPath(ctx, cx, cy, size)
  ctx.fillStyle = shade
  ctx.fill()
  ctx.restore()

  // border: dark outer + subtle inner bevel
  drawHexPath(ctx, cx, cy, size)
  ctx.strokeStyle = 'rgba(8, 12, 22, 0.85)'
  ctx.lineWidth = Math.max(1.5, size * 0.05)
  ctx.stroke()
  drawHexPath(ctx, cx, cy, size * 0.94)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.stroke()

  // \u2500\u2500 Site medallion \u2500\u2500
  if (cell.site) {
    const my = cy + (cell.enemyTokens.length > 0 ? size * 0.08 : 0)
    const mr = size * 0.34
    // soft shadow
    ctx.beginPath()
    ctx.ellipse(cx, my + mr * 0.75, mr * 0.9, mr * 0.3, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fill()
    // medallion disc
    ctx.beginPath()
    ctx.arc(cx, my, mr, 0, Math.PI * 2)
    const disc = ctx.createRadialGradient(cx - mr * 0.3, my - mr * 0.4, mr * 0.15, cx, my, mr)
    disc.addColorStop(0, '#f4e9cf')
    disc.addColorStop(1, '#c9b389')
    ctx.fillStyle = disc
    ctx.fill()
    ctx.strokeStyle = cell.siteData?.isConquered ? '#8a6d1f' : '#6b5a36'
    ctx.lineWidth = Math.max(1.2, size * 0.045)
    ctx.stroke()

    const emoji = SITE_EMOJI[cell.site]
    ctx.font = `${size * 0.42}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, cx, my + size * 0.02)

    // conquered banner
    if (cell.siteData?.isConquered) {
      ctx.font = `${size * 0.26}px serif`
      ctx.fillText('\ud83d\udea9', cx + mr * 0.85, my - mr * 0.8)
    }
  }

  // \u2500\u2500 Enemy tokens \u2500\u2500
  if (cell.enemyTokens.length > 0) {
    const count = cell.enemyTokens.length
    const tokenR = size * 0.17
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * tokenR * 2.3
      const ex = cx + spread
      const ey = cy - size * 0.52
      // shadow
      ctx.beginPath()
      ctx.ellipse(ex, ey + tokenR * 0.85, tokenR * 0.85, tokenR * 0.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fill()
      // token disc
      ctx.beginPath()
      ctx.arc(ex, ey, tokenR, 0, Math.PI * 2)
      const tg = ctx.createRadialGradient(ex - tokenR * 0.3, ey - tokenR * 0.35, tokenR * 0.1, ex, ey, tokenR)
      tg.addColorStop(0, '#3a4256')
      tg.addColorStop(1, '#171c2a')
      ctx.fillStyle = tg
      ctx.fill()
      ctx.strokeStyle = ENEMY_DOT_COLOR[cell.enemyTokens[i].color]
      ctx.lineWidth = Math.max(1.4, size * 0.05)
      ctx.stroke()
      // skull glyph
      ctx.font = `${tokenR * 1.15}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#e6e9f2'
      ctx.fillText('\ud83d\udc80', ex, ey + tokenR * 0.05)
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const y = cy - size * 0.12
  const radius = size * 0.3

  // ground shadow
  ctx.beginPath()
  ctx.ellipse(cx, cy + size * 0.28, radius * 1.05, radius * 0.38, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fill()

  // aura glow
  const glow = ctx.createRadialGradient(cx, y, radius * 0.3, cx, y, radius * 2.1)
  glow.addColorStop(0, 'rgba(167, 139, 250, 0.4)')
  glow.addColorStop(1, 'rgba(167, 139, 250, 0)')
  ctx.beginPath()
  ctx.arc(cx, y, radius * 2.1, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()

  // orb body
  ctx.beginPath()
  ctx.arc(cx, y, radius, 0, Math.PI * 2)
  const body = ctx.createRadialGradient(cx - radius * 0.35, y - radius * 0.45, radius * 0.1, cx, y, radius)
  body.addColorStop(0, '#c4b5fd')
  body.addColorStop(0.45, '#8b5cf6')
  body.addColorStop(1, '#4c1d95')
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = '#ddd6fe'
  ctx.lineWidth = Math.max(1.4, size * 0.045)
  ctx.stroke()

  ctx.font = `${size * 0.3}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('\u2694', cx, y)
}

function drawExploreZone(
  ctx: CanvasRenderingContext2D,
  center: HexCoord,
  hexSize: number,
) {
  const hexes = getTileHexes(center)

  for (const h of hexes) {
    const { x, y } = axialToPixel(h.q, h.r, hexSize)
    drawHexPath(ctx, x, y, hexSize * 0.92)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  const { x: cx, y: cy } = axialToPixel(center.q, center.r, hexSize)
  ctx.font = `${hexSize * 0.45}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(6, 182, 212, 0.7)'
  ctx.fillText('?', cx, cy)
}

function drawHexOverlay(
  ctx: CanvasRenderingContext2D,
  coord: HexCoord,
  hexSize: number,
  options: { fill: string; stroke: string; label?: string; dashed?: boolean },
) {
  const { x, y } = axialToPixel(coord.q, coord.r, hexSize)
  drawHexPath(ctx, x, y, hexSize * 0.94)
  ctx.fillStyle = options.fill
  ctx.fill()
  // glow ring
  ctx.save()
  ctx.shadowColor = options.stroke
  ctx.shadowBlur = hexSize * 0.25
  ctx.strokeStyle = options.stroke
  ctx.lineWidth = 2
  if (options.dashed) ctx.setLineDash([5, 4])
  ctx.stroke()
  if (options.dashed) ctx.setLineDash([])
  ctx.restore()

  if (options.label) {
    const by = y + hexSize * 0.58
    const br = hexSize * 0.18
    ctx.beginPath()
    ctx.arc(x, by, br, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(8, 14, 24, 0.85)'
    ctx.fill()
    ctx.strokeStyle = options.stroke
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.font = `700 ${hexSize * 0.22}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = options.stroke
    ctx.fillText(options.label, x, by + hexSize * 0.01)
  }
}

function renderMap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mapState: MapState,
  playerPos: HexCoord,
  offset: { x: number; y: number },
  zoom: number,
  hexSize: number,
  placements?: HexCoord[] | null,
  reachableHexes?: Map<string, number> | null,
  selectedHex?: HexCoord | null,
) {
  // ── Table backdrop ──
  const bg = ctx.createRadialGradient(width / 2, height * 0.42, Math.min(width, height) * 0.15, width / 2, height / 2, Math.max(width, height) * 0.75)
  bg.addColorStop(0, '#121a2e')
  bg.addColorStop(1, '#070b16')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.translate(width / 2 + offset.x, height / 2 + offset.y)
  ctx.scale(zoom, zoom)

  if (placements && placements.length > 0) {
    for (const placement of placements) {
      drawExploreZone(ctx, placement, hexSize)
    }
  }

  const cells: HexCell[] = []
  mapState.hexGrid.forEach((cell) => cells.push(cell))

  for (const cell of cells) {
    const { x, y } = axialToPixel(cell.coord.q, cell.coord.r, hexSize)
    drawHexCell(ctx, cell, x, y, hexSize)
  }

  if (reachableHexes && reachableHexes.size > 0) {
    for (const [key, remaining] of reachableHexes.entries()) {
      const [q, r] = key.split(',').map(Number)
      if (q === playerPos.q && r === playerPos.r) continue
      drawHexOverlay(ctx, { q, r }, hexSize, {
        fill: 'rgba(34, 197, 94, 0.16)',
        stroke: 'rgba(74, 222, 128, 0.75)',
        label: `${remaining}`,
      })
    }
  }

  if (selectedHex) {
    drawHexOverlay(ctx, selectedHex, hexSize, {
      fill: 'rgba(245, 158, 11, 0.25)',
      stroke: 'rgba(251, 191, 36, 0.95)',
      label: 'MOVE',
      dashed: true,
    })
  }

  const playerPx = axialToPixel(playerPos.q, playerPos.r, hexSize)
  drawPlayer(ctx, playerPx.x, playerPx.y, hexSize)

  ctx.restore()

  // ── Vignette (screen space) ──
  const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45, width / 2, height / 2, Math.max(width, height) * 0.78)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, width, height)
}

export default function HexMap({ onHexClick, explorePlacements, reachableHexes, selectedHex }: HexMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)

  const dragStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 0, y: 0 })
  const canvasSize = useRef({ w: 0, h: 0 })

  const engineState = useGameStore((s) => s.engineState)
  const mapState = engineState?.map ?? null
  const targetPos = engineState?.player.position ?? { q: 0, r: 0 }

  // Smoothly animate the hero token between hexes (board-game feel)
  const [playerPos, setPlayerPos] = useState<HexCoord>(targetPos)
  const animFrameRef = useRef<number | null>(null)
  const animFromRef = useRef<HexCoord>(targetPos)

  useEffect(() => {
    const from = animFromRef.current
    const to = targetPos
    if (from.q === to.q && from.r === to.r) {
      setPlayerPos(to)
      return
    }
    const start = performance.now()
    const duration = 450
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setPlayerPos({ q: from.q + (to.q - from.q) * ease, r: from.r + (to.r - from.r) * ease })
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step)
      } else {
        animFromRef.current = to
      }
    }
    animFrameRef.current = requestAnimationFrame(step)
    return () => {
      if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current)
      animFromRef.current = to
    }
  }, [targetPos.q, targetPos.r]) // eslint-disable-line react-hooks/exhaustive-deps

  const hexSize = HEX_SIZE_DEFAULT

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        canvasSize.current = { w: width, h: height }

        const ctx = canvas.getContext('2d')
        if (ctx && mapState) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          renderMap(ctx, width, height, mapState, playerPos, offset, zoom, hexSize, explorePlacements, reachableHexes, selectedHex)
        }
      }
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [mapState, playerPos, offset, zoom, hexSize, explorePlacements, reachableHexes, selectedHex])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapState) return

    const { w, h } = canvasSize.current
    if (w === 0 || h === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMap(ctx, w, h, mapState, playerPos, offset, zoom, hexSize, explorePlacements, reachableHexes, selectedHex)
  }, [mapState, playerPos, offset, zoom, hexSize, explorePlacements, reachableHexes, selectedHex])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      offsetStart.current = { ...offset }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [offset],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy })
    },
    [isDragging],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDragging) return
      const dx = Math.abs(e.clientX - dragStart.current.x)
      const dy = Math.abs(e.clientY - dragStart.current.y)
      setIsDragging(false)

      if (dx < 4 && dy < 4 && onHexClick) {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const { w, h } = canvasSize.current

        const mx = e.clientX - rect.left - w / 2 - offset.x
        const my = e.clientY - rect.top - h / 2 - offset.y
        const worldX = mx / zoom
        const worldY = my / zoom

        onHexClick(pixelToAxial(worldX, worldY, hexSize))
      }
    },
    [isDragging, onHexClick, offset, zoom, hexSize],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const direction = e.deltaY < 0 ? 1 : -1
      setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + direction * ZOOM_STEP)))
    },
    [],
  )

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(ZOOM_MAX, prev + ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(ZOOM_MIN, prev - ZOOM_STEP))
  }, [])

  const handleReset = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setIsDragging(false)}
        onWheel={handleWheel}
      />
      <MapControls zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
    </div>
  )
}
