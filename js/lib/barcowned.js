/* global Logger */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "barcOwned" }] */

class BarcOwned {
  constructor () {
    this.models = []
    this.defaultBWIPPoptions = {
      includetext: true
    }
  }

  getModelByName (modelName) {
    return this.models.filter((model) => {
      return model.name === modelName
    })[0]
  }

  getBarcodeData (script, model) {
    let barcodeData

    if (script.type === 'setup') {
      barcodeData = this.getSetupBarcodeData(script, model)
    } else if (script.type === 'payload') {
      barcodeData = this.getPayloadBarcodeData(script, model)
    } else {
      throw new Error(`Unrecognized script type: ${script.type}`)
    }

    /* Merge BWIPPoptions for this model with the defaults
     * Options set on the model will override the defaults */
    barcodeData.BWIPPoptions = Object.assign({},
      this.defaultBWIPPoptions,
      barcodeData.BWIPPoptions
    )

    return barcodeData
  }

  getSetupBarcodeData (script, model) {
    // Ensure that if we have setup options, model has setup capability
    if (!model.setup !== !script.setup.options) {
      throw new Error(`Setup script is not compatible with model ${model.name}`)
    }

    const barcodes = []

    if (script.setup.options) {
      // Append enterconfig barcodes to return array
      model.setup.enterconfig.forEach((code) => {
        Logger.debug([
          `Generated barcode for: model.setup.enterconfig`,
          `Code returned: ${code}`
        ])
        barcodes.push(model.setup.prefix.concat(code).concat(model.setup.postfix))
      })

      // Append special option barcodes to return array
      script.setup.options.forEach((option) => {
        const optionCodes = model.setup.options[option]

        if (!optionCodes) {
          throw new Error(`Unrecognized option ${option}`)
        }

        optionCodes.forEach((code) => {
          Logger.debug([
            `Generated barcode for: model.setup.options[${option}]`,
            `Code returned: ${code}`
          ])
          barcodes.push(model.setup.prefix.concat(code).concat(model.setup.postfix))
        })
      })

      // Append exitconfig barcodes to return array
      model.setup.exitconfig.forEach((code) => {
        Logger.debug([
          `Generated barcode for: model.setup.exitconfig`,
          `Code returned: ${code}`
        ])
        barcodes.push(model.setup.prefix.concat(code).concat(model.setup.postfix))
      })
    }

    // Backwards Compatiblity
    if (script.setup.rules && script.setup.adf) {
      console.warn(`Setup script "${script.name}" includes conflicting 'adf' and 'rules' keys
        The 'rules' key will take precedence, and the 'adf' key will be ignored`)
    } else if (script.setup.adf) {
      script.setup.rules = script.setup.adf
      delete script.setup.adf
    }

    // Ensure that if we have ADF rules, model has ADF capability
    if (!model.adf !== !script.setup.rules) {
      throw new Error(`Setup script is not compatible with model ${model.name}`)
    }

    if (script.setup.rules) {
      // Append rule barcodes to return array
      script.setup.rules.forEach((rule) => {
        model.adf.enterconfig.forEach((code) => {
          Logger.debug([
            `Generated barcode for: model.adf.enterconfig`,
            `Code returned: ${code}`
          ])
          barcodes.push(model.adf.prefix.concat(code).concat(model.adf.postfix))
        })

        rule.criteria.forEach((criteria) => {
          const criteriaName = criteria[0]
          const criteriaParams = criteria.slice(1)

          const modelCriteriaDef = model.adf.criteria[criteriaName]

          if (!modelCriteriaDef) {
            throw new Error(`Unrecognized criteria name ${criteriaName}`)
          }

          Logger.debug([
            `Generating rule criteria barcodes for: ${criteriaName}`
          ])

          const codes = this.runModelFunction(
            criteriaParams,
            {
              type: 'criteria',
              name: criteriaName,
              modelFunc: modelCriteriaDef
            },
            model.adf)
          codes.forEach((code) => {
            barcodes.push(model.adf.prefix.concat(code).concat(model.adf.postfix))
          })
        })

        rule.actions.forEach((action) => {
          const actionName = action[0]
          const actionParams = action.slice(1)

          const modelActionDef = model.adf.actions[actionName]

          if (!modelActionDef) {
            throw new Error(`Unrecognized action name ${actionName}`)
          }

          Logger.debug([
            `Generating rule action barcodes for: ${actionName}`
          ])

          const codes = this.runModelFunction(
            actionParams,
            {
              type: 'action',
              name: actionName,
              modelFunc: modelActionDef
            },
            model.adf)
          codes.forEach((code) => {
            barcodes.push(model.adf.prefix.concat(code).concat(model.adf.postfix))
          })
        })

        model.adf.exitconfig.forEach((code) => {
          Logger.debug([
            `Generated barcode for: model.adf.exitconfig`,
            `Code returned: ${code}`
          ])
          barcodes.push(model.adf.prefix.concat(code).concat(model.adf.postfix))
        })
      })
    }

    return {
      barcodes,
      symbology: model.setup.symbology,
      BWIPPoptions: model.bwippoptions
    }
  }

