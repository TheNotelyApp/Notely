/**
 * TreeSitterCodeParser
 * Multi-language AST parser powered by web-tree-sitter and WebAssembly grammars.
 * 100% self-contained in Node.js / Electron.
 */

const path = require('path');
let Parser = null;
try {
  Parser = require('web-tree-sitter');
} catch {
  Parser = null;
}

const EXT_TO_WASM = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.cs': 'c_sharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.vue': 'vue',
  '.lua': 'lua',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.scala': 'scala',
  '.sh': 'bash',
  '.bash': 'bash'
};

class TreeSitterCodeParser {
  constructor() {
    this._initialized = false;
    this._initPromise = null;
    this._languages = new Map();
    this._parser = null;
  }

  async initialize() {
    if (this._initialized) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      if (!Parser) return false;
      try {
        await Parser.init();
        this._parser = new Parser();
        this._initialized = true;
        return true;
      } catch (err) {
        console.warn('[TreeSitterCodeParser] Initialization failed:', err.message);
        return false;
      }
    })();

    return this._initPromise;
  }

  async getLanguage(ext) {
    const wasmName = EXT_TO_WASM[ext.toLowerCase()];
    if (!wasmName) return null;

    if (this._languages.has(wasmName)) {
      return this._languages.get(wasmName);
    }

    try {
      const wasmPath = require.resolve(`tree-sitter-wasms/out/tree-sitter-${wasmName}.wasm`);
      const lang = await Parser.Language.load(wasmPath);
      this._languages.set(wasmName, lang);
      return lang;
    } catch (err) {
      console.warn(`[TreeSitterCodeParser] Failed loading grammar for ${wasmName}:`, err.message);
      return null;
    }
  }

  /**
   * Parse code content into structured AST entities & relationships.
   */
  async parse(filePath, content, repoPrefix = 'code', relPath = '') {
    const ext = path.extname(filePath).toLowerCase();
    const ok = await this.initialize();
    if (!ok) return null;

    const lang = await this.getLanguage(ext);
    if (!lang) return null;

    try {
      this._parser.setLanguage(lang);
      const tree = this._parser.parse(content);
      const moduleName = `${repoPrefix}/${relPath || path.basename(filePath)}`;

      const entities = [];
      const relationships = [];
      const calls = new Set();
      const declaredFunctions = new Set();

      this._walk(tree.rootNode, {
        ext,
        filePath,
        relPath,
        repoPrefix,
        moduleName,
        entities,
        relationships,
        calls,
        declaredFunctions,
        currentClass: null,
        currentFunction: null
      });

      // Match calls to declared functions within file
      for (const callName of calls) {
        if (declaredFunctions.has(callName)) {
          relationships.push({
            source_name: moduleName,
            source_type: 'CodeModule',
            target_name: `${callName}()`,
            target_type: 'CodeFunction',
            type: 'CALLS',
            weight: 0.7,
            confidence: 0.85
          });
        }
      }

      return { entities, relationships };
    } catch (err) {
      console.warn(`[TreeSitterCodeParser] AST parsing error on ${filePath}:`, err.message);
      return null;
    }
  }

  _walk(node, ctx) {
    if (!node) return;
    const type = node.type;
    const startLine = node.startPosition.row + 1;

    // 1. JavaScript / TypeScript AST
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ctx.ext)) {
      if (type === 'class_declaration' || type === 'class') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const className = nameNode.text;
          const heritage = node.children.find(c => c.type === 'class_heritage');
          const extendsName = heritage ? heritage.text.replace(/^extends\s+/, '').trim() : null;

          ctx.entities.push({
            name: className,
            canonical_name: `${ctx.repoPrefix}::${className}`,
            type: 'CodeClass',
            properties: {
              filePath: ctx.relPath,
              absolutePath: ctx.filePath,
              line: startLine,
              extends: extendsName,
              kind: 'class'
            }
          });

          ctx.relationships.push({
            source_name: ctx.moduleName,
            source_type: 'CodeModule',
            target_name: className,
            target_type: 'CodeClass',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });

          if (extendsName) {
            ctx.relationships.push({
              source_name: className,
              source_type: 'CodeClass',
              target_name: extendsName,
              target_type: 'CodeClass',
              type: 'EXTENDS',
              weight: 0.9,
              confidence: 0.95
            });
          }

          const prevClass = ctx.currentClass;
          ctx.currentClass = className;
          for (let i = 0; i < node.namedChildCount; i++) {
            this._walk(node.namedChild(i), ctx);
          }
          ctx.currentClass = prevClass;
          return;
        }
      }

      if (type === 'interface_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const ifaceName = nameNode.text;
          ctx.entities.push({
            name: ifaceName,
            canonical_name: `${ctx.repoPrefix}::${ifaceName}`,
            type: 'CodeInterface',
            properties: {
              filePath: ctx.relPath,
              absolutePath: ctx.filePath,
              line: startLine,
              kind: 'interface'
            }
          });
          ctx.relationships.push({
            source_name: ctx.moduleName,
            source_type: 'CodeModule',
            target_name: ifaceName,
            target_type: 'CodeInterface',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });
        }
      }

      if (type === 'function_declaration' || type === 'method_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const funcName = nameNode.text;
          ctx.declaredFunctions.add(funcName);
          ctx.entities.push({
            name: `${funcName}()`,
            canonical_name: `${ctx.repoPrefix}::${ctx.relPath}::${funcName}`,
            type: 'CodeFunction',
            properties: {
              filePath: ctx.relPath,
              absolutePath: ctx.filePath,
              line: startLine,
              symbol: funcName,
              memberOf: ctx.currentClass || null,
              kind: type === 'method_definition' ? 'method' : 'function'
            }
          });

          const parentSource = ctx.currentClass || ctx.moduleName;
          const parentType = ctx.currentClass ? 'CodeClass' : 'CodeModule';
          ctx.relationships.push({
            source_name: parentSource,
            source_type: parentType,
            target_name: `${funcName}()`,
            target_type: 'CodeFunction',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });

          const prevFunc = ctx.currentFunction;
          ctx.currentFunction = funcName;
          for (let i = 0; i < node.namedChildCount; i++) {
            this._walk(node.namedChild(i), ctx);
          }
          ctx.currentFunction = prevFunc;
          return;
        }
      }

      if (type === 'lexical_declaration' || type === 'variable_declaration') {
        for (const decl of node.namedChildren) {
          if (decl.type === 'variable_declarator') {
            const idNode = decl.childForFieldName('name');
            const initNode = decl.childForFieldName('value');
            if (idNode && initNode) {
              if (initNode.type === 'arrow_function' || initNode.type === 'function') {
                const funcName = idNode.text;
                ctx.declaredFunctions.add(funcName);
                ctx.entities.push({
                  name: `${funcName}()`,
                  canonical_name: `${ctx.repoPrefix}::${ctx.relPath}::${funcName}`,
                  type: 'CodeFunction',
                  properties: {
                    filePath: ctx.relPath,
                    absolutePath: ctx.filePath,
                    line: decl.startPosition.row + 1,
                    symbol: funcName,
                    kind: 'arrow_function'
                  }
                });
                ctx.relationships.push({
                  source_name: ctx.moduleName,
                  source_type: 'CodeModule',
                  target_name: `${funcName}()`,
                  target_type: 'CodeFunction',
                  type: 'CONTAINS',
                  weight: 1.0,
                  confidence: 1.0
                });
              }
            }
          }
        }
      }

      if (type === 'call_expression') {
        const fnNode = node.childForFieldName('function');
        if (fnNode) {
          const fnText = fnNode.text;
          // Check route handlers: app.get('/...', ...), router.post('/...', ...)
          if (fnText.includes('.')) {
            const parts = fnText.split('.');
            const method = parts[parts.length - 1].toLowerCase();
            if (['get', 'post', 'put', 'delete', 'patch', 'use'].includes(method)) {
              const argsNode = node.childForFieldName('arguments');
              if (argsNode && argsNode.namedChildCount > 0) {
                const firstArg = argsNode.namedChild(0);
                if (firstArg && (firstArg.type === 'string' || firstArg.type === 'template_string')) {
                  const routePath = firstArg.text.replace(/['"`]/g, '');
                  const epName = `${method.toUpperCase()} ${routePath}`;
                  ctx.entities.push({
                    name: epName,
                    canonical_name: epName,
                    type: 'APIEndpoint',
                    properties: {
                      method: method.toUpperCase(),
                      route: routePath,
                      filePath: ctx.relPath,
                      line: startLine
                    }
                  });
                  ctx.relationships.push({
                    source_name: ctx.moduleName,
                    source_type: 'CodeModule',
                    target_name: epName,
                    target_type: 'APIEndpoint',
                    type: 'DEFINES_ROUTE',
                    weight: 1.0,
                    confidence: 0.95
                  });
                }
              }
            }
          } else {
            ctx.calls.add(fnText);
          }
        }
      }

      if (type === 'import_statement') {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          const importRaw = sourceNode.text.replace(/['"]/g, '').trim();
          if (importRaw.startsWith('.')) {
            const dir = path.dirname(ctx.relPath || '').replace(/\\/g, '/');
            let resolvedRel = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, importRaw));
            if (!path.extname(resolvedRel)) {
              resolvedRel = `${resolvedRel}${ctx.ext}`;
            }
            const targetName = `${ctx.repoPrefix}/${resolvedRel}`;

            ctx.relationships.push({
              source_name: ctx.moduleName,
              source_type: 'CodeModule',
              target_name: targetName,
              target_type: 'CodeModule',
              type: 'IMPORTS',
              weight: 0.8,
              confidence: 0.95
            });
          }
        }
      }
    }

    // 2. Python AST
    else if (ctx.ext === '.py') {
      if (type === 'class_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const className = nameNode.text;
          const superclasses = node.childForFieldName('superclasses');
          const baseName = superclasses ? superclasses.text.replace(/[()]/g, '').trim() : null;

          ctx.entities.push({
            name: className,
            canonical_name: `${ctx.repoPrefix}::${className}`,
            type: 'CodeClass',
            properties: {
              filePath: ctx.relPath,
              absolutePath: ctx.filePath,
              line: startLine,
              baseClass: baseName,
              kind: 'class'
            }
          });

          ctx.relationships.push({
            source_name: ctx.moduleName,
            source_type: 'CodeModule',
            target_name: className,
            target_type: 'CodeClass',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });

          if (baseName) {
            ctx.relationships.push({
              source_name: className,
              source_type: 'CodeClass',
              target_name: baseName,
              target_type: 'CodeClass',
              type: 'EXTENDS',
              weight: 0.9,
              confidence: 0.95
            });
          }

          const prevClass = ctx.currentClass;
          ctx.currentClass = className;
          for (let i = 0; i < node.namedChildCount; i++) {
            this._walk(node.namedChild(i), ctx);
          }
          ctx.currentClass = prevClass;
          return;
        }
      }

      if (type === 'function_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const funcName = nameNode.text;
          ctx.declaredFunctions.add(funcName);
          ctx.entities.push({
            name: `${funcName}()`,
            canonical_name: `${ctx.repoPrefix}::${ctx.relPath}::${funcName}`,
            type: 'CodeFunction',
            properties: {
              filePath: ctx.relPath,
              absolutePath: ctx.filePath,
              line: startLine,
              symbol: funcName,
              memberOf: ctx.currentClass || null
            }
          });

          const parentSource = ctx.currentClass || ctx.moduleName;
          const parentType = ctx.currentClass ? 'CodeClass' : 'CodeModule';
          ctx.relationships.push({
            source_name: parentSource,
            source_type: parentType,
            target_name: `${funcName}()`,
            target_type: 'CodeFunction',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });

          const prevFunc = ctx.currentFunction;
          ctx.currentFunction = funcName;
          for (let i = 0; i < node.namedChildCount; i++) {
            this._walk(node.namedChild(i), ctx);
          }
          ctx.currentFunction = prevFunc;
          return;
        }
      }

      if (type === 'import_from_statement' || type === 'import_statement') {
        const modNode = node.childForFieldName('module_name') || node.childForFieldName('name');
        if (modNode) {
          const importRaw = modNode.text.trim();
          if (importRaw.startsWith('.')) {
            const dir = path.dirname(ctx.relPath || '').replace(/\\/g, '/');
            let resolvedRel = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, importRaw.replace(/\./g, '/')));
            if (!path.extname(resolvedRel)) {
              resolvedRel = `${resolvedRel}.py`;
            }
            const targetName = `${ctx.repoPrefix}/${resolvedRel}`;

            ctx.relationships.push({
              source_name: ctx.moduleName,
              source_type: 'CodeModule',
              target_name: targetName,
              target_type: 'CodeModule',
              type: 'IMPORTS',
              weight: 0.8,
              confidence: 0.95
            });
          }
        }
      }
    }

    // 3. Go AST
    else if (ctx.ext === '.go') {
      if (type === 'function_declaration' || type === 'method_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const funcName = nameNode.text;
          ctx.entities.push({
            name: `${funcName}()`,
            canonical_name: `${ctx.repoPrefix}::${ctx.relPath}::${funcName}`,
            type: 'CodeFunction',
            properties: { filePath: ctx.relPath, line: startLine, symbol: funcName }
          });
          ctx.relationships.push({
            source_name: ctx.moduleName,
            source_type: 'CodeModule',
            target_name: `${funcName}()`,
            target_type: 'CodeFunction',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });
        }
      } else if (type === 'type_declaration') {
        for (const spec of node.namedChildren) {
          if (spec.type === 'type_spec') {
            const nameNode = spec.childForFieldName('name');
            if (nameNode) {
              const typeName = nameNode.text;
              ctx.entities.push({
                name: typeName,
                canonical_name: `${ctx.repoPrefix}::${typeName}`,
                type: 'CodeClass',
                properties: { filePath: ctx.relPath, line: startLine }
              });
              ctx.relationships.push({
                source_name: ctx.moduleName,
                source_type: 'CodeModule',
                target_name: typeName,
                target_type: 'CodeClass',
                type: 'CONTAINS',
                weight: 1.0,
                confidence: 1.0
              });
            }
          }
        }
      }
    }

    // 4. Rust AST
    else if (ctx.ext === '.rs') {
      if (type === 'function_item') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const funcName = nameNode.text;
          ctx.entities.push({
            name: `${funcName}()`,
            canonical_name: `${ctx.repoPrefix}::${ctx.relPath}::${funcName}`,
            type: 'CodeFunction',
            properties: { filePath: ctx.relPath, line: startLine, symbol: funcName }
          });
          ctx.relationships.push({
            source_name: ctx.moduleName,
            source_type: 'CodeModule',
            target_name: `${funcName}()`,
            target_type: 'CodeFunction',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });
        }
      } else if (type === 'struct_item' || type === 'enum_item' || type === 'trait_item') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const typeName = nameNode.text;
          ctx.entities.push({
            name: typeName,
            canonical_name: `${ctx.repoPrefix}::${typeName}`,
            type: type === 'trait_item' ? 'CodeInterface' : 'CodeClass',
            properties: { filePath: ctx.relPath, line: startLine }
          });
          ctx.relationships.push({
            source_name: ctx.moduleName,
            source_type: 'CodeModule',
            target_name: typeName,
            target_type: type === 'trait_item' ? 'CodeInterface' : 'CodeClass',
            type: 'CONTAINS',
            weight: 1.0,
            confidence: 1.0
          });
        }
      }
    }

    // Walk children
    for (let i = 0; i < node.namedChildCount; i++) {
      this._walk(node.namedChild(i), ctx);
    }
  }
}

const parserInstance = new TreeSitterCodeParser();
module.exports = parserInstance;
