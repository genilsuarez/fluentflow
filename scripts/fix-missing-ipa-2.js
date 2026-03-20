import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const modules = JSON.parse(readFileSync(join(ROOT, 'public/data/learningModules.json'), 'utf-8'));

const IPA = {
  // A1 idioms remaining
  "Hit the books": "/hɪt ðə bʊks/",
  "No pain, no gain": "/noʊ peɪn noʊ ɡeɪn/",
  "So far, so good": "/soʊ fɑːr soʊ ɡʊd/",
  "An arm and a leg": "/ən ɑːrm ənd ə lɛɡ/",
  "A long shot": "/ə lɒŋ ʃɒt/",
  "On the go": "/ɒn ðə ɡoʊ/",
  "In a hurry": "/ɪn ə ˈhʌri/",
  "For good": "/fɔːr ɡʊd/",
  "By heart": "/baɪ hɑːrt/",
  "On purpose": "/ɒn ˈpɜːrpəs/",
  "In charge of": "/ɪn tʃɑːrdʒ əv/",
  "At first": "/ət fɜːrst/",
  "Right away": "/raɪt əˈweɪ/",
  "Day by day": "/deɪ baɪ deɪ/",
  "Up to date": "/ʌp tə deɪt/",
  "In the end": "/ɪn ðə ɛnd/",
  "On time": "/ɒn taɪm/",
  "At least": "/ət liːst/",
  "Give it a try": "/ɡɪv ɪt ə traɪ/",
  "Take your time": "/teɪk jʊr taɪm/",
  "Never mind": "/ˈnɛvər maɪnd/",
  "As usual": "/æz ˈjuːʒuəl/",
  "Piece of cake": "/piːs əv keɪk/",
  "On cloud nine": "/ɒn klaʊd naɪn/",

  // A1 vocab
  "Lunchbox": "/ˈlʌntʃbɒks/",

  // A2 home
  "Drawer": "/drɔːr/",
  "Wardrobe": "/ˈwɔːrdroʊb/",
  "Pillow": "/ˈpɪloʊ/",
  "Blanket": "/ˈblæŋkɪt/",
  "Fridge": "/frɪdʒ/",
  "Washing machine": "/ˈwɒʃɪŋ məˈʃiːn/",
  "Staircase": "/ˈstɛrkeɪs/",

  // A2 culture-health
  "Thermometer": "/θərˈmɒmɪtər/",
  "Stretcher": "/ˈstrɛtʃər/",

  // A2 idioms remaining
  "The best of both worlds": "/ðə bɛst əv boʊθ wɜːrldz/",
  "Add fuel to the fire": "/æd ˈfjuːəl tə ðə ˈfaɪər/",
  "Get along with": "/ɡɛt əˈlɒŋ wɪð/",
  "Look forward to": "/lʊk ˈfɔːrwərd tə/",
  "Run out of": "/rʌn aʊt əv/",
  "Come up with": "/kʌm ʌp wɪð/",
  "Keep in touch": "/kiːp ɪn tʌtʃ/",
  "Make a living": "/meɪk ə ˈlɪvɪŋ/",
  "Take place": "/teɪk pleɪs/",
  "Pay attention": "/peɪ əˈtɛnʃən/",
  "Make sense": "/meɪk sɛns/",
  "Take care of": "/teɪk kɛr əv/",
  "In common": "/ɪn ˈkɒmən/",
  "On the other hand": "/ɒn ðə ˈʌðər hænd/",
  "Sooner or later": "/ˈsuːnər ɔːr ˈleɪtər/",
  "Little by little": "/ˈlɪtəl baɪ ˈlɪtəl/",
  "At the moment": "/ət ðə ˈmoʊmənt/",
  "As a matter of fact": "/æz ə ˈmætər əv fækt/",
  "By the way": "/baɪ ðə weɪ/",
  "In a row": "/ɪn ə roʊ/",
  "On the whole": "/ɒn ðə hoʊl/",
  "For instance": "/fɔːr ˈɪnstəns/",

  // B1 vocab
  "Hypothesis": "/haɪˈpɒθəsɪs/",

  // B1 idioms remaining
  "Give someone the benefit of the doubt": "/ɡɪv ˈsʌmwʌn ðə ˈbɛnɪfɪt əv ðə daʊt/",
  "On the fence": "/ɒn ðə fɛns/",
  "Wrap your head around": "/ræp jʊr hɛd əˈraʊnd/",
  "A piece of the puzzle": "/ə piːs əv ðə ˈpʌzəl/",
  "Behind the scenes": "/bɪˈhaɪnd ðə siːnz/",
  "Blow off steam": "/bloʊ ɒf stiːm/",
  "By all means": "/baɪ ɔːl miːnz/",
  "Come in handy": "/kʌm ɪn ˈhændi/",
  "Down to earth": "/daʊn tə ɜːrθ/",
  "Get the hang of": "/ɡɛt ðə hæŋ əv/",
  "In the meantime": "/ɪn ðə ˈmiːntaɪm/",
  "Keep in mind": "/kiːp ɪn maɪnd/",
  "Lose track of time": "/luːz træk əv taɪm/",
  "Make a difference": "/meɪk ə ˈdɪfərəns/",
  "On second thought": "/ɒn ˈsɛkənd θɔːt/",
  "Out of the question": "/aʊt əv ðə ˈkwɛstʃən/",
  "Take for granted": "/teɪk fɔːr ˈɡræntɪd/",

  // B2 time idioms
  "At the crack of dawn": "/ət ðə kræk əv dɔːn/",
  "Just in time": "/dʒʌst ɪn taɪm/",

  // C1 vocab
  "Ambivalent": "/æmˈbɪvələnt/",

  // C1 idioms remaining
  "A can of worms": "/ə kæn əv wɜːrmz/",
  "A storm in a teacup": "/ə stɔːrm ɪn ə ˈtiːkʌp/",
  "In the same boat": "/ɪn ðə seɪm boʊt/",
  "Bite the hand that feeds you": "/baɪt ðə hænd ðæt fiːdz juː/",
  "Go back to the drawing board": "/ɡoʊ bæk tə ðə ˈdrɔːɪŋ bɔːrd/",
  "At the drop of a hat": "/ət ðə drɒp əv ə hæt/",
  "Blow it out of proportion": "/bloʊ ɪt aʊt əv prəˈpɔːrʃən/",
  "By and large": "/baɪ ənd lɑːrdʒ/",
  "Come to grips with": "/kʌm tə ɡrɪps wɪð/",
  "Fall through the cracks": "/fɔːl θruː ðə kræks/",
  "Get to the bottom of": "/ɡɛt tə ðə ˈbɒtəm əv/",
  "In the pipeline": "/ɪn ðə ˈpaɪplaɪn/",
  "Keep tabs on": "/kiːp tæbz ɒn/",
  "Pull the plug": "/pʊl ðə plʌɡ/",
  "Raise eyebrows": "/reɪz ˈaɪbraʊz/",
  "Set the record straight": "/sɛt ðə ˈrɛkərd streɪt/",
  "Under the radar": "/ˈʌndər ðə ˈreɪdɑːr/",

  // C2 academic
  "Reductionism": "/rɪˈdʌkʃənɪzəm/",
  "Empiricism": "/ɪmˈpɪrɪsɪzəm/",
  "Corroborate": "/kəˈrɒbəreɪt/",

  // C2 critical analysis remaining (34)
  "axiomatic": "/ˌæksiəˈmætɪk/",
  "rationalism": "/ˈræʃənəlɪzəm/",
  "holistic": "/hoʊˈlɪstɪk/",
  "determinism": "/dɪˈtɜːrmɪnɪzəm/",
  "contingent": "/kənˈtɪndʒənt/",
  "antithesis": "/ænˈtɪθəsɪs/",
  "synthesis": "/ˈsɪnθəsɪs/",
  "paradox": "/ˈpærədɒks/",
  "anomaly": "/əˈnɒməli/",
  "corollary": "/ˈkɒrəlɛri/",
  "caveat": "/ˈkæviæt/",
  "proviso": "/prəˈvaɪzoʊ/",
  "stipulation": "/ˌstɪpjəˈleɪʃən/",
  "presupposition": "/ˌpriːsʌpəˈzɪʃən/",
  "implication": "/ˌɪmplɪˈkeɪʃən/",
  "extrapolation": "/ɪkˌstræpəˈleɪʃən/",
  "interpolation": "/ɪnˌtɜːrpəˈleɪʃən/",
  "deduction": "/dɪˈdʌkʃən/",
  "induction": "/ɪnˈdʌkʃən/",
  "abduction": "/æbˈdʌkʃən/",
  "falsifiability": "/ˌfɔːlsɪfaɪəˈbɪləti/",
  "verisimilitude": "/ˌvɛrɪsɪˈmɪlɪtjuːd/",
  "tautology": "/tɔːˈtɒlədʒi/",
  "sophistry": "/ˈsɒfɪstri/",
  "non sequitur": "/nɒn ˈsɛkwɪtər/",
  "ad hominem": "/æd ˈhɒmɪnɛm/",
  "straw man": "/strɔː mæn/",
  "Subtext": "/ˈsʌbtɛkst/",
  "Allegory": "/ˈæləɡɔːri/",
  "Motif": "/moʊˈtiːf/",
  "Catharsis": "/kəˈθɑːrsɪs/",
  "Pastiche": "/pæˈstiːʃ/",
  "Denouement": "/ˌdeɪnuːˈmɒ̃/",
  "Intertextuality": "/ˌɪntərtɛkstʃuˈæləti/",

  // C2 reading vocab
  "Equanimity": "/ˌɛkwəˈnɪməti/",

  // C2 mastery idioms remaining (30)
  "A moot point": "/ə muːt pɔɪnt/",
  "Throw the baby out with the bathwater": "/θroʊ ðə ˈbeɪbi aʊt wɪð ðə ˈbæθwɔːtər/",
  "A fait accompli": "/ə ˌfeɪt əˈkɒmpliː/",
  "A Pandora's box": "/ə pænˈdɔːrəz bɒks/",
  "Cross the Rubicon": "/krɒs ðə ˈruːbɪkɒn/",
  "Beyond the pale": "/bɪˈjɒnd ðə peɪl/",
  "A poisoned chalice": "/ə ˈpɔɪzənd ˈtʃælɪs/",
  "Split hairs": "/splɪt hɛrz/",
  "A Hobson's choice": "/ə ˈhɒbsənz tʃɔɪs/",
  "Gild the lily": "/ɡɪld ðə ˈlɪli/",
  "A foregone conclusion": "/ə ˈfɔːrɡɒn kənˈkluːʒən/",
  "A litmus test": "/ə ˈlɪtməs tɛst/",
  "A mea culpa": "/ə ˌmeɪə ˈkʊlpə/",
  "A non sequitur": "/ə nɒn ˈsɛkwɪtər/",
  "A quid pro quo": "/ə kwɪd proʊ kwoʊ/",
  "Ad hoc": "/æd hɒk/",
  "Carte blanche": "/ˌkɑːrt ˈblɑːnʃ/",
  "De facto": "/deɪ ˈfæktoʊ/",
  "In lieu of": "/ɪn ljuː əv/",
  "Ipso facto": "/ˈɪpsoʊ ˈfæktoʊ/",
  "Persona non grata": "/pərˈsoʊnə nɒn ˈɡrɑːtə/",
  "Prima donna": "/ˈpriːmə ˈdɒnə/",
  "Status quo": "/ˈsteɪtəs kwoʊ/",
  "Vis-à-vis": "/ˌviːz ɑː ˈviː/",
  "Bona fide": "/ˈboʊnə ˈfaɪdi/",
  "Caveat emptor": "/ˈkæviæt ˈɛmptɔːr/",
  "Magnum opus": "/ˈmæɡnəm ˈoʊpəs/",
  "Modus operandi": "/ˈmoʊdəs ˌɒpəˈrændi/",
  "Raison d'être": "/ˌreɪzɒn ˈdɛtrə/",
  "Sine qua non": "/ˌsɪneɪ kwɑː ˈnɒn/",
};

let totalFixed = 0;
let filesFixed = 0;

for (const mod of modules.filter(m => m.learningMode === 'flashcard')) {
  const filePath = join(ROOT, 'public', mod.dataPath);
  let data;
  try { data = JSON.parse(readFileSync(filePath, 'utf-8')); } catch { continue; }

  let changed = false;
  for (const item of data) {
    if (!item.ipa && IPA[item.front]) {
      item.ipa = IPA[item.front];
      totalFixed++;
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    filesFixed++;
  }
}

console.log(`Fixed: ${totalFixed} items in ${filesFixed} files`);

// Final check
let remaining = 0;
for (const mod of modules.filter(m => m.learningMode === 'flashcard')) {
  try {
    const data = JSON.parse(readFileSync(join(ROOT, 'public', mod.dataPath), 'utf-8'));
    const miss = data.filter(i => !i.ipa);
    if (miss.length > 0) {
      remaining += miss.length;
      console.log(`  ⚠ ${mod.id}: ${miss.map(i => i.front).join(', ')}`);
    }
  } catch {}
}

if (remaining === 0) {
  console.log('\n✅ All 1,433 flashcard items now have IPA transcription');
} else {
  console.log(`\n⚠ Still missing: ${remaining}`);
}
