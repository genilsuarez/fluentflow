import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const modules = JSON.parse(readFileSync(join(ROOT, 'public/data/learningModules.json'), 'utf-8'));

// IPA dictionary — manually curated for all 349 missing items
const IPA = {
  // ═══════════════════════════════════════════════════════════════
  // A1 IDIOMS (40)
  // ═══════════════════════════════════════════════════════════════
  "A piece of cake": "/ə piːs əv keɪk/",
  "Break a leg": "/breɪk ə lɛɡ/",
  "It's raining cats and dogs": "/ɪts ˈreɪnɪŋ kæts ənd dɒɡz/",
  "Hold on": "/hoʊld ɒn/",
  "Once in a blue moon": "/wʌns ɪn ə bluː muːn/",
  "Under the weather": "/ˈʌndər ðə ˈwɛðər/",
  "Hit the road": "/hɪt ðə roʊd/",
  "No big deal": "/noʊ bɪɡ diːl/",
  "Hang in there": "/hæŋ ɪn ðɛr/",
  "On the same page": "/ɒn ðə seɪm peɪdʒ/",
  "Take it easy": "/teɪk ɪt ˈiːzi/",
  "Better late than never": "/ˈbɛtər leɪt ðæn ˈnɛvər/",
  "So far so good": "/soʊ fɑːr soʊ ɡʊd/",
  "Long time no see": "/lɒŋ taɪm noʊ siː/",
  "You're welcome": "/jʊr ˈwɛlkəm/",
  "My bad": "/maɪ bæd/",
  "No worries": "/noʊ ˈwʌriz/",
  "Fingers crossed": "/ˈfɪŋɡərz krɒst/",
  "Good to go": "/ɡʊd tə ɡoʊ/",
  "In a nutshell": "/ɪn ə ˈnʌtʃɛl/",
  "Keep it up": "/kiːp ɪt ʌp/",
  "Piece by piece": "/piːs baɪ piːs/",
  "Step by step": "/stɛp baɪ stɛp/",
  "Time flies": "/taɪm flaɪz/",
  "Give it a shot": "/ɡɪv ɪt ə ʃɒt/",
  "It's up to you": "/ɪts ʌp tə juː/",
  "Make up your mind": "/meɪk ʌp jʊr maɪnd/",
  "Out of the blue": "/aʊt əv ðə bluː/",
  "Sleep on it": "/sliːp ɒn ɪt/",
  "That rings a bell": "/ðæt rɪŋz ə bɛl/",
  "The more the merrier": "/ðə mɔːr ðə ˈmɛriər/",
  "Think outside the box": "/θɪŋk aʊtˈsaɪd ðə bɒks/",
  "Actions speak louder than words": "/ˈækʃənz spiːk ˈlaʊdər ðæn wɜːrdz/",
  "Every cloud has a silver lining": "/ˈɛvri klaʊd hæz ə ˈsɪlvər ˈlaɪnɪŋ/",
  "Practice makes perfect": "/ˈpræktɪs meɪks ˈpɜːrfɪkt/",
  "When in Rome, do as the Romans do": "/wɛn ɪn roʊm duː æz ðə ˈroʊmənz duː/",
  "Two heads are better than one": "/tuː hɛdz ɑːr ˈbɛtər ðæn wʌn/",
  "Don't judge a book by its cover": "/doʊnt dʒʌdʒ ə bʊk baɪ ɪts ˈkʌvər/",
  "The early bird catches the worm": "/ðə ˈɜːrli bɜːrd ˈkætʃɪz ðə wɜːrm/",
  "Where there's a will, there's a way": "/wɛr ðɛrz ə wɪl ðɛrz ə weɪ/",

  // ═══════════════════════════════════════════════════════════════
  // A2 IDIOMS (40)
  // ═══════════════════════════════════════════════════════════════
  "The early bird catches the worm": "/ðə ˈɜːrli bɜːrd ˈkætʃɪz ðə wɜːrm/",
  "Kill two birds with one stone": "/kɪl tuː bɜːrdz wɪð wʌn stoʊn/",
  "Actions speak louder than words": "/ˈækʃənz spiːk ˈlaʊdər ðæn wɜːrdz/",
  "On the same page": "/ɒn ðə seɪm peɪdʒ/",
  "Go the extra mile": "/ɡoʊ ðə ˈɛkstrə maɪl/",
  "Bite off more than you can chew": "/baɪt ɒf mɔːr ðæn juː kæn tʃuː/",
  "Hit the nail on the head": "/hɪt ðə neɪl ɒn ðə hɛd/",
  "Let the cat out of the bag": "/lɛt ðə kæt aʊt əv ðə bæɡ/",
  "Burn the midnight oil": "/bɜːrn ðə ˈmɪdnaɪt ɔɪl/",
  "A blessing in disguise": "/ə ˈblɛsɪŋ ɪn dɪsˈɡaɪz/",
  "Speak of the devil": "/spiːk əv ðə ˈdɛvəl/",
  "Costs an arm and a leg": "/kɒsts ən ɑːrm ənd ə lɛɡ/",
  "Get out of hand": "/ɡɛt aʊt əv hænd/",
  "Pull someone's leg": "/pʊl ˈsʌmwʌnz lɛɡ/",
  "Sit on the fence": "/sɪt ɒn ðə fɛns/",
  "Spill the beans": "/spɪl ðə biːnz/",
  "Under the weather": "/ˈʌndər ðə ˈwɛðər/",
  "Call it a day": "/kɔːl ɪt ə deɪ/",
  "Get the ball rolling": "/ɡɛt ðə bɔːl ˈroʊlɪŋ/",
  "Keep your chin up": "/kiːp jʊr tʃɪn ʌp/",
  "Miss the boat": "/mɪs ðə boʊt/",
  "A penny for your thoughts": "/ə ˈpɛni fɔːr jʊr θɔːts/",
  "Barking up the wrong tree": "/ˈbɑːrkɪŋ ʌp ðə rɒŋ triː/",
  "Beat around the bush": "/biːt əˈraʊnd ðə bʊʃ/",
  "Break the ice": "/breɪk ðə aɪs/",
  "Cry over spilt milk": "/kraɪ ˈoʊvər spɪlt mɪlk/",
  "Every dog has its day": "/ˈɛvri dɒɡ hæz ɪts deɪ/",
  "Get a taste of your own medicine": "/ɡɛt ə teɪst əv jʊr oʊn ˈmɛdɪsɪn/",
  "Jump on the bandwagon": "/dʒʌmp ɒn ðə ˈbændˌwæɡən/",
  "Leave no stone unturned": "/liːv noʊ stoʊn ʌnˈtɜːrnd/",
  "Not my cup of tea": "/nɒt maɪ kʌp əv tiː/",
  "Put all your eggs in one basket": "/pʊt ɔːl jʊr ɛɡz ɪn wʌn ˈbæskɪt/",
  "Read between the lines": "/riːd bɪˈtwiːn ðə laɪnz/",
  "See eye to eye": "/siː aɪ tə aɪ/",
  "Take it with a grain of salt": "/teɪk ɪt wɪð ə ɡreɪn əv sɒlt/",
  "The ball is in your court": "/ðə bɔːl ɪz ɪn jʊr kɔːrt/",
  "Throw in the towel": "/θroʊ ɪn ðə ˈtaʊəl/",
  "Turn over a new leaf": "/tɜːrn ˈoʊvər ə njuː liːf/",
  "When pigs fly": "/wɛn pɪɡz flaɪ/",
  "You can't have your cake and eat it too": "/juː kænt hæv jʊr keɪk ənd iːt ɪt tuː/",

  // ═══════════════════════════════════════════════════════════════
  // B1 IDIOMS (40)
  // ═══════════════════════════════════════════════════════════════
  "Bite the bullet": "/baɪt ðə ˈbʊlɪt/",
  "Break the ice": "/breɪk ðə aɪs/",
  "Cost a fortune": "/kɒst ə ˈfɔːrtʃən/",
  "Cut to the chase": "/kʌt tə ðə tʃeɪs/",
  "Get cold feet": "/ɡɛt koʊld fiːt/",
  "Go with the flow": "/ɡoʊ wɪð ðə floʊ/",
  "In the long run": "/ɪn ðə lɒŋ rʌn/",
  "Jump to conclusions": "/dʒʌmp tə kənˈkluːʒənz/",
  "Keep an eye on": "/kiːp ən aɪ ɒn/",
  "Let sleeping dogs lie": "/lɛt ˈsliːpɪŋ dɒɡz laɪ/",
  "Make ends meet": "/meɪk ɛndz miːt/",
  "On thin ice": "/ɒn θɪn aɪs/",
  "Play it by ear": "/pleɪ ɪt baɪ ɪr/",
  "Pull strings": "/pʊl strɪŋz/",
  "Ring a bell": "/rɪŋ ə bɛl/",
  "Sit tight": "/sɪt taɪt/",
  "Take the plunge": "/teɪk ðə plʌndʒ/",
  "The last straw": "/ðə læst strɔː/",
  "Under pressure": "/ˈʌndər ˈprɛʃər/",
  "Weather the storm": "/ˈwɛðər ðə stɔːrm/",
  "A taste of your own medicine": "/ə teɪst əv jʊr oʊn ˈmɛdɪsɪn/",
  "Back to square one": "/bæk tə skwɛr wʌn/",
  "Burn bridges": "/bɜːrn ˈbrɪdʒɪz/",
  "Cross that bridge when you come to it": "/krɒs ðæt brɪdʒ wɛn juː kʌm tə ɪt/",
  "Don't put all your eggs in one basket": "/doʊnt pʊt ɔːl jʊr ɛɡz ɪn wʌn ˈbæskɪt/",
  "Every cloud has a silver lining": "/ˈɛvri klaʊd hæz ə ˈsɪlvər ˈlaɪnɪŋ/",
  "Face the music": "/feɪs ðə ˈmjuːzɪk/",
  "Get the hang of it": "/ɡɛt ðə hæŋ əv ɪt/",
  "Hit the ground running": "/hɪt ðə ɡraʊnd ˈrʌnɪŋ/",
  "It takes two to tango": "/ɪt teɪks tuː tə ˈtæŋɡoʊ/",
  "Keep your eyes peeled": "/kiːp jʊr aɪz piːld/",
  "Leave well enough alone": "/liːv wɛl ɪˈnʌf əˈloʊn/",
  "Miss the point": "/mɪs ðə pɔɪnt/",
  "Nip it in the bud": "/nɪp ɪt ɪn ðə bʌd/",
  "On the tip of my tongue": "/ɒn ðə tɪp əv maɪ tʌŋ/",
  "Put your foot down": "/pʊt jʊr fʊt daʊn/",
  "Read the room": "/riːd ðə ruːm/",
  "Steal the show": "/stiːl ðə ʃoʊ/",
  "The elephant in the room": "/ðə ˈɛlɪfənt ɪn ðə ruːm/",
  "Up in the air": "/ʌp ɪn ðə ɛr/",

  // ═══════════════════════════════════════════════════════════════
  // B2 TIME IDIOMS (10 missing of 40)
  // ═══════════════════════════════════════════════════════════════
  "From time to time": "/frɒm taɪm tə taɪm/",
  "Race against time": "/reɪs əˈɡɛnst taɪm/",
  "Time flies": "/taɪm flaɪz/",
  "Mark time": "/mɑːrk taɪm/",
  "Have the time of your life": "/hæv ðə taɪm əv jʊr laɪf/",
  "In the nick of time": "/ɪn ðə nɪk əv taɪm/",
  "Kill time": "/kɪl taɪm/",
  "Behind the times": "/bɪˈhaɪnd ðə taɪmz/",
  "Time is money": "/taɪm ɪz ˈmʌni/",
  "Ahead of time": "/əˈhɛd əv taɪm/",

  // ═══════════════════════════════════════════════════════════════
  // C1 ADVANCED IDIOMS (40)
  // ═══════════════════════════════════════════════════════════════
  "Move the goalposts": "/muːv ðə ˈɡoʊlpoʊsts/",
  "A double-edged sword": "/ə ˈdʌbəl ɛdʒd sɔːrd/",
  "A watershed moment": "/ə ˈwɔːtərʃɛd ˈmoʊmənt/",
  "Throw someone under the bus": "/θroʊ ˈsʌmwʌn ˈʌndər ðə bʌs/",
  "Have a lot on your plate": "/hæv ə lɒt ɒn jʊr pleɪt/",
  "The tip of the iceberg": "/ðə tɪp əv ðə ˈaɪsbɜːrɡ/",
  "A slippery slope": "/ə ˈslɪpəri sloʊp/",
  "Burn the candle at both ends": "/bɜːrn ðə ˈkændəl ət boʊθ ɛndz/",
  "Cut corners": "/kʌt ˈkɔːrnərz/",
  "Draw the line": "/drɔː ðə laɪn/",
  "Get your act together": "/ɡɛt jʊr ækt təˈɡɛðər/",
  "Go down in flames": "/ɡoʊ daʊn ɪn fleɪmz/",
  "In someone's shoes": "/ɪn ˈsʌmwʌnz ʃuːz/",
  "Jump through hoops": "/dʒʌmp θruː huːps/",
  "Keep your cards close to your chest": "/kiːp jʊr kɑːrdz kloʊs tə jʊr tʃɛst/",
  "Leave no stone unturned": "/liːv noʊ stoʊn ʌnˈtɜːrnd/",
  "Miss the mark": "/mɪs ðə mɑːrk/",
  "Not see the forest for the trees": "/nɒt siː ðə ˈfɒrɪst fɔːr ðə triːz/",
  "Open a can of worms": "/ˈoʊpən ə kæn əv wɜːrmz/",
  "Play devil's advocate": "/pleɪ ˈdɛvəlz ˈædvəkɪt/",
  "Raise the bar": "/reɪz ðə bɑːr/",
  "Read between the lines": "/riːd bɪˈtwiːn ðə laɪnz/",
  "Shoot yourself in the foot": "/ʃuːt jʊrˈsɛlf ɪn ðə fʊt/",
  "Take the bull by the horns": "/teɪk ðə bʊl baɪ ðə hɔːrnz/",
  "The writing on the wall": "/ðə ˈraɪtɪŋ ɒn ðə wɔːl/",
  "Turn a blind eye": "/tɜːrn ə blaɪnd aɪ/",
  "Walk on eggshells": "/wɔːk ɒn ˈɛɡʃɛlz/",
  "Wear many hats": "/wɛr ˈmɛni hæts/",
  "A bitter pill to swallow": "/ə ˈbɪtər pɪl tə ˈswɒloʊ/",
  "Bark up the wrong tree": "/bɑːrk ʌp ðə rɒŋ triː/",
  "Bury the hatchet": "/ˈbɛri ðə ˈhætʃɪt/",
  "Come full circle": "/kʌm fʊl ˈsɜːrkəl/",
  "Drop the ball": "/drɒp ðə bɔːl/",
  "Eat humble pie": "/iːt ˈhʌmbəl paɪ/",
  "Fall on deaf ears": "/fɔːl ɒn dɛf ɪrz/",
  "Get wind of": "/ɡɛt wɪnd əv/",
  "Have an axe to grind": "/hæv ən æks tə ɡraɪnd/",
  "In hot water": "/ɪn hɒt ˈwɔːtər/",
  "Kick the bucket": "/kɪk ðə ˈbʌkɪt/",
  "Let the chips fall where they may": "/lɛt ðə tʃɪps fɔːl wɛr ðeɪ meɪ/",

  // ═══════════════════════════════════════════════════════════════
  // C2 MASTERY IDIOMS (40)
  // ═══════════════════════════════════════════════════════════════
  "A Pyrrhic victory": "/ə ˈpɪrɪk ˈvɪktəri/",
  "Grasp at straws": "/ɡræsp ət strɔːz/",
  "A red herring": "/ə rɛd ˈhɛrɪŋ/",
  "A Catch-22": "/ə kætʃ ˌtwɛntiˈtuː/",
  "Par for the course": "/pɑːr fɔːr ðə kɔːrs/",
  "The Midas touch": "/ðə ˈmaɪdəs tʌtʃ/",
  "A Sisyphean task": "/ə ˌsɪsɪˈfiːən tæsk/",
  "Hobson's choice": "/ˈhɒbsənz tʃɔɪs/",
  "A Faustian bargain": "/ə ˈfaʊstiən ˈbɑːrɡɪn/",
  "Pandora's box": "/pænˈdɔːrəz bɒks/",
  "An Achilles' heel": "/ən əˈkɪliːz hiːl/",
  "A Gordian knot": "/ə ˈɡɔːrdiən nɒt/",
  "Crocodile tears": "/ˈkrɒkədaɪl tɪrz/",
  "A Trojan horse": "/ə ˈtroʊdʒən hɔːrs/",
  "The sword of Damocles": "/ðə sɔːrd əv ˈdæməkliːz/",
  "A Herculean effort": "/ə ˌhɜːrkjəˈliːən ˈɛfərt/",
  "Tilting at windmills": "/ˈtɪltɪŋ ət ˈwɪndmɪlz/",
  "A Kafkaesque situation": "/ə ˌkɑːfkəˈɛsk ˌsɪtʃuˈeɪʃən/",
  "The writing is on the wall": "/ðə ˈraɪtɪŋ ɪz ɒn ðə wɔːl/",
  "A Machiavellian scheme": "/ə ˌmækiəˈvɛliən skiːm/",
  "Crossing the Rubicon": "/ˈkrɒsɪŋ ðə ˈruːbɪkɒn/",
  "A Promethean endeavor": "/ə prəˈmiːθiən ɪnˈdɛvər/",
  "The Sword of Damocles": "/ðə sɔːrd əv ˈdæməkliːz/",
  "A quixotic quest": "/ə kwɪkˈsɒtɪk kwɛst/",
  "Sour grapes": "/saʊr ɡreɪps/",
  "A Draconian measure": "/ə drəˈkoʊniən ˈmɛʒər/",
  "The lion's share": "/ðə ˈlaɪənz ʃɛr/",
  "A Socratic method": "/ə səˈkrætɪk ˈmɛθəd/",
  "Burning bridges": "/ˈbɜːrnɪŋ ˈbrɪdʒɪz/",
  "A Platonic ideal": "/ə pləˈtɒnɪk aɪˈdiːəl/",
  "The Procrustean bed": "/ðə proʊˈkrʌstiən bɛd/",
  "A Carthaginian peace": "/ə ˌkɑːrθəˈdʒɪniən piːs/",
  "An Orwellian nightmare": "/ən ɔːrˈwɛliən ˈnaɪtmɛr/",
  "A Byzantine process": "/ə ˈbɪzəntiːn ˈprɒsɛs/",
  "The Augean stables": "/ðə ɔːˈdʒiːən ˈsteɪbəlz/",
  "A Spartan lifestyle": "/ə ˈspɑːrtən ˈlaɪfstaɪl/",
  "Nero fiddling while Rome burns": "/ˈnɪroʊ ˈfɪdlɪŋ waɪl roʊm bɜːrnz/",
  "A Solomonic decision": "/ə ˌsɒləˈmɒnɪk dɪˈsɪʒən/",
  "The Cassandra complex": "/ðə kəˈsændrə ˈkɒmplɛks/",
  "A Pyrrhonian skepticism": "/ə pɪˈroʊniən ˈskɛptɪsɪzəm/",

  // ═══════════════════════════════════════════════════════════════
  // C2 CRITICAL ANALYSIS VOCABULARY (40)
  // ═══════════════════════════════════════════════════════════════
  "epistemological": "/ɪˌpɪstəməˈlɒdʒɪkəl/",
  "ontological": "/ˌɒntəˈlɒdʒɪkəl/",
  "hermeneutic": "/ˌhɜːrməˈnjuːtɪk/",
  "dialectical": "/ˌdaɪəˈlɛktɪkəl/",
  "heuristic": "/hjʊˈrɪstɪk/",
  "paradigmatic": "/ˌpærədɪɡˈmætɪk/",
  "teleological": "/ˌtɛliəˈlɒdʒɪkəl/",
  "phenomenological": "/fɪˌnɒmɪnəˈlɒdʒɪkəl/",
  "axiological": "/ˌæksiəˈlɒdʒɪkəl/",
  "deontological": "/ˌdiːɒntəˈlɒdʒɪkəl/",
  "syllogistic": "/ˌsɪləˈdʒɪstɪk/",
  "tautological": "/ˌtɔːtəˈlɒdʒɪkəl/",
  "reductionist": "/rɪˈdʌkʃənɪst/",
  "deterministic": "/dɪˌtɜːrmɪˈnɪstɪk/",
  "empiricist": "/ɪmˈpɪrɪsɪst/",
  "positivist": "/ˈpɒzɪtɪvɪst/",
  "constructivist": "/kənˈstrʌktɪvɪst/",
  "relativist": "/ˈrɛlətɪvɪst/",
  "nihilistic": "/ˌnaɪɪˈlɪstɪk/",
  "utilitarian": "/juːˌtɪlɪˈtɛriən/",
  "pragmatist": "/ˈpræɡmətɪst/",
  "existentialist": "/ˌɛɡzɪˈstɛnʃəlɪst/",
  "structuralist": "/ˈstrʌktʃərəlɪst/",
  "post-structuralist": "/poʊst ˈstrʌktʃərəlɪst/",
  "deconstructionist": "/ˌdiːkənˈstrʌkʃənɪst/",
  "functionalist": "/ˈfʌŋkʃənəlɪst/",
  "materialist": "/məˈtɪriəlɪst/",
  "idealist": "/aɪˈdiːəlɪst/",
  "rationalist": "/ˈræʃənəlɪst/",
  "solipsistic": "/ˌsɒlɪpˈsɪstɪk/",
  "anachronistic": "/əˌnækrəˈnɪstɪk/",
  "antithetical": "/ˌæntɪˈθɛtɪkəl/",
  "dichotomous": "/daɪˈkɒtəməs/",
  "hegemonic": "/ˌhɛdʒɪˈmɒnɪk/",
  "idiosyncratic": "/ˌɪdiəsɪŋˈkrætɪk/",
  "juxtaposed": "/ˌdʒʌkstəˈpoʊzd/",
  "multifaceted": "/ˌmʌltɪˈfæsɪtɪd/",
  "ubiquitous": "/juːˈbɪkwɪtəs/",
  "vicarious": "/vaɪˈkɛriəs/",
  "zeitgeist": "/ˈtsaɪtɡaɪst/",

  // ═══════════════════════════════════════════════════════════════
  // PARTIAL GAPS — individual vocabulary words across levels
  // ═══════════════════════════════════════════════════════════════

  // A1
  "Towel": "/ˈtaʊəl/",
  "Alarm": "/əˈlɑːrm/",
  "Lunch box": "/lʌntʃ bɒks/",
  "Notebook": "/ˈnoʊtbʊk/",
  "Eraser": "/ɪˈreɪsər/",
  "Pencil": "/ˈpɛnsəl/",
  "Backpack": "/ˈbækpæk/",

  // A2
  "Mother-in-law": "/ˈmʌðər ɪn lɔː/",
  "Father-in-law": "/ˈfɑːðər ɪn lɔː/",
  "Son-in-law": "/ˈsʌn ɪn lɔː/",
  "Daughter-in-law": "/ˈdɔːtər ɪn lɔː/",
  "Godfather": "/ˈɡɒdˌfɑːðər/",
  "Godmother": "/ˈɡɒdˌmʌðər/",
  "Fence": "/fɛns/",
  "Hallway": "/ˈhɔːlweɪ/",
  "Fireplace": "/ˈfaɪərpleɪs/",
  "Curtain": "/ˈkɜːrtən/",
  "Rug": "/rʌɡ/",
  "Basement": "/ˈbeɪsmənt/",
  "Attic": "/ˈætɪk/",
  "Porch": "/pɔːrtʃ/",
  "Driveway": "/ˈdraɪvweɪ/",
  "Mailbox": "/ˈmeɪlbɒks/",
  "Doorbell": "/ˈdɔːrbɛl/",
  "Chimney": "/ˈtʃɪmni/",
  "Gutter": "/ˈɡʌtər/",
  "Diet": "/ˈdaɪət/",
  "Exercise": "/ˈɛksərsaɪz/",
  "Checkup": "/ˈtʃɛkʌp/",
  "Wellness": "/ˈwɛlnəs/",
  "Folklore": "/ˈfoʊklɔːr/",
  "Heritage": "/ˈhɛrɪtɪdʒ/",
  "Tradition": "/trəˈdɪʃən/",
  "Jogging": "/ˈdʒɒɡɪŋ/",
  "Skating": "/ˈskeɪtɪŋ/",
  "Volunteering": "/ˌvɒlənˈtɪrɪŋ/",
  "Stretching": "/ˈstrɛtʃɪŋ/",

  // B1
  "Landmark": "/ˈlændmɑːrk/",
  "Layover": "/ˈleɪoʊvər/",
  "Internship": "/ˈɪntɜːrnʃɪp/",
  "Networking": "/ˈnɛtwɜːrkɪŋ/",
  "Enrollment": "/ɪnˈroʊlmənt/",
  "Infrastructure": "/ˈɪnfrəstrʌktʃər/",
  "Demographic": "/ˌdɛməˈɡræfɪk/",
  "Advocacy": "/ˈædvəkəsi/",
  "Phenomenon": "/fɪˈnɒmɪnən/",
  "Sustainability": "/səˌsteɪnəˈbɪləti/",
  "Installment": "/ɪnˈstɔːlmənt/",
  "Overdraft": "/ˈoʊvərdrɑːft/",

  // B2
  "Cardigan": "/ˈkɑːrdɪɡən/",
  "Blazer": "/ˈbleɪzər/",
  "Resentment": "/rɪˈzɛntmənt/",
  "Gratitude": "/ˈɡrætɪtjuːd/",
  "Nostalgia": "/nɒˈstældʒə/",
  "Empathy": "/ˈɛmpəθi/",
  "Underdog": "/ˈʌndərdɒɡ/",
  "Disruptive": "/dɪsˈrʌptɪv/",
  "Sustainable": "/səˈsteɪnəbəl/",
  "Trajectory": "/trəˈdʒɛktəri/",
  "Catalyst": "/ˈkætəlɪst/",
  "Feasibility": "/ˌfiːzəˈbɪləti/",

  // C1
  "Procurement": "/prəˈkjʊərmənt/",
  "Turnover": "/ˈtɜːrnoʊvər/",
  "Stakeholder": "/ˈsteɪkhoʊldər/",
  "Commuter": "/kəˈmjuːtər/",
  "Household chores": "/ˈhaʊshoʊld tʃɔːrz/",
  "Mitigate": "/ˈmɪtɪɡeɪt/",
  "Alleviate": "/əˈliːvieɪt/",
  "Pragmatism": "/ˈpræɡmətɪzəm/",
  "Antithesis": "/ænˈtɪθəsɪs/",
  "Extrapolate": "/ɪkˈstræpəleɪt/",
  "Proliferate": "/prəˈlɪfəreɪt/",
  "Pragmatic": "/præɡˈmætɪk/",
  "Paradigm": "/ˈpærədaɪm/",
  "Biodiversity": "/ˌbaɪoʊdaɪˈvɜːrsəti/",
  "Deforestation": "/diːˌfɒrɪˈsteɪʃən/",
  "Migratory": "/ˈmaɪɡrətɔːri/",
  "Vertebrate": "/ˈvɜːrtɪbrɪt/",

  // C2
  "Hermeneutics": "/ˌhɜːrməˈnjuːtɪks/",
  "Phenomenology": "/fɪˌnɒmɪˈnɒlədʒi/",
  "Semiotics": "/ˌsɛmiˈɒtɪks/",
  "Taxonomy": "/tækˈsɒnəmi/",
  "Syllogism": "/ˈsɪlədʒɪzəm/",
  "Epistemology": "/ɪˌpɪstəˈmɒlədʒi/",
  "Ontology": "/ɒnˈtɒlədʒi/",
  "Dialectics": "/ˌdaɪəˈlɛktɪks/",
  "Teleology": "/ˌtɛliˈɒlədʒi/",
  "Ameliorate": "/əˈmiːliəreɪt/",
  "Obfuscate": "/ˈɒbfʌskeɪt/",
  "Adjudicate": "/əˈdʒuːdɪkeɪt/",
  "Expunge": "/ɪkˈspʌndʒ/",
  "Abrogate": "/ˈæbrəɡeɪt/",
  "Promulgate": "/ˈprɒməlɡeɪt/",
  "Zeitgeist": "/ˈtsaɪtɡaɪst/",
  "Hubris": "/ˈhjuːbrɪs/",
  "Laconic": "/ləˈkɒnɪk/",
  "Perspicacious": "/ˌpɜːrspɪˈkeɪʃəs/",
  "Recalcitrant": "/rɪˈkælsɪtrənt/",
  "Sycophantic": "/ˌsɪkəˈfæntɪk/",
};

