<script setup vapor lang="ts">
import { onMounted, ref } from 'vue'
import { computeDashboardSummary, createDashboardData } from '../data.mjs'
import { formatCurrency, formatDelta, formatScore } from '../format'
import { markDashboardReady } from '../ready'

const dashboard = createDashboardData()
const summary = computeDashboardSummary(dashboard)
const activeFilter = ref('all')

onMounted(() => markDashboardReady('vapor'))
</script>

<template>
  <main class="dashboard-shell" data-scenario="dashboard" data-target="vapor">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Revenue command center</p>
        <h1>Dashboard first screen</h1>
      </div>
      <div class="summary-strip" aria-label="Dashboard summary">
        <span>{{ formatCurrency(summary.totalRevenue) }}</span>
        <span>{{ formatScore(summary.averageScore) }}</span>
        <span>{{ summary.atRiskAccounts }} at risk</span>
        <span>{{ summary.rowCount }} accounts</span>
      </div>
    </header>

    <nav class="filter-bar" aria-label="Segments">
      <button
        v-for="filter in dashboard.filters"
        :key="filter.id"
        class="filter-button"
        :class="{ active: activeFilter === filter.id }"
        @click="activeFilter = filter.id"
      >
        {{ filter.label }}
      </button>
    </nav>

    <section class="card-grid" aria-label="Metrics">
      <article
        v-for="card in dashboard.cards"
        :key="card.id"
        class="metric-card"
        :class="card.tone"
      >
        <span>{{ card.label }}</span>
        <strong>{{ formatCurrency(card.value) }}</strong>
        <em>{{ formatDelta(card.delta) }}</em>
      </article>
    </section>

    <section class="content-grid">
      <article
        v-for="table in dashboard.tables"
        :key="table.id"
        class="table-panel"
      >
        <header>
          <h2>{{ table.title }}</h2>
          <span>{{ table.rows.length }} accounts</span>
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
            <tr
              v-for="row in table.rows"
              :key="row.id"
              :class="{ stale: row.stale }"
            >
              <td>{{ row.account }}</td>
              <td>{{ row.owner }}</td>
              <td>{{ row.stage }}</td>
              <td>{{ row.score }}</td>
              <td>{{ formatCurrency(row.revenue) }}</td>
              <td>{{ row.trend > 0 ? '+' : '' }}{{ row.trend }}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <aside class="activity-panel" aria-label="Activity">
        <h2>Signals</h2>
        <ol>
          <li v-for="item in dashboard.activity" :key="item.id">
            <strong>{{ item.title }}</strong>
            <span>{{ item.account }} · {{ item.score }}</span>
          </li>
        </ol>
      </aside>
    </section>
  </main>
</template>
