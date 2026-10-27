import { cloneElement, createElement, isValidElement, type ReactNode } from 'react'

type TreeProps = { children?: ReactNode; columns?: unknown; data?: unknown }
type Render = (docs: Record<string, unknown>[]) => ReactNode
type LazyNode = { $$typeof: symbol; _payload: unknown; _init: (payload: unknown) => ReactNode }

const REACT_LAZY_TYPE = Symbol.for('react.lazy')

/** Server-rendered (Flight) elements can arrive as lazy wrappers that resolve to the real element. */
const isLazy = (node: unknown): node is LazyNode =>
  !!node && typeof node === 'object' && (node as LazyNode).$$typeof === REACT_LAZY_TYPE

/** Resolve like React does for lazy children: suspends (throws) until the chunk is ready. */
const LazyGroupTree = ({ node, render }: { node: LazyNode; render: Render }) =>
  replaceGroupTables(node._init(node._payload), render)

/**
 * With `groupBy`, Payload renders one server-built tree per group (header, Table, page controls).
 * Swap only the inner Table for the gallery so grouping, per-group selection and paging keep working.
 */
export function replaceGroupTables(node: ReactNode, render: Render): ReactNode {
  if (Array.isArray(node))
    return node.map((child, i) =>
      isLazy(child)
        ? createElement(LazyGroupTree, { key: `lazy-${i}`, node: child, render })
        : replaceGroupTables(child, render),
    )
  if (isLazy(node)) return createElement(LazyGroupTree, { node, render })
  if (!isValidElement<TreeProps>(node)) return node
  const { children, columns, data } = node.props
  if (Array.isArray(columns) && Array.isArray(data)) return render(data)
  if (children === undefined) return node
  // Spread static children so React doesn't treat them as a keyed list.
  return Array.isArray(children)
    ? cloneElement(node, undefined, ...children.map((child) => replaceGroupTables(child, render)))
    : cloneElement(node, undefined, replaceGroupTables(children, render))
}
