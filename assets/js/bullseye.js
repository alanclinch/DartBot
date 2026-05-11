const CATEGORY_PAIRS = [
  { id: 'faces', name: 'Faces', numbers: [20, 1, 18], double: 18 },
  { id: 'places', name: 'Places', numbers: [18, 4, 13], double: 13 },
  { id: 'sport', name: 'Sport', numbers: [13, 6, 10], double: 6 },
  { id: 'showbiz', name: 'Showbiz', numbers: [2, 15, 10], double: 10 },
  { id: 'spelling', name: 'Spelling', numbers: [15, 2, 17], double: 17 },
  { id: 'science', name: 'Science', numbers: [17, 3, 19], double: 3 },
  { id: 'history', name: 'History', numbers: [19, 7, 16], double: 16 },
  { id: 'books', name: 'Books', numbers: [16, 8, 11], double: 8 },
  { id: 'words', name: 'Words', numbers: [11, 14, 9], double: 14 },
  { id: 'britain', name: 'Britain', numbers: [9, 12, 5], double: 12 },
];

const STANDARD_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const PRIZE_ENGINE = {
  low_tier: ['Hostess Trolley', 'Teasmade', 'SodaStream', 'Canteen of Cutlery', 'Twin-tub Washing Machine', '8-Piece Luggage Set'],
  mid_tier: ['Portable Colour TV', 'VCR Player', 'Electric Lawnmower', 'Sunlounger Set'],
  star_prizes: ['16ft Speedboat', 'Caravan', 'Fiat Uno', 'Holiday in the Algarve', 'Fitted Kitchen'],
};

const QUESTION_HISTORY_KEY = 'dartbot_bullseye_question_history_v1';

