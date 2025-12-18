import type { ObjectVaporComponent, VaporComponentInstance } from './component'
import {
  type IsKeyValues,
  type Prettify,
  extend,
  isFunction,
} from '@vue/shared'
import type {
  AllowedComponentProps,
  ComponentCustomProps,
  ComponentObjectPropsOptions,
  ComponentTypeEmits,
  EmitFn,
  EmitsOptions,
  EmitsToProps,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
  ReservedProps,
  TypeEmitsToOptions,
  VNode,
} from '@vue/runtime-dom'
import type { StaticSlots } from './componentSlots'
import type { Block } from './block'

export type VaporPublicProps = ReservedProps &
  AllowedComponentProps &
  ComponentCustomProps

export type VaporRenderResult<T = Block> = VNode | T | VaporRenderResult<T>[]

type VaporComponentInstanceConstructor<T extends VaporComponentInstance> = {
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
  new (...args: any[]): T
}

export type DefineVaporComponent<
  RuntimePropsOptions = {},
  RuntimePropsKeys extends string = string,
  Emits extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
  TypeRefs extends Record<string, unknown> = {},
  MakeDefaultsOptional extends boolean = true,
  InferredProps = string extends RuntimePropsKeys
    ? ComponentObjectPropsOptions extends RuntimePropsOptions
      ? {}
      : ExtractPropTypes<RuntimePropsOptions>
    : { [key in RuntimePropsKeys]?: any },
  PublicProps = VaporPublicProps,
  ResolvedProps = InferredProps & EmitsToProps<Emits>,
  Defaults = ExtractDefaultPropTypes<RuntimePropsOptions>,
> = VaporComponentInstanceConstructor<
  VaporComponentInstance<
    MakeDefaultsOptional extends true
      ? keyof Defaults extends never
        ? Prettify<ResolvedProps> & PublicProps
        : Partial<Defaults> &
            Omit<Prettify<ResolvedProps> & PublicProps, keyof Defaults>
      : Prettify<ResolvedProps> & PublicProps,
    Emits,
    Slots,
    Exposed,
    TypeBlock,
    TypeRefs
  >
> &
  ObjectVaporComponent<
    RuntimePropsOptions | RuntimePropsKeys[],
    Emits,
    RuntimeEmitsKeys,
    Slots,
    Exposed
  >

export type DefineVaporSetupFnComponent<
  Props extends Record<string, any> = {},
  Emits extends EmitsOptions = {},
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
  ResolvedProps extends Record<string, any> = Props &
    EmitsToProps<Emits> &
    VaporPublicProps,
> = new (
  props?: ResolvedProps,
) => VaporComponentInstance<ResolvedProps, Emits, Slots, Exposed, TypeBlock>

// overload 1: direct setup function
// (uses user defined props interface)
export function defineVaporComponent<
  Props extends Record<string, any>,
  Emits extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
>(
  setup: (
    props: Props,
    ctx: {
      emit: EmitFn<Emits>
      slots: Slots
      attrs: Record<string, any>
      expose: (exposed: Exposed) => void
    },
  ) => VaporRenderResult<TypeBlock> | void,
  extraOptions?: ObjectVaporComponent<
    (keyof Props)[],
    Emits,
    RuntimeEmitsKeys,
    Slots,
    Exposed
  > &
    ThisType<void>,
): DefineVaporSetupFnComponent<Props, Emits, Slots, Exposed, TypeBlock>
export function defineVaporComponent<
  Props extends Record<string, any>,
  Emits extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
>(
  setup: (
    props: Props,
    ctx: {
      emit: EmitFn<Emits>
      slots: Slots
      attrs: Record<string, any>
      expose: (exposed: Exposed) => void
    },
  ) => VaporRenderResult<TypeBlock> | void,
  extraOptions?: ObjectVaporComponent<
    ComponentObjectPropsOptions<Props>,
    Emits,
    RuntimeEmitsKeys,
    Slots,
    Exposed
  > &
    ThisType<void>,
): DefineVaporSetupFnComponent<Props, Emits, Slots, Exposed, TypeBlock>

// overload 2: defineVaporComponent with options object, infer props from options
export function defineVaporComponent<
  // props
  TypeProps,
  RuntimePropsOptions extends
    ComponentObjectPropsOptions = ComponentObjectPropsOptions,
  RuntimePropsKeys extends string = string,
  // emits
  TypeEmits extends ComponentTypeEmits = {},
  RuntimeEmitsOptions extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  // resolved types
  ResolvedEmits extends EmitsOptions = {} extends RuntimeEmitsOptions
    ? TypeEmitsToOptions<TypeEmits>
    : RuntimeEmitsOptions,
  InferredProps = IsKeyValues<TypeProps> extends true
    ? TypeProps
    : string extends RuntimePropsKeys
      ? ComponentObjectPropsOptions extends RuntimePropsOptions
        ? {}
        : ExtractPropTypes<RuntimePropsOptions>
      : { [key in RuntimePropsKeys]?: any },
  TypeRefs extends Record<string, unknown> = {},
  TypeBlock extends Block = Block,
>(
  options: ObjectVaporComponent<
    RuntimePropsOptions | RuntimePropsKeys[],
    ResolvedEmits,
    RuntimeEmitsKeys,
    Slots,
    Exposed,
    TypeBlock,
    InferredProps
  > & {
    /**
     * @private for language-tools use only
     */
    __typeProps?: TypeProps
    /**
     * @private for language-tools use only
     */
    __typeEmits?: TypeEmits
    /**
     * @private for language-tools use only
     */
    __typeRefs?: TypeRefs
    /**
     * @private for language-tools use only
     */
    __typeEl?: TypeBlock
  } & ThisType<void>,
): DefineVaporComponent<
  RuntimePropsOptions,
  RuntimePropsKeys,
  ResolvedEmits,
  RuntimeEmitsKeys,
  Slots,
  Exposed extends Block ? Record<string, any> : Exposed,
  TypeBlock,
  TypeRefs,
  // MakeDefaultsOptional - if TypeProps is provided, set to false to use
  // user props types verbatim
  unknown extends TypeProps ? true : false,
  InferredProps
>

/*! #__NO_SIDE_EFFECTS__ */
export function defineVaporComponent(comp: any, extraOptions?: any) {
  if (isFunction(comp)) {
    // #8236: extend call and options.name access are considered side-effects
    // by Rollup, so we have to wrap it in a pure-annotated IIFE.
    return /*@__PURE__*/ (() =>
      extend({ name: comp.name }, extraOptions, {
        setup: comp,
        __vapor: true,
      }))()
  }
  comp.__vapor = true
  return comp
}
