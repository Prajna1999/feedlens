window.FL = window.FL || {}; var FL = window.FL;

const TOPIC_KEYWORDS = {
  politics:      ['election','vote','congress','senate','president','government','democrat','republican','policy','political','parliament','minister','legislation','protest','activist','campaign'],
  news:          ['breaking','news','report','journalist','media','headline','crisis','update','developing','exclusive','confirmed','sources','official','statement'],
  sports:        ['nba','nfl','nhl','nba','match','game','score','player','team','tournament','champion','league','cricket','football','soccer','tennis','golf','olympics','athlete','stadium','transfer','draft'],
  fitness:       ['workout','gym','fitness','exercise','training','muscle','weight','cardio','yoga','run','lift','gains','reps','sets','physique','crossfit','hiit','marathon','stretch'],
  food:          ['recipe','cook','food','eat','restaurant','meal','breakfast','lunch','dinner','chef','bake','cuisine','dish','delicious','yummy','tasty','vegan','keto','snack','coffee'],
  travel:        ['travel','trip','vacation','destination','explore','adventure','tour','hotel','flight','wanderlust','passport','abroad','backpack','itinerary','resort','beach','mountain','city'],
  fashion:       ['fashion','outfit','style','wear','clothes','ootd','model','brand','trend','accessories','designer','collection','streetwear','vintage','aesthetic','lookbook','haul'],
  tech:          ['tech','ai','software','code','developer','startup','product','app','digital','innovation','machine learning','data','cybersecurity','blockchain','cloud','programming','engineer','gadget','review'],
  gaming:        ['game','gaming','gamer','stream','twitch','esports','fps','rpg','console','pc','playstation','xbox','nintendo','speedrun','minecraft','fortnite','valorant','league of legends'],
  music:         ['music','song','album','artist','band','concert','release','playlist','rap','pop','indie','rock','hiphop','edm','vinyl','acoustic','lyrics','cover','remix','tour'],
  entertainment: ['movie','film','tv','show','actor','celebrity','drama','comedy','series','trailer','review','cinema','streaming','netflix','anime','binge','oscars','grammy'],
  education:     ['learn','study','school','university','course','tutorial','explain','science','math','history','lecture','research','academic','degree','scholarship','knowledge','teach'],
  health:        ['health','mental','wellness','therapy','doctor','medicine','diet','nutrition','self-care','sleep','anxiety','depression','mindfulness','hospital','diagnosis','symptom','treatment'],
  business:      ['business','entrepreneur','startup','invest','stock','market','money','finance','crypto','bitcoin','revenue','profit','funding','pitch','saas','b2b','marketing','sales'],
  humor:         ['funny','meme','joke','lol','comedy','laugh','hilarious','viral','prank','roast','sarcasm','parody','satire','absurd'],
  beauty:        ['makeup','skincare','beauty','cosmetics','hair','nails','tutorial','glow','foundation','lipstick','serum','moisturizer','routine','selfcare','salon'],
  family:        ['family','kids','parenting','baby','mom','dad','children','pregnancy','toddler','newborn','motherhood','fatherhood','siblings'],
  relationships: ['relationship','dating','love','partner','marriage','breakup','friendship','toxic','boundaries','communication','advice','romance','single']
};

FL.inferTopics = function inferTopics(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) matched.push(topic);
  }
  return matched;
};

FL.extractHashtags = function extractHashtags(text) {
  if (!text) return [];
  return (text.match(/#[\wÀ-ɏЀ-ӿ]+/g) || []).map(h => h.slice(1).toLowerCase());
};

FL.extractMentions = function extractMentions(text) {
  if (!text) return [];
  return (text.match(/@[\w.]+/g) || []).map(m => m.slice(1).toLowerCase());
};
