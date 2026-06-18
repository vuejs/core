import {
  type SSRBuffer,
  type SSRBufferItem,
  createBuffer,
  unrollBuffer,
} from 'vue/server-renderer'
import { expectType } from './utils'

const { getBuffer, push } = createBuffer()

push('hello')
push(Promise.resolve([' world']))

const buffer = getBuffer()
expectType<SSRBuffer>(buffer)
expectType<SSRBufferItem>(buffer)
expectType<string | Promise<string>>(unrollBuffer(buffer))
