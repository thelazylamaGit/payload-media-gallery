![Payload Media Gallery](.github/assets/banner.webp)

# Payload Media Gallery Plugin
A Payload CMS 3 plugin that enhances the dashboard media collection view. It adds view toggles for justified and grid layouts while keeping the original list view. Features include quick edit drawer, bulk selection and a lightbox for images, video playback, and audio files.

## Features
- **Layouts**: Toggle between **Justified**, **Grid**, and **List** views.
- **Quick Edit** via native Payload drawers.
- **Bulk Selection** with keyboard modifiers (Cmd/Ctrl/Shift + Click).
- **Lightbox**: Immersive viewer with zoom, pan, keyboard navigation, and touch support.
- **Rich Media**: Supports images, audio, and video playback with hover previews.
- **Drag-and-drop ordering**: Reorder items by dragging cards (set `orderable: true` in collection config).
- **Payload-Native UI** that fits right into your dashboard.

## Installation
```bash
pnpm add @sitebytom/payload-media-gallery
```

## Usage
In your `payload.config.ts`:
```ts
import { buildConfig } from 'payload'
import { mediaGalleryPlugin } from '@sitebytom/payload-media-gallery'

export default buildConfig({
  // ...
  plugins: [
    mediaGalleryPlugin({
      collections: {
        media: true,
        practitioners: {
          titleField: 'name',
          coverField: 'portrait',
          subtitleField: 'specialty',
        },
        posts: {
          titleField: 'title',
          coverField: 'hero.image',
        },
      },
      defaultView: 'justified', // 'justified' | 'masonry' | 'grid' | 'list'
      layouts: {
        justified: {
          enabled: true,
          footer: 'hover', // 'hover' | 'always'
        },
        masonry: {
          enabled: true,
          footer: 'hover', // 'hover' | 'always'
        },
        grid: {
          enabled: true,
          footer: 'hover', // 'hover' | 'always'
        },
      },
      lightbox: true,
      edit: true,
      disabled: false,
    }),
  ],
})
```

## Options
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `collections` | `string[] \| object` | `['media']` | Collections to enable the gallery for. |
| `defaultView` | `ViewType` | `'justified'` | The initial view mode if no preference exists. |
| `layouts` | `object` | `{}` | Configure available layouts and their footer mode. |
| `lightbox` | `boolean` | `true` | Whether to enable the lightbox gallery. |
| `edit` | `boolean` | `true` | Whether to enable the quick edit button. |
| `disabled` | `boolean` | `false` | Whether to disable the plugin. |

## Collection card fields

`collections: ['media']` and `collections: { media: true }` continue to use the upload
document's filename, URL, alt text and media metadata. An options object enables
field mappings for an ordinary collection (or overrides fields on an upload collection).
The exported `CollectionGalleryOptions` type describes these serializable options:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `titleField` | `string` | Cover/upload filename | Text path or single relationship used for card and lightbox titles. Missing configured titles display `Untitled`. |
| `coverField` | `string` | Source upload document | Single upload relationship, populated upload document, or image URL field. |
| `subtitleField` | `string \| false` | Existing fallback label | Text path or a single relationship's display field. `false` hides both custom subtitles and fallback labels. Long subtitles truncate on cards; full text is available on hover and in the lightbox. |
| `alwaysShowTitle` | `boolean` | `false` | Keep the title area (including any subtitle) visible in all gallery layouts. Underlines and edit controls still reveal on hover. Applies only to the configured collection. |
| `altField` | `string` | Cover/upload alt text, then title | Source text field used for image alt text. Missing configured alt text falls back to the title. |

Paths are relative to the **source document** and support nested groups and named tabs,
for example `hero.image` or `profile.name`. Covers may be a single `upload` field or
a single non-polymorphic `relationship` to an upload collection. Direct image URLs
must start with `http://`, `https://`, or `/`; they do not provide upload sizes,
dimensions or focal points. Related uploads supply those values when available,
including `sizes.thumbnail` for card previews.

Omitting `subtitleField` retains the existing fallback behavior. Set `subtitleField: false`
to give the title the full footer width:

