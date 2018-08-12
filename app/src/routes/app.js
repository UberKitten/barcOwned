import React from 'react'
import { BrowserRouter as Router, Route, Redirect, Link } from 'react-router-dom'
import Editor from '../Editor'

const App = () => (
  <Router>
    <div className='router-root'>
      <ul className='root-nav padded-list'>
        <li>
          <Link to='/app'>barcOwned</Link>
        </li>
        <li>
          <Link to='/editor'>Editor</Link>
        </li>
        <li>
          <a href='/run/index.html'>Run</a>
        </li>

        <li>
          <a href='/docs/index.html'>Docs</a>
        </li>
      </ul>

      <Route exact path='/app' render={() => (
        <Redirect to='/editor' />
      )} />
      <Route exact path='/editor' component={Editor} />
    </div>
  </Router>
)

export default App
