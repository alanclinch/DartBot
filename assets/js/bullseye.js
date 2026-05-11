const CATEGORY_PAIRS = [
  { id: 'faces', name: 'Faces', numbers: [20, 1], trivia: 26 },
  { id: 'places', name: 'Places', numbers: [18, 4], trivia: 22 },
  { id: 'sport', name: 'Sport', numbers: [13, 6], trivia: 21 },
  { id: 'showbiz', name: 'Showbiz', numbers: [10, 15], trivia: 11 },
  { id: 'spelling', name: 'Spelling', numbers: [2, 17], trivia: 10 },
  { id: 'science', name: 'Science', numbers: [3, 19], trivia: 17 },
  { id: 'history', name: 'History', numbers: [7, 16], trivia: 23 },
  { id: 'books', name: 'Books', numbers: [8, 11], trivia: 10 },
  { id: 'words', name: 'Words', numbers: [14, 9], trivia: 10 },
  { id: 'britain', name: 'Britain', numbers: [12, 5], trivia: 22 },
];

const PRIZE_ENGINE = {
  low_tier: ['Hostess Trolley', 'Teasmade', 'SodaStream', 'Canteen of Cutlery', 'Twin-tub Washing Machine', '8-Piece Luggage Set'],
  mid_tier: ['Portable Colour TV (with wired remote)', 'VCR Player', 'Electric Lawnmower', 'Sunlounger Set'],
  star_prizes: ['16ft Speedboat', 'Caravan', 'Fiat Uno', 'Holiday in the Algarve', 'Fitted Kitchen'],
};

const FALLBACK_QUESTIONS = {
  faces: [
    { question: 'Which actor played Del Boy in Only Fools and Horses?', correct_answer: 'David Jason', incorrect_answers: ['Nicholas Lyndhurst', 'John Cleese', 'Ronnie Barker'] },
    { question: 'Who was the first woman to serve as UK Prime Minister?', correct_answer: 'Margaret Thatcher', incorrect_answers: ['Theresa May', 'Barbara Castle', 'Harriet Harman'] },
  ],
  places: [
    { question: 'Which city is home to the Clifton Suspension Bridge?', correct_answer: 'Bristol', incorrect_answers: ['Bath', 'Cardiff', 'Exeter'] },
    { question: 'Ben Nevis is in which country?', correct_answer: 'Scotland', incorrect_answers: ['Wales', 'England', 'Ireland'] },
  ],
  sport: [
    { question: 'How many players start on the pitch for one football team?', correct_answer: '11', incorrect_answers: ['10', '12', '9'] },
    { question: 'The Ashes is contested in which sport?', correct_answer: 'Cricket', incorrect_answers: ['Rugby Union', 'Darts', 'Snooker'] },
  ],
  showbiz: [
    { question: 'Which band released Bohemian Rhapsody?', correct_answer: 'Queen', incorrect_answers: ['The Beatles', 'Oasis', 'ABBA'] },
    { question: 'Which film features the line "You were only supposed to blow the bloody doors off"?', correct_answer: 'The Italian Job', incorrect_answers: ['Get Carter', 'Zulu', 'Goldfinger'] },
  ],
  spelling: [
    { question: 'Which spelling is correct?', correct_answer: 'Embarrass', incorrect_answers: ['Embarass', 'Embarras', 'Emberass'] },
    { question: 'Which spelling is correct?', correct_answer: 'Separate', incorrect_answers: ['Seperate', 'Seperete', 'Seporate'] },
  ],
  science: [
    { question: 'What gas do plants absorb from the atmosphere?', correct_answer: 'Carbon dioxide', incorrect_answers: ['Oxygen', 'Nitrogen', 'Helium'] },
    { question: 'What is H2O commonly known as?', correct_answer: 'Water', incorrect_answers: ['Salt', 'Hydrogen', 'Vinegar'] },
  ],
  history: [
    { question: 'In which year did the Battle of Hastings take place?', correct_answer: '1066', incorrect_answers: ['1215', '1415', '1666'] },
    { question: 'Who was the monarch during the Spanish Armada?', correct_answer: 'Elizabeth I', incorrect_answers: ['Victoria', 'Henry VIII', 'Mary I'] },
  ],
  books: [
    { question: 'Who wrote The Hobbit?', correct_answer: 'J. R. R. Tolkien', incorrect_answers: ['C. S. Lewis', 'Roald Dahl', 'George Orwell'] },
    { question: 'Sherlock Holmes lived at which fictional address?', correct_answer: '221B Baker Street', incorrect_answers: ['10 Downing Street', 'Privet Drive', 'Pemberley'] },
  ],
  words: [
    { question: 'What does "benevolent" mean?', correct_answer: 'Kind and well meaning', incorrect_answers: ['Very old', 'Hard to read', 'Likely to break'] },
    { question: 'Which word means a word that sounds like another but has a different meaning?', correct_answer: 'Homophone', incorrect_answers: ['Synonym', 'Antonym', 'Acronym'] },
  ],
  britain: [
    { question: 'What is the national flower of England?', correct_answer: 'Rose', incorrect_answers: ['Thistle', 'Daffodil', 'Shamrock'] },
    { question: 'Which sea lies east of Great Britain?', correct_answer: 'North Sea', incorrect_answers: ['Irish Sea', 'Celtic Sea', 'Atlantic Ocean'] },
  ],
  general: [
    { question: 'Which planet is known as the Red Planet?', correct_answer: 'Mars', incorrect_answers: ['Venus', 'Jupiter', 'Saturn'] },
    { question: 'How many sides does a hexagon have?', correct_answer: '6', incorrect_answers: ['5', '7', '8'] },
    { question: 'What is the capital city of France?', correct_answer: 'Paris', incorrect_answers: ['Lyon', 'Marseille', 'Nice'] },
  ],
};

