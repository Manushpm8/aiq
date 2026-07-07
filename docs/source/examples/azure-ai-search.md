<!--
SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
SPDX-License-Identifier: Apache-2.0
-->

# Example: Azure AI Search knowledge layer

Use Azure AI Search as the document store while retaining AI-Q's existing
upload API, per-conversation collection routing, document summaries, and
citations. This example assumes the Azure AI Search service and embedding
endpoint already exist; it does not deploy Azure infrastructure.

## Prerequisites

- Create or select an [Azure AI Search service](https://learn.microsoft.com/azure/search/search-create-service-portal).
- Choose a tier whose [document and storage limits](https://learn.microsoft.com/azure/search/search-limits-quotas-capacity)
  cover the expected data volume. AI-Q stores logical collections in one physical index.
- Copy the service endpoint from the Azure portal. For key authentication, also copy an admin key. Otherwise,
  [enable role-based access](https://learn.microsoft.com/azure/search/keyless-connections) and assign the roles below.

Install the backend dependency:

```bash
uv pip install -e "sources/knowledge_layer[azure_ai_search]"
```

Set the environment used by the adapter:

```bash
export AZURE_SEARCH_ENDPOINT=https://<service>.search.windows.net
export NVIDIA_API_KEY=<embedding-api-key>
# Optional; omit to use DefaultAzureCredential.
export AZURE_SEARCH_API_KEY=<search-admin-key>
```

## Grant managed identity access

When `AZURE_SEARCH_API_KEY` is absent, enable role-based access on the Azure AI
Search service and grant the workload identity both of these built-in roles:

| Role | Used for |
|------|----------|
| `Search Service Contributor` | Create and inspect the shared AI-Q index. |
| `Search Index Data Contributor` | Upload, query, and delete index documents. |

Assign the roles at the search-service scope. The principal ID is the object ID
of the system-assigned or user-assigned managed identity running AI-Q.


Replace the `knowledge_search` block in a web configuration such as
`configs/config_web_default_llamaindex.yml`:

```yaml
functions:
  knowledge_search:
    _type: knowledge_retrieval
    backend: azure_ai_search
    collection_name: ${COLLECTION_NAME:-aiq_default}
    top_k: 5

    generate_summary: true
    summary_model: summary_llm
    summary_db: ${AIQ_SUMMARY_DB:-sqlite+aiosqlite:///./summaries.db}
```

Explicit YAML options override environment defaults. `AZURE_SEARCH_API_KEY`
selects API-key authentication when present; otherwise the adapter uses
`DefaultAzureCredential`. Set `AZURE_CLIENT_ID` to select a user-assigned
identity. Embeddings share `AIQ_EMBED_BASE_URL`, `AIQ_EMBED_MODEL`, and
`NVIDIA_API_KEY` with the LlamaIndex backend. Azure-specific optional settings
are `AIQ_EMBED_DIM` and `AIQ_AZURE_SEARCH_INDEX_PREFIX`. The prefix must uniquely
identify one AI-Q deployment when a search service is shared.

Changing the embedding model or dimension selects a different physical index
and requires re-ingestion. Frontend WebSocket queries use the conversation ID
as the collection; direct API tests must supply equivalent context or query the
configured fallback collection.

The backend stores collection, file, and chunk records in one physical index
selected by `azure_search_index_prefix`, schema version, embedding model, and
dimension. Every operation applies internal collection filters. Retrieval is
always hybrid, and ingestion uses fixed 1024-token chunks with 128-token
overlap. Schema-version-1 indexes are ignored and must be re-ingested. File IDs
returned by upload are authoritative for status and delete operations;
same-name uploads coexist independently.
