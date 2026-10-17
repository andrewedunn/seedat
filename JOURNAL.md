<!-- ABOUTME: Narrative build log of See Dat, written as raw material for a blog post, article, or thread. -->
<!-- ABOUTME: Each entry: what we tried, what we learned, and the surprising bit worth sharing. -->

# Building See Dat — journal

## 2026-10-17 — Day 1: research before code

The brief: one database for every public fact about every New Orleans property, fresher than the city's own monthly reports, with an MCP server so any AI agent can ask it questions.

The first rule we set ourselves was to write no code until we knew what already exists. One orchestrating agent fanned the work out to seven research agents running in parallel: three on prior art (New Orleans tools, other cities, commercial products) and four on the raw sources (One Stop, data.nola.gov, the city's ArcGIS servers, and the assessor and address authorities). Each wrote a file and sent back a short summary, so the orchestrator's own context stays free for the decisions.
