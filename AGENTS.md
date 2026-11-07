# Agent instructions

This project's agent skills live in `.claude/skills/<skill>/SKILL.md` (Claude Code loads them automatically).
Other agents (Codex, Cursor, Copilot, …): read `CLAUDE.md`, then open the matching SKILL.md and follow it:

- `.claude/skills/qa-autotest/SKILL.md` (entry point — start here for general requests)
- `.claude/skills/website-explorer/SKILL.md`
- `.claude/skills/testcase-generator/SKILL.md`
- `.claude/skills/playwright-runner/SKILL.md`
- `.claude/skills/test-maintainer/SKILL.md`
