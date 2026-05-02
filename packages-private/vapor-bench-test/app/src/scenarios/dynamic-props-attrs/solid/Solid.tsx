import { For, createSignal, onMount } from 'solid-js'
import {
  DYNAMIC_PROPS_ATTRS_CONFIG,
  DYNAMIC_PROPS_ATTRS_COUNT,
  createAttrGroups,
  createAttrItems,
  createDynamicPropBag,
  getNextActiveId,
  getNextVariantSeed,
} from '../data.mjs'
import { installDynamicPropsAttrsBenchmark } from '../ready'
import AttrCard from './AttrCard'

export default function DynamicPropsAttrs() {
  const items = createAttrItems()
  const groups = createAttrGroups(items)
  const [activeId, setActiveId] = createSignal(0)
  const [attrRevision, setAttrRevision] = createSignal(0)
  const [variantSeed, setVariantSeed] = createSignal(0)

  onMount(() => {
    installDynamicPropsAttrsBenchmark('solid', operation => {
      if (operation === 'retarget-active-attrs') {
        setActiveId(value => getNextActiveId(value))
      } else if (operation === 'update-fallthrough-attrs') {
        setAttrRevision(value => value + 1)
      } else if (operation === 'rotate-prop-bag') {
        setVariantSeed(value => getNextVariantSeed(value))
      }
    })
  })

  return (
    <main
      class="attrs-shell"
      data-scenario="dynamic-props-attrs"
      data-target="solid"
    >
      <header class="attrs-header">
        <div>
          <p>Dynamic props</p>
          <h1>Dynamic props / attrs fallthrough</h1>
        </div>
        <div class="attrs-summary" aria-label="Dynamic props summary">
          <span>{DYNAMIC_PROPS_ATTRS_CONFIG.groupCount} groups</span>
          <span>{DYNAMIC_PROPS_ATTRS_COUNT} cards</span>
          <span>revision {attrRevision()}</span>
        </div>
      </header>

      <span hidden data-bench-state>
        {activeId()}:{attrRevision()}:{variantSeed()}
      </span>

      <section class="attrs-groups" aria-label="Dynamic props groups">
        <For each={groups}>
          {group => (
            <div class="attrs-group">
              <h2>{group.label}</h2>
              <div class="attrs-list">
                <For each={group.items}>
                  {item => (
                    <AttrCard
                      item={item}
                      revision={attrRevision()}
                      {...createDynamicPropBag(item, {
                        activeId: activeId(),
                        attrRevision: attrRevision(),
                        variantSeed: variantSeed(),
                      })}
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
