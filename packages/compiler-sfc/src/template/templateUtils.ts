import { type UrlWithStringQuery, parse as uriParse } from 'url'
import {
  ElementTypes,
  NodeTypes,
  type ParentNode,
  type ParserOptions,
  findDir,
} from '@vue/compiler-dom'
import { isString } from '@vue/shared'
import { type SFCTemplateBlock, parse as parseSFC } from '../parse'

type RootChildNode = ParentNode['children'][number]

export function isRelativeUrl(url: string): boolean {
  const firstChar = url.charAt(0)
  return (
    firstChar === '.' ||
    firstChar === '~' ||
    firstChar === '@' ||
    firstChar === '#'
  )
}

const externalRE = /^(?:https?:)?\/\//
export function isExternalUrl(url: string): boolean {
  return externalRE.test(url)
}

const dataUrlRE = /^\s*data:/i
export function isDataUrl(url: string): boolean {
  return dataUrlRE.test(url)
}

export function normalizeDecodedImportPath(source: string): string {
  try {
    return decodeURIComponent(source)
  } catch {
    return source
  }
}

/**
 * Parses string url into URL object.
 */
export function parseUrl(url: string): UrlWithStringQuery {
  const firstChar = url.charAt(0)
  if (firstChar === '~') {
    const secondChar = url.charAt(1)
    url = url.slice(secondChar === '/' ? 2 : 1)
  }
  return parseUriParts(url)
}

/**
 * vuejs/component-compiler-utils#22 Support uri fragment in transformed require
 * @param urlString - an url as a string
 */
function parseUriParts(urlString: string): UrlWithStringQuery {
  // A TypeError is thrown if urlString is not a string
  // @see https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost
  return uriParse(isString(urlString) ? urlString : '', false, true)
}

/**
 * Whether the current component should be treated as multi-root at the
 * component boundary.
 *
 * This is currently only attached to Vapor components. During Vapor hydration,
 * components hydrate while they are being created, so the runtime needs this
 * metadata to know whether the current SSR `<!--[--> ... <!--]-->` belongs to
 * the component itself and should be consumed before hydrating its children.
 *
 * The inference is aligned with compile-ssr's ownership semantics: it answers
 * whether the component root itself owns an outer fragment wrapper.
 */
export function isMultiRoot(
  template: SFCTemplateBlock | ParentNode | string,
  parserOptions?: ParserOptions,
): boolean {
  const preserveComments = parserOptions?.comments !== false

  if (typeof template === 'string') {
    // Reuse SFC parsing semantics here instead of compiler-dom.parse(). This
    // keeps root-unit inference aligned with the AST shape used by compileScript
    // and avoids drifting on cases like root components with siblings.
    return (
      countRootUnits(
        parseSFC(`<template>${template}</template>`, {
          sourceMap: false,
          ignoreEmpty: false,
          templateParseOptions: parserOptions,
        }).descriptor.template!.ast!,
        preserveComments,
      ) > 1
    )
  }

  if (isTemplateBlock(template)) {
    return countRootUnits(template.ast!, preserveComments) > 1
  }

  return countRootUnits(template, preserveComments) > 1
}

function countRootUnits(parent: ParentNode, preserveComments: boolean): number {
  const { children } = parent
  let count = 0

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isWhitespaceRootText(child)) {
      continue
    }
    if (isIfBranchStart(child)) {
      count++
      let lastBranchIndex = i
      let nextIndex = i + 1
      while (nextIndex < children.length) {
        let continuationIndex = nextIndex
        while (
          continuationIndex < children.length &&
          isIgnorableIfChainSeparator(children[continuationIndex])
        ) {
          continuationIndex++
        }
        if (
          continuationIndex < children.length &&
          isIfBranchContinuation(children[continuationIndex])
        ) {
          lastBranchIndex = continuationIndex
          nextIndex = continuationIndex + 1
          continue
        }
        break
      }
      i = lastBranchIndex
      continue
    }
    count += countRootUnit(child, preserveComments)
  }

  return count
}

function countRootUnit(node: RootChildNode, preserveComments: boolean): number {
  if (node.type !== NodeTypes.ELEMENT) {
    return node.type === NodeTypes.COMMENT && !preserveComments ? 0 : 1
  }

  if (
    hasStructuralDirective(node, 'if') ||
    hasStructuralDirective(node, 'for')
  ) {
    return 1
  }

  if (node.tag === 'slot' || node.tagType === ElementTypes.COMPONENT) {
    return 1
  }

  if (node.tagType === ElementTypes.TEMPLATE) {
    return countRootUnits(node, preserveComments)
  }

  return 1
}

function hasStructuralDirective(
  node: Extract<RootChildNode, { type: NodeTypes.ELEMENT }>,
  name: string,
): boolean {
  return !!findDir(node, name)
}

function isIfBranchStart(node: RootChildNode): boolean {
  return node.type === NodeTypes.ELEMENT && hasStructuralDirective(node, 'if')
}

function isIfBranchContinuation(node: RootChildNode): boolean {
  return (
    node.type === NodeTypes.ELEMENT &&
    !!findDir(node, /^else(-if)?$/, true /* allowEmpty */)
  )
}

function isWhitespaceRootText(node: RootChildNode): boolean {
  return node.type === NodeTypes.TEXT && !node.content.trim()
}

function isIgnorableIfChainSeparator(node: RootChildNode): boolean {
  return isWhitespaceRootText(node) || node.type === NodeTypes.COMMENT
}

function isTemplateBlock(
  value: SFCTemplateBlock | ParentNode,
): value is SFCTemplateBlock {
  return 'content' in value && 'attrs' in value
}
