'use strict';

const ConcatSource = require('webpack-sources').ConcatSource;

function RequireJsExportPlugin() {
}

function gatherRequireJsImports(modules) {
    let needsImport = [];
    for (var module of modules) {
        // If the requirejs-loader was used, then we need to wrap and import this module.
        // TODO: Clean up this check.
        // Necessary to check for both jquery.js and jquery.min.js (for sites with minification)
        if (module.request && (String(module.request).indexOf('jquery.js') !== -1 || String(module.request).indexOf('jquery.min.js') !== -1)) {
            needsImport.push('mixins!' + module.rawRequest);
        } else if (module.request && String(module.request).indexOf('requirejs-loader') !== -1) {
            needsImport.push(module.rawRequest);
        }
    }

    return needsImport;
}

function shouldExport(module) {
    // This ensures we don't export the import stubs for requirejs.
    // TODO: Clean up this check.
    if (!module.request || String(module.request).indexOf('requirejs-loader') !== -1) {
        return false;
    }

    // Some internal modules have no rawRequest - don't export those either.
    if (!module.rawRequest) {
        return false;
    }

    return true;
}

function gatherRequireJsExports(modules) {
    let needsExport = [];
    for (var module of modules) {
        if (shouldExport(module)) {
            // We use the raw request to define the same name, including loader.
            var name = module.rawRequest;
            // TODO: Maybe just strip everything but 'text!'?
            if (name.indexOf('script-loader!') === 0) {
                name = name.substr('script-loader!'.length);
            }
            needsExport.push({ id: module.id, name: name });
        }
    }

    return needsExport;
}

function generateProlog(chunkId, imports, exports) {
    const jsonImports = JSON.stringify(imports);
    const jsonDefineStub = JSON.stringify('__webpack_export_' + chunkId);

    let prolog = `
        (function(){
            var __webpack_exports__ = {};`;

    if (imports.length !== 0) {
        prolog += `
            window.define(${jsonDefineStub}, ${jsonImports}, function() {`;
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
            window.define(${jsonName}, ${jsonDefineStubs}, function() { return __webpack_exports__[${jsonId}]; });`;
    }

    if (imports.length !== 0) {
        // Immediately require script
        epilog += `
            window.require(['__webpack_export_${chunkId}'], function() {});`;
    }

    epilog += `
        }());`;

    return epilog;
}

RequireJsExportPlugin.prototype.apply = function(compiler) {
    compiler.plugin('compilation', function (compilation, data) {
        compilation.plugin('after-optimize-module-ids', function(modules) {
            for (let module of modules) {
                // TODO: Find a way around using _source.
                if (shouldExport(module) && module._source) {
                    var definition = '__webpack_exports__[' + JSON.stringify(module.id) + '] = module.exports;';
                    module._source = new ConcatSource(module._source, '\n', definition);
                }
            }
        });

        compilation.plugin('chunk-asset', (chunk, filename) => {
            const needsImport = gatherRequireJsImports(chunk.modules);
            const needsExport = gatherRequireJsExports(chunk.modules);
            if (needsImport.length != 0 || needsExport.length != 0) {
                let prolog = generateProlog(chunk.id, needsImport, needsExport);
                let epilog = generateEpilog(chunk.id, needsImport, needsExport);

                compilation.assets[filename] = new ConcatSource(prolog, "\n", compilation.assets[filename], "\n", epilog);
            }

            chunk['--requirejs-export:done'] = true;
        });
    });
};

module.exports = RequireJsExportPlugin;
