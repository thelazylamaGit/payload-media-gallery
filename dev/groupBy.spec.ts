import { createElement, Fragment, isValidElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { replaceGroupTables } from '../src/utils/groupBy'

const Table = (_: { columns: unknown[]; data: unknown[] }) => null
const Provider = (props: { children?: unknown; docs: unknown[] }) => props.children
const Gallery = (_: { docs: unknown[] }) => null

const group = (value: string, docs: { id: number }[]) =>
  createElement(
    'div',
    { className: 'table-wrap table-wrap--group-by', key: `table-${value}` },
    createElement(
      Provider,
      { docs },
      createElement('header', null, value),
      createElement(Table, { columns: [], data: docs }),
      createElement('nav', null, 'pages'),
    ),
  )

type Props = { children: ReactElement[] }

describe('replaceGroupTables', () => {
  it('replaces each group Table with its docs and keeps the surrounding structure', () => {
    const groups = [group('a', [{ id: 1 }, { id: 2 }]), undefined, group('b', [{ id: 3 }])]
    const result = replaceGroupTables(groups, (docs) => createElement(Gallery, { docs })) as (
      | ReactElement<Props>
      | undefined
    )[]

    expect(result).toHaveLength(3)
    expect(result[1]).toBeUndefined()
    for (const [i, ids] of [
      [0, [1, 2]],
      [2, [3]],
    ] as const) {
      const wrap = result[i] as ReactElement<{ children: ReactElement<Props> }>
      expect(wrap.key).toBe(i === 0 ? 'table-a' : 'table-b')
      const [header, gallery, nav] = wrap.props.children.props.children
      expect(header.type).toBe('header')
      expect(nav.type).toBe('nav')
      expect(gallery.type).toBe(Gallery)
      expect((gallery.props as { docs: { id: number }[] }).docs.map((d) => d.id)).toEqual(ids)
    }
  })

  it('leaves trees without a Table untouched', () => {
    const node = createElement(Fragment, null, createElement('p', null, 'x'))
    const result = replaceGroupTables(node, () => 'replaced')
    expect(isValidElement(result)).toBe(true)
    expect(replaceGroupTables(null, () => 'replaced')).toBeNull()
  })

  it('unwraps lazy (Flight) nodes and keeps replacing inside them', () => {
    const lazy = (value: unknown) => ({
      $$typeof: Symbol.for('react.lazy'),
      _payload: value,
      _init: (payload: unknown) => payload,
    })
    const tree = [lazy(group('a', [{ id: 1 }]))] as unknown as ReactElement[]
    const result = replaceGroupTables(tree, (docs) => createElement(Gallery, { docs })) as {
      key: string
      type: (props: unknown) => ReactElement<{ children: ReactElement<Props> }>
      props: unknown
    }[]

    expect(result[0].key).toBe('lazy-0')
    const wrap = result[0].type(result[0].props)
    const [, gallery] = wrap.props.children.props.children
    expect(gallery.type).toBe(Gallery)
  })
})
