// This code is based on https://github.com/wonderful-panda/vue-tsx-support
// published under the MIT license.
// Copyright by @wonderful-panda
//
// which is in turn based on the react definition in DefinitelyTyped
// published under the MIT license.
//      Repository: https://github.com/DefinitelyTyped/DefinitelyTyped
//      Path in the repository: types/react/v15/index.d.ts
//
// Copyrights of original definition are:
//      Asana <https://asana.com>
//      AssureSign <http://www.assuresign.com>
//      Microsoft <https://microsoft.com>
//      John Reilly <https://github.com/johnnyreilly/>
//      Benoit Benezech <https://github.com/bbenezech>
//      Patricio Zavolinsky <https://github.com/pzavolinsky>
//      Digiguru <https://github.com/digiguru>
//      Eric Anderson <https://github.com/ericanderson>
//      Albert Kurniawan <https://github.com/morcerf>
//      Tanguy Krotoff <https://github.com/tkrotoff>
//      Dovydas Navickas <https://github.com/DovydasNavickas>
//      Stéphane Goetz <https://github.com/onigoetz>

interface HTMLAttributes {
  class?: any
  style?: string | { [key: string]: string | number }
  accesskey?: string
  contenteditable?: boolean
  contextmenu?: string
  dir?: string
  disabled?: boolean
  draggable?: boolean
  hidden?: boolean
  id?: string
  lang?: string
  spellcheck?: boolean
  tabindex?: number
  title?: string

  role?: string
}

interface AnchorHTMLAttributes extends HTMLAttributes {
  download?: any
  href?: string
  hreflang?: string
  media?: string
  rel?: string
  target?: string
}

interface AreaHTMLAttributes extends HTMLAttributes {
  alt?: string
  coord?: string
  download?: any
  href?: string
  hreflang?: string
  media?: string
  rel?: string
  shape?: string
  target?: string
}

interface AudioHTMLAttributes extends MediaHTMLAttributes {}

interface BaseHTMLAttributes extends HTMLAttributes {
  href?: string
  target?: string
}

interface BlockquoteHTMLAttributes extends HTMLAttributes {
  cite?: string
}

interface ButtonHTMLAttributes extends HTMLAttributes {
  autofocus?: boolean
  disabled?: boolean
  form?: string
  formaction?: string
  formenctype?: string
  formmethod?: string
  formnovalidate?: boolean
  formtarget?: string
  name?: string
  type?: string
  value?: string | string[] | number
}

interface CanvasHTMLAttributes extends HTMLAttributes {
  height?: number | string
  width?: number | string
}

interface ColHTMLAttributes extends HTMLAttributes {
  span?: number
}

interface ColgroupHTMLAttributes extends ColHTMLAttributes {}

interface DetailsHTMLAttributes extends HTMLAttributes {
  open?: boolean
}

interface DelHTMLAttributes extends HTMLAttributes {
  cite?: string
  datetime?: string
}

interface EmbedHTMLAttributes extends HTMLAttributes {
  height?: number | string
  src?: string
  type?: string
  width?: number | string
}

interface FieldsetHTMLAttributes extends HTMLAttributes {
  disabled?: boolean
  form?: string
  name?: string
}

interface FormHTMLAttributes extends HTMLAttributes {
  acceptcharset?: string
  action?: string
  autocomplete?: string
  enctype?: string
  method?: string
  name?: string
  novalidate?: boolean
  target?: string
}

interface HtmlHTMLAttributes extends HTMLAttributes {
  manifest?: string
}

interface IframeHTMLAttributes extends HTMLAttributes {
  allowfullscreen?: boolean
  allowtransparency?: boolean
  frameborder?: number | string
  height?: number | string
  marginheight?: number
  marginwidth?: number
  name?: string
  sandbox?: string
  scrolling?: string
  seamless?: boolean
  src?: string
  srcdoc?: string
  width?: number | string
}

interface ImgHTMLAttributes extends HTMLAttributes {
  alt?: string
  height?: number | string
  sizes?: string
  src?: string
  srcset?: string
  usemap?: string
  width?: number | string
}

interface InsHTMLAttributes extends HTMLAttributes {
  cite?: string
  datetime?: string
}

interface InputHTMLAttributes extends HTMLAttributes {
  accept?: string
  alt?: string
  autocomplete?: string
  autofocus?: boolean
  capture?: boolean // https://www.w3.org/tr/html-media-capture/#the-capture-attribute
  checked?: boolean
  crossorigin?: string
  disabled?: boolean
  form?: string
  formaction?: string
  formenctype?: string
  formmethod?: string
  formnovalidate?: boolean
  formtarget?: string
  height?: number | string
  list?: string
  max?: number | string
  maxlength?: number
  min?: number | string
  minlength?: number
  multiple?: boolean
  name?: string
  pattern?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
  size?: number
  src?: string
  step?: number | string
  type?: string
  value?: string | string[] | number
  width?: number | string
}

