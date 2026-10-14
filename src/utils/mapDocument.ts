import type { MediaItem } from '../components/ui/types.js'
import type { CollectionGalleryOptions } from '../types.js'
import { getMimeType, isAudioMime, isImageMime, isVideoMime } from './media.ts'

export type GalleryDocument = { id: string | number; [key: string]: unknown }

/** Only traverse own properties; arrays and prototype paths are not field mappings. */
export function getFieldValue(doc: unknown, path?: string): unknown {
  if (!path) return undefined
  return path.split('.').reduce<unknown>((value, key) => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      ['__proto__', 'constructor', 'prototype'].includes(key) ||
      !Object.hasOwn(value, key)
    )
      return undefined
    return (value as Record<string, unknown>)[key]
  }, doc)
}

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const dimension = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined

/** Source identity is deliberately independent of the related cover document. */
export function mapDocumentToMediaItem(
  doc: GalleryDocument,
  collection: string,
  options: CollectionGalleryOptions = {},
  adminRoute = '/admin',
): MediaItem {
  const preview = doc.__mediaGallery as MediaItem | undefined
  if (
    preview &&
    preview.id === doc.id &&
    preview.collection === collection &&
    typeof preview.src === 'string'
  ) {
    return { ...preview, originalData: doc }
  }
  const cover = options.coverField ? getFieldValue(doc, options.coverField) : doc
  const upload =
    cover && typeof cover === 'object' && !Array.isArray(cover)
      ? (cover as Record<string, unknown>)
      : {}
  // A relationship ID is not a URL. Relative URLs must begin with a slash.
  const directURL =
    options.coverField && typeof cover === 'string' && /^(https?:\/\/|\/)/i.test(cover)
      ? cover
      : undefined
  const src = directURL ?? text(upload.url) ?? ''
  const filename = text(upload.filename)
  const title = options.titleField
    ? text(getFieldValue(doc, options.titleField)) || 'Untitled'
    : filename
  const mimeType = directURL ? 'image/*' : getMimeType(filename, text(upload.mimeType))
  return {
    id: doc.id,
    collection,
    title,
    subtitle: text(getFieldValue(doc, options.subtitleField)),
    src,
    thumbnail: text(getFieldValue(upload, 'sizes.thumbnail.url')),
    alt: options.altField
      ? (text(getFieldValue(doc, options.altField)) ?? title)
      : text(upload.alt) || title,
    filename,
    type: isImageMime(mimeType)
      ? 'image'
      : isVideoMime(mimeType)
        ? 'video'
        : isAudioMime(mimeType)
          ? 'audio'
          : 'document',
    mimeType,
    width: src ? dimension(upload.width) : 1,
    height: src ? dimension(upload.height) : 1,
    focalX: typeof upload.focalX === 'number' ? upload.focalX : undefined,
    focalY: typeof upload.focalY === 'number' ? upload.focalY : undefined,
    sizes: upload.sizes as MediaItem['sizes'],
    href: `${adminRoute}/collections/${collection}/${encodeURIComponent(doc.id)}`,
    originalData: doc,
  }
}
