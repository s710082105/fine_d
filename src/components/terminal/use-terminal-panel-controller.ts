import { useCallback, useRef } from 'react'
import type { TerminalPanelProps } from './terminal-panel'
import { buildCreateTerminalSessionRequest } from './terminal-state'
import { resolveTauriTerminalServices, type TerminalServices } from './terminal-services'
import { useCodexAvailability, useProjectSessionLifecycle, useTerminalAdapter, useTerminalSubscription } from './terminal-panel-controller-effects'
import {
  cancelPendingStart,
  TERMINAL_INSTALL_TEXT,
  buildTerminalPanelState,
  pushTerminalError,
  shutdownActiveSession,
  useTerminalRuntimeContext,
  useTerminalRuntimeState,
  type TerminalLaunchState,
  type TerminalRuntimeContext
} from './terminal-panel-controller-shared'
import { createTerminalAdapter, type TerminalSize } from './xterm-adapter'

function getCleanupFailureMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error)
  return `已取消启动，但关闭晚到终端失败：${detail}`
}

function useTerminalInputAction(context: TerminalRuntimeContext) {
  return useCallback(
    (payload: string) => {
      if (!context.sessionIdRef.current) {
        return
      }
      void context.servicesRef.current
        .writeInput({ session_id: context.sessionIdRef.current, payload })
        .catch((error) => pushTerminalError(context.setErrorMessage, context.setStatus, error))
    },
    [context]
  )
}

function useTerminalResizeAction(context: TerminalRuntimeContext) {
  return useCallback(
    (size: TerminalSize) => {
      context.sizeRef.current = size
      if (!context.sessionIdRef.current) {
        return
      }
      void context.servicesRef.current
        .resize({ session_id: context.sessionIdRef.current, rows: size.rows, columns: size.columns })
        .catch((error) => pushTerminalError(context.setErrorMessage, context.setStatus, error))
    },
    [context]
  )
}

async function syncSessionSize(context: TerminalRuntimeContext, sessionId: string) {
  if (!context.sizeRef.current) {
    return
  }
  await context.servicesRef.current.resize({
    session_id: sessionId,
    rows: context.sizeRef.current.rows,
    columns: context.sizeRef.current.columns
  })
}

async function refreshTerminalViewport(context: TerminalRuntimeContext) {
  const size = context.adapterRef.current?.refresh()
  if (!size) {
    return
  }
  context.sizeRef.current = size
  if (!context.sessionIdRef.current) {
    return
  }
  await context.servicesRef.current.resize({
    session_id: context.sessionIdRef.current,
    rows: size.rows,
    columns: size.columns
  })
}

async function closeStaleSession(context: TerminalRuntimeContext, sessionId: string) {
  try {
    await context.servicesRef.current.closeSession({ session_id: sessionId })
  } catch (error) {
    const message = getCleanupFailureMessage(error)
    if (context.mountedRef.current) {
      context.setErrorMessage(message)
      context.setStatus('error')
      return
    }
    console.error(message, error)
  }
}

async function startTerminalSession(context: TerminalRuntimeContext, requestId: number) {
  const { config, configVersion, projectId } = context.launchRef.current
  const response = await context.servicesRef.current.createSession(
    buildCreateTerminalSessionRequest(projectId, configVersion, config)
  )
  if (context.startRequestIdRef.current !== requestId) {
    await closeStaleSession(context, response.sessionId)
    return
  }

  context.sessionIdRef.current = response.sessionId
  context.setProcess(response.process)
  context.setStatus('running')
  await syncSessionSize(context, response.sessionId)
  context.adapterRef.current?.focus()
}

function useTerminalStartAction(context: TerminalRuntimeContext, codexReady: boolean) {
  return useCallback(() => {
    if (!codexReady) {
      context.setErrorMessage(TERMINAL_INSTALL_TEXT)
      context.setStatus('error')
      return
    }
    if (context.startPendingRef.current || context.sessionIdRef.current) {
      context.setErrorMessage('当前终端已启动，请使用重启终端或关闭终端')
      return
    }
    const requestId = context.startRequestIdRef.current + 1
    context.startRequestIdRef.current = requestId
    context.adapterRef.current?.clear()
    context.startPendingRef.current = true
    context.setErrorMessage(undefined)
    context.setStatus('starting')
    void startTerminalSession(context, requestId).catch((error) => {
      if (context.startRequestIdRef.current === requestId) {
        pushTerminalError(context.setErrorMessage, context.setStatus, error)
      }
    }).finally(() => {
      if (context.startRequestIdRef.current === requestId) {
        context.startPendingRef.current = false
      }
    })
  }, [codexReady, context])
}

