import './App.css'
import MapView from './map/MapView'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>RuteApp</h1>
        <p>Planlegg turen fra start til mål.</p>
      </header>

      <main className="app-main">
        <section className="map-region" aria-label="Kartområde">
          <MapView />
        </section>

        <aside className="route-panel" aria-labelledby="route-panel-title">
          <span className="panel-label">Ruteplanlegging</span>
          <h2 id="route-panel-title">Finn veien</h2>
          <p>
            Valg av start, mål og ruteberegning blir tilgjengelig i et senere
            steg.
          </p>

          <div className="route-points" aria-label="Valgte rutepunkter">
            <div className="route-point">
              <span className="point-marker" aria-hidden="true">
                A
              </span>
              <div>
                <span>Startpunkt</span>
                <strong>Ikke valgt</strong>
              </div>
            </div>

            <div className="route-point">
              <span className="point-marker" aria-hidden="true">
                B
              </span>
              <div>
                <span>Målpunkt</span>
                <strong>Ikke valgt</strong>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
