/**
 * Have You Tried Turning It Off? — deterministic entry picker.
 *
 * Bounty: one funny line, under 200 characters, that a hopeless
 * tech support agent says to a desperate customer. The AI judge
 * compares entries two at a time and keeps the funnier line,
 * weighing (most important first):
 *
 *   1. A funny single line from a hopeless agent to a desperate
 *      customer. 2. Unexpected twist; the agent's cheerful
 *      uselessness is the humour, the customer never the butt.
 *   3. Sounds like a real agent's line; desperation felt, not
 *      explained. 4. Tight: every word earns its place.
 *   5. Fresh, not stock; a classic must be twisted, not repeated.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt).
 * It then reads the file back and verifies it byte-for-byte against
 * every gate: 1-199 characters, a single line, valid UTF-8, and not
 * only whitespace.
 *
 * Scoring is lexicographic, mirroring the judge: "Go through the
 * criteria in order, find the first one where they differ, and let
 * that decide unless a later one differs by much more." Ties break
 * criterion by criterion in the brief's order, then by shorter
 * length — the brief says length for its own sake does not count.
 *
 * Sharpening rules on top of the flat rubric:
 *
 *   - A line that only states the classic is capped on funniness
 *     and freshness: the classic is the setup, not the joke.
 *   - The twist must land late, inside the final six words.
 *   - Cheerful uselessness is the engine: the agent is happily
 *     no help at all. An agent who solves something is a manual.
 *   - The customer is never the butt: mocking them loses points.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/** One hand-written candidate line; `id` is stable for audit. */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  { id: "classic-plain", text: "Have you tried turning it off and on again?" },
  { id: "escalate-tier2", text: "Have you tried turning it off and on again? If that doesn't work, I'll escalate this to Tier 2, where they'll ask you to turn it off and on again." },
  { id: "slower-confidence", text: "Have you tried turning it off and on again? Great \u2014 now do it once more, slower, like the computer can sense your confidence." },
  { id: "hopes-off-on", text: "I know this is urgent \u2014 have you tried turning it off and on again, and then turning your hopes off and on again too?" },
  { id: "googling-while-hold", text: "Have you tried turning it off and on again? That's step one. Step two is me Googling your problem while you hold." },
  { id: "script-wont-let-me", text: "Have you tried turning it off and on again? I have to ask \u2014 the script won't let me skip to the part where I actually help." },
  { id: "only-sentence-training", text: "Have you tried turning it off and on again? I ask everyone that. It's the only sentence they taught me in training." },
  { id: "hold-to-process", text: "Let's start with the classic: turn it off and on again \u2014 if that fails, I'll put you on hold so we can both process this." },
  { id: "feel-in-control", text: "Have you tried turning it off, then on again, then off again just to feel in control? It works for me every time." },
  { id: "one-fix-confidence", text: "I hear how stressful this is \u2014 have you tried turning it off and on again? It's the one fix I know, and I say it with such confidence." },
  { id: "transfer-same-question", text: "Have you tried turning it off and on again? No? Wonderful \u2014 I'll transfer you to someone who will ask you the exact same thing." },
  { id: "rest-of-us", text: "I completely understand \u2014 have you tried turning it off and on again and pretending that fixed it, like the rest of us do?" },
  { id: "nap-computer", text: "Good news: your computer isn't broken, it's just taking a little nap \u2014 have you tried turning it off and on again and letting it sleep in?" },
  { id: "sit-here-feel-something", text: "Have you tried turning it off and on again? No rush \u2014 I'll just sit here with you until one of us feels something." },
  { id: "ticket-will-ask", text: "Have you tried turning it off and on again? If not, I'll open a ticket, and the ticket will ask you to turn it off and on again." },
  { id: "unplug-feelings", text: "I can hear this has been a rough day \u2014 have you tried turning it off and on again, and if that fails, unplugging it and your feelings?" },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * The classic the bounty is named after, in its common shapes.
 * Leaning on it is fine — the brief only asks that the line twist
 * it — but stating it and stopping there is not an entry.
 */