function useTerminalCloseAction(context: TerminalRuntimeContext) {
  return useCallback(() => {
    cancelPendingStart(context.startPendingRef, context.startRequestIdRef)
    void shutdownActiveSession(
      context.servicesRef,
      context.sessionIdRef,
      context.setProcess,
      context.setStatus,
      context.setErrorMessage,
      'exited'
    )
  }, [context])
}

function useTerminalRestartAction(
  context: TerminalRuntimeContext,
  startTerminal: () => void
) {
  return useCallback(() => {
    cancelPendingStart(context.startPendingRef, context.startRequestIdRef)
    void shutdownActiveSession(
      context.servicesRef,
      context.sessionIdRef,
      context.setProcess,
      context.setStatus,
      context.setErrorMessage,
      'exited'
    ).then((closed) => {
      if (closed) {
        startTerminal()
      }
    })
  }, [context, startTerminal])
}

function useTerminalRefreshAction(context: TerminalRuntimeContext) {
  return useCallback(() => {
    void refreshTerminalViewport(context).catch((error) => {
      pushTerminalError(context.setErrorMessage, context.setStatus, error)
    })
  }, [context])
}

function useTerminalActions(context: TerminalRuntimeContext, codexReady: boolean) {
  const onInput = useTerminalInputAction(context)
  const onResize = useTerminalResizeAction(context)
  const startTerminal = useTerminalStartAction(context, codexReady)
  const closeTerminal = useTerminalCloseAction(context)
  const refreshTerminal = useTerminalRefreshAction(context)
  const restartTerminal = useTerminalRestartAction(context, startTerminal)

  return {
    closeTerminal,
    onInput,
    onResize,
    refreshTerminal,
    restartTerminal,
    startTerminal,
    writeInput: onInput
  }
}

function useResolvedTerminalServices(services?: TerminalServices) {
  const defaultServicesRef = useRef<TerminalServices | null>(null)
  if (!defaultServicesRef.current) {
    defaultServicesRef.current = services ?? resolveTauriTerminalServices()
  }
  return services ?? defaultServicesRef.current!
}

function useTerminalControllerEffects(
  projectId: string,
  configVersion: string,
  createAdapter: NonNullable<TerminalPanelProps['createAdapter']>,
  resolvedServices: TerminalServices,
  runtime: ReturnType<typeof useTerminalRuntimeState>,
  actions: ReturnType<typeof useTerminalActions>
) {
  useTerminalAdapter(
    createAdapter,
    runtime.adapterRef,
    runtime.hostRef,
    actions.onInput,
    actions.onResize,
    runtime.sizeRef
  )
  useCodexAvailability(
    resolvedServices,
    runtime.setCodexReady,
    runtime.setCodexChecked,
    runtime.setErrorMessage,
    runtime.setStatus
  )
  useTerminalSubscription(
    resolvedServices,
    runtime.adapterRef,
    runtime.sessionIdRef,
    runtime.setErrorMessage,
    runtime.setProcess,
    runtime.setStatus
  )
  useProjectSessionLifecycle(
    runtime.adapterRef,
    projectId,
    configVersion,
    runtime.mountedRef,
    runtime.servicesRef,
    runtime.sessionIdRef,
    runtime.setErrorMessage,
    runtime.setProcess,
    runtime.setStatus,
    runtime.startPendingRef,
    runtime.startRequestIdRef
  )
}

export function useTerminalPanelController({
  projectId,
  config,
  configVersion,
  services,
  createAdapter = createTerminalAdapter
}: TerminalPanelProps) {
  const resolvedServices = useResolvedTerminalServices(services)
  const runtime = useTerminalRuntimeState(resolvedServices)
  const launchRef = useRef<TerminalLaunchState>({ config, configVersion, projectId })
  launchRef.current = { config, configVersion, projectId }
  const context = useTerminalRuntimeContext(runtime, launchRef)
  const actions = useTerminalActions(context, runtime.codexReady)

  useTerminalControllerEffects(projectId, configVersion, createAdapter, resolvedServices, runtime, actions)

  return buildTerminalPanelState(config, runtime, actions)
}
