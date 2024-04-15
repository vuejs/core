import { assertCode, compileSFCScript as compile } from '../utils'

// in dev mode, declared bindings are returned as an object from setup()
// when using TS, users may import types which should not be returned as
// values, so we need to check import usage in the template to determine
// what to be returned.

test('components', () => {
  const { content } = compile(`
    <script setup lang="ts">
    import { FooBar, FooBaz, FooQux, foo } from './x'
    const fooBar: FooBar = 1
    </script>
    <template>
      <FooBaz></FooBaz>
      <foo-qux/>
      <foo/>
      FooBar
    </template>
    `)
  // FooBar: should not be matched by plain text or incorrect case
  // FooBaz: used as PascalCase component
  // FooQux: used as kebab-case component
  // foo: lowercase component
  expect(content).toMatch(
    `return { fooBar, get FooBaz() { return FooBaz }, ` +
      `get FooQux() { return FooQux }, get foo() { return foo } }`,
  )
  assertCode(content)
})

test('directive', () => {
  const { content } = compile(`
    <script setup lang="ts">
    import { vMyDir } from './x'
    </script>
    <template>
      <div v-my-dir></div>
    </template>
    `)
  expect(content).toMatch(`return { get vMyDir() { return vMyDir } }`)
  assertCode(content)
})

test('dynamic arguments', () => {
  const { content } = compile(`
    <script setup lang="ts">
    import { FooBar, foo, bar, unused, baz, msg } from './x'
    </script>
    <template>
      <FooBar #[foo.slotName] />
      <FooBar #unused />
      <div :[bar.attrName]="15"></div>
      <div unused="unused"></div>
      <div #[\`item:\${baz.key}\`]="{ value }"></div>
      <FooBar :msg />
    </template>
    `)
  expect(content).toMatch(
    `return { get FooBar() { return FooBar }, get foo() { return foo }, ` +
      `get bar() { return bar }, get baz() { return baz }, get msg() { return msg } }`,
  )
  assertCode(content)
})

// https://github.com/vuejs/core/issues/4599
test('attribute expressions', () => {
  const { content } = compile(`
    <script setup lang="ts">
    import { bar, baz } from './x'
    const cond = true
    </script>
    <template>
      <div :class="[cond ? '' : bar(), 'default']" :style="baz"></div>
    </template>
    `)
  expect(content).toMatch(
    `return { cond, get bar() { return bar }, get baz() { return baz } }`,
  )
  assertCode(content)
})

test('vue interpolations', () => {
  const { content } = compile(`
  <script setup lang="ts">
  import { x, y, z, x$y } from './x'
  </script>
  <template>
    <div :id="z + 'y'">{{ x }} {{ yy }} {{ x$y }}</div>
  </template>
  `)
  // x: used in interpolation
  // y: should not be matched by {{ yy }} or 'y' in binding exps
  // x$y: #4274 should escape special chars when creating Regex
  expect(content).toMatch(
    `return { get x() { return x }, get z() { return z }, get x$y() { return x$y } }`,
  )
  assertCode(content)
})

// #4340 interpolations in template strings
test('js template string interpolations', () => {
  const { content } = compile(`
    <script setup lang="ts">
    import { VAR, VAR2, VAR3 } from './x'
    </script>
    <template>
      {{ \`\${VAR}VAR2\${VAR3}\` }}
    </template>
    `)
  // VAR2 should not be matched
  expect(content).toMatch(
    `return { get VAR() { return VAR }, get VAR3() { return VAR3 } }`,
  )
  assertCode(content)
})

// edge case: last tag in template
test('last tag', () => {
  const { content } = compile(`
    <script setup lang="ts">
    import { FooBaz, Last } from './x'
    </script>
    <template>
      <FooBaz></FooBaz>
      <Last/>
    </template>
    `)
  expect(content).toMatch(
    `return { get FooBaz() { return FooBaz }, get Last() { return Last } }`,
  )
  assertCode(content)
})

test('TS annotations', () => {
  const { content } = compile(`
    <script setup lang="ts">
    import { Foo, Bar, Baz, Qux, Fred } from './x'
    const a = 1
    function b() {}
    </script>
    <template>
      {{ a as Foo }}
      {{ b<Bar>() }}
      {{ Baz }}
      <Comp v-slot="{ data }: Qux">{{ data }}</Comp>
      <div v-for="{ z = x as Qux } in list as Fred"/>
    </template>
    `)
  expect(content).toMatch(`return { a, b, get Baz() { return Baz } }`)
  assertCode(content)
})

// vuejs/vue#12591
test('v-on inline statement', () => {
  // should not error
  compile(`
  <script setup lang="ts">
    import { foo } from './foo'
  </script>
  <template>
    <div @click="$emit('update:a');"></div>
  </template>
  `)
})

test('template ref', () => {
  const { content } = compile(`
    <script setup lang="ts">
      import { foo, bar, Baz } from './foo'
    </script>
    <template>
      <div ref="foo"></div>
      <div ref=""></div>
      <Baz ref="bar" />
    </template>
    `)
  expect(content).toMatch(
    'return { get foo() { return foo }, get bar() { return bar }, get Baz() { return Baz } }',
  )
  assertCode(content)
})

// https://github.com/nuxt/nuxt/issues/22416
test('property access', () => {
  const { content } = compile(`
    <script setup lang="ts">
      import { Foo, Bar, Baz } from './foo'
    </script>
    <template>
      <div>{{ Foo.Bar.Baz }}</div>
    </template>
    `)
  expect(content).toMatch('return { get Foo() { return Foo } }')
  assertCode(content)
})

test('spread operator', () => {
  const { content } = compile(`
    <script setup lang="ts">
      import { Foo, Bar, Baz } from './foo'
    </script>
    <template>
      <div v-bind="{ ...Foo.Bar.Baz }"></div>
    </template>
    `)
  expect(content).toMatch('return { get Foo() { return Foo } }')
  assertCode(content)
})

test('property access (whitespace)', () => {
  const { content } = compile(`
    <script setup lang="ts">
      import { Foo, Bar, Baz } from './foo'
    </script>
    <template>
      <div>{{ Foo . Bar . Baz }}</div>
    </template>
    `)
  expect(content).toMatch('return { get Foo() { return Foo } }')
  assertCode(content)
})

// #9974
test('namespace / dot component usage', () => {
  const { content } = compile(`
    <script setup lang="ts">
      import * as Foo from './foo'
    </script>
    <template>
      <Foo.Bar />
    </template>
    `)
  expect(content).toMatch('return { get Foo() { return Foo } }')
  assertCode(content)
})
