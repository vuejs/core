import { initDirectivesForSSR } from 'vue'
initDirectivesForSSR()

// public
export { SSRContext } from './render'
export { renderToString } from './renderToString'
export {
  renderToSimpleStream,
  renderToNodeStream,
  pipeToNodeWritable,
  renderToWebStream,
  pipeToWebWritable,
  SimpleReadable,
  // deprecated
  renderToStream
} from './renderToStream'

// internal runtime helpers
export * from './internal'
