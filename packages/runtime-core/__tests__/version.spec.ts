import { version } from '../src'
import packageJson from '../package.json'

test('version', () => {
  expect(version).toBe(packageJson.version)
})
