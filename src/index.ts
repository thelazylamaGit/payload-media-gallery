import type { Plugin } from 'payload'
import type { PluginOptions } from './types.js'
import {
  galleryFieldPaths,
  galleryListHook,
  resolveGalleryOptions,
  selectPaths,
} from './utils/listFields.ts'
import { galleryListResultHook } from './utils/nativeListData.ts'

export type { CollectionGalleryOptions, PluginOptions } from './types.js'

/**
 * A Payload CMS 3 plugin that enhances the Media List View with Grid, Masonry, and Lightbox views, including video previews.
 */
export const mediaGalleryPlugin =
  (options: PluginOptions = {}): Plugin =>
  (config) => {
    const {
      collections = ['media'],
      defaultView,
      layouts,
      lightbox = true,
      edit = true,
      disabled = false,
    } = options

    if (disabled) {
      return config
    }

    const enabledCollections = Array.isArray(collections)
      ? collections
      : Object.keys(collections).filter((slug) => collections[slug])

    return {
      ...config,
      collections: (config.collections || []).map((collection) => {
        if (enabledCollections.includes(collection.slug)) {
          const collectionOptions =
            !Array.isArray(collections) && typeof collections[collection.slug] === 'object'
              ? resolveGalleryOptions(
                  collection.fields,
                  collections[collection.slug] as import('./types.js').CollectionGalleryOptions,
                  config.collections || [],
                )
              : undefined
          return {
            ...collection,
            ...(collectionOptions
              ? {
                  forceSelect: selectPaths(
                    [
                      ...galleryFieldPaths(collection.fields, collectionOptions),
                      ...(collection.orderable ? ['_order'] : []),
                    ],
                    collection.forceSelect,
                  ),
                  hooks: {
                    ...collection.hooks,
                    beforeOperation: [
                      ...(collection.hooks?.beforeOperation || []),
                      galleryListHook(collection.fields, collectionOptions),
                    ],
                    afterOperation: [
                      ...(collection.hooks?.afterOperation || []),
                      galleryListResultHook(collectionOptions),
                    ],
                  },
                }
              : {}),
            admin: {
              ...collection.admin,
              components: {
                ...(collection.admin?.components || {}),
                views: {
                  ...(collection.admin?.components?.views || {}),
                  list: {
                    ...(collection.admin?.components?.views?.list || {}),
                    Component: {
                      path: '@sitebytom/payload-media-gallery/client#MediaGallery',
                      clientProps: {
                        defaultView,
                        layouts,
                        lightbox,
                        edit,
                        collectionOptions,
                      },
                    },
                  },
                },
              },
            },
          }
        }
        return collection
      }),
    }
  }
