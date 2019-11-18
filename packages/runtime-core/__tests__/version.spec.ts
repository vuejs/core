import { version } from '../src'
import lernaJson from '../../../lerna.json'

test('version', () => {
  expect(version).toBe(lernaJson.version)
})
