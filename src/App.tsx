import './App.css'
import RoutePlanningFeature from './features/route-planning/RoutePlanningFeature'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>RuteApp</h1>
        <p>Planlegg turen fra start til mål.</p>
      </header>

      <RoutePlanningFeature />
    </div>
  )
}

export default App