const FALLBACK_QUESTIONS = {
  faces: [
    { question: 'Which actor played Del Boy in Only Fools and Horses?', correct_answer: 'David Jason', incorrect_answers: ['Nicholas Lyndhurst', 'John Cleese', 'Ronnie Barker'] },
    { question: 'Who played Mr Bean on television?', correct_answer: 'Rowan Atkinson', incorrect_answers: ['Hugh Laurie', 'Stephen Fry', 'Ricky Gervais'] },
    { question: 'Which singer is known as the Rocket Man?', correct_answer: 'Elton John', incorrect_answers: ['Robbie Williams', 'George Michael', 'Tom Jones'] },
    { question: 'Who was the first woman to serve as UK Prime Minister?', correct_answer: 'Margaret Thatcher', incorrect_answers: ['Theresa May', 'Barbara Castle', 'Harriet Harman'] },
  ],
  places: [
    { question: 'Which city is home to the Clifton Suspension Bridge?', correct_answer: 'Bristol', incorrect_answers: ['Bath', 'Cardiff', 'Exeter'] },
    { question: 'Ben Nevis is in which country?', correct_answer: 'Scotland', incorrect_answers: ['Wales', 'England', 'Ireland'] },
    { question: 'Which UK city is famous for the Cavern Club and The Beatles?', correct_answer: 'Liverpool', incorrect_answers: ['Manchester', 'Leeds', 'Birmingham'] },
    { question: 'Which seaside town is famous for its tower and illuminations?', correct_answer: 'Blackpool', incorrect_answers: ['Brighton', 'Skegness', 'Margate'] },
  ],
  sport: [
    { question: 'How many players start on the pitch for one football team?', correct_answer: '11', incorrect_answers: ['10', '12', '9'] },
    { question: 'The Ashes is contested in which sport?', correct_answer: 'Cricket', incorrect_answers: ['Rugby Union', 'Darts', 'Snooker'] },
    { question: 'In darts, what score is a treble 20 worth?', correct_answer: '60', incorrect_answers: ['40', '50', '80'] },
    { question: 'Which colour is the bullseye on a standard dartboard?', correct_answer: 'Red', incorrect_answers: ['Green', 'Black', 'Yellow'] },
  ],
  showbiz: [
    { question: 'Which band released Bohemian Rhapsody?', correct_answer: 'Queen', incorrect_answers: ['The Beatles', 'Oasis', 'ABBA'] },
    { question: 'Which film features the line "You were only supposed to blow the bloody doors off"?', correct_answer: 'The Italian Job', incorrect_answers: ['Get Carter', 'Zulu', 'Goldfinger'] },
    { question: 'Which TV soap is set in Albert Square?', correct_answer: 'EastEnders', incorrect_answers: ['Coronation Street', 'Emmerdale', 'Hollyoaks'] },
    { question: 'Which British talent show features the golden buzzer?', correct_answer: "Britain's Got Talent", incorrect_answers: ['The Chase', 'Pointless', 'Mastermind'] },
  ],
  spelling: [
    { question: 'Which spelling is correct?', correct_answer: 'Embarrass', incorrect_answers: ['Embarass', 'Embarras', 'Emberass'] },
    { question: 'Which spelling is correct?', correct_answer: 'Separate', incorrect_answers: ['Seperate', 'Seperete', 'Seporate'] },
    { question: 'Which spelling is correct?', correct_answer: 'Definitely', incorrect_answers: ['Definately', 'Definatly', 'Defanitely'] },
    { question: 'Which spelling is correct?', correct_answer: 'Necessary', incorrect_answers: ['Neccessary', 'Necesary', 'Neccesary'] },
  ],
  science: [
    { question: 'What gas do plants absorb from the atmosphere?', correct_answer: 'Carbon dioxide', incorrect_answers: ['Oxygen', 'Nitrogen', 'Helium'] },
    { question: 'What is H2O commonly known as?', correct_answer: 'Water', incorrect_answers: ['Salt', 'Hydrogen', 'Vinegar'] },
    { question: 'What force keeps us on the ground?', correct_answer: 'Gravity', incorrect_answers: ['Magnetism', 'Friction', 'Electricity'] },
    { question: 'Which planet is closest to the Sun?', correct_answer: 'Mercury', incorrect_answers: ['Venus', 'Mars', 'Earth'] },
  ],
  history: [
    { question: 'In which year did the Battle of Hastings take place?', correct_answer: '1066', incorrect_answers: ['1215', '1415', '1666'] },
    { question: 'Who was the monarch during the Spanish Armada?', correct_answer: 'Elizabeth I', incorrect_answers: ['Victoria', 'Henry VIII', 'Mary I'] },
    { question: 'Which wall was built by the Romans across northern England?', correct_answer: "Hadrian's Wall", incorrect_answers: ['Berlin Wall', 'Great Wall', "Offa's Dyke"] },
    { question: 'Who was Prime Minister of Britain during most of World War II?', correct_answer: 'Winston Churchill', incorrect_answers: ['Neville Chamberlain', 'Clement Attlee', 'Harold Wilson'] },
  ],
  books: [
    { question: 'Who wrote The Hobbit?', correct_answer: 'J. R. R. Tolkien', incorrect_answers: ['C. S. Lewis', 'Roald Dahl', 'George Orwell'] },
    { question: 'Sherlock Holmes lived at which fictional address?', correct_answer: '221B Baker Street', incorrect_answers: ['10 Downing Street', 'Privet Drive', 'Pemberley'] },
    { question: 'Who wrote the Harry Potter books?', correct_answer: 'J. K. Rowling', incorrect_answers: ['Jacqueline Wilson', 'Enid Blyton', 'Julia Donaldson'] },
    { question: 'Which Roald Dahl book features a giant peach?', correct_answer: 'James and the Giant Peach', incorrect_answers: ['Matilda', 'The BFG', 'The Twits'] },
  ],
  words: [
    { question: 'What does "benevolent" mean?', correct_answer: 'Kind and well meaning', incorrect_answers: ['Very old', 'Hard to read', 'Likely to break'] },
    { question: 'Which word means a word that sounds like another but has a different meaning?', correct_answer: 'Homophone', incorrect_answers: ['Synonym', 'Antonym', 'Acronym'] },
    { question: 'Which word means the opposite of "ancient"?', correct_answer: 'Modern', incorrect_answers: ['Old', 'Historic', 'Broken'] },
    { question: 'What is a baby cat called?', correct_answer: 'Kitten', incorrect_answers: ['Puppy', 'Calf', 'Foal'] },
  ],
  britain: [
    { question: 'What is the national flower of England?', correct_answer: 'Rose', incorrect_answers: ['Thistle', 'Daffodil', 'Shamrock'] },
    { question: 'Which sea lies east of Great Britain?', correct_answer: 'North Sea', incorrect_answers: ['Irish Sea', 'Celtic Sea', 'Atlantic Ocean'] },
    { question: 'What is the capital city of Wales?', correct_answer: 'Cardiff', incorrect_answers: ['Swansea', 'Newport', 'Wrexham'] },
    { question: 'What is the currency of the United Kingdom?', correct_answer: 'Pound sterling', incorrect_answers: ['Euro', 'Dollar', 'Franc'] },
  ],
  general: [
    { question: 'Which planet is known as the Red Planet?', correct_answer: 'Mars', incorrect_answers: ['Venus', 'Jupiter', 'Saturn'] },
    { question: 'How many sides does a hexagon have?', correct_answer: '6', incorrect_answers: ['5', '7', '8'] },
    { question: 'What is the capital city of France?', correct_answer: 'Paris', incorrect_answers: ['Lyon', 'Marseille', 'Nice'] },
    { question: 'How many days are there in a leap year?', correct_answer: '366', incorrect_answers: ['365', '364', '367'] },
    { question: 'What colour do you get by mixing red and white?', correct_answer: 'Pink', incorrect_answers: ['Purple', 'Orange', 'Brown'] },
    { question: 'How many minutes are there in one hour?', correct_answer: '60', incorrect_answers: ['30', '90', '100'] },
  ],
};

