import React from 'react'
import { BrowserRouter as Router, Route, Redirect, Link } from 'react-router-dom'
import Editor from '../Editor'

const Placeholder = ({ match }) => (<div>{match.url} is under construction</div>)

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
          <Link to='/run'>Run</Link>
        </li>

        <li>
          <a href='/docs/index.html'>Docs</a>
        </li>
      </ul>

      <Route exact path='/app' render={() => (
        <Redirect to='/editor' />
      )} />
      <Route exact path='/editor' component={Editor} />
      <Route exact path='/run' component={Placeholder} />
    </div>
  </Router>
)

export default App