interface KeygenHTMLAttributes extends HTMLAttributes {
  autofocus?: boolean
  challenge?: string
  disabled?: boolean
  form?: string
  keytype?: string
  keyparams?: string
  name?: string
}

interface LabelHTMLAttributes extends HTMLAttributes {
  form?: string
  htmlfor?: string
}

interface LiHTMLAttributes extends HTMLAttributes {
  value?: string | string[] | number
}

interface LinkHTMLAttributes extends HTMLAttributes {
  href?: string
  hreflang?: string
  integrity?: string
  media?: string
  rel?: string
  sizes?: string
  type?: string
}

interface MapHTMLAttributes extends HTMLAttributes {
  name?: string
}

interface MenuHTMLAttributes extends HTMLAttributes {
  type?: string
}

interface MediaHTMLAttributes extends HTMLAttributes {
  autoplay?: boolean
  controls?: boolean
  crossorigin?: string
  loop?: boolean
  mediagroup?: string
  muted?: boolean
  preload?: string
  src?: string
}

interface MetaHTMLAttributes extends HTMLAttributes {
  charset?: string
  content?: string
  httpequiv?: string
  name?: string
}

interface MeterHTMLAttributes extends HTMLAttributes {
  form?: string
  high?: number
  low?: number
  max?: number | string
  min?: number | string
  optimum?: number
  value?: string | string[] | number
}

interface QuoteHTMLAttributes extends HTMLAttributes {
  cite?: string
}

interface ObjectHTMLAttributes extends HTMLAttributes {
  classid?: string
  data?: string
  form?: string
  height?: number | string
  name?: string
  type?: string
  usemap?: string
  width?: number | string
  wmode?: string
}

interface OlHTMLAttributes extends HTMLAttributes {
  reversed?: boolean
  start?: number
}

interface OptgroupHTMLAttributes extends HTMLAttributes {
  disabled?: boolean
  label?: string
}

interface OptionHTMLAttributes extends HTMLAttributes {
  disabled?: boolean
  label?: string
  selected?: boolean
  value?: string | string[] | number
}

interface OutputHTMLAttributes extends HTMLAttributes {
  form?: string
  htmlfor?: string
  name?: string
}

interface ParamHTMLAttributes extends HTMLAttributes {
  name?: string
  value?: string | string[] | number
}

interface ProgressHTMLAttributes extends HTMLAttributes {
  max?: number | string
  value?: string | string[] | number
}

interface ScriptHTMLAttributes extends HTMLAttributes {
  async?: boolean
  charset?: string
  crossorigin?: string
  defer?: boolean
  integrity?: string
  nonce?: string
  src?: string
  type?: string
}

interface SelectHTMLAttributes extends HTMLAttributes {
  autofocus?: boolean
  disabled?: boolean
  form?: string
  multiple?: boolean
  name?: string
  required?: boolean
  size?: number
  value?: string | string[] | number
}

interface SourceHTMLAttributes extends HTMLAttributes {
  media?: string
  sizes?: string
  src?: string
  srcset?: string
  type?: string
}

interface StyleHTMLAttributes extends HTMLAttributes {
  media?: string
  nonce?: string
  scoped?: boolean
  type?: string
}

interface TableHTMLAttributes extends HTMLAttributes {
  cellpadding?: number | string
  cellspacing?: number | string
  summary?: string
}

interface TextareaHTMLAttributes extends HTMLAttributes {
  autocomplete?: string
  autofocus?: boolean
  cols?: number
  dirname?: string
  disabled?: boolean
  form?: string
  maxlength?: number
  minlength?: number
  name?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
  rows?: number
  value?: string | string[] | number
  wrap?: string
}

interface TdHTMLAttributes extends HTMLAttributes {
  colspan?: number
  headers?: string
  rowspan?: number
}

interface ThHTMLAttributes extends HTMLAttributes {
  colspan?: number
  headers?: string
  rowspan?: number
  scope?: string
}

interface TimeHTMLAttributes extends HTMLAttributes {
  datetime?: string
}

interface TrackHTMLAttributes extends HTMLAttributes {
  default?: boolean
  kind?: string
  label?: string
  src?: string
  srclang?: string
}

interface VideoHTMLAttributes extends MediaHTMLAttributes {
  height?: number | string
  playsinline?: boolean
  poster?: string
  width?: number | string
}

