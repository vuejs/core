<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createCells, getRowIndices, getThousandCellIndices } from '../data.mjs'
import { installLocalizedLeafBenchmark } from '../ready'

const cells = createCells().map(cell => ({
  ...cell,
  value: ref(cell.value),
}))
const updated = ref(0)
const hotIndices = new Set([
  5050,
  ...getRowIndices(),
  ...getThousandCellIndices(),
])

function updateIndices(indices: number[]) {
  updated.value += 1
  for (const index of indices) {
    cells[index].value.value += 1
  }
}

onMounted(() => {
  installLocalizedLeafBenchmark('vdom', operation => {
    if (operation === 'update-one-cell') {
      updateIndices([5050])
    } else if (operation === 'update-row') {
      updateIndices(getRowIndices())
    } else if (operation === 'update-1000-cells') {
      updateIndices(getThousandCellIndices())
    }
  })
})
</script>

<template>
  <main class="leaf-shell" data-scenario="localized-leaf" data-target="vdom">
    <header class="leaf-header">
      <div>
        <p>Localized updates</p>
        <h1>Localized leaf updates</h1>
      </div>
      <div class="leaf-summary" aria-label="Grid summary">
        <span>100 x 100</span>
        <span>{{ updated }} updates</span>
        <span>10,000 cells</span>
      </div>
    </header>

    <span hidden data-bench-state>
      {{ updated }}:{{ cells[5050].value.value }}:{{
        cells[5000].value.value
      }}:{{ cells[0].value.value }}
    </span>

    <section class="leaf-grid" aria-label="Cells">
      <span
        v-for="cell in cells"
        :key="cell.id"
        class="leaf-cell"
        :class="{ hot: hotIndices.has(cell.id) }"
      >
        {{ cell.value.value }}
      </span>
    </section>
  </main>
</template>
