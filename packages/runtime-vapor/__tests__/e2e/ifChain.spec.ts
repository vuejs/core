import { compile } from '@vue/compiler-vapor'
import * as runtimeDom from '@vue/runtime-dom'
import * as runtimeVapor from '@vue/runtime-vapor'

// Runs in a real browser (vitest browser mode): the stack budget there is
// what a nested `v-else-if` chain overflows, jsdom under Node does not.
const { createVaporApp } = runtimeVapor
const { nextTick, ref } = runtimeDom

const BRANCHES = 500

function chainTemplate(n: number): string {
  const lines: string[] = []
  for (let i = 0; i < n; i++) {
    const dir =
      i === 0
        ? `v-if="selected === ${i}"`
        : i === n - 1
          ? 'v-else'
          : `v-else-if="selected === ${i}"`
    lines.push(`<div ${dir}>branch ${i}</div>`)
  }
  return `<section>${lines.join('\n')}</section>`
}

function compileRender(template: string): any {
  const { code } = compile(template, {
    mode: 'module',
    prefixIdentifiers: true,
  })
  const transformed = code
    .replace(/\bimport {/g, 'const {')
    .replace(/ as _/g, ': _')
    .replace(/} from ['"]vue['"];/g, '} = Vue;')
    .replace(/export function render/, 'function render')
  return new Function('Vue', `${transformed}\nreturn render`)({
    ...runtimeDom,
    ...runtimeVapor,
  })
}

function mountChain(initial: number) {
  const errors: unknown[] = []
  const selected = ref(initial)
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createVaporApp({
    setup: () => ({ selected }),
    render: compileRender(chainTemplate(BRANCHES)),
  })
  app.config.errorHandler = err => {
    errors.push(err)
  }
  app.mount(root)
  return { app, root, selected, errors }
}

describe('e2e: long v-else-if chain', () => {
  test('mounts the last branch', () => {
    const { app, root, errors } = mountChain(BRANCHES - 1)
    expect(errors).toEqual([])
    expect(root.textContent).toBe(`branch ${BRANCHES - 1}`)
    app.unmount()
    expect(root.innerHTML).toBe('')
    root.remove()
  })

  test('switches between the first and the last branch', async () => {
    const { app, root, selected, errors } = mountChain(0)
    expect(root.textContent).toBe('branch 0')

    selected.value = BRANCHES - 1
    await nextTick()
    expect(errors).toEqual([])
    expect(root.textContent).toBe(`branch ${BRANCHES - 1}`)

    selected.value = 0
    await nextTick()
    expect(errors).toEqual([])
    expect(root.textContent).toBe('branch 0')

    app.unmount()
    expect(root.innerHTML).toBe('')
    root.remove()
  })
})
