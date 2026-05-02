import { For, createSignal, onMount } from 'solid-js'
import { createCells, getRowIndices, getThousandCellIndices } from '../data.mjs'
import { installLocalizedLeafBenchmark } from '../ready'

export default function LocalizedLeaf() {
  const cells = createCells().map(cell => {
    const [value, setValue] = createSignal(cell.value)
    return {
      ...cell,
      value,
      setValue,
    }
  })
  const [updated, setUpdated] = createSignal(0)
  const hotIndices = new Set([
    5050,
    ...getRowIndices(),
    ...getThousandCellIndices(),
  ])

  function updateIndices(indices: number[]) {
    setUpdated(value => value + 1)
    for (const index of indices) {
      cells[index].setValue(value => value + 1)
    }
  }

  onMount(() => {
    installLocalizedLeafBenchmark('solid', operation => {
      if (operation === 'update-one-cell') {
        updateIndices([5050])
      } else if (operation === 'update-row') {
        updateIndices(getRowIndices())
      } else if (operation === 'update-1000-cells') {
        updateIndices(getThousandCellIndices())
      }
    })
  })

  return (
    <main class="leaf-shell" data-scenario="localized-leaf" data-target="solid">
      <header class="leaf-header">
        <div>
          <p>Localized updates</p>
          <h1>Localized leaf updates</h1>
        </div>
        <div class="leaf-summary" aria-label="Grid summary">
          <span>100 x 100</span>
          <span>{updated()} updates</span>
          <span>10,000 cells</span>
        </div>
      </header>

      <span hidden data-bench-state>
        {updated()}:{cells[5050].value()}:{cells[5000].value()}:
        {cells[0].value()}
      </span>

      <section class="leaf-grid" aria-label="Cells">
        <For each={cells}>
          {cell => (
            <span
              classList={{
                'leaf-cell': true,
                hot: hotIndices.has(cell.id),
              }}
            >
              {cell.value()}
            </span>
          )}
        </For>
      </section>
    </main>
  )
}
