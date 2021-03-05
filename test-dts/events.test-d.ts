import { ChangeEvent, expectType } from './index'

declare const inputEvent: ChangeEvent<HTMLInputElement>
expectType<string>(inputEvent.target.value)
