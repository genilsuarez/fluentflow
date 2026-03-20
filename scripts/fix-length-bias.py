"""
Apply manual fixes to quiz options to eliminate length bias.
Each fix makes at least one wrong option >= correct option length.
"""
import json, os

fixes = {
    'public/data/b1/b1-quiz-idioms-challenge.json': {
        0: {'options': ["To take on more responsibility than you can handle", "To eat too much food at a single meal or sitting", "To speak without thinking about the consequences", "To make a difficult decision under heavy pressure"]},
        1: {'options': ["It's your turn to take action or make a decision", "You're playing a sport with friends or teammates", "You have a problem that needs solving right away", "You need to exercise and stay in better shape"]},
        6: {'options': ["In a risky or dangerous situation", "Very cold and uncomfortable outside", "Ice skating on a frozen lake nearby", "Being careful about every small step"]},
        9: {'options': ["The final problem that makes you lose patience", "The end of a drink that finishes the whole cup", "The final opportunity before everything is over", "Something very light that barely weighs anything"]},
        18: {'options': ["You must work hard to achieve something worthwhile", "Exercise always hurts but it builds your strength", "Suffering is good for building personal character", "Success is impossible without making real sacrifices"]},
        20: {'options': ["Agree with them completely", "Look at them very directly", "Be exactly the same height", "Understand their clear vision"]},
        24: {'options': ["Enjoying the advantages of two different things", "Traveling to two places during the same vacation", "Being very lucky in most situations and events", "Having two jobs under normal daily circumstances"]},
        27: {'options': ["Persuade someone to do something they don't want to do", "Hurt someone physically under very normal circumstances", "Help someone with a difficult task they cannot finish", "Dance with someone at a party or a social gathering"]},
    },
    'public/data/c2/c2-quiz-mastery-assessment.json': {
        0: {'options': ["I wish I was there to help", "I wish I were there to help", "Were I to be there, I would help", "If I was there, I would help out"]},
        2: {'options': ["make a hypothesis first", "create a new hypothesis", "formulate a hypothesis", "build up a hypothesis"]},
        22: {'options': ["Also, we should carefully consider...", "Furthermore, we must thoroughly examine...", "Additionally, it behooves us to consider...", "Moreover, it is incumbent upon us to examine..."]},
        28: {'options': ["This method is better than the other in this particular context", "This approach is superior to the alternative in this given context", "This methodology is clearly preferable to its established counterpart", "This paradigm demonstrates marked ascendancy over its antecedent"]},
        29: {'options': ["However, there are significant problems", "Nevertheless, notable limitations do exist", "Notwithstanding, constraints are clearly evident", "Albeit, certain caveats must be acknowledged"]},
        35: {'options': ["The results might suggest a different interpretation entirely...", "The findings would seem to indicate a contrasting perspective...", "The data would appear to intimate an alternative conclusion...", "The evidence might conceivably be construed as intimating..."]},
        36: {'options': ["Finally, we can conclude with reasonable certainty that...", "Ultimately, we may determine with some confidence that...", "In the final analysis, we might venture to suggest that...", "In the ultimate reckoning, one might be disposed to conclude..."]},
    },
    'public/data/b1/b1-quiz-idioms-everyday-situations.json': {
        15: {'options': ["need warm socks", "become nervous", "feel very cold", "go out quickly"]},
        20: {'options': ["it's about outer space", "it's not complicated", "it's very scientific", "it's quite dangerous"]},
        45: {'options': ["regret something that cannot be undone", "be upset about a minor accident at home", "clean up a mess that was made by someone", "express sadness about a situation at work"]},
        49: {'options': ["difficulty speaking due to hoarseness", "a pet frog stuck inside your throat", "a sore throat that makes you cough", "a sudden cough that won't go away"]},
        70: {'options': ["postpone to a later date", "accept the full invitation", "decline politely but firmly", "ask for much more details"]},
    },
    'public/data/a2/a2-quiz-culture-health-vocab.json': {
        6: {'options': ["a routine visit to the doctor for your health", "a method of payment used at some retail stores", "a competitive event between two or more teams", "a written evaluation given at the local school"]},
        9: {'options': ["something people do for many years in their culture", "a recently created invention or a very modern device", "a type of technology used in daily life and at work", "a kind of medicine prescribed by doctors or nurses"]},
        19: {'options': ["a special event with music, food, or cultural activities", "a regular workday at the office or at your own company", "a type of school where students learn various subjects", "a kind of transport used to travel between major cities"]},
    },
    'public/data/c2/c2-quiz-reading-vocab.json': {
        0: {'options': ["an irresolvable internal contradiction in a text or argument", "a type of literary genre used in classical and modern writing", "a rhetorical device for persuasion in speeches and in essays", "a logical proof used in formal reasoning and argumentation"]},
        1: {'options': ["something with multiple layers of meaning or history", "a single clear message without any hidden complexity", "an ancient language used in historical written texts", "a type of manuscript found in old library archives"]},
        4: {'options': ["a literary description of a visual work of art", "a type of poetry meter used in classical verse", "a philosophical argument about ethics or morals", "a grammatical structure found in complex texts"]},
        18: {'options': ["the structures of subjective experience and consciousness", "physical phenomena only observable under controlled tests", "economic systems as typically understood by most scholars", "political structures found in modern democratic nations"]},
    },
    'public/data/a2/a2-quiz-elementary-idioms.json': {
        6: {'options': ["clouds are silver in ordinary weather cases", "bad situations have something positive", "it will rain heavily in everyday weather", "look at the sky as a very general rule"]},
        9: {'options': ["very cold in everyday usage and context", "only a small part of a bigger problem", "on top of ice for the most part here", "easy to see in ordinary cases around"]},
        16: {'options': ["pigs can really fly", "never / impossible", "in the far future", "at the big airport"]},
        18: {'options': ["travel the world and see many new places", "enjoy advantages of two different things", "be the best at everything you ever try", "live in two places during the same year"]},
    },
    'public/data/a1/a1-quiz-basic-idioms.json': {
        11: {'options': ["release a pet cat", "reveal a secret", "open a large bag", "go out shopping"]},
        16: {'options': ["play some football", "start an activity", "throw a ball away", "stop all playing"]},
    },
    'public/data/a1/a1-quiz-daily-life-vocab.json': {
        12: {'options': ["Do physical activities like football or tennis", "Watch sports on TV at home during the weekend", "Read about sports in newspapers and magazines", "Talk about sports with your friends and family"]},
    },
    'public/data/a1/a1-quiz-everyday-life.json': {
        15: {'options': ["very hot", "lukewarm", "freezing", "very mild"]},
    },
}

