import { ProjectConfigForm } from './components/config/project-config-form'

export default function App() {
  return (
    <div className="app-shell">
      <section className="pane pane-left">
        <h1>Project Config</h1>
        <p>Configure sync protocol and persistence settings.</p>
        <ProjectConfigForm />
      </section>
      <section className="pane pane-right">
        <h1>Codex Session</h1>
        <p>Session timeline and command stream will be rendered here.</p>
      </section>
    </div>
  )
}
