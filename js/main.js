/* global jQuery, barcOwned, BWIPP, BWIPJS, Bitmap, Module */

jQuery(($) => {
  const setupScripts = []
  const payloadScripts = []

  let barcodes = []

  // UI references
  const barcodeScannerSelect = $('#barcodeScannerSelect')
  const setupScriptSelect = $('#setupScriptSelect')
  const payloadScriptSelect = $('#payloadScriptSelect')

  const internalLinkContainers = $('.internal-links')

  const setupUI = $('section.setup')
  const runUI = $('section.run')

  const runButton = $('#runButton')
  const stopButton = $('#stopButton')

  const barcodeCanvas = $('#barcodeCanvas')

  /* /////////////////////////////////////////////////// */
  //           Setup Section Initialization              //
  /* /////////////////////////////////////////////////// */

  // Populate scanner models
  barcOwned.models.forEach((model) => {
    barcodeScannerSelect.append(`<option>${model.name}</option>`)
  })

  populateSetupScripts()
  populatePayloadScripts()

  /* /////////////////////////////////////////////////// */
  //              Link and button handlers               //
  /* /////////////////////////////////////////////////// */

  internalLinkContainers.find('a').each((idx, link) => {
    const $link = $(link)
    const activeClass = 'active'

    $link.on('click', (event) => {
      event.preventDefault()

      if ($link.attr('href') === '#setup') {
        setupUI.show()
        runUI.hide()
      } else if ($link.attr('href') === '#run') {
        setupUI.hide()
        runUI.show()
      }

      internalLinkContainers.find('li').removeClass(activeClass)
      $link.parent().addClass(activeClass)
    })
  })

  runButton.on('click', run)
  stopButton.on('click', stop)

  /* /////////////////////////////////////////////////// */
  //                   Core Functions                    //
  /* /////////////////////////////////////////////////// */

  function run () {
    runButton.attr('disabled', true)
    stopButton.removeAttr('disabled')

    const model = barcOwned.getModelByName(barcodeScannerSelect.val())
    const setupScript = Object.assign({ type: 'setup' }, getSetupScriptByName(setupScriptSelect.val()))
    const payloadScript = Object.assign({ type: 'payload' }, getPayloadScriptByName(payloadScriptSelect.val()))

    importBarcodeData(barcOwned.getBarcodeData(setupScript, model))
    importBarcodeData(barcOwned.getBarcodeData(payloadScript, model))

    function importBarcodeData (barcodeData) {
      barcodeData.barcodes.forEach((barcode) => {
        barcodes.push({
          code: barcode,
          symbology: barcodeData.symbology,
          BWIPPoptions: barcodeData.BWIPPoptions
        })
      })
    }

    setTimeout(displayBarcodes, 3000)
  }

  function stop () {
    stopButton.attr('disabled', true)
    runButton.removeAttr('disabled')

    const canvas = barcodeCanvas.get(0)
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    barcodes = []
  }

  function displayBarcodes () {
    let currentBarcode = 0

    function rotateBarcode () {
      if (!barcodes || barcodes.length === 0) {
        return
      } else if (currentBarcode + 1 > barcodes.length) {
        stop()
        return
      }

      const barcodeWriter = new BWIPJS(Module, true)
      barcodeWriter.scale(2, 1)

      const barcode = barcodes[currentBarcode]
      const canvas = barcodeCanvas.get(0)
      const ctx = canvas.getContext('2d')

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      barcodeWriter.bitmap(new Bitmap())
      BWIPP()(barcodeWriter, barcode.symbology, barcode.code, barcode.BWIPPoptions)
      barcodeWriter.bitmap().show(canvas, 'N') // "normal"

      currentBarcode++

      const rotationSpeedHz = 5 // Number of times per second to rotate barcode
      setTimeout(rotateBarcode, parseInt(1000 / rotationSpeedHz))
    }

    rotateBarcode()
  }

  /* /////////////////////////////////////////////////// */
  //               Script Manifest Loaders               //
  /* /////////////////////////////////////////////////// */

  function populateSetupScripts () {
    const basePath = 'scanner-setup-scripts'
    getScriptsManifest(basePath, (manifest) => {
      manifest.forEach((script) => {
        $.get(`${basePath}/${script}`, (data) => {
          setupScripts.push(data)

          if (manifest.slice(-1)[0] === script) {
            setupScripts.forEach((script) => {
              setupScriptSelect.append(`<option>${script.name}</option>`)
            })
          }
        }).fail(() => {
          throw new Error(`Failed to load script ${script}`)
        })
      })
    })
  }

  function populatePayloadScripts () {
    const basePath = 'scanner-payloads'
    getScriptsManifest(basePath, (manifest) => {
      manifest.forEach((script) => {
        $.get(`${basePath}/${script}`, (data) => {
          payloadScripts.push(data)

          if (manifest.slice(-1)[0] === script) {
            payloadScripts.forEach((script) => {
              payloadScriptSelect.append(`<option>${script.name}</option>`)
            })
          }
        }).fail(() => {
          throw new Error(`Failed to load script ${script}`)
        })
      })
    })
  }

  function getScriptsManifest (basePath, cb) {
    function dataHandler (data) {
      cb(data)
    }

    $.ajax({
      url: `${basePath}/manifest.json`,
      dataType: 'json'
    })
      .done((data) => {
        dataHandler(data)
      })
      .fail((jqXHR, textStatus, errorThrown) => {
        console.info('Custom manifest not found, falling back to default')

        $.ajax({
          url: `${basePath}/manifest.example.json`,
          dataType: 'json'
        })
          .done((data) => { dataHandler(data) })
          .fail((jqXHR, textStatus, errorThrown) => {
            throw new Error(errorThrown)
          })
      })
  }

  function getSetupScriptByName (scriptName) {
    return setupScripts.filter((script) => {
      return script.name === scriptName
    })[0]
  }

  function getPayloadScriptByName (scriptName) {
    return payloadScripts.filter((script) => {
      return script.name === scriptName
    })[0]
  }
})
