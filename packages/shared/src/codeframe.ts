const range: number = 2

export function generateCodeFrame(
  source: string,
  start = 0,
  end = source.length
): string {
  //Split the content into individual lines but capture the newline sequence
  // that separated each line. This is important because the actual sequence is
  // needed to properly take into account the full line length for offset
  // comparison
  let lines = source.split(/(\r?\n)/)

  //Separate the lines and newline sequences into separate arrays for easier referencing
  const newlineSequences = lines.filter((_, idx) => idx % 2 === 1)
  lines = lines.filter((_, idx) => idx % 2 === 0)

  let count = 0
  const res: string[] = []
  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + newlineSequences[i].length
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) continue
        const line = j + 1
        res.push(
          `${line}${' '.repeat(Math.max(3 - String(line).length, 0))}|  ${
            lines[j]
          }`
        )
        const lineLength = lines[j].length
        if (j === i) {
          // push underline
          const pad = start - (count - lineLength) + 1
          const length = Math.max(
            1,
            end > count ? lineLength - pad : end - start
          )
          res.push(`   |  ` + ' '.repeat(pad) + '^'.repeat(length))
        } else if (j > i) {
          if (end > count) {
            const length = Math.max(Math.min(end - count, lineLength), 1)
            res.push(`   |  ` + '^'.repeat(length))
          }
          count += lineLength + newlineSequences[j].length
        }
      }
      break
    }
  }
  return res.join('\n')
}
