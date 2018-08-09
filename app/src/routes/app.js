import React from 'react'
import { BrowserRouter as Router, Route, Link } from 'react-router-dom'
import Editor from '../Editor'

const Placeholder = ({ match }) => (<div>{match.url} is under construction</div>)

const App = () => (
  <Router>
    <div className='router-root'>
      <ul className='root-nav padded-list'>
        <li>
          <Link to='/'>barcOwned</Link>
        </li>
        <li>
          <Link to='/editor'>Editor</Link>
        </li>
        <li>
          <Link to='/run'>Run</Link>
        </li>

        <li>
          <Link to='/docs'>Docs</Link>
        </li>
      </ul>

      <Route exact path='/' component={Placeholder} />
      <Route exact path='/editor' component={Editor} />
      <Route exact path='/run' component={Placeholder} />
      <Route exact path='/docs' component={Placeholder} />
    </div>
  </Router>
)

export default App
