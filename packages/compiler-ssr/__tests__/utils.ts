import { compile } from '../src'

export function getCompiledString(src: string): string {
  return compile(src).code.match(/_push\(([^]*)\)/)![1]
}
