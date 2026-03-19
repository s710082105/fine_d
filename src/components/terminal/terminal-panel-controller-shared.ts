import { useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { ProjectConfig } from '../../lib/types/project-config'
import type {
  TerminalProcessMetadata,
  TerminalStatus,
  TerminalStreamEvent
} from '../../lib/types/terminal'
import type { TerminalServices } from './terminal-services'
import { getTerminalErrorMessage } from './terminal-state'
import type { TerminalAdapter, TerminalSize } from './xterm-adapter'

export const TERMINAL_IDLE_TEXT = '等待手动启动 Codex'
export const TERMINAL_INSTALL_TEXT = '请使用 npm i -g @openai/codex 安装'

type SetErrorMessage = Dispatch<SetStateAction<string | undefined>>
type SetProcess = Dispatch<SetStateAction<TerminalProcessMetadata | null>>
type SetStatus = Dispatch<SetStateAction<TerminalStatus>>

export interface TerminalRuntimeState {
  adapterRef: MutableRefObject<TerminalAdapter | null>
  codexChecked: boolean
  codexReady: boolean
  errorMessage?: string
  hostRef: MutableRefObject<HTMLDivElement | null>
  mountedRef: MutableRefObject<boolean>
  process: TerminalProcessMetadata | null
  servicesRef: MutableRefObject<TerminalServices>
  sessionIdRef: MutableRefObject<string>
  setCodexChecked: Dispatch<SetStateAction<boolean>>
  setCodexReady: Dispatch<SetStateAction<boolean>>
  setErrorMessage: SetErrorMessage
  setProcess: SetProcess
  setStatus: SetStatus
  sizeRef: MutableRefObject<TerminalSize | null>
  startPendingRef: MutableRefObject<boolean>
  startRequestIdRef: MutableRefObject<number>
  status: TerminalStatus
}

export interface TerminalRuntimeContext {
  adapterRef: MutableRefObject<TerminalAdapter | null>
  launchRef: MutableRefObject<TerminalLaunchState>
  mountedRef: MutableRefObject<boolean>
  servicesRef: MutableRefObject<TerminalServices>
  sessionIdRef: MutableRefObject<string>
  setErrorMessage: SetErrorMessage
  setProcess: SetProcess
  setStatus: SetStatus
  sizeRef: MutableRefObject<TerminalSize | null>
  startPendingRef: MutableRefObject<boolean>
  startRequestIdRef: MutableRefObject<number>
}

export interface TerminalLaunchState {
  config: ProjectConfig
  configVersion: string
  projectId: string
}

interface TerminalControllerActions {
  closeTerminal: () => void
  refreshTerminal: () => void
  restartTerminal: () => void
  startTerminal: () => void
}

export function pushTerminalError(
  setErrorMessage: SetErrorMessage,
  setStatus: SetStatus,
  error: unknown
) {
  setErrorMessage(getTerminalErrorMessage(error as TerminalStreamEvent | Error) ?? '终端操作失败')
  setStatus('error')
}

export async function shutdownActiveSession(
  servicesRef: TerminalRuntimeContext['servicesRef'],
  sessionIdRef: TerminalRuntimeContext['sessionIdRef'],
  setProcess: SetProcess,
  setStatus: SetStatus,
  setErrorMessage: SetErrorMessage,
  nextStatus: TerminalStatus
) {
  if (!sessionIdRef.current) {
    setProcess(null)
    setStatus(nextStatus)
    return true
  }

  try {
    await servicesRef.current.closeSession({ session_id: sessionIdRef.current })
    sessionIdRef.current = ''
    setProcess(null)
    setStatus(nextStatus)
    return true
  } catch (error) {
    pushTerminalError(setErrorMessage, setStatus, error)
    return false
  }
}

export function cancelPendingStart(
  startPendingRef: MutableRefObject<boolean>,
  startRequestIdRef: MutableRefObject<number>
) {
  startPendingRef.current = false
  startRequestIdRef.current += 1
}

export function useTerminalRuntimeState(services: TerminalServices): TerminalRuntimeState {
  const [codexChecked, setCodexChecked] = useState(false)
  const [codexReady, setCodexReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [process, setProcess] = useState<TerminalProcessMetadata | null>(null)
  const [status, setStatus] = useState<TerminalStatus>('idle')
  const adapterRef = useRef<TerminalAdapter | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const servicesRef = useRef(services)
  const sessionIdRef = useRef('')
  const sizeRef = useRef<TerminalSize | null>(null)
  const startPendingRef = useRef(false)
  const startRequestIdRef = useRef(0)

  servicesRef.current = services

  return {
    adapterRef,
    codexChecked,
    codexReady,
    errorMessage,
    hostRef,
    mountedRef,
    process,
    servicesRef,
    sessionIdRef,
    setCodexChecked,
    setCodexReady,
    setErrorMessage,
    setProcess,
    setStatus,
    sizeRef,
    startPendingRef,
    startRequestIdRef,
    status
  }
}

export function useTerminalRuntimeContext(
  runtime: TerminalRuntimeState,
  launchRef: MutableRefObject<TerminalLaunchState>
) {
  return useMemo(
    () => ({
      adapterRef: runtime.adapterRef,
      launchRef,
      mountedRef: runtime.mountedRef,
      servicesRef: runtime.servicesRef,
      sessionIdRef: runtime.sessionIdRef,
      setErrorMessage: runtime.setErrorMessage,
      setProcess: runtime.setProcess,
      setStatus: runtime.setStatus,
      sizeRef: runtime.sizeRef,
      startPendingRef: runtime.startPendingRef,
      startRequestIdRef: runtime.startRequestIdRef
    }),
    [
      runtime.adapterRef,
      launchRef,
      runtime.mountedRef,
      runtime.servicesRef,
      runtime.sessionIdRef,
      runtime.setErrorMessage,
      runtime.setProcess,
      runtime.setStatus,
      runtime.sizeRef,
      runtime.startPendingRef,
      runtime.startRequestIdRef
    ]
  )
}

export function buildTerminalPanelState(
  config: ProjectConfig,
  runtime: TerminalRuntimeState,
  actions: TerminalControllerActions
) {
  const hasWorkspaceRoot = config.workspace.root_dir.trim().length > 0

  return {
    canStart:
      hasWorkspaceRoot &&
      runtime.codexReady &&
      !runtime.startPendingRef.current &&
      runtime.sessionIdRef.current.length === 0,
    closeTerminal: actions.closeTerminal,
    codexReady: runtime.codexReady,
    errorMessage: runtime.errorMessage,
    hostRef: runtime.hostRef,
    idleHint: runtime.status === 'idle' ? TERMINAL_IDLE_TEXT : undefined,
    installMessage: runtime.codexChecked && !runtime.codexReady ? TERMINAL_INSTALL_TEXT : undefined,
    process: runtime.process,
    refreshTerminal: actions.refreshTerminal,
    restartTerminal: actions.restartTerminal,
    startTerminal: actions.startTerminal,
    status: runtime.status,
    workspaceRoot: config.workspace.root_dir || '未配置项目目录'
  }
}
