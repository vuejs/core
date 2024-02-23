// These tag configs are shared between compiler-dom and runtime-dom, so they
// must be extracted in shared to avoid creating a dependency between the two.
import { makeMap } from './makeMap'

// https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const HTML_TAGS =
  'a,abbr,acronym,address,area,article,aside,audio,b,base,bdi,bdo,big,' +
  'blockquote,body,br,button,canvas,caption,center,cite,code,col,colgroup,' +
  'data,datalist,dd,del,details,dfn,dialog,dir,div,dl,dt,em,embed,fieldset,' +
  'figcaption,figure,font,footer,form,frame,frameset,h1,head,header,hgroup,' +
  'hr,html,i,iframe,image,img,input,ins,kbd,label,legend,li,link,main,map,' +
  'mark,marquee,menu,menuitem,meta,meter,nav,nobr,noembed,noframes,noscript,' +
  'object,ol,optgroup,option,output,p,param,picture,plaintext,portal,pre,' +
  'progress,q,rb,rp,rt,rtc,ruby,s,samp,script,search,section,select,slot,' +
  'small,source,span,strike,strong,style,sub,summary,sup,table,tbody,td,' +
  'template,textarea,tfoot,th,thead,time,title,tr,track,tt,u,ul,var,video,' +
  'wbr,xmp'

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

/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isHTMLTag = /*#__PURE__*/ makeMap(HTML_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isSVGTag = /*#__PURE__*/ makeMap(SVG_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isMathMLTag = /*#__PURE__*/ makeMap(MATH_TAGS)
/**
 * Compiler only.
 * Do NOT use in runtime code paths unless behind `__DEV__` flag.
 */
export const isVoidTag = /*#__PURE__*/ makeMap(VOID_TAGS)
