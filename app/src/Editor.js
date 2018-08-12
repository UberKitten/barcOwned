/* global localStorage, FileReader, alert */

import React, { Component } from 'react'
import axios from 'axios'
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
      fileData: {},
      runMode: null
    }

    this.fileInput = React.createRef()

    this.onEditorChange = this.onEditorChange.bind(this)
    this.onFileSelected = this.onFileSelected.bind(this)
    this.onFileUploaded = this.onFileUploaded.bind(this)
    this.importFile = this.importFile.bind(this)
  }

  componentDidMount () {
    const selectedFile = localStorage.getItem('editor-file-selected')
    const localFileData = JSON.parse(localStorage.getItem('editor-file-data'))

    this.getRunMode()
      .then((response) => {
        const runMode = response.data
        this.setState({ runMode })

        this.getFiles()
          .then((remoteFileData) => {
            const fileData = runMode === 'private' ? Object.assign({}, localFileData, remoteFileData)
              : Object.assign({}, remoteFileData, localFileData)
            this.setState({ selectedFile, fileData })
            localStorage.setItem('editor-file-data', JSON.stringify(fileData))
          })
          .catch((error) => {
            console.error(error)
            alert('Fatal error: no connection to server')
          })
      })
  }

  getRunMode () {
    return axios.get('/runmode')
  }

  getFiles () {
    return new Promise((resolve, reject) => {
      axios.get('/payloads/manifest.json')
        .then((files) => {
          const fileDataRequests = []

          files.data.forEach((file) => {
            fileDataRequests.push(axios.get(`/payloads/${file}`))
          })

          return Promise.all(fileDataRequests)
        })
        .then((responses) => {
          const fileData = {}

          responses.forEach((response) => {
            const fileURL = response.request.responseURL
            fileData[fileURL.substring(fileURL.lastIndexOf('/') + 1)] = response.request.responseText
          })

          resolve(fileData)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  saveFileData (fileName, fileContent) {
    const fileData = Object.assign({}, this.state.fileData)
    fileData[fileName] = fileContent
    localStorage.setItem('editor-file-data', JSON.stringify(fileData))

    this.setState({ fileData })

    if (!this.state.runMode || this.state.runMode === 'private') {
      axios.put(`/payloads/${fileName}`, fileContent)
        .then(() => {
          // Upload succeeded
        })
        .catch((error) => {
          console.error(error)
          this.setState({ runMode: 'public' })
        })
    }
  }

  saveSelectedFile (file) {
    localStorage.setItem('editor-file-selected', file)
  }

  importFile (file) {
    if (!file.name.endsWith('.json')) {
      alert('That doesn\'t look like a JSON file to me')
      return
    }

    const fileReader = new FileReader()

    return new Promise((resolve, reject) => {
      fileReader.addEventListener('loadend', () => {
        const fileData = Object.assign({}, this.state.fileData)
        let fileNameIteration = 1
        let fileName = file.name

        if (fileData[file.name]) {
          fileName = file.name.substring(0, file.name.length - 5)

          while (fileData[`${fileName}-${fileNameIteration}.json`]) {
            fileNameIteration++
          }

          fileName = `${fileName}-${fileNameIteration}.json`
        }

        this.saveFileData(fileName, fileReader.result)
        resolve()
      })

      fileReader.readAsText(file)
    })
  }

  onEditorChange (newCode) {
    this.saveFileData(this.state.selectedFile, newCode)
  }

  onFileSelected (event, file) {
    event.preventDefault()
    this.setState({ selectedFile: file })
    this.saveSelectedFile(file)
  }

  onClickRunAction (event) {
    //
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
              <li><a href='/run/index.html' onClick={(event) => this.onClickRunAction(event)}>
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
