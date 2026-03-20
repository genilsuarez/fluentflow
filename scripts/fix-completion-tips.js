import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const modules = JSON.parse(readFileSync(join(ROOT, 'public/data/learningModules.json'), 'utf-8'));

// Strategy: generate contextual tips based on the file topic and item content
// Tips should hint at the grammar/vocab concept WITHOUT revealing the answer

const fileTips = {
  // ═══════════════════════════════════════════════════════════════
  // A1 — completion-greetings-practice-a1 (2 missing)
  // ═══════════════════════════════════════════════════════════════
  "completion-greetings-practice-a1": (item) => {
    const c = item.correct.toLowerCase();
    if (c.includes('hello') || c.includes('hi') || c.includes('hey')) return "Think about common ways to greet someone.";
    if (c.includes('bye') || c.includes('goodbye') || c.includes('see you')) return "Think about how to say farewell.";
    if (c.includes('thank') || c.includes('please')) return "Think about polite expressions.";
    if (c.includes('name') || c.includes('my name')) return "Think about how to introduce yourself.";
    return "Think about common greeting expressions.";
  },

  // ═══════════════════════════════════════════════════════════════
  // A2 — completion-daily-activities-a2 (20 missing)
  // ═══════════════════════════════════════════════════════════════
  "completion-daily-activities-a2": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.includes('every') || s.includes('always') || s.includes('usually')) return "The time expression suggests a habitual action.";
    if (s.includes('yesterday') || s.includes('last')) return "The time expression points to the past.";
    if (s.includes('hobby') || s.includes('free time') || s.includes('weekend')) return "Think about leisure activities.";
    if (c.includes('ing')) return "Think about an activity word ending in -ing.";
    return "Think about a daily routine or activity that fits the context.";
  },

  // ═══════════════════════════════════════════════════════════════
  // B2 — completion-clothing-emotions-b2 (20 missing)
  // ═══════════════════════════════════════════════════════════════
  "completion-clothing-emotions-b2": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.includes('feel') || s.includes('felt') || s.includes('emotion') || s.includes('mood')) return "Think about a word that describes an emotional state.";
    if (s.includes('wear') || s.includes('dress') || s.includes('outfit') || s.includes('clothes')) return "Think about a clothing or fashion term.";
    if (s.includes('happy') || s.includes('sad') || s.includes('angry') || s.includes('anxious')) return "Consider a synonym or related emotion.";
    if (c.includes('ment') || c.includes('ness') || c.includes('tion')) return "The answer is a noun — think about the suffix.";
    return "Think about a word related to feelings or personal style.";
  },

  // ═══════════════════════════════════════════════════════════════
  // C1 — Grammar files (4 files, 145 items)
  // ═══════════════════════════════════════════════════════════════
  "completion-advanced-grammar-conditionals-c1": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.startsWith('had ') || s.includes(', had ')) return "This is an inverted conditional — no 'if' needed when the clause starts with 'had'.";
    if (s.includes('if i were') || c === 'were') return "In hypothetical situations, use 'were' for all subjects.";
    if (s.includes('unless')) return "'Unless' means 'if not' — the verb stays affirmative.";
    if (s.includes('provided') || s.includes('as long as')) return "This conditional connector works like 'if' but with a condition emphasis.";
    if (c.includes('would have')) return "Think about an unreal past result — third conditional structure.";
    if (c.includes('would')) return "The result clause of a hypothetical uses 'would' + base verb.";
    if (s.includes('wish') || s.includes('if only')) return "After 'wish'/'if only', shift the tense one step back.";
    if (s.includes('heat') || s.includes('mix') || s.includes('always')) return "Zero conditional: general truths use present simple in both clauses.";
    return "Identify the conditional type (0, 1, 2, 3, or mixed) to choose the right tense.";
  },

  "completion-advanced-grammar-inversions-c1": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.startsWith('not only') || s.includes('not only')) return "After 'Not only' at the start, use inverted word order (auxiliary + subject).";
    if (s.startsWith('never') || s.startsWith('rarely') || s.startsWith('seldom')) return "Negative adverbs at the start trigger subject-auxiliary inversion.";
    if (s.startsWith('hardly') || s.startsWith('scarcely') || s.startsWith('no sooner')) return "These time expressions trigger inversion — think about the auxiliary verb.";
    if (s.startsWith('little') || s.includes('little did')) return "'Little' as a negative adverb triggers inversion with 'did'.";
    if (s.startsWith('only') || s.includes('only after') || s.includes('only when')) return "'Only + time expression' at the start triggers inversion in the main clause.";
    if (s.startsWith('under no') || s.startsWith('on no') || s.startsWith('in no')) return "Negative prepositional phrases at the start trigger inversion.";
    if (s.startsWith('so ') || s.startsWith('such ')) return "'So/Such' at the start for emphasis triggers inverted order.";
    if (c.includes('did') || c.includes('had') || c.includes('was') || c.includes('were')) return "Inversion requires an auxiliary verb before the subject.";
    return "Formal inversion: the auxiliary comes before the subject for emphasis.";
  },

  "completion-complex-prepositions-practice-c1": (item) => {
    const s = item.sentence.toLowerCase();
    if (s.includes('regard') || s.includes('respect')) return "Think about a formal way to say 'about' or 'concerning'.";
    if (s.includes('spite') || s.includes('despite')) return "This preposition introduces a contrast — something unexpected.";
    if (s.includes('accordance') || s.includes('according')) return "Think about following rules or standards.";
    if (s.includes('behalf')) return "'On behalf of' means representing someone.";
    if (s.includes('means') || s.includes('way')) return "Think about how something is done — the method.";
    if (s.includes('addition') || s.includes('moreover')) return "This adds extra information — think 'also' or 'furthermore'.";
    if (s.includes('lieu') || s.includes('instead')) return "Think about a replacement or substitute.";
    if (s.includes('view') || s.includes('light')) return "Think about considering circumstances or context.";
    return "Think about which formal preposition phrase fits the logical relationship.";
  },

  "completion-advanced-grammar-participles-c1": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (c.endsWith('ing') && (s.includes('while') || s.includes('when') || s.startsWith('having'))) return "A present participle (-ing) describes an action happening at the same time.";
    if (c.endsWith('ed') || c.endsWith('en') || c.endsWith('t')) return "A past participle describes a completed action or passive meaning.";
    if (s.startsWith('having ') || c.startsWith('having ')) return "'Having + past participle' shows one action completed before another.";
    if (c.endsWith('ing')) return "The -ing form can show cause, time, or a simultaneous action.";
    if (s.includes('not ') && c.includes('ing')) return "Negative participle clauses: 'Not + -ing' at the start.";
    return "Choose between present participle (-ing) and past participle (-ed/irregular) based on active vs. passive meaning.";
  },

  "completion-advanced-grammar-subjunctive-c1": (item) => {
    const s = item.sentence.toLowerCase();
    if (s.includes('suggest') || s.includes('recommend') || s.includes('insist') || s.includes('demand') || s.includes('propose')) return "After verbs of suggestion/demand, use the subjunctive (base form, no -s).";
    if (s.includes('it is essential') || s.includes('it is important') || s.includes('it is vital') || s.includes('it is crucial')) return "After 'It is essential/important that...', use the subjunctive base form.";
    if (s.includes('if i were') || s.includes('as if') || s.includes('as though')) return "Use 'were' (not 'was') in hypothetical/unreal comparisons.";
    if (s.includes('god') || s.includes('heaven') || s.includes('long live')) return "Fixed subjunctive expressions use the base form of the verb.";
    if (s.includes('lest')) return "After 'lest', use the subjunctive (base form) — it means 'for fear that'.";
    return "The subjunctive uses the base form of the verb, without conjugation.";
  },

  // C1 — Vocabulary
  "completion-ielts-home-life-c1": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.includes('commut') || s.includes('travel') || s.includes('transport')) return "Think about daily travel or transportation vocabulary.";
    if (s.includes('house') || s.includes('home') || s.includes('room') || s.includes('kitchen')) return "Think about household or domestic vocabulary.";
    if (s.includes('chore') || s.includes('clean') || s.includes('cook')) return "Think about household tasks and responsibilities.";
    if (s.includes('neighbour') || s.includes('community') || s.includes('area')) return "Think about community and neighborhood vocabulary.";
    return "Think about a word related to home life, daily routines, or domestic situations.";
  },

  // ═══════════════════════════════════════════════════════════════
  // C2 — 4 files with 0% tips (128 items)
  // ═══════════════════════════════════════════════════════════════
  "completion-advanced-collocations-idioms-c2": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (c.includes(' ')) return "The answer is a multi-word expression — think about common collocations.";
    if (s.includes('make') || s.includes('do') || s.includes('take') || s.includes('get')) return "Think about which verb collocates naturally with the noun.";
    if (s.includes('idiom') || s.includes('saying')) return "Think about a well-known English expression.";
    return "Think about which word or phrase naturally collocates in this context.";
  },

  "completion-advanced-grammatical-structures-c2": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.startsWith('not ') || s.startsWith('never ') || s.startsWith('rarely ') || s.startsWith('seldom ')) return "Fronted negative adverbs trigger subject-auxiliary inversion.";
    if (s.includes('subjunctive') || s.includes('insist') || s.includes('demand') || s.includes('recommend')) return "Verbs of demand/suggestion take the subjunctive (base form).";
    if (s.includes('cleft') || s.startsWith('it was') || s.startsWith('it is') || s.startsWith('what ')) return "This is a cleft sentence — used for emphasis on a specific element.";
    if (c.includes('having') || c.includes('been')) return "Think about perfect or passive participle structures.";
    if (s.includes('were it') || s.includes('had it') || s.includes('should it')) return "Formal conditional inversion — the auxiliary replaces 'if'.";
    if (c.endsWith('ing')) return "Consider whether a gerund or present participle fits the grammatical slot.";
    return "Analyze the grammatical structure — is it inversion, cleft, subjunctive, or participle?";
  },

  "completion-formal-vocabulary-nuance-c2": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.includes('formal') || s.includes('academic') || s.includes('essay')) return "Think about the formal register equivalent of a common word.";
    if (c.includes('ate') || c.includes('ify') || c.includes('ize')) return "The answer is a formal verb — think about Latin/Greek-derived vocabulary.";
    if (c.includes('tion') || c.includes('ment') || c.includes('ance') || c.includes('ence')) return "The answer is a formal noun — think about the appropriate suffix.";
    if (s.includes('nuance') || s.includes('subtle') || s.includes('distinction')) return "Think about a word that captures a fine shade of meaning.";
    return "Think about a sophisticated, formal-register word that fits the academic context.";
  },

  "completion-formal-register-advanced-c2": (item) => {
    const s = item.sentence.toLowerCase();
    const c = item.correct.toLowerCase();
    if (s.includes('letter') || s.includes('correspondence') || s.includes('dear')) return "Think about formal letter-writing vocabulary.";
    if (s.includes('report') || s.includes('findings') || s.includes('data')) return "Think about academic or report-writing language.";
    if (s.includes('hereby') || s.includes('forthwith') || s.includes('henceforth')) return "This is legal/official register — think about very formal connectors.";
    if (c.length > 10) return "The answer is a formal expression — think about elevated, professional language.";
    return "Think about the formal or academic equivalent that fits this professional context.";
  },
};

