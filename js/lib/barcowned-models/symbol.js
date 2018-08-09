/* global barcOwned */

if (typeof barcOwned !== 'undefined' && barcOwned.models) {
  barcOwned.models.push({
    name: 'Motorola/Zebra Symbol',
    symbology: 'code128',
    autoRate: 1.0, // approx. rate in Hz that we can present barcodes
    setup: {
      symbology: 'code128',
      autoRate: 0.5,
      prefix: '^FNC3',
      postfix: '',
      enterconfig: [],
      exitconfig: [],
      options: {
        scanpresentation: ['2050207'], // Presentation mode scanning ("Blink")
        enableparameterscanning: ['1040601'], // Enable parameter scanning
        mobilephonedecode: [
          'N02CC03', // Mobile Phone Decode Enable
          'N02D60D' // Mobile Phone Decode High Aggressive
        ],
        eraseallrules: ['80'], // Erase all rules
        restoredefaults: ['91'], // Restore custom defaults
        setfactorydefaults: ['92'], // Sets factory defaults, deletes custom defaults
        indirectillumination: ['N023B03'] // Better for "shiny" surfaces
      }
    },
    adf: {
      prefix: '^FNC3',
      postfix: '',
      enterconfig: ['7B1211'], // begin new rule
      exitconfig: ['4'], // save rule
      endmessage: 'B+', // used after sending text
      criteria: {
        stringatposition: {
          type: 'charmap',
          sendendmessage: true,
          enterconfig: ['6C200'],
          exitconfig: [],
          prefix: 'B',
          postfix: ''
        },
        stringatstart: {
          type: 'charmap',
          sendendmessage: true,
          enterconfig: ['6C201'],
          exitconfig: [],
          prefix: 'B',
          postfix: ''
        },
        stringsearch: {
          type: 'charmap',
          sendendmessage: true,
          enterconfig: ['6C202'],
          exitconfig: [],
          prefix: 'B',
          postfix: ''
        }
      },
      actions: {
        sendtext: {
          type: 'charmap', // each char in input creates a new barcode
          prefix: '6A1441'
        },
        sendalt: {
          type: 'multiple',
          prefix: '6A1442',
          process: function (input, adf) {
            // example output: 2=40 A=41 B=42 Z=5A [=5B
            // A-Z, [] and \ are hex ASCII, 2 is special, not sure about others
            if (input === '2') {
              return '40'
            }
            return input.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
          }
        },
        sendcontrol: {
          type: 'multiple', // each char in input creates a new barcode, runs process with one char
          sendendmessage: true,
          prefix: '6A1441',
          process: function (input, adf) {
            // example output: 2=00 A=01 B=02 Z=1A [=1B
            // non-alphabet

            if (input === '2') {
              return '00'
            } else if (input === '[') {
              return '1B'
            } else if (input === '\\') {
              return '1C'
            } else if (input === ']') {
              return '1D'
            } else if (input === '6') {
              return '1E'
            } else if (input === '-') {
              return '1F'
            }

            input = input.toUpperCase().charCodeAt(0) // convert to ASCII code
            if (input >= 65 && input <= 90) { // A-Z
              const hexShiftedASCII = (input - 64).toString(16)
              return hexShiftedASCII.padStart(2, '0')
            }
          }
        },
        pauseduration: {
          type: 'single',
          enterconfig: ['30C0D20063'],
          prefix: 'A',
          process: function (input, adf) {
            // 1.0 duration would be A1, A0
            return [
              Math.floor(input),
              Math.floor((input % 1).toFixed(1) * 10)
            ]
          }
        },
        sendpausealt: {
          type: 'single',
          enterconfig: ['6A14E5'],
          process: function (input, adf) {
            return input.toString(16).toUpperCase().padStart(2, '0')
          }
        },
        sendgui: {
          type: 'charmap',
          prefix: '6A1443'
        },
        sendpause: '6A118',
        sendenter: '6A14470D',
        sendremaining: '6A110',
        skipcharacters: {
          type: 'single',
          prefix: '6A1433',
          process: function (input, adf) {
            return input.toString(16).toUpperCase().padStart(2, '0')
          }
        }
      },
      mapcharacter: {
        type: 'multiple', // each char in input creates a new barcode, runs process with one char
        process: function (input, adf) { // ADF doesn't take normal keys...
          // example output: space=20 #=23 $=24 +=2B
          // straight hex of ASCII
          return input.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
        }
      }
    },

    optimizeBarcodeData: (unoptimizedBarcodeData) => {
      // Optimization not yet implemented for this model
      return unoptimizedBarcodeData
    },

    bwippoptions: {
      parsefnc: true
    }

    // "Using ADF with longer bar codes transmits the bar code in segments of length 252 or less (depending on the host selected), and applies the rule to each segment."
    // TODO: Parameter to define split support
  })
} else {
  throw new Error('barc0wned not defined, unable to add model')
}
