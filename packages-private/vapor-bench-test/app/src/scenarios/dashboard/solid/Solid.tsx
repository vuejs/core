import { For, createSignal, onMount } from 'solid-js'
import { computeDashboardSummary, createDashboardData } from '../data.mjs'
import { formatCurrency, formatDelta, formatScore } from '../format'
import { markDashboardReady } from '../ready'

export default function Dashboard() {
  const dashboard = createDashboardData()
  const summary = computeDashboardSummary(dashboard)
  const [activeFilter, setActiveFilter] = createSignal('all')

  onMount(() => markDashboardReady('solid'))

  return (
    <main class="dashboard-shell" data-scenario="dashboard" data-target="solid">
      <header class="dashboard-header">
        <div>
          <p class="eyebrow">Revenue command center</p>
          <h1>Dashboard first screen</h1>
        </div>
        <div class="summary-strip" aria-label="Dashboard summary">
          <span>{formatCurrency(summary.totalRevenue)}</span>
          <span>{formatScore(summary.averageScore)}</span>
          <span>{summary.atRiskAccounts} at risk</span>
          <span>{summary.rowCount} accounts</span>
        </div>
      </header>

      <nav class="filter-bar" aria-label="Segments">
        <For each={dashboard.filters}>
          {filter => (
            <button
              classList={{
                'filter-button': true,
                active: activeFilter() === filter.id,
              }}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          )}
        </For>
      </nav>

      <section class="card-grid" aria-label="Metrics">
        <For each={dashboard.cards}>
          {card => (
            <article class={`metric-card ${card.tone}`}>
              <span>{card.label}</span>
              <strong>{formatCurrency(card.value)}</strong>
              <em>{formatDelta(card.delta)}</em>
            </article>
          )}
        </For>
      </section>

      <section class="content-grid">
        <For each={dashboard.tables}>
          {table => (
            <article class="table-panel">
              <header>
                <h2>{table.title}</h2>
                <span>{table.rows.length} accounts</span>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Owner</th>
                    <th>Stage</th>
                    <th>Score</th>
                    <th>Revenue</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={table.rows}>
                    {row => (
                      <tr classList={{ stale: row.stale }}>
                        <td>{row.account}</td>
                        <td>{row.owner}</td>
                        <td>{row.stage}</td>
                        <td>{row.score}</td>
                        <td>{formatCurrency(row.revenue)}</td>
                        <td>
                          {row.trend > 0 ? '+' : ''}
                          {row.trend}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </article>
          )}
        </For>

        <aside class="activity-panel" aria-label="Activity">
          <h2>Signals</h2>
          <ol>
            <For each={dashboard.activity}>
              {item => (
                <li>
                  <strong>{item.title}</strong>
                  <span>
                    {item.account} · {item.score}
                  </span>
                </li>
              )}
            </For>
          </ol>
        </aside>
      </section>
    </main>
  )
}
