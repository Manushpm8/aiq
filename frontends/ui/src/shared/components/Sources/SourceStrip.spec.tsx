// SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SourceStrip } from './SourceStrip'
import type { SourceRef } from './types'

function makeSources(n: number): SourceRef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    index: i + 1,
    title: `Source ${i}`,
    kind: 'web' as const,
    label: `site${i}.com`,
    url: `https://site${i}.com`,
  }))
}

describe('SourceStrip', () => {
  test('renders nothing when there are no sources', () => {
    const { container } = render(<SourceStrip sources={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renders a card per source when under the preview count', () => {
    render(<SourceStrip sources={makeSources(3)} previewCount={4} />)
    expect(screen.getByText('Source 0')).toBeInTheDocument()
    expect(screen.getByText('Source 2')).toBeInTheDocument()
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument()
  })

  test('collapses overflow behind a "+N more" expander', () => {
    render(<SourceStrip sources={makeSources(6)} previewCount={4} />)
    expect(screen.queryByText('Source 5')).not.toBeInTheDocument()
    const more = screen.getByText(/\+3 more/)
    fireEvent.click(more)
    expect(screen.getByText('Source 5')).toBeInTheDocument()
  })

  test('keeps a stable trigger that toggles and reflects the disclosure state', () => {
    render(<SourceStrip sources={makeSources(6)} previewCount={4} />)
    const trigger = screen.getByRole('button', { name: /more/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Show fewer')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Source 5')).not.toBeInTheDocument()
  })

  test('links cards that have a url', () => {
    render(<SourceStrip sources={makeSources(1)} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://site0.com')
  })

  test('labels each card by its real [N] marker, not its array position', () => {
    const sparse: SourceRef[] = [
      { id: 'a', index: 2, title: 'Second', kind: 'web', label: 'two.com', url: 'https://two.com' },
      { id: 'b', index: 5, title: 'Fifth', kind: 'web', label: 'five.com', url: 'https://five.com' },
    ]
    render(<SourceStrip sources={sparse} />)
    expect(screen.getByText('[2]')).toBeInTheDocument()
    expect(screen.getByText('[5]')).toBeInTheDocument()
    expect(screen.queryByText('[1]')).not.toBeInTheDocument()
  })
})
