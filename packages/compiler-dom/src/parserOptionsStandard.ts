import { ParserOptions } from '@vue/compiler-core'
import { parserOptionsMinimal } from './parserOptionsMinimal'
import namedCharacterReferences from './namedChars.json'

export const parserOptionsStandard: ParserOptions = {
  // extends the minimal options with more spec-compliant overrides
  ...parserOptionsMinimal,

  // https://html.spec.whatwg.org/multipage/named-characters.html#named-character-references
  namedCharacterReferences,
  maxCRNameLength: /*#__PURE__*/ Object.keys(namedCharacterReferences).reduce(
    (max, name) => Math.max(max, name.length),
    0
  )
}
