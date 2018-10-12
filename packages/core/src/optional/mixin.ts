import { ComponentInstance } from '../component'
import { ComponentOptions } from '../componentOptions'

export interface Mixin extends ComponentOptions {}

export function applyMixins(Component: ComponentInstance, mixins: Mixin[]) {}
