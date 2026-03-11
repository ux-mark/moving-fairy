'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ItemAssessment } from '@/types'
import { registerInventoryRefresh } from '@/hooks/useInventoryData'

interface DecisionsState {
  decisions: ItemAssessment[]
  isLoading: boolean
  error: string | null
}

const INITIAL_STATE: DecisionsState = {
  decisions: [],
  isLoading: true,
  error: null,
}

interface UseDecisionsOptions {
  /** Called after confirmAndSend succeeds, with the message to inject into chat */
  onSendToChat?: (message: string) => void
}

export function useDecisions(options?: UseDecisionsOptions): {
  decisions: ItemAssessment[]
  isLoading: boolean
  error: string | null
  confirm: (assessmentId: string) => Promise<void>
  confirmAndSend: (assessmentId: string) => Promise<void>
  refresh: () => Promise<void>
  count: number
} {
  const { onSendToChat } = options ?? {}
  const [state, setState] = useState<DecisionsState>(INITIAL_STATE)
  const isMountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const res = await fetch('/api/decisions')
      if (!res.ok) throw new Error(`Failed to fetch decisions (${res.status})`)
      const data = await res.json() as { ok: boolean; decisions: ItemAssessment[] }
      if (isMountedRef.current) {
        setState({ decisions: data.decisions ?? [], isLoading: false, error: null })
      }
    } catch (err) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load decisions',
        }))
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    refresh()

    // Refresh decisions whenever inventory refreshes (e.g. after Aisling generates a card)
    const unregister = registerInventoryRefresh(refresh)
    return () => {
      isMountedRef.current = false
      unregister()
    }
  }, [refresh])

  const confirm = useCallback(async (assessmentId: string) => {
    const res = await fetch('/api/decisions/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment_id: assessmentId }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Failed to confirm decision')
    }
    await refresh()
  }, [refresh])

  const confirmAndSend = useCallback(async (assessmentId: string) => {
    const res = await fetch('/api/decisions/confirm-and-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment_id: assessmentId }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Failed to confirm and send decision')
    }
    const data = await res.json() as { ok: boolean; chatMessage?: string }
    await refresh()
    if (data.chatMessage && onSendToChat) {
      onSendToChat(data.chatMessage)
    }
  }, [refresh, onSendToChat])

  return {
    decisions: state.decisions,
    isLoading: state.isLoading,
    error: state.error,
    confirm,
    confirmAndSend,
    refresh,
    count: state.decisions.length,
  }
}