const CLASSIC_PHRASES = [
  "turning it off and on again",
  "turn it off and on again",
  "turn it off, then on again",
  "turning it off, then on again",
];

/** True when the line leans on the turn-it-off-and-on classic. */
function leansOnClassic(text: string): boolean {
  return containsAny(text, CLASSIC_PHRASES);
}

/**
 * How many times the classic appears. One mention is a setup; a
 * second mention is the twist — the joke is that the "fix" repeats
 * forever, up the tiers, through the ticket queue, agent to agent.
 */
function classicCount(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const phrase of CLASSIC_PHRASES) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(phrase, from);
      if (at < 0) break;
      count += 1;
      from = at + phrase.length;
    }
  }
  return count;
}

/**
 * Words that mark the speaker as a support agent doing support
 * work — asking the diagnostic question, escalating, opening a
 * ticket, transferring, putting the customer on hold. A line with
 * none of these is a bystander commenting on tech support, not an
 * agent speaking to a customer.
 */
const AGENT_MARKERS = [
  "have you tried",
  "let's start",
  "i'll escalate",
  "i'll transfer",
  "i'll open a ticket",
  "i'll put you on hold",
  "i'll just sit here",
  "i ask everyone",
  "i have to ask",
  "step one",
  "step two",
  "good news",
];

/** How many agent-voice markers the line carries. */
function agentMarkerCount(text: string): number {
  return AGENT_MARKERS.filter((m) => text.toLowerCase().includes(m)).length;
}

/**
 * Words that let the customer's desperation be felt rather than
 * explained — the agent hearing the stress, naming the urgency,
 * admitting the fix may fail, giving the customer room. A line
 * that barrels straight into the diagnostic question reads like a
 * script, not a human being.
 */
const DESPERATION_MARKERS = [
  "i hear",
  "i can hear",
  "i know this is urgent",
  "i completely understand",
  "rough day",
  "stressful",
  "no rush",
  "doesn't work",
  "that fails",
  "if that fails",
  "if not",
];

/** How many desperation-felt markers the line carries. */
function desperationMarkerCount(text: string): number {
  return DESPERATION_MARKERS.filter((m) =>
    text.toLowerCase().includes(m),
  ).length;
}

/**
 * Words that carry the agent's cheerful uselessness — the engine
 * the brief names. Escalating to someone who asks the same
 * question, Googling while the customer holds, following a script
 * that forbids helping, transferring in a circle. Each marker is
 * one way the agent is happily no help at all.
 */
const USELESSNESS_MARKERS = [
  "escalate",
  "tier 2",
  "transfer you",
  "someone who will ask",
  "googling your problem",
  "while you hold",
  "script won't let me",
  "only sentence",
  "they taught me in training",
  "put you on hold",
  "both process this",
  "ticket will ask",
  "open a ticket",
  "feel in control",
  "rest of us",
  "pretending that fixed it",
  "feel something",
  "feels something",
  "sit here with you",
  "one fix i know",
  "such confidence",
  "unplugging",
  "sleep in",
  "hopes off and on",
  "sense your confidence",
];

