# HW4 — Phase 0-9 Monitoring Checklist

Cheat sheet для отслеживания прогресса Claude Code по фазам сборки пайплайна. После каждой фазы Claude Code должен сделать коммит и one-line summary.

---

## Pre-flight (до запуска)

- [ ] `cd ~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering`
- [ ] `git status` чистый, ветка `homework-4-submission`
- [ ] `which claude` → возвращает путь
- [ ] `claude /status` → залогинен
- [ ] Спека и kickoff закоммичены (сейчас они uncommitted/untracked — закоммить до старта Claude Code)
- [ ] `node --version` ≥ 20

---

## Risks/findings (прочитай перед стартом)

### 🟥 БЛОКЕР: спека не задаёт `--permission-mode` для `claude -p`

В §6.4 `claude-runner.ts` собирает `args` без `--permission-mode`. Bug-fixer и Test-generator используют Edit/Write — в non-interactive mode без `--permission-mode acceptEdits` (или `--dangerously-skip-permissions`) subprocess либо повиснет на запросе разрешения, либо упадёт. **Скажи Claude Code на Phase 6 добавить `--permission-mode acceptEdits` в args** (или `bypassPermissions`, если хочешь полностью без вопросов).

### 🟧 Проверить: модели `claude-opus-4-8` и `claude-sonnet-4-6`

Спека прибита к этим строкам. Если CLI их не принимает (например, актуальный Opus сейчас `claude-opus-4-6`), вся Phase 10 встанет. **Проверь `claude -p --model claude-opus-4-8 "hi"` и `claude -p --model claude-sonnet-4-6 "hi"` до Phase 10.** Если не работают — замени строки в `agents/*.agent.md` и в `MODELS` enum.

### 🟧 TASKS.md упоминает `homework-5/` в Expected Project Structure

Это явная опечатка в брифе курса (наследие предыдущей домашки). Реальный путь — `homework-4/`. Claude Code должен идти по фактическому пути; если он спросит — подтверди `homework-4/`.

### 🟨 Спека сейчас uncommitted

`git status` показывает modified спеку и untracked kickoff. Закоммить их в Phase 0, иначе Claude Code будет работать поверх unsaved state.

---

## Phase 0 — Scaffold

**Что должно появиться:**
- `homework-4/package.json` (deps: vitest, gray-matter, zod, dotenv, pino, tsx — **БЕЗ @anthropic-ai/sdk**)
- `homework-4/tsconfig.json`
- Скелет папок: `agents/ skills/ scripts/pipeline/ src/jwt/ tests/{pipeline,fixtures,jwt-verifier} context/bugs/ docs/{reviews,screenshots,specs}`
- `.gitignore`, `.env.example` (без ANTHROPIC_API_KEY)

**Smoke test:** `cd homework-4 && tsx scripts/run-pipeline.ts --bug nonexistent` → exit code 2 с сообщением `Bug not found: ...`

**Red flags:**
- Появился `@anthropic-ai/sdk` в deps — это старый план, новый план через `claude -p` subprocess
- Упоминание `ANTHROPIC_API_KEY` где-либо
- Файлы вне `homework-4/`

**Commit:** `feat(phase-0): scaffold homework-4 project structure`

---

## Phase 1 — Skills

**Что должно появиться:**
- `skills/research-quality-measurement.md` с секциями `## Levels` (L0–L4), `## Application`, `## Required output sections`
- `skills/unit-tests-FIRST.md` с таблицей F/I/R/S/T, `## Application`, `## Required output sections`

**Проверка:** оба файла содержат все три обязательных заголовка (`validateSkillStructure` потребует).

**Red flags:** sketch вместо полного контента; не указаны Levels/Categories.

**Commit:** `docs(phase-1): add research-quality and FIRST skills`

---

## Phase 2 — Sample JWT app

**Что должно появиться:**
- `src/jwt/verifier.ts` с Bug 001 (`if (header.alg === 'none') return { valid: true, claims: payload }`)
- `src/jwt/claims.ts` с Bug 002 (`payload.exp < now` вместо `<=`)
- `src/jwt/signature.ts` с Bug 003 (`signature === expected`)
- `src/jwt/decoder.ts` возвращает `{ rawHeader, rawPayload, signature, header, payload }` — критично, §5.7
- `src/index.ts` CLI entry
- `src/types.ts` с `DecodedToken` интерфейсом

