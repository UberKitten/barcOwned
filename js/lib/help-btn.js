/* global jQuery */

jQuery(($) => {
  const helpButtons = $('.btn-help')

  helpButtons.on('click', (event) => {
    event.preventDefault()

    const helpButton = $(event.target)
    helpButton.parents().each((idx, buttonParent) => {
      const helpTextId = $(buttonParent).attr('aria-describedby')

      if (helpTextId) {
        const helpText = $(`#${helpTextId}`)

        helpText.toggleClass('active')
        return false
      }
    })
  })
})
