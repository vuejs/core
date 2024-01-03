import type { DirectiveTransform } from '../transform'

export const noopDirectiveTransform: DirectiveTransform = () => ({ props: [] })
