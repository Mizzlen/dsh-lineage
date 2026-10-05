import { describe, expect, it } from 'vitest'
import { stripRowChrome, stripRowChromeAggressive } from '../src/client/glue'

describe('stripRowChrome (safe pass)', () => {
  it('strips glued english relative times', () => {
    expect(stripRowChrome('介绍 otty 工具1h')).toBe('介绍 otty 工具')
    expect(stripRowChrome('Clash Verge 添加直连规则16h')).toBe('Clash Verge 添加直连规则')
    expect(stripRowChrome("l'l'l21h")).toBe("l'l'l")
  })

  it('strips glued chinese relative times (zh UI)', () => {
    // Real row labels from a zh-locale sidebar (2026-10-05 jump failure).
    expect(stripRowChrome('测试 分支 分支6分钟')).toBe('测试 分支 分支')
    expect(stripRowChrome('测试12分钟')).toBe('测试')
    expect(stripRowChrome('查看项目代码42分钟')).toBe('查看项目代码')
    expect(stripRowChrome('macOS 下 Codex 与 Claude Code 内核共用18小时')).toBe('macOS 下 Codex 与 Claude Code 内核共用')
    expect(stripRowChrome('测试3天')).toBe('测试')
    expect(stripRowChrome('测试2周')).toBe('测试')
    expect(stripRowChrome('测试5个月')).toBe('测试')
    expect(stripRowChrome('测试30秒')).toBe('测试')
  })

  it('strips the session-actions tail', () => {
    expect(stripRowChrome('测试 Session actions for 测试 Archive session Pin session')).toBe('测试')
  })

  it('does not touch titles without a glued time', () => {
    expect(stripRowChrome('默认工作区')).toBe('默认工作区')
    expect(stripRowChrome('未分组')).toBe('未分组')
  })
})

describe('stripRowChromeAggressive (second pass)', () => {
  it('strips the active-row status prefix and now (en)', () => {
    expect(stripRowChromeAggressive('Completed测试 分支now')).toBe('测试 分支')
    expect(stripRowChromeAggressive('Running任务12h')).toBe('任务')
  })

  it('strips chinese status prefixes and times', () => {
    expect(stripRowChromeAggressive('已完成测试 分支6分钟')).toBe('测试 分支')
    expect(stripRowChromeAggressive('运行中测试12分钟')).toBe('测试')
    expect(stripRowChromeAggressive('测试刚刚')).toBe('测试')
    expect(stripRowChromeAggressive('测试5分钟前')).toBe('测试')
  })

  it('keeps titles that start with a status word safe via the first pass', () => {
    // A title legitimately starting with "Completed" matches the SAFE pass,
    // so the aggressive pass never gets a chance to corrupt it.
    expect(stripRowChrome('Completed work1h')).toBe('Completed work')
  })
})
