import { SourceMapConsumer } from 'source-map'

let _lastSuccessfulMap: SourceMapConsumer | undefined = undefined

export function getLastSuccessfulMap() {
  return _lastSuccessfulMap
}

export function setLastSuccessfulMap(value: SourceMapConsumer) {
  _lastSuccessfulMap = value
}
