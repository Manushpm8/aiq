// SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { ResearchPanel } from './ResearchPanel'

const mockCloseRightPanel = vi.fn()
let mockRightPanel: string | null = 'research'

vi.mock('../store', () => ({
  useLayoutStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      rightPanel: mockRightPanel,
      closeRightPanel: mockCloseRightPanel,
    }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/adapters/auth', () => ({
  useAuth: vi.fn(() => ({ idToken: 'mock-token' })),
}))

vi.mock('@/adapters/api', () => ({
  cancelJob: vi.fn().mockResolvedValue(undefined),
}))

interface MockChatState {
  isDeepResearchStreaming: boolean
  deepResearchJobId: string | null
  reportContent: string
  deepResearchCitations: Array<{ id: string; url: string; content: string; timestamp: Date }>
  deepResearchFiles: Array<{ id: string; filename: string }>
  deepResearchAgents: unknown[]
  deepResearchTodos: unknown[]
}

const defaultChatState: MockChatState = {
  isDeepResearchStreaming: false,
  deepResearchJobId: null,
  reportContent: '',
  deepResearchCitations: [],
  deepResearchFiles: [],
  deepResearchAgents: [],
  deepResearchTodos: [],
}

let mockChatState: MockChatState = { ...defaultChatState }
let mockIsLoadJobDataLoading = false
const mockLoadResearchPanelTab = vi.fn()
const mockImportStreamOnly = vi.fn()

vi.mock('@/features/chat', () => ({
  useChatStore: Object.assign(
    (selector: (s: MockChatState) => unknown) => selector(mockChatState),
    { getState: () => mockChatState }
  ),
  selectResolvedDeepResearchJobId: (s: MockChatState) => s.deepResearchJobId,
  useLoadJobData: () => ({
    loadResearchPanelTab: mockLoadResearchPanelTab,
    importStreamOnly: mockImportStreamOnly,
    isLoading: mockIsLoadJobDataLoading,
  }),
}))

vi.mock('./TasksTab', () => ({
  TasksTab: () => <div data-testid="tasks-tab">Tasks Tab Content</div>,
}))

vi.mock('./ThinkingTab', () => ({
  ThinkingTab: () => <div data-testid="thinking-tab">Thinking Tab Content</div>,
}))

vi.mock('./ReportTab', () => ({
  ReportTab: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="report-tab">Report Tab Content {children}</div>
  ),
}))

vi.mock('./FileCard', () => ({
  FileCard: ({ file }: { file: { filename: string } }) => (
    <div data-testid="file-card">{file.filename}</div>
  ),
}))

