import type { MediaItem } from '../components/ui/types.js'

export interface MasonryEntry {
  item: MediaItem
  index: number
  top: number
  height: number
}

function aspectRatio(item: MediaItem): number {
  if (item.type !== 'image' && item.type !== 'video') return 1
  const thumbnail = item.thumbnail || item.sizes?.thumbnail?.url ? item.sizes?.thumbnail : undefined
  const width = thumbnail?.width ?? item.width
  const height = thumbnail?.height ?? item.height
  return width &&
    height &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? height / width
    : 1
}

/** Equal-width columns balanced by preview height, without cropping tall images. */
export function buildMasonryColumns(
  items: MediaItem[],
  count: number,
  width = 1,
  gap = 0,
): MasonryEntry[][] {
  const columns: MasonryEntry[][] = Array.from({ length: Math.max(1, count) }, () => [])
  const heights = columns.map(() => 0)
  items.forEach((item, index) => {
    const column = heights.indexOf(Math.min(...heights))
    const height = aspectRatio(item) * width
    columns[column].push({ item, index, top: heights[column], height })
    heights[column] += height + gap
  })
  return columns
}

/** Navigate the rendered columns; keep source indexes for editing and selection. */
export function masonryNeighbor(columns: MasonryEntry[][], current: number, key: string): number {
  const column = columns.findIndex((entries) => entries.some((entry) => entry.index === current))
  if (column < 0) return current
  const row = columns[column].findIndex((entry) => entry.index === current)
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    return columns[column][row + (key === 'ArrowUp' ? -1 : 1)]?.index ?? current
  }
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return current
  const neighbors = columns[column + (key === 'ArrowLeft' ? -1 : 1)]
  if (!neighbors?.length) return current
  const entry = columns[column][row]
  const center = entry.top + entry.height / 2
  return neighbors.reduce((closest, candidate) =>
    Math.abs(candidate.top + candidate.height / 2 - center) <
    Math.abs(closest.top + closest.height / 2 - center)
      ? candidate
      : closest,
  ).index
}
