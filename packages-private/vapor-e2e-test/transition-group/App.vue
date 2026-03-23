<script setup vapor lang="ts">
import type { Component } from 'vue'
const props = defineProps<{
  caseId: string
}>()

type CaseModule = { default: Component }
const caseModules = import.meta.glob<CaseModule>('./cases/**/*.vue', {
  eager: true,
})

const moduleKey = `./cases/${props.caseId}.vue`
const selectedCase = caseModules[moduleKey]
if (!selectedCase) {
  const availableCases = Object.keys(caseModules)
    .map(path => path.slice('./cases/'.length, -'.vue'.length))
    .sort()
    .join(', ')
  throw new Error(
    `[transition-group] Unknown case "${props.caseId}". Available cases: ${availableCases}`,
  )
}

const currentCase = selectedCase.default
</script>

<template>
  <div class="transition-group-container">
    <component :is="currentCase" />
  </div>
</template>

<style>
.transition-group-container > div {
  padding: 15px;
  border: 1px solid #f7f7f7;
  margin-top: 15px;
}

.test-move,
.test-enter-active,
.test-leave-active {
  transition: all 50ms cubic-bezier(0.55, 0, 0.1, 1);
}

.test-enter-from,
.test-leave-to {
  opacity: 0;
  transform: scaleY(0.01) translate(30px, 0);
}

.test-leave-active {
  position: absolute;
}
</style>
