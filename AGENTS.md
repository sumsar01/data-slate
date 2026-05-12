# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Monorepo Layout

Bun workspaces. Package manager is **Bun** — do not use npm or pnpm.

```
apps/web        # React 19 + Vite frontend (also absorbs recorder functionality)
apps/api        # Hono web framework on Bun (backend)
packages/shared # Shared types/utils (@data-slate/shared)
```

## Commands

```bash
bun install                          # Install all workspace deps

# Web (apps/web)
bun run dev:web                      # Vite dev server with HMR
bun run build:web                    # tsc -b && vite build (typecheck + build)
bun run --cwd apps/web lint          # ESLint

# API (apps/api)
bun run dev:api                      # bun --watch src/index.ts
bun run --cwd apps/api start         # Production start
```

- No standalone typecheck script — `tsc -b` runs as part of `build`.
- No Prettier configured.
- No global test command — no tests exist yet.
- ESLint uses v10 flat config (`eslint.config.js`) — no `.eslintrc`.

## Infrastructure (API)

- **Database:** Turso (libsql) — `libsql://dataslate-sumsar01.aws-eu-west-1.turso.io`
- **Storage:** Cloudflare R2 (S3-compatible) — bucket `data-slate`
- **LLM:** Groq SDK

Environment variables are in `apps/api/.env` (see `apps/api/.env.example`).

## Deployment

- `apps/web` → Vercel
- `apps/api` → Railway (also has `Dockerfile` and `nixpacks.toml`)

No CI/CD workflows configured (no `.github/workflows/`).

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
