# Codex Monitor Desktop

Codex Monitor Desktop is a Windows desktop app that visualizes local Codex agent activity as an animated office. It is built with Electron, Vite, React, TypeScript, and PixiJS.

The app can monitor the current workspace or switch to other local Codex workspaces discovered from Codex's local state. It renders resident agents, their current runtime status, project scope, task summary, and visual activity without connecting to a remote API.

## Privacy Model

Codex Monitor Desktop is a local, read-only monitor.

- Reads local Codex state from `state_5.sqlite` and related rollout JSONL files.
- Does not read `.codex/auth.json`, API tokens, or credential files.
- Does not upload local Codex data.
- Does not display raw long prompt text.
- Shows status, tool names, project scope, task titles, and short sanitized activity summaries.

Do not attach `state_5.sqlite`, rollout JSONL files, raw prompts, credential files, or screenshots containing sensitive prompt text to public GitHub issues.

## Features

- Project selector for current and previously active Codex workspaces.
- Resident-agent filtering so temporary asset workers and one-off helpers do not pollute the main monitor scene.
- Six runtime states: working, thinking, blocked, error, idle, and offline.
- Animated office visualization with workstation, pantry, restroom, treadmill, and walking transitions.
- Light, dark, and system theme preferences.
- Development mock provider for UI QA.

## Requirements

- Windows 10 or later.
- Node.js 20 or later for development.
- A local Codex installation with readable local session state for real monitoring.

## Development

```powershell
npm ci
npm run dev
```

Useful checks:

```powershell
npm run test:codex-project-scope
npm run test:codex-resident-agent-registry
npm run test:codex-runtime-status
npm run test:codex-provider-privacy
npm run test:packaged-asset-paths
npm run test:public-repo-boundary
npm run typecheck
npm run build
```

## Build

Build the renderer and Electron main process:

```powershell
npm run build
```

Create the Windows portable executable:

```powershell
npm run dist
```

The portable `.exe` is written to `release/`. Release artifacts are not committed to the repository.

The first public release is an unsigned Windows portable build. Verify release downloads with the SHA256 checksum attached to the GitHub Release.

## Data Providers

By default, the desktop app uses the read-only Codex provider. To run the mock provider during development:

```powershell
$env:CODEX_MONITOR_PROVIDER="mock"
npm run dev
```

## Visual QA

The browser mock client supports deterministic URL parameters for repeatable visual checks:

- `debugPaused=1` starts the mock stream paused.
- `debugAgent=Aurora&debugStatus=idle` forces one agent status.
- `debugAgents=Aurora:idle,Binary:working` forces multiple agent statuses.

Example:

```text
http://127.0.0.1:5173/?debugPaused=1&debugAgents=Aurora:idle,Binary:working,Cascade:thinking,Delta:blocked,Echo:error,Forge:offline
```

## Release Line

The public release branch is `main`. Ongoing development happens on `develop`, then verified feature batches are merged back to `main` for tagged releases.

See [docs/RELEASE_WORKFLOW.md](docs/RELEASE_WORKFLOW.md) for the release process.
