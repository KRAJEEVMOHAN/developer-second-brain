import Parser from 'tree-sitter';
import * as path from 'path';

// @ts-ignore
import TypeScript from 'tree-sitter-typescript';
// @ts-ignore
import JavaScript from 'tree-sitter-javascript';

export interface SymbolInfo {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'variable';
  startLine: number;
  endLine: number;
  length: number;
  parameterCount?: number;
}

export class StructureService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Extract classes, functions, and interfaces from a TypeScript/JavaScript file using Tree-sitter.
   */
  extractSymbols(filename: string, content: string): SymbolInfo[] {
    const ext = path.extname(filename).toLowerCase();
    let language: any;

    if (ext === '.tsx') {
      language = TypeScript.tsx;
    } else if (ext === '.ts') {
      language = TypeScript.typescript;
    } else if (ext === '.js' || ext === '.jsx') {
      language = JavaScript;
    } else {
      // Default or skip unsupported files
      return [];
    }

    try {
      this.parser.setLanguage(language);
    } catch (err) {
      console.error(`Failed to set language for extension ${ext}:`, err);
      return [];
    }

    const tree = this.parser.parse(content);
    const symbols: SymbolInfo[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      let symbol: SymbolInfo | null = null;

      if (node.type === 'class_declaration') {
        const nameNode = node.childForFieldName('name') || node.child(1);
        const name = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : 'AnonymousClass';
        symbol = {
          name,
          kind: 'class',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          length: node.endPosition.row - node.startPosition.row + 1
        };
      } else if (node.type === 'function_declaration') {
        const nameNode = node.childForFieldName('name') || node.child(1);
        const name = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : 'AnonymousFunction';
        
        // Count parameters
        const paramsNode = node.childForFieldName('parameters') || node.namedChildren.find(c => c.type === 'formal_parameters');
        let parameterCount = 0;
        if (paramsNode) {
          parameterCount = paramsNode.namedChildren.filter(c => 
            ['required_parameter', 'optional_parameter', 'rest_parameter', 'identifier'].includes(c.type)
          ).length;
        }

        symbol = {
          name,
          kind: 'function',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          length: node.endPosition.row - node.startPosition.row + 1,
          parameterCount
        };
      } else if (node.type === 'interface_declaration') {
        const nameNode = node.childForFieldName('name') || node.child(1);
        const name = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : 'AnonymousInterface';
        symbol = {
          name,
          kind: 'interface',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          length: node.endPosition.row - node.startPosition.row + 1
        };
      } else if (node.type === 'method_definition') {
        const nameNode = node.childForFieldName('name') || node.child(0);
        const name = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : 'AnonymousMethod';
        
        const paramsNode = node.childForFieldName('parameters') || node.namedChildren.find(c => c.type === 'formal_parameters');
        let parameterCount = 0;
        if (paramsNode) {
          parameterCount = paramsNode.namedChildren.filter(c => 
            ['required_parameter', 'optional_parameter', 'rest_parameter', 'identifier'].includes(c.type)
          ).length;
        }

        symbol = {
          name,
          kind: 'function',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          length: node.endPosition.row - node.startPosition.row + 1,
          parameterCount
        };
      } else if (node.type === 'variable_declarator') {
        const valueNode = node.childForFieldName('value');
        if (valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression')) {
          const nameNode = node.childForFieldName('name') || node.child(0);
          const name = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : 'AnonymousFunction';
          
          // Count parameters
          const paramsNode = valueNode.childForFieldName('parameters') || valueNode.namedChildren.find(c => c.type === 'formal_parameters');
          let parameterCount = 0;
          if (paramsNode) {
            parameterCount = paramsNode.namedChildren.filter(c => 
              ['required_parameter', 'optional_parameter', 'rest_parameter', 'identifier'].includes(c.type)
            ).length;
          } else {
            const paramNode = valueNode.childForFieldName('parameter');
            if (paramNode) {
              parameterCount = 1;
            }
          }

          symbol = {
            name,
            kind: 'function',
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            length: node.endPosition.row - node.startPosition.row + 1,
            parameterCount
          };
        }
      }

      if (symbol) {
        symbols.push(symbol);
      }

      for (let i = 0; i < node.childCount; i++) {
        const childNode = node.child(i);
        if (childNode) {
          visit(childNode);
        }
      }
    };

    visit(tree.rootNode);
    return symbols;
  }
}