let state = {};
let manualMultiplier = 1;
let voiceEnabled = true;
let seenThrows = 0;
let questionTimer = null;
let pendingQuestion = null;
let throwLog = [];
let missTimer = null;

function freshState() {
  return {
    phase: 'r1',
    team: document.getElementById('team-name')?.value.trim() || 'The Contestants',
    cash: 0,
    prizes: [],
    selectedCategory: null,
    r1DartValue: 0,
    r2Score: 0,
    r2Cycle: 1,
    r2Cycles: 3,
    r3Darts: 0,
    finalScore: 0,
    finalDarts: 0,
    categories: CATEGORY_PAIRS.map(c => ({ ...c, active: true })),
    prizeSlots: buildPrizeBoard().map((name, i) => ({ slot: i + 1, name, won: false })),
    starPrize: pick(PRIZE_ENGINE.star_prizes),
    darts: [],
    gameOver: false,
  };
}

function buildPrizeBoard() {
  const lows = [...PRIZE_ENGINE.low_tier].sort(() => Math.random() - .5);
  const mids = [...PRIZE_ENGINE.mid_tier].sort(() => Math.random() - .5);
  return [lows[0], mids[0], lows[1], mids[1], lows[2], lows[3], mids[2], lows[4]];
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function escapeHTML(str) { return String(str).replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[m])); }
function money(n) { return '&pound;' + Math.max(0, Math.round(n)); }
function questionId(q) { return `${q.question}|${q.correct_answer}`; }

