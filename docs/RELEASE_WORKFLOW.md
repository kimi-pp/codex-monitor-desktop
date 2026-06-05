# Release Workflow

Codex Monitor Desktop uses `main` as the stable public release branch and `develop` as the ongoing development branch.

## Initial Public Launch

1. Verify the public repository boundary.
2. Commit the launch baseline to `main`.
3. Create the public GitHub repository `kimi-pp/codex-monitor-desktop`.
4. Push `main`.
5. Create and push `develop` from `main`.
6. Configure `main` branch protection to require pull requests and CI, and disable force pushes and branch deletion.
7. Build the portable Windows executable with `npm run dist`.
8. Generate a SHA256 checksum for the portable `.exe`.
9. Create GitHub Release `v0.1.0` and upload only the portable `.exe` plus its SHA256 checksum.

## Normal Development

1. Create feature branches from `develop`.
2. Merge feature PRs into `develop` after CI passes.
3. After 2-4 verified features or a stable milestone, open a release PR from `develop` to `main`.
4. Run the release validation commands.
5. Merge the release PR, tag the release, build the portable `.exe`, and publish GitHub Release notes.

## Release Validation

```powershell
npm run test:codex-project-scope
npm run test:codex-resident-agent-registry
npm run test:codex-runtime-status
npm run test:codex-provider-privacy
npm run test:packaged-asset-paths
npm run test:public-repo-boundary
npm run typecheck
npm run build
npm run dist
```

## Public Boundary

The repository includes source code, tests, docs, and runtime assets under `public/`. It excludes `release/`, `artifacts/`, `tmp/`, `.superpowers/`, `.codex/`, `node_modules/`, build directories, logs, environment files, and local Codex collaboration records.

## Release Notes Requirements

Release notes must state whether the Windows portable build is unsigned, link the SHA256 checksum, and summarize privacy boundaries for local Codex data.
