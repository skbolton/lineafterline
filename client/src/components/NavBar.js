import React from 'react'
import NavButton from './NavButton'

const NavBar = (props) => {
  return (
    <div className="navbarWrap">
      <div className="headerLogo">
        <a href="/"><h1>Line After Line</h1></a>
      </div>
      <div className="headerLogButton">
        <NavButton
          currentUser={props.currentUser}
        />
      </div>
    </div>
  )
}

export default NavBar
