import type { ViewType } from './components/ui/Layouts/registry.js'

/** Paths are relative to the source document and may contain dots (e.g. hero.image). */
export interface CollectionGalleryOptions {
  /** Text path, or a single relationship whose admin.useAsTitle supplies the label. */
  titleField?: string
  coverField?: string
  /** Text/relationship path; false hides the subtitle and all fallback labels. Omit to retain defaults. */
  subtitleField?: string | false
  altField?: string
}

export interface PluginOptions {
  /**
   * Collections to enable the gallery view for.
   * Can be an array of collection slugs, e.g. ['media']
   * Or an object with collection slugs as keys and true or field mappings to enable.
   * Defaults to ['media']
   */
  collections?: string[] | Partial<Record<string, true | CollectionGalleryOptions>>

  /**
   * Whether the plugin is disabled or not.
   * Defaults to false.
   */
  disabled?: boolean

  /**
   * The initial view mode to use when no user preference exists.
   * Defaults to 'justified'.
   */
  defaultView?: ViewType

  /**
   * Configure which layouts are available and their display settings.
   */
  layouts?: Partial<
    Record<
      ViewType,
      | boolean
      | {
          enabled?: boolean
          footer?: 'always' | 'hover'
        }
    >
  >

  /**
   * Whether to enable the lightbox gallery.
   * Defaults to true.
   */
  lightbox?: boolean

  /**
   * Whether to enable the quick edit button.
   * Defaults to true.
   */
  edit?: boolean
}
