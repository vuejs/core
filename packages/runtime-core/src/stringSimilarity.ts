/**
 * Find the candidate in `candidates` that is closest to `target` by
 * Damerau-Levenshtein edit distance, subject to a two-gate threshold: the
 * candidate qualifies if its edit distance is at most
 * `DISTANCE_THRESHOLD` OR its similarity ratio
 * (`1 - distance / maxLen`) is at least `SIMILARITY_THRESHOLD`.
 *
 * Both gates are inclusive; the OR form keeps the threshold permissive
 * (typos that pass either gate are accepted).
 *
 * Among qualifying candidates, the one with the smallest edit distance
 * wins. Ties on distance are broken by insertion order (the first
 * candidate encountered is preferred). Returns `null` if `candidates`
 * is empty, `target` is empty, or no candidate qualifies.
 *
 * Pure utility — no Vue imports — so it can be unit-tested in isolation
 * and reused by any caller that wants a "did you mean …" closest match.
 *
 * @internal
 */
export function findClosestMatch(
  target: string,
  candidates: string[],
): string | null {
  if (!candidates.length || target.length === 0) return null

  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const candidate of candidates) {
    const distance = damerauLevenshtein(target, candidate)
    // strict < preserves insertion order on distance ties — first-seen wins
    if (distance >= bestDistance) continue

    const maxLen = Math.max(target.length, candidate.length)
    const similarity = 1 - distance / maxLen

    if (distance <= DISTANCE_THRESHOLD || similarity >= SIMILARITY_THRESHOLD) {
      bestMatch = candidate
      bestDistance = distance
    }
  }

  return bestDistance === Infinity ? null : bestMatch
}

const DISTANCE_THRESHOLD = 2
const SIMILARITY_THRESHOLD = 0.7

/**
 * Iterative Damerau-Levenshtein edit distance: the minimum number of
 * insertions, deletions, substitutions, and adjacent transpositions
 * required to turn `a` into `b`.
 *
 * Runs in O(a.length * b.length) time and space. Avoids the early-exit
 * "infinite distance" optimisation from the original paper because we
 * expect short strings and an O(n*m) table is fine here.
 */
function damerauLevenshtein(a: string, b: string): number {
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0) return bLen
  if (bLen === 0) return aLen

  // d[i][j] = distance between a[0..i) and b[0..j)
  const d: number[][] = Array.from({ length: aLen + 1 }, () =>
    new Array(bLen + 1).fill(0),
  )
  for (let i = 0; i <= aLen; i++) d[i][0] = i
  for (let j = 0; j <= bLen; j++) d[0][j] = j

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      )
      // Damerau extension: adjacent-character transposition counts as 1 edit
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }

  return d[aLen][bLen]
}
