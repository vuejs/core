import { BindingTypes } from '@vue/compiler-core'
import { compileSFCScript as compile, assertCode } from './utils'

// this file only tests integration with SFC - main test case for the ref
// transform can be found in <root>/packages/ref-transform/__tests__
describe('<script setup> ref sugar', () => {
  function compileWithRefSugar(src: string) {
    return compile(src, { refSugar: true })
  }

  test('$ unwrapping', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    import { ref, shallowRef } from 'vue'
    let foo = $(ref())
    let a = $(ref(1))
    let b = $(shallowRef({
      count: 0
    }))
    let c = () => {}
    let d
    </script>`)
    expect(content).not.toMatch(`$(ref())`)
    expect(content).not.toMatch(`$(ref(1))`)
    expect(content).not.toMatch(`$(shallowRef({`)
    expect(content).toMatch(`let foo = (ref())`)
    expect(content).toMatch(`let a = (ref(1))`)
    expect(content).toMatch(`
    let b = (shallowRef({
      count: 0
    }))
    `)
    // normal declarations left untouched
    expect(content).toMatch(`let c = () => {}`)
    expect(content).toMatch(`let d`)
    expect(content).toMatch(`return { foo, a, b, c, d, ref, shallowRef }`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.SETUP_REF,
      a: BindingTypes.SETUP_REF,
      b: BindingTypes.SETUP_REF,
      c: BindingTypes.SETUP_LET,
      d: BindingTypes.SETUP_LET,
      ref: BindingTypes.SETUP_CONST,
      shallowRef: BindingTypes.SETUP_CONST
    })
  })

  test('$ref & $shallowRef declarations', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    let foo = $ref()
    let a = $ref(1)
    let b = $shallowRef({
      count: 0
    })
    let c = () => {}
    let d
    </script>`)
    expect(content).toMatch(
      `import { ref as _ref, shallowRef as _shallowRef } from 'vue'`
    )
    expect(content).not.toMatch(`$ref()`)
    expect(content).not.toMatch(`$ref(1)`)
    expect(content).not.toMatch(`$shallowRef({`)
    expect(content).toMatch(`let foo = _ref()`)
    expect(content).toMatch(`let a = _ref(1)`)
    expect(content).toMatch(`
    let b = _shallowRef({
      count: 0
    })
    `)
    // normal declarations left untouched
    expect(content).toMatch(`let c = () => {}`)
    expect(content).toMatch(`let d`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.SETUP_REF,
      a: BindingTypes.SETUP_REF,
      b: BindingTypes.SETUP_REF,
      c: BindingTypes.SETUP_LET,
      d: BindingTypes.SETUP_LET
    })
  })

  describe('errors', () => {
    test('defineProps/Emit() referencing ref declarations', () => {
      expect(() =>
        compile(
          `<script setup>
        let bar = $ref(1)
        defineProps({
          bar
        })
      </script>`,
          { refSugar: true }
        )
      ).toThrow(`cannot reference locally declared variables`)

      expect(() =>
        compile(
          `<script setup>
        let bar = $ref(1)
        defineEmits({
          bar
        })
      </script>`,
          { refSugar: true }
        )
      ).toThrow(`cannot reference locally declared variables`)
    })
  })
})
