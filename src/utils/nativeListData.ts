import type { CollectionConfig, Field } from 'payload'
import type { CollectionGalleryOptions } from '../types.js'
import { type GalleryDocument, mapDocumentToMediaItem } from './mapDocument.ts'

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

function relationshipID(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(relationshipID)
  if (!record(value)) return value
  if ('relationTo' in value && 'value' in value)
    return { ...value, value: relationshipID(value.value) }
  return typeof value.id === 'string' || typeof value.id === 'number' ? value.id : value
}

/** Native RelationshipCell expects IDs, including in arrays and nested fields. */
function nativeRelationships(
  doc: Record<string, unknown>,
  fields: Field[],
): Record<string, unknown> {
  let result = { ...doc }
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab && tab.name) {
          if (record(result[tab.name]))
            result[tab.name] = nativeRelationships(
              result[tab.name] as Record<string, unknown>,
              tab.fields,
            )
        } else result = nativeRelationships(result, tab.fields)
      }
    } else if ('name' in field && field.name) {
      const value = result[field.name]
      if (field.type === 'upload' || field.type === 'relationship') {
        // Never reintroduce a field that Payload's access checks removed.
        if (Object.hasOwn(result, field.name)) result[field.name] = relationshipID(value)
      } else if (field.type === 'join' && record(value) && Array.isArray(value.docs)) {
        result[field.name] = { ...value, docs: value.docs.map(relationshipID) }
      } else if ('fields' in field) {
        if (record(value)) result[field.name] = nativeRelationships(value, field.fields)
        else if (Array.isArray(value))
          result[field.name] = value.map((row) =>
            record(row) ? nativeRelationships(row, field.fields) : row,
          )
      } else if (field.type === 'blocks' && Array.isArray(value)) {
        result[field.name] = value.map((row) => {
          if (!record(row)) return row
          const block = field.blocks.find((block) => block.slug === row.blockType)
          return block ? nativeRelationships(row, block.fields) : row
        })
      }
    } else if ('fields' in field) result = nativeRelationships(result, field.fields)
  }
  return result
}

/** Retain gallery previews separately; leave native table/drawer relationship values as IDs. */
export function galleryListResultHook(
  options: CollectionGalleryOptions,
): NonNullable<NonNullable<CollectionConfig['hooks']>['afterOperation']>[number] {
  return ({ args, collection, operation, req, result }) => {
    if (
      operation !== 'find' ||
      'id' in args ||
      !('includeLockStatus' in args) ||
      !args.includeLockStatus ||
      !('docs' in result)
    )
      return result
    return {
      ...result,
      docs: result.docs.map((doc) => {
        const { originalData: _originalData, ...preview } = mapDocumentToMediaItem(
          doc as GalleryDocument,
          collection.slug,
          options,
          req.payload.config.routes.admin,
        )
        return { ...nativeRelationships(doc, collection.fields), __mediaGallery: preview }
      }),
    }
  }
}
