import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { buildConfig, type CollectionSlug, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mediaGalleryPlugin } from '../src/index'
import type { CollectionGalleryOptions } from '../src/types'
import { type GalleryDocument, mapDocumentToMediaItem } from '../src/utils/mapDocument'

let mongo: MongoMemoryServer
let payload: Payload
let coverID: string | number
let deniedID: string | number
const subtitleSlug = 'subtitle-docs' as CollectionSlug
const modalitySlug = 'modalities' as CollectionSlug
beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  payload = await getPayload({
    config: await buildConfig({
      secret: 'gallery-integration-test',
      db: mongooseAdapter({ url: mongo.getUri() }),
      collections: [
        {
          slug: modalitySlug,
          admin: { useAsTitle: 'name' },
          defaultPopulate: { id: true },
          access: { read: ({ req }) => !req.context.hideModality },
          fields: [
            { name: 'details', type: 'group', fields: [{ name: 'label', type: 'text' }] },
            {
              name: 'name',
              type: 'text',
              access: { read: ({ req }) => !req.context.hideModalityName },
            },
          ],
        },
        {
          slug: subtitleSlug,
          access: { read: () => true },
          fields: [
            { name: 'name', type: 'text' },
            { name: 'modality', type: 'relationship', relationTo: modalitySlug },
            { name: 'coverURL', type: 'text' },
          ],
        },
        {
          slug: 'media',
          upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
          defaultPopulate: { filename: true },
          access: { read: () => ({ public: { equals: true } }) },
          fields: [
            { name: 'public', type: 'checkbox' },
            { name: 'alt', type: 'text', access: { read: () => false } },
          ],
        },
        {
          slug: 'practitioners',
          access: { read: () => true },
          orderable: true,
          admin: { defaultColumns: ['name'], enableListViewSelectAPI: true },
          fields: [
            { name: 'name', type: 'text' },
            { name: 'specialty', type: 'text' },
            {
              name: 'hero',
              type: 'group',
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  access: { read: ({ req }) => !req.context.hideCover },
                },
              ],
            },
          ],
        },
      ],
      plugins: [
        mediaGalleryPlugin({
          collections: {
            media: true,
            [subtitleSlug]: {
              titleField: 'modality.details.label',
              subtitleField: 'modality',
              coverField: 'coverURL',
            },
            practitioners: {
              titleField: 'name',
              subtitleField: 'specialty',
              coverField: 'hero.image',
            },
          },
        }),
      ],
    }),
  })
  // This isolated config has extra access-test fields beyond the dev app's generated types.
  const modalityData = { name: 'Nurse', details: { label: 'Nurse title' } }
  const modality = await payload.create({ collection: modalitySlug, data: modalityData })
  const subtitleData = {
    name: 'Relationship subtitle',
    modality: modality.id,
    coverURL: '/portrait.jpg',
  }
  await payload.create({ collection: subtitleSlug, data: subtitleData })
  const coverData = {
    public: true,
    alt: 'Hidden alt',
    filename: 'portrait.webp',
    mimeType: 'image/webp',
    width: 600,
    height: 900,
  }
  const cover = await payload.create({ collection: 'media', data: coverData })
  coverID = cover.id
  const deniedData = { public: false, filename: 'private.webp' }
  const denied = await payload.create({ collection: 'media', data: deniedData })
  deniedID = denied.id
  for (const data of [
    { name: 'Jane', specialty: 'Dental', hero: { image: coverID } },
    { name: 'Jane2', hero: { image: coverID } },
    { name: 'Denied', hero: { image: deniedID } },
  ]) {
    await payload.create({ collection: 'practitioners', data })
  }
}, 120_000)
afterAll(async () => {
  await payload?.destroy()
  await mongo?.stop()
})