describe('ResearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRightPanel = 'research'
    mockChatState = { ...defaultChatState }
    mockIsLoadJobDataLoading = false
  })

  describe('panel visibility', () => {
    test.each(['research', 'thinking', 'citations', 'artifacts'] as const)(
      'is open for the %s rail panel',
      (panel) => {
        mockRightPanel = panel
        render(<ResearchPanel isAuthenticated={true} />)

        expect(screen.getByTestId('research-panel-close')).toBeInTheDocument()
        expect(screen.getByTestId('research-panel')).toHaveAttribute('aria-hidden', 'false')
      }
    )

    test.each(['data-sources', 'settings', null] as const)(
      'is hidden when rightPanel is %s',
      (panel) => {
        mockRightPanel = panel
        render(<ResearchPanel isAuthenticated={true} />)

        expect(screen.getByTestId('research-panel')).toHaveAttribute('aria-hidden', 'true')
      }
    )
  })

  describe('panel header', () => {
    test.each([
      ['research', 'Research'],
      ['thinking', 'Thinking'],
      ['citations', 'Citations'],
      ['artifacts', 'Artifacts'],
    ] as const)('shows the %s label in the header', (panel, label) => {
      mockRightPanel = panel
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByText(label)).toBeInTheDocument()
    })

    test('does not render the former Tasks/Thinking/Report segmented control', () => {
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })

    test('does not render the former "Show Research" toggle tab', () => {
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.queryByText('Show Research')).not.toBeInTheDocument()
      expect(screen.queryByTestId('research-panel-toggle')).not.toBeInTheDocument()
    })
  })

  describe('content wiring', () => {
    test('research shows the ReportTab (with export footer)', () => {
      mockRightPanel = 'research'
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByTestId('report-tab')).toBeInTheDocument()
    })

    test('thinking shows the ThinkingTab', () => {
      mockRightPanel = 'thinking'
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByTestId('thinking-tab')).toBeInTheDocument()
    })

    test('thinking folds workflow Task progress in when there is progress', async () => {
      mockRightPanel = 'thinking'
      mockChatState = { ...defaultChatState, deepResearchTodos: [{ id: 't1' }] }
      const user = userEvent.setup()
      render(<ResearchPanel isAuthenticated={true} />)

      const toggle = screen.getByText('Task progress')
      expect(toggle).toBeInTheDocument()
      expect(screen.queryByTestId('tasks-tab')).not.toBeInTheDocument()

      await user.click(toggle)
      expect(screen.getByTestId('tasks-tab')).toBeInTheDocument()
    })

    test('thinking hides Task progress when there is none', () => {
      mockRightPanel = 'thinking'
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.queryByText('Task progress')).not.toBeInTheDocument()
    })

    test('citations shows an empty state when there are no sources', () => {
      mockRightPanel = 'citations'
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByText('Cited sources will appear here.')).toBeInTheDocument()
    })

    test('citations lists deep-research citations when present', () => {
      mockRightPanel = 'citations'
      mockChatState = {
        ...defaultChatState,
        deepResearchCitations: [
          {
            id: 'c1',
            url: 'https://example.com/report',
            content: 'A cited finding',
            timestamp: new Date('2026-05-01T00:00:00Z'),
          },
        ],
      }
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByText('A cited finding')).toBeInTheDocument()
      expect(screen.queryByText('Cited sources will appear here.')).not.toBeInTheDocument()
    })

    test('artifacts shows an empty state when there are no files', () => {
      mockRightPanel = 'artifacts'
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByText('Artifacts will appear here.')).toBeInTheDocument()
    })

    test('artifacts lists generated files when present', () => {
      mockRightPanel = 'artifacts'
      mockChatState = {
        ...defaultChatState,
        deepResearchFiles: [{ id: 'f1', filename: 'summary.md' }],
      }
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByTestId('file-card')).toHaveTextContent('summary.md')
      expect(screen.queryByText('Artifacts will appear here.')).not.toBeInTheDocument()
    })
  })

  describe('close button', () => {
    test('calls closeRightPanel when clicked', async () => {
      const user = userEvent.setup()
      render(<ResearchPanel isAuthenticated={true} />)

      await user.click(screen.getByTestId('research-panel-close'))

      expect(mockCloseRightPanel).toHaveBeenCalled()
    })
  })

  describe('stop researching button', () => {
    test('is hidden when not streaming', () => {
      mockChatState = { ...defaultChatState, isDeepResearchStreaming: false }
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.queryByTestId('research-panel-stop')).not.toBeInTheDocument()
    })

    test('is shown and enabled when streaming', () => {
      mockChatState = { ...defaultChatState, isDeepResearchStreaming: true }
      render(<ResearchPanel isAuthenticated={true} />)

      expect(screen.getByTestId('research-panel-stop')).toBeInTheDocument()
      expect(screen.getByTestId('research-panel-stop')).not.toBeDisabled()
    })
  })

  describe('lazy data loading', () => {
    test('loads the report when the research panel opens for a job', () => {
      mockRightPanel = 'research'
      mockChatState = { ...defaultChatState, deepResearchJobId: 'job-123' }
      render(<ResearchPanel isAuthenticated={true} />)

      expect(mockLoadResearchPanelTab).toHaveBeenCalledWith('job-123', 'report')
    })

    test('replays the stream for stream-backed panels', () => {
      mockRightPanel = 'thinking'
      mockChatState = { ...defaultChatState, deepResearchJobId: 'job-123' }
      render(<ResearchPanel isAuthenticated={true} />)

      expect(mockImportStreamOnly).toHaveBeenCalledWith('job-123')
    })
  })
})