interface AllHTMLAttributes extends HTMLAttributes {
  accept?: string
  acceptcharset?: string
  action?: boolean
  allowfullscreen?: boolean
  allowtransparency?: boolean
  alt?: string
  async?: boolean
  autocomplete?: string
  autofocus?: boolean
  autoplay?: boolean
  capture?: boolean // https://www.w3.org/tr/html-media-capture/#the-capture-attribute
  cellpadding?: number | string
  cellspacing?: number | string
  challenge?: string
  charset?: string
  checked?: boolean
  cite?: string
  classid?: string
  cols?: number
  colspan?: number
  content?: string
  controls?: boolean
  coord?: string
  crossorigin?: string
  data?: string
  datetime?: string
  default?: boolean
  defer?: boolean
  dirname?: string
  disabled?: boolean
  download?: any
  enctype?: string
  form?: string
  formaction?: string
  formenctype?: string
  formmethod?: string
  formnovalidate?: boolean
  formtarget?: string
  frameborder?: number | string
  headers?: string
  height?: number | string
  high?: number
  href?: string
  hreflang?: string
  htmlfor?: string
  httpequiv?: string
  integrity?: string
  keyparams?: string
  keytype?: string
  kind?: string
  label?: string
  list?: string
  loop?: boolean
  low?: number
  manifest?: string
  marginheight?: number
  marginwidth?: number
  max?: number | string
  maxlength?: number
  media?: string
  mediagroup?: string
  method?: string
  min?: number | string
  minlength?: number
  multiple?: boolean
  muted?: boolean
  name?: string
  nonce?: string
  novalidate?: boolean
  open?: boolean
  optimum?: number
  pattern?: string
  placeholder?: string
  playsinline?: boolean
  poster?: string
  preload?: string
  readonly?: boolean
  rel?: string
  required?: boolean
  reversed?: boolean
  rows?: number
  rowspan?: number
  sandbox?: string
  scope?: string
  scoped?: boolean
  scrolling?: string
  seamless?: boolean
  selected?: boolean
  shape?: string
  size?: number
  sizes?: string
  span?: number
  src?: string
  srcdoc?: string
  srclang?: string
  srcset?: string
  start?: number
  step?: number | string
  summary?: string
  target?: string
  type?: string
  usemap?: string
  value?: string | string[] | number
  width?: number | string
  wmode?: string
  wrap?: string
}

interface IntrinsicElementAttributes {
  a: AnchorHTMLAttributes
  abbr: HTMLAttributes
  address: HTMLAttributes
  area: AreaHTMLAttributes
  article: HTMLAttributes
  aside: HTMLAttributes
  audio: AudioHTMLAttributes
  b: HTMLAttributes
  base: BaseHTMLAttributes
  bdi: HTMLAttributes
  bdo: HTMLAttributes
  big: HTMLAttributes
  blockquote: BlockquoteHTMLAttributes
  body: HTMLAttributes
  br: HTMLAttributes
  button: ButtonHTMLAttributes
  canvas: CanvasHTMLAttributes
  caption: HTMLAttributes
  cite: HTMLAttributes
  code: HTMLAttributes
  col: ColHTMLAttributes
  colgroup: ColgroupHTMLAttributes
  data: HTMLAttributes
  datalist: HTMLAttributes
  dd: HTMLAttributes
  del: DelHTMLAttributes
  details: DetailsHTMLAttributes
  dfn: HTMLAttributes
  dialog: HTMLAttributes
  div: HTMLAttributes
  dl: HTMLAttributes
  dt: HTMLAttributes
  em: HTMLAttributes
  embed: EmbedHTMLAttributes
  fieldset: FieldsetHTMLAttributes
  figcaption: HTMLAttributes
  figure: HTMLAttributes
  footer: HTMLAttributes
  form: FormHTMLAttributes
  h1: HTMLAttributes
  h2: HTMLAttributes
  h3: HTMLAttributes
  h4: HTMLAttributes
  h5: HTMLAttributes
  h6: HTMLAttributes
  head: HTMLAttributes
  header: HTMLAttributes
  hgroup: HTMLAttributes
  hr: HTMLAttributes
  html: HtmlHTMLAttributes
  i: HTMLAttributes
  iframe: IframeHTMLAttributes
  img: ImgHTMLAttributes
  input: InputHTMLAttributes
  ins: InsHTMLAttributes
  kbd: HTMLAttributes
  keygen: KeygenHTMLAttributes
  label: LabelHTMLAttributes
  legend: HTMLAttributes
  li: LiHTMLAttributes
  link: LinkHTMLAttributes
  main: HTMLAttributes
  map: MapHTMLAttributes
  mark: HTMLAttributes
  menu: MenuHTMLAttributes
  menuitem: HTMLAttributes
  meta: MetaHTMLAttributes
  meter: MeterHTMLAttributes
  nav: HTMLAttributes
  noscript: HTMLAttributes
  object: ObjectHTMLAttributes
  ol: OlHTMLAttributes
  optgroup: OptgroupHTMLAttributes
  option: OptionHTMLAttributes
  output: OutputHTMLAttributes
  p: HTMLAttributes
  param: ParamHTMLAttributes
  picture: HTMLAttributes
  pre: HTMLAttributes
  progress: ProgressHTMLAttributes
  q: QuoteHTMLAttributes
  rp: HTMLAttributes
  rt: HTMLAttributes
  ruby: HTMLAttributes
  s: HTMLAttributes
  samp: HTMLAttributes
  script: ScriptHTMLAttributes
  section: HTMLAttributes
  select: SelectHTMLAttributes
  small: HTMLAttributes
  source: SourceHTMLAttributes
  span: HTMLAttributes
  strong: HTMLAttributes
  style: StyleHTMLAttributes
  sub: HTMLAttributes
  summary: HTMLAttributes
  sup: HTMLAttributes
  table: TableHTMLAttributes
  tbody: HTMLAttributes
  td: TdHTMLAttributes
  textarea: TextareaHTMLAttributes
  tfoot: HTMLAttributes
  th: ThHTMLAttributes
  thead: HTMLAttributes
  time: TimeHTMLAttributes
  title: HTMLAttributes
  tr: HTMLAttributes
  track: TrackHTMLAttributes
  u: HTMLAttributes
  ul: HTMLAttributes
  var: HTMLAttributes
  video: VideoHTMLAttributes
  wbr: HTMLAttributes
}

