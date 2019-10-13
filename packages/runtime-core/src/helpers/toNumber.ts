export function toNumber(val: any): number {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}
