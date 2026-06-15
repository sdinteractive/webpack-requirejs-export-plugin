'use strict';

const { ConcatSource } = require('webpack-sources');

function isNormalModule(module) {
    return Boolean(module && typeof module.request === 'string' && module.rawRequest != null);
}

function RequireJsExportPlugin() {
}

function gatherRequireJsImports(modules) {
    let needsImport = [];
    for (let module of modules) {
        if (isNormalModule(module) && String(module.request).indexOf('requirejs-loader') !== -1) {
            needsImport.push('mixins!' + module.rawRequest);
        }
    }

    return needsImport;
}

function shouldExport(module) {
    if (!isNormalModule(module)) return false;
    if (String(module.request).indexOf('requirejs-loader') !== -1) return false;
    return true;
}

function gatherRequireJsExports(modules) {
    let needsExport = [];
    for (let module of modules) {
        if (shouldExport(module)) {
            let name = module.rawRequest;
            if (name.indexOf('script-loader!') === 0) {
                name = name.substr('script-loader!'.length);
            }
            needsExport.push({ id: module.id, name: name });
        }
    }

    return needsExport;
}

function generateProlog(chunkId, imports) {
    const jsonImports = JSON.stringify(imports);
    const jsonDefineStub = JSON.stringify('__webpack_export_' + chunkId);

    let prolog = `
        (function (){
            window.__requirejs_exports__ = window.__requirejs_exports__ || {};
            var __requirejs_exports__ = window.__requirejs_exports__;`;

    if (imports.length !== 0) {
        prolog += `
            window.define(${jsonDefineStub}, ${jsonImports}, function () {`;
    }

    return prolog;
}

function generateEpilog(chunkId, imports, exports) {
    let epilog = '';

    if (imports.length !== 0) {
        epilog += `
            });`;
    }

    const jsonDefineStubs = JSON.stringify(imports.length === 0 ? [] : ['__webpack_export_' + chunkId]);
    for (let module of exports) {
        const jsonName = JSON.stringify(module.name);
        const jsonId = JSON.stringify(module.id);
        epilog += `
            window.define(${jsonName}, ${jsonDefineStubs}, function () {
                var exp = __requirejs_exports__[${jsonId}];
                return (exp && exp.__esModule && exp.default) ? exp.default : exp;
            });`;
    }

    if (imports.length !== 0) {
        epilog += `
            window.require(['__webpack_export_${chunkId}'], function () {});`;
    }

    epilog += `
        }());`;

    return epilog;
}

RequireJsExportPlugin.prototype.apply = function (compiler) {
    const isWebpack5 = Boolean(compiler.webpack);

    if (isWebpack5) {
        compiler.options.output = compiler.options.output || {};
        compiler.options.output.iife = false;

        compiler.hooks.compilation.tap('RequireJsExportPlugin', (compilation) => {
            const Compilation = compiler.webpack.Compilation;

            compilation.hooks.processAssets.tap(
                {
                    name: 'RequireJsExportPlugin',
                    stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
                },
                () => {
                    for (const chunk of compilation.chunks) {
                        const chunkModules = Array.from(
                            compilation.chunkGraph.getChunkModulesIterable(chunk)
                        );

                        const needsImport = gatherRequireJsImports(chunkModules);
                        const needsExport = gatherRequireJsExports(chunkModules);

                        if (needsImport.length === 0 && needsExport.length === 0) continue;

                        const captureCode = needsExport
                            .map(({ id }) =>
                                ` try { __requirejs_exports__[${JSON.stringify(id)}] = __webpack_require__(${JSON.stringify(id)}); } catch(e) {}`
                            )
                            .join('\n');

                        const prolog = generateProlog(chunk.id, needsImport, needsExport);
                        const epilog = generateEpilog(chunk.id, needsImport, needsExport);

                        for (const filename of chunk.files) {
                            compilation.updateAsset(
                                filename,
                                (old) => new ConcatSource(prolog, '\n', old, '\n', captureCode, '\n', epilog)
                            );
                        }
                    }
                }
            );
        });
    } else {
        compiler.hooks.compilation.tap('RequireJsExportPlugin', (compilation) => {
            compilation.hooks.afterOptimizeModuleIds.tap('RequireJsExportPlugin', (modules) => {
                for (let module of modules) {
                    if (shouldExport(module) && module._source) {
                        const definition = '__webpack_exports__[' + JSON.stringify(module.id) + '] = module.exports;';
                        module._source = new ConcatSource(module._source, '\n', definition);
                    }
                }
            });

            compilation.hooks.chunkAsset.tap('RequireJsExportPlugin', (chunk, filename) => {
                const modules = chunk.modulesIterable ? Array.from(chunk.modulesIterable) : [];
                const needsImport = gatherRequireJsImports(modules);
                const needsExport = gatherRequireJsExports(modules);

                if (needsImport.length === 0 && needsExport.length === 0) return;

                const prolog = generateProlog(chunk.id, needsImport, needsExport);
                const epilog = generateEpilog(chunk.id, needsImport, needsExport);

                compilation.assets[filename] = new ConcatSource(prolog, "\n", compilation.assets[filename], "\n", epilog);

                chunk['--requirejs-export:done'] = true;
            });
        });
    }
};

module.exports = RequireJsExportPlugin;