  getPayloadBarcodeData (script, model) {
    return {
      barcodes: script.payload,
      symbology: 'azteccode',
      BWIPPoptions: model.bwippoptions
    }
  }

  // implements the function + metadata structure in model'
  // types: charmap, multiple, single
  runModelFunction (params, modelfuncData, adf) {
    const modelfunc = modelfuncData.modelFunc
    const prefix = modelfunc.prefix || ''
    const postfix = modelfunc.postfix || ''

    const barcodes = []

    modelfunc.enterconfig && modelfunc.enterconfig.forEach((code) => {
      Logger.debug([
        `Generated barcode for: ${modelfuncData.name}.enterconfig`,
        `Code returned: ${code}`
      ])
      barcodes.push(code)
    })

    if (modelfunc.constructor === String || modelfunc.type === 'static') {
      // It's just a string, send that
      Logger.debug([
        `Generated barcode for: ${modelfuncData.name}`,
        `Code returned: ${modelfunc}`
      ])
      barcodes.push(prefix.concat(modelfunc).concat(postfix))
    } else if (modelfunc.type === 'single') {
      // The function does everything and returns values
      const codes = modelfunc.process(params[0], adf)

      if (Array.isArray(codes)) {
        codes.forEach((code) => {
          Logger.debug([
            `Generated barcode for: ${modelfuncData.name}`,
            `Code returned: ${code}`
          ])
          barcodes.push(prefix.concat(code).concat(postfix))
        })
      } else {
        Logger.debug([
          `Generated barcode for: ${modelfuncData.name}`,
          `Code returned: ${codes}`
        ])
        barcodes.push(prefix.concat(codes).concat(postfix))
      }
    } else if (modelfunc.type === 'charmap') {
      params.forEach((param) => {
        Logger.debug([
          `Generating barcodes for: ${modelfuncData.name}`
        ])
        const codes = this.runModelFunction(
          [param],
          {
            type: 'charmap',
            name: 'mapcharacter',
            modelFunc: adf.mapcharacter
          },
          adf)

        if (Array.isArray(codes)) {
          codes.forEach((code) => {
            barcodes.push(prefix.concat(code).concat(postfix))
          })
        } else {
          barcodes.push(prefix.concat(codes).concat(postfix))
        }
      })
    } else if (modelfunc.type === 'multiple') {
      // we have to run for each character
      params.forEach((param) => {
        param.split('').forEach((char) => {
          const code = modelfunc.process(char, adf)

          Logger.debug([
            `Generated barcode for: ${modelfuncData.name}`,
            `Code returned: ${code}`
          ])
          barcodes.push(prefix.concat(code).concat(postfix))
        })
      })
    } else {
      throw new Error(`Unrecognized model function type ${modelfunc.type}`)
    }

    if (modelfunc.sendendmessage) {
      Logger.debug([
        `Generated barcode for: ${modelfuncData.name}.sendendmessage`,
        `Code returned: ${adf.endmessage}`
      ])
      barcodes.push(adf.endmessage)
    }

    // Append exitconfig barcodes to return array
    modelfunc.exitconfig && modelfunc.exitconfig.forEach((code) => {
      // in most scenarios I think there should be no prefix/postfix here,
      // as endmessage is not specific to a single criteria/action
      Logger.debug([
        `Generated barcode for: ${modelfuncData.name}.exitconfig`,
        `Code returned: ${code}`
      ])
      barcodes.push(code)
    })

    return barcodes
  }
}

const barcOwned = new BarcOwned()
