// SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest'
import { fenceBareSpecs, parseCarouselSpec, parseChartSpec, parseKpiSpec, toNumber } from './parse'

const barSpec = {
  type: 'bar',
  title: 'Fleet',
  x: { key: 'model' },
  series: [{ key: 'count' }],
  data: [
    { model: 'H100', count: 10 },
    { model: 'A100', count: 5 },
  ],
}
const lineSpec = { ...barSpec, type: 'line' }

describe('toNumber', () => {
  test('numbers pass through, non-finite becomes null', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber(Infinity)).toBeNull()
  })

  test('numeric-ish strings are cleaned', () => {
    expect(toNumber('1,234')).toBe(1234)
    expect(toNumber('$1200')).toBe(1200)
    expect(toNumber('94%')).toBe(94)
  })

  test('empty, non-numeric, and other types are null', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber({})).toBeNull()
  })
})

describe('parseChartSpec', () => {
  test('parses a valid spec', () => {
    expect(parseChartSpec(JSON.stringify(barSpec))?.type).toBe('bar')
  })

  test('malformed JSON returns null', () => {
    expect(parseChartSpec('{not json')).toBeNull()
  })

  test('schema failure returns null', () => {
    expect(parseChartSpec(JSON.stringify({ ...barSpec, series: [] }))).toBeNull()
  })

  test('null when the x key resolves on no row', () => {
    const spec = { ...barSpec, x: { key: 'missing' } }
    expect(parseChartSpec(JSON.stringify(spec))).toBeNull()
  })

  test('null when no series has numeric data', () => {
    const spec = {
      ...barSpec,
      data: [
        { model: 'H100', count: 'n/a' },
        { model: 'A100', count: null },
      ],
    }
    expect(parseChartSpec(JSON.stringify(spec))).toBeNull()
  })
})

describe('parseCarouselSpec', () => {
  test('parses a valid carousel', () => {
    const spec = { title: 'Trends', charts: [lineSpec, lineSpec] }
    expect(parseCarouselSpec(JSON.stringify(spec))?.charts).toHaveLength(2)
  })

  test('schema failure returns null', () => {
    expect(parseCarouselSpec(JSON.stringify({ title: 'x', charts: [lineSpec] }))).toBeNull()
  })

  test('null when a child chart has no usable data', () => {
    const badChild = { ...lineSpec, x: { key: 'missing' } }
    const spec = { title: 'Trends', charts: [lineSpec, badChild] }
    expect(parseCarouselSpec(JSON.stringify(spec))).toBeNull()
  })
})

describe('parseKpiSpec', () => {
  test('valid and invalid', () => {
    expect(parseKpiSpec(JSON.stringify({ kpis: [{ label: 'A', value: '1' }] }))?.kpis).toHaveLength(1)
    expect(parseKpiSpec(JSON.stringify({ kpis: [] }))).toBeNull()
  })
})

describe('fenceBareSpecs', () => {
  test('returns markdown unchanged when it has no brace', () => {
    expect(fenceBareSpecs('just text')).toBe('just text')
  })

  test('leaves lines already inside a fence untouched', () => {
    const md = '```json\n' + JSON.stringify(barSpec) + '\n```'
    expect(fenceBareSpecs(md)).toBe(md)
  })

  test('fences a bare chart spec line', () => {
    const out = fenceBareSpecs('intro\n' + JSON.stringify(barSpec))
    expect(out).toContain('```chart\n')
  })

  test('fences a bare carousel spec line', () => {
    const carousel = { title: 'Trends', charts: [lineSpec, lineSpec] }
    const out = fenceBareSpecs(JSON.stringify(carousel))
    expect(out).toContain('```chart-carousel\n')
  })

  test('fences a bare kpi-only spec line', () => {
    const out = fenceBareSpecs(JSON.stringify({ kpis: [{ label: 'A', value: '1' }] }))
    expect(out).toContain('```chart\n')
  })

  test('ignores a brace line that is not a spec', () => {
    expect(fenceBareSpecs('{ "hello": 1 }')).toBe('{ "hello": 1 }')
  })
})
