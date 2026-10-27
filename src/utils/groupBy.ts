import { cloneElement, isValidElement, type ReactNode } from 'react'

type TreeProps = { children?: ReactNode; columns?: unknown; data?: unknown }

/**
 * With `groupBy`, Payload renders one server-built tree per group (header, Table, page controls).
 * Swap only the inner Table for the gallery so grouping, per-group selection and paging keep working.
 */
export function replaceGroupTables(
  node: ReactNode,
  render: (docs: Record<string, unknown>[]) => ReactNode,
): ReactNode {
  if (Array.isArray(node)) return node.map((child) => replaceGroupTables(child, render))
  if (!isValidElement<TreeProps>(node)) return node
  const { children, columns, data } = node.props
  if (Array.isArray(columns) && Array.isArray(data)) return render(data)
  if (children === undefined) return node
  // Spread static children so React doesn't treat them as a keyed list.
  return Array.isArray(children)
    ? cloneElement(node, undefined, ...children.map((child) => replaceGroupTables(child, render)))
    : cloneElement(node, undefined, replaceGroupTables(children, render))
}
