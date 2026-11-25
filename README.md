[![make.fun](https://make.fun/badge/u-motasimfuad-have-you-tried-turning-it-off-154a938b.svg)](https://make.fun/bounty/u-motasimfuad-have-you-tried-turning-it-off-154a938b?utm_source=github&utm_medium=readme&utm_campaign=u-motasimfuad-have-you-tried-turning-it-off-154a938b)
[![rank](https://make.fun/badge/u-motasimfuad-have-you-tried-turning-it-off-154a938b/qw123gyj-dev/u-motasimfuad-have-you-tried-turning-it-off-154a938b/rank.svg)](https://make.fun/bounty/u-motasimfuad-have-you-tried-turning-it-off-154a938b/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-motasimfuad-have-you-tried-turning-it-off-154a938b)
[![reward](https://make.fun/badge/u-motasimfuad-have-you-tried-turning-it-off-154a938b/qw123gyj-dev/u-motasimfuad-have-you-tried-turning-it-off-154a938b/reward.svg)](https://make.fun/bounty/u-motasimfuad-have-you-tried-turning-it-off-154a938b?utm_source=github&utm_medium=readme&utm_campaign=u-motasimfuad-have-you-tried-turning-it-off-154a938b)

# Have You Tried Turning It Off?

A deterministic entry picker for the make.fun bounty "Have You Tried Turning It Off?". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: a funny single line from a hopeless tech support agent to a desperate customer; an unexpected twist where the agent's cheerful uselessness is the humour and the customer is never the butt of it; a line a real support agent would actually say, with the customer's desperation felt rather than explained; tight wording inside the 200 character limit; and a fresh angle that twists the turn-it-off-and-on-again classic rather than repeating it — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–199 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only states the classic with no turn is capped, the twist must land inside the last six words, the humour has to come from the agent being happily no help at all, and any line that mocks the customer loses points; ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> Have you tried turning it off and on again? If that doesn't work, I'll escalate this to Tier 2, where they'll ask you to turn it off and on again.

It twists the classic by looping it: the "fix" is escalated to Tier 2, where the customer will be asked to do the exact same thing — cheerful uselessness, and the punchline lands in the final words.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/turning-it-off-out node main.ts
cat /tmp/turning-it-off-out/entry.txt
```
