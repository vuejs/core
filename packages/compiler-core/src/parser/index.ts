import { RootNode, createRoot } from '../ast'
import { ParserOptions } from '../options'
import { Parser } from './Parser'

const parser = new Parser({
  // TODO
})

export function baseParse(
  content: string,
  options: ParserOptions = {}
): RootNode {
  const root = createRoot([])
  parser.parse(content)
  return root
}
