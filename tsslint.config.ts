import { defineConfig } from '@tsslint/config'
import type * as ts from 'typescript'

export default defineConfig({
  exclude: ['**/*.spec.ts'],
  rules: {
    'number-equality'({
      typescript: ts,
      sourceFile,
      reportWarning,
      languageService,
    }) {
      const checker = languageService.getProgram()!.getTypeChecker()
      ts.forEachChild(sourceFile, function visit(node) {
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
          ts.isNumericLiteral(node.right) &&
          node.right.text === '0'
        ) {
          const type = checker.getTypeAtLocation(node.left)
          if (type.flags & ts.TypeFlags.Number) {
            reportWarning(
              `Replace "x === 0" with "!x" for numeric variables to clarify boolean usage.`,
              node.getStart(sourceFile),
              node.getEnd(),
            ).withFix('Use exclamation instead', () => [
              {
                fileName: sourceFile.fileName,
                textChanges: [
                  {
                    newText: `!(${node.left.getText(sourceFile)})`,
                    span: {
                      start: node.getStart(sourceFile),
                      length: node.getWidth(),
                    },
                  },
                ],
              },
            ])
          }
        }
        ts.forEachChild(node, visit)
      })
    },
    'object-equality'({
      typescript: ts,
      sourceFile,
      reportWarning,
      languageService,
    }) {
      const checker = languageService.getProgram()!.getTypeChecker()
      const checkFlags = [ts.TypeFlags.Undefined, ts.TypeFlags.Null]
      ts.forEachChild(sourceFile, function visit(node) {
        if (
          ts.isPrefixUnaryExpression(node) &&
          node.operator === ts.SyntaxKind.ExclamationToken
        ) {
          const type = checker.getTypeAtLocation(node.operand)
          for (const checkFlag of checkFlags) {
            if (isObjectOrNullableUnion(type, checkFlag)) {
              const flagText =
                checkFlag === ts.TypeFlags.Undefined ? 'undefined' : 'null'
              if (
                ts.isPrefixUnaryExpression(node.parent) &&
                node.parent.operator === ts.SyntaxKind.ExclamationToken
              ) {
                reportWarning(
                  `Do not use "!!" for a variable of type "object | ${flagText}". Replace with "!== ${flagText}" for clarity.`,
                  node.parent.getStart(sourceFile),
                  node.getEnd(),
                ).withFix(`Replace with !== ${flagText}`, () => [
                  {
                    fileName: sourceFile.fileName,
                    textChanges: [
                      {
                        newText: `${node.operand.getText(sourceFile)} !== ${flagText}`,
                        span: {
                          start: node.parent.getStart(sourceFile),
                          length:
                            node.getEnd() - node.parent.getStart(sourceFile),
                        },
                      },
                    ],
                  },
                ])
              } else {
                reportWarning(
                  `Do not use "!" for a variable of type "object | ${flagText}". Replace with "=== ${flagText}" for clarity.`,
                  node.getStart(sourceFile),
                  node.getEnd(),
                ).withFix(`Replace with === ${flagText}`, () => [
                  {
                    fileName: sourceFile.fileName,
                    textChanges: [
                      {
                        newText: `${node.operand.getText(sourceFile)} === ${flagText}`,
                        span: {
                          start: node.getStart(sourceFile),
                          length: node.getWidth(),
                        },
                      },
                    ],
                  },
                ])
              }
            }
          }
        }
        ts.forEachChild(node, visit)
      })

      function isObjectOrNullableUnion(
        type: ts.Type,
        nullableFlag: ts.TypeFlags,
      ) {
        if (!(type.flags & ts.TypeFlags.Union)) return false
        const unionType = type
        let hasObject = false
        let hasNullable = false
        for (const sub of (unionType as ts.UnionType).types) {
          if (sub.flags & nullableFlag) {
            hasNullable = true
          } else if (sub.flags & ts.TypeFlags.Object) {
            hasObject = true
          } else {
            return false
          }
        }
        return hasObject && hasNullable
      }
    },
  },
})