total_fixed = 0
files_modified = 0

for filepath, question_fixes in fixes.items():
    if not os.path.exists(filepath):
        print(f"WARNING: {filepath} not found")
        continue
    
    with open(filepath) as f:
        data = json.load(f)
    
    modified = False
    for qi, fix in question_fixes.items():
        if qi >= len(data):
            print(f"WARNING: Q{qi} out of range in {filepath}")
            continue
        
        q = data[qi]
        # Verify correct answer is preserved
        ci_old = q['options'].index(q['correct']) if isinstance(q['correct'], str) else q['correct']
        correct_text = q['options'][ci_old]
        
        new_options = fix['options']
        if correct_text not in new_options:
            print(f"ERROR: correct answer '{correct_text}' not in new options for {filepath} Q{qi}")
            print(f"  New options: {new_options}")
            continue
        
        # Verify new options fix the bias
        new_ci = new_options.index(correct_text)
        new_cl = len(new_options[new_ci])
        new_wrong_max = max(len(o) for j, o in enumerate(new_options) if j != new_ci)
        
        if new_cl > new_wrong_max + 2:
            print(f"WARNING: bias still exists in {filepath} Q{qi}: correct={new_cl}, max_wrong={new_wrong_max}")
        
        q['options'] = new_options
        modified = True
        total_fixed += 1
    
    if modified:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')
        files_modified += 1
        print(f"Fixed: {os.path.basename(filepath)}")

print(f"\nTotal: {total_fixed} questions fixed in {files_modified} files")
