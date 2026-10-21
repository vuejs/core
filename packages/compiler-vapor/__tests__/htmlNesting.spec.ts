/**
 * @vitest-environment jsdom
 */

import { Namespaces, isVoidTag } from '@vue/shared'
import {
  closesOpenAncestor,
  enterOpenScope,
  keepsInTemplate,
} from '../src/htmlNesting'

// The native html tags the compiler knows (shared/domTagConfig HTML_TAGS,
// minus the document tags, which never appear in a component template);
// anything else is a component and never lands in a template string.
const HTML_TAGS = (
  'base,link,meta,style,title,address,article,aside,footer,' +
  'header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,' +
  'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
  'data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,' +
  'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
  'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
  'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
  'option,output,progress,select,textarea,details,dialog,menu,' +
  'summary,template,blockquote,iframe,tfoot'
).split(',')
// Their content is raw text: element children are either kept apart by
// isValidHTMLNesting (script, style, iframe, ...) or created like a custom
// element (noscript), so the string parser never sees them.
const RAW_TEXT = new Set(
  'script,style,title,textarea,iframe,noscript'.split(','),
)
// `<template>` children go through createElement
const parents = HTML_TAGS.filter(
  tag => !isVoidTag(tag) && !RAW_TEXT.has(tag) && tag !== 'template',
)
const children = HTML_TAGS

const t = document.createElement('template')

/**
 * Whether the runtime's parser (`template.innerHTML`) keeps the chain of
 * elements nested as written: same tags in the same order, html namespace,
 * nothing else, and the innermost element still open (checked with a comment
 * sentinel, which an element popped right after insertion would not receive).
 */
function parserKeeps(chain: string[]): boolean {
  const last = chain[chain.length - 1]
  const sentinel =
    !isVoidTag(last) && !RAW_TEXT.has(last) && last !== 'template'
  let html = ''
  for (const tag of chain) html += `<${tag}>`
  if (sentinel) html += '<!--s-->'
  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isVoidTag(chain[i])) html += `</${chain[i]}>`
  }
  t.innerHTML = html
  let parent: ParentNode = t.content
  for (const tag of chain) {
    if (parent.childNodes.length !== 1) return false
    const el = parent.firstChild as Element
    if (
      el.nodeType !== 1 ||
      el.localName !== tag ||
      el.namespaceURI !== 'http://www.w3.org/1999/xhtml'
    ) {
      return false
    }
    parent = el
  }
  return sentinel
    ? parent.childNodes.length === 1 && parent.firstChild!.nodeType === 8
    : parent.childNodes.length === 0
}

// what the open elements `tags` (outermost first) leave open for a child;
// the chain is taken as one template
function scopeOf(tags: string[]): number {
  let scope = 0
  for (const tag of tags) scope = enterOpenScope(scope, tag, Namespaces.HTML)
  return scope
}

function sameTemplate(tags: string[], tag: string): boolean {
  return keepsInTemplate(
    tag,
    Namespaces.HTML,
    tags[tags.length - 1],
    scopeOf(tags),
  )
}

test('every tag pair the parser restructures is kept apart', () => {
  const missed: string[] = []
  for (const parent of parents) {
    for (const child of children) {
      if (sameTemplate([parent], child) && !parserKeeps([parent, child])) {
        missed.push(`${parent}>${child}`)
      }
    }
  }
  expect(missed).toEqual([])
})

// Every triple whose two pairs the parser keeps, so that only an open
// ancestor can be the reason it restructures (an open `<p>`, or a `<select>`
// restricting what its subtree may hold, which isValidHTMLNesting's
// select/option/optgroup rules cover). The two layers together must keep each
// such triple apart, and the ancestor rules must not flag a triple the parser
// keeps. ~600k parses, about a minute - run with NESTING_MATRIX=1.
test.runIf(process.env.NESTING_MATRIX)(
  'every tag triple matches the parser',
  () => {
    const keeps = new Map<string, boolean>()
    for (const parent of parents) {
      for (const child of children) {
        keeps.set(`${parent}>${child}`, parserKeeps([parent, child]))
      }
    }
    const missed: string[] = []
    const extra: string[] = []
    for (const a of parents) {
      for (const b of parents) {
        if (!keeps.get(`${a}>${b}`)) continue
        for (const c of children) {
          if (!keeps.get(`${b}>${c}`)) continue
          const kept = parserKeeps([a, b, c])
          if (sameTemplate([a, b], c) && !kept) {
            missed.push(`${a}>${b}>${c}`)
          }
          if (
            closesOpenAncestor(c, Namespaces.HTML, b, scopeOf([a, b])) &&
            kept
          ) {
            extra.push(`${a}>${b}>${c}`)
          }
        }
      }
    }
    expect(missed).toEqual([])
    expect(extra).toEqual([])
  },
  600_000,
)
