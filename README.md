# requirejs-export-plugin

Exports all imported modules to browser requirejs via `window.define`.

This is specifically useful for Magento 2, which extensively uses requirejs.

## Usage

    const RequireJsExportPlugin = require('@sdinteractive/requirejs-export-plugin');

    module.exports = {
      plugins: [
        new RequireJsExportPlugin(),
      ],
    };
