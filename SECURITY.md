# Security and Privacy

Codex Monitor Desktop is designed as a local, read-only monitor for Codex activity.

## Sensitive Data Boundaries

The app must not read, commit, display, or upload:

- `.codex/auth.json`
- API tokens or provider credentials
- `.env` files
- raw long prompt text
- local rollout files outside the sanitized runtime fields used by the monitor
- generated QA screenshots or local build artifacts
- public issue attachments containing `state_5.sqlite`, rollout JSONL files, raw prompts, credentials, or prompt-bearing screenshots

## Reporting Issues

For public security or privacy issues, open a GitHub issue with a minimal description and avoid including secrets, raw prompts, screenshots with prompt text, SQLite state files, or rollout JSONL files. If the issue requires sensitive details, first describe the class of problem and request a private exchange path from the maintainer.

## Maintainer Checklist

- Keep provider reads local and read-only.
- Prefer event types, timestamps, tool names, and sanitized summaries over raw message bodies.
- Run `npm run test:codex-provider-privacy` and `npm run test:public-repo-boundary` before release.
