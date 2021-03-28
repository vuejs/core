<template>
  <div class="tab-buttons">
    <button v-for="m of modes" :class="{ active: mode === m }" @click="mode = m">{{ m }}</button>
  </div>

  <div class="output-container">
    <Preview v-if="mode === 'preview'" :code="store.compiled.executed" />
    <CodeMirror
      v-else
      readonly
      :mode="mode === 'css' ? 'css' : 'javascript'"
      :value="store.compiled[mode]"
    />
  </div>
</template>

<script setup lang="ts">
import Preview from './Preview.vue'
import CodeMirror from '../codemirror/CodeMirror.vue'
import { store } from '../store'
import { ref } from 'vue'

type Modes = 'preview' | 'executed' | 'js' | 'css' | 'template'

const modes: Modes[] = ['preview', 'js', 'css', 'template', 'executed']
const mode = ref<Modes>('preview')
</script>

<style scoped>
.output-container {
  height: calc(100% - 35px);
  overflow: hidden;
  position: relative;
}
.tab-buttons {
  box-sizing: border-box;
  border-bottom: 1px solid #ddd;
}
.tab-buttons button {
  margin: 0;
  font-size: 13px;
  font-family: 'Source Code Pro', monospace;
  border: none;
  outline: none;
  background-color: #f8f8f8;
  padding: 8px 16px 6px;
  text-transform: uppercase;
  cursor: pointer;
  color: #999;
  box-sizing: border-box;
}

button.active {
  color: #42b983;
  border-bottom: 3px solid #42b983;
}
</style>
