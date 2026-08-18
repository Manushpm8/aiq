// SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * ResearchPanel Component
 *
 * The Deep Research content panel. It opens immediately to the left of the
 * DeepResearchRail and swaps its content based on the active rail item:
 *   - research  -> ReportTab (report + Markdown/PDF export footer)
 *   - thinking  -> ThinkingTab (reasoning/steps trace) with the workflow Task
 *                  progress folded in as a disclosure above it
 *   - citations -> the report's cited sources (SourceStrip)
 *   - artifacts -> the generated files/artifacts list (FileCard)
 *
 * Data Sources is handled by its own DataSourcesPanel; the four items above and
 * Data Sources are mutually exclusive via the shared rightPanel slot, so only
 * one panel is ever open. This panel PUSHES the chat area rather than overlaying.
 */

'use client'

import { type FC, type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Flex, Button, Spinner, Text } from '@/adapters/ui'
import { CheckCircle, ChevronDown, Close, DocumentCheckmark, Image as ImageIcon, StopCircle } from '@/adapters/ui/icons'
import { cancelJob } from '@/adapters/api'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/shared/lib/cn'
import { useChatStore, useLoadJobData, selectResolvedDeepResearchJobId } from '@/features/chat'
import { useAuth } from '@/adapters/auth'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { SourceStrip } from '@/shared/components/Sources/SourceStrip'
import { mapCitationSource } from '@/shared/components/Sources/source-utils'
import { splitReferences } from '@/shared/components/Sources/parse-references'
import { useLayoutStore } from '../store'
import { TasksTab } from './TasksTab'
import { ThinkingTab } from './ThinkingTab'
import { ReportTab } from './ReportTab'
import { FileCard } from './FileCard'
import { getRailPanelLabel } from './DeepResearchRail'
import type { RightPanelType } from '../types'

/** Rail panels rendered by this component (Data Sources lives in its own panel). */
const PANEL_TABS = new Set<RightPanelType>(['research', 'thinking', 'citations', 'artifacts'])

/** Panels that read replayed stream data (citations, files, steps). */
const STREAM_BACKED_TABS = new Set<RightPanelType>(['thinking', 'citations', 'artifacts'])

/** Wide panels get more room for their rich content. */
const WIDE_TABS = new Set<RightPanelType>(['research', 'thinking'])

/** Fallback timeout: if the SSE stream doesn't deliver the interrupted
 *  status within this window after cancel, clean up the UI optimistically. */
const CANCEL_FALLBACK_TIMEOUT_MS = 5000

interface ResearchPanelProps {
  /** Content to display in the report view */
  children?: ReactNode
  /** Whether the user is authenticated */
  isAuthenticated?: boolean
}

/**
 * Report's cited sources, reusing the same data the report renders: parsed
 * trailing references when present, otherwise the deep-research citations.
 */
