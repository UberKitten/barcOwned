/* eslint no-unused-vars: "barcOwned" */

class BarcOwned {
  constructor () {
    this.models = []
    this.defaultBWIPPoptions = {
      includetext: true
    }
  }

  getModelByName(modelName) {
    return this.models.filter((model) => {
      return model.name === modelName
    })[0]
  }

  getBarcodeData(script, model) {
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

  getSetupBarcodeData(script, model) {
    // Ensure that if we have setup options, model has setup capability
    if (!model.setup !== !script.setup.options) {
      throw new Error(`Setup script is not compatible with model ${model.name}`)
    }

    const barcodes = []

    if (script.setup.options) {
      // Append enterconfig barcodes to return array
      model.setup.enterconfig.forEach((code) => {
        barcodes.push(model.setup.prefix.concat(code).concat(model.setup.postfix))
      })

      // Append special option barcodes to return array
      script.setup.options.forEach((option) => {
        const optionCodes = model.setup.options[option]

        if (!optionCodes) {
          throw new Error(`Unrecognized option ${option}`)
        }

        optionCodes.forEach((code) => {
          barcodes.push(model.setup.prefix.concat(code).concat(model.setup.postfix))
        })
      })

      // Append exitconfig barcodes to return array
      model.setup.exitconfig.forEach((code) => {
        barcodes.push(model.setup.prefix.concat(code).concat(model.setup.postfix))
      })
    }

    // Ensure that if we have ADF options, model has ADF capability
    if (!model.adf !== !script.setup.adf) {
      throw new Error(`Setup script is not compatible with model ${model.name}`)
    }

    if (script.setup.adf) {
      // Append rule barcodes to return array
      script.setup.adf.forEach((rule) => {
        model.adf.enterconfig.forEach((code) => {
          barcodes.push(model.adf.prefix.concat(code).concat(model.adf.postfix))
        })

        rule.criteria.forEach((criteria) => {
          const criteriaName = criteria[0]
          const criteriaParams = criteria.slice(1)

          const modelCriteriaDef = model.adf.criteria[criteriaName]

          if (!modelCriteriaDef) {
            throw new Error(`Unrecognized criteria name ${criteriaName}`)
          }

          const codes = runModelFunction(criteriaParams, modelCriteriaDef, model.adf)
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

          const codes = runModelFunction(actionParams, modelActionDef, model.adf)
          codes.forEach((code) => {
            barcodes.push(model.adf.prefix.concat(code).concat(model.adf.postfix))
          })
        })

        model.adf.exitconfig.forEach((code) => {
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

  getPayloadBarcodeData(script, model) {
    return {
      barcodes: script.payload,
      symbology: model.setup.symbology,
      BWIPPoptions: model.bwippoptions
    }
  }
}

const barcOwned = new BarcOwned()


// implements the function + metadata structure in model'
// types: charmap, multiple, single
function runModelFunction (params, modelfunc, adf) {
  const prefix = modelfunc.prefix || ''
  const postfix = modelfunc.postfix || ''

  const barcodes = []

  if (modelfunc.enterconfig) {
    barcodes.push(modelfunc.enterconfig)
  }

  if (modelfunc.constructor === String || modelfunc.type === 'static') {
    // It's just a string, send that
    barcodes.push(prefix.concat(modelfunc).concat(postfix))
  } else if (modelfunc.type === 'single') {
    // The function does everything and returns values
    const codes = modelfunc.process(params[0], adf)

    if (Array.isArray(codes)) {
      codes.forEach((code) => {
        barcodes.push(prefix.concat(code).concat(postfix))
      })
    } else {
      barcodes.push(prefix.concat(codes).concat(postfix))
    }
  } else if (modelfunc.type === 'charmap') {
    params.forEach((param) => {
      const code = runModelFunction([param], adf.mapcharacter, adf)
      barcodes.push(prefix.concat(code).concat(postfix))
    })
  } else if (modelfunc.type === 'multiple') {
    // we have to run for each character
    params.forEach((param) => {
      const code = modelfunc.process(param, adf)
      barcodes.push(prefix.concat(code).concat(postfix))
    })
  } else {
    throw new Error(`Unrecognized model function type ${modelfunc.type}`)
  }

  if (modelfunc.sendendmessage) {
    // in most scenarios I think there should be no prefix/postfix here,
    // as endmessage is not specific to a single criteria/action
    barcodes.push(adf.endmessage)
  }

  if (modelfunc.exitconfig) {
    barcodes.push(modelfunc.exitconfig)
  }

  return barcodes
}
