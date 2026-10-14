import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../src/components/ui/types'
import { buildMasonryColumns, masonryNeighbor } from '../src/utils/masonry'

const image = (id: number, height: number): MediaItem => ({
  id,
  src: '/image.jpg',
  type: 'image',
  width: 440,
  height,
})
const bottom = (column: ReturnType<typeof buildMasonryColumns>[number]) => {
  const last = column[column.length - 1]
  return last ? last.top + last.height : 0
}

describe('masonry balancing', () => {
  it.each([
    50, 100,
  ])('balances %i documents with repeating tall images rather than concentrating them in one column', (count) => {
    const items = Array.from({ length: count }, (_, index) =>
      image(index, index % 5 === 4 ? 2000 : 440),
    )
    const columns = buildMasonryColumns(items, 5, 300, 4)
    const heights = columns.map(bottom)
    const oldHeights = Array.from({ length: 5 }, (_, column) =>
      items
        .filter((_, index) => index % 5 === column)
        .reduce((height, item) => height + (item.height! / item.width!) * 300 + 4, 0),
    )
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan((2000 / 440) * 300 + 4)
    expect(Math.max(...heights)).toBeLessThan(Math.max(...oldHeights))
    expect(
      columns
        .flat()
        .map((entry) => entry.index)
        .sort((a, b) => a - b),
    ).toEqual(items.map((_, index) => index))
    for (const entry of columns.flat()) expect(entry.item).toBe(items[entry.index])
  })
  it('retains the full 440x2000 image height', () => {
    const columns = buildMasonryColumns([image(0, 2000)], 2, 300)
    expect(columns[0][0].height).toBeCloseTo(1363.636)
  })
  it('balances using the displayed thumbnail dimensions and safe missing-dimension defaults', () => {
    const item = {
      ...image(0, 2000),
      sizes: { thumbnail: { url: '/square.jpg', width: 100, height: 100 } },
    }
    const columns = buildMasonryColumns([item, { ...image(1, 440), width: undefined }], 1, 300)
    expect(columns[0].map((entry) => entry.height)).toEqual([300, 300])
    expect(buildMasonryColumns([], 5)).toEqual([[], [], [], [], []])
  })
  it('navigates the actual columns after uneven-height balancing', () => {
    const columns = buildMasonryColumns(
      [image(0, 2000), image(1, 440), image(2, 440), image(3, 440)],
      2,
      300,
    )
    expect(masonryNeighbor(columns, 1, 'ArrowDown')).toBe(2)
    expect(masonryNeighbor(columns, 2, 'ArrowUp')).toBe(1)
    expect(masonryNeighbor(columns, 0, 'ArrowDown')).toBe(0)
    expect(masonryNeighbor(columns, 0, 'ArrowRight')).toBe(3)
    expect(masonryNeighbor(columns, 3, 'ArrowLeft')).toBe(0)
  })
})
