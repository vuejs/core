import { initDirectivesForSSR } from 'vue'
initDirectivesForSSR()

// public
export type { SSRContext } from './render'
export { renderToString } from './renderToString'
export {
  renderToSimpleStream,
  renderToNodeStream,
  pipeToNodeWritable,
  renderToWebStream,
  pipeToWebWritable,
  type SimpleReadable,
  // deprecated
  renderToStream,
} from './renderToStream'
export class MultipleErrors extends Error {
  constructor(
    message: string,
    public errors: unknown[],
  ) {
    super(message)
  }
}

// internal runtime helpers
export * from './internal'
