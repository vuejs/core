export function formatCurrency(value: number) {
  return `$${Math.round(value / 1000)}k`
}

export function formatDelta(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatScore(value: number) {
  return `${value.toFixed(1)} pts`
}
