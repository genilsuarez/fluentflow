#!/usr/bin/env node
/**
 * Fix quiz options length pattern - makes wrong options more descriptive
 * so the correct answer isn't identifiable by being the longest option.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

function findQuizFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findQuizFiles(full));
    else if (entry.name.includes('quiz') && entry.name.endsWith('.json')) results.push(full);
  }
  return results;
}

const files = findQuizFiles('public/data');
let totalFixed = 0;
let totalQuestions = 0;

// Map of short wrong options to longer, more descriptive versions
// These are contextually appropriate expansions
const expansions = {
  // Literal/physical interpretations (make them sound more plausible)
  'animals are falling': 'animals are literally falling from the sky',
  'it is sunny': 'the weather is bright and sunny outside',
  'cats and dogs are playing': 'cats and dogs are playing together outside',
  'a type of dessert': 'a specific type of layered dessert',
  'something expensive': 'something that costs a lot of money',
  'a birthday party': 'a celebration for someone\'s birthday',
  'bad luck': 'a wish for bad luck and misfortune',
  'to get hurt': 'a warning that you might get hurt',
  'to run fast': 'an encouragement to run as fast as possible',
  'I don\'t like tea': 'I don\'t enjoy drinking tea at all',
  'the tea is cold': 'the tea has become cold and undrinkable',
  'I prefer coffee': 'I would rather have coffee instead',
  'grab something': 'grab onto something nearby for support',
  'run away': 'run away from the current situation',
  'sit down': 'sit down and rest for a while',
  'every night': 'something that happens every single night',
  'when the moon is blue': 'only when the moon appears to be blue',
  'every month': 'something that occurs once every month',
  'outside in rain': 'standing outside in the rain and wind',
  'very happy': 'feeling extremely happy and cheerful',
  'cold': 'feeling physically cold from the temperature',
  'clocks have wings': 'clocks literally have wings and can fly',
  'it is late': 'it is getting very late in the evening',
  'time stops': 'time completely stops and stands still',
  'free': 'completely free and costs nothing at all',
  'cheap': 'very cheap and affordable for everyone',
  'painful': 'physically painful and causes discomfort',
  'close one eye': 'close one eye and look with the other',
  'look away': 'look away and ignore what is happening',
  'sleep': 'go to sleep and rest for the night',
  'throw books': 'physically throw books across the room',
  'go to a library': 'go to a library to browse the shelves',
  'read a novel': 'sit down and read a novel for pleasure',
  'free a cat': 'literally free a cat from inside a bag',
  'open a bag': 'open a bag to see what is inside it',
  'go shopping': 'go shopping at the nearest store',
  'pain is bad': 'all pain is bad and should be avoided',
  'don\'t exercise': 'you should avoid exercising altogether',
  'life is easy': 'life is easy and requires no effort',
  'it is far away': 'the destination is very far away from here',
  'it is finished': 'the task is completely finished and done',
  'keep going': 'keep going and don\'t stop for anything',
  'name the day': 'give a specific name to the current day',
  'start early': 'start working very early in the morning',
  'make a phone call': 'pick up the phone and make a call',
  'be on time': 'always be on time and never arrive late',
  'never be late': 'you should never be late for anything',
  'time is money': 'time is as valuable as money itself',
  'play football': 'start playing football with your friends',
  'throw a ball': 'throw a ball as far as you possibly can',
  'stop playing': 'stop playing and take a break instead',
  'sleep well': 'get a good night\'s sleep and rest well',
  'go to bed early': 'go to bed early to get enough rest',
  'use a pillow': 'use a comfortable pillow to sleep on',
  'very likely': 'very likely to happen in the near future',
  'a long distance': 'a very long distance from one place to another',
  'a photograph': 'a photograph taken from a long distance',
  'hold onto something': 'hold onto something tightly for support',
  'hang clothes': 'hang clothes on a line to dry them out',
  'wait outside': 'wait outside until someone comes to help',

  // Quiz idioms - b1 everyday situations
  'to make ice cubes': 'to make ice cubes for cold drinks',
  'to cool down': 'to cool down after feeling too warm',
  'to break something': 'to break something into smaller pieces',
  'cook badly': 'to cook a meal very badly and ruin it',
  'make a mess': 'to make a big mess all over the place',
  'plant vegetables': 'to plant vegetables in the garden soil',
  'work on a farm': 'to work on a farm doing manual labour',
  'get angry': 'to get angry and lose your temper quickly',
  'exercise': 'to exercise and work out at the gym',
  'eat metal': 'to literally eat a piece of hard metal',
  'shoot a gun': 'to shoot a gun at a target in the distance',
  'be aggressive': 'to be aggressive and confrontational with others',
  'dessert': 'a sweet dessert served after the main meal',
  'birthday party': 'a party to celebrate someone\'s birthday',
  'sweet food': 'any type of sweet food or confection',
  'free an animal': 'to free an animal from a cage or trap',
  'clean the house': 'to clean the entire house from top to bottom',
  'be dangerous': 'to be dangerous and potentially harmful',
  'require surgery': 'to require surgery at the hospital',
  'be painful': 'to be physically painful and uncomfortable',
  'hunt animals': 'to hunt animals in the wild countryside',
  'be violent': 'to be violent and cause harm to others',
  'throw rocks': 'to throw rocks at a target in the distance',
  'waste fuel': 'to waste fuel by burning it unnecessarily',
  'cook dinner': 'to cook dinner for the whole family tonight',
  'light candles': 'to light candles for a romantic atmosphere',
  'clean up messes': 'to clean up messes around the house',
  'don\'t waste food': 'to avoid wasting food whenever possible',
  'drink more water': 'to drink more water throughout the day',
  'play music': 'to play music on a musical instrument',
  'travel by wagon': 'to travel by wagon across the countryside',
  'play tennis': 'to play a game of tennis at the court',
  'you own a ball': 'you own a ball and keep it at home',
  'you\'re at home': 'you are at home relaxing on the couch',
  'help you walk': 'to help you walk when you are unsteady',
  'hurt you': 'to physically hurt you in some painful way',
  'exercise with you': 'to exercise with you at the gym together',
  'at the airport': 'at the airport waiting for a flight to depart',
  'in the future': 'at some point in the distant future',
  'on a farm': 'on a farm surrounded by animals and crops',
  'need socks': 'you need to put on warm socks right away',
  'feel cold': 'to feel physically cold from the temperature',
  'go outside': 'to go outside into the cold weather',
  'get injured': 'to get injured and need medical attention',
  'dance badly': 'to dance badly and step on people\'s toes',
  'run fast': 'to run as fast as you possibly can',
  'looks religious': 'it looks like something religious or spiritual',
  'is hidden': 'it is hidden away where nobody can find it',
  'is a gift': 'it is a gift wrapped in beautiful paper',
  'use scissors': 'to use scissors to cut something carefully',
  'run after someone': 'to run after someone who is getting away',
  'watch a movie': 'to sit down and watch a movie together',
  'travel far': 'to travel far away from your starting point',
  'drive a car': 'to drive a car along the open highway',

  // More expansions for other quiz files
  'birds eat worms': 'birds eat worms as part of their diet',
  'worms are fast': 'worms are fast and difficult to catch',
  'birds are smart': 'birds are smart and can solve problems',
  'hurt animals': 'to hurt animals in a cruel and harmful way',
  'throw stones': 'to throw stones at objects in the distance',
  'go hunting': 'to go hunting in the forest or countryside',
  'be quiet': 'to be quiet and not say anything at all',
  'speak loudly': 'to speak loudly so everyone can hear you',
  'don\'t talk': 'to not talk and remain completely silent',
  'read the same book': 'to read the same book at the same time',
  'are in the same class': 'to be in the same class at school together',
  'write together': 'to write something together as a team',
  'eat too much': 'to eat too much food at one sitting',
  'have big teeth': 'to have big teeth that are very noticeable',
  'chew slowly': 'to chew your food slowly and carefully',
  'walk far': 'to walk a very long distance on foot',
  'run a race': 'to run a race against other competitors',
  'travel by car': 'to travel by car to a distant destination',
  'clouds are silver': 'the clouds are literally silver in colour',
  'it will rain': 'it will rain heavily later in the afternoon',
  'look at the sky': 'to look up at the sky and watch the clouds',
  'are late for a ship': 'you are late for a ship that has departed',
  'can\'t swim': 'you can\'t swim and are afraid of water',
  'take the wrong bus': 'to take the wrong bus and get lost',
  'perfection is easy': 'perfection is easy and requires no effort',
  'practice is boring': 'practice is boring and not worth the time',
  'be perfect always': 'to be perfect always in everything you do',
  'very cold': 'feeling very cold from the low temperature',
  'on top of ice': 'sitting on top of a block of solid ice',
  'easy to see': 'easy to see and clearly visible to everyone',
  'books are important': 'books are important for gaining knowledge',
  'read more books': 'to read more books to expand your mind',
  'covers are nice': 'book covers are nice and well designed',
  'start a fire': 'to start a fire using matches or a lighter',
  'waste oil': 'to waste oil by pouring it down the drain',
  'cook at midnight': 'to cook a meal at midnight when hungry',
  'a hidden costume': 'a hidden costume worn as a disguise',
  'a religious event': 'a religious event held at the local church',
  'a surprise gift': 'a surprise gift wrapped in colourful paper',
  'is under control': 'the situation is completely under control',
  'is in your hand': 'the object is right there in your hand',
  'is easy': 'the situation is easy and simple to handle',
  'steal something': 'to steal something that belongs to someone else',
  'carry something light': 'to carry something light and easy to hold',
  'work harder': 'to work harder and put in more effort',
  'look at their eyes': 'to look directly at their eyes closely',
  'are the same height': 'you are exactly the same height as them',
  'stare at them': 'to stare at them for a long period of time',
  'pigs can fly': 'pigs can literally fly through the air',
  'hurt their leg': 'to physically hurt their leg by pulling it',
  'help them walk': 'to help them walk by supporting their weight',
  'push them': 'to push them forward in a forceful manner',
  'travel the world': 'to travel the world and visit many countries',
  'be the best': 'to be the best at everything you attempt',
  'live in two places': 'to live in two different places at once',
  'cook food': 'to cook food over an open flame or stove',
  'start a campfire': 'to start a campfire for warmth and light',
  'help someone': 'to help someone with a task or problem',

  // b2 professional idioms
  'start a company': 'to start a new company from scratch',
  'go downstairs': 'to go downstairs to the lower floor',
  'lose money': 'to lose money on a bad investment deal',
  'rest outside': 'to rest outside in the fresh open air',
  'watch a game': 'to watch a game from the sidelines closely',
  'guard a property': 'to guard a property against intruders',
  'the last sentence': 'the very last sentence in a long document',
  'the lowest price': 'the lowest price available on the market',
  'the end of a page': 'the very end of a page in a document',
  'play guitar': 'to play guitar and perform music on stage',
  'do puppet shows': 'to do puppet shows for an audience',
  'a loud phone call': 'a loud phone call that disturbs everyone',
  'a strong person': 'a strong person who can lift heavy things',
  'a hard surface': 'a hard surface that is difficult to scratch',
  'swim in a river': 'to swim in a river on a warm summer day',
  'follow a map': 'to follow a map to reach your destination',
  'move quickly': 'to move quickly from one place to another',
  'a sports statistic': 'a sports statistic from a recent game',
  'a baseball score': 'a baseball score from the latest match',
  'an exact calculation': 'an exact calculation with precise numbers',

  // c1 advanced idioms
  'a large animal': 'a large animal that lives in the wild',
  'a crowded space': 'a crowded space with too many people',
  'an unusual decoration': 'an unusual decoration hanging on the wall',
  'score a goal': 'to score a goal during an important match',
  'rearrange furniture': 'to rearrange furniture in the living room',
  'a weapon': 'a weapon used in battle or combat situations',
  'a sharp tool': 'a sharp tool used for cutting materials',
  'a difficult fight': 'a difficult fight that is hard to win',
  'read very carefully': 'to read very carefully word by word',
  'skip some lines': 'to skip some lines and read ahead quickly',
  'read aloud': 'to read aloud so that everyone can hear',
  'use scissors': 'to use scissors to cut paper or fabric',
  'turn sharply': 'to turn sharply around a tight corner',
  'save paper': 'to save paper by using both sides of it',
  'related to water': 'something related to water or hydrology',
  'a rainy day': 'a rainy day with heavy clouds overhead',
  'a minor event': 'a minor event that nobody really notices',
  'push someone': 'to push someone out of the way forcefully',
  'help someone cross the street': 'to help someone cross the street safely',
  'drive a bus': 'to drive a bus along its regular route',

  // c2 mastery idioms
  'a Greek celebration': 'a Greek celebration with traditional customs',
  'a military strategy': 'a military strategy used in ancient warfare',
  'an easy win': 'an easy win that requires very little effort',
  'collect straw': 'to collect straw from the fields for storage',
  'drink through a straw': 'to drink through a straw from a tall glass',
  'work on a farm': 'to work on a farm doing agricultural tasks',
  'a type of fish': 'a type of fish found in cold ocean waters',
  'a warning sign': 'a warning sign that indicates potential danger',
  'a cooking ingredient': 'a cooking ingredient used in many recipes',
  'sleep on leaves': 'to sleep on leaves spread across the ground',
  'win a prize': 'to win a prize in a competition or contest',
  'plant a garden': 'to plant a garden with flowers and vegetables',
  'a ball game': 'a ball game played with teams on a field',
  'catching something': 'catching something that was thrown to you',
  'a lucky number': 'a lucky number that brings good fortune',
  'a golf term only': 'a golf term only used on the golf course',
  'above average': 'above average and better than most others',
  'below standard': 'below standard and not meeting expectations',
  'an important argument': 'an important argument that needs resolution',
  'a strong opinion': 'a strong opinion held by many people',
  'a legal term': 'a legal term used in courts and law offices',

  // b1 idioms challenge
  'To eat too much food': 'To eat too much food at a single meal',
  'To speak without thinking': 'To speak without thinking about the consequences',
  'To make a difficult decision': 'To make a difficult decision under pressure',
  'You\'re playing a sport': 'You\'re playing a sport at the local court',
  'You have a problem': 'You have a problem that needs to be solved',
  'You need to exercise': 'You need to exercise more to stay healthy',
  'To drive carefully': 'To drive carefully and follow all the rules',
  'To be very precise': 'To be very precise and accurate in your work',
  'To take a shortcut while walking': 'To take a shortcut while walking through the park',
  'Make a mistake': 'Make a mistake that you later come to regret',
  'Build something': 'Build something useful with your own hands',
  'Get angry': 'Get angry and lose your temper over nothing',
  'To free an animal': 'To free an animal that was trapped in a cage',
  'To make a mess': 'To make a mess that is difficult to clean up',
  'To start a problem': 'To start a problem that affects everyone around',
  'Arrive late to work': 'Arrive late to work and miss an important meeting',
  'Forget something': 'Forget something important that you needed to bring',
  'Very cold': 'Feeling very cold from the freezing temperature',
  'Ice skating': 'Ice skating on a frozen lake in the winter',
  'Being careful': 'Being careful and cautious about every decision',
  'Help someone walk': 'Help someone walk when they are feeling unsteady',
  'Make someone fall': 'Make someone fall by tripping them accidentally',
  'Annoy someone': 'Annoy someone by doing something they dislike',
  'To waste food': 'To waste food by throwing it in the rubbish',
  'Something very light': 'Something very light that weighs almost nothing',
  'Outside in bad weather': 'Outside in bad weather without an umbrella',
  'Feeling sad': 'Feeling sad and down about something personal',
  'Very busy': 'Very busy with too many tasks to complete',
  'Flying': 'Flying through the air at a very high altitude',
  'Very expensive': 'Very expensive and far beyond your budget',
  'Impossible': 'Impossible to achieve no matter how hard you try',
  'Set something on fire': 'Set something on fire and watch it burn',
  'Work very hard': 'Work very hard without taking any breaks',
  'Travel a lot': 'Travel a lot and visit many different countries',
  'Feel physically cold': 'Feel physically cold from the low temperature',
  'Walk in snow': 'Walk in snow during the cold winter months',
  'Make a quick decision': 'Make a quick decision without much thought',
  'Start a new trend': 'Start a new trend that everyone follows',
  'Get on a vehicle': 'Get on a vehicle and travel to your destination',
  'Make music': 'Make music by playing a musical instrument',
  'Stand up straight': 'Stand up straight with good posture at all times',
  'Be proud': 'Be proud of your accomplishments and achievements',
  'Look upward': 'Look upward at the sky and admire the view',
  'Be quiet around animals': 'Be quiet around animals so you don\'t scare them',
  'Rest when tired': 'Rest when tired to recover your energy levels',
  'Avoid all conflicts': 'Avoid all conflicts and keep the peace always',
  'Write a summary': 'Write a summary of the main points discussed',
  'End a conversation': 'End a conversation politely and say goodbye',
  'Forget parts of a story': 'Forget parts of a story and leave out details',
  'Exercise always hurts': 'Exercise always hurts when you push yourself hard',
  'Suffering is good': 'Suffering is good because it builds character',
  'Success is impossible': 'Success is impossible without the right support',
  'Every month': 'Every month without fail on the same date',
  'At night': 'At night when the stars are shining brightly',
  'When the moon is blue': 'When the moon appears to be a blue colour',
  'Look at them directly': 'Look at them directly in the eyes closely',
  'Be the same height': 'Be the same height as the person next to you',
  'Understand their vision': 'Understand their vision for the future clearly',
  'Rest outdoors': 'Rest outdoors on a bench in the fresh air',
  'Watch something carefully': 'Watch something carefully without looking away',
  'Stay neutral in sports': 'Stay neutral in sports and not pick a team',
  'You mention something evil': 'You mention something evil or supernatural',
  'You tell a scary story': 'You tell a scary story around the campfire',
  'You gossip about someone': 'You gossip about someone behind their back',
  'Add salt to food': 'Add salt to food to improve its flavour',
  'Accept something easily': 'Accept something easily without any questions',
  'Be very skeptical': 'Be very skeptical and doubt everything you hear',
  'Traveling to two places': 'Traveling to two places at the same time',
  'Being very lucky': 'Being very lucky and fortunate in every way',
  'Having two jobs': 'Having two jobs to earn extra income each month',
  'Through difficult terrain': 'Through difficult terrain that is hard to cross',
  'Losing and gaining weight': 'Losing and gaining weight over a long period',
  'Very quickly': 'Very quickly without any delay or hesitation',
  'Solve a problem': 'Solve a problem that has been bothering everyone',
  'End a discussion': 'End a discussion and move on to another topic',
  'Change the subject': 'Change the subject to something more interesting',
  'Hurt someone physically': 'Hurt someone physically by twisting their arm',
  'Dance with someone': 'Dance with someone at a party or celebration',
  'Something is possible': 'Something is possible if you work hard enough',
  'Animals can do anything': 'Animals can do anything if they are trained',
  'In the future': 'In the future when technology has advanced further',
  'You\'re very smart': 'You\'re very smart and know a lot of things',
  'Let\'s guess together': 'Let\'s guess together and see who is right',
  'I know but won\'t tell': 'I know the answer but won\'t tell you yet',
};

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let fileFixed = 0;

  for (const q of data) {
    if (!q.options || q.options.length < 2) continue;
    totalQuestions++;

    const correctIdx = typeof q.correct === 'number'
      ? q.correct
      : q.options.indexOf(q.correct);

    if (correctIdx < 0) continue;

    const correctLen = q.options[correctIdx].length;

    // Check if correct answer is notably longer than average of wrong answers
    const wrongLens = q.options
      .filter((_, i) => i !== correctIdx)
      .map(o => o.length);
    const avgWrongLen = wrongLens.reduce((a, b) => a + b, 0) / wrongLens.length;

    // Only fix if correct is >30% longer than average wrong
    if (correctLen <= avgWrongLen * 1.3) continue;

    let changed = false;
    for (let i = 0; i < q.options.length; i++) {
      if (i === correctIdx) continue;
      const opt = q.options[i];
      // Check if this specific option is much shorter than correct
      if (opt.length < correctLen * 0.7) {
        const expanded = expansions[opt];
        if (expanded && expanded.length >= correctLen * 0.6) {
          q.options[i] = expanded;
          changed = true;
        }
      }
    }

    if (changed) fileFixed++;
  }

  if (fileFixed > 0) {
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`✅ ${file}: fixed ${fileFixed} questions`);
    totalFixed += fileFixed;
  }
}

console.log(`\n📊 Total: ${totalFixed} questions fixed across ${files.length} files (${totalQuestions} total questions)`);
