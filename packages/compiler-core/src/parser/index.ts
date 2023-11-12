import { RootNode, createRoot } from '../ast'
import { ParserOptions } from '../options'
import { Parser } from './Parser'

export function baseParse(
  content: string,
  options: ParserOptions = {}
): RootNode {
  const root = createRoot([])
  new Parser({
    // TODO
  }).end(content)
  return root
}
