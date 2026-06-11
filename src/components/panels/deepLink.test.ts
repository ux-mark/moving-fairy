import { describe, expect, it } from 'vitest'

import {
  INITIAL_DEEP_LINK_STATE,
  nextDeepLinkStep,
  type DeepLinkState,
} from './deepLink'

describe('nextDeepLinkStep', () => {
  it('opens the panel when a param value first appears', () => {
    const step = nextDeepLinkStep(INITIAL_DEEP_LINK_STATE, 'abc', false)
    expect(step.action).toBe('open')
    expect(step.action === 'open' && step.entityId).toBe('abc')
    expect(step.state).toEqual({ handled: 'abc', wasOpen: false })
  })

  it('does nothing while there is no param value', () => {
    const { action, state } = nextDeepLinkStep(INITIAL_DEEP_LINK_STATE, null, false)
    expect(action).toBeNull()
    expect(state).toEqual(INITIAL_DEEP_LINK_STATE)
  })

  it('waits (no clear) between open being issued and the panel appearing', () => {
    const handled: DeepLinkState = { handled: 'abc', wasOpen: false }
    const { action, state } = nextDeepLinkStep(handled, 'abc', false)
    expect(action).toBeNull()
    expect(state).toEqual(handled)
  })

  it('records the panel as open once observed', () => {
    const handled: DeepLinkState = { handled: 'abc', wasOpen: false }
    const { action, state } = nextDeepLinkStep(handled, 'abc', true)
    expect(action).toBeNull()
    expect(state).toEqual({ handled: 'abc', wasOpen: true })
  })

  it('clears the param when the panel closes after having been open', () => {
    const open: DeepLinkState = { handled: 'abc', wasOpen: true }
    const { action, state } = nextDeepLinkStep(open, 'abc', false)
    expect(action).toBe('clearParam')
    expect(state).toEqual(INITIAL_DEEP_LINK_STATE)
  })

  it('opens the new panel when the param value changes', () => {
    const open: DeepLinkState = { handled: 'abc', wasOpen: true }
    const { action, state } = nextDeepLinkStep(open, 'def', false)
    expect(action).toBe('open')
    expect(state).toEqual({ handled: 'def', wasOpen: false })
  })

  it('closes the panel when the param is removed externally (browser Back)', () => {
    const open: DeepLinkState = { handled: 'abc', wasOpen: true }
    const step = nextDeepLinkStep(open, null, true)
    expect(step.action).toBe('close')
    expect(step.action === 'close' && step.entityId).toBe('abc')
    expect(step.state).toEqual(INITIAL_DEEP_LINK_STATE)
  })

  it('resets without closing when the param is removed and the panel is already gone', () => {
    const open: DeepLinkState = { handled: 'abc', wasOpen: true }
    const { action, state } = nextDeepLinkStep(open, null, false)
    expect(action).toBeNull()
    expect(state).toEqual(INITIAL_DEEP_LINK_STATE)
  })
})
