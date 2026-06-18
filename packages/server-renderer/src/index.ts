import { initDirectivesForSSR } from 'vue'
initDirectivesForSSR()

// public
export type { SSRBuffer, SSRBufferItem, SSRContext } from './render'
export { createBuffer } from './render'
export { renderToString, unrollBuffer } from './renderToString'
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
