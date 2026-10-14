import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'
import { mediaGalleryPlugin } from '../src/index'

describe('mediaGalleryPlugin', async () => {
  const getMockConfig = (): Config =>
    ({
      collections: [
        {
          slug: 'media',
          admin: {
            components: {},
          },
        },
      ],
    }) as Config

  it('should enable plugin by default', async () => {
    const plugin = mediaGalleryPlugin()
    const result = await plugin(getMockConfig())
    const mediaCollection = result.collections?.find((c) => c.slug === 'media')
    expect(mediaCollection?.admin?.components?.views?.list?.Component).toMatchObject({
      path: '@sitebytom/payload-media-gallery/client#MediaGallery',
    })
  })

  it('should disable plugin when disabled is true', async () => {
    const plugin = mediaGalleryPlugin({ disabled: true })
    const result = await plugin(getMockConfig())
    const mediaCollection = result.collections?.find((c) => c.slug === 'media')
    expect(mediaCollection?.admin?.components?.views?.list).toBeUndefined()
  })

  it('should support object syntax for collections', async () => {
    const plugin = mediaGalleryPlugin({
      collections: {
        media: true,
      },
    })
    const result = await plugin(getMockConfig())
    const mediaCollection = result.collections?.find((c) => c.slug === 'media')
    expect(mediaCollection?.admin?.components?.views?.list?.Component).toMatchObject({
      path: '@sitebytom/payload-media-gallery/client#MediaGallery',
    })
  })
})