**Smoke test:** `npm run cli -- verify <любой-jwt>` отрабатывает без crash.

**Red flags:**
- Decoder возвращает только `{ header, payload }` без `rawHeader/rawPayload` — сломает подпись
- Use `jsonwebtoken` или другой dep вместо node:crypto

**Commit:** `feat(phase-2): JWT verifier CLI with 3 seeded issues`

---

## Phase 3 — Baseline tests + fixtures

**Что должно появиться:**
- `tests/jwt-verifier.test.ts` — 5 тестов
- `tests/jwt-fixtures.ts` — helpers (signedToken, unsignedToken, now)
- `tests/fixtures/{valid,alg-none,expired}-token.txt`
- `scripts/generate-fixtures.ts`

**Smoke test:** `npm test` → **3 failing, 2 passing** (Bug 001/002/003 failing as expected).

**Red flags:**
- Все тесты зелёные — значит тесты не покрывают баги
- `vi.useFakeTimers()` без парного `vi.useRealTimers()` в afterEach (нарушает FIRST Independent — это worked example для skill)

**Commit:** `test(phase-3): baseline JWT tests + fixtures`

---

## Phase 4 — Bug context files

**Что должно появиться:**
- `context/bugs/001-alg-none-bypass/bug-context.md`
- `context/bugs/002-expiration-off-by-one/bug-context.md`
- `context/bugs/003-timing-attack-signature/bug-context.md`

Каждый файл: Symptom, Reproduction, Suspected severity, Hint (§5.6).

**Commit:** `docs(phase-4): seed 3 bug context files`

---

## Phase 5 — Loaders + validators

**Что должно появиться:**
- `scripts/pipeline/agent-loader.ts` (Zod schema, `MODELS`/`TOOLS` enums)
- `scripts/pipeline/skill-loader.ts` (`validateSkillStructure`)
- `scripts/pipeline/validators.ts` (`validateAgentSkillRefs`, `checkSystemDependencies` проверяет `claude`, `git`, `npx`)
- Unit-тесты для всех трёх

**Smoke test:** `npm test tests/pipeline/agent-loader.test.ts` → зелёный. Фикстура с битым model должна выдать Zod fail.

**Red flags:**
- `checkSystemDependencies` не проверяет `claude` CLI presence
- `TOOLS` enum включает `Bash` (не должен — по спеке только Read/Grep/Edit/Write)

**Commit:** `feat(phase-5): agent/skill loaders + startup validators`

---

## Phase 6 — Claude runner + messages

**Что должно появиться:**
- `scripts/pipeline/claude-runner.ts` (~40 LOC, `execFile('claude', args, { input: userMessage })`)
- `scripts/pipeline/messages.ts` (`buildUserMessage` с XML-тегами)
- Тесты с моком `node:child_process`

**🟥 ВАЖНО:** args должны включать `--permission-mode acceptEdits` (см. risks выше). Если Claude Code забудет — попроси добавить.

**Проверочные пункты в args:**
- `['-p', '--model', spec.model, '--append-system-prompt', systemPrompt, '--allowed-tools', spec.tools.join(','), '--permission-mode', 'acceptEdits']`
- userMessage через stdin (НЕ argv) — длина может превысить лимит shell
- Timeout 5 минут
- maxBuffer 10MB
- ENOENT → friendly install hint

**Smoke test:** `npm test tests/pipeline/claude-runner.test.ts` → 6 тестов зелёные.

**Red flags:**
- userMessage передаётся через argv (сломается на длинных промптах)
- Нет timeout — может висеть бесконечно
- ENOENT не отличается от прочих ошибок

**Commit:** `feat(phase-6): claude subprocess runner + message builder`

---

## Phase 7 — Stages

