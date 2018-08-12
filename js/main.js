/* global jQuery, BWIPP, BWIPJS, Bitmap, Module, Logger */
/* global BarcOwned, addBtnGrpValFunction */

const barcOwned = new BarcOwned()

jQuery(($) => {
  let barcodes = []

  // UI references
  const barcodeScannerSelect = $('#barcodeScannerSelect')
  const runDelaySelect = $('#runDelaySelect')
  const displayModeSelect = $('#displayModeSelect')
  const runModeSelect = $('#runModeSelect')
  const updateRateSelect = $('#updateRateSelect')
  const selectedScriptHasDupesSelect = $('#selectedScriptHasDupes')
  const quietPeriodDelaySelect = $('#quietPeriodDelaySelect')

  const internalLinkContainers = $('.internal-links')

  const configUI = $('section.setup')
  const runUI = $('section.run')
  const stopButton = $('#stopButton')

  const barcodeCanvas = $('#barcodeCanvas')

  /* /////////////////////////////////////////////////// */
  //             Button selection functions              //
  /* /////////////////////////////////////////////////// */

  const buttonGroups = [displayModeSelect, runModeSelect]
  addBtnGrpValFunction(buttonGroups)

  /* /////////////////////////////////////////////////// */
  //           Config Section Initialization             //
  /* /////////////////////////////////////////////////// */

  // Populate scanner models
  barcOwned.models.forEach((model) => {
    barcodeScannerSelect.append(`<option>${model.name}</option>`)
  })

  /* /////////////////////////////////////////////////// */
  //                   Event handlers                    //
  /* /////////////////////////////////////////////////// */

  internalLinkContainers.find('a').each((idx, link) => {
    const $link = $(link)

    $link.on('click', (event) => {
      event.preventDefault()

      const href = $link.attr('href')

      if (href === '#config') {
        configUI.show()
        runUI.hide()
        stop()
      } else if (href === '#run') {
        configUI.hide()
        runUI.show()
        run()
      }

      updateInternalLinkStates(href)
    })
  })

  function updateInternalLinkStates (href) {
    const activeClass = 'active'

    internalLinkContainers.find('li').removeClass(activeClass)

    internalLinkContainers.find(`a[href="${href}"]`).each((idx, link) => {
      $(link).parent().addClass(activeClass)
    })
  }

  function populateScriptDupesSelect () {
    const dupesExist = barcodesHaveAdjacentDuplicates(barcodes)

    selectedScriptHasDupesSelect.html('')
    selectedScriptHasDupesSelect.append(`<option selected>${dupesExist ? 1 : 0}</option>`).trigger('change')
  }

  /* /////////////////////////////////////////////////// */
  //                  Barcode Encoders                   //
  /* /////////////////////////////////////////////////// */

  // Takes a single barcode and converts it into the ^123^123 raw C40 encoding
  function encodeC40(barcode) {

    // C40 switches between 4 sets depending on the character
    // This returns the codewords for the supplied character
    function getCodewords(character) {
      ascii = character.charCodeAt(0)

      codewords = []
      function addCodeword(set, value) {
        // 0 is the default set
        if (set != 0) {
          // C40 set 0 values 0-3 are used to switch sets
          codewords.push({
            set: 0,
            value: set - 1 // switching to set 1 requires codeword for set 0 value 0
          })
        }
        codewords.push({
          set: set,
          value: value
        })
      }

      // C40 can encode the extended ASCII set >= 128
      // To do that, we have to send "upper shift / hibit" (set 2, value 30)
      // Then we encode the character value - 128 and send that
      if (ascii >= 128 && ascii <= 255)
      {
        // Upper shift / hibit
        addCodeword(2, 30)
        ascii = ascii - 128
      }

      if (ascii == 32) {
        // ASCII space = 32
        // Set 0 space = 3
        addCodeword(0, 3)
      } else if (ascii >= 48 && ascii <= 57) {
        // ASCII 0 = 48, 9 = 57
        // Set 0 0 = 4,  9 = 13
        addCodeword(0, ascii - (48 - 4))
      } else if (ascii >= 65 && ascii <= 90) {
        // ASCII A = 65, Z = 90
        // Set 0 A = 14, Z = 39
        addCodeword(0, ascii - (65 - 14))
      } else if (ascii >= 0 && ascii <= 31) {
        // ASCII NUL = 0, US = 31
        // Set 1 NUL = 0, US = 31
        addCodeword(1, ascii - (0 - 0))
      } else if (ascii >= 33 && ascii <= 47) {
        // ASCII ! = 33, / = 47
        // Set 2 ! = 0,  / = 14
        addCodeword(2, ascii - (33 - 0))
      } else if (ascii >= 58 && ascii <= 64) {
        // ASCII : = 58, @ = 64
        // Set 2 : = 15, @ = 21
        addCodeword(2, ascii - (58 - 15))
      } else if (ascii >= 91 && ascii <= 95) {
        // ASCII [ = 91, _ = 95
        // Set 2 [ = 22, _ = 26
        addCodeword(2, ascii - (91 - 22))
      } else if (ascii >= 96 && ascii <= 127) {
        // ASCII ` = 96, DEL = 127
        // Set 3 ` = 0,  DEL = 31
        addCodeword(3, ascii - (96 - 0))
      } else {
        console.error("Character " + character + " can not be encoded in C40")
      }

      return codewords
    }

    // Given an index, checks if a string at the specified index fits the format ^000 through ^255
    function isEscaped(test, startIndex) {
      // Starts with a ^
      if (test.charAt(startIndex) != "^") {
        return false
      }

      // Make sure we have at least 3 chars after the ^
      if (startIndex + 3 >= test.length) {
        return false
      }

      // First number is 0 or 1
      if (test.charAt(startIndex + 1) == "0" || test.charAt(startIndex + 1) == "1") {
        // Second and third number are 0 through 9
        if (test.charCodeAt(startIndex + 2) >= 48 && test.charCodeAt(startIndex + 2) <= 57 &&
          test.charCodeAt(startIndex + 3) >= 48 && test.charCodeAt(startIndex + 3) <= 57) {
          return true
        }
      }

      // First number is 2
      if (test.charAt(startIndex + 1) == "2") {
        // Second and third number are 0 through 5
        if (test.charCodeAt(startIndex + 2) >= 48 && test.charCodeAt(startIndex + 2) <= 53 &&
          test.charCodeAt(startIndex + 3) >= 48 && test.charCodeAt(startIndex + 3) <= 53) {
          return true
        }
      }

      return false
    }

    // We don't want to double encode already escaped values like ^123
    // This lets us pass through values like ^234 = Reader Programming
    // To do this, we first split the string up into encodable segments
    // For example: segments = ["abc", "^123", "^234", "abcdef"]
    segments = []

    currentSegment = ""
    for (i = 0; i < barcode.length; i++) {
      if (isEscaped(barcode, i)) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment)
        }
        currentSegment = ""
        segments.push(barcode.substring(i, i + 4))
        i += 3 // i++ makes 4
        continue
      }
      currentSegment += barcode.charAt(i)
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment)
    }

    // Now we can encode each segment or pass it through
    encodedBarcode = ""
    for (currentSegment = 0; currentSegment < segments.length; currentSegment++) {
      segment = segments[currentSegment]
      if (isEscaped(segment, 0)) {
        // Do we need to return to ASCII mode?
        // If it's the first segment, we're already in ASCII mode
        // If the last segment was not escaped, we are in C40 mode
        if (currentSegment > 0 && !isEscaped(segments[currentSegment - 1]), 0) {
          encodedBarcode += "^254" // return to ASCII mode
        }
        // Pass through the already encoded part
        encodedBarcode += segment
      } else {
        // We use a 2D array so we don't lose track of which char leads to which codewords
        charCodewords = []

        for (i = 0; i < segment.length; i++) {
          charCodewords.push(getCodewords(segment.charAt(i)))
        }

        // The number of characters at the end we'll unlatch and use ASCII encoding for
        // We calculate this by removing a character at a time until the number of codewords in this segment is a multiple of 3
        // This could be 0, or it could even be the whole segment
        var unlatchChars
        for (unlatchChars = 0; unlatchChars < charCodewords.length; unlatchChars++) {
          // Count the number of codewords left after removing that many unlatchChars
          codewordLength = 0
          for (i = 0; i < charCodewords.length - unlatchChars; i++) {
            codewordLength += charCodewords[i].length
          }

          // We stop when we have removed enough chars that the C40 length is a multiple of 3
          if (codewordLength % 3 == 0) {
            break
          }
        }

        // Only switch to C40 mode if we have characters in C40 to encode
        if (charCodewords.length - unlatchChars > 0) {
          encodedBarcode += "^230"
        }

        // Now we can calculate the C40 encoding by chunks of 3
        currentChunk = []
        for (i = 0; i < charCodewords.length - unlatchChars; i++) {
          for (j = 0; j < charCodewords[i].length; j++) {
            currentChunk.push(charCodewords[i][j].value)
            if (currentChunk.length >= 3) {
              code = (1600 * currentChunk[0]) + (40 * currentChunk[1]) + (currentChunk[2]) + 1
              // Split this code into two bytes
              char1 = Math.trunc(code / 256)
              char2 = code % 256
              encodedBarcode += "^" + char1.toString().padStart(3, "0") + "^" + char2.toString().padStart(3, "0")
              currentChunk = []
            }
          }
        }

        // Switch to ASCII mode if we encoded any C40 characters
        if (charCodewords.length - unlatchChars > 0) {
          encodedBarcode += "^254"
        }

        for (i = segment.length - unlatchChars; i < segment.length; i++) {
          // Currently with the raw option, everything has to be encoded with ^###
          // Raw value is ASCII + 1
          encodedBarcode += "^" + (segment.charCodeAt(i) + 1).toString().padStart(3, "0")
        }
      }
    }

    // The ^129 here specifies end of message
    // Which tells the barcode reader to ignore any remaining padding symbols
    return encodedBarcode + "^129"
  }

  /* /////////////////////////////////////////////////// */
  //                   Core Functions                    //
  /* /////////////////////////////////////////////////// */

  function populateBarcodes () {
    const model = barcOwned.getModelByName(barcodeScannerSelect.val())
    const runMode = runModeSelect.val()
    barcodes = []

    /* JAVASCRIPT CHANGES FOR THE JAVASCRIPT THRONE */

    // This should be exposed as a UI option somehow, choose 1d or 2d
    const use2DCode = true
    const files = JSON.parse(localStorage.getItem('editor-file-data'))
    const payloadText = files[localStorage.getItem('editor-file-selected')]
    const payloadData = JSON.parse(payloadText)

    importBarcodeData(barcOwned.getBarcodeData(Object.assign({}, payloadData, { type: 'setup' }), model))

    // We can only aggregate the setup, payloads need to remain distinct
    if (use2DCode) {
      barcodes = aggregate(barcodes)
      barcodes.forEach((barcode) => {
        Logger.debug(["Generated aggregate barcode:",barcode.code])
      })
    }

    // This should be in the Symbol model JS but I don't want to think about how to scope encodeC40 right now
    function aggregate(setupBarcodes) {
      // Options might need to be done before the first N6?
      aggregateBarcode = "^234" + // Reader programming
        "N6" + // Begin 2D barcode
        "S2681000" + // Config title follows?
        "barcOwned       " + // Configuration title
        "N5" // Begin programming codes

      setupBarcodes.forEach((barcode) => {
        // FNC3 isn't needed in aggregate
        aggregateBarcode += barcode.code.replace("^FNC3", "")
      })
      Logger.debug(["Raw aggregate barcode:", aggregateBarcode])
      return [{
        code: encodeC40(aggregateBarcode),
        //code: encodeC40("^234N6S2681000barcOwned       N57B12116C201B60B30B32B+6A1443526A14E5146A1433036A1106A1186A14470D4"),
        symbology: "datamatrix",
        BWIPPoptions: {
			raw : true
		}
      }]
    }

    importBarcodeData(barcOwned.getBarcodeData(Object.assign({}, payloadData, { type: 'payload' }), model))

    /* <3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3<3 */

    function importBarcodeData (barcodeData) {
      barcodeData.barcodes.forEach((barcode) => {
        barcodes.push({
          code: barcode,
          symbology: barcodeData.symbology,
          BWIPPoptions: barcodeData.BWIPPoptions
        })
      })
    }
  }

  function run () {
    const displayMode = displayModeSelect.val()
    const runDelay = displayMode === 'Auto' ? parseInt(runDelaySelect.val()) * 1000 : 0

    stop()
    stopButton.removeAttr('disabled')

    populateBarcodes()

    displayMode === 'Auto' ? barcodeCanvas.show() : barcodeCanvas.hide()
    setTimeout(() => displayBarcodes(displayMode), runDelay)
  }

  function stop () {
    stopButton.attr('disabled', true)
    clearAutoBarcodeDisplay()
    $('.barcodes-list').remove()
  }

  function clearAutoBarcodeDisplay () {
    const canvas = barcodeCanvas.get(0)
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function displayBarcodes (displayMode) {
    if (displayMode === 'Auto') {
      displayBarcodesAuto()
    } else if (displayMode === 'List') {
      displayBarcodesList()
    } else {
      throw new Error(`Unknown barcode display mode: ${displayMode}`)
    }
  }

  function displayBarcodesAuto () {
    const quietPeriodDelay = quietPeriodDelaySelect.val()
    let currentBarcodeIdx = 0

    function rotateBarcode () {
      if (!barcodes || barcodes.length === 0) {
        return
      } else if (currentBarcodeIdx >= barcodes.length) {
        stop()
        return
      }

      const barcode = barcodes[currentBarcodeIdx]
      const hasNextBarcode = currentBarcodeIdx < barcodes.length - 1
      const nextBarcode = hasNextBarcode ? barcodes[currentBarcodeIdx + 1] : null
      const rotationSpeedHz = updateRateSelect.val()
      const rotationDelay = parseInt(1000 / rotationSpeedHz)

      currentBarcodeIdx++
      drawBarcode(barcode, barcodeCanvas)

      if (hasNextBarcode && nextBarcode.code === barcode.code) {
        setTimeout(clearAutoBarcodeDisplay, rotationDelay)
        setTimeout(rotateBarcode, rotationDelay + parseInt(quietPeriodDelay * 1000))
      } else {
        setTimeout(rotateBarcode, rotationDelay)
      }
    }

    rotateBarcode()
  }

  function displayBarcodesList () {
    const displayContainer = barcodeCanvas.parent()
    displayContainer.prepend('<ol class="barcodes-list"></ol>')

    barcodes.forEach((barcode) => {
      const canvas = $('<li><canvas class="barcode"></canvas></li>')
      displayContainer.find('.barcodes-list').append(canvas)
      drawBarcode(barcode, canvas.find('canvas'))
    })
  }

  function drawBarcode (barcode, jCanvas) {
    const canvas = jCanvas.get(0)
    const ctx = canvas.getContext('2d')
    const barcodeWriter = new BWIPJS(Module, true)
    const stringBWIPPoptions = barcOwned.getBWIPPoptionStringFromObject(barcode.BWIPPoptions)

    const visViewportHeight = getVisibleViewportHeight()
    const navbarHeight = $('.navbar').outerHeight()
    const runControlsHeight = $('.run .controls').outerHeight()
    const verticalSafeMargin = 150
    const displayWidth = $('.display').width()
    const displayHeight = (visViewportHeight - navbarHeight - runControlsHeight - verticalSafeMargin)

    if (barcode.symbology === 'qrcode') {
      // QR Code
      const displaySize = Math.min(displayWidth / 42, displayHeight / 42)
      barcodeWriter.scale(displaySize, displaySize)
    } else if (barcode.symbology === 'azteccode') {
      // Aztec Code
      const displaySize = Math.min(displayWidth / 38, displayHeight / 38)
      barcodeWriter.scale(displaySize, displaySize)
    } else if (barcode.symbology === 'code128') {
      // Code 128
      barcodeWriter.scale(displayWidth / 156, 2)
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    barcodeWriter.bitmap(new Bitmap())
    BWIPP()(barcodeWriter, barcode.symbology, barcode.code, stringBWIPPoptions)
    barcodeWriter.bitmap().show(canvas, 'N') // "normal"
  }

  function barcodesHaveAdjacentDuplicates (barcodes) {
    let previousBarcode
    let dupesExist = false

    barcodes.forEach((barcode) => {
      if (previousBarcode && previousBarcode.code === barcode.code) {
        dupesExist = true
      }

      previousBarcode = barcode
    })
    return dupesExist
  }

  function getVisibleViewportHeight () {
    const $el = $('html')
    const scrollTop = $(this).scrollTop()
    const scrollBot = scrollTop + $(this).height()
    const elTop = $el.offset().top
    const elBottom = elTop + $el.outerHeight()
    const visibleTop = elTop < scrollTop ? scrollTop : elTop
    const visibleBottom = elBottom > scrollBot ? scrollBot : elBottom

    return (visibleBottom - visibleTop)
  }

  populateBarcodes()
  populateScriptDupesSelect()
})
