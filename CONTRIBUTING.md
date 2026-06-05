# Contributing

Codex Monitor Desktop uses a stable release branch and a long-lived development branch.

## Branches

- `main` is the public stable release line.
- `develop` is the integration branch for verified feature work.
- Feature branches should start from `develop` and use `feature/<topic>` or `codex/<topic>`.

## Pull Requests

- Open feature PRs into `develop`.
- Open release PRs from `develop` into `main` after a verified feature batch or stable milestone.
- Keep PRs scoped. Do not include generated QA screenshots, local build outputs, `.codex` data, credentials, or local collaboration state.

## Checks

Run the relevant local checks before opening a PR:

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

For release PRs, also run:

```powershell
npm run dist
```
