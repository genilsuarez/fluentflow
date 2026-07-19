/**
 * Normalize answer for comparison: lowercase, collapse whitespace, trim,
 * strip common punctuation (.!?,;:) anywhere for leniency.
 * Also normalizes digit–letter boundaries ("7am" → "7 am") so minor
 * formatting differences in times/units don't penalize the user.
 */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.!?,;:]+/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Common irregular verb mappings (base → past/participle forms and vice versa).
 * Shared across answer-checking utilities.
 */
const irregularForms: Record<string, string[]> = {
  bring: ['brought', 'bringing', 'brings'],
  buy: ['bought', 'buying', 'buys'],
  catch: ['caught', 'catching', 'catches'],
  come: ['came', 'coming', 'comes'],
  do: ['did', 'done', 'doing', 'does'],
  drink: ['drank', 'drunk', 'drinking', 'drinks'],
  drive: ['drove', 'driven', 'driving', 'drives'],
  eat: ['ate', 'eaten', 'eating', 'eats'],
  fall: ['fell', 'fallen', 'falling', 'falls'],
  feel: ['felt', 'feeling', 'feels'],
  find: ['found', 'finding', 'finds'],
  get: ['got', 'gotten', 'getting', 'gets'],
  give: ['gave', 'given', 'giving', 'gives'],
  go: ['went', 'gone', 'going', 'goes'],
  grow: ['grew', 'grown', 'growing', 'grows'],
  have: ['had', 'having', 'has'],
  hear: ['heard', 'hearing', 'hears'],
  hold: ['held', 'holding', 'holds'],
  keep: ['kept', 'keeping', 'keeps'],
  know: ['knew', 'known', 'knowing', 'knows'],
  leave: ['left', 'leaving', 'leaves'],
  let: ['letting', 'lets'],
  lie: ['lay', 'lain', 'lying', 'lies'],
  lose: ['lost', 'losing', 'loses'],
  make: ['made', 'making', 'makes'],
  meet: ['met', 'meeting', 'meets'],
  pay: ['paid', 'paying', 'pays'],
  put: ['putting', 'puts'],
  read: ['reading', 'reads'],
  run: ['ran', 'running', 'runs'],
  say: ['said', 'saying', 'says'],
  see: ['saw', 'seen', 'seeing', 'sees'],
  sell: ['sold', 'selling', 'sells'],
  send: ['sent', 'sending', 'sends'],
  set: ['setting', 'sets'],
  show: ['showed', 'shown', 'showing', 'shows'],
  sit: ['sat', 'sitting', 'sits'],
  speak: ['spoke', 'spoken', 'speaking', 'speaks'],
  stand: ['stood', 'standing', 'stands'],
  take: ['took', 'taken', 'taking', 'takes'],
  teach: ['taught', 'teaching', 'teaches'],
  tell: ['told', 'telling', 'tells'],
  think: ['thought', 'thinking', 'thinks'],
  throw: ['threw', 'thrown', 'throwing', 'throws'],
  turn: ['turned', 'turning', 'turns'],
  understand: ['understood', 'understanding', 'understands'],
  wake: ['woke', 'woken', 'waking', 'wakes'],
  wear: ['wore', 'worn', 'wearing', 'wears'],
  win: ['won', 'winning', 'wins'],
  write: ['wrote', 'written', 'writing', 'writes'],
  look: ['looked', 'looking', 'looks'],
  pick: ['picked', 'picking', 'picks'],
  break: ['broke', 'broken', 'breaking', 'breaks'],
  choose: ['chose', 'chosen', 'choosing', 'chooses'],
  cut: ['cutting', 'cuts'],
  draw: ['drew', 'drawn', 'drawing', 'draws'],
  fly: ['flew', 'flown', 'flying', 'flies'],
  forget: ['forgot', 'forgotten', 'forgetting', 'forgets'],
  hang: ['hung', 'hanging', 'hangs'],
  hide: ['hid', 'hidden', 'hiding', 'hides'],
  hit: ['hitting', 'hits'],
  lead: ['led', 'leading', 'leads'],
  lend: ['lent', 'lending', 'lends'],
  light: ['lit', 'lighting', 'lights'],
  mean: ['meant', 'meaning', 'means'],
  ride: ['rode', 'ridden', 'riding', 'rides'],
  ring: ['rang', 'rung', 'ringing', 'rings'],
  rise: ['rose', 'risen', 'rising', 'rises'],
  shake: ['shook', 'shaken', 'shaking', 'shakes'],
  shine: ['shone', 'shining', 'shines'],
  shoot: ['shot', 'shooting', 'shoots'],
  shut: ['shutting', 'shuts'],
  sing: ['sang', 'sung', 'singing', 'sings'],
  sink: ['sank', 'sunk', 'sinking', 'sinks'],
  sleep: ['slept', 'sleeping', 'sleeps'],
  slide: ['slid', 'sliding', 'slides'],
  spend: ['spent', 'spending', 'spends'],
  split: ['splitting', 'splits'],
  spread: ['spreading', 'spreads'],
  steal: ['stole', 'stolen', 'stealing', 'steals'],
  stick: ['stuck', 'sticking', 'sticks'],
  strike: ['struck', 'striking', 'strikes'],
  swim: ['swam', 'swum', 'swimming', 'swims'],
  swing: ['swung', 'swinging', 'swings'],
  tear: ['tore', 'torn', 'tearing', 'tears'],
  blow: ['blew', 'blown', 'blowing', 'blows'],
  build: ['built', 'building', 'builds'],
  burn: ['burnt', 'burned', 'burning', 'burns'],
  dig: ['dug', 'digging', 'digs'],
  feed: ['fed', 'feeding', 'feeds'],
  fight: ['fought', 'fighting', 'fights'],
  freeze: ['froze', 'frozen', 'freezing', 'freezes'],
  lay: ['laid', 'laying', 'lays'],
  lean: ['leant', 'leaned', 'leaning', 'leans'],
  learn: ['learnt', 'learned', 'learning', 'learns'],
  spell: ['spelt', 'spelled', 'spelling', 'spells'],
  spill: ['spilt', 'spilled', 'spilling', 'spills'],
  sweep: ['swept', 'sweeping', 'sweeps'],
  begin: ['began', 'begun', 'beginning', 'begins'],
  bend: ['bent', 'bending', 'bends'],
  bet: ['betting', 'bets'],
  bite: ['bit', 'bitten', 'biting', 'bites'],
  bleed: ['bled', 'bleeding', 'bleeds'],
  bind: ['bound', 'binding', 'binds'],
  breed: ['bred', 'breeding', 'breeds'],
  burst: ['bursting', 'bursts'],
  cast: ['casting', 'casts'],
  cling: ['clung', 'clinging', 'clings'],
  cost: ['costing', 'costs'],
  creep: ['crept', 'creeping', 'creeps'],
  deal: ['dealt', 'dealing', 'deals'],
  dream: ['dreamt', 'dreamed', 'dreaming', 'dreams'],
  dwell: ['dwelt', 'dwelling', 'dwells'],
  flee: ['fled', 'fleeing', 'flees'],
  fling: ['flung', 'flinging', 'flings'],
  forbid: ['forbade', 'forbidden', 'forbidding', 'forbids'],
  forgive: ['forgave', 'forgiven', 'forgiving', 'forgives'],
  grind: ['ground', 'grinding', 'grinds'],
  kneel: ['knelt', 'kneeling', 'kneels'],
  leap: ['leapt', 'leaped', 'leaping', 'leaps'],
  seek: ['sought', 'seeking', 'seeks'],
  sew: ['sewed', 'sewn', 'sewing', 'sews'],
  shed: ['shedding', 'sheds'],
  shrink: ['shrank', 'shrunk', 'shrinking', 'shrinks'],
  slay: ['slew', 'slain', 'slaying', 'slays'],
  sow: ['sowed', 'sown', 'sowing', 'sows'],
  spin: ['spun', 'spinning', 'spins'],
  spit: ['spat', 'spitting', 'spits'],
  spring: ['sprang', 'sprung', 'springing', 'springs'],
  sting: ['stung', 'stinging', 'stings'],
  stink: ['stank', 'stunk', 'stinking', 'stinks'],
  stride: ['strode', 'stridden', 'striding', 'strides'],
  strive: ['strove', 'striven', 'striving', 'strives'],
  swear: ['swore', 'sworn', 'swearing', 'swears'],
  weave: ['wove', 'woven', 'weaving', 'weaves'],
  weep: ['wept', 'weeping', 'weeps'],
  wind: ['wound', 'winding', 'winds'],
  wring: ['wrung', 'wringing', 'wrings'],
};

