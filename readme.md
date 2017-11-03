# barcOwned

**"Like a Rubber Ducky, but with barcodes"**

The humble barcode scanner is used in virtually every industry that deals with physical products. While it may look simple, these devices actually have a surprising amount of features and complexity hidden inside. Using esoteric programming barcodes, one can instruct a scanner to type special keys and gain keyboard-like access to a machine. This allows one to execute attacks like running commands in a shell, manipulating system objects, or even editing/creating files on disk.

This tool, barcOwned (pronounced "barc-owned" or "bar-coned") provides a simple web tool to program a barcode scanner with certain rules, or "setup scripts", that can be used to deliver a payload. The tool is easy to customize with a minimal amount of Javascript knowledge and pull requests are welcome. Different manufacturers and models of barcode scanners use different programming barcodes, but after the baseline work of adding a new model is complete, existing scripts can be ported easily.

## Documentation

Docs are available at [barcowned.com/docs](https://barcowned.com/docs).

The markdown source for the docs can be viewed offline in the [`_docs_src`](_docs_src) directory.

### Contributing + Building

barcOwned will not work when served from a local file system because it retrieves the setup scripts and payload files using AJAX. Instead, we recommend using a simple, local HTTP server for development and field execution. On Windows, we recommend [HTTP File Server](http://www.rejetto.com/hfs/).

For instructions on building barcOwned and submitting patches, see [the docs](https://barcowned.com/docs/contributing/readme.html)

## Michael's Fantastic Limited-Time Scanner Support Offer

**Wish your favorite barcode scanner was supported? Afraid to delve into complicated Javascript muck?**

You're in luck. If you are willing to send me ([@t3hub3rk1tten](https://github.com/T3hUb3rK1tten)) the scanner, I will add support for it as long as I can find the manual. No guarantees on time, but it probably won't take more than a month or two.

If a month or two is too long, I'm available for faster, freelance work.

Contact me at [michael@mwe.st](mailto:michael@mwe.st) if you're interested.

## License

Open source under the [MIT License](license.md).

The project also includes the following other open source software:

|                           Project                        |    License   |
|                               -                          |       -      |
|      [BWIPJS](https://github.com/metafloor/bwip-js)      |      MIT     |
|         [jQuery](https://github.com/jquery/jquery)       |      MIT     |
|       [Bootstrap](https://github.com/twbs/bootstrap)     |      MIT     |
|   [logger.js](https://github.com/jonnyreeves/js-logger)  |      MIT     |
|      [GitBook](https://github.com/GitbookIO/gitbook)     |  Apache 2.0  |
