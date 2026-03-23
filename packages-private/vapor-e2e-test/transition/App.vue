<script setup vapor lang="ts">
import type { Component } from 'vue'

type CaseModule = { default: Component }
const caseModules = import.meta.glob<CaseModule>('./cases/**/*.vue', {
  eager: true,
})

const params = new URLSearchParams(window.location.search)
const caseId = params.get('case')
if (!caseId) {
  throw new Error(
    '[transition] Missing "case" query param. Example: /transition/?case=transition-with-v-if/basic-transition',
  )
}

const moduleKey = `./cases/${caseId}.vue`
const selectedCase = caseModules[moduleKey]
if (!selectedCase) {
  const availableCases = Object.keys(caseModules)
    .map(path => path.slice('./cases/'.length, -'.vue'.length))
    .sort()
    .join(', ')
  throw new Error(
    `[transition] Unknown case "${caseId}". Available cases: ${availableCases}`,
  )
}

const currentCase = selectedCase.default
</script>

<template>
  <div class="transition-container">
    <component :is="currentCase" />
  </div>
</template>

<style>
.transition-container > div {
  padding: 15px;
  border: 1px solid #f7f7f7;
  margin-top: 15px;
}
</style>