interface Events {
  // clipboard events
  onCopy: ClipboardEvent
  onCut: ClipboardEvent
  onPaste: ClipboardEvent

  // composition events
  onCompositionend: CompositionEvent
  onCompositionstart: CompositionEvent
  onCompositionupdate: CompositionEvent

  // drag drop events
  onDrag: DragEvent
  onDragend: DragEvent
  onDragenter: DragEvent
  onDragexit: DragEvent
  onDragleave: DragEvent
  onDragover: DragEvent
  onDragstart: DragEvent
  onDrop: DragEvent

  // focus events
  onFocus: FocusEvent
  onBlur: FocusEvent

  // form events
  onChange: Event
  onInput: Event
  onReset: Event
  onSubmit: Event
  onInvalid: Event

  // image events
  onLoad: Event
  onError: Event

  // keyboard events
  onKeydown: KeyboardEvent
  onKeypress: KeyboardEvent
  onKeyup: KeyboardEvent

  // mouse events
  onClick: MouseEvent
  onContextmenu: MouseEvent
  onDblclick: MouseEvent
  onMousedown: MouseEvent
  onMouseenter: MouseEvent
  onMouseleave: MouseEvent
  onMousemove: MouseEvent
  onMouseout: MouseEvent
  onMouseover: MouseEvent
  onMouseup: MouseEvent

  // media events
  onAbort: Event
  onCanplay: Event
  onCanplaythrough: Event
  onDurationchange: Event
  onEmptied: Event
  onEncrypted: Event
  onEnded: Event
  onLoadeddata: Event
  onLoadedmetadata: Event
  onLoadstart: Event
  onPause: Event
  onPlay: Event
  onPlaying: Event
  onProgress: Event
  onRatechange: Event
  onSeeked: Event
  onSeeking: Event
  onStalled: Event
  onSuspend: Event
  onTimeupdate: Event
  onVolumechange: Event
  onWaiting: Event

  // selection events
  onSelect: Event

  // UI events
  onScroll: UIEvent

  // touch events
  onTouchcancel: TouchEvent
  onTouchend: TouchEvent
  onTouchmove: TouchEvent
  onTouchstart: TouchEvent

  // wheel events
  onWheel: WheelEvent

  // animation events
  onAnimationstart: AnimationEvent
  onAnimationend: AnimationEvent
  onAnimationiteration: AnimationEvent

  // transition events
  onTransitionend: TransitionEvent
  onTransitionstart: TransitionEvent
}

type StringKeyOf<T> = Extract<keyof T, string>

type EventHandlers<E> = {
  [K in StringKeyOf<E>]?: E[K] extends Function ? E[K] : (payload: E[K]) => void
}

type ElementAttrs<T> = T & EventHandlers<Events>

type NativeElements = {
  [K in StringKeyOf<IntrinsicElementAttributes>]: ElementAttrs<
    IntrinsicElementAttributes[K]
  >
}

declare namespace JSX {
  interface Element {}
  interface ElementClass {
    $props: {}
  }
  interface ElementAttributesProperty {
    $props: {}
  }
  interface IntrinsicElements extends NativeElements {
    // allow arbitrary elements
    [name: string]: any
  }
}
