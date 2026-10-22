# Public website maintenance

- This is a public static website, not an AI agent tool. Do not register this website as a global skill or MCP server.
- Never commit credentials, browser profiles, raw source responses, full transcripts, audio/video files, personal email addresses or machine-specific absolute paths.
- Use only the completed editorial report input explicitly supplied by the maintainer. Do not collect fresh account data or invoke a model merely to build/publish this website.
- Keep the publication whitelist in `scripts/site.mjs` and the output/path audit in `scripts/validate.mjs`. Do not replace these with recursive copying of the input directory.
- Run tests, build with a private input directory, and validate `docs/` before publishing. Preserve user changes and never force-push.
- Use repository-local GitHub noreply author identity. Do not modify global Git or SSH configuration.
- Keep all site URLs compatible with a project-site path prefix. Check homepage, archive, report, CSS/JS and RSS after deployment.
- Network retries must follow the caller's approved policy. Do not disable certificate or SSH host-key verification.
- Codex companion integration (2026-10-22): read HANDOFF_CODEX.md and CHANGELOG.md before changing it. Keep the entry in the TOP-RIGHT navigation and preserve the monitor/main editorial layouts. Canonical monitor sources live in the independent project; docs/codex/index.html is generated from its explicit public.html export with short excerpts, never raw responses.
- Publication authorization updated on 2026-10-22: after the initial local-only handoff, the user explicitly asked the daily-report task to review and publish this integration to GitHub. Use the normal reviewed commit/push/Pages workflow; preserve unrelated changes and never bypass the publisher's clean-worktree gate. This does not authorize publishing the independent monitor's private project tree.
