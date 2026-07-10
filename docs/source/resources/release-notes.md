<!--
SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
SPDX-License-Identifier: Apache-2.0
-->

# AI-Q 2.2 Release Notes (Unreleased)

These notes describe the release-candidate scope that is merged on the `develop`
branch. AI-Q 2.2 has not been published: there is no final `v2.2.0` tag, published
container image, or published Helm chart for this candidate yet.

## Research That Routes, Scales, and Finishes Coherently

The deep-research path now separates advisory source routing, structured planning,
concurrent evidence collection, and final synthesis. A planner produces validated
research queries, researcher workers execute independent queries concurrently and
return structured notes, and a dedicated writer synthesizes the final answer. Source
tools can also accept bounded batches of inputs. A caller's `data_sources` selection
constrains tools mapped in the data-source registry; configured unmapped tools, including
utilities, remain callable. Refer to [Deep Researcher Agent](../architecture/agents/deep-researcher.md)
and [Automatic Source Routing](../customization/tools-and-sources.md#automatic-source-routing).

The clarifier still gathers missing context and the requested output shape, but it no
longer creates or asks the user to approve a research plan. Planning is owned by the
deep-research workflow. Refer to [Clarifier Agent](../architecture/agents/clarifier.md).

The focused [`config_domain_routing_and_skills.yml`](https://github.com/NVIDIA-AI-Blueprints/aiq/blob/develop/configs/config_domain_routing_and_skills.yml)
profile demonstrates routed research with DuckDuckGo news, Polymarket, paper search,
LlamaIndex, built-in research and synthesis skills, and Modal execution. It is a
specialized profile, not a universal 2.2 default.

## Continue Working From a Completed Report

Conversation follow-up can now use the most recent completed report as durable context:

- A report question is answered against the parent report without launching new research.
- A cosmetic rewrite creates a child report-edit job in the async web/API path; the parent report is unchanged.
- A request for new evidence runs delta research with the parent report available as context.

The API also exposes an explicit report-edit endpoint. Refer to [Report Follow-up](../integration/rest-api.md#edit-a-report-report-follow-up)
for the parent/child contract, authorization behavior, and response fields.

## Skills, Sandboxes, and Durable Outputs

DeepAgents code execution now uses a provider-neutral sandbox contract. Modal creates a
fresh sandbox for each job. The experimental OpenShell profile instead attaches jobs to
one pre-provisioned named sandbox; per-job directories reduce ordinary filename
collisions but are not multi-tenant isolation. Refer to [Deep Research Sandbox](../architecture/agents/sandbox.md)
and the [Skills and Sandbox example](../examples/skills-sandbox/index.md).

Generated rich files can be harvested into durable artifact records. The metadata remains in
the job database, while bytes use SQL by default or an opt-in S3-compatible store. The
REST API can list metadata and stream content. With `REQUIRE_AUTH=true`, access is scoped
to the job's owning principal. The default no-auth mode does not enforce job ownership.
Successful sandbox `execute` calls checkpoint manifest-declared files. Success and failure
paths perform one idempotent final manifest-plus-directory scan before cleanup. Cancellation
does the final scan only when the provider is idle; a busy provider is terminated without
waiting, while artifacts from earlier checkpoints remain durable.

Each captured file emits a metadata-only `artifact.update` event. The web UI consumes those
events both live and during replay, lists the files with MIME type and size, and opens bytes
through the job-scoped artifact content endpoint. File bytes and storage credentials are not
embedded in the event.
Artifact images referenced by a report render inline in the web UI. Markdown downloads
rewrite those references to artifact content URLs, while PDF export embeds the resolved
images. The `aiq-research` skill can download all durable artifacts or create a portable
bundle containing `report.md` and an `artifacts/` directory with embedded artifact image
references rewritten to local files. Refer to [Agent Skills for Coding Harnesses](../integration/agent-skills.md#report-follow-up-and-portable-outputs).
Refer to [REST API](../integration/rest-api.md#durable-sandbox-artifacts) and
[Production Artifact Storage](../deployment/production.md#artifact-storage).

AI-Q also ships two consumer Agent Skills: `aiq-deploy` for selecting, starting, and
validating a deployment, and `aiq-research` for routed chat and async research against a
running server. The maintainer skill set has expanded with data-source, tool, release-QA,
PR, prompt/model, and CI workflows. Refer to [Agent Skills for Coding Harnesses](../integration/agent-skills.md).

## Enterprise Sources and Policy Controls

- **Per-user MCP OAuth:** A signed-in user can connect an OAuth-protected MCP source, observe its status, and reconnect when the stored token is missing or expired. Jobs resolve that user's tools from a token store shared by the API and worker. Refer to [Per-User MCP OAuth](../customization/mcp-tools.md#per-user-mcp-oauth).
- **Guardrails:** Opt-in NeMo Guardrails middleware can evaluate selected workflow, shallow-researcher, and deep-researcher input/output boundaries. Only middleware that is attached or selected by the async runner is active. Refer to [Guardrails](../customization/guardrails.md).
- **Async content encryption:** Operators can opt into static-key or Vault Transit envelope encryption for final async job output and selected `artifact.update` content fields. Refer to [Async Job Content Encryption](../deployment/content-encryption.md).
- **Knowledge and search:** OpenSearch is a first-class knowledge backend for self-hosted OpenSearch, Amazon OpenSearch Service, and Amazon OpenSearch Serverless. Paper search adds SerpAPI and SearchAPI alongside the default Serper provider, and the routed-research profile adds DuckDuckGo news and Polymarket sources. Refer to [Knowledge Layer](../customization/knowledge-layer.md) and [Configuration Reference](../customization/configuration-reference.md).

## Deployment and Observability

The repository source Helm chart now derives every namespaced resource from
`.Release.Namespace`, so `helm install -n <namespace>` and GitOps renderers no longer fall
back to a hardcoded `ns-aiq`. Keep Secrets, EKS Pod Identity associations, and other
external bindings in the same selected namespace. This source-chart change does not imply
that a 2.2 chart has been published to NGC. Refer to [Kubernetes (Helm)](../deployment/kubernetes.md).

NAT-exported async-job traces now preserve the configured workflow, task or research-batch,
named-agent, and model/tool hierarchy. Parallel researcher runs remain distinct children of
their batch span. Structural agent spans carry identity and error-type metadata without
copying LangGraph input/output state. Refer to [Observability](../deployment/observability.md#async-deep-research-trace-hierarchy).

## UX, Reliability, and Contributor Workflow

The web experience now surfaces activity from concurrent researcher workers, restores
and expires research sessions more predictably, and hardens outbound WebSocket delivery.
The clarifier gathers source context before asking a user to narrow an ambiguous request.
Summary Store database logs now mask URL passwords and omit all query parameters, keeping
credentials and query-string secrets out of initialization and lifecycle messages.
Contributor tooling adds governance checks, a product-level Agent Skill evaluation gate,
and reusable maintainer skills. AI-Q now pins NeMo Agent Toolkit 1.8.0.

## Upgrade and Configuration Guidance

1. Refresh the Python workspace with `uv sync` (or rerun `./scripts/setup.sh`) to pick up
   the NeMo Agent Toolkit 1.8.0 packages and new source-package dependencies.
2. Choose one of the nine focused profiles in [Provided Config Files](../customization/configuration-reference.md#provided-config-files).
   There is no single all-features profile. Start with the closest deployment shape and
   merge only the sections you intend to operate.
3. Treat Guardrails, per-user MCP OAuth, sandbox execution, durable artifact capture,
   S3-compatible storage, and content encryption as explicit operator choices. Their
   credentials, backing services, and trust boundaries differ.
4. When enabling encryption, use a new or empty job history, wait for old plaintext jobs
   to expire, or accept the documented forward-only read behavior. Keep the selected key
   identity stable while encrypted jobs are retained.
5. For source-chart deployments, treat `helm ... -n <namespace>` as authoritative and create
   application Secrets and external identity bindings in that same namespace.

## Current Limitations

- No checked-in configuration enables every 2.2 capability. In particular, the routed skills profile, Guardrails profile, MCP OAuth example, OpenSearch profile, and OpenShell example are separate starting points.
- Modal creates a fresh sandbox per job. The experimental OpenShell configuration uses a shared, pre-created sandbox and must not be treated as isolation between mutually untrusted jobs.
- Durable artifact capture is disabled by default. It requires a sandbox, `artifact_capture.enabled: true`, and a usable artifact store. Checkpoints run only after successful `execute` calls, terminal harvesting remains best-effort, and a busy cancellation skips the final scan; adding a sandbox does not guarantee that every generated file is persisted or embedded.
- The per-user MCP UI/API surface supports status, connect, callback, and reconnect. It does not expose disconnect, and the async worker does not refresh an expired token in place; the user reconnects before retrying the job.
- Content encryption is off by default, forward-only after enablement, and intentionally narrow. It does not encrypt checkpoints, errors, citations, todos, most event metadata, summaries, or historical plaintext final reports.

Features that are not merged into `develop` are not part of this candidate. These notes
do not claim an AI-Q public MCP server or per-job OpenShell isolation and policy attestation.
