<script setup>
import { shallowRef, triggerRef } from 'vue'
import { buildData } from './data'
import { defer, wrap } from './profiling'

const selected = shallowRef()
const rows = shallowRef([])

// Bench Add: https://jsbench.me/45lzxprzmu/1
const add = wrap('add', () => {
  rows.value.push(...buildData(1000))
  triggerRef(rows)
})

const remove = wrap('remove', id => {
  rows.value.splice(
    rows.value.findIndex(d => d.id === id),
    1,
  )
  triggerRef(rows)
})

const select = wrap('select', id => {
  selected.value = id
})

const run = wrap('run', () => {
  rows.value = buildData()
  selected.value = undefined
})

const update = wrap('update', () => {
  const _rows = rows.value
  for (let i = 0, len = _rows.length; i < len; i += 10) {
    _rows[i].label.value += ' !!!'
  }
})

const runLots = wrap('runLots', () => {
  rows.value = buildData(10000)
  selected.value = undefined
})

const clear = wrap('clear', () => {
  rows.value = []
  selected.value = undefined
})

const swapRows = wrap('swap', () => {
  const _rows = rows.value
  if (_rows.length > 998) {
    const d1 = _rows[1]
    const d998 = _rows[998]
    _rows[1] = d998
    _rows[998] = d1
    triggerRef(rows)
  }
})

async function bench() {
  for (let i = 0; i < 30; i++) {
    rows.value = []
    await runLots()
    await defer()
  }
}

const globalThis = window
</script>

<template>
  <h1>Vue.js (VDOM) Benchmark</h1>

  <div style="display: flex; gap: 4px; margin-bottom: 4px">
    <label>
      <input
        type="checkbox"
        :value="globalThis.doProfile"
        @change="globalThis.doProfile = $event.target.checked"
      />
      Profiling
    </label>
    <label>
      <input
        type="checkbox"
        :value="globalThis.reactivity"
        @change="globalThis.reactivity = $event.target.checked"
      />
      Reactivity Cost
    </label>
  </div>

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
  <table class="table table-hover table-striped test-data">
    <tbody>
      <tr
        v-for="row of rows"
        :key="row.id"
        :class="selected === row.id ? 'danger' : ''"
      >
        <td class="col-md-1">{{ row.id }}</td>
        <td class="col-md-4">
          <a @click="select(row.id)">{{ row.label.value }}</a>
        </td>
        <td class="col-md-1">
          <a @click="remove(row.id)">
            <span class="glyphicon glyphicon-remove" aria-hidden="true">x</span>
          </a>
        </td>
        <td class="col-md-6"></td>
      </tr>
    </tbody>
  </table>
  <span
    class="preloadicon glyphicon glyphicon-remove"
    aria-hidden="true"
  ></span>
</template>

<style>
.danger {
  background-color: red;
}
</style>
