import { initDirectivesForSSR } from '@vue/runtime-dom'
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

// internal runtime helpers
export * from './internal'