let state = {};
let manualMultiplier = 1;
let seenThrows = 0;
let questionTimer = null;
let pendingQuestion = null;
let throwLog = [];
let missTimer = null;

function freshState() {
  return {
    team: 'The Contestants',
    phase: 'r1',
    bank: 0,
    categories: CATEGORY_PAIRS.map(c => ({ ...c, active: true, answered: false })),
    prizeSlots: buildPrizeBoard().map((name, i) => ({ slot: i + 1, name, hits: 0 })),
    inventory: [],
    starPrize: pick(PRIZE_ENGINE.star_prizes),
    darts: [],
    round2Score: 0,
    prizeDarts: 0,
    finalScore: 0,
    finalDarts: 0,
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
function decodeEntities(value) { const t = document.createElement('textarea'); t.innerHTML = value; return t.value; }

function startGame() {
  state = freshState();
  state.team = document.getElementById('team-name').value.trim() || 'The Contestants';
  document.getElementById('display-team').textContent = state.team;
  document.documentElement.requestFullscreen().catch(() => {});
  showScreen('game');
  initRoundOne();
}

function endGame() {
  clearQuestionTimer();
  state.gameOver = true;
  showScreen('setup');
}

function initRoundOne() {
  resetManualMultiplier();
  state.phase = 'r1';
  state.darts = [];
  flash("It's Bully's Category Board!", 'var(--gold)');
  speak("It's Bully's Category Board. Choose a category.", true);
  renderAll();
}

function initRoundTwo() {
  resetManualMultiplier();
  state.phase = 'r2_throw';
  state.darts = [];
  state.round2Score = 0;
  flash('Pounds for Points', 'var(--gold)');
  speak('Pounds for Points. Three darts set the question value.', true);
  renderAll();
}

function initRoundThree() {
  resetManualMultiplier();
  state.phase = 'r3';
  state.darts = [];
  state.prizeDarts = 0;
  flash("Bully's Prize Board", 'var(--gold)');
  speak("Bully's Prize Board. Stay out of the black and in the red.", true);
  renderAll();
}

function nextPhase() {
  if (state.phase === 'r1') return initRoundTwo();
  if (state.phase === 'r2_throw') return askRoundTwoQuestion();
  if (state.phase === 'r3') return offerFinal();
  if (state.phase === 'final') return resolveFinal();
  if (state.phase === 'complete') return endGame();
}

function registerDart(seg) {
  if (!state.phase || state.gameOver || pendingQuestion) return;
  if (state.phase === 'r1') return handleRoundOneDart(seg);
  if (state.phase === 'r2_throw') return handleRoundTwoDart(seg);
  if (state.phase === 'r3') return handleRoundThreeDart(seg);
  if (state.phase === 'final') return handleFinalDart(seg);
}

function handleRoundOneDart(seg) {
  state.darts = [];
  const num = Number(seg && seg.number) || 0;
  if (num === 25) {
    openCategoryChoice();
    sfxInOne();
    return;
  }
  const category = state.categories.find(c => c.numbers.includes(num));
  addDart(seg, category ? category.name : 'Miss');
  if (!category) {
    moo();
    renderAll();
    return;
  }
  if (!category.active) {
    moo();
    flash('Already Gone', 'var(--red)');
    renderAll();
    return;
  }
  askQuestion(category, 50, correct => {
    category.active = false;
    category.answered = true;
    if (correct) state.bank += 50;
    if (state.categories.every(c => !c.active)) setTimeout(initRoundTwo, 900);
    renderAll();
  });
  renderAll();
}

function handleRoundTwoDart(seg) {
  if (state.darts.length >= 3) return;
  const score = segScore(seg);
  state.round2Score += score;
  addDart(seg, String(score));
  sfxHit();
  if (state.darts.length >= 3) setTimeout(askRoundTwoQuestion, 500);
  renderAll();
}

function askRoundTwoQuestion() {
  if (state.phase !== 'r2_throw') return;
  state.phase = 'r2_question';
  const value = Math.max(0, state.round2Score);
  askQuestion({ id: 'general', name: 'General Knowledge', trivia: 9 }, value, correct => {
    if (correct) state.bank += value;
    state.phase = 'r2_done';
    renderAll();
    setTimeout(initRoundThree, 900);
  });
  renderAll();
}

function handleRoundThreeDart(seg) {
  if (state.prizeDarts >= 9) return;
  state.prizeDarts++;
  const zone = prizeZone(seg);
  addDart(seg, zone.label);
  if (zone.type === 'miss') {
    moo();
  } else if (zone.type === 'bull') {
    const name = 'Bully Special: ' + pick(PRIZE_ENGINE.mid_tier);
    toggleInventory(name, true);
    sfxInOne();
    flash("Bully's Special Prize", 'var(--gold)');
  } else if (zone.type === 'black') {
    busFare();
    flash('Black Segment', 'var(--red)');
  } else {
    const slot = state.prizeSlots[zone.slot - 1];
    slot.hits++;
    const active = slot.hits % 2 === 1;
    toggleInventory(slot.name, active);
    if (active) {
      sfxInOne();
      flash('Prize Won', 'var(--gold)');
      speak(`In ${slot.slot}. ${slot.name}.`, true);
    } else {
      busFare();
      flash('Two In A Bed', 'var(--red)');
      speak(`Two in a bed. You have lost the ${slot.name}.`, true);
    }
  }
  if (state.prizeDarts >= 9) setTimeout(offerFinal, 900);
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
  const modal = document.getElementById('final-modal');
  document.getElementById('final-title').textContent = state.bank > 0 ? 'Gamble the bank?' : 'No gamble available';
  document.getElementById('final-copy').innerHTML = state.bank > 0
    ? `Your bank is ${money(state.bank)}. Gamble it for the star prize: <strong>${escapeHTML(state.starPrize)}</strong>. Score 101 or more with 6 darts to win.`
    : 'You need money in the bank to play for the star prize.';
  document.getElementById('final-actions').innerHTML = state.bank > 0
    ? '<button class="primary-btn" onclick="startFinal()">Gamble</button><button class="secondary-btn" onclick="finishGame(false)">Keep Prizes</button>'
    : '<button class="primary-btn" onclick="finishGame(false)">Finish</button>';
  modal.classList.add('open');
}

function startFinal() {
  document.getElementById('final-modal').classList.remove('open');
  resetManualMultiplier();
  state.phase = 'final';
  state.darts = [];
  state.finalScore = 0;
  state.finalDarts = 0;
  sfxInOne();
  speak('Bully star prize gamble. One hundred and one or more in six darts.', true);
  renderAll();
}

function resolveFinal() {
  if (state.finalScore >= 101) return finishGame(true);
  state.bank = 0;
  state.inventory = [];
  busFare();
  document.getElementById('final-title').textContent = 'Bus fare home';
  document.getElementById('final-copy').innerHTML = `You scored ${state.finalScore}. The star prize was <strong>${escapeHTML(state.starPrize)}</strong>.`;
  document.getElementById('final-actions').innerHTML = '<button class="primary-btn" onclick="finishGame(false)">Finish</button>';
  document.getElementById('final-modal').classList.add('open');
  renderAll();
}

function finishGame(starWon) {
  resetManualMultiplier();
  state.phase = 'complete';
  state.gameOver = true;
  document.getElementById('final-modal').classList.remove('open');
  renderAll();
  if (starWon) {
    spawnConfetti();
    flash('Star Prize Won!', 'var(--gold)');
    speak(`You have won the star prize. ${state.starPrize}!`, true);
  } else {
    flash('Thanks for playing!', 'var(--gold)');
  }
}

function addDart(seg, label) {
  state.darts.push({ label: isMiss(seg) ? 'Miss' : dartSpeak(seg), sub: label, score: segScore(seg), miss: isMiss(seg) });
}

function toggleInventory(name, active) {
  state.inventory = state.inventory.filter(p => p !== name);
  if (active) state.inventory.push(name);
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

function openCategoryChoice() {
  const remaining = state.categories.filter(c => c.active);
  if (!remaining.length) return;
  document.getElementById('choice-grid').innerHTML = remaining.map(c => `<button class="choice-btn" onclick="chooseCategory('${c.id}')">${escapeHTML(c.name)}</button>`).join('');
  document.getElementById('choice-modal').classList.add('open');
  speak("Player's choice. Pick a category.", true);
}

function chooseCategory(id) {
  document.getElementById('choice-modal').classList.remove('open');
  const category = state.categories.find(c => c.id === id);
  if (!category) return;
  askQuestion(category, 50, correct => {
    category.active = false;
    category.answered = true;
    if (correct) state.bank += 50;
    if (state.categories.every(c => !c.active)) setTimeout(initRoundTwo, 900);
    renderAll();
  });
}

async function askQuestion(category, value, callback) {
  pendingQuestion = { category, value, callback, answered: false };
  const q = await loadQuestion(category);
  if (!pendingQuestion) return;
  pendingQuestion.question = q;
  showQuestion(q, category, value);
}

async function loadQuestion(category) {
  const fallback = pick(FALLBACK_QUESTIONS[category.id] || FALLBACK_QUESTIONS.general);
  if (!navigator.onLine) return fallback;
  try {
    const res = await fetch(`https://opentdb.com/api.php?amount=1&type=multiple&category=${category.trivia || 9}`);
    const data = await res.json();
    if (!data.results || !data.results.length) return fallback;
    const r = data.results[0];
    return { question: decodeEntities(r.question), correct_answer: decodeEntities(r.correct_answer), incorrect_answers: r.incorrect_answers.map(decodeEntities) };
  } catch (e) {
    return fallback;
  }
}

function showQuestion(q, category, value) {
  document.getElementById('question-category').textContent = category.name;
  document.getElementById('question-value').innerHTML = money(value);
  document.getElementById('question-text').textContent = q.question;
  const answers = [q.correct_answer, ...q.incorrect_answers].sort(() => Math.random() - .5);
  document.getElementById('answer-grid').innerHTML = answers.map(a => `<button class="answer-btn" data-answer="${escapeHTML(a)}" onclick="answerQuestion(this)">${escapeHTML(a)}</button>`).join('');
  document.getElementById('question-modal').classList.add('open');
  speak(q.question, true);
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
    speak('Correct answer.', true);
  } else {
    busFare();
    flash('Wrong!', 'var(--red)');
    speak(`Wrong answer. It was ${pendingQuestion.question.correct_answer}.`, true);
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
  const cx = 210, cy = 210, outer = 196, inner = 64, step = 360 / CATEGORY_PAIRS.length;
  CATEGORY_PAIRS.forEach((pair, i) => {
    const start = -90 + i * step, end = start + step - 1.2;
    let fill = i % 2 ? '#203244' : '#284058';
    let label = pair.name;
    let inactive = false;
    if (state.phase === 'r3') {
      fill = i >= 8 ? '#363b42' : '#df3036';
      label = i >= 8 ? 'MISS' : `${i + 1}`;
    } else if (state.phase === 'final') {
      fill = i % 2 ? '#203244' : '#df3036';
      label = pair.numbers.join('/');
    } else {
      inactive = state.categories && state.categories[i] && !state.categories[i].active;
    }
    svg.insertAdjacentHTML('beforeend', `<path class="board-segment ${inactive ? 'inactive' : ''}" d="${ringSlicePath(cx, cy, inner, outer, start, end)}" fill="${fill}"></path>`);
    if (state.phase === 'r3' && i < 8) {
      svg.insertAdjacentHTML('beforeend', `<path class="board-segment" d="${ringSlicePath(cx, cy, inner, outer - 46, start + step / 2, end)}" fill="#101010" opacity=".88"></path>`);
    }
    const mid = polar(cx, cy, 132, start + step / 2);
    const n1 = polar(cx, cy, 184, start + 8);
    const n2 = polar(cx, cy, 184, end - 8);
    svg.insertAdjacentHTML('beforeend', `<text class="board-label" x="${mid.x}" y="${mid.y}">${escapeHTML(label)}</text>`);
    svg.insertAdjacentHTML('beforeend', `<text class="board-label" x="${n1.x}" y="${n1.y}">${pair.numbers[0]}</text>`);
    svg.insertAdjacentHTML('beforeend', `<text class="board-label" x="${n2.x}" y="${n2.y}">${pair.numbers[1]}</text>`);
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
  document.getElementById('bank-total').innerHTML = money(state.bank || 0);
  const inv = document.getElementById('inventory-list');
  inv.innerHTML = state.inventory && state.inventory.length
    ? state.inventory.map((p, i) => `<div class="inventory-item"><span>${i + 1}</span><span>${escapeHTML(p)}</span><span>Won</span></div>`).join('')
    : '<div class="inventory-empty">No prizes yet. Keep out of the black and in the red.</div>';
  const phaseText = phaseLabel(state.phase || 'r1');
  document.getElementById('round-title').textContent = phaseText.round;
  document.getElementById('target-main').textContent = phaseText.target;
  document.getElementById('target-copy').textContent = phaseText.copy;
  document.getElementById('center-target').textContent = phaseText.center;
  document.getElementById('round-list').innerHTML = [['r1', "Bully's Category Board"], ['r2', 'Pounds for Points'], ['r3', "Bully's Prize Board"], ['final', 'Star Prize Gamble']]
    .map(([key, label]) => `<div class="round-chip ${state.phase && state.phase.startsWith(key) ? 'active' : ''}"><span>${label}</span><span>${roundStatus(key)}</span></div>`).join('');
  const phase = state.phase || 'r1';
  const max = phase === 'final' ? 6 : (phase === 'r3' ? 9 : 3);
  const darts = state.darts || [];
  document.getElementById('dart-slots').innerHTML = Array.from({ length: max }, (_, i) => {
    const d = darts[i];
    return `<div class="dart-slot ${d ? (d.miss ? 'miss' : 'hit') : ''}"><span>${i + 1}</span><span>${d ? `${escapeHTML(d.label)} - ${escapeHTML(d.sub)}` : '-'}</span></div>`;
  }).join('');
  const total = phase === 'final' || (phase === 'complete' && state.finalScore) ? state.finalScore : phase.startsWith('r2') ? state.round2Score : phase === 'r3' ? state.prizeDarts : darts.length;
  document.getElementById('turn-total').textContent = phase === 'r3' ? `Darts: ${total}/9` : (phase === 'final' || (phase === 'complete' && state.finalScore) ? `Score: ${total || 0}` : `Total: ${total || 0}`);
}

function phaseLabel(phase) {
  if (phase === 'r1') {
    const next = state.categories.find(c => c.active);
    return { round: 'Round 1 - Category Board', target: `Aim for ${next ? next.name : 'Bull'}`, center: next ? next.name : 'Bull', copy: 'Hit an active category. Bull gives player choice.' };
  }
  if (phase === 'r2_throw') return { round: 'Round 2 - Pounds for Points', target: 'Set the question value', center: 'Score', copy: 'Throw 3 darts. The score becomes the value of a general knowledge question.' };
  if (phase === 'r2_question') return { round: 'Round 2 - Question', target: 'Answer for the bank', center: 'Quiz', copy: 'Pick the correct answer before the timer expires.' };
  if (phase === 'r3') return { round: 'Round 3 - Prize Board', target: 'Stay in the red', center: 'Prizes', copy: 'Red wins prizes. Black is nothing. Two in a bed removes the prize.' };
  if (phase === 'final') return { round: 'Final - Star Prize Gamble', target: 'Score 101+', center: '101+', copy: `6 darts for the ${state.starPrize}. Current score: ${state.finalScore}.` };
  if (phase === 'final_offer') return { round: 'Final - Star Prize Gamble', target: 'Make the gamble?', center: 'Gamble', copy: `The star prize is ${state.starPrize}. Choose whether to risk the bank.` };
  if (phase === 'complete') return { round: 'Game Complete', target: 'Game complete', center: 'Done', copy: 'Return to the menu or start again.' };
  return { round: 'Bullseye', target: 'Ready', center: 'Ready', copy: 'Start the game.' };
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
  speak('Moo.', true);
}

function sfxInOne() {
  sfxCheckout();
  speak('Iiiiiiiiiiin one!', true);
}

function busFare() {
  sfxBust();
  speak('Bus fare home.', true);
}

document.addEventListener('DOMContentLoaded', () => {
  state = freshState();
  renderManualGrid();
  initSpeech();
  initAutodarts(handleWS);
  renderAll();
});
