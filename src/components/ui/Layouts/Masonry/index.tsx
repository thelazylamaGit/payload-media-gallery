import { closestCenter, DndContext } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useConfig } from '@payloadcms/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildMasonryColumns, masonryNeighbor } from '../../../../utils/masonry.ts'
import { useGalleryManager } from '../../hooks/useGalleryManager'
import { useGalleryOrder } from '../../hooks/useGalleryOrder'
import { MediaCard } from '../../MediaCard'
import { MarqueeBox } from '../../Selection/MarqueeBox'
import { SortableItem } from '../../Sortable/SortableItem'
import type { MasonryProps } from './types'
import './index.scss'

export const Masonry = ({
  onQuickEdit,
  items: initialItems,
  onLightbox,
  handleSelection,
  footer,
  alwaysShowTitle,
  collectionLabel,
  collectionSlug,
}: MasonryProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(1)
  const [containerWidth, setContainerWidth] = useState(0)
  const { config } = useConfig()

  const collectionConfig = config.collections.find((c) => c.slug === collectionSlug)
  const orderableEnabled =
    !!collectionConfig?.orderable ||
    !!(collectionConfig?.upload as unknown as { orderable?: boolean })?.orderable

  // Optimistic items state
  const [items, setItems] = useState(initialItems)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const { sensors, handleDragStart, handleDragEnd } = useGalleryOrder({
    items,
    collectionSlug,
    onOrder: setItems,
  })

  // We only enable DnD if configured
  const enableDnD = orderableEnabled

  // Update column count based on container width
  useEffect(() => {
    if (!containerRef.current) return

    const updateColumns = () => {
      if (!containerRef.current) return
      const width = containerRef.current.offsetWidth
      setContainerWidth(width)
      if (width < 600) setColumnCount(1)
      else if (width < 900) setColumnCount(2)
      else if (width < 1200) setColumnCount(3)
      else if (width < 1600) setColumnCount(4)
      else setColumnCount(5)
    }

    updateColumns()
    const observer = new ResizeObserver(updateColumns)
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  const columns = useMemo(
    () =>
      buildMasonryColumns(
        items,
        columnCount,
        Math.max(1, (containerWidth - (columnCount - 1) * 4) / columnCount),
        4,
      ),
    [items, columnCount, containerWidth],
  )

  const calculateNextIndex = useCallback(
    (current: number, key: string) => masonryNeighbor(columns, current, key),
    [columns],
  )

  const { getItemProps, marquee } = useGalleryManager({
    docs: items,
    calculateNextIndex,
    containerRef,
    onQuickEdit,
    onLightbox,
    handleSelection,
    columns: columnCount,
  })

  const content = (
    <>
      <MarqueeBox marquee={marquee} />
      {columns.map((colItems, colIndex) => (
        <div key={colIndex} className="media-gallery-masonry__column">
          {colItems.map(({ item, index }) => {
            const card = (
              <MediaCard
                key={item.id}
                {...getItemProps(item, index)}
                item={item}
                footer={footer}
                alwaysShowTitle={alwaysShowTitle}
                collectionLabel={collectionLabel}
                lightboxEnabled={!!onLightbox}
                className="masonry-item"
              />
            )

            if (enableDnD) {
              return (
                <SortableItem key={item.id} id={item.id}>
                  {card}
                </SortableItem>
              )
            }

            return card
          })}
        </div>
      ))}
    </>
  )

  if (enableDnD) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="media-gallery-masonry" ref={containerRef}>
            {content}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  return (
    <div className="media-gallery-masonry" ref={containerRef}>
      {content}
    </div>
  )
}
