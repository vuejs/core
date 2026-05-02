import { For, Show, createSignal, onMount } from 'solid-js'
import {
  CONDITIONAL_BRANCH_CONFIG,
  CONDITIONAL_BRANCH_COUNT,
  CONDITIONAL_BRANCH_HOT_BRANCH,
  createBranchGroups,
  createBranches,
  getAllBranchIndices,
  getGroupBranchIndices,
} from '../data.mjs'
import { installConditionalBranchBenchmark } from '../ready'

export default function ConditionalBranch() {
  const branches = createBranches().map(branch => {
    const [expanded, setExpanded] = createSignal(branch.expanded)
    return {
      ...branch,
      expanded,
      setExpanded,
    }
  })
  const groups = createBranchGroups(branches)
  const [flips, setFlips] = createSignal(0)
  const hotIndices = new Set([
    CONDITIONAL_BRANCH_HOT_BRANCH,
    ...getGroupBranchIndices(),
  ])

  function toggleIndices(indices: number[]) {
    setFlips(value => value + 1)

    for (const index of indices) {
      branches[index].setExpanded(value => !value)
    }
  }

  onMount(() => {
    installConditionalBranchBenchmark('solid', operation => {
      if (operation === 'toggle-one-branch') {
        toggleIndices([CONDITIONAL_BRANCH_HOT_BRANCH])
      } else if (operation === 'toggle-one-group') {
        toggleIndices(getGroupBranchIndices())
      } else if (operation === 'toggle-all-branches') {
        toggleIndices(getAllBranchIndices())
      }
    })
  })

  return (
    <main
      class="branch-shell"
      data-scenario="conditional-branch"
      data-target="solid"
    >
      <header class="branch-header">
        <div>
          <p>Branch churn</p>
          <h1>Conditional branch churn</h1>
        </div>
        <div class="branch-summary" aria-label="Branch summary">
          <span>{CONDITIONAL_BRANCH_CONFIG.groupCount} groups</span>
          <span>{CONDITIONAL_BRANCH_COUNT} branches</span>
          <span>{flips()} flips</span>
        </div>
      </header>

      <span hidden data-bench-state>
        {flips()}:{String(branches[CONDITIONAL_BRANCH_HOT_BRANCH].expanded())}:
        {String(branches[0].expanded())}:{String(branches[479].expanded())}
      </span>

      <section class="branch-groups" aria-label="Conditional branch groups">
        <For each={groups}>
          {group => (
            <div class="branch-group">
              <h2>{group.label}</h2>
              <div class="branch-list">
                <For each={group.branches}>
                  {branch => (
                    <div class="branch-slot">
                      <Show
                        when={branch.expanded()}
                        fallback={
                          <section
                            classList={{
                              'branch-card': true,
                              'branch-card--compact': true,
                              hot: hotIndices.has(branch.id),
                            }}
                          >
                            <p class="branch-compact-title">{branch.title}</p>
                            <span class="branch-code">{branch.code}</span>
                            <span class="branch-load">{branch.load}</span>
                            <div class="branch-badges">
                              <span>idle</span>
                              <span>{branch.owner}</span>
                            </div>
                          </section>
                        }
                      >
                        <article
                          classList={{
                            'branch-card': true,
                            'branch-card--expanded': true,
                            hot: hotIndices.has(branch.id),
                          }}
                        >
                          <div>
                            <p class="branch-title">{branch.title}</p>
                            <span class="branch-owner">{branch.owner}</span>
                          </div>
                          <strong class="branch-score">{branch.score}</strong>
                          <div class="branch-detail">
                            <span>Delta {branch.delta}</span>
                            <span>Load {branch.load}</span>
                          </div>
                          <div class="branch-badges">
                            <span>{branch.code}</span>
                            <span>open</span>
                            <span>live</span>
                          </div>
                        </article>
                      </Show>
                    </div>
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
