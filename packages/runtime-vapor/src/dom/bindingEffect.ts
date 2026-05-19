import { inOnceSlot } from '../componentSlots'
import { RenderEffect } from '../renderEffect'
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

// Binding helpers need RenderEffect's current instance, lifecycle hook and
// scheduler wrapper. Implementing them with renderEffect(() => setX(getter()))
// would add a per-binding wrapper closure around the compiler-generated getter.
// These subclasses keep that wrapper as a shared prototype method instead of
// copying RenderEffect.fn() or adding branches to the hot setter functions.
class TextBindingEffect extends RenderEffect {
  text: TextNodeWithCache
  getter: () => string

  constructor(text: TextNodeWithCache, getter: () => string) {
    super(TextBindingEffect.prototype.renderText)
    this.text = text
    this.getter = getter
  }

  renderText(): void {
    setText(this.text, this.getter())
  }
}

class HtmlBindingEffect extends RenderEffect {
  el: any
  getter: () => any

  constructor(el: any, getter: () => any) {
    super(HtmlBindingEffect.prototype.renderHtml)
    this.el = el
    this.getter = getter
  }

  renderHtml(): void {
    setHtml(this.el, this.getter())
  }
}

class BlockHtmlBindingEffect extends RenderEffect {
  block: any
  getter: () => any

  constructor(block: any, getter: () => any) {
    super(BlockHtmlBindingEffect.prototype.renderBlockHtml)
    this.block = block
    this.getter = getter
  }

  renderBlockHtml(): void {
    setBlockHtml(this.block, this.getter())
  }
}

class BlockTextBindingEffect extends RenderEffect {
  block: any
  getter: () => any

  constructor(block: any, getter: () => any) {
    super(BlockTextBindingEffect.prototype.renderBlockText)
    this.block = block
    this.getter = getter
  }

  renderBlockText(): void {
    setBlockText(this.block, this.getter())
  }
}

class ClassBindingEffect extends RenderEffect {
  el: any
  getter: () => any
  isSVG: boolean

  constructor(el: any, getter: () => any, isSVG: boolean) {
    super(ClassBindingEffect.prototype.renderClass)
    this.el = el
    this.getter = getter
    this.isSVG = isSVG
  }

  renderClass(): void {
    setClass(this.el, this.getter(), this.isSVG)
  }
}

class ClassNameBindingEffect extends RenderEffect {
  el: any
  getter: () => number
  cls: string | string[]
  prefix: string
  suffix: string

  constructor(
    el: any,
    getter: () => number,
    cls: string | string[],
    prefix: string,
    suffix: string,
  ) {
    super(ClassNameBindingEffect.prototype.renderClassName)
    this.el = el
    this.getter = getter
    this.cls = cls
    this.prefix = prefix
    this.suffix = suffix
  }

  renderClassName(): void {
    setClassName(this.el, this.getter(), this.cls, this.prefix, this.suffix)
  }
}

class StyleBindingEffect extends RenderEffect {
  el: any
  getter: () => any

  constructor(el: any, getter: () => any) {
    super(StyleBindingEffect.prototype.renderStyle)
    this.el = el
    this.getter = getter
  }

  renderStyle(): void {
    setStyle(this.el, this.getter())
  }
}

class ValueBindingEffect extends RenderEffect {
  el: any
  getter: () => any

  constructor(el: any, getter: () => any) {
    super(ValueBindingEffect.prototype.renderValue)
    this.el = el
    this.getter = getter
  }

  renderValue(): void {
    setValue(this.el, this.getter())
  }
}

class AttrBindingEffect extends RenderEffect {
  el: any
  key: string
  getter: () => any
  isSVG: boolean

  constructor(el: any, key: string, getter: () => any, isSVG: boolean) {
    super(AttrBindingEffect.prototype.renderAttr)
    this.el = el
    this.key = key
    this.getter = getter
    this.isSVG = isSVG
  }

  renderAttr(): void {
    setAttr(this.el, this.key, this.getter(), this.isSVG)
  }
}

class PropBindingEffect extends RenderEffect {
  el: any
  key: string
  getter: () => any

  constructor(el: any, key: string, getter: () => any) {
    super(PropBindingEffect.prototype.renderProp)
    this.el = el
    this.key = key
    this.getter = getter
  }

  renderProp(): void {
    setProp(this.el, this.key, this.getter())
  }
}

class DOMPropBindingEffect extends RenderEffect {
  el: any
  key: string
  getter: () => any

  constructor(el: any, key: string, getter: () => any) {
    super(DOMPropBindingEffect.prototype.renderDOMProp)
    this.el = el
    this.key = key
    this.getter = getter
  }

  renderDOMProp(): void {
    setDOMProp(this.el, this.key, this.getter())
  }
}

class DynamicPropsBindingEffect extends RenderEffect {
  el: any
  getter: () => any[]
  isSVG: boolean

  constructor(el: any, getter: () => any[], isSVG: boolean) {
    super(DynamicPropsBindingEffect.prototype.renderDynamicProps)
    this.el = el
    this.getter = getter
    this.isSVG = isSVG
  }

  renderDynamicProps(): void {
    setDynamicProps(this.el, this.getter(), this.isSVG)
  }
}

class MergedDynamicPropsBindingEffect extends RenderEffect {
  el: any
  values: any[]
  getter: DynamicPropsGetter
  index: number
  isSVG: boolean

  constructor(
    el: any,
    before: MergedDynamicPropsSource,
    getter: DynamicPropsGetter,
    after: MergedDynamicPropsSource,
    isSVG: boolean,
  ) {
    super(MergedDynamicPropsBindingEffect.prototype.renderMergedDynamicProps)
    this.el = el
    this.values = createMergedDynamicPropsValues(before, undefined, after)
    this.getter = getter
    this.index = before != null ? 1 : 0
    this.isSVG = isSVG
  }