```ts
practitioners: { titleField: 'name', coverField: 'portrait', subtitleField: false }
```

Card subtitles use `.media-card__label` and can be styled in your project's admin
stylesheet. These optional CSS variables adjust contrast without changing the defaults:

```css
.media-card {
  --media-gallery-subtitle-color: var(--theme-text);
  --media-gallery-footer-background: var(--theme-elevation-50);
}
```

The example uses an opaque footer background. You can also target `.media-card__label`
directly to customize its font, weight, or other text styles.

To keep the title area visible for a specific collection while retaining hover actions:

```ts
practitioners: {
  titleField: 'name',
  coverField: 'portrait',
  subtitleField: false,
  alwaysShowTitle: true,
}
```

The option overrides a layout's `footer: 'hover'` for that collection. The underline
appears on hover or keyboard focus; edit, expand and selection controls retain their
existing behavior. Omit the option to keep the current layout behavior.

Masonry places each next card in the shortest column using preview dimensions.
It preserves full image proportions: a 440×2000 image is about 4.55 times the column
width in height. Balancing reduces long uneven column tails, but an unusually tall
image can still extend below its neighbors. Unknown dimensions use a square estimate.

For a single relationship title or subtitle, `titleField: 'modality'` or
`subtitleField: 'modality'` uses the related
collection's `admin.useAsTitle` (or `id` if unset). Use `subtitleField: 'modality.name'`
to choose a label explicitly, including a nested text path such as `modality.details.label`.
The relationship and label are selected and populated independently of visible columns
and cover type, through Payload's native batched reads. Collection and field access
still apply. The label must be text; multiple relationships and relationship chains
are not supported.

The source ID and collection are used for edit links, quick edit, bulk selection,
list drawers and ordering. A cover never replaces the source document's identity.
Missing, deleted, inaccessible or unresolved covers display a placeholder with safe
layout dimensions and have no lightbox action. Failed card previews also hide that action.

### List loading and access

Payload 3.90.2's native list and list drawer reads use `depth: 0` and select visible
columns. The plugin merges mapped fields (and `_order` for orderable collections)
into `forceSelect`. This also affects other inclusion-select queries on the configured
collection; it does not bypass field access. For native reads with `includeLockStatus: true`,
the plugin raises depth to at least one and selects upload metadata and related subtitle labels through `populate`.
Payload's request dataloader batches related uploads, with the original request's access,
locale and draft settings. No browser fetch is added per card. Queries without lock status
keep their original depth, so an ID-only cover passed outside the list remains a placeholder.

Native relationship cells expect IDs, so list responses retain those IDs and carry
authorized gallery preview metadata separately in `__mediaGallery`. This is response-only
data: the plugin does not add database fields, run migrations, or write documents.

Search, filters, sorting, pagination, column preferences and view preferences remain
managed by Payload's native list. Existing collection hooks and forced selections are retained.
Field `maxDepth: 0` and access restrictions are respected, and can prevent a cover from resolving.

### Limitations and validation

One cover per document is supported. Arrays, blocks, polymorphic relationships,
multiple-image galleries and arbitrary rendering callbacks are out of scope. Mapping
paths do not traverse arrays or follow chains of relationships. A subtitle may traverse
one single relationship. Titles and subtitles may traverse one single relationship. Folder and grouped list
views remain outside the supported gallery scope.

The dev app includes `practitioners` with a hidden portrait column and a placeholder
document, and `posts` with a nested `hero.image` cover. Focused tests can be run with:

```sh
pnpm exec vitest run dev/plugin.spec.ts dev/gallery.spec.ts dev/gallery-payload.spec.ts
pnpm test:e2e
pnpm build
```

The integration suite starts its own temporary MongoDB instance (first run downloads
the MongoDB binary) and verifies native list selection, batched population, access,
sorting, pagination and source identity on Payload 3.90.2.

> ### **⚠️ Experimental**
> An "as-is" personal concept for Payload CMS. Maintenance is not guaranteed.
> * **Scope:** Works in **"All Media"** view; unsupported in **Folders**.
> * **Tested:** Payload 3.90.2 | Next.js 16.3.3 | React 19.2.3
