# Launch Claude Code — HW4

## 1. Закоммить спеку и kickoff (сейчас они uncommitted)

```bash
cd ~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering
git add homework-4/docs/specs/
git commit -m "docs(homework-4): spec + kickoff prompt + monitoring checklist"
```

## 2. Pre-flight

```bash
which claude && claude /status            # должен показать залогиненного юзера
claude -p --model claude-opus-4-8   "ok"  # проверка модели — если ошибка, замени строки в спеке
claude -p --model claude-sonnet-4-6 "ok"
node --version                            # ≥ 20
git branch --show-current                 # homework-4-submission
```

## 3. Запуск Claude Code

Открой Claude Code в корне репо:

```bash
cd ~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering
claude
```

Затем в открывшейся сессии вставь содержимое:

```
homework-4/docs/specs/claude-code-kickoff-prompt.md
```

(блок «## Prompt to paste», начиная с «You are implementing **Homework 4...** » и до «Good luck. Start with Step 1.»)

## 4. Что произойдёт дальше

Claude Code:
1. Прочитает спеку end-to-end
2. Вернётся со списком уточнений (≤10 буллетов) — **ответь и подтверди Phase 0**
3. После твоего ОК поедет phase-by-phase 0 → 8 автономно, между фазами — одна строка summary + коммит
4. **Остановится перед Phase 9** (агенты) — покажет 6 промптов на ревью
5. **Остановится перед Phase 10** (~30 мин wall-time)
6. **Остановится перед Phase 11** (codex:review)

## 5. Параллельно держи открытым

- `homework-4/docs/specs/phase-monitoring-checklist.md` — что проверять на каждой фазе
- `git log --oneline -10` — видеть прогресс коммитов

## 6. Если Claude Code застрянет

- Сломался Zod на Phase 5/9 — попроси показать невалидный файл, дай прямой fix
- Subprocess висит на Phase 10 — скорее всего забыли `--permission-mode acceptEdits` в claude-runner (см. risks в checklist)
- Модели не приняты — замени `claude-opus-4-8` → актуальная строка в `MODELS` enum и во всех `agents/*.agent.md`
