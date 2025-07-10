import { BindingTypes } from '@vue/compiler-core'
import { assertCode, compileSFCScript as compile } from '../utils'

describe('defineProps', () => {
  test('basic usage', () => {
    const { content, bindings } = compile(`
<script setup>
const props = defineProps({
  foo: String
})
const bar = 1
</script>
  `)
    // should generate working code
    assertCode(content)
    // should analyze bindings
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.LITERAL_CONST,
      props: BindingTypes.SETUP_REACTIVE_CONST,
    })

    // should remove defineOptions import and call
    expect(content).not.toMatch('defineProps')
    // should generate correct setup signature
    expect(content).toMatch(`setup(__props, { expose: __expose }) {`)
    // should assign user identifier to it
    expect(content).toMatch(`const props = __props`)
    // should include context options in default export
    expect(content).toMatch(`export default {
  props: {
  foo: String
},`)
  })

  test('w/ external definition', () => {
    const { content } = compile(`
    <script setup>
    import { propsModel } from './props'
    const props = defineProps(propsModel)
    </script>
      `)
    assertCode(content)
    expect(content).toMatch(`export default {
  props: propsModel,`)
  })

  // #4764
  test('w/ leading code', () => {
    const { content } = compile(`
    <script setup>import { x } from './x'
    const props = defineProps({})
    </script>
    `)
    // props declaration should be inside setup, not moved along with the import
    expect(content).not.toMatch(`const props = __props\nimport`)
    assertCode(content)
  })

  test('defineProps w/ runtime options', () => {
    const { content } = compile(`
<script setup lang="ts">
const props = defineProps({ foo: String })
</script>
    `)
    assertCode(content)
    expect(content).toMatch(`export default /*@__PURE__*/_defineComponent({
  props: { foo: String },
  setup(__props, { expose: __expose }) {`)
  })

  test('w/ type', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Test {}

    type Alias = number[]

    defineProps<{
      string: string
      number: number
      boolean: boolean
      object: object
      objectLiteral: { a: number }
      fn: (n: number) => void
      functionRef: Function
      objectRef: Object
      dateTime: Date
      array: string[]
      arrayRef: Array<any>
      tuple: [number, number]
      set: Set<string>
      literal: 'foo'
      optional?: any
      recordRef: Record<string, null>
      interface: Test
      alias: Alias
      method(): void
      symbol: symbol
      error: Error
      extract: Extract<1 | 2 | boolean, 2>
      exclude: Exclude<1 | 2 | boolean, 2>
      uppercase: Uppercase<'foo'>
      params: Parameters<(foo: any) => void>
      nonNull: NonNullable<string | null>
      objectOrFn: {
        (): void
        foo: string
      }

      union: string | number
      literalUnion: 'foo' | 'bar'
      literalUnionNumber: 1 | 2 | 3 | 4 | 5
      literalUnionMixed: 'foo' | 1 | boolean
      intersection: Test & {}
      intersection2: 'foo' & ('foo' | 'bar')
      foo: ((item: any) => boolean) | null

      unknown: UnknownType
      unknownUnion: UnknownType | string
      unknownIntersection: UnknownType & Object
      unknownUnionWithBoolean: UnknownType | boolean
      unknownUnionWithFunction: UnknownType | (() => any)
    }>()
    </script>`)
    assertCode(content)
    expect(content).toMatch(`string: { type: String, required: true }`)
    expect(content).toMatch(`number: { type: Number, required: true }`)
    expect(content).toMatch(`boolean: { type: Boolean, required: true }`)
    expect(content).toMatch(`object: { type: Object, required: true }`)
    expect(content).toMatch(`objectLiteral: { type: Object, required: true }`)
    expect(content).toMatch(`fn: { type: Function, required: true }`)
    expect(content).toMatch(`functionRef: { type: Function, required: true }`)
    expect(content).toMatch(`objectRef: { type: Object, required: true }`)
    expect(content).toMatch(`dateTime: { type: Date, required: true }`)
    expect(content).toMatch(`array: { type: Array, required: true }`)
    expect(content).toMatch(`arrayRef: { type: Array, required: true }`)
    expect(content).toMatch(`tuple: { type: Array, required: true }`)
    expect(content).toMatch(`set: { type: Set, required: true }`)
    expect(content).toMatch(`literal: { type: String, required: true }`)
    expect(content).toMatch(`optional: { type: null, required: false }`)
    expect(content).toMatch(`recordRef: { type: Object, required: true }`)
    expect(content).toMatch(`interface: { type: Object, required: true }`)
    expect(content).toMatch(`alias: { type: Array, required: true }`)
    expect(content).toMatch(`method: { type: Function, required: true }`)
    expect(content).toMatch(`symbol: { type: Symbol, required: true }`)
    expect(content).toMatch(`error: { type: Error, required: true }`)
    expect(content).toMatch(
      `objectOrFn: { type: [Function, Object], required: true },`,
    )
    expect(content).toMatch(`extract: { type: Number, required: true }`)
    expect(content).toMatch(
      `exclude: { type: [Number, Boolean], required: true }`,
    )
    expect(content).toMatch(`uppercase: { type: String, required: true }`)
    expect(content).toMatch(`params: { type: Array, required: true }`)
    expect(content).toMatch(`nonNull: { type: String, required: true }`)
    expect(content).toMatch(`union: { type: [String, Number], required: true }`)
    expect(content).toMatch(`literalUnion: { type: String, required: true }`)
    expect(content).toMatch(
      `literalUnionNumber: { type: Number, required: true }`,
    )
    expect(content).toMatch(
      `literalUnionMixed: { type: [String, Number, Boolean], required: true }`,
    )
    expect(content).toMatch(`intersection: { type: Object, required: true }`)
    expect(content).toMatch(`intersection2: { type: String, required: true }`)
    expect(content).toMatch(`foo: { type: [Function, null], required: true }`)
    expect(content).toMatch(`unknown: { type: null, required: true }`)
    // uninon containing unknown type: skip check
    expect(content).toMatch(`unknownUnion: { type: null, required: true }`)
    // intersection containing unknown type: narrow to the known types
    expect(content).toMatch(
      `unknownIntersection: { type: Object, required: true },`,
    )
    expect(content).toMatch(
      `unknownUnionWithBoolean: { type: Boolean, required: true, skipCheck: true },`,
    )
    expect(content).toMatch(
      `unknownUnionWithFunction: { type: Function, required: true, skipCheck: true }`,
    )
    expect(bindings).toStrictEqual({
      string: BindingTypes.PROPS,
      number: BindingTypes.PROPS,
      boolean: BindingTypes.PROPS,
      object: BindingTypes.PROPS,
      objectLiteral: BindingTypes.PROPS,
      fn: BindingTypes.PROPS,
      functionRef: BindingTypes.PROPS,
      objectRef: BindingTypes.PROPS,
      dateTime: BindingTypes.PROPS,
      array: BindingTypes.PROPS,
      arrayRef: BindingTypes.PROPS,
      tuple: BindingTypes.PROPS,
      set: BindingTypes.PROPS,
      literal: BindingTypes.PROPS,
      optional: BindingTypes.PROPS,
      recordRef: BindingTypes.PROPS,
      interface: BindingTypes.PROPS,
      alias: BindingTypes.PROPS,
      method: BindingTypes.PROPS,
      symbol: BindingTypes.PROPS,
      error: BindingTypes.PROPS,
      objectOrFn: BindingTypes.PROPS,
      extract: BindingTypes.PROPS,
      exclude: BindingTypes.PROPS,
      union: BindingTypes.PROPS,
      literalUnion: BindingTypes.PROPS,
      literalUnionNumber: BindingTypes.PROPS,
      literalUnionMixed: BindingTypes.PROPS,
      intersection: BindingTypes.PROPS,
      intersection2: BindingTypes.PROPS,
      foo: BindingTypes.PROPS,
      uppercase: BindingTypes.PROPS,
      params: BindingTypes.PROPS,
      nonNull: BindingTypes.PROPS,
      unknown: BindingTypes.PROPS,
      unknownUnion: BindingTypes.PROPS,
      unknownIntersection: BindingTypes.PROPS,
      unknownUnionWithBoolean: BindingTypes.PROPS,
      unknownUnionWithFunction: BindingTypes.PROPS,
    })
  })

  test('w/ interface', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props { x?: number }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
    })
  })

  test('w/ extends interface', () => {
    const { content, bindings } = compile(`
    <script lang="ts">
      interface Foo { x?: number }
    </script>
    <script setup lang="ts">
      interface Bar extends Foo { y?: number }
      interface Props extends Bar {
        z: number
        y: string
      }
      defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`z: { type: Number, required: true }`)
    expect(content).toMatch(`y: { type: String, required: true }`)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
      y: BindingTypes.PROPS,
      z: BindingTypes.PROPS,
    })
  })

  test('w/ extends intersection type', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
      type Foo = {
        x?: number;
      };
      interface Props extends Foo {
        z: number
        y: string
      }
      defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`z: { type: Number, required: true }`)
    expect(content).toMatch(`y: { type: String, required: true }`)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
      y: BindingTypes.PROPS,
      z: BindingTypes.PROPS,
    })
  })

  test('w/ intersection type', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
      type Foo = {
        x?: number;
      };
      type Bar = {
        y: string;
      };
      defineProps<Foo & Bar>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`y: { type: String, required: true }`)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
      y: BindingTypes.PROPS,
    })
  })

  test('w/ exported interface', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    export interface Props { x?: number }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
    })
  })

  test('w/ exported interface in normal script', () => {
    const { content, bindings } = compile(`
    <script lang="ts">
      export interface Props { x?: number }
    </script>
    <script setup lang="ts">
      defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
    })
  })

  test('w/ type alias', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    type Props = { x?: number }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
    })
  })

  test('w/ exported type alias', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    export type Props = { x?: number }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toStrictEqual({
      x: BindingTypes.PROPS,
    })
  })

  test('w/ TS assertion', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
      defineProps(['foo'])! as any
    </script>
  `)
    expect(content).toMatch(`props: ['foo']`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
    })
  })

  test('withDefaults (static)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    const props = withDefaults(defineProps<{
      foo?: string
      bar?: number;
      baz: boolean;
      qux?(): number;
      quux?(): void
      quuxx?: Promise<string>;
      fred?: string
    }>(), {
      foo: 'hi',
      qux() { return 1 },
      ['quux']() { },
      async quuxx() { return await Promise.resolve('hi') },
      get fred() { return 'fred' }
    })
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(
      `foo: { type: String, required: false, default: 'hi' }`,
    )
    expect(content).toMatch(`bar: { type: Number, required: false }`)
    expect(content).toMatch(`baz: { type: Boolean, required: true }`)
    expect(content).toMatch(
      `qux: { type: Function, required: false, default() { return 1 } }`,
    )
    expect(content).toMatch(
      `quux: { type: Function, required: false, default() { } }`,
    )
    expect(content).toMatch(
      `quuxx: { type: Promise, required: false, async default() { return await Promise.resolve('hi') } }`,
    )
    expect(content).toMatch(
      `fred: { type: String, required: false, get default() { return 'fred' } }`,
    )
    expect(content).toMatch(`const props = __props`)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      baz: BindingTypes.PROPS,
      qux: BindingTypes.PROPS,
      quux: BindingTypes.PROPS,
      quuxx: BindingTypes.PROPS,
      fred: BindingTypes.PROPS,
      props: BindingTypes.SETUP_CONST,
    })
  })

  test('withDefaults (static) + normal script', () => {
    const { content } = compile(`
    <script lang="ts">
      interface Props {
        a?: string;
      }
    </script>
    <script setup lang="ts">
      const props = withDefaults(defineProps<Props>(), {
        a: "a",
      });
    </script>
    `)
    assertCode(content)
  })

  // #7111
  test('withDefaults (static) w/ production mode', () => {
    const { content } = compile(
      `
    <script setup lang="ts">
    const props = withDefaults(defineProps<{
      foo: () => void
      bar: boolean
      baz: boolean | (() => void)
      qux: string | number
    }>(), {
      baz: true,
      qux: 'hi'
    })
    </script>
    `,
      { isProd: true },
    )
    assertCode(content)
    expect(content).toMatch(`const props = __props`)

    // foo has no default value, the Function can be dropped
    expect(content).toMatch(`foo: {}`)
    expect(content).toMatch(`bar: { type: Boolean }`)
    expect(content).toMatch(`baz: { type: [Boolean, Function], default: true }`)
    expect(content).toMatch(`qux: { default: 'hi' }`)
  })

  test('withDefaults (dynamic)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import { defaults } from './foo'
    const props = withDefaults(defineProps<{
      foo?: string
      bar?: number
      baz: boolean
    }>(), { ...defaults })
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`import { mergeDefaults as _mergeDefaults`)
    expect(content).toMatch(
      `
  _mergeDefaults({
    foo: { type: String, required: false },
    bar: { type: Number, required: false },
    baz: { type: Boolean, required: true }
  }, { ...defaults })`.trim(),
    )
  })

  test('withDefaults (reference)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import { defaults } from './foo'
    const props = withDefaults(defineProps<{
      foo?: string
      bar?: number
      baz: boolean
    }>(), defaults)
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`import { mergeDefaults as _mergeDefaults`)
    expect(content).toMatch(
      `
  _mergeDefaults({
    foo: { type: String, required: false },
    bar: { type: Number, required: false },
    baz: { type: Boolean, required: true }
  }, defaults)`.trim(),
    )
  })

  // #7111
  test('withDefaults (dynamic) w/ production mode', () => {
    const { content } = compile(
      `
    <script setup lang="ts">
    import { defaults } from './foo'
    const props = withDefaults(defineProps<{
      foo: () => void
      bar: boolean
      baz: boolean | (() => void)
      qux: string | number
    }>(), { ...defaults })
    </script>
    `,
      { isProd: true },
    )
    assertCode(content)
    expect(content).toMatch(`import { mergeDefaults as _mergeDefaults`)
    expect(content).toMatch(
      `
  _mergeDefaults({
    foo: { type: Function },
    bar: { type: Boolean },
    baz: { type: [Boolean, Function] },
    qux: {}
  }, { ...defaults })`.trim(),
    )
  })

  test('withDefaults w/ dynamic object method', () => {
    const { content } = compile(`
    <script setup lang="ts">
    const props = withDefaults(defineProps<{
      foo?: () => 'string'
    }>(), {
      ['fo' + 'o']() { return 'foo' }
    })
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`import { mergeDefaults as _mergeDefaults`)
    expect(content).toMatch(
      `
  _mergeDefaults({
    foo: { type: Function, required: false }
  }, {
      ['fo' + 'o']() { return 'foo' }
    })`.trim(),
    )
  })

  test('runtime inference for Enum', () => {
    expect(
      compile(
        `<script setup lang="ts">
      const enum Foo { A = 123 }
      defineProps<{
        foo: Foo
      }>()
      </script>`,
        { hoistStatic: true },
      ).content,
    ).toMatch(`foo: { type: Number`)

    expect(
      compile(
        `<script setup lang="ts">
      const enum Foo { A = '123' }
      defineProps<{
        foo: Foo
      }>()
      </script>`,
        { hoistStatic: true },
      ).content,
    ).toMatch(`foo: { type: String`)

    expect(
      compile(
        `<script setup lang="ts">
      const enum Foo { A = '123', B = 123 }
      defineProps<{
        foo: Foo
      }>()
      </script>`,
        { hoistStatic: true },
      ).content,
    ).toMatch(`foo: { type: [String, Number]`)

    expect(
      compile(
        `<script setup lang="ts">
      const enum Foo { A, B }
      defineProps<{
        foo: Foo
      }>()
      </script>`,
        { hoistStatic: true },
      ).content,
    ).toMatch(`foo: { type: Number`)
  })

  // #8148
  test('should not override local bindings', () => {
    const { bindings } = compile(`
    <script setup lang="ts">
    import { computed } from 'vue'
    defineProps<{ bar: string }>()
    const bar = computed(() => 1)
    </script>
  `)
    expect(bindings).toStrictEqual({
      bar: BindingTypes.SETUP_REF,
      computed: BindingTypes.SETUP_CONST,
    })
  })

  // #8289
  test('destructure without enabling reactive destructure', () => {
    const { content, bindings } = compile(
      `<script setup lang="ts">
      const { foo } = defineProps<{
        foo: Foo
      }>()
      </script>`,
      {
        propsDestructure: false,
      },
    )
    expect(content).toMatch(`const { foo } = __props`)
    expect(content).toMatch(`return { foo }`)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.SETUP_CONST,
    })
    assertCode(content)
  })

  test('prohibiting reactive destructure', () => {
    expect(() =>
      compile(
        `<script setup lang="ts">
      const { foo } = defineProps<{
        foo: Foo
      }>()
      </script>`,
        {
          propsDestructure: 'error',
        },
      ),
    ).toThrow()
  })

  describe('errors', () => {
    test('w/ both type and non-type args', () => {
      expect(() => {
        compile(`<script setup lang="ts">
        defineProps<{}>({})
        </script>`)
      }).toThrow(`cannot accept both type and non-type arguments`)
    })
  })

  test('should escape names w/ special symbols', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    defineProps<{
      'spa ce': unknown
      'exclamation!mark': unknown
      'double"quote': unknown
      'hash#tag': unknown
      'dollar$sign': unknown
      'percentage%sign': unknown
      'amper&sand': unknown
      "single'quote": unknown
      'round(brack)ets': unknown
      'aste*risk': unknown
      'pl+us': unknown
      'com,ma': unknown
      'do.t': unknown
      'sla/sh': unknown
      'co:lon': unknown
      'semi;colon': unknown
      'angle<brack>ets': unknown
      'equal=sign': unknown
      'question?mark': unknown
      'at@sign': unknown
      'square[brack]ets': unknown
      'back\\\\slash': unknown
      'ca^ret': unknown
      'back\`tick': unknown
      'curly{bra}ces': unknown
      'pi|pe': unknown
      'til~de': unknown
      'da-sh': unknown
    }>()
    </script>`)
    assertCode(content)
    expect(content).toMatch(`"spa ce": { type: null, required: true }`)
    expect(content).toMatch(
      `"exclamation!mark": { type: null, required: true }`,
    )
    expect(content).toMatch(`"double\\"quote": { type: null, required: true }`)
    expect(content).toMatch(`"hash#tag": { type: null, required: true }`)
    expect(content).toMatch(`"dollar$sign": { type: null, required: true }`)
    expect(content).toMatch(`"percentage%sign": { type: null, required: true }`)
    expect(content).toMatch(`"amper&sand": { type: null, required: true }`)
    expect(content).toMatch(`"single'quote": { type: null, required: true }`)
    expect(content).toMatch(`"round(brack)ets": { type: null, required: true }`)
    expect(content).toMatch(`"aste*risk": { type: null, required: true }`)
    expect(content).toMatch(`"pl+us": { type: null, required: true }`)
    expect(content).toMatch(`"com,ma": { type: null, required: true }`)
    expect(content).toMatch(`"do.t": { type: null, required: true }`)
    expect(content).toMatch(`"sla/sh": { type: null, required: true }`)
    expect(content).toMatch(`"co:lon": { type: null, required: true }`)
    expect(content).toMatch(`"semi;colon": { type: null, required: true }`)
    expect(content).toMatch(`"angle<brack>ets": { type: null, required: true }`)
    expect(content).toMatch(`"equal=sign": { type: null, required: true }`)
    expect(content).toMatch(`"question?mark": { type: null, required: true }`)
    expect(content).toMatch(`"at@sign": { type: null, required: true }`)
    expect(content).toMatch(
      `"square[brack]ets": { type: null, required: true }`,
    )
    expect(content).toMatch(`"back\\\\slash": { type: null, required: true }`)
    expect(content).toMatch(`"ca^ret": { type: null, required: true }`)
    expect(content).toMatch(`"back\`tick": { type: null, required: true }`)
    expect(content).toMatch(`"curly{bra}ces": { type: null, required: true }`)
    expect(content).toMatch(`"pi|pe": { type: null, required: true }`)
    expect(content).toMatch(`"til~de": { type: null, required: true }`)
    expect(content).toMatch(`"da-sh": { type: null, required: true }`)
    expect(bindings).toStrictEqual({
      'spa ce': BindingTypes.PROPS,
      'exclamation!mark': BindingTypes.PROPS,
      'double"quote': BindingTypes.PROPS,
      'hash#tag': BindingTypes.PROPS,
      dollar$sign: BindingTypes.PROPS,
      'percentage%sign': BindingTypes.PROPS,
      'amper&sand': BindingTypes.PROPS,
      "single'quote": BindingTypes.PROPS,
      'round(brack)ets': BindingTypes.PROPS,
      'aste*risk': BindingTypes.PROPS,
      'pl+us': BindingTypes.PROPS,
      'com,ma': BindingTypes.PROPS,
      'do.t': BindingTypes.PROPS,
      'sla/sh': BindingTypes.PROPS,
      'co:lon': BindingTypes.PROPS,
      'semi;colon': BindingTypes.PROPS,
      'angle<brack>ets': BindingTypes.PROPS,
      'equal=sign': BindingTypes.PROPS,
      'question?mark': BindingTypes.PROPS,
      'at@sign': BindingTypes.PROPS,
      'square[brack]ets': BindingTypes.PROPS,
      'back\\slash': BindingTypes.PROPS,
      'ca^ret': BindingTypes.PROPS,
      'back`tick': BindingTypes.PROPS,
      'curly{bra}ces': BindingTypes.PROPS,
      'pi|pe': BindingTypes.PROPS,
      'til~de': BindingTypes.PROPS,
      'da-sh': BindingTypes.PROPS,
    })
  })

  // #8989
  test('custom element retains the props type & production mode', () => {
    const { content } = compile(
      `<script setup lang="ts">
      const props = defineProps<{ foo: number}>()
      </script>`,
      { isProd: true, customElement: filename => /\.ce\.vue$/.test(filename) },
      { filename: 'app.ce.vue' },
    )

    expect(content).toMatch(`foo: {type: Number}`)
    assertCode(content)
  })

  test('custom element retains the props type & default value & production mode', () => {
    const { content } = compile(
      `<script setup lang="ts">
      interface Props { 
          foo?: number;
      }
      const props = withDefaults(defineProps<Props>(), {
          foo: 5.5,
      });
      </script>`,
      { isProd: true, customElement: filename => /\.ce\.vue$/.test(filename) },
      { filename: 'app.ce.vue' },
    )
    expect(content).toMatch(`foo: { default: 5.5, type: Number }`)
    assertCode(content)
  })
})
