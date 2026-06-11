// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { hasOpenModalLayer } from './modalLayer'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('hasOpenModalLayer', () => {
  it('is false with no dialogs in the document', () => {
    document.body.innerHTML = '<div><p>panel content</p></div>'
    expect(hasOpenModalLayer()).toBe(false)
  })

  it('detects an open aria-modal dialog (DS ConfirmDialog shape)', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true">Delete?</div>'
    expect(hasOpenModalLayer()).toBe(true)
  })

  it('ignores non-modal panels (aria-modal="false")', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="false">panel</div>'
    expect(hasOpenModalLayer()).toBe(false)
  })

  it('clears once the dialog is removed', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>'
    expect(hasOpenModalLayer()).toBe(true)
    document.body.innerHTML = ''
    expect(hasOpenModalLayer()).toBe(false)
  })
})
