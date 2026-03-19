import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { TerminalStreamEvent } from '../../lib/types/terminal'
import type { TerminalServices } from './terminal-services'
import { resolveTerminalStatus } from './terminal-state'
import type { TerminalAdapterFactory, TerminalSize } from './xterm-adapter'
import {
  cancelPendingStart,
  pushTerminalError,
  shutdownActiveSession,
  type TerminalRuntimeContext
} from './terminal-panel-controller-shared'

function getLifecycleErrorMessage(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error)
  return `${prefix}：${detail}`
}

function subscribeTerminalStream(
  services: TerminalServices,
  sessionIdRef: TerminalRuntimeContext['sessionIdRef'],
  adapterRef: TerminalRuntimeContext['adapterRef'],
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setProcess: TerminalRuntimeContext['setProcess'],
  setStatus: TerminalRuntimeContext['setStatus']
) {
  return services.subscribe((event: TerminalStreamEvent) => {
    if (!sessionIdRef.current || event.sessionId !== sessionIdRef.current) {
      return
    }
    if (event.eventType === 'output') {
      adapterRef.current?.write(event.message)
    }
    if (event.eventType === 'error') {
      setErrorMessage(event.message)
    }
    if (event.eventType === 'exited') {
      sessionIdRef.current = ''
      setProcess(null)
    }
    setStatus((current) => resolveTerminalStatus(current, event))
  })
}

export function useCodexAvailability(
  services: TerminalServices,
  setCodexReady: Dispatch<SetStateAction<boolean>>,
  setCodexChecked: Dispatch<SetStateAction<boolean>>,
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setStatus: TerminalRuntimeContext['setStatus']
) {
  useEffect(() => {
    let active = true

    void services
      .checkCodexInstallation()
      .then((installed) => {
        if (!active) {
          return
        }
        setCodexReady(installed)
        setCodexChecked(true)
      })
      .catch((error) => {
        if (!active) {
          return
        }
        setCodexReady(false)
        setCodexChecked(true)
        pushTerminalError(setErrorMessage, setStatus, error)
      })

    return () => {
      active = false
    }
  }, [services, setCodexChecked, setCodexReady, setErrorMessage, setStatus])
}

export function useTerminalAdapter(
  createAdapter: TerminalAdapterFactory,
  adapterRef: TerminalRuntimeContext['adapterRef'],
  hostRef: MutableRefObject<HTMLDivElement | null>,
  onInput: (payload: string) => void,
  onResize: (size: TerminalSize) => void,
  sizeRef: TerminalRuntimeContext['sizeRef']
) {
  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const adapter = createAdapter(hostRef.current, { onInput, onResize })
    adapterRef.current = adapter
    sizeRef.current = adapter.fit()

    return () => {
      adapter.destroy()
      adapterRef.current = null
      sizeRef.current = null
    }
  }, [adapterRef, createAdapter, hostRef, onInput, onResize, sizeRef])
}

export function useTerminalSubscription(
  services: TerminalServices,
  adapterRef: TerminalRuntimeContext['adapterRef'],
  sessionIdRef: TerminalRuntimeContext['sessionIdRef'],
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setProcess: TerminalRuntimeContext['setProcess'],
  setStatus: TerminalRuntimeContext['setStatus']
) {
  useEffect(() => {
    let disposed = false
    let unsubscribe: () => void = () => undefined
    const subscription = subscribeTerminalStream(
      services,
      sessionIdRef,
      adapterRef,
      setErrorMessage,
      setProcess,
      setStatus
    )

    void Promise.resolve(subscription).then((cleanup) => {
      if (disposed) {
        cleanup()
        return
      }
      unsubscribe = cleanup
    }).catch((error) => {
      if (!disposed) {
        pushTerminalError(setErrorMessage, setStatus, error)
      }
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [adapterRef, services, sessionIdRef, setErrorMessage, setProcess, setStatus])
}

function syncProjectSessionReset(
  adapterRef: TerminalRuntimeContext['adapterRef'],
  servicesRef: TerminalRuntimeContext['servicesRef'],
  sessionIdRef: TerminalRuntimeContext['sessionIdRef'],
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setProcess: TerminalRuntimeContext['setProcess'],
  setStatus: TerminalRuntimeContext['setStatus'],
  startPendingRef: TerminalRuntimeContext['startPendingRef'],
  startRequestIdRef: TerminalRuntimeContext['startRequestIdRef']
) {
  cancelPendingStart(startPendingRef, startRequestIdRef)
  adapterRef.current?.clear()
  if (!sessionIdRef.current) {
    setProcess(null)
    setErrorMessage(undefined)
    setStatus('idle')
    return
  }
  void shutdownActiveSession(servicesRef, sessionIdRef, setProcess, setStatus, setErrorMessage, 'idle')
}

function closeSessionAfterUnmount(
  servicesRef: TerminalRuntimeContext['servicesRef'],
  sessionIdRef: TerminalRuntimeContext['sessionIdRef']
) {
  if (!sessionIdRef.current) {
    return
  }
  const sessionId = sessionIdRef.current
  sessionIdRef.current = ''
  void servicesRef.current.closeSession({ session_id: sessionId }).catch((error) => {
    console.error(getLifecycleErrorMessage('组件卸载时关闭终端失败', error), error)
  })
}

function useTerminalUnmountCleanup(
  mountedRef: TerminalRuntimeContext['mountedRef'],
  servicesRef: TerminalRuntimeContext['servicesRef'],
  sessionIdRef: TerminalRuntimeContext['sessionIdRef'],
  startPendingRef: TerminalRuntimeContext['startPendingRef'],
  startRequestIdRef: TerminalRuntimeContext['startRequestIdRef']
) {
  useEffect(() => {
    return () => {
      mountedRef.current = false
      cancelPendingStart(startPendingRef, startRequestIdRef)
      closeSessionAfterUnmount(servicesRef, sessionIdRef)
    }
  }, [
    mountedRef,
    servicesRef,
    sessionIdRef,
    startPendingRef,
    startRequestIdRef
  ])
}

export function useProjectSessionLifecycle(
  adapterRef: TerminalRuntimeContext['adapterRef'],
  projectId: string,
  configVersion: string,
  mountedRef: TerminalRuntimeContext['mountedRef'],
  servicesRef: TerminalRuntimeContext['servicesRef'],
  sessionIdRef: TerminalRuntimeContext['sessionIdRef'],
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setProcess: TerminalRuntimeContext['setProcess'],
  setStatus: TerminalRuntimeContext['setStatus'],
  startPendingRef: TerminalRuntimeContext['startPendingRef'],
  startRequestIdRef: TerminalRuntimeContext['startRequestIdRef']
) {
  useEffect(() => {
    syncProjectSessionReset(
      adapterRef,
      servicesRef,
      sessionIdRef,
      setErrorMessage,
      setProcess,
      setStatus,
      startPendingRef,
      startRequestIdRef
    )
  }, [
    adapterRef,
    configVersion,
    projectId,
    mountedRef,
    servicesRef,
    sessionIdRef,
    setErrorMessage,
    setProcess,
    setStatus,
    startPendingRef,
    startRequestIdRef
  ])
  useTerminalUnmountCleanup(
    mountedRef,
    servicesRef,
    sessionIdRef,
    startPendingRef,
    startRequestIdRef
  )
}