/** How many cheerful-uselessness markers the line carries. */
function uselessnessMarkerCount(text: string): number {
  return USELESSNESS_MARKERS.filter((m) =>
    text.toLowerCase().includes(m),
  ).length;
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * re-framing the first half. A turn only counts when it lands late:
 * the punch must sit inside the final six words, otherwise the
 * line peaks early and then keeps talking. The repeated classic is
 * itself a twist word: when "turn it off and on again" shows up a
 * second time, at the end, the repeat is the punchline.
 */
const TWIST_WORDS = [
  "turn it off and on again",
  "exact same thing",
  "sense your confidence",
  "hopes off and on again",
  "googling your problem",
  "skip to the part",
  "only sentence",
  "both process this",
  "feel in control",
  "such confidence",
  "rest of us do",
  "sleep in",
  "feel something",
  "feels something",
  "ticket will ask",
  "your feelings",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A second comic beat on top of the twist: an absurd escalation,
 * a transfer in a circle, a script that forbids helping, a ticket
 * that asks the same question. One beat is a joke; two beats is a
 * line that lands twice on the first read.
 */
const COMIC_BEATS = [
  "tier 2",
  "exact same thing",
  "sense your confidence",
  "hopes off and on again",
  "googling your problem",
  "skip to the part",
  "only sentence",
  "both process this",
  "feel in control",
  "such confidence",
  "rest of us do",
  "sleep in",
  "feel something",
  "feels something",
  "ticket will ask",
  "unplugging",
];

/** How many second-beat markers the line carries. */
function comicBeatCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_BEATS.filter((m) => lower.includes(m)).length;
}

/**
 * Phrases that make the customer the butt of the joke — mocking
 * their feelings, their tears, their confidence. The brief is
 * explicit: the customer's desperation is felt, never mocked, and
 * the humour comes from the agent's uselessness, not the
 * customer's pain.
 */
const CUSTOMER_MOCK_PATTERNS = ["your feelings", "stop crying", "your fault"];

/** True when the line mocks the customer instead of the agent. */
function mocksCustomer(text: string): boolean {
  return containsAny(text, CUSTOMER_MOCK_PATTERNS);
}

/**
 * A line that only states the classic: it asks "have you tried
 * turning it off and on again?" and adds nothing — no turn, no
 * escalation, no second sentence. It has a subject and no joke.
 */
function onlyStatesClassic(text: string): boolean {
  if (!leansOnClassic(text)) return false;
  return wordsOf(text).length <= 10;
}

/**
 * Support-specific features the line actually uses — the classic
 * restart, the escalation ladder, the ticket queue, the transfer,
 * the hold, the script, the training, the search. A line scores
 * specificity for each distinct feature it uses, not for gesturing
 * at "tech support" in the abstract.
 */
const SUPPORT_FEATURES = [
  "turning it off and on again",
  "turn it off and on again",
  "turn it off, then on again",
  "turning it off, then on again",
  "escalate",
  "tier 2",
  "ticket",
  "transfer",
  "on hold",
  "script",
  "training",
  "googling",
  "unplug",
  "one fix",
];

/** Distinct support-specific features present in the line. */
function supportFeatures(text: string): string[] {
  const lower = text.toLowerCase();
  const found = SUPPORT_FEATURES.filter((f) => lower.includes(f));
  // The wordings of the classic are one feature, not several.
  const classic = found.filter((f) => f.includes("off and on again"));
  if (classic.length > 1) {
    const rest = found.filter((f) => !f.includes("off and on again"));
    return [...rest, "classic-restart"];
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: funny single-line reply from a hopeless agent to a desperate customer. */
  onBrief: number;
  /** C2: the joke lands — unexpected twist, cheerful uselessness. */
  punchline: number;
  /** C3: sounds like one line a real support agent would say. */
  soundsReal: number;
  /** C4: tight wording, every word earns its place. */
  tightness: number;
  /** C5: fresh angle, twisting the classic rather than repeating it. */
  freshness: number;
}

/**
 * C1 — On brief. Points for being, in its own words, a funny reply
 * from a hopeless tech support agent to a desperate customer: the
 * agent's voice (diagnostic question, escalation, transfer), the
 * classic support move, and a sign the customer's desperation is
 * felt. A line missing the voice or the human on the other end can
 * never win on later criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (agentMarkerCount(c.text) >= 1) score += 5;
  if (leansOnClassic(c.text)) score += 3;
  if (desperationMarkerCount(c.text) >= 1) score += 2;
  return Math.min(10, score);
}

/**
 * C2 — Punchline. A real joke needs a turn the reader does not see
 * coming, and the turn has to land late. Full marks need a late
 * twist plus a second comic beat plus at least two marks of
 * cheerful uselessness. A line that only states the classic is
 * capped at 3: it has a subject, not a joke. A line that mocks the
 * customer loses 2 — the humour must come from the agent.
 */
function scorePunchline(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (comicBeatCount(c.text) >= 1) score += 2;
  if (uselessnessMarkerCount(c.text) >= 2) score += 2;
  if (mocksCustomer(c.text)) score -= 2;
  if (onlyStatesClassic(c.text)) score = Math.min(score, 3);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Sounds real. Two points per distinct support-specific
 * feature the line actually uses — the restart, the escalation
 * ladder, the ticket, the transfer, the hold, the script — up to
 * the cap, with a base of 2 for speaking in the agent's voice at
 * all. A line with no support feature beyond the bare question
 * sounds like a slogan, not a line a real agent would say on a
 * real call: it is capped at 4.
 */
function scoreSoundsReal(c: Candidate): number {
  const features = supportFeatures(c.text);
  let score = Math.min(10, 2 + features.length * 2);
  if (features.length === 0) score = 2;
  if (features.length === 1 && leansOnClassic(c.text)) score = 4;
  return score;
}

/**
 * C4 — Tightness. The gate allows 199 characters; a line that
 * reads tight is shorter still. Full marks under 130 characters,
 * sliding down to 6 at the 199 cap — length for its own sake does
 * not count, and a line that needs two breaths is a line that
 * loses the room. Every word has to earn its place, and the joke
 * has to be clear on a first read.
 */
function scoreTightness(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 130) return 10;
  if (len <= 150) return 9;
  if (len <= 170) return 8;
  if (len <= 199) return 6;
  return 0;
}

/**
 * C5 — Freshness. Two points per distinct fresh angle — an
 * escalation to a tier that asks the same question, a transfer in
 * a circle, a script that forbids helping, hopes switched off and
 * on again — up to the cap, with a base of 2 for any line that
 * tries a turn at all. The bare classic with no twist is capped
 * at 3: it is the stock line every writer reaches for first.
 */
const FRESH_ANGLES = [
  "tier 2",
  "escalate",
  "exact same thing",
  "sense your confidence",
  "hopes off and on",
  "googling your problem",
  "skip to the part",
  "only sentence",
  "both process this",
  "feel in control",
  "such confidence",
  "rest of us do",
  "sleep in",
  "feel something",
  "feels something",
  "ticket will ask",
  "unplugging",
];

function scoreFreshness(c: Candidate): number {
  const lower = c.text.toLowerCase();
  const angles = FRESH_ANGLES.filter((a) => lower.includes(a)).length;
  let score = Math.min(10, 2 + angles * 2);
  if (angles === 0) score = 2;
  if (onlyStatesClassic(c.text)) score = Math.min(score, 3);
  return score;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    punchline: scorePunchline(c),
    soundsReal: scoreSoundsReal(c),
    tightness: scoreTightness(c),
    freshness: scoreFreshness(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it reads tighter, and the brief says length
 * for its own sake does not count.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "punchline",
    "soundsReal",
    "tightness",
    "freshness",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/**
 * Score every candidate, drop any line that cannot pass the gate
 * (over 199 characters, empty, or only whitespace), sort best
 * first, and return the ranking.
 */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const eligible = CANDIDATES.filter((c) => {
    const len = [...c.text].length;
    return len >= 1 && len <= 199 && c.text.trim().length > 0;
  });
  const scored = eligible.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 199 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check, and the stored entry itself holds
 * no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 199,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.punchline}  ` +
        `${scores.soundsReal}  ${scores.tightness}  ${scores.freshness}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} punchline=${winner.scores.punchline} ` +
      `soundsReal=${winner.scores.soundsReal} tightness=${winner.scores.tightness} ` +
      `freshness=${winner.scores.freshness}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
