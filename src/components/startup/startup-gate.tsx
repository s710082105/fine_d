import { Alert, Button, Spin } from 'antd'
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState, type ReactNode } from 'react'
import type { RuntimePrerequisiteReport } from '../../lib/types/environment'

export interface EnvironmentServices {
  checkRuntimePrerequisites: () => Promise<RuntimePrerequisiteReport>
}

interface StartupGateProps {
  children: ReactNode
  services?: EnvironmentServices
}

type StartupState =
  | { phase: 'checking' }
  | { phase: 'ready' }
  | { phase: 'blocked'; report: RuntimePrerequisiteReport }
  | { phase: 'error'; message: string }

export const tauriEnvironmentServices: EnvironmentServices = {
  checkRuntimePrerequisites: () =>
    invoke<RuntimePrerequisiteReport>('check_runtime_prerequisites')
}

function StartupBlockedView({ report }: { report: RuntimePrerequisiteReport }) {
  return (
    <section className="startup-gate startup-gate--blocked">
      <div className="startup-gate__card">
        <h1>基础环境未安装完成</h1>
        <p>请先手动执行当前平台的安装脚本，安装完成后再返回软件重新检查。</p>
        <div className="startup-gate__list">
          {report.items.map((item) => (
            <Alert
              key={item.key}
              type={item.status === 'ready' ? 'success' : 'error'}
              showIcon
              message={item.label}
              description={
                <div className="startup-gate__detail">
                  <div>{item.message}</div>
                  {item.detectedVersion ? <div>{item.detectedVersion}</div> : null}
                  {item.fixHint ? <div>{item.fixHint}</div> : null}
                  {item.scriptPath ? <div>{item.scriptPath}</div> : null}
                </div>
              }
            />
          ))}
        </div>
        <p>脚本启动后可选择官方源或国内源，软件不会在应用内直接执行安装。</p>
        <Button onClick={() => window.location.reload()}>重新检查</Button>
      </div>
    </section>
  )
}

export function StartupGate({
  children,
  services = tauriEnvironmentServices
}: StartupGateProps) {
  const [state, setState] = useState<StartupState>({ phase: 'checking' })

  useEffect(() => {
    let active = true
    void services
      .checkRuntimePrerequisites()
      .then((report) => {
        if (!active) return
        setState(report.ready ? { phase: 'ready' } : { phase: 'blocked', report })
      })
      .catch((error) => {
        if (!active) return
        setState({
          phase: 'error',
          message: error instanceof Error ? error.message : String(error)
        })
      })
    return () => {
      active = false
    }
  }, [services])

  if (state.phase === 'checking') {
    return (
      <section className="startup-gate startup-gate--loading">
        <div className="startup-gate__card startup-gate__card--compact">
          <Spin size="large" />
          <p>正在检查运行环境...</p>
        </div>
      </section>
    )
  }

  if (state.phase === 'error') {
    return (
      <section className="startup-gate startup-gate--blocked">
        <div className="startup-gate__card">
          <h1>启动检查失败</h1>
          <p>{state.message}</p>
        </div>
      </section>
    )
  }

  if (state.phase === 'blocked') {
    return <StartupBlockedView report={state.report} />
  }

  return <>{children}</>
}
