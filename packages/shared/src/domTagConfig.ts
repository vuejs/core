// These tag configs are shared between compiler-dom and runtime-dom, so they
// must be extracted in shared to avoid creating a dependency between the two.
import { makeMap } from './makeMap'

// https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const HTML_TAGS =
  'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
  'header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,' +
  'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
  'data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,' +
  'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
  'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
  'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
  'option,output,progress,select,textarea,details,dialog,menu,' +
  'summary,template,blockquote,iframe,tfoot'

// https://developer.mozilla.org/en-US/docs/Web/SVG/Element
const SVG_TAGS =
  'svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,' +
  'defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,' +
  'feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,' +
  'feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,' +
  'feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,' +
  'fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,' +
  'foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,' +
  'mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,' +
  'polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,' +
  'text,textPath,title,tspan,unknown,use,view'

// https://www.w3.org/TR/mathml4/ (content elements excluded)
const MATH_TAGS =
  'annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,' +
  'merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,' +
  'mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,' +
  'mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,' +
  'msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics'

const VOID_TAGS =
  'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'

// https://html.spec.whatwg.org/multipage/parsing.html#formatting
const FORMATTING_TAGS = 'a,b,big,code,em,font,i,nobr,s,small,strike,strong,tt,u'

// Elements that always require explicit closing tags due to HTML parsing rules.
// These include:
// - Formatting elements (a, b, i, etc.) - handled by FORMATTING_TAGS
// - Elements with special parsing rules
// - Scope boundary elements
const ALWAYS_CLOSE_TAGS =
  'title,style,script,noscript,template,' + // raw text / special parsing
  'object,table,button,textarea,select,iframe,fieldset' // scope boundary / form elements

// Inline elements
const INLINE_TAGS =
  'a,abbr,acronym,b,bdi,bdo,big,br,button,canvas,cite,code,data,datalist,' +
  'del,dfn,em,embed,i,iframe,img,input,ins,kbd,label,map,mark,meter,' +
  'noscript,object,output,picture,progress,q,ruby,s,samp,script,select,' +
  'small,span,strong,sub,sup,svg,textarea,time,u,tt,var,video'

// Block elements
const BLOCK_TAGS =
  'address,article,aside,blockquote,dd,details,dialog,div,dl,dt,fieldset,' +
  'figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,hr,li,' +
  'main,menu,nav,ol,p,pre,section,table,ul'

/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isHTMLTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(HTML_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isSVGTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(SVG_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isMathMLTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(MATH_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isVoidTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(VOID_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isFormattingTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(FORMATTING_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isAlwaysCloseTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(ALWAYS_CLOSE_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isInlineTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(INLINE_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isBlockTag: (key: string) => boolean =
  /*@__PURE__*/ makeMap(BLOCK_TAGS)
