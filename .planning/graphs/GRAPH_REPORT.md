# Graph Report - wot-gdpr-stats-visualizer  (2026-09-29)

## Corpus Check
- 43 files · ~53,458 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 143 nodes · 283 edges · 15 communities (13 shown, 2 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `781d66d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `../ui-copy.ts` - 18 edges
2. `IngestClient` - 15 edges
3. `../types/worker-messages.ts` - 14 edges
4. `sampleEntries()` - 11 edges
5. `buildSampleExport()` - 10 edges
6. `analyzeExport()` - 10 edges
7. `handleIngest()` - 9 edges
8. `listEntryPaths()` - 6 edges
9. `prepare()` - 6 edges
10. `resolveAccountRootAndCategories()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `pathsOf()` --calls--> `listEntryPaths()`  [INFERRED]
  tests/unit/classify.test.ts → src/lib/worker/zip-paths.ts
- `handleIngest()` --calls--> `analyzeExport()`  [INFERRED]
  src/lib/worker/ingest.worker.ts → src/lib/worker/classify.ts
- `handleIngest()` --calls--> `resolveCsvFileCategory()`  [INFERRED]
  src/lib/worker/ingest.worker.ts → src/lib/worker/classify.ts
- `handleIngest()` --calls--> `parseCsvFile()`  [INFERRED]
  src/lib/worker/ingest.worker.ts → src/lib/worker/csv-parse.ts
- `formatFileCount()` --calls--> `formatRowCount()`  [INFERRED]
  src/lib/components/CategoryBadge.svelte → src/lib/ui-copy.ts

## Communities (15 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (24): dropFiles(), buildBackslashExport(), buildDirectoryEntriesExport(), buildEmptyZip(), buildFilesOnlyUnderRootZip(), buildInflateTrapExport(), buildLargeExport(), buildMacRezippedExport() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (3): precheckFiles(), IngestClient, FakeWorker

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (7): formatFileCount(), formatAccountHeading(), formatFileCount(), formatRowCount(), formatSummary(), ../types/worker-messages.ts, ../ui-copy.ts

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (11): pathsOf(), AppDb, checkCache(), clearData(), writeDataset(), digestFile(), handleCheckCache(), handleClearData() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.35
Nodes (12): classifyFolder(), analyzeExport(), categoryFoldersUnder(), classifyExport(), detectRoot(), foldersAt(), hasRecognizedCategory(), isOsMetadataEntry() (+4 more)

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `../types/worker-messages.ts` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.374) - this node is a cross-community bridge._
- **Why does `../ui-copy.ts` connect `Community 2` to `Community 0`, `Community 1`, `Community 6`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `IngestClient` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._