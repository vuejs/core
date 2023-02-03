import {
  expectType,
  createBlock,
  VNode,
  Teleport,
  Text,
  Static,
  Comment,
  Fragment,
  Suspense,
  defineComponent
} from './index'

expectType<VNode>(createBlock(Teleport))
expectType<VNode>(createBlock(Text))
expectType<VNode>(createBlock(Static))
expectType<VNode>(createBlock(Comment))
expectType<VNode>(createBlock(Fragment))
expectType<VNode>(createBlock(Suspense))
expectType<VNode>(createBlock(defineComponent({})))
