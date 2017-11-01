/* global jQuery */

jQuery(($) => {
  const dependentControls = $('.controls [data-dependency]')

  dependentControls.each((idx, dependentControl) => {
    const depControl = $(dependentControl)
    const dependency = depControl.data('dependency')
    const targetControl = $(dependency.substring(0, dependency.indexOf('=')))
    const targetValues = dependency.substring(dependency.indexOf('=') + 1).split(',')

    targetControl.on('change click', (event) => {
      const target = $(event.target)
      updateDependentControl(depControl, target, targetValues)
    })

    updateDependentControl(depControl, targetControl, targetValues)
  })

  function updateDependentControl (depControl, target, targetValues) {
    depControl.hide()

    targetValues.forEach((rawTargetValue) => {
      const targetValue = rawTargetValue.trim()

      if (target.val() === targetValue || target.data('value') === targetValue ||
        target.parent().val() === targetValue || target.parent().data('value') === targetValue) {
        depControl.show()
      }
    })
  }
})
