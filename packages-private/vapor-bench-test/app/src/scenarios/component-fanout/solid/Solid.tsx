import { For, createSignal, onMount } from 'solid-js'
import {
  COMPONENT_FANOUT_CONFIG,
  COMPONENT_FANOUT_COUNT,
  createFanoutGroups,
  createFanoutItems,
  getNextActiveId,
  getNextMode,
} from '../data.mjs'
import { installComponentFanoutBenchmark } from '../ready'
import FanoutCard from './FanoutCard'

export default function ComponentFanout() {
  const items = createFanoutItems()
  const groups = createFanoutGroups(items)
  const [activeId, setActiveId] = createSignal(0)
  const [revision, setRevision] = createSignal(0)
  const [mode, setMode] = createSignal('steady')

  onMount(() => {
    installComponentFanoutBenchmark('solid', operation => {
      if (operation === 'retarget-active-child') {
        setActiveId(value => getNextActiveId(value))
      } else if (operation === 'update-shared-revision') {
        setRevision(value => value + 1)
      } else if (operation === 'cycle-display-mode') {
        setMode(value => getNextMode(value))
      }
    })
  })

  return (
    <main
      class="fanout-shell"
      data-scenario="component-fanout"
      data-target="solid"
    >
      <header class="fanout-header">
        <div>
          <p>Component fanout</p>
          <h1>Component fanout</h1>
        </div>
        <div class="fanout-summary" aria-label="Fanout summary">
          <span>{COMPONENT_FANOUT_CONFIG.groupCount} groups</span>
          <span>{COMPONENT_FANOUT_COUNT} children</span>
          <span>revision {revision()}</span>
        </div>
      </header>

      <span hidden data-bench-state>
        {activeId()}:{revision()}:{mode()}
      </span>

      <section class="fanout-groups" aria-label="Component fanout groups">
        <For each={groups}>
          {group => (
            <div class="fanout-group">
              <h2>{group.label}</h2>
              <div class="fanout-list">
                <For each={group.items}>
                  {item => (
                    <FanoutCard
                      item={item}
                      activeId={activeId()}
                      revision={revision()}
                      mode={mode()}
                    />
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </section>
    </main>
  )
}
