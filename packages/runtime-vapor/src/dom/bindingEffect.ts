import { inOnceSlot } from '../componentSlots'
import { renderEffect } from '../renderEffect'
import { on, onBinding, setDynamicEvents } from './event'
import { txt } from './node'
import {
  setAttr,
  setBlockHtml,
  setBlockText,
  setClass,
  setClassName,
  setDOMProp,
  setDynamicProps,
  setHtml,
  setProp,
  setStyle,
  setText,
  setValue,
} from './prop'

type TextNodeWithCache = Text & { $txt?: string }
type MergedDynamicPropsSource = Record<string, any> | null | undefined
type DynamicPropsGetter = () => MergedDynamicPropsSource

export function setTextBinding(parent: ParentNode, getter: () => string): void {
  const text = txt(parent) as TextNodeWithCache
  renderEffect(() => setText(text, getter()))
}

export function setHtmlBinding(el: any, getter: () => any): void {
  renderEffect(() => setHtml(el, getter()))
}

export function setBlockHtmlBinding(block: any, getter: () => any): void {
  renderEffect(() => setBlockHtml(block, getter()))
}

export function setBlockTextBinding(block: any, getter: () => any): void {
  renderEffect(() => setBlockText(block, getter()))
}

export function setClassBinding(
  el: any,
  getter: () => any,
  isSVG: boolean = false,
): void {
  renderEffect(() => setClass(el, getter(), isSVG))
}

export function setClassNameBinding(
  el: any,
  getter: () => number,
  cls: string | string[],
  prefix: string = '',
  suffix: string = '',
): void {
  renderEffect(() => setClassName(el, getter(), cls, prefix, suffix))
}

export function setStyleBinding(el: any, getter: () => any): void {
  renderEffect(() => setStyle(el, getter()))
}

export function setValueBinding(el: any, getter: () => any): void {
  renderEffect(() => setValue(el, getter()))
}

export function setAttrBinding(
  el: any,
  key: string,
  getter: () => any,
  isSVG: boolean = false,
): void {
  renderEffect(() => setAttr(el, key, getter(), isSVG))
}

export function setPropBinding(el: any, key: string, getter: () => any): void {
  renderEffect(() => setProp(el, key, getter()))
}

export function setDOMPropBinding(
  el: any,
  key: string,
  getter: () => any,
): void {
  renderEffect(() => setDOMProp(el, key, getter()))
}

export function setDynamicPropsBinding(
  el: any,
  getter: () => any[],
  isSVG: boolean = false,
): void {
  renderEffect(() => setDynamicProps(el, getter(), isSVG))
}

export function setMergedDynamicPropsBinding(
  el: any,
  before: MergedDynamicPropsSource,
  getter: DynamicPropsGetter,
  after?: MergedDynamicPropsSource,
  isSVG?: boolean,
): void {
  const values = createMergedDynamicPropsValues(before, undefined, after)
  const index = before != null ? 1 : 0
  renderEffect(() => {
    values[index] = getter()
    setDynamicProps(el, values, isSVG === true)
  })
}

function createMergedDynamicPropsValues(
  before: MergedDynamicPropsSource,
  value: MergedDynamicPropsSource,
  after: MergedDynamicPropsSource,
): any[] {
  return before != null
    ? after != null
      ? [before, value, after]
      : [before, value]
    : after != null
      ? [value, after]
      : [value]
}

export function setEventBinding(
  el: Element,
  getter: () => string,
  handler: (e: Event) => any | ((e: Event) => any)[],
  options?: AddEventListenerOptions,
): void {
  if (inOnceSlot) {
    on(el, getter(), handler, options)
    return
  }

  renderEffect(() => onBinding(el, getter(), handler, options))
}

export function setDynamicEventsBinding(
  el: HTMLElement,
  getter: () => Record<string, (...args: any[]) => any>,
): void {
  if (inOnceSlot) {
    const events = getter()
    for (const name in events) {
      on(el, name, events[name])
    }
    return
  }

  renderEffect(() => setDynamicEvents(el, getter()))
}
