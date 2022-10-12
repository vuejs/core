import { getPriorProps } from '../src/patchProp'

describe('runtime-dom: prior props', () => {
  test('img', () => {
    const priorProps = getPriorProps('img')
    expect(priorProps).toHaveLength(1)
    expect(priorProps).toContain('loading')
  })
})
