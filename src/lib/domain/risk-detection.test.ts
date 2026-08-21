import { describe, it, expect } from 'bun:test'
import { detectHighRiskCategory } from './risk-detection'

describe('detectHighRiskCategory', () => {
  it('flags legal signals', () => {
    expect(detectHighRiskCategory('My landlord started an eviction against me')).toBe('LEGAL')
    expect(detectHighRiskCategory('I am suing my former business partner')).toBe('LEGAL')
  })

  it('flags financial signals', () => {
    expect(detectHighRiskCategory('I think this is an investment scam')).toBe('FINANCIAL')
  })

  it('flags healthcare signals', () => {
    expect(detectHighRiskCategory('I need help after a medical emergency')).toBe('HEALTHCARE')
  })

  it('flags government/identity signals', () => {
    expect(detectHighRiskCategory('I am worried about my immigration status')).toBe('GOVERNMENT_IDENTITY')
  })

  it('flags safety-critical signals', () => {
    expect(detectHighRiskCategory('There is a gas leak in my kitchen')).toBe('SAFETY_CRITICAL')
  })

  it('returns null for ordinary, non-high-risk requests', () => {
    expect(detectHighRiskCategory('My AC is not cooling properly')).toBeNull()
    expect(detectHighRiskCategory('I need help registering my business')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(detectHighRiskCategory('GAS LEAK in the kitchen')).toBe('SAFETY_CRITICAL')
  })
})
