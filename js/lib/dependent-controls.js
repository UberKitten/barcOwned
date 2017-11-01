/* global jQuery */

jQuery(($) => {
  const dependentControls = $('.controls [data-dependency]')

  dependentControls.each((idx, dependentControl) => {
    const depControl = $(dependentControl)
    const dependency = depControl.data('dependency')
    const targetControl = $(dependency.substring(0, dependency.indexOf('=')))
    const targetValue = dependency.substring(dependency.indexOf('=') + 1)

    targetControl.on('change click', (event) => {
      const target = $(event.target)
      updateDependentControl(depControl, target, targetValue)
    })

    updateDependentControl(depControl, targetControl, targetValue)
  })

  function updateDependentControl (depControl, target, targetValue) {
    if (target.val() === targetValue || target.data('value') === targetValue ||
      target.parent().val() === targetValue || target.parent().data('value') === targetValue) {
      depControl.show()
    } else {
      depControl.hide()
    }
  }
})
