import { TSTypeAliasDeclaration } from '@babel/types'
import { parse } from '../../src'
import { ScriptCompileContext } from '../../src/script/context'
import {
  inferRuntimeType,
  resolveTypeElements
} from '../../src/script/resolveType'

describe('resolveType', () => {
  test('type literal', () => {
    const { elements, callSignatures } = resolve(`type Target = {
      foo: number // property
      bar(): void // method
      'baz': string // string literal key
      (e: 'foo'): void // call signature
      (e: 'bar'): void
    }`)
    expect(elements).toStrictEqual({
      foo: ['Number'],
      bar: ['Function'],
      baz: ['String']
    })
    expect(callSignatures?.length).toBe(2)
  })

  test('reference type', () => {
    expect(
      resolve(`
    type Aliased = { foo: number }
    type Target = Aliased
    `).elements
    ).toStrictEqual({
      foo: ['Number']
    })
  })

  test('reference exported type', () => {
    expect(
      resolve(`
    export type Aliased = { foo: number }
    type Target = Aliased
    `).elements
    ).toStrictEqual({
      foo: ['Number']
    })
  })

  test('reference interface', () => {
    expect(
      resolve(`
    interface Aliased { foo: number }
    type Target = Aliased
    `).elements
    ).toStrictEqual({
      foo: ['Number']
    })
  })

  test('reference exported interface', () => {
    expect(
      resolve(`
    export interface Aliased { foo: number }
    type Target = Aliased
    `).elements
    ).toStrictEqual({
      foo: ['Number']
    })
  })

  test('reference interface extends', () => {
    expect(
      resolve(`
    export interface A { a(): void }
    export interface B extends A { b: boolean }
    interface C { c: string }
    interface Aliased extends B, C { foo: number }
    type Target = Aliased
    `).elements
    ).toStrictEqual({
      a: ['Function'],
      b: ['Boolean'],
      c: ['String'],
      foo: ['Number']
    })
  })

  test('function type', () => {
    expect(
      resolve(`
    type Target = (e: 'foo') => void
    `).callSignatures?.length
    ).toBe(1)
  })

  test('reference function type', () => {
    expect(
      resolve(`
    type Fn = (e: 'foo') => void
    type Target = Fn
    `).callSignatures?.length
    ).toBe(1)
  })

  test('intersection type', () => {
    expect(
      resolve(`
    type Foo = { foo: number }
    type Bar = { bar: string }
    type Baz = { bar: string | boolean }
    type Target = { self: any } & Foo & Bar & Baz
    `).elements
    ).toStrictEqual({
      self: ['Unknown'],
      foo: ['Number'],
      // both Bar & Baz has 'bar', but Baz['bar] is wider so it should be
      // preferred
      bar: ['String', 'Boolean']
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

    type Target = CommonProps & ConditionalProps
    `).elements
    ).toStrictEqual({
      size: ['String'],
      color: ['String', 'Number'],
      appearance: ['String'],
      note: ['String']
    })
  })

  // describe('built-in utility types', () => {

  // })

  describe('errors', () => {
    test('error on computed keys', () => {
      expect(() => resolve(`type Target = { [Foo]: string }`)).toThrow(
        `computed keys are not supported in types referenced by SFC macros`
      )
    })
  })
})

function resolve(code: string) {
  const { descriptor } = parse(`<script setup lang="ts">${code}</script>`)
  const ctx = new ScriptCompileContext(descriptor, { id: 'test' })
  const targetDecl = ctx.scriptSetupAst!.body.find(
    s => s.type === 'TSTypeAliasDeclaration' && s.id.name === 'Target'
  ) as TSTypeAliasDeclaration
  const raw = resolveTypeElements(ctx, targetDecl.typeAnnotation)
  const elements: Record<string, string[]> = {}
  for (const key in raw) {
    elements[key] = inferRuntimeType(ctx, raw[key])
  }
  return {
    elements,
    callSignatures: raw.__callSignatures,
    raw
  }
}
