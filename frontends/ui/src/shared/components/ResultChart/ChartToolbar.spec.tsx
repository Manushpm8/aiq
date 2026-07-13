// SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@/test-utils'
import { ChartToolbar } from './ChartToolbar'
import type { ChartSpec } from './types'

const spec: ChartSpec = {
  type: 'bar',
  title: 'Top models',
  x: { key: 'model' },
  series: [{ key: 'count' }],
  data: [{ model: 'H100', count: 10 }],
}

describe('ChartToolbar', () => {
  afterEach(() => vi.restoreAllMocks())

  test('reflects the open state and fires the toggle', () => {
    const onToggleData = vi.fn()
    const { rerender } = render(
      <ChartToolbar spec={spec} dataOpen={false} onToggleData={onToggleData} />,
    )
    const toggle = screen.getByRole('button', { name: 'Show data' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(onToggleData).toHaveBeenCalledOnce()

    rerender(<ChartToolbar spec={spec} dataOpen onToggleData={onToggleData} />)
    expect(screen.getByRole('button', { name: 'Hide data' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('download triggers a CSV blob download', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<ChartToolbar spec={spec} dataOpen={false} onToggleData={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    vi.unstubAllGlobals()
  })
})
