<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { buildData } from './data'
import { defer, wrap } from './profiling'

const selected = ref<number>()
const rows = shallowRef<
  {
    id: number
    label: string
  }[]
>([])

function setRows(update = rows.value.slice()) {
  rows.value = update
}

const add = wrap('add', () => {
  rows.value = rows.value.concat(buildData(1000))
})

const remove = wrap('remove', (id: number) => {
  rows.value.splice(
    rows.value.findIndex(d => d.id === id),
    1,
  )
  setRows()
})

const select = wrap('select', (id: number) => {
  selected.value = id
})

const run = wrap('run', () => {
  setRows(buildData())
  selected.value = undefined
})

const update = wrap('update', () => {
  const _rows = rows.value
  for (let i = 0; i < _rows.length; i += 10) {
    _rows[i].label += ' !!!'
  }
  setRows()
})

const runLots = wrap('runLots', () => {
  setRows(buildData(10000))
  selected.value = undefined
})

const clear = wrap('clear', () => {
  setRows([])
  selected.value = undefined
})

const swapRows = wrap('swap', () => {
  const _rows = rows.value
  if (_rows.length > 998) {
    const d1 = _rows[1]
    const d998 = _rows[998]
    _rows[1] = d998
    _rows[998] = d1
    setRows()
  }
})

async function bench() {
  for (let i = 0; i < 30; i++) {
    rows.value = []
    await defer()
    await runLots()
  }
}
</script>

<template>
  <h1>Vue.js Vapor Benchmark</h1>
  <div
    id="control"
    style="display: flex; flex-direction: column; width: fit-content; gap: 6px"
  >
    <button @click="bench">Benchmark mounting</button>
    <button id="run" @click="run">Create 1,000 rows</button>
    <button id="runlots" @click="runLots">Create 10,000 rows</button>
    <button id="add" @click="add">Append 1,000 rows</button>
    <button id="update" @click="update">Update every 10th row</button>
    <button id="clear" @click="clear">Clear</button>
    <button id="swaprows" @click="swapRows">Swap Rows</button>
  </div>
  <div id="time"></div>
  <table>
    <tbody>
      <tr
        v-for="row of rows"
        :key="row.id"
        :class="{ danger: row.id === selected }"
      >
        <td>{{ row.id }}</td>
        <td>
          <a @click="select(row.id)">{{ row.label }}</a>
        </td>
        <td>
          <button @click="remove(row.id)">x</button>
        </td>
        <td class="col-md-6"></td>
      </tr>
    </tbody>
  </table>
</template>

<style>
.danger {
  background-color: red;
}
</style>
