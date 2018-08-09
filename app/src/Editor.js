/* global localStorage, FileReader, alert */

import React, { Component } from 'react'
import AceEditor from 'react-ace'
import 'brace/mode/json'
import 'brace/theme/monokai'
import './Editor.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowAltCircleDown, faPlayCircle } from '@fortawesome/free-regular-svg-icons'
import { faUpload } from '@fortawesome/free-solid-svg-icons'

class Editor extends Component {
  constructor (props) {
    super(props)

    this.state = {
      selectedFile: '',
      fileData: {}
    }

    this.fileInput = React.createRef()

    this.onEditorChange = this.onEditorChange.bind(this)
    this.onFileSelected = this.onFileSelected.bind(this)
    this.onFileUploaded = this.onFileUploaded.bind(this)
    this.importFile = this.importFile.bind(this)
  }

  componentDidMount () {
    let selectedFile = localStorage.getItem('editor-file-selected')
    let fileData = localStorage.getItem('editor-file-data')

    const demoFiles = {
      'testfilename.json': '{ "comment": "Test File" }',
      'untitled-new-payload.json': '{ "comment": "New File" }'
    }

    selectedFile = selectedFile || 'untitled-new-payload.json'
    fileData = fileData ? JSON.parse(fileData) : demoFiles

    this.setState({ selectedFile, fileData })
    this.saveFileData(fileData)
    this.saveSelectedFile(selectedFile)
  }

  saveFileData (data) {
    localStorage.setItem('editor-file-data', JSON.stringify(data))
  }

  saveSelectedFile (file) {
    localStorage.setItem('editor-file-selected', file)
  }

  importFile (file) {
    if (!file.name.endsWith('.json')) {
      alert('That doesn\'t look like a JSON file to me')
      return
    }

    const fileData = Object.assign({}, this.state.fileData)
    const fileReader = new FileReader()

    return new Promise((resolve, reject) => {
      fileReader.addEventListener('loadend', () => {
        let fileNameIteration = 0
        const fileName = file.name.substring(0, file.name.length - 5)

        if (fileData[file.name]) {
          fileNameIteration++

          while (fileData[`${fileName}-${fileNameIteration}.json`]) {
            fileNameIteration++
          }
        }

        if (fileNameIteration > 0) {
          fileData[`${fileName}-${fileNameIteration}.json`] = fileReader.result
        } else {
          fileData[file.name] = fileReader.result
        }

        this.setState({ fileData })
        this.saveFileData(fileData)
        resolve()
      })

      fileReader.readAsText(file)
    })
  }

  onEditorChange (newCode) {
    const fileData = Object.assign({}, this.state.fileData)
    fileData[this.state.selectedFile] = newCode
    this.setState({ fileData })
    this.saveFileData(fileData)
  }

  onFileSelected (event, file) {
    event.preventDefault()
    this.setState({ selectedFile: file })
    this.saveSelectedFile(file)
  }

  onClickRunAction (event) {
    event.preventDefault()
  }

  onClickImportAction (event) {
    event.preventDefault()
    this.fileInput.current.click()
  }

  async onFileUploaded (files) {
    for (let i = 0; i < files.length; i++) {
      await this.importFile(files[i])
    }
  }

  render () {
    const fileContent = this.state.selectedFile !== '' ? this.state.fileData[this.state.selectedFile] : ''

    const fileItems = Object.keys(this.state.fileData).map((file) => {
      const itemClass = this.state.selectedFile === file ? 'selected' : ''

      return (
        <li key={file} className={itemClass}><a href='' onClick={(event) => this.onFileSelected(event, file)}>{file}</a></li>
      )
    })

    const exportDataUri = 'data:application/json;charset=utf-8,'.concat(encodeURIComponent(this.state.fileData[this.state.selectedFile]))

    return (
      <div className='App ace-monokai'>
        <section className='editor'>
          <aside className='file-browser sidebar'>
            <ul className='padded-list striped-list'>
              { fileItems }
            </ul>
          </aside>

          <AceEditor
            mode='json'
            showPrintMargin={false}
            theme='monokai'
            onChange={this.onEditorChange}
            name='codeEdtior'
            height='100%'
            width='75vw'
            value={fileContent}
            editorProps={{$blockScrolling: true}}
          />
        </section>

        <section className='actions-bar'>
          <aside className='sidebar'>
            <ul className='padded-list'>
              <li>
                <input className='hidden' type='file' multiple
                  ref={this.fileInput} onChange={(event) => this.onFileUploaded(event.target.files)} />
                <a href='' onClick={(event) => this.onClickImportAction(event)}><FontAwesomeIcon icon={faUpload} />Import JSON</a>
              </li>
            </ul>
          </aside>

          <div className='separator' />

          <main>
            <ul className='padded-list'>
              <li><a href='' onClick={(event) => this.onClickRunAction(event)}>
                <FontAwesomeIcon icon={faPlayCircle} />
                Run
              </a></li>
              <li><a href={exportDataUri} download={this.state.selectedFile}>
                <FontAwesomeIcon icon={faArrowAltCircleDown} />
                Download this file
              </a></li>
            </ul>
          </main>
        </section>
      </div>
    )
  }
}

export default Editor
