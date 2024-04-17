import type {
  Node,
  File,
  Expression,
  StringLiteral,
  ObjectProperty,
  Program,
  ImportDeclaration,
} from '@babel/types'
import type { NodePath } from '@babel/traverse'
import t from '@babel/template'
import type { Import, LocalizedImport, ASTTools } from '../types'

/**
 * Create an object property with the given key and value.
 * @param key - The key of the property
 * @param value - The value of the property
 */
export function createProperty(
  key: string,
  value: Expression | StringLiteral
): ObjectProperty {
  return {
    type: 'ObjectProperty',
    computed: false,
    shorthand: false,
    key: {
      type: 'Identifier',
      name: key,
    },
    value,
  }
}

/**
 * Add an import to the top of the file if it is not already being used. Note
 * that this function will always ensure the imported name is unique to the
 * file, meaning you should perform this import *before* using the import name
 * in the file otherwise it will produce a new unique name.
 * @param traverse - The babel/traverse object
 * @param ast - The AST to traverse
 * @param imp - The import to add
 * @returns
 */
export function addImport(
  opts: ASTTools,
  ast: File | Program,
  imp: Import
): string {
  // Check if this import is already being used.
  const imports = getUsedImports(opts, ast, [imp])
  if (imports.length) {
    return imports[0].local
  }
  const local = uniqueVariableName(opts, ast, imp.name)
  const importStatement = t.statement
    .ast`import { ${imp.name} as ${local} } from '${imp.from}'`
  if (ast.type === 'Program') {
    ast.body.unshift(importStatement)
  } else {
    let inserted = false
    opts.traverse(ast, {
      Program(path) {
        inserted = true
        path.node.body.unshift(importStatement)
        path.stop()
      },
    })
    if (!inserted) {
      console.log(ast)
      throw new Error(
        `Could not insert import { ${imp.name} as ${local} } from '${imp.from}' — no Program node found.`
      )
    }
  }
  return local
}

/**
 * Check for the unique name of a variable within the entire scope of the
 * module. If not available, increment the name and try again.
 * @param traverse - The babel/traverse object
 * @param ast - The AST to traverse
 * @param baseName - The base name to use for the variable
 * @returns
 */
export function uniqueVariableName(
  opts: ASTTools,
  ast: Node,
  baseName: string
): string {
  let localName = baseName
  let i = 0
  let found = false
  do {
    found = false
    opts.traverse(ast, {
      Identifier(path) {
        if (path.node.name === localName) {
          found = true
          path.stop()
        }
      },
    })
    if (found) {
      i++
      localName = `${baseName}${i ? i : ''}`
    }
  } while (found)
  return localName
}

/**
 * Locates the local names for the imported functions.
 */
export function getUsedImports(
  opts: ASTTools,
  ast: Node,
  imports: Import[]
): LocalizedImport[] {
  const localizedImports: LocalizedImport[] = []
  const remappedImports = imports.reduce((map, imp) => {
    map[imp.from] ??= []
    map[imp.from].push(imp.name)
    return map
  }, {} as Record<string, string[]>)
  opts.traverse(ast, {
    ImportDeclaration(path) {
      path.node.specifiers.forEach((specifier) => {
        if (
          path.node.source.value in remappedImports &&
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          remappedImports[path.node.source.value].includes(
            specifier.imported.name
          )
        ) {
          localizedImports.push({
            name: specifier.imported.name,
            from: path.node.source.value,
            local: specifier.local.name,
          })
        }
      })
    },
  })
  return localizedImports
}

/**
 * Recursively walk up the path to find the root path.
 * @param path - The path to find the root of
 * @returns
 */
export function rootPath(path: NodePath<any>): NodePath<File> {
  if (path.parentPath) {
    return rootPath(path.parentPath)
  }
  return path
}

/**
 * Given a source file (in ast format) and given a node inside that file,
 * extract the node from the file and any of its dependencies into a new AST
 * file.
 * @param opts - Ast tools
 * @param node - The node to extract
 * @param ast - The AST to extract from
 * @returns
 */
export function extract(
  toExtract: NodePath<Node>,
  exportName = 'extracted'
): File {
  const bindings = toExtract.getBindingIdentifiers(true)
  // toExtract.traverse(
  //   Identifier(path) {

  //   }
  // )
  return {
    type: 'File',
    program: t.program.ast`${dependencies};
    export const ${exportName} = ${toExtract}`,
  }
}
// export function extract(
//   opts: ASTTools,
//   toExtract: Node,
//   context: File,
//   exportName = 'extracted'
// ): File {
//   opts.traverse(toExtract, {
//     Identifier(path) {
//       console.log(path.node.name)
//     },
//   })

//   return {
//     type: 'File',
//     program: t.program.ast`${dependencies};
//     export const ${exportName} = ${toExtract}`,
//   }
// }
