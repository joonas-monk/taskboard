export const POSITION_GAP = 1000
export const REBALANCE_THRESHOLD = 0.001

export function midpoint(a: number, b: number): number {
  return (a + b) / 2
}

export function positionAfterLast(lastPosition: number): number {
  return lastPosition + POSITION_GAP
}

export function positionBeforeFirst(firstPosition: number): number {
  return firstPosition - POSITION_GAP
}

export function initialPosition(index: number): number {
  return (index + 1) * POSITION_GAP
}

export function needsRebalance(gap: number): boolean {
  return Math.abs(gap) < REBALANCE_THRESHOLD
}

export function rebalancePositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_GAP)
}
