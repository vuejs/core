// @ts-check
export default {
  existsSync: () => false,
  readFileSync: () => {
    throw new Error('fs.readFileSync is not supported in browser builds.')
  },
}
