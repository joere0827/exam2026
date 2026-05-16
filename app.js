if (typeof window.questions === 'undefined' || !Array.isArray(window.questions)) {
  document.getElementById('quiz').innerHTML = '<div class="empty">找不到 questions.js 題庫，請確認 questions.js 有放在同一個資料夾。</div>';
  throw new Error('questions.js missing');
}

const letters = ['A', 'B', 'C', 'D'];
let examQuestions = [];
let startTime = Date.now();
let timerId = null;
let graded = false;

const quizEl = document.getElementById('quiz');
const resultEl = document.getElementById('result');
const singleInput = document.getElementById('singleCount');
const multiInput = document.getElementById('multiCount');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeAnswer(answer) {
  return String(answer || '')
    .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[，,、\s]/g, '')
    .toUpperCase();
}

function answerToIndexes(answer) {
  const raw = normalizeAnswer(answer);
  const indexes = [];
  for (const ch of raw) {
    if (/^[1-4]$/.test(ch)) indexes.push(Number(ch) - 1);
    if (/^[A-D]$/.test(ch)) indexes.push(letters.indexOf(ch));
  }
  return [...new Set(indexes)].sort((a, b) => a - b);
}

function formatAnswer(indexes) {
  return indexes.map(i => letters[i]).join('、');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function startTimer() {
  clearInterval(timerId);
  startTime = Date.now();
  timerId = setInterval(() => {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    document.getElementById('timer').textContent = `${mm}:${ss}`;
  }, 500);
}

function pickQuestions() {
  const singles = questions.filter(q => q.type === 'single');
  const multis = questions.filter(q => q.type === 'multi');
  const singleCount = Math.min(Math.max(parseInt(singleInput.value || '60', 10), 1), singles.length);
  const multiCount = Math.min(Math.max(parseInt(multiInput.value || '20', 10), 1), multis.length);
  singleInput.max = singles.length;
  multiInput.max = multis.length;
  examQuestions = [
    ...shuffle(singles).slice(0, singleCount),
    ...shuffle(multis).slice(0, multiCount),
  ];
}

function renderQuiz() {
  graded = false;
  resultEl.innerHTML = '';
  quizEl.innerHTML = '';

  if (!examQuestions.length) {
    quizEl.innerHTML = '<div class="empty">題庫是空的，請檢查 questions.js。</div>';
    return;
  }

  examQuestions.forEach((q, qi) => {
    const isMulti = q.type === 'multi';
    const inputType = isMulti ? 'checkbox' : 'radio';
    const qDiv = document.createElement('article');
    qDiv.className = 'question';
    qDiv.id = `q${qi}`;

    let html = `
      <div class="q-head">
        <div class="q-no">${qi + 1}.</div>
        <div class="q-text">${escapeHtml(q.question)}
          <span class="q-type">${isMulti ? '複選' : '單選'}</span>
        </div>
      </div>`;

    q.options.forEach((opt, oi) => {
      html += `
        <label class="option" data-option-index="${oi}">
          <input type="${inputType}" name="q${qi}" value="${oi}">
          (${letters[oi]}) ${escapeHtml(opt)} <span class="mark"></span>
        </label>`;
    });

    qDiv.innerHTML = html;
    quizEl.appendChild(qDiv);
  });
}

function selectedIndexes(qi) {
  return [...document.querySelectorAll(`input[name="q${qi}"]:checked`)]
    .map(input => Number(input.value))
    .sort((a, b) => a - b);
}

function sameArray(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function gradeQuiz() {
  let singleCorrect = 0;
  let multiCorrect = 0;
  let singleTotal = 0;
  let multiTotal = 0;

  examQuestions.forEach((q, qi) => {
    const correct = answerToIndexes(q.answer);
    const selected = selectedIndexes(qi);
    const isCorrect = sameArray(selected, correct);
    const options = document.querySelectorAll(`#q${qi} .option`);

    if (q.type === 'single') singleTotal += 1;
    else multiTotal += 1;

    if (isCorrect) {
      if (q.type === 'single') singleCorrect += 1;
      else multiCorrect += 1;
    }

    options.forEach((option, oi) => {
      option.classList.remove('correct', 'wrong');
      const mark = option.querySelector('.mark');
      mark.textContent = '';

      if (correct.includes(oi)) {
        option.classList.add('correct');
        mark.textContent = '正確答案';
      }
      if (selected.includes(oi) && !correct.includes(oi)) {
        option.classList.add('wrong');
        mark.textContent = '你選的答案';
      }
    });
  });

  graded = true;
  const singleScore = singleCorrect;
  const multiScore = multiCorrect * 2;
  const totalScore = singleScore + multiScore;
  const fullScore = singleTotal + multiTotal * 2;
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;

  resultEl.innerHTML = `
    <div class="score">分數：${totalScore} / ${fullScore}</div>
    <div>作答時間：${mm} 分 ${ss} 秒</div>
    <div class="summary">
      <div>單選<br><b>${singleCorrect} / ${singleTotal}</b></div>
      <div>複選<br><b>${multiCorrect} / ${multiTotal}</b></div>
      <div>題庫總數<br><b>${questions.length}</b></div>
      <div>本次題數<br><b>${examQuestions.length}</b></div>
    </div>`;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function restart() {
  pickQuestions();
  renderQuiz();
  startTimer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('startBtn').addEventListener('click', restart);
document.getElementById('gradeBtn').addEventListener('click', gradeQuiz);
document.getElementById('topBtn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

restart();
