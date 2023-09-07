import { compile } from '../src'

export function getCompiledString(src: string): string {
  // Wrap src template in a root div so that it doesn't get injected
  // fallthrough attr. This results in less noise in generated snapshots
  // but also means this util can only be used for non-root cases.
  const { code } = compile(`<div>${src}</div>`)
  const match = code.match(
    /_push\(\`<div\${\s*_ssrRenderAttrs\(_attrs\)\s*}>([^]*)<\/div>\`\)/,
  )

  if (!match) {
    throw new Error(`Unexpected compile result:\n${code}`)
  }

  return `\`${match[1]}\``
}
