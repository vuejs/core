import { BindingTypes } from '@vue/compiler-core'
import { compileSFCScript as compile, assertCode } from './utils'

describe('<script setup> ref sugar', () => {
  function compileWithRefSugar(src: string) {
    return compile(src, { refSugar: true })
  }

  test('$ref declarations', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    let foo = $ref()
    let a = $ref(1)
    let b = $ref({
      count: 0
    })
    let c = () => {}
    let d
    </script>`)
    expect(content).toMatch(`import { ref as _ref } from 'vue'`)
    expect(content).not.toMatch(`$ref()`)
    expect(content).not.toMatch(`$ref(1)`)
    expect(content).not.toMatch(`$ref({`)
    expect(content).toMatch(`let foo = _ref()`)
    expect(content).toMatch(`let a = _ref(1)`)
    expect(content).toMatch(`
    let b = _ref({
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

  test('multi $ref declarations', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    let a = $ref(1), b = $ref(2), c = $ref({
      count: 0
    })
    </script>`)
    expect(content).toMatch(`
    let a = _ref(1), b = _ref(2), c = _ref({
      count: 0
    })
    `)
    expect(content).toMatch(`return { a, b, c }`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      a: BindingTypes.SETUP_REF,
      b: BindingTypes.SETUP_REF,
      c: BindingTypes.SETUP_REF
    })
  })

  test('$computed declaration', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    const a = $computed(() => 1)
    </script>`)
    expect(content).toMatch(`
    const a = _computed(() => 1)
    `)
    expect(content).toMatch(`return { a }`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      a: BindingTypes.SETUP_REF
    })
  })

  test('mixing $ref & $computed declarations', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    let a = $ref(1), b = $computed(() => a + 1)
    </script>`)
    expect(content).toMatch(`
    let a = _ref(1), b = _computed(() => a.value + 1)
    `)
    expect(content).toMatch(`return { a, b }`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      a: BindingTypes.SETUP_REF,
      b: BindingTypes.SETUP_REF
    })
  })

  test('accessing ref binding', () => {
    const { content } = compileWithRefSugar(`<script setup>
    let a = $ref(1)
    console.log(a)
    function get() {
      return a + 1
    }
    </script>`)
    expect(content).toMatch(`console.log(a.value)`)
    expect(content).toMatch(`return a.value + 1`)
    assertCode(content)
  })

  test('cases that should not append .value', () => {
    const { content } = compileWithRefSugar(`<script setup>
    let a = $ref(1)
    console.log(b.a)
    function get(a) {
      return a + 1
    }
    </script>`)
    expect(content).not.toMatch(`a.value`)
  })

  test('mutating ref binding', () => {
    const { content } = compileWithRefSugar(`<script setup>
    let a = $ref(1)
    let b = $ref({ count: 0 })
    function inc() {
      a++
      a = a + 1
      b.count++
      b.count = b.count + 1
      ;({ a } = { a: 2 })
      ;[a] = [1]
    }
    </script>`)
    expect(content).toMatch(`a.value++`)
    expect(content).toMatch(`a.value = a.value + 1`)
    expect(content).toMatch(`b.value.count++`)
    expect(content).toMatch(`b.value.count = b.value.count + 1`)
    expect(content).toMatch(`;({ a: a.value } = { a: 2 })`)
    expect(content).toMatch(`;[a.value] = [1]`)
    assertCode(content)
  })

  test('using ref binding in property shorthand', () => {
    const { content } = compileWithRefSugar(`<script setup>
    let a = $ref(1)
    const b = { a }
    function test() {
      const { a } = b
    }
    </script>`)
    expect(content).toMatch(`const b = { a: a.value }`)
    // should not convert destructure
    expect(content).toMatch(`const { a } = b`)
    assertCode(content)
  })

  test('should not rewrite scope variable', () => {
    const { content } = compileWithRefSugar(`
    <script setup>
      let a = $ref(1)
      let b = $ref(1)
      let d = $ref(1)
      const e = 1
      function test() {
        const a = 2
        console.log(a)
        console.log(b)
        let c = { c: 3 }
        console.log(c)
        console.log(d)
        console.log(e)
      }
    </script>`)
    expect(content).toMatch('console.log(a)')
    expect(content).toMatch('console.log(b.value)')
    expect(content).toMatch('console.log(c)')
    expect(content).toMatch('console.log(d.value)')
    expect(content).toMatch('console.log(e)')
    assertCode(content)
  })

  test('object destructure', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    let n = $ref(1), { a, b: c, d = 1, e: f = 2, ...g } = $fromRefs(useFoo())
    let { foo } = $fromRefs(useSomthing(() => 1));
    console.log(n, a, c, d, f, g, foo)
    </script>`)
    expect(content).toMatch(
      `let n = _ref(1), { a: __a, b: __c, d: __d = 1, e: __f = 2, ...__g } = (useFoo())`
    )
    expect(content).toMatch(`let { foo: __foo } = (useSomthing(() => 1))`)
    expect(content).toMatch(`\nconst a = _shallowRef(__a);`)
    expect(content).not.toMatch(`\nconst b = _shallowRef(__b);`)
    expect(content).toMatch(`\nconst c = _shallowRef(__c);`)
    expect(content).toMatch(`\nconst d = _shallowRef(__d);`)
    expect(content).not.toMatch(`\nconst e = _shallowRef(__e);`)
    expect(content).toMatch(`\nconst f = _shallowRef(__f);`)
    expect(content).toMatch(`\nconst g = _shallowRef(__g);`)
    expect(content).toMatch(`\nconst foo = _shallowRef(__foo);`)
    expect(content).toMatch(
      `console.log(n.value, a.value, c.value, d.value, f.value, g.value, foo.value)`
    )
    expect(content).toMatch(`return { n, a, c, d, f, g, foo }`)
    expect(bindings).toStrictEqual({
      n: BindingTypes.SETUP_REF,
      a: BindingTypes.SETUP_REF,
      c: BindingTypes.SETUP_REF,
      d: BindingTypes.SETUP_REF,
      f: BindingTypes.SETUP_REF,
      g: BindingTypes.SETUP_REF,
      foo: BindingTypes.SETUP_REF
    })
    assertCode(content)
  })

  test('array destructure', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    let n = $ref(1), [a, b = 1, ...c] = $fromRefs(useFoo())
    console.log(n, a, b, c)
    </script>`)
    expect(content).toMatch(
      `let n = _ref(1), [__a, __b = 1, ...__c] = (useFoo())`
    )
    expect(content).toMatch(`\nconst a = _shallowRef(__a);`)
    expect(content).toMatch(`\nconst b = _shallowRef(__b);`)
    expect(content).toMatch(`\nconst c = _shallowRef(__c);`)
    expect(content).toMatch(`console.log(n.value, a.value, b.value, c.value)`)
    expect(content).toMatch(`return { n, a, b, c }`)
    expect(bindings).toStrictEqual({
      n: BindingTypes.SETUP_REF,
      a: BindingTypes.SETUP_REF,
      b: BindingTypes.SETUP_REF,
      c: BindingTypes.SETUP_REF
    })
    assertCode(content)
  })

  test('nested destructure', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    let [{ a: { b }}] = $fromRefs(useFoo())
    let { c: [d, e] } = $fromRefs(useBar())
    console.log(b, d, e)
    </script>`)
    expect(content).toMatch(`let [{ a: { b: __b }}] = (useFoo())`)
    expect(content).toMatch(`let { c: [__d, __e] } = (useBar())`)
    expect(content).not.toMatch(`\nconst a = _shallowRef(__a);`)
    expect(content).not.toMatch(`\nconst c = _shallowRef(__c);`)
    expect(content).toMatch(`\nconst b = _shallowRef(__b);`)
    expect(content).toMatch(`\nconst d = _shallowRef(__d);`)
    expect(content).toMatch(`\nconst e = _shallowRef(__e);`)
    expect(content).toMatch(`return { b, d, e }`)
    expect(bindings).toStrictEqual({
      b: BindingTypes.SETUP_REF,
      d: BindingTypes.SETUP_REF,
      e: BindingTypes.SETUP_REF
    })
    assertCode(content)
  })

  test('$raw', () => {
    const { content } = compileWithRefSugar(`<script setup>
    let a = $ref(1)
    const b = $raw(a)
    const c = $raw({ a })
    callExternal($raw(a))
    </script>`)
    expect(content).toMatch(`const b = (a)`)
    expect(content).toMatch(`const c = ({ a })`)
    expect(content).toMatch(`callExternal((a))`)
    assertCode(content)
  })

  //#4062
  test('should not rewrite type identifiers', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
        const props = defineProps<{msg: string; ids?: string[]}>()
        let ids = $ref([])
      </script>`,
      {
        refSugar: true
      }
    )
    assertCode(content)
    expect(content).not.toMatch('.value')
  })

  // #4254
  test('handle TS casting syntax', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      let a = $ref(1)
      console.log(a!) 
      console.log(a! + 1) 
      console.log(a as number) 
      console.log((a as number) + 1) 
      console.log(<number>a) 
      console.log(<number>a + 1) 
      console.log(a! + (a as number)) 
      console.log(a! + <number>a) 
      console.log((a as number) + <number>a)
      </script>`,
      {
        refSugar: true
      }
    )
    assertCode(content)
    expect(content).toMatch('console.log(a.value!)')
    expect(content).toMatch('console.log(a.value as number)')
    expect(content).toMatch('console.log(<number>a.value)')
  })

  describe('errors', () => {
    test('non-let $ref declaration', () => {
      expect(() =>
        compile(
          `<script setup>
        const a = $ref(1)
        </script>`,
          { refSugar: true }
        )
      ).toThrow(`$ref() bindings can only be declared with let`)
    })

    test('$ref w/ destructure', () => {
      expect(() =>
        compile(
          `<script setup>
        let { a } = $ref(1)
        </script>`,
          { refSugar: true }
        )
      ).toThrow(`$ref() bindings cannot be used with destructuring`)
    })

    test('$computed w/ destructure', () => {
      expect(() =>
        compile(
          `<script setup>
        const { a } = $computed(() => 1)
        </script>`,
          { refSugar: true }
        )
      ).toThrow(`$computed() bindings cannot be used with destructuring`)
    })

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

    test('warn usage in non-init positions', () => {
      expect(() =>
        compile(
          `<script setup>
      let bar = $ref(1)
      bar = $ref(2)
    </script>`,
          { refSugar: true }
        )
      ).toThrow(`$ref can only be used directly as a variable initializer`)

      expect(() =>
        compile(
          `<script setup>
      let bar = { foo: $computed(1) }
    </script>`,
          { refSugar: true }
        )
      ).toThrow(`$computed can only be used directly as a variable initializer`)
    })
  })
})
