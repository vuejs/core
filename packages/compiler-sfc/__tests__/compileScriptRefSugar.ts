import { BindingTypes } from '@vue/compiler-core'
import { compileSFCScript as compile, assertCode } from './utils'

describe('<script setup> ref sugar', () => {
  function compileWithRefSugar(src: string) {
    return compile(src, { refSugar: true })
  }

  test('convert ref declarations', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    ref: foo
    ref: a = 1
    ref: b = {
      count: 0
    }
    let c = () => {}
    let d
    </script>`)
    expect(content).toMatch(`import { ref as _ref } from 'vue'`)
    expect(content).not.toMatch(`ref: foo`)
    expect(content).not.toMatch(`ref: a`)
    expect(content).not.toMatch(`ref: b`)
    expect(content).toMatch(`const foo = _ref()`)
    expect(content).toMatch(`const a = _ref(1)`)
    expect(content).toMatch(`
    const b = _ref({
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

  test('multi ref declarations', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    ref: a = 1, b = 2, c = {
      count: 0
    }
    </script>`)
    expect(content).toMatch(`
    const a = _ref(1), b = _ref(2), c = _ref({
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

  test('should not convert non ref labels', () => {
    const { content } = compileWithRefSugar(`<script setup>
    foo: a = 1, b = 2, c = {
      count: 0
    }
    </script>`)
    expect(content).toMatch(`foo: a = 1, b = 2`)
    assertCode(content)
  })

  test('accessing ref binding', () => {
    const { content } = compileWithRefSugar(`<script setup>
    ref: a = 1
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
    ref: a = 1
    console.log(b.a)
    function get(a) {
      return a + 1
    }
    </script>`)
    expect(content).not.toMatch(`a.value`)
  })

  test('mutating ref binding', () => {
    const { content } = compileWithRefSugar(`<script setup>
    ref: a = 1
    ref: b = { count: 0 }
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
    ref: a = 1
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
      ref: a = 1
      ref: b = 1
      ref: d = 1
      const e = 1
      function test() {
        const a = 2
        console.log(a)
        console.log(b)
        let c = { c: 3 }
        console.log(c)
        let $d
        console.log($d)
        console.log(d)
        console.log(e)
      }
    </script>`)
    expect(content).toMatch('console.log(a)')
    expect(content).toMatch('console.log(b.value)')
    expect(content).toMatch('console.log(c)')
    expect(content).toMatch('console.log($d)')
    expect(content).toMatch('console.log(d.value)')
    expect(content).toMatch('console.log(e)')
    assertCode(content)
  })

  test('object destructure', () => {
    const { content, bindings } = compileWithRefSugar(`<script setup>
    ref: n = 1, ({ a, b: c, d = 1, e: f = 2, ...g } = useFoo())
    ref: ({ foo } = useSomthing(() => 1));
    console.log(n, a, c, d, f, g, foo)
    </script>`)
    expect(content).toMatch(
      `const n = _ref(1), { a: __a, b: __c, d: __d = 1, e: __f = 2, ...__g } = useFoo()`
    )
    expect(content).toMatch(`const { foo: __foo } = useSomthing(() => 1)`)
    expect(content).toMatch(`\nconst a = _ref(__a);`)
    expect(content).not.toMatch(`\nconst b = _ref(__b);`)
    expect(content).toMatch(`\nconst c = _ref(__c);`)
    expect(content).toMatch(`\nconst d = _ref(__d);`)
    expect(content).not.toMatch(`\nconst e = _ref(__e);`)
    expect(content).toMatch(`\nconst f = _ref(__f);`)
    expect(content).toMatch(`\nconst g = _ref(__g);`)
    expect(content).toMatch(`\nconst foo = _ref(__foo);`)
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
    ref: n = 1, [a, b = 1, ...c] = useFoo()
    console.log(n, a, b, c)
    </script>`)
    expect(content).toMatch(
      `const n = _ref(1), [__a, __b = 1, ...__c] = useFoo()`
    )
    expect(content).toMatch(`\nconst a = _ref(__a);`)
    expect(content).toMatch(`\nconst b = _ref(__b);`)
    expect(content).toMatch(`\nconst c = _ref(__c);`)
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
    ref: [{ a: { b }}] = useFoo()
    ref: ({ c: [d, e] } = useBar())
    console.log(b, d, e)
    </script>`)
    expect(content).toMatch(`const [{ a: { b: __b }}] = useFoo()`)
    expect(content).toMatch(`const { c: [__d, __e] } = useBar()`)
    expect(content).not.toMatch(`\nconst a = _ref(__a);`)
    expect(content).not.toMatch(`\nconst c = _ref(__c);`)
    expect(content).toMatch(`\nconst b = _ref(__b);`)
    expect(content).toMatch(`\nconst d = _ref(__d);`)
    expect(content).toMatch(`\nconst e = _ref(__e);`)
    expect(content).toMatch(`return { b, d, e }`)
    expect(bindings).toStrictEqual({
      b: BindingTypes.SETUP_REF,
      d: BindingTypes.SETUP_REF,
      e: BindingTypes.SETUP_REF
    })
    assertCode(content)
  })

  describe('errors', () => {
    test('ref: non-assignment expressions', () => {
      expect(() =>
        compile(
          `<script setup>
        ref: a = 1, foo()
        </script>`,
          { refSugar: true }
        )
      ).toThrow(`ref: statements can only contain assignment expressions`)
    })

    test('defineProps/Emit() referencing ref declarations', () => {
      expect(() =>
        compile(
          `<script setup>
        ref: bar = 1
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
        ref: bar = 1
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