  renderMergedDynamicProps(): void {
    this.values[this.index] = this.getter()
    setDynamicProps(this.el, this.values, this.isSVG)
  }
}

class EventBindingEffect extends RenderEffect {
  el: Element
  getter: () => string
  handler: (e: Event) => any | ((e: Event) => any)[]
  options: AddEventListenerOptions | undefined

  constructor(
    el: Element,
    getter: () => string,
    handler: (e: Event) => any | ((e: Event) => any)[],
    options: AddEventListenerOptions | undefined,
  ) {
    super(EventBindingEffect.prototype.renderEvent)
    this.el = el
    this.getter = getter
    this.handler = handler
    this.options = options
  }

  renderEvent(): void {
    onBinding(this.el, this.getter(), this.handler, this.options)
  }
}

class DynamicEventsBindingEffect extends RenderEffect {
  el: HTMLElement
  getter: () => Record<string, (...args: any[]) => any>

  constructor(
    el: HTMLElement,
    getter: () => Record<string, (...args: any[]) => any>,
  ) {
    super(DynamicEventsBindingEffect.prototype.renderDynamicEvents)
    this.el = el
    this.getter = getter
  }

  renderDynamicEvents(): void {
    setDynamicEvents(this.el, this.getter())
  }
}

export function setTextBinding(parent: ParentNode, getter: () => string): void {
  const text = txt(parent) as TextNodeWithCache
  if (inOnceSlot) {
    setText(text, getter())
    return
  }

  const effect = new TextBindingEffect(text, getter)
  effect.run()
}

export function setHtmlBinding(el: any, getter: () => any): void {
  if (inOnceSlot) {
    setHtml(el, getter())
    return
  }

  const effect = new HtmlBindingEffect(el, getter)
  effect.run()
}

export function setBlockHtmlBinding(block: any, getter: () => any): void {
  if (inOnceSlot) {
    setBlockHtml(block, getter())
    return
  }

  const effect = new BlockHtmlBindingEffect(block, getter)
  effect.run()
}

export function setBlockTextBinding(block: any, getter: () => any): void {
  if (inOnceSlot) {
    setBlockText(block, getter())
    return
  }

  const effect = new BlockTextBindingEffect(block, getter)
  effect.run()
}

export function setClassBinding(
  el: any,
  getter: () => any,
  isSVG: boolean = false,
): void {
  if (inOnceSlot) {
    setClass(el, getter(), isSVG)
    return
  }

  const effect = new ClassBindingEffect(el, getter, isSVG)
  effect.run()
}

export function setClassNameBinding(
  el: any,
  getter: () => number,
  cls: string | string[],
  prefix: string = '',
  suffix: string = '',
): void {
  if (inOnceSlot) {
    setClassName(el, getter(), cls, prefix, suffix)
    return
  }

  const effect = new ClassNameBindingEffect(el, getter, cls, prefix, suffix)
  effect.run()
}

export function setStyleBinding(el: any, getter: () => any): void {
  if (inOnceSlot) {
    setStyle(el, getter())
    return
  }

  const effect = new StyleBindingEffect(el, getter)
  effect.run()
}

export function setValueBinding(el: any, getter: () => any): void {
  if (inOnceSlot) {
    setValue(el, getter())
    return
  }

  const effect = new ValueBindingEffect(el, getter)
  effect.run()
}

export function setAttrBinding(
  el: any,
  key: string,
  getter: () => any,
  isSVG: boolean = false,
): void {
  if (inOnceSlot) {
    setAttr(el, key, getter(), isSVG)
    return
  }

  const effect = new AttrBindingEffect(el, key, getter, isSVG)
  effect.run()
}

export function setPropBinding(el: any, key: string, getter: () => any): void {
  if (inOnceSlot) {
    setProp(el, key, getter())
    return
  }

  const effect = new PropBindingEffect(el, key, getter)
  effect.run()
}

export function setDOMPropBinding(
  el: any,
  key: string,
  getter: () => any,
): void {
  if (inOnceSlot) {
    setDOMProp(el, key, getter())
    return
  }

  const effect = new DOMPropBindingEffect(el, key, getter)
  effect.run()
}

export function setDynamicPropsBinding(
  el: any,
  getter: () => any[],
  isSVG: boolean = false,
): void {
  if (inOnceSlot) {
    setDynamicProps(el, getter(), isSVG)
    return
  }

  const effect = new DynamicPropsBindingEffect(el, getter, isSVG)
  effect.run()
}

export function setMergedDynamicPropsBinding(
  el: any,
  before: MergedDynamicPropsSource,
  getter: DynamicPropsGetter,
  after?: MergedDynamicPropsSource,
  isSVG?: boolean,
): void {
  if (inOnceSlot) {
    setDynamicProps(
      el,
      createMergedDynamicPropsValues(before, getter(), after),
      isSVG,
    )
    return
  }

  const effect = new MergedDynamicPropsBindingEffect(
    el,
    before,
    getter,
    after,
    isSVG === true,
  )
  effect.run()
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

  const effect = new EventBindingEffect(el, getter, handler, options)
  effect.run()
}

export function setDynamicEventsBinding(
  el: HTMLElement,
  getter: () => Record<string, (...args: any[]) => any>,
): void {
  if (inOnceSlot) {
    setDynamicEvents(el, getter())
    return
  }

  const effect = new DynamicEventsBindingEffect(el, getter)
  effect.run()
}
