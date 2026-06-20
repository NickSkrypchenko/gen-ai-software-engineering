# Homework 6 — Порядок действий: планирование → кодогенерация в Claude Code

Планирование завершено (5 артефактов). Дальше код пишет твой Claude Code (CLI). Ниже — точная последовательность.

---

## 0. Предусловия (проверить один раз)

```bash
node -v          # ≥ 22  (у тебя v22.x — ок)
which claude     # путь к Claude Code CLI
claude /status   # должен показать залогиненного пользователя
```

Если `claude` не установлен/не залогинен — поставить и `claude /login` перед шагом 1.

---

## 1. Установить context7 (до кодогенерации — Agent 2 им пользуется в Phase 2/4)

**Вариант A — CLI, user-scope (доступен во всех проектах) — рекомендую:**

```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp@latest
```

API-ключ **необязателен** — без него работает, но с rate-limit. Если упрёшься в лимит: бесплатный ключ на context7.com/dashboard и добавь его:

```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp@latest --api-key ТВОЙ_КЛЮЧ
```

**Вариант B — через plugin-marketplace (внутри сессии Claude Code):**

```
/plugin marketplace add upstash/context7
/plugin install context7@context7-marketplace
```

**Проверка:**

```bash
claude mcp list        # context7 должен появиться в списке
```

В сессии Claude Code должны стать доступны тулы `resolve-library-id` и `get-library-docs`.

> Это регистрация context7 на уровне **самого Claude Code** — чтобы Agent 2 мог делать запросы во время кодогенерации. Это **не то же самое**, что файл-деливерабл `homework-6/mcp.json` (формат из TASKS.md) — его кодогенерация создаёт в Phase 4, и он документирует оба сервера (context7 + кастомный pipeline-status).

---

## 2. Завести ветку `homework-6-submission`

```bash
cd ~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering
git checkout main && git pull            # чистая база (поправь, если твой флоу иной)
git checkout -b homework-6-submission
```

Планинг-доки (`homework-6/specification.md`, `agents.md`, `docs/specs/*`) сейчас untracked — они переедут на новую ветку сами. Зафиксируй их первым коммитом:

```bash
# .DS_Store уже в корневом .gitignore (и не трекается) — git add его пропустит сам
git add homework-6/
git commit -m "docs(phase-1): homework-6 planning package (brainstorm, spec, agents, plan, kickoff)"
```

---

## 3. Отдать kickoff в Claude Code

```bash
cd ~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering
claude
```

Вставь **целиком блок «Prompt to paste»** из файла
`homework-6/docs/specs/claude-code-kickoff-prompt.md`
(всё, что под заголовком `## Prompt to paste` — от «You are the implementation driver…» до «Start with Step 1.»).

Claude Code сначала прочитает 4 авторитетных дока, ответит кратким restatement + проверкой окружения (`node -v`, `npx tsx`, доступность context7) и **остановится, ожидая твоего «go»** перед Phase 0.

---

## 4. Что Claude Code сделает по фазам

| Фаза | Что | Гейт/пауза |
|---|---|---|
| 0 — Scaffold | package.json, tsconfig, vitest.config, директории, `config/fx-rates.json` + `denylist.json`; `npm install` (decimal.js, fastmcp, vitest, @vitest/coverage-v8, typescript, tsx) | builds green |
| 1 — Agent 1 | создаёт `.claude/commands/write-spec.md` + dry-run self-check | файл существует |
| **→ пауза** | **спросит тебя перед Phase 2** | подтверди scaffold + context7 |
| 2 — Agent 2 | integrator + 3 агента + cores/lib + `research-notes.md` (≥2 context7-запроса) | прогон = Golden-таблица |
| 3 ∥ 4 | тесты+hook+скиллы ∥ MCP-сервер | coverage ≥90% / 3 MCP-артефакта |
| 5 — Agent 4 | README (+имя +ASCII) + HOWTORUN | — |
| 6 — PR | 5 скриншотов + PR | **спросит перед открытием PR** |

---

## 5. Чтобы снять скриншот `mcp-interaction.png` (context7 + кастомный тул)

После Phase 4 зарегистрируй и кастомный сервер в Claude Code (для живого вызова `get_transaction_status`):

```bash
claude mcp add pipeline-status -- npx tsx homework-6/mcp/server.ts
```

Тогда в одной сессии будут доступны и context7 (запрос доки), и `pipeline-status` (вызов тула) — ровно то, что требует deliverable-check Task 4.

---

## 6. Напоминания

- **5 скриншотов** снимаешь по ходу фаз: `pipeline-run`, `test-coverage` (≥80%, цель ≥90%), `skill-run-pipeline`, `hook-trigger`, `mcp-interaction`.
- **Coverage:** 80% — жёсткий пол (config + push-hook), 90% — цель; честные 85% не считаются «сломано».
- **Vercel** — stretch, отдельно после прохождения рубрики (`plan.md` §Phase S).
- Если хочешь больше автономии — убери из ground rule #4 паузу перед Phase 2.
