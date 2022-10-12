import { getPriorityProps } from '../src/patchProp'

describe('runtime-dom: prior props', () => {
  test('img', () => {
    const priorProps = getPriorityProps('img')
    expect(priorProps).toHaveLength(1)
    expect(priorProps).toContain('loading')
  })

  test('p', () => {
    const priorProps = getPriorityProps('p')
    expect(priorProps).toHaveLength(0)
  })
})
