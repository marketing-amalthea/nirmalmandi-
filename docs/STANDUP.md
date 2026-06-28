# NirmalMandi — Daily Standup Format

## Schedule
- **Time:** 10:00–11:00 AM daily
- **Format:** I present → you validate → I execute
- **Session length:** 3–5 hours of active work after validation

---

## Standup Template (what I present at 10 AM)

```
## NirmalMandi Daily Standup — [DATE]

### Yesterday's output
- ✅ [Feature] [Portal] — what was built, committed as [hash], deployed
- ✅ [Feature] [Portal] — what was fixed
- ❌ [Feature] — blocked by X, needs Y

### Today's plan
Phase: [Phase 1/2/3]
Feature: [Feature name]
Portals: [Seller / Buyer / Admin]

Tasks:
1. [Specific task — file to create/edit, endpoint to build]
2. [...]
3. [...]

Tests to write:
- [test case]

QA checklist to verify after deploy:
- [ ] Seller can do X
- [ ] Admin can see Y
- [ ] Buyer can Z

Estimated time: [X hours]
Heavy token usage needed: YES / NO
If YES: [what agent, why, expected output]

### Blockers
- [anything blocking today's work]
```

---

## Validation response (what you say)
- **"Go"** = approved as planned, execute
- **"Go, skip X"** = approved but skip specific task
- **"Reprioritize: do Y first"** = change order
- **"Hold"** = wait, something needs clarification
- **"Add: also do Z"** = add to today's scope

---

## Rules
1. No heavy Opus agents without explicit "Go" with agents approved
2. Each feature fully tested before marking done
3. Commit every completed task — no uncommitted work at end of session
4. If blocked mid-session, document the blocker and move to next task
5. End of session: push everything, update FEATURE_BACKLOG.md status
