import { ReactiveEffectRunner, effect } from 'vue'
import { expectType } from './utils'

expectType<ReactiveEffectRunner<void>>(effect(() => {}))
expectType<ReactiveEffectRunner<boolean>>(effect(() => true))
expectType<ReactiveEffectRunner<{ obj: string }>>(effect(() => ({ obj: '' })))
