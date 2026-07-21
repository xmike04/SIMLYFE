# Git forensics cheat sheet

| Question | Command |
|---|---|
| When did this line change, and why? | `git blame -w -C <file>` → `git show <sha>` |
| When did this symbol appear/disappear? | `git log -S "symbol" --oneline -- <path>` |
| When did this *pattern* change? | `git log -G "regex" --oneline -- <path>` |
| What changed since it last worked? | `git diff <good-ref>..HEAD --stat`, then drill in |
| Which commit broke it? | `git bisect start; git bisect bad; git bisect good <ref>` with a repro command; `git bisect run <cmd>` when scriptable |
| What do past fixes here look like? | `git log --grep=fix --oneline -- <path>` (prior failure modes cluster) |
| Who else touches this file together? | `git log --format='%h' -- <file> \| head` → `git show --stat` (co-change partners reveal hidden mirrors) |
| Was it a merge interaction? | `git log --merges --oneline -- <path>`; check both parents |
| Renames hiding history? | add `--follow` to `git log -- <file>` |

Habits:
- Blame the *last known good* version too (`git blame <good-ref> -- <file>`) — the current
  blame may show an innocent reformat commit.
- `-w` ignores whitespace; `-C` tracks copied code. Without them blame lies.
- Read the commit *message and diff together*; a "fix:" message plus its diff documents a
  failure mode the codebase already met once — the same class often recurs.
- Bisect needs a fast, deterministic repro; invest in the repro before bisecting.
