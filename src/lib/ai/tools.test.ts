import { describe, it, expect } from 'vitest'
import {
  RENDER_ASSESSMENT_CARD_TOOL,
  CHAT_RENDER_ASSESSMENT_CARD_TOOL,
  UPDATE_ITEM_ASSESSMENT_TOOL,
  CHAT_TOOLS,
} from './tools'

describe('render_assessment_card tool', () => {
  it('exposes the full assessment schema', () => {
    expect(RENDER_ASSESSMENT_CARD_TOOL.name).toBe('render_assessment_card')
    expect(RENDER_ASSESSMENT_CARD_TOOL.input_schema.required).toEqual([
      'item',
      'verdict',
      'confidence',
      'rationale',
      'action',
    ])

    const props = RENDER_ASSESSMENT_CARD_TOOL.input_schema.properties
    // Superset fields that the old chat-route copy had drifted behind on
    expect(props).toHaveProperty('biosecurity_flag')
    expect(props).toHaveProperty('biosecurity_category')
    expect(props).toHaveProperty('biosecurity_note')
    expect(props).toHaveProperty('category')
    expect(props).toHaveProperty('care')
    expect(props).toHaveProperty('estimated_ship_cost_usd')
    expect(props).toHaveProperty('estimated_replace_cost_usd')
  })

  it('single-sources the schema between assessment and chat variants', () => {
    // Same object reference — the schema cannot drift between modes again
    expect(CHAT_RENDER_ASSESSMENT_CARD_TOOL.input_schema).toBe(
      RENDER_ASSESSMENT_CARD_TOOL.input_schema
    )
    expect(CHAT_RENDER_ASSESSMENT_CARD_TOOL.name).toBe('render_assessment_card')
    // Only the mode-specific description differs
    expect(CHAT_RENDER_ASSESSMENT_CARD_TOOL.description).not.toBe(
      RENDER_ASSESSMENT_CARD_TOOL.description
    )
  })
})

describe('update_item_assessment tool', () => {
  it('persists assessment fields with no required inputs', () => {
    expect(UPDATE_ITEM_ASSESSMENT_TOOL.name).toBe('update_item_assessment')
    expect(UPDATE_ITEM_ASSESSMENT_TOOL.input_schema.required).toEqual([])

    const props = UPDATE_ITEM_ASSESSMENT_TOOL.input_schema.properties
    expect(props).toHaveProperty('verdict')
    expect(props).toHaveProperty('advice_text')
    expect(props).toHaveProperty('confidence')
    expect(props).toHaveProperty('estimated_ship_cost')
    expect(props).toHaveProperty('estimated_replace_cost')
  })
})

describe('CHAT_TOOLS', () => {
  it('contains the chat card variant and the update tool', () => {
    expect(CHAT_TOOLS).toEqual([
      CHAT_RENDER_ASSESSMENT_CARD_TOOL,
      UPDATE_ITEM_ASSESSMENT_TOOL,
    ])
  })
})
