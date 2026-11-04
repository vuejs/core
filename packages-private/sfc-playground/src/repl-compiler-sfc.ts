// `vue/compiler-sfc` as @vue/repl imports it, with the string editor its
// module compiler expects, which compiler-sfc no longer exports
export * from 'vue/compiler-sfc'

/**
 * Edits of a source rendered by `toString()`. Text added at an index belongs
 * to the character before it (`appendLeft`) or after it (`prependRight`), and
 * is dropped with that character when it is removed or overwritten later.
 */
class ModuleRewrite {
  private intro = ''
  private outro = ''
  // text before the character at an index, and after the one before it
  private before: string[] = []
  private after: string[] = []
  private removed: boolean[] = []
  private replacements: string[] = []

  constructor(private source: string) {}

  prepend(content: string): this {
    this.intro = content + this.intro
    return this
  }

  append(content: string): this {
    this.outro += content
    return this
  }

  appendLeft(index: number, content: string): this {
    if (index === 0) this.intro += content
    else this.after[index] = (this.after[index] || '') + content
    return this
  }

  prependRight(index: number, content: string): this {
    if (index === this.source.length) this.outro = content + this.outro
    else this.before[index] = content + (this.before[index] || '')
    return this
  }

  remove(start: number, end: number): this {
    for (let i = start; i < end; i++) {
      this.removed[i] = true
      this.before[i] = this.after[i + 1] = this.replacements[i] = ''
    }
    return this
  }

  overwrite(start: number, end: number, content: string): this {
    this.remove(start, end)
    this.replacements[start] = content
    return this
  }

  toString(): string {
    let code = this.intro
    for (let i = 0; i < this.source.length; i++) {
      code +=
        (this.before[i] || '') +
        (this.removed[i] ? this.replacements[i] || '' : this.source[i]) +
        (this.after[i + 1] || '')
    }
    return code + this.outro
  }
}

export { ModuleRewrite as MagicString }
