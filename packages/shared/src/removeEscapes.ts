export const removeEscapes = (content: string) =>
  content.replace(/[\n\r\t\f\v\\]/g, '')
