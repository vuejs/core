import { SourceLocation } from '../ast'
import { CompilerError } from '../errors'
import { ParserContext } from '../parse'
import { TransformContext } from '../transform'

export type CompilerCompatConfig = Partial<
  Record<CompilerDeprecationTypes, boolean | 'suppress-warning'>
> & {
  MODE?: 2 | 3
}

export interface CompilerCompatOptions {
  compatConfig?: CompilerCompatConfig
}

export const enum CompilerDeprecationTypes {
  IS_ON_ELEMENT = 'IS_ON_ELEMENT',
  V_BIND_SYNC = 'V_BIND_SYNC',
  V_BIND_OBJECT_ORDER = 'V_BIND_OBJECT_ORDER',
  V_ON_NATIVE_MODIFIER = 'V_ON_NATIVE_MODIFIER',
  KEY_V_IF = 'KEY_V_IF',
  KEY_V_FOR_TEMPLATE = 'KEY_V_FOR_TEMPLATE',
  V_IF_V_FOR_PRECEDENCE = 'V_IF_V_FOR_PRECEDENCE',
  NATIVE_TEMPLATE = 'NATIVE_TEMPLATE'
}

type DeprecationData = {
  message: string | ((...args: any[]) => string)
  link?: string
}

const deprecationData: Record<CompilerDeprecationTypes, DeprecationData> = {
  [CompilerDeprecationTypes.IS_ON_ELEMENT]: {
    message: ``,
    link: `https://v3.vuejs.org/guide/migration/custom-elements-interop.html`
  },

  [CompilerDeprecationTypes.V_BIND_SYNC]: {
    message: key =>
      `.sync modifier for v-bind has been removed. Use v-model with ` +
      `argument instead. \`v-bind:${key}.sync\` should be changed to ` +
      `\`v-model:${key}\`.`,
    link: `https://v3.vuejs.org/guide/migration/v-model.html`
  },

  [CompilerDeprecationTypes.V_BIND_OBJECT_ORDER]: {
    message:
      `v-bind="obj" usage is now order sensitive and behaves like JavaScript ` +
      `object spread: it will now overwrite an existing attribute that appears ` +
      `before v-bind in the case of conflicting keys. To retain 2.x behavior, ` +
      `move v-bind to and make it the first attribute. If all occurences ` +
      `of this warning are working as intended, you can suppress it.`,
    link: `https://v3.vuejs.org/guide/migration/v-bind.html`
  },

  [CompilerDeprecationTypes.V_ON_NATIVE_MODIFIER]: {
    message: `.native modifier for v-on has been removed as is no longer necessary.`,
    link: `https://v3.vuejs.org/guide/migration/v-on-native-modifier-removed.html`
  },

  [CompilerDeprecationTypes.KEY_V_IF]: {
    message: ``,
    link: `https://v3.vuejs.org/guide/migration/key-attribute.html#on-conditional-branches`
  },

  [CompilerDeprecationTypes.KEY_V_FOR_TEMPLATE]: {
    message: ``,
    link: `https://v3.vuejs.org/guide/migration/key-attribute.html#with-template-v-for`
  },

  [CompilerDeprecationTypes.V_IF_V_FOR_PRECEDENCE]: {
    message:
      `v-if / v-for precedence when used on the same element has changed ` +
      `in Vue 3. It is best to avoid the ambiguity with either <template> tags ` +
      `or a computed property that filters v-for data source.`,
    link: `https://v3.vuejs.org/guide/migration/v-if-v-for.html`
  },

  [CompilerDeprecationTypes.NATIVE_TEMPLATE]: {
    message:
      `<template> with no special directives will render as a native template` +
      `element instead of its inner content in Vue 3.`
  }
}

function getCompatValue(
  key: CompilerDeprecationTypes,
  context: ParserContext | TransformContext
) {
  const config = (context as ParserContext).options
    ? (context as ParserContext).options.compatConfig
    : (context as TransformContext).compatConfig
  return config && config[key]
}

export function checkCompatEnabled(
  key: CompilerDeprecationTypes,
  context: ParserContext | TransformContext,
  loc: SourceLocation | null,
  ...args: any[]
): boolean {
  const enabled = getCompatValue(key, context) !== false
  if (__DEV__ && enabled) {
    warnDeprecation(key, context, loc, ...args)
  }
  return enabled
}

export function warnDeprecation(
  key: CompilerDeprecationTypes,
  context: ParserContext | TransformContext,
  loc: SourceLocation | null,
  ...args: any[]
) {
  const val = getCompatValue(key, context)
  if (val === 'suppress-warning') {
    return
  }
  const { message, link } = deprecationData[key]
  const msg = `(deprecation ${key}) ${
    typeof message === 'function' ? message(...args) : message
  }${link ? `\n  Details: ${link}` : ``}`

  if (loc) {
    const err = new SyntaxError(msg) as CompilerError
    err.code = key
    err.loc = loc
    context.onWarn(err)
    return
  }

  context.onWarn(msg)
}
