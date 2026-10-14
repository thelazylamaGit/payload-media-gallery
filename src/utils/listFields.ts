import type {
  CollectionConfig,
  CollectionSlug,
  Field,
  SelectIncludeType,
  SelectType,
} from 'payload'
import type { CollectionGalleryOptions } from '../types.js'

export const uploadSelect: SelectIncludeType = {
  url: true,
  filename: true,
  mimeType: true,
  width: true,
  height: true,
  sizes: true,
  focalX: true,
  focalY: true,
  alt: true,
}

export function selectPaths(
  paths: (string | undefined)[],
  existing: SelectType = {},
): SelectIncludeType {
  const select = { ...existing }
  for (const path of paths) {
    if (!path) continue
    const parts = path.split('.')
    if (parts.some((part) => !part || ['__proto__', 'constructor', 'prototype'].includes(part)))
      continue
    let node = select
    for (const [index, part] of parts.entries()) {
      if (index === parts.length - 1) node[part] = true
      else if (node[part] === true) break
      else {
        node[part] = { ...(typeof node[part] === 'object' ? node[part] : {}) }
        node = node[part] as SelectIncludeType
      }
    }
  }
  return select as SelectIncludeType
}

function findField(fields: Field[], path: string): Field | undefined {
  for (const field of fields) {
    if ('name' in field && field.name) {
      if (field.name === path) return field
      if (path.startsWith(`${field.name}.`) && 'fields' in field) {
        const found = findField(field.fields, path.slice(field.name.length + 1))
        if (found) return found
      }
    } else if ('fields' in field) {
      const found = findField(field.fields, path)
      if (found) return found
    } else if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const tabPath = 'name' in tab && tab.name ? `${tab.name}.` : ''
        if (path.startsWith(tabPath)) {
          const found = findField(tab.fields, path.slice(tabPath.length))
          if (found) return found
        }
      }
    }
  }
}

function relationshipAtPath(fields: Field[], path?: string) {
  if (!path) return undefined
  const parts = path.split('.')
  for (let length = 1; length <= parts.length; length++) {
    const sourcePath = parts.slice(0, length).join('.')
    const field = findField(fields, sourcePath)
    if (
      field &&
      (field.type === 'relationship' || field.type === 'upload') &&
      !field.hasMany &&
      typeof field.relationTo === 'string'
    ) {
      return { sourcePath, target: field.relationTo, relativePath: parts.slice(length).join('.') }
    }
  }
}

/** Resolve relationship titles/subtitles to their collection's native display field. */
export function resolveGalleryOptions(
  fields: Field[],
  options: CollectionGalleryOptions,
  collections: CollectionConfig[],
): CollectionGalleryOptions {
  const resolved = { ...options }
  for (const key of ['titleField', 'subtitleField'] as const) {
    const path = options[key]
    if (typeof path !== 'string') continue
    const relation = relationshipAtPath(fields, path)
    if (!relation || relation.relativePath) continue
    const label =
      collections.find((collection) => collection.slug === relation.target)?.admin?.useAsTitle ||
      'id'
    resolved[key] = `${relation.sourcePath}.${label}`
  }
  return resolved
}

export function galleryFieldPaths(
  fields: Field[],
  options: CollectionGalleryOptions,
): (string | undefined)[] {
  return Object.values(options)
    .filter((path): path is string => typeof path === 'string')
    .map((path) => relationshipAtPath(fields, path)?.sourcePath ?? path)
}

function includedFields(select?: object): SelectIncludeType {
  const result: SelectIncludeType = {}
  for (const [key, value] of Object.entries(select || {})) {
    if (value === true) result[key] = true
    else if (value && typeof value === 'object') result[key] = includedFields(value)
  }
  return result
}

function selectedPaths(select: SelectIncludeType, prefix = ''): string[] {
  return Object.entries(select).flatMap(([key, value]) => {
    const path = `${prefix}${key}`
    return value === true ? [path] : selectedPaths(value, `${path}.`)
  })
}

/** Payload's native list and list drawer find calls include lock status and use depth zero. */
export function galleryListHook(
  fields: Field[],
  options: CollectionGalleryOptions,
): NonNullable<NonNullable<CollectionConfig['hooks']>['beforeOperation']>[number] {
  const cover = options.coverField ? findField(fields, options.coverField) : undefined
  const target =
    cover &&
    (cover.type === 'upload' || cover.type === 'relationship') &&
    !cover.hasMany &&
    typeof cover.relationTo === 'string'
      ? cover.relationTo
      : undefined
  const labels = [options.titleField, options.subtitleField]
    .filter((path): path is string => typeof path === 'string')
    .map((path) => relationshipAtPath(fields, path))
    .filter((relation) => !!relation?.relativePath)
  return ({ args, operation }) => {
    if (
      operation !== 'read' ||
      (!target && !labels.length) ||
      !args.req ||
      'id' in args ||
      !('includeLockStatus' in args) ||
      !args.includeLockStatus
    )
      return args
    // Native population shares Payload's request dataloader, access checks and locale.
    const required: Record<string, SelectIncludeType> = {}
    if (target && args.req.payload.collections[target]?.config.upload)
      required[target] = uploadSelect
    for (const label of labels) {
      if (label) required[label.target] = selectPaths([label.relativePath], required[label.target])
    }
    if (!Object.keys(required).length) return args
    args.depth = Math.max(args.depth ?? args.req.payload.config.defaultDepth, 1)
    args.populate = { ...args.populate }
    for (const [slug, select] of Object.entries(required)) {
      const collectionSlug = slug as CollectionSlug
      args.populate = {
        ...args.populate,
        [slug]: selectPaths(
          selectedPaths(select),
          includedFields(
            args.populate[collectionSlug] ??
              args.req.payload.collections[collectionSlug]?.config.defaultPopulate,
          ),
        ),
      }
    }
    return args
  }
}
