import { Route, Routes } from 'react-router-dom'
import SiteMenu from './components/SiteMenu'
import CodeToggle from './components/CodeToggle'
import HoverStates from './pages/HoverStates'
import ClickPressStates from './pages/ClickPressStates'
import TransitionStates from './pages/TransitionStates'

function App() {
  return (
    <>
      <SiteMenu />
      <CodeToggle />
      <Routes>
        <Route path="/" element={<HoverStates />} />
        <Route path="/click-press-states" element={<ClickPressStates />} />
        <Route path="/transition-states" element={<TransitionStates />} />
      </Routes>
    </>
  )
}

export default App
