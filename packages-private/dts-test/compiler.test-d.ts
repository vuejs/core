import {
  Comment,
  Fragment,
  Static,
  Suspense,
  Teleport,
  Text,
  type VNode,
  createBlock,
  defineComponent,
} from 'vue'
import { expectType } from './utils'

expectType(createBlock(Teleport), {} as VNode)
expectType(createBlock(Text), {} as VNode)
expectType(createBlock(Static), {} as VNode)
expectType(createBlock(Comment), {} as VNode)
expectType(createBlock(Fragment), {} as VNode)
expectType(createBlock(Suspense), {} as VNode)
expectType(createBlock(defineComponent({})), {} as VNode)