/** Reverse lookup: any verb form → base form. Built once at module load. */
const formToBase = new Map<string, string>();
for (const [base, forms] of Object.entries(irregularForms)) {
  formToBase.set(base, base);
  for (const form of forms) {
    formToBase.set(form, base);
  }
}

/**
 * Detect if the user's answer is a tense/conjugation variant of the correct answer.
 * Returns true when the words share a root but differ in form (e.g. "bring up" vs "brought up").
 */
export function isTenseError(userAnswer: string, correctAnswer: string): boolean {
  const u = userAnswer.toLowerCase().trim();
  const c = correctAnswer.toLowerCase().trim();
  if (u === c) return false;

  const uWords = u.split(/\s+/);
  const cWords = c.split(/\s+/);

  // For phrasal verbs: check if the particle(s) match and only the verb differs
  if (uWords.length === cWords.length && uWords.length >= 2) {
    const uParticles = uWords.slice(1).join(' ');
    const cParticles = cWords.slice(1).join(' ');
    if (uParticles === cParticles) {
      const uBase = formToBase.get(uWords[0]);
      const cBase = formToBase.get(cWords[0]);
      if (uBase && cBase && uBase === cBase) return true;
    }
  }

  // For single words: check if they share the same base
  if (uWords.length === 1 && cWords.length === 1) {
    const uBase = formToBase.get(uWords[0]);
    const cBase = formToBase.get(cWords[0]);
    if (uBase && cBase && uBase === cBase) return true;

    // Fallback: regular verb detection (e.g., "walk" vs "walked")
    const uWord = uWords[0];
    const cWord = cWords[0];
    if (cWord.endsWith('ed') && cWord.startsWith(uWord)) return true;
    if (uWord.endsWith('ed') && uWord.startsWith(cWord)) return true;
    if (cWord.endsWith('ing') && (cWord.startsWith(uWord) || cWord.slice(0, -3) === uWord))
      return true;
    if (uWord.endsWith('ing') && (uWord.startsWith(cWord) || uWord.slice(0, -3) === cWord))
      return true;
  }

  return false;
}

/**
 * Detect if the user's answer uses the correct verb but the wrong particle.
 * E.g. "check out" vs "check in", "turn off" vs "turn on".
 */
export function isParticleError(userAnswer: string, correctAnswer: string): boolean {
  const u = userAnswer.toLowerCase().trim();
  const c = correctAnswer.toLowerCase().trim();
  if (u === c) return false;

  const uWords = u.split(/\s+/);
  const cWords = c.split(/\s+/);

  // Both must be phrasal verbs (verb + particle(s))
  if (uWords.length < 2 || cWords.length < 2) return false;

  // Same verb, different particle(s)
  if (uWords[0] === cWords[0]) {
    const uParticle = uWords.slice(1).join(' ');
    const cParticle = cWords.slice(1).join(' ');
    return uParticle !== cParticle;
  }

  return false;
}
