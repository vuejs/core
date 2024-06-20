import { normalize } from 'node:path'
import type { Identifier } from '@babel/types'
import { type SFCScriptCompileOptions, parse } from '../../src'
import { ScriptCompileContext } from '../../src/script/context'
import {
  inferRuntimeType,
  invalidateTypeCache,
  recordImports,
  registerTS,
  resolveTypeElements,
} from '../../src/script/resolveType'
import { UNKNOWN_TYPE } from '../../src/script/utils'
import ts from 'typescript'

registerTS(() => ts)

describe('resolveType', () => {
  test('type literal', () => {
    const { props, calls } = resolve(`defineProps<{
      foo: number // property
      bar(): void // method
      'baz': string // string literal key
      (e: 'foo'): void // call signature
      (e: 'bar'): void
    }>()`)
    expect(props).toStrictEqual({
      foo: ['Number'],
      bar: ['Function'],
      baz: ['String'],
    })
    expect(calls?.length).toBe(2)
  })

  test('reference type', () => {
    expect(
      resolve(`
    type Aliased = { foo: number }
    defineProps<Aliased>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
    })
  })

  test('reference exported type', () => {
    expect(
      resolve(`
    export type Aliased = { foo: number }
    defineProps<Aliased>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
    })
  })

  test('reference interface', () => {
    expect(
      resolve(`
    interface Aliased { foo: number }
    defineProps<Aliased>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
    })
  })

  test('reference exported interface', () => {
    expect(
      resolve(`
    export interface Aliased { foo: number }
    defineProps<Aliased>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
    })
  })

  test('reference interface extends', () => {
    expect(
      resolve(`
    export interface A { a(): void }
    export interface B extends A { b: boolean }
    interface C { c: string }
    interface Aliased extends B, C { foo: number }
    defineProps<Aliased>()
    `).props,
    ).toStrictEqual({
      a: ['Function'],
      b: ['Boolean'],
      c: ['String'],
      foo: ['Number'],
    })
  })

  test('reference class', () => {
    expect(
      resolve(`
    class Foo {}
    defineProps<{ foo: Foo }>()
    `).props,
    ).toStrictEqual({
      foo: ['Object'],
    })
  })

  test('function type', () => {
    expect(
      resolve(`
    defineProps<(e: 'foo') => void>()
    `).calls?.length,
    ).toBe(1)
  })

  test('reference function type', () => {
    expect(
      resolve(`
    type Fn = (e: 'foo') => void
    defineProps<Fn>()
    `).calls?.length,
    ).toBe(1)
  })

  test('intersection type', () => {
    expect(
      resolve(`
    type Foo = { foo: number }
    type Bar = { bar: string }
    type Baz = { bar: string | boolean }
    defineProps<{ self: any } & Foo & Bar & Baz>()
    `).props,
    ).toStrictEqual({
      self: [UNKNOWN_TYPE],
      foo: ['Number'],
      // both Bar & Baz has 'bar', but Baz['bar] is wider so it should be
      // preferred
      bar: ['String', 'Boolean'],
    })
  })

  test('intersection type with ignore', () => {
    expect(
      resolve(`
    type Foo = { foo: number }
    type Bar = { bar: string }
    defineProps<Foo & /* @vue-ignore */ Bar>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
    })
  })

  // #7553
  test('union type', () => {
    expect(
      resolve(`
    interface CommonProps {
      size?: 'xl' | 'l' | 'm' | 's' | 'xs'
    }

    type ConditionalProps =
      | {
          color: 'normal' | 'primary' | 'secondary'
          appearance: 'normal' | 'outline' | 'text'
        }
      | {
          color: number
          appearance: 'outline'
          note: string
        }

    defineProps<CommonProps & ConditionalProps>()
    `).props,
    ).toStrictEqual({
      size: ['String'],
      color: ['String', 'Number'],
      appearance: ['String'],
      note: ['String'],
    })
  })

  test('template string type', () => {
    expect(
      resolve(`
    type T = 'foo' | 'bar'
    type S = 'x' | 'y'
    defineProps<{
      [\`_\${T}_\${S}_\`]: string
    }>()
    `).props,
    ).toStrictEqual({
      _foo_x_: ['String'],
      _foo_y_: ['String'],
      _bar_x_: ['String'],
      _bar_y_: ['String'],
    })
  })

  test('mapped types w/ string manipulation', () => {
    expect(
      resolve(`
    type T = 'foo' | 'bar'
    defineProps<{ [K in T]: string | number } & {
      [K in 'optional']?: boolean
    } & {
      [K in Capitalize<T>]: string
    } & {
      [K in Uppercase<Extract<T, 'foo'>>]: string
    } & {
      [K in \`x\${T}\`]: string
    }>()
    `).props,
    ).toStrictEqual({
      foo: ['String', 'Number'],
      bar: ['String', 'Number'],
      Foo: ['String'],
      Bar: ['String'],
      FOO: ['String'],
      xfoo: ['String'],
      xbar: ['String'],
      optional: ['Boolean'],
    })
  })

  test('utility type: Partial', () => {
    expect(
      resolve(`
    type T = { foo: number, bar: string }
    defineProps<Partial<T>>()
    `).raw.props,
    ).toMatchObject({
      foo: {
        optional: true,
      },
      bar: {
        optional: true,
      },
    })
  })

  test('utility type: Required', () => {
    expect(
      resolve(`
    type T = { foo?: number, bar?: string }
    defineProps<Required<T>>()
    `).raw.props,
    ).toMatchObject({
      foo: {
        optional: false,
      },
      bar: {
        optional: false,
      },
    })
  })

  test('utility type: Pick', () => {
    expect(
      resolve(`
    type T = { foo: number, bar: string, baz: boolean }
    type K = 'foo' | 'bar'
    defineProps<Pick<T, K>>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
      bar: ['String'],
    })
  })

  test('utility type: Omit', () => {
    expect(
      resolve(`
    type T = { foo: number, bar: string, baz: boolean }
    type K = 'foo' | 'bar'
    defineProps<Omit<T, K>>()
    `).props,
    ).toStrictEqual({
      baz: ['Boolean'],
    })
  })

  test('utility type: ReadonlyArray', () => {
    expect(
      resolve(`
    defineProps<{ foo: ReadonlyArray<string> }>()
    `).props,
    ).toStrictEqual({
      foo: ['Array'],
    })
  })

  test('utility type: ReadonlyMap & Readonly Set', () => {
    expect(
      resolve(`
    defineProps<{ foo: ReadonlyMap<string, unknown>, bar: ReadonlySet<string> }>()
    `).props,
    ).toStrictEqual({
      foo: ['Map'],
      bar: ['Set'],
    })
  })

  test('indexed access type (literal)', () => {
    expect(
      resolve(`
    type T = { bar: number }
    type S = { nested: { foo: T['bar'] }}
    defineProps<S['nested']>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
    })
  })

  test('indexed access type (advanced)', () => {
    expect(
      resolve(`
    type K = 'foo' | 'bar'
    type T = { foo: string, bar: number }
    type S = { foo: { foo: T[string] }, bar: { bar: string } }
    defineProps<S[K]>()
    `).props,
    ).toStrictEqual({
      foo: ['String', 'Number'],
      bar: ['String'],
    })
  })

  test('indexed access type (number)', () => {
    expect(
      resolve(`
    type A = (string | number)[]
    type AA = Array<string>
    type T = [1, 'foo']
    type TT = [foo: 1, bar: 'foo']
    defineProps<{ foo: A[number], bar: AA[number], tuple: T[number], namedTuple: TT[number] }>()
    `).props,
    ).toStrictEqual({
      foo: ['String', 'Number'],
      bar: ['String'],
      tuple: ['Number', 'String'],
      namedTuple: ['Number', 'String'],
    })
  })

  test('namespace', () => {
    expect(
      resolve(`
      type X = string
      namespace Foo {
        type X = number
        export namespace Bar {
          export type A = {
            foo: X
          }
        }
      }
      defineProps<Foo.Bar.A>()
    `).props,
    ).toStrictEqual({
      foo: ['Number'],
    })
  })

  test('interface merging', () => {
    expect(
      resolve(`
      interface Foo {
        a: string
      }
      interface Foo {
        b: number
      }
      defineProps<{
        foo: Foo['a'],
        bar: Foo['b']
      }>()
    `).props,
    ).toStrictEqual({
      foo: ['String'],
      bar: ['Number'],
    })
  })

  test('namespace merging', () => {
    expect(
      resolve(`
      namespace Foo {
        export type A = string
      }
      namespace Foo {
        export type B = number
      }
      defineProps<{
        foo: Foo.A,
        bar: Foo.B
      }>()
    `).props,
    ).toStrictEqual({
      foo: ['String'],
      bar: ['Number'],
    })
  })

  test('namespace merging with other types', () => {
    expect(
      resolve(`
      namespace Foo {
        export type A = string
      }
      interface Foo {
        b: number
      }
      defineProps<{
        foo: Foo.A,
        bar: Foo['b']
      }>()
    `).props,
    ).toStrictEqual({
      foo: ['String'],
      bar: ['Number'],
    })
  })

  test('enum merging', () => {
    expect(
      resolve(`
      enum Foo {
        A = 1
      }
      enum Foo {
        B = 'hi'
      }
      defineProps<{
        foo: Foo
      }>()
    `).props,
    ).toStrictEqual({
      foo: ['Number', 'String'],
    })
  })

  test('typeof', () => {
    expect(
      resolve(`
      declare const a: string
      defineProps<{ foo: typeof a }>()
    `).props,
    ).toStrictEqual({
      foo: ['String'],
    })
  })

  test('readonly', () => {
    expect(
      resolve(`
    defineProps<{ foo: readonly unknown[] }>()
    `).props,
    ).toStrictEqual({
      foo: ['Array'],
    })
  })

  test('keyof', () => {
    const files = {
      '/foo.ts': `export type IMP = { ${1}: 1 };`,
    }

    const { props } = resolve(
      `
      import { IMP } from './foo'
      interface Foo { foo: 1, ${1}: 1 }
      type Bar = { bar: 1 }
      declare const obj: Bar
      declare const set: Set<any>
      declare const arr: Array<any>

      defineProps<{
        imp: keyof IMP,
        foo: keyof Foo,
        bar: keyof Bar,
        obj: keyof typeof obj,
        set: keyof typeof set,
        arr: keyof typeof arr
      }>()
      `,
      files,
    )

    expect(props).toStrictEqual({
      imp: ['Number'],
      foo: ['String', 'Number'],
      bar: ['String'],
      obj: ['String'],
      set: ['String'],
      arr: ['String', 'Number'],
    })
  })

  test('keyof: index signature', () => {
    const { props } = resolve(
      `
      declare const num: number;
      interface Foo {
        [key: symbol]: 1
        [key: string]: 1
        [key: typeof num]: 1,
      }

      type Test<T> = T
      type Bar = {
        [key: string]: 1
        [key: Test<number>]: 1
      }

      defineProps<{
        foo: keyof Foo 
        bar: keyof Bar
      }>()
      `,
    )

    expect(props).toStrictEqual({
      foo: ['Symbol', 'String', 'Number'],
      bar: [UNKNOWN_TYPE],
    })
  })

  // #11129
  test('keyof: intersection type', () => {
    const { props } = resolve(`
    type A = { name: string }
    type B = A & { [key: number]: string }
    defineProps<{
      foo: keyof B
    }>()`)
    expect(props).toStrictEqual({
      foo: ['String', 'Number'],
    })
  })

  test('keyof: union type', () => {
    const { props } = resolve(`
    type A = { name: string }
    type B = A | { [key: number]: string }
    defineProps<{
      foo: keyof B
    }>()`)
    expect(props).toStrictEqual({
      foo: ['String', 'Number'],
    })
  })

  test('keyof: utility type', () => {
    const { props } = resolve(
      `
      type Foo = Record<symbol | string, any>
      type Bar = { [key: string]: any }
      type AnyRecord = Record<keyof any, any>
      type Baz = { a: 1, ${1}: 2, b: 3}

      defineProps<{
        record: keyof Foo,
        anyRecord: keyof AnyRecord 
        partial: keyof Partial<Bar>,
        required: keyof Required<Bar>,
        readonly: keyof Readonly<Bar>,
        pick: keyof Pick<Baz, 'a' | 1>
        extract: keyof Extract<keyof Baz, 'a' | 1>
      }>()
      `,
    )

    expect(props).toStrictEqual({
      record: ['Symbol', 'String'],
      anyRecord: ['String', 'Number', 'Symbol'],
      partial: ['String'],
      required: ['String'],
      readonly: ['String'],
      pick: ['String', 'Number'],
      extract: ['String', 'Number'],
    })
  })

  test('keyof: fallback to Unknown', () => {
    const { props } = resolve(
      `
      interface Barr {}
      interface Bar extends Barr {}
      type Foo = keyof Bar
      defineProps<{ foo: Foo }>()
      `,
    )

    expect(props).toStrictEqual({
      foo: [UNKNOWN_TYPE],
    })
  })

  test('ExtractPropTypes (element-plus)', () => {
    const { props, raw } = resolve(
      `
      import { ExtractPropTypes } from 'vue'
      declare const props: {
        foo: StringConstructor,
        bar: {
          type: import('foo').EpPropFinalized<BooleanConstructor>,
          required: true
        }
      }
      type Props = ExtractPropTypes<typeof props>
      defineProps<Props>()
    `,
    )
    expect(props).toStrictEqual({
      foo: ['String'],
      bar: ['Boolean'],
    })
    expect(raw.props.bar.optional).toBe(false)
  })

  test('ExtractPropTypes (antd)', () => {
    const { props } = resolve(
      `
      declare const props: () => {
        foo: StringConstructor,
        bar: { type: PropType<boolean> }
      }
      type Props = Partial<import('vue').ExtractPropTypes<ReturnType<typeof props>>>
      defineProps<Props>()
    `,
    )
    expect(props).toStrictEqual({
      foo: ['String'],
      bar: ['Boolean'],
    })
  })

  describe('generics', () => {
    test('generic with type literal', () => {
      expect(
        resolve(`
        type Props<T> = T
        defineProps<Props<{ foo: string }>>()
      `).props,
      ).toStrictEqual({
        foo: ['String'],
      })
    })

    test('generic used in intersection', () => {
      expect(
        resolve(`
        type Foo = { foo: string; }
        type Bar = { bar: number; }
        type Props<T,U> = T & U & { baz: boolean }
        defineProps<Props<Foo, Bar>>()
      `).props,
      ).toStrictEqual({
        foo: ['String'],
        bar: ['Number'],
        baz: ['Boolean'],
      })
    })

    test('generic type /w generic type alias', () => {
      expect(
        resolve(`
        type Aliased<T> = Readonly<Partial<T>>
        type Props<T> = Aliased<T>
        type Foo = { foo: string; }
        defineProps<Props<Foo>>()
      `).props,
      ).toStrictEqual({
        foo: ['String'],
      })
    })

    test('generic type /w aliased type literal', () => {
      expect(
        resolve(`
        type Aliased<T> = { foo: T }
        defineProps<Aliased<string>>()
      `).props,
      ).toStrictEqual({
        foo: ['String'],
      })
    })

    test('generic type /w interface', () => {
      expect(
        resolve(`
        interface Props<T> {
          foo: T
        }
        type Foo = string
        defineProps<Props<Foo>>()
      `).props,
      ).toStrictEqual({
        foo: ['String'],
      })
    })

    test('generic from external-file', () => {
      const files = {
        '/foo.ts': 'export type P<T> = { foo: T }',
      }
      const { props } = resolve(
        `
        import { P } from './foo'
        defineProps<P<string>>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['String'],
      })
    })
  })

  describe('external type imports', () => {
    test('relative ts', () => {
      const files = {
        '/foo.ts': 'export type P = { foo: number }',
        '/bar.d.ts':
          'type X = { bar: string }; export { X as Y };' +
          // verify that we can parse syntax that is only valid in d.ts
          'export const baz: boolean',
      }
      const { props, deps } = resolve(
        `
        import { P } from './foo'
        import { Y as PP } from './bar'
        defineProps<P & PP>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['Number'],
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    // #10635
    test('relative tsx', () => {
      const files = {
        '/foo.tsx': 'export type P = { foo: number }',
        '/bar/index.tsx': 'export type PP = { bar: string }',
      }
      const { props, deps } = resolve(
        `
        import { P } from './foo'
        import { PP } from './bar'
        defineProps<P & PP>()
        `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['Number'],
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test.runIf(process.platform === 'win32')('relative ts on Windows', () => {
      const files = {
        'C:\\Test\\FolderA\\foo.ts': 'export type P = { foo: number }',
        'C:\\Test\\FolderA\\bar.d.ts':
          'type X = { bar: string }; export { X as Y };' +
          // verify that we can parse syntax that is only valid in d.ts
          'export const baz: boolean',
        'C:\\Test\\FolderB\\buz.ts': 'export type Z = { buz: string }',
      }
      const { props, deps } = resolve(
        `
      import { P } from './foo'
      import { Y as PP } from './bar'
      import { Z as PPP } from '../FolderB/buz'
      defineProps<P & PP & PPP>()
    `,
        files,
        {},
        'C:\\Test\\FolderA\\Test.vue',
      )
      expect(props).toStrictEqual({
        foo: ['Number'],
        bar: ['String'],
        buz: ['String'],
      })
      expect(deps && [...deps].map(normalize)).toStrictEqual(
        Object.keys(files).map(normalize),
      )
    })

    // #8244
    test('utility type in external file', () => {
      const files = {
        '/foo.ts': 'type A = { n?: number }; export type B = Required<A>',
      }
      const { props } = resolve(
        `
        import { B } from './foo'
        defineProps<B>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        n: ['Number'],
      })
    })

    test('relative vue', () => {
      const files = {
        '/foo.vue':
          '<script lang="ts">export type P = { foo: number }</script>',
        '/bar.vue':
          '<script setup lang="tsx">export type P = { bar: string }</script>',
      }
      const { props, deps } = resolve(
        `
        import { P } from './foo.vue'
        import { P as PP } from './bar.vue'
        defineProps<P & PP>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['Number'],
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('relative (chained)', () => {
      const files = {
        '/foo.ts': `import type { P as PP } from './nested/bar.vue'
          export type P = { foo: number } & PP`,
        '/nested/bar.vue':
          '<script setup lang="ts">export type P = { bar: string }</script>',
      }
      const { props, deps } = resolve(
        `
        import { P } from './foo'
        defineProps<P>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['Number'],
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('relative (chained, re-export)', () => {
      const files = {
        '/foo.ts': `export { P as PP } from './bar'`,
        '/bar.ts': 'export type P = { bar: string }',
      }
      const { props, deps } = resolve(
        `
        import { PP as P } from './foo'
        defineProps<P>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('relative (chained, export *)', () => {
      const files = {
        '/foo.ts': `export * from './bar'`,
        '/bar.ts': 'export type P = { bar: string }',
      }
      const { props, deps } = resolve(
        `
        import { P } from './foo'
        defineProps<P>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('relative (default export)', () => {
      const files = {
        '/foo.ts': `export default interface P { foo: string }`,
        '/bar.ts': `type X = { bar: string }; export default X`,
      }
      const { props, deps } = resolve(
        `
        import P from './foo'
        import X from './bar'
        defineProps<P & X>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['String'],
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('relative (default re-export)', () => {
      const files = {
        '/bar.ts': `export { default } from './foo'`,
        '/foo.ts': `export default interface P { foo: string }; export interface PP { bar: number }`,
        '/baz.ts': `export { PP as default } from './foo'`,
      }
      const { props, deps } = resolve(
        `
        import P from './bar'
        import PP from './baz'
        defineProps<P & PP>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['String'],
        bar: ['Number'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('relative (re-export /w same source type name)', () => {
      const files = {
        '/foo.ts': `export default interface P { foo: string }`,
        '/bar.ts': `export default interface PP { bar: number }`,
        '/baz.ts': `export { default as X } from './foo'; export { default as XX } from './bar'; `,
      }
      const { props, deps } = resolve(
        `import { X, XX } from './baz'
        defineProps<X & XX>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['String'],
        bar: ['Number'],
      })
      expect(deps && [...deps]).toStrictEqual(['/baz.ts', '/foo.ts', '/bar.ts'])
    })

    test('relative (dynamic import)', () => {
      const files = {
        '/foo.ts': `export type P = { foo: string, bar: import('./bar').N }`,
        '/bar.ts': 'export type N = number',
      }
      const { props, deps } = resolve(
        `
        defineProps<import('./foo').P>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['String'],
        bar: ['Number'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    // #8339
    test('relative, .js import', () => {
      const files = {
        '/foo.d.ts':
          'import { PP } from "./bar.js"; export type P = { foo: PP }',
        '/bar.d.ts': 'export type PP = "foo" | "bar"',
      }
      const { props, deps } = resolve(
        `
        import { P } from './foo'
        defineProps<P>()
      `,
        files,
      )
      expect(props).toStrictEqual({
        foo: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('ts module resolve', () => {
      const files = {
        '/node_modules/foo/package.json': JSON.stringify({
          types: 'index.d.ts',
        }),
        '/node_modules/foo/index.d.ts': 'export type P = { foo: number }',
        '/tsconfig.json': JSON.stringify({
          compilerOptions: {
            paths: {
              bar: ['./pp.ts'],
            },
          },
        }),
        '/pp.ts': 'export type PP = { bar: string }',
      }

      const { props, deps } = resolve(
        `
        import { P } from 'foo'
        import { PP } from 'bar'
        defineProps<P & PP>()
        `,
        files,
      )

      expect(props).toStrictEqual({
        foo: ['Number'],
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual([
        '/node_modules/foo/index.d.ts',
        '/pp.ts',
      ])
    })

    test('ts module resolve w/ project reference & extends', () => {
      const files = {
        '/tsconfig.json': JSON.stringify({
          references: [
            {
              path: './tsconfig.app.json',
            },
          ],
        }),
        '/tsconfig.app.json': JSON.stringify({
          include: ['**/*.ts', '**/*.vue'],
          extends: './tsconfig.web.json',
        }),
        '/tsconfig.web.json': JSON.stringify({
          compilerOptions: {
            composite: true,
            paths: {
              bar: ['./user.ts'],
            },
          },
        }),
        '/user.ts': 'export type User = { bar: string }',
      }

      const { props, deps } = resolve(
        `
        import { User } from 'bar'
        defineProps<User>()
        `,
        files,
      )

      expect(props).toStrictEqual({
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(['/user.ts'])
    })

    test('ts module resolve w/ project reference folder', () => {
      const files = {
        '/tsconfig.json': JSON.stringify({
          references: [
            {
              path: './web',
            },
            {
              path: './empty',
            },
            {
              path: './noexists-should-ignore',
            },
          ],
        }),
        '/web/tsconfig.json': JSON.stringify({
          include: ['../**/*.ts', '../**/*.vue'],
          compilerOptions: {
            composite: true,
            paths: {
              bar: ['../user.ts'],
            },
          },
        }),
        // tsconfig with no include / paths defined, should match nothing
        '/empty/tsconfig.json': JSON.stringify({
          compilerOptions: {
            composite: true,
          },
        }),
        '/user.ts': 'export type User = { bar: string }',
      }

      const { props, deps } = resolve(
        `
        import { User } from 'bar'
        defineProps<User>() 
        `,
        files,
      )

      expect(props).toStrictEqual({
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(['/user.ts'])
    })

    test('ts module resolve w/ path aliased vue file', () => {
      const files = {
        '/tsconfig.json': JSON.stringify({
          compilerOptions: {
            include: ['**/*.ts', '**/*.vue'],
            paths: {
              '@/*': ['./src/*'],
            },
          },
        }),
        '/src/Foo.vue':
          '<script lang="ts">export type P = { bar: string }</script>',
      }

      const { props, deps } = resolve(
        `
        import { P } from '@/Foo.vue'
        defineProps<P>()
        `,
        files,
      )

      expect(props).toStrictEqual({
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(['/src/Foo.vue'])
    })

    test('global types', () => {
      const files = {
        // ambient
        '/app.d.ts':
          'declare namespace App { interface User { name: string } }',
        // module - should only respect the declare global block
        '/global.d.ts': `
          declare type PP = { bar: number }
          declare global {
            type PP = { bar: string }
          }
          export {}
        `,
      }

      const { props, deps } = resolve(`defineProps<App.User & PP>()`, files, {
        globalTypeFiles: Object.keys(files),
      })

      expect(props).toStrictEqual({
        name: ['String'],
        bar: ['String'],
      })
      expect(deps && [...deps]).toStrictEqual(Object.keys(files))
    })

    test('global types with ambient references', () => {
      const files = {
        // with references
        '/backend.d.ts': `
          declare namespace App.Data {
            export type AircraftData = {
              id: string
              manufacturer: App.Data.Listings.ManufacturerData
            }
          }
          declare namespace App.Data.Listings {
            export type ManufacturerData = {
              id: string
            }
          }
        `,
      }

      const { props } = resolve(`defineProps<App.Data.AircraftData>()`, files, {
        globalTypeFiles: Object.keys(files),
      })

      expect(props).toStrictEqual({
        id: ['String'],
        manufacturer: ['Object'],
      })
    })

    // #9871
    test('shared generics with different args', () => {
      const files = {
        '/foo.ts': `export interface Foo<T> { value: T }`,
      }
      const { props } = resolve(
        `import type { Foo } from './foo'
        defineProps<Foo<string>>()`,
        files,
        undefined,
        `/One.vue`,
      )
      expect(props).toStrictEqual({
        value: ['String'],
      })
      const { props: props2 } = resolve(
        `import type { Foo } from './foo'
        defineProps<Foo<number>>()`,
        files,
        undefined,
        `/Two.vue`,
        false /* do not invalidate cache */,
      )
      expect(props2).toStrictEqual({
        value: ['Number'],
      })
    })
  })

  describe('errors', () => {
    test('failed type reference', () => {
      expect(() => resolve(`defineProps<X>()`)).toThrow(
        `Unresolvable type reference`,
      )
    })

    test('unsupported computed keys', () => {
      expect(() => resolve(`defineProps<{ [Foo]: string }>()`)).toThrow(
        `Unsupported computed key in type referenced by a macro`,
      )
    })

    test('unsupported index type', () => {
      expect(() => resolve(`defineProps<X[K]>()`)).toThrow(
        `Unsupported type when resolving index type`,
      )
    })

    test('failed import source resolve', () => {
      expect(() =>
        resolve(`import { X } from './foo'; defineProps<X>()`),
      ).toThrow(`Failed to resolve import source "./foo"`)
    })

    test('should not error on unresolved type when inferring runtime type', () => {
      expect(() => resolve(`defineProps<{ foo: T }>()`)).not.toThrow()
      expect(() => resolve(`defineProps<{ foo: T['bar'] }>()`)).not.toThrow()
      expect(() =>
        resolve(`
        import type P from 'unknown'
        defineProps<{ foo: P }>()
      `),
      ).not.toThrow()
    })

    test('error against failed extends', () => {
      expect(() =>
        resolve(`
        import type Base from 'unknown'
        interface Props extends Base {}
        defineProps<Props>()
      `),
      ).toThrow(`@vue-ignore`)
    })

    test('allow ignoring failed extends', () => {
      let res: any

      expect(
        () =>
          (res = resolve(`
        import type Base from 'unknown'
        interface Props extends /*@vue-ignore*/ Base {
          foo: string
        }
        defineProps<Props>()
      `)),
      ).not.toThrow(`@vue-ignore`)

      expect(res.props).toStrictEqual({
        foo: ['String'],
      })
    })
  })

  describe('template literals', () => {
    test('mapped types with string type', () => {
      expect(
        resolve(`
      type X = 'a' | 'b'
      defineProps<{[K in X as \`\${K}_foo\`]: string}>()
      `).props,
      ).toStrictEqual({
        a_foo: ['String'],
        b_foo: ['String'],
      })
    })

    // #10962
    test('mapped types with generic parameters', () => {
      const { props } = resolve(`
      type Breakpoints = 'sm' | 'md' | 'lg'
      type BreakpointFactory<T extends string, V> = {
        [K in Breakpoints as \`\${T}\${Capitalize<K>}\`]: V
      }
      type ColsBreakpoints = BreakpointFactory<'cols', number>
      defineProps<ColsBreakpoints>()
      `)
      expect(props).toStrictEqual({
        colsSm: ['Number'],
        colsMd: ['Number'],
        colsLg: ['Number'],
      })
    })
  })
})

function resolve(
  code: string,
  files: Record<string, string> = {},
  options?: Partial<SFCScriptCompileOptions>,
  sourceFileName: string = '/Test.vue',
  invalidateCache = true,
) {
  const { descriptor } = parse(`<script setup lang="ts">\n${code}\n</script>`, {
    filename: sourceFileName,
  })
  const ctx = new ScriptCompileContext(descriptor, {
    id: 'test',
    fs: {
      fileExists(file) {
        return !!(files[file] ?? files[normalize(file)])
      },
      readFile(file) {
        return files[file] ?? files[normalize(file)]
      },
    },
    ...options,
  })

  if (invalidateCache) {
    for (const file in files) {
      invalidateTypeCache(file)
    }
  }

  // ctx.userImports is collected when calling compileScript(), but we are
  // skipping that here, so need to manually register imports
  ctx.userImports = recordImports(ctx.scriptSetupAst!.body) as any

  let target: any
  for (const s of ctx.scriptSetupAst!.body) {
    if (
      s.type === 'ExpressionStatement' &&
      s.expression.type === 'CallExpression' &&
      (s.expression.callee as Identifier).name === 'defineProps'
    ) {
      target = s.expression.typeParameters!.params[0]
    }
  }
  const raw = resolveTypeElements(ctx, target)
  const props: Record<string, string[]> = {}
  for (const key in raw.props) {
    props[key] = inferRuntimeType(ctx, raw.props[key])
  }
  return {
    props,
    calls: raw.calls,
    deps: ctx.deps,
    raw,
  }
}
