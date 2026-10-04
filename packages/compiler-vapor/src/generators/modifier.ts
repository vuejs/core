import { isSimpleIdentifier } from '@vue/compiler-dom'

export function genDirectiveModifiers(modifiers: string[]): string {
  return modifiers
    .map(
      value =>
        `${isSimpleIdentifier(value) ? value : JSON.stringify(value)}: true`,
    )
    .join(', ')
}