describe('Payload native list query (3.90.2)', () => {
  it('does not write gallery metadata or change stored relationships', async () => {
    const update = vi.spyOn(payload.db, 'updateOne')
    try {
      const before = await payload.find({
        collection: 'practitioners',
        depth: 0,
        where: { name: { equals: 'Jane' } },
      })
      await payload.find({
        collection: 'practitioners',
        depth: 0,
        includeLockStatus: true,
        select: { name: true },
        overrideAccess: false,
      })
      const after = await payload.find({
        collection: 'practitioners',
        depth: 0,
        where: { name: { equals: 'Jane' } },
      })
      expect(after.docs).toEqual(before.docs)
      expect(after.docs[0]).not.toHaveProperty('__mediaGallery')
      expect(update).not.toHaveBeenCalled()
    } finally {
      update.mockRestore()
    }
  })
  it('infers and populates relationship subtitles without an upload cover or visible subtitle column', async () => {
    const result = await payload.find({
      collection: subtitleSlug,
      depth: 0,
      includeLockStatus: true,
      select: { name: true },
      overrideAccess: false,
    })
    const component = payload.collections[subtitleSlug].config.admin.components?.views?.list
      ?.Component as { clientProps: { collectionOptions: CollectionGalleryOptions } }
    expect(component.clientProps.collectionOptions.subtitleField).toBe('modality.name')
    expect(typeof (result.docs[0] as unknown as GalleryDocument).modality).toBe('string')
    const item = mapDocumentToMediaItem(
      result.docs[0] as unknown as GalleryDocument,
      subtitleSlug,
      component.clientProps.collectionOptions,
    )
    expect(item.subtitle).toBe('Nurse')
    expect(item.title).toBe('Nurse title')
    expect(item.id).toBe(result.docs[0].id)
    expect(item.src).toBe('/portrait.jpg')
  })
  it.each([
    { hideModality: true },
    { hideModalityName: true },
  ])('respects access for relationship subtitles %j', async (context) => {
    const result = await payload.find({
      collection: subtitleSlug,
      depth: 0,
      includeLockStatus: true,
      select: { name: true },
      overrideAccess: false,
      context,
    })
    const item = mapDocumentToMediaItem(
      result.docs[0] as unknown as GalleryDocument,
      subtitleSlug,
      { subtitleField: 'modality.name' },
    )
    expect(item.subtitle).toBeUndefined()
    expect(item.id).toBe(result.docs[0].id)
  })
  it('selects hidden mapped fields and populates ID-only covers using native list arguments', async () => {
    const result = await payload.find({
      collection: 'practitioners',
      depth: 0,
      includeLockStatus: true,
      select: { name: true },
      overrideAccess: false,
      where: { name: { equals: 'Jane' } },
      limit: 1,
      sort: 'name',
    })
    const doc = result.docs[0] as GalleryDocument
    const item = mapDocumentToMediaItem(doc, 'practitioners', {
      titleField: 'name',
      subtitleField: 'specialty',
      coverField: 'hero.image',
    })
    expect(doc.hero).toMatchObject({ image: coverID })
    expect(item).toMatchObject({ filename: 'portrait.webp', width: 600, height: 900 })
    expect(item.subtitle).toBe('Dental')
    expect(item.src).toContain('portrait.webp')
    expect(item.id).toBe(doc.id)
    expect(item.id).not.toBe(coverID)
    expect(item.href).toContain(`/practitioners/${doc.id}`)
    expect(item.originalData).toBe(doc)
    expect(item.originalData._order).toBeDefined()
    expect((doc.__mediaGallery as { alt: string }).alt).toBe('Jane')
    expect(result.totalDocs).toBe(1)
  })
  it('enforces related collection read access', async () => {
    const result = await payload.find({
      collection: 'practitioners',
      depth: 0,
      includeLockStatus: true,
      select: { name: true },
      overrideAccess: false,
      where: { name: { equals: 'Denied' } },
    })
    expect(
      mapDocumentToMediaItem(result.docs[0] as GalleryDocument, 'practitioners', {
        coverField: 'hero.image',
      }).src,
    ).toBe('')
  })
  it('enforces source field access even with forceSelect', async () => {
    const result = await payload.find({
      collection: 'practitioners',
      depth: 0,
      includeLockStatus: true,
      select: { name: true },
      overrideAccess: false,
      context: { hideCover: true },
      where: { name: { equals: 'Jane' } },
    })
    expect(
      mapDocumentToMediaItem(result.docs[0] as GalleryDocument, 'practitioners', {
        coverField: 'hero.image',
      }).src,
    ).toBe('')
  })
  it('leaves non-list depth zero reads ID-only', async () => {
    const result = await payload.find({
      collection: 'practitioners',
      depth: 0,
      where: { name: { equals: 'Jane' } },
    })
    expect((result.docs[0] as unknown as GalleryDocument).hero).toMatchObject({ image: coverID })
  })
  it('batches cover population and preserves sorting and pagination', async () => {
    const spy = vi.spyOn(payload, 'find')
    try {
      const result = await payload.find({
        collection: 'practitioners',
        depth: 0,
        includeLockStatus: true,
        select: { name: true },
        overrideAccess: false,
        where: { name: { in: ['Jane', 'Jane2'] } },
        sort: '-name',
        limit: 2,
      })
      expect(result.docs.map((doc) => doc.name)).toEqual(['Jane2', 'Jane'])
      expect(spy.mock.calls.filter(([args]) => args.collection === 'media')).toHaveLength(1)
      const page = await payload.find({
        collection: 'practitioners',
        depth: 0,
        includeLockStatus: true,
        select: { name: true },
        overrideAccess: false,
        where: { name: { in: ['Jane', 'Jane2'] } },
        sort: '-name',
        limit: 1,
        page: 2,
      })
      expect(page.docs[0].name).toBe('Jane')
      expect(page.totalDocs).toBe(2)
      expect(page.totalPages).toBe(2)
    } finally {
      spy.mockRestore()
    }
  })
})
