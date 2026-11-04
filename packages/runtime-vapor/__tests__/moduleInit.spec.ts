// Under the `node` condition @vue/runtime-dom resolves to its CJS build, which
// does not export the Vapor interop internals, so importing the runtime must not call them.
vi.mock('@vue/runtime-dom', async importOriginal => {
  const { createInternalObject, ...runtimeDom } =
    await importOriginal<typeof import('@vue/runtime-dom')>()
  return runtimeDom
})

describe('runtime-vapor module init', () => {
  test('does not call createInternalObject when the module is imported', async () => {
    await expect(import('../src')).resolves.toBeDefined()
  })
})
