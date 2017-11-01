/* global jQuery */
/* eslint no-unused-vars: "addBtnGrpValFunction" */

jQuery(($) => {
  const selectableBtnGroups = $('.btn-group-selectable')

  selectableBtnGroups.find('.btn').on('click', (event) => {
    event.preventDefault()

    const clickedBtn = $(event.target)
    const selectedClass = clickedBtn.parent().data('selected-class')
    const defaultClass = clickedBtn.parent().data('default-class')

    if (selectedClass && defaultClass) {
      const buttonParent = clickedBtn.parent()

      buttonParent.data('value', clickedBtn.text())

      buttonParent.find('.btn').each((idx, button) => {
        const currentButton = $(button)
        currentButton.removeClass(selectedClass)
        currentButton.addClass(defaultClass)
      })

      clickedBtn.removeClass(defaultClass)
      clickedBtn.addClass(selectedClass)
    }
  })
})

function addBtnGrpValFunction (buttonGroups) {
  buttonGroups.forEach((buttonGroup) => {
    buttonGroup.val = (newValue) => {
      if (typeof newValue !== 'undefined') {
        buttonGroup.data('value', newValue)
      }

      return buttonGroup.data('value')
    }
  })
}
