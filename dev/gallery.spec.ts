import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'
import { mediaGalleryPlugin } from '../src/index'
import { galleryFieldPaths, resolveGalleryOptions, selectPaths } from '../src/utils/listFields'
import { getFieldValue, mapDocumentToMediaItem } from '../src/utils/mapDocument'

const upload = {
  id: 'cover',
  filename: 'portrait.webp',
  url: '/media/portrait.webp',
  alt: 'Portrait',
  mimeType: 'image/webp',
  width: 600,
  height: 900,
  focalX: 25,
  focalY: 75,
  sizes: { thumbnail: { url: '/media/thumb.webp', width: 200, height: 300 } },
}
const options = {
  titleField: 'profile.name',
  coverField: 'hero.image',
  subtitleField: 'profile.specialty',
  altField: 'hero.alt',
}

describe('document mapper', () => {
  it('distinguishes an explicitly disabled subtitle from default fallback behavior', () => {
    const disabled = mapDocumentToMediaItem(upload, 'photos', { subtitleField: false })
    expect(disabled.subtitle).toBeNull()
    expect(mapDocumentToMediaItem(upload, 'photos').subtitle).toBeUndefined()
    expect(disabled.title).toBe(upload.filename)
    expect(disabled.src).toBe(upload.url)
  })
  it('overrides an upload title while retaining its cover and leaving the subtitle optional', () => {
    const doc = { ...upload, title: 'Custom image title' }
    const item = mapDocumentToMediaItem(doc, 'media', { titleField: 'title' })
    expect(item.title).toBe('Custom image title')
    expect(item.subtitle).toBeUndefined()
    expect(item.src).toBe(upload.url)
    expect(item.filename).toBe(upload.filename)
    expect(item.originalData).toBe(doc)
  })
  it('preserves upload defaults and identity', () => {
    const item = mapDocumentToMediaItem(upload, 'media')
    expect(item).toMatchObject({
      id: 'cover',
      title: upload.filename,
      alt: upload.alt,
      src: upload.url,
      type: 'image',
      width: 600,
      height: 900,
    })
    expect(item.originalData).toBe(upload)
  })
  it('maps nested fields and related metadata without replacing source identity', () => {
    const doc = {
      id: 'practitioner',
      profile: { name: 'Jane', specialty: 'Dental' },
      hero: { image: upload, alt: 'Dr Jane' },
    }
    const item = mapDocumentToMediaItem(doc, 'practitioners', options, '/dashboard')
    expect(item).toMatchObject({
      id: doc.id,
      collection: 'practitioners',
      title: 'Jane',
      subtitle: 'Dental',
      alt: 'Dr Jane',
      src: upload.url,
      thumbnail: upload.sizes.thumbnail.url,
      mimeType: upload.mimeType,
      width: 600,
      height: 900,
      focalX: 25,
      focalY: 75,
      sizes: upload.sizes,
      href: '/dashboard/collections/practitioners/practitioner',
    })
    expect(item.originalData).toBe(doc)
  })
  it.each([
    undefined,
    null,
    'cover-id',
    42,
    [],
    {},
  ])('uses a safe placeholder for missing or unresolved cover %j', (image) => {
    const doc = { id: 'post', hero: { image } }
    const item = mapDocumentToMediaItem(doc, 'posts', options)
    expect(item.src).toBe('')
    expect(item.width).toBeGreaterThan(0)
    expect(item.height).toBeGreaterThan(0)
    expect(item.id).toBe(doc.id)
    expect(item.originalData).toBe(doc)
  })
  it('accepts direct image URLs including query strings and no extension', () => {
    const doc = { id: 7, title: 'Post', image: 'https://images.example/image?width=500' }
    expect(
      mapDocumentToMediaItem(doc, 'posts', { titleField: 'title', coverField: 'image' }),
    ).toMatchObject({ id: 7, type: 'image', src: doc.image, alt: 'Post' })
  })
  it('does not traverse prototypes or arrays', () => {
    expect(getFieldValue({}, 'constructor.name')).toBeUndefined()
    expect(getFieldValue({ covers: [upload] }, 'covers.0.url')).toBeUndefined()
  })
})

describe('collection configuration', () => {
  const config = {
    secret: 'test',
    collections: [
      { slug: 'media', fields: [], upload: true },
      {
        slug: 'posts',
        fields: [],
        forceSelect: { slug: true },
        admin: { defaultColumns: ['slug'] },
      },
    ],
  } as unknown as Config
  it.each([
    ['media'],
    { media: true as const },
  ])('retains legacy configuration %j', async (collections) => {
    const result = await mediaGalleryPlugin({ collections })(config)
    expect(result.collections?.[0].hooks).toBeUndefined()
    expect(result.collections?.[0].forceSelect).toBeUndefined()
    expect(result.collections?.[1]).toBe(config.collections?.[1])
  })
  it('passes serializable mappings and keeps preferences and selection', async () => {
    const result = await mediaGalleryPlugin({ collections: { posts: options } })(config)
    const posts = result.collections?.[1]
    expect(posts?.forceSelect).toEqual({
      slug: true,
      profile: { name: true, specialty: true },
      hero: { image: true, alt: true },
    })
    expect(posts?.admin?.defaultColumns).toEqual(['slug'])
    expect(
      JSON.parse(JSON.stringify(posts?.admin?.components?.views?.list?.Component)),
    ).toMatchObject({ clientProps: { collectionOptions: options } })
  })
  it('does not narrow an existing parent selection', () => {
    expect(selectPaths(['hero.image'], { hero: true })).toEqual({ hero: true })
  })
  it('preserves false through client props without selecting or populating a subtitle field', async () => {
    const result = await mediaGalleryPlugin({
      collections: { posts: { titleField: 'title', subtitleField: false } },
    })(config)
    expect(result.collections?.[1].forceSelect).toEqual({ slug: true, title: true })
    expect(
      JSON.parse(JSON.stringify(result.collections?.[1].admin?.components?.views?.list?.Component)),
    ).toMatchObject({ clientProps: { collectionOptions: { subtitleField: false } } })
    expect(galleryFieldPaths([], { subtitleField: false })).toEqual([])
    expect(resolveGalleryOptions([], { subtitleField: false }, []).subtitleField).toBe(false)
  })
  it('infers a relationship subtitle and selects the source relationship rather than a nested database field', () => {
    const fields: import('payload').Field[] = [
      {
        name: 'modality',
        type: 'relationship',
        relationTo: 'modalities' as import('payload').CollectionSlug,
      },
    ]
    const collections: import('payload').CollectionConfig[] = [
      { slug: 'modalities', fields: [], admin: { useAsTitle: 'name' } },
    ]
    const inferred = resolveGalleryOptions(fields, { subtitleField: 'modality' }, collections)
    expect(inferred).toEqual({ subtitleField: 'modality.name' })
    expect(resolveGalleryOptions(fields, { titleField: 'modality' }, collections)).toEqual({
      titleField: 'modality.name',
    })
    expect(galleryFieldPaths(fields, inferred)).toEqual(['modality'])
    const explicit = { subtitleField: 'modality.details.label' }
    expect(resolveGalleryOptions(fields, explicit, collections)).toEqual(explicit)
    expect(galleryFieldPaths(fields, explicit)).toEqual(['modality'])
  })
})
