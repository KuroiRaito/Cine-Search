// Source of truth for the golden query set.  npm run eval:build-set
//
// Tuple: [query, category, answer_type, intended]
//   answer_type  k = known_item (one right answer -> MRR)
//                o = open_set   (many acceptable -> P@5 / coverage)
//                x = not_in_catalogue (excluded from scoring, reported as gap)
//   intended     human-readable target, resolved to TMDB ids by resolve.mjs.
//                Written from what the USER meant, never from what the app returns.
//
// Weights follow docs/BRIEF.md section 4, Phase 1.1, deliberately skewed toward
// Indian / transliterated / situational queries: that is where TMDB's title index
// actually fails, and where the target role's problem space lives.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const Q = [
// ---- exact_title (15) ----
['inception','exact_title','k','Inception (2010)'],
['breaking bad','exact_title','k','Breaking Bad (2008 series)'],
['the dark knight','exact_title','k','The Dark Knight (2008)'],
['3 idiots','exact_title','k','3 Idiots (2009)'],
['gully boy','exact_title','k','Gully Boy (2019)'],
['the office','exact_title','o','The Office US (2005) or UK (2001)'],
['parasite','exact_title','k','Parasite (2019)'],
['sacred games','exact_title','k','Sacred Games (2018 series)'],
['rrr','exact_title','k','RRR (2022)'],
['interstellar','exact_title','k','Interstellar (2014)'],
['money heist','exact_title','k','Money Heist / La Casa de Papel (2017 series)'],
['dangal','exact_title','k','Dangal (2016)'],
['the family man','exact_title','k','The Family Man (2019 Indian series)'],
['spirited away','exact_title','k','Spirited Away (2001)'],
['kantara','exact_title','k','Kantara (2022)'],
// ---- typo (20) ----
['intersteller','typo','k','Interstellar (2014)'],
['avengers endgaem','typo','k','Avengers: Endgame (2019)'],
['brekaing bad','typo','k','Breaking Bad (2008 series)'],
['inceptoin','typo','k','Inception (2010)'],
['the dark knigt','typo','k','The Dark Knight (2008)'],
['shawshank redemtion','typo','k','The Shawshank Redemption (1994)'],
['pulp ficiton','typo','k','Pulp Fiction (1994)'],
['gladaitor','typo','k','Gladiator (2000)'],
['titanc','typo','k','Titanic (1997)'],
['jurrasic park','typo','k','Jurassic Park (1993)'],
['bahubali','typo','k','Baahubali: The Beginning (2015)'],
['dangl','typo','k','Dangal (2016)'],
['3 idoits','typo','k','3 Idiots (2009)'],
['stanger things','typo','k','Stranger Things (2016 series)'],
['game of thornes','typo','k','Game of Thrones (2011 series)'],
['the godfater','typo','k','The Godfather (1972)'],
['forest gump','typo','k','Forrest Gump (1994)'],
['sholey','typo','k','Sholay (1975)'],
['zindagi na milegi dubara','typo','k','Zindagi Na Milegi Dobara (2011)'],
['kgf chapter two','typo','k','K.G.F: Chapter 2 (2022)'],
// ---- partial (10) ----
['dark kni','partial','k','The Dark Knight (2008)'],
['game of thr','partial','k','Game of Thrones (2011 series)'],
['shawsha','partial','k','The Shawshank Redemption (1994)'],
['intersta','partial','k','Interstellar (2014)'],
['breaking b','partial','k','Breaking Bad (2008 series)'],
['the family m','partial','k','The Family Man (2019 Indian series)'],
['lord of the ri','partial','o','Lord of the Rings films'],
['harry pot','partial','o','Harry Potter films'],
['stranger th','partial','k','Stranger Things (2016 series)'],
['kabhi khushi','partial','k','Kabhi Khushi Kabhie Gham (2001)'],
// ---- person_led (15) ----
['christopher nolan movies','person_led','o','Films directed by Christopher Nolan'],
['movies with tom hanks','person_led','o','Films starring Tom Hanks'],
['shah rukh khan','person_led','o','Films starring Shah Rukh Khan'],
['tarantino','person_led','o','Films directed by Quentin Tarantino'],
['scorsese films','person_led','o','Films directed by Martin Scorsese'],
['aamir khan movies','person_led','o','Films starring Aamir Khan'],
['films by wes anderson','person_led','o','Films directed by Wes Anderson'],
['leonardo dicaprio','person_led','o','Films starring Leonardo DiCaprio'],
['rajkumar hirani','person_led','o','Films directed by Rajkumar Hirani'],
['anurag kashyap movies','person_led','o','Films directed by Anurag Kashyap'],
['brad pitt','person_led','o','Films starring Brad Pitt'],
['deepika padukone','person_led','o','Films starring Deepika Padukone'],
['denis villeneuve','person_led','o','Films directed by Denis Villeneuve'],
['nawazuddin siddiqui','person_led','o','Films starring Nawazuddin Siddiqui'],
['greta gerwig movies','person_led','o','Films directed by Greta Gerwig'],
// ---- franchise (10) ----
['avengers all parts','franchise','o','The four Avengers films'],
['harry potter in order','franchise','o','The eight Harry Potter films'],
['lord of the rings trilogy','franchise','o','The three LOTR films'],
['mission impossible movies','franchise','o','Mission: Impossible series'],
['john wick series','franchise','o','John Wick series'],
['baahubali all parts','franchise','o','Baahubali 1 and 2'],
['dhoom series','franchise','o','Dhoom 1/2/3'],
['the hunger games movies','franchise','o','Hunger Games series'],
['star wars movies','franchise','o','Star Wars saga films'],
['golmaal series','franchise','o','Golmaal series'],
// ---- hinglish (15) ----
['salman bhai ki movie','hinglish','o','Films starring Salman Khan'],
['hindi comedy picture','hinglish','o','Hindi-language comedies'],
['koi acchi thriller movie','hinglish','o','Well-rated thrillers'],
['shahrukh ki romantic film','hinglish','o','SRK romance films'],
['bhaijaan','hinglish','k','Bajrangi Bhaijaan (2015)'],
['dil chahta hai','hinglish','k','Dil Chahta Hai (2001)'],
['kuch kuch hota hai','hinglish','k','Kuch Kuch Hota Hai (1998)'],
['paisa vasool action movie','hinglish','o','Crowd-pleasing action films'],
['purani hindi filme','hinglish','o','Classic-era Hindi films'],
['south ki action movie','hinglish','o','South Indian action films'],
['bacchon ke liye movie','hinglish','o','Family / kids films'],
['rajinikanth ki picture','hinglish','o','Films starring Rajinikanth'],
['comedy film hindi mein','hinglish','o','Hindi comedies'],
['sad hindi movie','hinglish','o','Emotional Hindi dramas'],
['tamil thriller padam','hinglish','o','Tamil thrillers'],
// ---- mood (20) ----
['something light for a sunday','mood','o','Light, easy watches'],
['sad war movie','mood','o','Emotionally heavy war films'],
['watch with parents','mood','o','Broad-appeal family-safe films'],
['feel good movie','mood','o','Uplifting films'],
['something scary but not too scary','mood','o','Mild horror / thriller'],
['movie to cry to','mood','o','Tearjerkers'],
['background noise show','mood','o','Low-attention sitcoms'],
['something dramatic but not emotionally exhausting','mood','o','Engaging but light drama'],
['funny movie to watch with friends','mood','o','Group comedies'],
['mind bending thriller','mood','o','Twisty psychological thrillers'],
['cozy winter movie','mood','o','Warm seasonal films'],
['movie after a breakup','mood','o','Comfort / recovery films'],
['something to watch while eating','mood','o','Low-commitment viewing'],
['uplifting movie','mood','o','Inspirational films'],
['dark comedy','mood','o','Dark comedies'],
['feel good indian movie','mood','o','Uplifting Indian films'],
['movie for a rainy day','mood','o','Cosy indoor watches'],
['something with my kids','mood','o','Kids / family films'],
['intense psychological thriller','mood','o','Psychological thrillers'],
['relaxing nature documentary','mood','o','Nature documentaries'],
// ---- plot_recall (10) ----
['movie where guy loses his memory','plot_recall','k','Memento (2000)'],
['kid alone at home christmas','plot_recall','k','Home Alone (1990)'],
['movie about dreams within dreams','plot_recall','k','Inception (2010)'],
['man stranded on mars','plot_recall','k','The Martian (2015)'],
['boy raised by animals in the jungle','plot_recall','o','The Jungle Book adaptations'],
['movie about a chess prodigy','plot_recall','o','The Queens Gambit (2020) / Queen of Katwe (2016)'],
['time loop same day repeating','plot_recall','o','Groundhog Day (1993) / Edge of Tomorrow (2014)'],
['shark attacks a beach town','plot_recall','k','Jaws (1975)'],
['father trains his daughters to wrestle','plot_recall','k','Dangal (2016)'],
['man talks to a volleyball on an island','plot_recall','k','Cast Away (2000)'],
// ---- attribute (5) ----
['movies under 2 hours','attribute','o','Films with runtime < 120 min'],
['released this year','attribute','o','Films released in the current year'],
['movies from the 90s','attribute','o','Films released 1990-1999'],
['telugu movies rated above 8','attribute','o','Telugu films with rating > 8'],
['tv shows with only one season','attribute','o','Single-season series'],
];

const TYPE = { k: 'known_item', o: 'open_set', x: 'not_in_catalogue' };

const queries = Q.map(([query, category, t, intended], i) => ({
    id: `q${String(i + 1).padStart(3, '0')}`,
    query, category,
    answer_type: TYPE[t],
    intended,
    expected: [],        // filled by resolve.mjs (auto) + label.html (human)
    labelled_by: null,
    notes: '',
}));

const counts = queries.reduce((a, q) => (a[q.category] = (a[q.category] || 0) + 1, a), {});
const out = join(dirname(fileURLToPath(import.meta.url)), 'queries.json');
writeFileSync(out, JSON.stringify({
    version: 1,
    created: new Date().toISOString(),
    total: queries.length,
    counts,
    queries,
}, null, 2));

console.log(`\n  eval/queries.json — ${queries.length} queries`);
for (const [c, n] of Object.entries(counts)) console.log(`    ${c.padEnd(14)} ${n}`);
console.log();
