import { describe, expect, it } from 'vitest'
import { parseTurnKey, turnKey } from '../src/shared/protocol'

describe('turnKey', () => {
  it('round-trips session id and seq', () => {
    const key = turnKey('abc-123', 42)
    expect(parseTurnKey(key)).toEqual({ sessionId: 'abc-123', seq: 42 })
  })

  it('keeps session ids that contain hashes', () => {
    const key = turnKey('ses#1', 7)
    expect(parseTurnKey(key)).toEqual({ sessionId: 'ses#1', seq: 7 })
  })

  it('rejects malformed keys', () => {
    expect(parseTurnKey('no-hash')).toBeNull()
    expect(parseTurnKey('#12')).toBeNull()
    expect(parseTurnKey('ses#x')).toBeNull()
    expect(parseTurnKey('ses#-1')).toBeNull()
  })
})
