# requirejs-export-plugin

Exports all imported modules to browser requirejs via `window.define`.

This is specifically useful for Magento 2, which extensively uses requirejs.

Currently, a prefix of `mixins!` is added, so this is only usable with Magento 2.

## Usage

In webpack.config.js:

    const RequireJsExportPlugin = require('@sdinteractive/requirejs-export-plugin');

    module.exports = {
      plugins: [
        new RequireJsExportPlugin(),
      ],
    };

In Magento 2, this makes it so that requirejs code can load webpack modules (such as for UI components, etc.)

This also generates stubs for requirejs-loader, to allow for proper sequencing of the export.
