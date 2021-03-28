<template>
    <CodeMirror @change="onChange" :value="initialCode" />
    <Message :err="store.errors[0]" />
</template>

<script setup lang="ts">
import CodeMirror from '../codemirror/CodeMirror.vue'
import Message from '../Message.vue'
import { store } from '../store'
import { debounce } from '../utils'

const onChange = debounce((code: string) => {
  store.code = code
}, 250)

const initialCode = store.code
</script>