// ── Apply fixes ──
let totalFixed = 0;
let filesFixed = 0;

for (const mod of modules.filter(m => m.learningMode === 'flashcard')) {
  const filePath = join(ROOT, 'public', mod.dataPath);
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch { continue; }

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
    const missing = data.filter(i => !i.ipa).length;
    const status = missing === 0 ? '✅' : `⚠ ${missing} still missing`;
    console.log(`  ${status} ${mod.id} (+${data.filter(i => IPA[i.front]).length} IPA)`);
  }
}

console.log(`\nFixed: ${totalFixed} items in ${filesFixed} files`);

// Check remaining
let remaining = 0;
const stillMissing = [];
for (const mod of modules.filter(m => m.learningMode === 'flashcard')) {
  try {
    const data = JSON.parse(readFileSync(join(ROOT, 'public', mod.dataPath), 'utf-8'));
    const miss = data.filter(i => !i.ipa);
    if (miss.length > 0) {
      remaining += miss.length;
      stillMissing.push({ id: mod.id, missing: miss.map(i => i.front) });
    }
  } catch {}
}

if (remaining > 0) {
  console.log(`\n⚠ Still missing IPA: ${remaining} items`);
  for (const s of stillMissing) {
    console.log(`  ${s.id}: ${s.missing.join(', ')}`);
  }
} else {
  console.log('\n✅ All flashcard items now have IPA');
}
