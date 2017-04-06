'use strict';

const ConcatSource = require('webpack-sources').ConcatSource;

function RequireJsExportPlugin() {
}

RequireJsExportPlugin.prototype.apply = function(compiler) {
    compiler.plugin('compilation', function (compilation, data) {
        compilation.plugin('succeed-module', function(module) {
            // This ensures we don't export the import stubs for requirejs.
            // TODO: Determine loader better.
            if (module.request && String(module.request).indexOf('requirejs-loader') !== -1) {
                return;
            }

            // TODO: Find a way around using _source.
            if (module.rawRequest && module._source) {
                // We use the raw request to define the same name, including loader.
                var name = module.rawRequest;
                // TODO: Maybe just strip everything but 'text!'?
                if (name.indexOf('script-loader!') === 0) {
                    name = name.substr('script-loader!'.length);
                }

                var definition = 'window.define(' + JSON.stringify(name) + ', [], function() { return module.exports; });';
                module._source = new ConcatSource(module._source, '\n', definition);
            }
        });
    });
};


module.exports = RequireJsExportPlugin;