**Что должно появиться:**
- `scripts/pipeline/stages.ts` (~120 LOC)
- Sequential 1-4 → `await runStage(...)`, throw stops pipeline
- Parallel 5-6 → `Promise.allSettled` (НЕ `Promise.all`)
- Между 4 и 5: orchestrator запускает `npm test` (НЕ агент), результат пишет в `fix-summary.md`
- После 6: ещё раз `npm test`, результат пишет в `test-report.md`
- `gitDiffNames('src/')` для списка изменённых файлов

**Smoke test:** unit-тесты для stages, включая «security падает → testgen всё равно отрабатывает».

**Red flags:**
- `Promise.all` вместо `Promise.allSettled` (одна ошибка убьёт обе)
- Bug-fixer падение НЕ останавливает пайплайн (должно — это stage 4 sequential)
- npm test failure после bug-fixer **останавливает** пайплайн (НЕ должно — пишем результат, продолжаем)

**Commit:** `feat(phase-7): pipeline stages orchestration`

---

## Phase 8 — Run-pipeline entry

**Что должно появиться:**
- `scripts/run-pipeline.ts` — парсит `--bug`, вызывает `checkSystemDependencies`, `loadAllAgents`, `loadAllSkills`, `validateAgentSkillRefs`, `runStages`
- Exit codes: 0 success, 1 stage failure, 2 pre-flight

**Smoke test:**
- `tsx scripts/run-pipeline.ts` (без флагов) → exit 2 с usage
- `tsx scripts/run-pipeline.ts --bug nonexistent` → exit 2 с `Bug not found`

**Commit:** `feat(phase-8): pipeline CLI entry point`

---

## Phase 9 — 6 .agent.md файлов 🚪 GATE

**🚦 Claude Code должен остановиться и спросить тебя.**

**Что должно появиться (по спеке §3.3):**

| Файл | model | tools | skills |
|---|---|---|---|
| `agents/researcher.agent.md` | `claude-sonnet-4-6` | `[Read, Grep]` | — |
| `agents/research-verifier.agent.md` | `claude-opus-4-8` | `[Read, Grep]` | `[research-quality-measurement]` |
| `agents/planner.agent.md` | `claude-sonnet-4-6` | `[Read, Grep]` | — |
| `agents/bug-fixer.agent.md` | `claude-sonnet-4-6` | `[Read, Grep, Edit, Write]` | — |
| `agents/security-verifier.agent.md` | `claude-opus-4-8` | `[Read, Grep]` | — |
| `agents/unit-test-generator.agent.md` | `claude-sonnet-4-6` | `[Read, Grep, Write]` | `[unit-tests-FIRST]` |

**Что ревьюить в каждом промпте:**
- frontmatter валидный (все required поля, `model_justification` конкретный)
- prompt body содержит **обязательные секции выхода** (§3.4)
- Не упомянуты лишние инструменты (например, Bash там, где не нужен)
- Research-verifier и Test-generator явно ссылаются на свою skill

**Smoke test:** `tsx scripts/run-pipeline.ts --bug nonexistent` — loadAllAgents должен пройти без Zod ошибок, validateAgentSkillRefs тоже.

**После approve:** `feat(phase-9): add 6 agent definitions with prompts`

---

## Что НЕ делать в фазах 0-9

- Не запускать `claude -p` против реальных API (это Phase 10)
- Не править `src/jwt/*.ts` через bug-fixer (это Phase 10)
- Не создавать `tests/jwt-verifier/<bug>.test.ts` — это сделает Test Generator в Phase 10

---

## После Phase 9 → готовность к Phase 10

Перед approve Phase 10 двойной проверь:
- [ ] `npm test` зелёный (включая ~30 orchestrator тестов с мокнутым subprocess)
- [ ] `npm run lint` чистый
- [ ] `claude /status` залогинен
- [ ] Модели `claude-opus-4-8` и `claude-sonnet-4-6` приняты (тест: `claude -p --model claude-opus-4-8 "ok"`)
- [ ] Baseline тесты: 3 failing / 2 passing
- [ ] Все 6 `.agent.md` загружаются без ошибок

Phase 10 займёт **~30 минут wall-time** на 3 бага. Не запускай не убедившись.
