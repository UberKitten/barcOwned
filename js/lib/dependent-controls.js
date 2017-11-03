/* global jQuery */

jQuery(($) => {
  const dependentControls = $('.controls [data-dependency]')

  dependentControls.each((idx, dependentControl) => {
    const depControl = $(dependentControl)
    const dependencies = depControl.data('dependency').split(';')

    addEventListeners(depControl, dependencies)
    updateDependentControlState(depControl, dependencies)
  })

  function addEventListeners (depControl, dependencies) {
    dependencies.forEach((dependency) => {
      const targetControl = $(dependency.substring(0, dependency.indexOf('=')))

      targetControl.on('change click', (event) => {
        updateDependentControlState(depControl, dependencies)
      })
    })
  }

  function updateDependentControlState (depControl, dependencies) {
    let shouldDisplayControl = true

    dependencies.forEach((dependency) => {
      const targetControl = $(dependency.substring(0, dependency.indexOf('=')))
      const targetValues = dependency.substring(dependency.indexOf('=') + 1).split(',')
      let depSatified = false

      targetValues.forEach((rawTargetValue) => {
        const targetValue = rawTargetValue.trim()

        if (targetControl.val() === targetValue || targetControl.data('value') === targetValue ||
        targetControl.parent().val() === targetValue || targetControl.parent().data('value') === targetValue) {
          depSatified = true
        }
      })

      if (!depSatified) {
        shouldDisplayControl = false
      }
    })

    if (shouldDisplayControl) {
      depControl.show()
    } else {
      depControl.hide()
    }
  }
})
