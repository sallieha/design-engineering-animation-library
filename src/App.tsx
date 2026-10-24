import { Route, Routes } from 'react-router-dom'
import SiteMenu from './components/SiteMenu'
import CodeToggle from './components/CodeToggle'
import HoverStates from './pages/HoverStates'
import ClickPressStates from './pages/ClickPressStates'
import TransitionStates from './pages/TransitionStates'
import CardExpandPage from './pages/CardExpandPage'
import CardCyclePage from './pages/CardCyclePage'
import LayoutReflowStates from './pages/LayoutReflowStates'

function App() {
  return (
    <>
      <SiteMenu />
      <CodeToggle />
      <Routes>
        <Route path="/" element={<HoverStates />} />
        <Route path="/click-press-states" element={<ClickPressStates />} />
        <Route path="/transition-states" element={<TransitionStates />} />
        <Route path="/layout-reflow-states" element={<LayoutReflowStates />} />
        <Route path="/card-expand" element={<CardExpandPage />} />
        <Route path="/card-cycle" element={<CardCyclePage />} />
      </Routes>
    </>
  )
}

export default App
