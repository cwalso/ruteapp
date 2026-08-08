import './App.css'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>RuteApp</h1>
        <p>Planlegg turen fra start til mål.</p>
      </header>

      <main className="app-main">
        <section className="map-placeholder" aria-labelledby="map-title">
          <div className="placeholder-content">
            <span className="placeholder-label">Kartområde</span>
            <h2 id="map-title">Kartet kommer her</h2>
            <p>Her vil du senere kunne velge start og mål.</p>
          </div>
        </section>

        <aside className="route-panel" aria-labelledby="route-panel-title">
          <span className="panel-label">Ruteplanlegging</span>
          <h2 id="route-panel-title">Finn veien</h2>
          <p>
            Når kartet er på plass, kan du velge to punkter og planlegge
            ruten mellom dem.
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