const CitationsView: FC = () => {
  const { reportContent, deepResearchCitations } = useChatStore(
    useShallow((s) => ({
      reportContent: s.reportContent,
      deepResearchCitations: s.deepResearchCitations,
    }))
  )

  const sources = useMemo(() => {
    const reportContentStr = typeof reportContent === 'string' ? reportContent : ''
    const split = splitReferences(reportContentStr)
    if (split.sources.length > 0) return split.sources
    return (deepResearchCitations ?? []).map(mapCitationSource)
  }, [reportContent, deepResearchCitations])

  if (sources.length === 0) {
    return (
      <Flex direction="col" align="center" justify="center" className="h-full py-8 text-center">
        <DocumentCheckmark className="text-subtle mb-3 h-8 w-8" />
        <Text kind="body/regular/md" className="text-subtle">
          Cited sources will appear here.
        </Text>
      </Flex>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <SourceStrip sources={sources} />
    </div>
  )
}

/**
 * Generated artifacts/files produced by the deep-research flow.
 */
const ArtifactsView: FC = () => {
  const deepResearchFiles = useChatStore((s) => s.deepResearchFiles)

  if (!deepResearchFiles || deepResearchFiles.length === 0) {
    return (
      <Flex direction="col" align="center" justify="center" className="h-full py-8 text-center">
        <ImageIcon className="text-subtle mb-3 h-8 w-8" />
        <Text kind="body/regular/md" className="text-subtle">
          Artifacts will appear here.
        </Text>
      </Flex>
    )
  }

  return (
    <Flex direction="col" gap="2" className="h-full overflow-y-auto">
      {deepResearchFiles.map((file) => (
        <div key={file.id} className="shrink-0">
          <FileCard file={file} />
        </div>
      ))}
    </Flex>
  )
}

/**
 * Thinking view: the reasoning/steps trace, with the observed workflow Task
 * progress folded in as a collapsible disclosure above it (shown only when
 * there is progress to display). This is where the former Tasks tab now lives.
 */
const ThinkingView: FC = () => {
  const { deepResearchAgents, deepResearchTodos } = useChatStore(
    useShallow((s) => ({
      deepResearchAgents: s.deepResearchAgents,
      deepResearchTodos: s.deepResearchTodos,
    }))
  )
  const [showTasks, setShowTasks] = useState(false)
  const hasTaskProgress = deepResearchAgents.length > 0 || deepResearchTodos.length > 0

  return (
    <Flex direction="col" gap="3" className="h-full min-h-0">
      {hasTaskProgress && (
        <Flex direction="col" gap="2" className="border-base shrink-0 border-b pb-3">
          <button
            type="button"
            onClick={() => setShowTasks((v) => !v)}
            aria-expanded={showTasks}
            className="text-secondary hover:text-primary flex cursor-pointer items-center gap-1.5 self-start transition-colors"
          >
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            <Text kind="body/regular/sm">Task progress</Text>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${showTasks ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {showTasks && (
            <div className="max-h-64 overflow-y-auto">
              <TasksTab />
            </div>
          )}
        </Flex>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ThinkingTab />
      </div>
    </Flex>
  )
}

/**
 * The Deep Research content panel, driven by the rail selection.
 */
export const ResearchPanel: FC<ResearchPanelProps> = memo(function ResearchPanel({
  children,
  isAuthenticated = false,
}) {
  const rightPanel = useLayoutStore((s) => s.rightPanel)
  const closeRightPanel = useLayoutStore((s) => s.closeRightPanel)
  const isOpen = PANEL_TABS.has(rightPanel)

  const isDeepResearchStreaming = useChatStore((s) => s.isDeepResearchStreaming)
  const deepResearchJobId = useChatStore(selectResolvedDeepResearchJobId)
  const { loadResearchPanelTab, importStreamOnly, isLoading: isStreamLoading } = useLoadJobData()
  const { idToken } = useAuth()

  const prefersReducedMotion = useReducedMotion()
  const cancelFallbackRef = useRef<NodeJS.Timeout | null>(null)
  const loadKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (cancelFallbackRef.current) {
        clearTimeout(cancelFallbackRef.current)
        cancelFallbackRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !isOpen || !deepResearchJobId || isStreamLoading) return
    const key = `${rightPanel}:${deepResearchJobId}`
    if (loadKeyRef.current === key) return
    loadKeyRef.current = key
    if (rightPanel === 'research') {
      void loadResearchPanelTab(deepResearchJobId, 'report')
    } else if (STREAM_BACKED_TABS.has(rightPanel)) {
      void importStreamOnly(deepResearchJobId)
    }
  }, [
    isAuthenticated,
    isOpen,
    rightPanel,
    deepResearchJobId,
    isStreamLoading,
    loadResearchPanelTab,
    importStreamOnly,
  ])

  const handleClose = useCallback(() => {
    closeRightPanel()
  }, [closeRightPanel])

  const handleStopResearch = useCallback(async () => {
    if (!deepResearchJobId) return
    const cancelledJobId = deepResearchJobId
    try {
      await cancelJob(cancelledJobId, idToken || undefined)

      if (cancelFallbackRef.current) clearTimeout(cancelFallbackRef.current)
      cancelFallbackRef.current = setTimeout(() => {
        cancelFallbackRef.current = null
        const state = useChatStore.getState()
        if (!state.isDeepResearchStreaming || state.deepResearchJobId !== cancelledJobId) {
          return
        }
        console.warn(
          '[ResearchPanel] Cancel fallback: SSE did not deliver interrupted status. Cleaning up locally.'
        )
        state.stopAllDeepResearchSpinners()
        const ownerConvId = state.deepResearchOwnerConversationId
        const messageId = state.activeDeepResearchMessageId
        const hasReport = Boolean(state.reportContent?.trim())
        if (ownerConvId && messageId) {
          state.patchConversationMessage(ownerConvId, messageId, {
            content: '',
            deepResearchJobStatus: 'interrupted',
            isDeepResearchActive: false,
            showViewReport: hasReport,
          })
        }
        state.addDeepResearchBanner('cancelled', cancelledJobId, ownerConvId || undefined)
        state.completeDeepResearch()
        state.setStreaming(false)
      }, CANCEL_FALLBACK_TIMEOUT_MS)
    } catch (error) {
      console.error('Failed to cancel job:', error)
    }
  }, [deepResearchJobId, idToken])

  const isWide = WIDE_TABS.has(rightPanel)
  const openWidth = isWide ? 'calc(60%)' : '420px'
  const panelLabel = getRailPanelLabel(rightPanel)

  return (
    <div
      data-testid="research-panel"
      className={cn('border-base bg-surface-base h-full shrink-0 overflow-hidden', isOpen && 'border-l')}
      style={{
        width: isOpen ? openWidth : '0px',
        minWidth: isOpen ? (isWide ? '480px' : '420px') : '0px',
        transition: prefersReducedMotion
          ? 'none'
          : 'width 400ms ease-in-out, min-width 400ms ease-in-out',
      }}
      aria-hidden={!isOpen}
    >
      <Flex
        direction="col"
        className="h-full w-full"
        style={{
          visibility: isOpen ? 'visible' : 'hidden',
          opacity: isOpen ? 1 : 0,
          transition: prefersReducedMotion
            ? 'none'
            : isOpen
              ? 'opacity 100ms ease-in-out, visibility 0ms'
              : 'opacity 100ms ease-in-out 300ms, visibility 0ms 400ms',
        }}
      >
        {/* Header: active item name + optional stop + close */}
        <Flex
          align="center"
          justify="between"
          className="border-base h-[var(--header-height)] shrink-0 border-b px-6"
        >
          <Text kind="label/semibold/md" className="text-primary truncate">
            {panelLabel}
          </Text>
          <Flex align="center" gap="2">
            {isDeepResearchStreaming && (
              <Button
                kind="tertiary"
                size="small"
                onClick={handleStopResearch}
                aria-label="Stop researching"
                title="Stop researching"
                data-testid="research-panel-stop"
              >
                <StopCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                Stop Researching
              </Button>
            )}
            <Button
              kind="tertiary"
              size="small"
              onClick={handleClose}
              aria-label={`Close ${panelLabel || 'panel'}`}
              title="Close panel"
              data-testid="research-panel-close"
            >
              <Close className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Flex>
        </Flex>

        {/* Body */}
        <Flex direction="col" className="flex-1 overflow-hidden px-6 py-5">
          {isStreamLoading ? (
            <Flex direction="col" align="center" justify="center" className="h-full gap-4">
              <Spinner size="medium" aria-label="Loading research data" />
              <Text kind="body/regular/md" className="text-tertiary">
                {rightPanel === 'research' ? 'Loading report...' : 'Loading research data...'}
              </Text>
            </Flex>
          ) : rightPanel === 'research' ? (
            <ReportTab>{children}</ReportTab>
          ) : rightPanel === 'thinking' ? (
            <ThinkingView />
          ) : rightPanel === 'citations' ? (
            <CitationsView />
          ) : rightPanel === 'artifacts' ? (
            <ArtifactsView />
          ) : null}
        </Flex>
      </Flex>
    </div>
  )
})