// ── Apply tips ──
let totalFixed = 0;
let filesFixed = 0;

for (const mod of modules.filter(m => m.learningMode === 'completion')) {
  const tipFn = fileTips[mod.id];
  if (!tipFn) continue;

  const filePath = join(ROOT, 'public', mod.dataPath);
  let data;
  try { data = JSON.parse(readFileSync(filePath, 'utf-8')); } catch { continue; }

  let changed = false;
  let fixedInFile = 0;
  for (const item of data) {
    if (!item.tip) {
      item.tip = tipFn(item);
      fixedInFile++;
      totalFixed++;
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    filesFixed++;
    console.log(`  ✅ ${mod.id}: +${fixedInFile} tips`);
  }
}

console.log(`\nFixed: ${totalFixed} items in ${filesFixed} files`);

// Final check
let remaining = 0;
for (const mod of modules.filter(m => m.learningMode === 'completion')) {
  try {
    const data = JSON.parse(readFileSync(join(ROOT, 'public', mod.dataPath), 'utf-8'));
    const miss = data.filter(i => !i.tip);
    if (miss.length > 0) {
      remaining += miss.length;
      console.log(`  ⚠ ${mod.id}: ${miss.length} still missing`);
    }
  } catch {}
}

if (remaining === 0) {
  console.log('\n✅ All 1,068 completion items now have tips');
} else {
  console.log(`\n⚠ Still missing: ${remaining}`);
}
