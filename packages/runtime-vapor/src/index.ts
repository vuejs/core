export { template } from './template'
export * from './render'
export * from './on'

type Children = Record<number, [ChildNode, Children]>
export function children(n: ChildNode): Children {
  return { ...Array.from(n.childNodes).map(n => [n, children(n)]) }
}
