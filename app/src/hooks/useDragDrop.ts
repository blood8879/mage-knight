import { useState, useCallback, useRef } from 'react'

// ── Types ────────────────────────────────────
interface Position {
  x: number
  y: number
}

interface DropZoneRect {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

interface DragState {
  isDragging: boolean
  dragItem: number | null
  dragPosition: Position
  dropTarget: string | null
}

const DRAG_THRESHOLD = 5

// ── Hook ─────────────────────────────────────
export function useDragDrop() {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    dragItem: null,
    dragPosition: { x: 0, y: 0 },
    dropTarget: null,
  })

  const dropZonesRef = useRef<Map<string, DropZoneRect>>(new Map())
  const startPosRef = useRef<Position>({ x: 0, y: 0 })
  const pendingItemRef = useRef<number | null>(null)
  const activatedRef = useRef(false)

  // ── Hit-test against registered drop zones ──
  const hitTest = useCallback((pos: Position): string | null => {
    for (const [id, rect] of dropZonesRef.current) {
      if (
        pos.x >= rect.left &&
        pos.x <= rect.right &&
        pos.y >= rect.top &&
        pos.y <= rect.bottom
      ) {
        return id
      }
    }
    return null
  }, [])

  // ── Drop zone registration ──
  const registerDropZone = useCallback((id: string, rect: DropZoneRect) => {
    dropZonesRef.current.set(id, rect)
  }, [])

  const unregisterDropZone = useCallback((id: string) => {
    dropZonesRef.current.delete(id)
  }, [])

  // ── Start drag (called on pointerdown / touchstart) ──
  const startDrag = useCallback((itemIndex: number, pos: Position) => {
    startPosRef.current = pos
    pendingItemRef.current = itemIndex
    activatedRef.current = false
  }, [])

  // ── Update drag position (called on pointermove / touchmove) ──
  const updateDrag = useCallback(
    (pos: Position) => {
      // Check threshold before activating
      if (!activatedRef.current) {
        const dx = pos.x - startPosRef.current.x
        const dy = pos.y - startPosRef.current.y
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
        activatedRef.current = true
      }

      const target = hitTest(pos)
      setState({
        isDragging: true,
        dragItem: pendingItemRef.current,
        dragPosition: pos,
        dropTarget: target,
      })
    },
    [hitTest],
  )

  // ── End drag — returns the drop target id or null ──
  const endDrag = useCallback((): string | null => {
    const currentTarget = state.dropTarget
    const wasActive = activatedRef.current

    setState({
      isDragging: false,
      dragItem: null,
      dragPosition: { x: 0, y: 0 },
      dropTarget: null,
    })
    pendingItemRef.current = null
    activatedRef.current = false

    return wasActive ? currentTarget : null
  }, [state.dropTarget])

  return {
    isDragging: state.isDragging,
    dragItem: state.dragItem,
    dragPosition: state.dragPosition,
    dropTarget: state.dropTarget,
    startDrag,
    updateDrag,
    endDrag,
    registerDropZone,
    unregisterDropZone,
  }
}
