import * as ts from 'typescript';

export interface SymbolInfo {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'variable';
  startLine: number;
  endLine: number;
  length: number;
  parameterCount?: number;
}

export class StructureService {
  /**
   * Extract classes and functions from a TypeScript/JavaScript file.
   */
  extractSymbols(filename: string, content: string): SymbolInfo[] {
    const sourceFile = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
    const symbols: SymbolInfo[] = [];

    const visit = (node: ts.Node) => {
      let symbol: SymbolInfo | null = null;

      if (ts.isClassDeclaration(node) && node.name) {
        symbol = this.createSymbol(node, node.name.text, 'class', sourceFile);
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        symbol = this.createSymbol(node, node.name.text, 'function', sourceFile);
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        symbol = this.createSymbol(node, node.name.text, 'interface', sourceFile);
      } else if (ts.isVariableStatement(node)) {
        // Handle arrow functions assigned to const
        node.declarationList.declarations.forEach(decl => {
          if (ts.isIdentifier(decl.name) && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            symbol = this.createSymbol(decl.initializer, decl.name.text, 'function', sourceFile);
          }
        });
      }

      if (symbol) {
        symbols.push(symbol);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return symbols;
  }

  private createSymbol(node: ts.Node, name: string, kind: SymbolInfo['kind'], sourceFile: ts.SourceFile): SymbolInfo {
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    
    let parameterCount: number | undefined;
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      parameterCount = node.parameters.length;
    }
    
    return {
      name,
      kind,
      startLine: startLine + 1, // 1-indexed
      endLine: endLine + 1,
      length: (endLine - startLine) + 1,
      parameterCount
    };
  }
}