function loadQuestionHistory() {
  try {
    return JSON.parse(localStorage.getItem(QUESTION_HISTORY_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveQuestionHistory(history) {
  try {
    localStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {}
}

function nextQuestion(categoryId) {
  const questions = FALLBACK_QUESTIONS[categoryId] || FALLBACK_QUESTIONS.general;
  const ids = questions.map(questionId);
  const history = loadQuestionHistory();
  const used = Array.isArray(history[categoryId])
    ? history[categoryId].filter(id => ids.includes(id))
    : [];
  let unused = questions.filter(q => !used.includes(questionId(q)));

  if (!unused.length) {
    used.length = 0;
    unused = [...questions];
  }

  const q = pick(unused);
  used.push(questionId(q));
  history[categoryId] = used.slice(-questions.length);
  saveQuestionHistory(history);
  return q;
}

function startGame() {
  state = freshState();
  document.documentElement.requestFullscreen().catch(() => {});
  showScreen('game');
  initRoundOne();
}

function endGame() {
  clearQuestionTimer();
  state.gameOver = true;
  seenThrows = 0;
  showScreen('setup');
}

function initRoundOne() {
  resetManualMultiplier();
  state.phase = 'r1_choose';
  state.selectedCategory = null;
  state.r1DartValue = 0;
  state.darts = [];
  flash("Bully's Category Board", 'var(--gold)');
  renderAll();
  setTimeout(openCategoryChoice, 350);
}

function initRoundTwo() {
  resetManualMultiplier();
  state.phase = 'r2_throw';
  state.r2Cycle = 1;
  state.darts = [];
  state.r2Score = 0;
  flash("Bully's Pounds for Points", 'var(--gold)');
  renderAll();
}

function initRoundThree() {
  resetManualMultiplier();
  state.phase = 'r3';
  state.darts = [];
  state.r3Darts = 0;
  flash("Bully's Prize Board", 'var(--gold)');
  renderAll();
}

function nextPhase() {
  if (pendingQuestion) return;
  if (state.phase === 'r1_choose') return openCategoryChoice();
  if (state.phase === 'r1_throw') return initRoundTwo();
  if (state.phase === 'r2_throw') return finishRoundTwoThrows();
  if (state.phase === 'r2_done') return initRoundThree();
  if (state.phase === 'r3') return offerFinal();
  if (state.phase === 'final') return resolveFinal();
  if (state.phase === 'complete') return endGame();
}

function registerDart(seg) {
  if (!state.phase || state.gameOver || pendingQuestion) return;
  if (state.phase === 'r1_throw') return handleRoundOneDart(seg);
  if (state.phase === 'r2_throw') return handleRoundTwoDart(seg);
  if (state.phase === 'r3') return handleRoundThreeDart(seg);
  if (state.phase === 'final') return handleFinalDart(seg);
}

function handleRoundOneDart(seg) {
  const selected = selectedCategory();
  if (!selected) return openCategoryChoice();
  state.darts = [];
  const num = Number(seg && seg.number) || 0;
  if (num === 25) {
    state.r1DartValue = 200;
    state.cash += state.r1DartValue;
    addDart(seg, 'Bull - 200');
    sfxInOne();
    flash('Bull - 200', 'var(--gold)');
    return askQuestion(selected, 50, correct => {
      if (correct) state.cash += 50;
      setTimeout(initRoundTwo, 900);
    });
  }

  const matchedChoice = selected.numbers.includes(num);
  const hitCategory = matchedChoice
    ? selected
    : state.categories.find(c => c.id !== selected.id && c.numbers.includes(num));
  if (!hitCategory) {
    addDart(seg, 'No category');
    moo();
    flash('No category', 'var(--red)');
    return setTimeout(initRoundTwo, 900);
  }

  const value = matchedChoice ? categoryBoardValue(seg) : 0;
  state.r1DartValue = value;
  if (value) state.cash += value;
  addDart(seg, value ? `${hitCategory.name} - ${value}` : `${hitCategory.name} - bonus only`);
  flash(value ? `${hitCategory.name} - ${money(value).replace('&pound;', '£')}` : `${hitCategory.name} question`, value ? 'var(--gold)' : 'var(--blue)');
  askQuestion(hitCategory, 50, correct => {
    if (correct) state.cash += 50;
    setTimeout(initRoundTwo, 900);
  });
  renderAll();
}

function selectedCategory() {
  return state.categories.find(c => c.id === state.selectedCategory);
}

function categoryBoardValue(seg) {
  const multiplier = Number(seg && seg.multiplier) || 1;
  if (multiplier >= 3) return 100;
  if (multiplier >= 2) return 50;
  return 30;
}

function openCategoryChoice() {
  if (pendingQuestion || state.phase !== 'r1_choose') return;
  document.getElementById('choice-grid').innerHTML = state.categories
    .map(c => `<button class="choice-btn ${c.active ? '' : 'disabled'}" ${c.active ? `onclick="chooseRoundOneCategory('${c.id}')"` : 'disabled'}>${escapeHTML(c.name)}</button>`)
    .join('');
  document.getElementById('choice-modal').classList.add('open');
}

function chooseRoundOneCategory(id) {
  const category = state.categories.find(c => c.id === id);
  if (!category) return;
  document.getElementById('choice-modal').classList.remove('open');
  state.selectedCategory = id;
  category.active = false;
  state.phase = 'r1_throw';
  state.darts = [];
  flash(`Aim for ${category.name}`, 'var(--gold)');
  renderAll();
}

function handleRoundTwoDart(seg) {
  if (state.darts.length >= 3) return;
  const score = segScore(seg);
  state.r2Score += score;
  addDart(seg, String(score));
  sfxHit();
  if (state.darts.length >= 3) setTimeout(finishRoundTwoThrows, 450);
  renderAll();
}

function finishRoundTwoThrows() {
  if (state.phase !== 'r2_throw') return;
  state.phase = 'r2_question';
  const value = state.r2Score;
  askQuestion({ id: 'general', name: 'General Knowledge' }, value, correct => {
    if (correct) state.cash += value;
    if (state.r2Cycle >= state.r2Cycles) {
      state.phase = 'r2_done';
      renderAll();
      setTimeout(initRoundThree, 1200);
    } else {
      state.r2Cycle++;
      state.phase = 'r2_throw';
      state.darts = [];
      state.r2Score = 0;
      flash("Next Pounds for Points throw", 'var(--gold)');
      renderAll();
    }
  });
  renderAll();
}

function handleRoundThreeDart(seg) {
  if (state.r3Darts >= 9) return;
  state.r3Darts++;
  const zone = prizeZone(seg);
  addDart(seg, zone.label);

  if (zone.type === 'miss') {
    moo();
  } else if (zone.type === 'bull') {
    state.prizes.push('Bully Special Prize');
    sfxInOne();
    flash("Bully's Special Prize", 'var(--gold)');
  } else if (zone.type === 'black') {
    sfxBust();
    flash('Black Segment', 'var(--red)');
  } else {
    const slot = state.prizeSlots[zone.slot - 1];
    if (!slot.won) {
      slot.won = true;
      state.prizes.push(slot.name);
      sfxInOne();
      flash('Prize Won', 'var(--gold)');
    } else {
      sfxBust();
      flash('Prize Already Won', 'var(--red)');
    }
  }

  if (state.r3Darts >= 9) setTimeout(offerFinal, 700);
  renderAll();
}

function handleFinalDart(seg) {
  if (state.finalDarts >= 6) return;
  const score = segScore(seg);
  state.finalDarts++;
  state.finalScore += score;
  addDart(seg, String(score));
  if (state.finalScore >= 101) return setTimeout(() => finishGame(true), 450);
  if (state.finalDarts >= 6) setTimeout(resolveFinal, 450);
  renderAll();
}

function offerFinal() {
  state.phase = 'final_offer';
  renderAll();
  document.getElementById('final-title').textContent = 'Gamble?';
  document.getElementById('final-copy').innerHTML = `Keep ${money(state.cash)} and ${state.prizes.length} prize${state.prizes.length === 1 ? '' : 's'}, or gamble for <strong>${escapeHTML(state.starPrize)}</strong>. Score 101 or more with 6 darts to win.`;
  document.getElementById('final-actions').innerHTML = '<button class="primary-btn" onclick="startFinal()">Gamble</button><button class="secondary-btn" onclick="finishGame(false)">Keep Prizes</button>';
  document.getElementById('final-modal').classList.add('open');
}

function startFinal() {
  document.getElementById('final-modal').classList.remove('open');
  resetManualMultiplier();
  state.phase = 'final';
  state.finalScore = 0;
  state.finalDarts = 0;
  state.darts = [];
  sfxInOne();
  renderAll();
}

function resolveFinal() {
  if (state.finalScore >= 101) return finishGame(true);
  state.cash = 0;
  state.prizes = [];
  sfxBust();
  document.getElementById('final-title').textContent = 'Gamble lost';
  document.getElementById('final-copy').innerHTML = `${escapeHTML(state.team)} scored ${state.finalScore}. The star prize was <strong>${escapeHTML(state.starPrize)}</strong>.`;
  document.getElementById('final-actions').innerHTML = '<button class="primary-btn" onclick="finishGame(false)">Finish</button>';
  document.getElementById('final-modal').classList.add('open');
  renderAll();
}

function finishGame(starWon) {
  resetManualMultiplier();
  state.phase = 'complete';
  state.gameOver = true;
  document.getElementById('final-modal').classList.remove('open');
  if (starWon) {
    state.prizes.push(state.starPrize);
    spawnConfetti();
    flash('Star Prize Won!', 'var(--gold)');
  } else {
    flash('Game Complete', 'var(--gold)');
  }
  renderAll();
}

function addDart(seg, label) {
  state.darts.push({ label: isMiss(seg) ? 'Miss' : dartSpeak(seg), sub: label, score: segScore(seg), miss: isMiss(seg) });
}

function prizeZone(seg) {
  const num = Number(seg && seg.number) || 0;
  if (num === 25) return { type: 'bull', label: 'Special Prize' };
  const idx = CATEGORY_PAIRS.findIndex(c => c.numbers.includes(num));
  if (idx < 0 || idx >= 8) return { type: 'miss', label: 'Miss Zone' };
  const pair = CATEGORY_PAIRS[idx];
  if (num === pair.numbers[0]) return { type: 'red', slot: idx + 1, label: 'Prize ' + (idx + 1) };
  return { type: 'black', label: 'Black' };
}

async function askQuestion(category, value, callback) {
  pendingQuestion = { category, value, callback, answered: false };
  const q = nextQuestion(category.id);
  pendingQuestion.question = q;
  showQuestion(q, category, value);
}

function showQuestion(q, category, value) {
  document.getElementById('question-category').textContent = category.name;
  document.getElementById('question-value').innerHTML = money(value);
  document.getElementById('question-text').textContent = q.question;
  const answers = [q.correct_answer, ...q.incorrect_answers].sort(() => Math.random() - .5);
  document.getElementById('answer-grid').innerHTML = answers.map(a => `<button class="answer-btn" data-answer="${escapeHTML(a)}" onclick="answerQuestion(this)">${escapeHTML(a)}</button>`).join('');
  document.getElementById('question-modal').classList.add('open');
  speakBullseye(q.question, true);
  startQuestionTimer();
}

function answerQuestion(btn, answer) {
  if (!pendingQuestion || pendingQuestion.answered) return;
  if (answer === undefined && btn) answer = btn.dataset.answer || '';
  pendingQuestion.answered = true;
  clearQuestionTimer();
  const correct = answer === pendingQuestion.question.correct_answer;
  document.querySelectorAll('.answer-btn').forEach(b => {
    if (b.textContent === pendingQuestion.question.correct_answer) b.classList.add('correct');
  });
  if (!correct && btn) btn.classList.add('wrong');
  if (correct) {
    sfxCheckout();
    flash('Correct!', 'var(--green)');
    speakBullseye('Correct', true);
  } else {
    sfxBust();
    flash('Wrong!', 'var(--red)');
    speakBullseye(`Wrong. The answer was ${pendingQuestion.question.correct_answer}.`, true);
  }
  const done = pendingQuestion.callback;
  setTimeout(() => {
    document.getElementById('question-modal').classList.remove('open');
    pendingQuestion = null;
    done(correct);
    renderAll();
  }, 1100);
}

function startQuestionTimer() {
  clearQuestionTimer();
  let remaining = 15;
  const el = document.getElementById('timer-ring');
  el.textContent = remaining;
  questionTimer = setInterval(() => {
    remaining--;
    el.textContent = remaining;
    if (remaining <= 5) sfxWarn();
    if (remaining <= 0) answerQuestion(null, '');
  }, 1000);
}

function clearQuestionTimer() {
  if (questionTimer) clearInterval(questionTimer);
  questionTimer = null;
}

function renderAll() {
  renderBoard();
  renderSidebars();
  renderManualGrid();
}

function renderBoard() {
  const svg = document.getElementById('bullseye-board');
  if (!svg) return;
  svg.innerHTML = '';
  const center = document.getElementById('board-center-readout');
  const phase = state.phase || 'r1';
  if (center) center.classList.toggle('hidden', phase.startsWith('r1') || phase === 'r3');
  if (phase.startsWith('r1')) return renderCategoryBoard(svg);
  if (phase === 'r3') return renderPrizeBoard(svg);
  renderStandardBoard(svg);
}

function renderCategoryBoard(svg) {
  const cx = 210, cy = 210, step = 360 / CATEGORY_PAIRS.length;
  const outer = 198, labelInner = 166, labelOuter = 198, thirtyInner = 116, fiftyInner = 72, hundredInner = 42;
  CATEGORY_PAIRS.forEach((pair, i) => {
    const start = -90 + i * step, end = start + step - .8, midDeg = start + step / 2;
    const focus = state.selectedCategory
      ? (state.selectedCategory === pair.id ? ' selected-category' : ' dim-category')
      : (pair.active === false ? ' used-category' : '');
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment board-category-band${focus}" d="${ringSlicePath(cx, cy, labelInner, labelOuter, start, end)}"></path>`);
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment board-30${focus}" d="${ringSlicePath(cx, cy, thirtyInner, labelInner, start, end)}"></path>`);
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment board-50${focus}" d="${ringSlicePath(cx, cy, fiftyInner, thirtyInner, start, end)}"></path>`);
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment board-100${focus}" d="${ringSlicePath(cx, cy, hundredInner, fiftyInner, start, end)}"></path>`);
    const label = polar(cx, cy, 181, midDeg);
    const value30 = polar(cx, cy, 141, midDeg);
    const value50 = polar(cx, cy, 94, midDeg);
    const value100 = polar(cx, cy, 56, midDeg);
    svg.insertAdjacentHTML('beforeend', `<text class="board-label category-label" x="${label.x}" y="${label.y}" transform="rotate(${midDeg + 90} ${label.x} ${label.y})">${escapeHTML(pair.name)}</text>`);
    if (i % 2 === 0) {
      svg.insertAdjacentHTML('beforeend', `<text class="board-label value-label muted-value" x="${value30.x}" y="${value30.y}">30</text>`);
      svg.insertAdjacentHTML('beforeend', `<text class="board-label value-label muted-value" x="${value50.x}" y="${value50.y}">50</text>`);
      svg.insertAdjacentHTML('beforeend', `<text class="board-label value-label muted-value" x="${value100.x}" y="${value100.y}">100</text>`);
    }
  });
  svg.insertAdjacentHTML('beforeend', '<circle cx="210" cy="210" r="41" class="board-bull-outer"></circle><circle cx="210" cy="210" r="20" class="board-bull-inner"></circle><text class="board-label bull-value" x="210" y="214">200</text>');
}

function renderPrizeBoard(svg) {
  const cx = 210, cy = 210, outer = 194, inner = 32, step = 360 / 8;
  for (let i = 0; i < 8; i++) {
    const start = -90 + i * step, end = start + step - 1.4, midDeg = start + step / 2;
    const label = polar(cx, cy, 160, midDeg);
    const red = i % 2 === 0;
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment ${red ? 'prize-red' : 'prize-black'}" d="${ringSlicePath(cx, cy, inner, outer, start, end)}"></path>`);
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment prize-inner-slice" d="${ringSlicePath(cx, cy, inner, outer - 62, start + step * .38, end)}"></path>`);
    svg.insertAdjacentHTML('beforeend', `<text class="board-label prize-label" x="${label.x}" y="${label.y}">${i + 1}</text>`);
  }
  svg.insertAdjacentHTML('beforeend', '<circle cx="210" cy="210" r="32" class="prize-hub"></circle>');
}

function renderStandardBoard(svg) {
  const numbers = STANDARD_NUMBERS;
  const cx = 210, cy = 210, outer = 196, inner = 52, step = 360 / numbers.length;
  numbers.forEach((number, i) => {
    const start = -90 + i * step, end = start + step - 1.2;
    const fill = i % 2 ? '#22282f' : '#d52d35';
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment" d="${ringSlicePath(cx, cy, inner, outer, start, end)}" fill="${fill}"></path>`);
    const mid = polar(cx, cy, 176, start + step / 2);
    svg.insertAdjacentHTML('beforeend', `<text class="board-label number-label" x="${mid.x}" y="${mid.y}">${number}</text>`);
  });
  svg.insertAdjacentHTML('beforeend', '<circle cx="210" cy="210" r="45" fill="#df3036" stroke="#f3c742" stroke-width="7"></circle><circle cx="210" cy="210" r="19" fill="#f3c742"></circle>');
}

function ringSlicePath(cx, cy, r0, r1, a0, a1) {
  const p0 = polar(cx, cy, r1, a0), p1 = polar(cx, cy, r1, a1), p2 = polar(cx, cy, r0, a1), p3 = polar(cx, cy, r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y} Z`;
}

function polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return { x: +(cx + r * Math.cos(rad)).toFixed(2), y: +(cy + r * Math.sin(rad)).toFixed(2) };
}

function renderSidebars() {
  if (!document.getElementById('bank-total')) return;
  document.getElementById('display-team').textContent = state.team || 'The Contestants';
  document.getElementById('bank-total').innerHTML = money(state.cash || 0);
  const inv = document.getElementById('inventory-list');
  inv.innerHTML = state.prizes && state.prizes.length
    ? state.prizes.map((p, i) => `<div class="inventory-item"><span>${i + 1}</span><span>${escapeHTML(p)}</span><span>Won</span></div>`).join('')
    : '<div class="inventory-empty">No prizes yet. Keep out of the black and in the red.</div>';

  const phaseText = phaseLabel(state.phase || 'r1');
  document.getElementById('round-title').textContent = phaseText.round;
  document.getElementById('round-title-panel').textContent = phaseText.target;
  document.getElementById('target-copy').innerHTML = phaseText.copy;
  document.getElementById('center-target').textContent = phaseText.center;
  document.getElementById('round-list').innerHTML = [['r1', "Bully's Category Board"], ['r2', "Bully's Pounds for Points"], ['r3', "Bully's Prize Board"], ['final', 'Star Prize Gamble']]
    .map(([key, label]) => `<div class="round-chip ${state.phase && state.phase.startsWith(key) ? 'active' : ''}"><span>${label}</span><span>${roundStatus(key)}</span></div>`).join('');

  const phase = state.phase || 'r1';
  const max = phase === 'final' ? 6 : (phase === 'r3' ? 9 : 3);
  const darts = state.darts || [];
  document.getElementById('dart-slots').innerHTML = Array.from({ length: max }, (_, i) => {
    const d = darts[i];
    return `<div class="dart-slot ${d ? (d.miss ? 'miss' : 'hit') : ''}"><span>${i + 1}</span><span>${d ? `${escapeHTML(d.label)} - ${escapeHTML(d.sub)}` : '-'}</span></div>`;
  }).join('');
  const total = phase === 'final' ? state.finalScore : phase === 'r2_throw' ? state.r2Score : phase === 'r3' ? state.r3Darts : darts.length;
  document.getElementById('turn-total').textContent = phase === 'r3' ? `Darts: ${total}/9` : (phase === 'final' ? `Score: ${total || 0}` : `Total: ${total || 0}`);
}

function phaseLabel(phase) {
  const selected = selectedCategory();
  if (phase === 'r1_choose') return { round: 'Round 1 - Category Board', target: 'Choose a category', center: 'Category', copy: 'Pick the category first. Then throw for that section, or hit bull for 200.' };
  if (phase === 'r1_throw') return { round: 'Round 1 - Category Board', target: `Aim for ${selected ? selected.name : 'category'}`, center: 'Category', copy: selected ? categoryGuide(selected) : 'Choose a category first.' };
  if (phase === 'r2_throw') return { round: `Round 2 - Bully's Pounds for Points ${state.r2Cycle}/${state.r2Cycles}`, target: 'Score as high as possible', center: 'Score', copy: 'Throw three darts on the standard board. A correct answer adds that score to the bank.' };
  if (phase === 'r2_question') return { round: "Round 2 - Bully's Pounds for Points", target: `Question for ${money(state.r2Score)}`, center: 'Quiz', copy: 'Correct answer adds the dart score to the bank. Wrong answer scores nothing.' };
  if (phase === 'r2_done') return { round: 'Round 2 Complete', target: 'Prize board next', center: 'Prizes', copy: 'The cash is banked. Now try to win prizes on the red sectors.' };
  if (phase === 'r3') return { round: 'Round 3 - Prize Board', target: 'Prize board', center: 'Prizes', copy: 'Red wins a prize. Black wins nothing. Already-won red sectors are wasted darts.' };
  if (phase === 'final_offer') return { round: 'Final - Star Prize Gamble', target: 'Gamble decision', center: 'Gamble', copy: `The star prize is ${state.starPrize}.` };
  if (phase === 'final') return { round: 'Final - Star Prize Gamble', target: 'Score 101+', center: '101+', copy: `Six darts for the ${state.starPrize}. Current score: ${state.finalScore}.` };
  if (phase === 'complete') return { round: 'Game Complete', target: 'Game complete', center: 'Done', copy: 'Return to the menu or start again.' };
  return { round: 'Bullseye', target: 'Ready', center: 'Ready', copy: 'Start the game.' };
}

function categoryGuide(category) {
  return `
    <div class="target-guide">
      <div><strong>Numbers</strong><span>${category.numbers.join(', ')}</span></div>
      <div><strong>Doubles</strong><span>${category.double}</span></div>
      <div><strong>Outer Segment</strong><span>30</span></div>
      <div><strong>Treble</strong><span>50</span></div>
      <div><strong>Inner Segment</strong><span>100</span></div>
      <div><strong>Bull</strong><span>200</span></div>
    </div>
  `;
}

function roundStatus(key) {
  const phase = state.phase || 'r1';
  const order = { r1: 1, r2: 2, r3: 3, final: 4 };
  const current = phase.startsWith('r2') ? 2 : phase.startsWith('r3') ? 3 : phase.startsWith('final') || phase === 'complete' ? 4 : 1;
  if (phase === 'complete') return 'Done';
  if (order[key] < current) return 'Done';
  if (order[key] === current) return 'Live';
  return 'Next';
}

function renderManualGrid() {
  const grid = document.getElementById('manual-grid');
  if (!grid || grid.dataset.ready) return;
  grid.innerHTML = Array.from({ length: 20 }, (_, i) => `<button class="num-btn" onclick="manualDart(${i + 1})">${i + 1}</button>`).join('') +
    '<button class="num-btn" onclick="manualDart(25)">Bull</button><button class="num-btn" onclick="manualDart(50)">Bullseye</button>';
  grid.dataset.ready = '1';
}

function setManualMultiplier(multiplier) {
  manualMultiplier = manualMultiplier === multiplier ? 1 : multiplier;
  document.getElementById('mod-double').classList.toggle('active', manualMultiplier === 2);
  document.getElementById('mod-treble').classList.toggle('active', manualMultiplier === 3);
}

function resetManualMultiplier() {
  manualMultiplier = 1;
  const doubleBtn = document.getElementById('mod-double');
  const trebleBtn = document.getElementById('mod-treble');
  if (doubleBtn) doubleBtn.classList.remove('active');
  if (trebleBtn) trebleBtn.classList.remove('active');
}

function manualDart(num) {
  if (num === 0) registerDart(null);
  else {
    const multiplier = num === 50 ? 2 : (num === 25 ? 1 : manualMultiplier);
    const number = num === 50 ? 25 : num;
    registerDart({ number, multiplier, name: number === 25 ? (multiplier === 2 ? 'D25' : 'B25') : `${multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S'}${number}` });
  }
  resetManualMultiplier();
}

function handleWS(data) {
  if (!data || data.type !== 'state') return;
  const d = data.data || {};
  const throws = Array.isArray(d.throws) ? d.throws : [];
  const event = d.event || '';
  const numThrows = d.numThrows !== undefined ? d.numThrows : -1;
  if (throws.length > seenThrows && !pendingQuestion) {
    const rawThrow = throws[seenThrows];
    throwLog.push(rawThrow);
    if (missTimer) { clearTimeout(missTimer); missTimer = null; }
    registerDart(rawThrow.segment || {});
    seenThrows = throws.length;
  }
  if (numThrows > 0 && numThrows > seenThrows && throws.length === seenThrows && !pendingQuestion) {
    if (!missTimer) missTimer = setTimeout(() => {
      missTimer = null;
      if (seenThrows < numThrows) {
        registerDart(null);
        seenThrows = numThrows;
      }
    }, 700);
  }
  if (event === 'Takeout finished' || (throws.length === 0 && seenThrows > 0)) seenThrows = 0;
}

function flash(text, color = 'var(--gold)') {
  const el = document.getElementById('announce');
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => el.classList.remove('show'), 1300);
}

function moo() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(165, 'sawtooth', t, .32, .18, ctx);
  tone(123, 'sawtooth', t + .22, .38, .15, ctx);
  noiz(t, .22, .04, 220, ctx);
}

function sfxInOne() {
  sfxCheckout();
}

function setVoiceEnabled(val) {
  voiceEnabled = val;
  if (!val) cancelSpeech();
  try { localStorage.setItem('dartbot_voice_enabled', val ? '1' : '0'); } catch {}
}

function speakBullseye(text, interrupt = false) {
  if (!voiceEnabled) return;
  speak(text, interrupt);
}

document.addEventListener('DOMContentLoaded', () => {
  state = freshState();
  voiceEnabled = localStorage.getItem('dartbot_voice_enabled') !== '0';
  const voiceChk = document.getElementById('voice-toggle');
  if (voiceChk) voiceChk.checked = voiceEnabled;
  renderManualGrid();
  initSpeech();
  initAutodarts(handleWS);
  renderAll();
});
