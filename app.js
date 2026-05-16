if (typeof window.EXAM_BANKS === 'undefined') {
  document.getElementById('quiz').innerHTML = '<div class="empty">找不到 banks.js 題庫，請確認 banks.js 有放在同一個資料夾。</div>';
  throw new Error('banks.js missing');
}

const letters = ['A', 'B', 'C', 'D', 'E'];
const EXAM_LIMIT_SECONDS = 30 * 60;
let currentBankId = window.DEFAULT_BANK_ID || Object.keys(window.EXAM_BANKS)[0];
let currentBank = null;
let questions = [];
let examQuestions = [];
let startTime = Date.now();
let timerId = null;
let graded = false;
let timeUpAlerted = false;
let wrongOnly = false;
let lastWrongSet = new Set();

const quizEl = document.getElementById('quiz');
const resultEl = document.getElementById('result');
const singleInput = document.getElementById('singleCount');
const multiInput = document.getElementById('multiCount');
const bankSelect = document.getElementById('bankSelect');
const mainTitle = document.getElementById('mainTitle');
const subtitle = document.getElementById('subtitle');

function initBankSelect() {
  bankSelect.innerHTML = '';
  Object.entries(window.EXAM_BANKS).forEach(([id, bank]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = bank.title || id;
    bankSelect.appendChild(opt);
  });
  bankSelect.value = currentBankId;
}

function loadBank(bankId) {
  currentBankId = bankId;
  currentBank = window.EXAM_BANKS[bankId];
  questions = Array.isArray(currentBank.questions) ? currentBank.questions : [];
  const singles = questions.filter(q => (q.type || 'single') === 'single');
  const multis = questions.filter(q => q.type === 'multi');

  singleInput.max = singles.length;
  multiInput.max = multis.length;
  singleInput.value = Math.min(Number(currentBank.singleCount ?? 50), singles.length);
  multiInput.value = Math.min(Number(currentBank.multiCount ?? 0), multis.length);
  singleInput.disabled = singles.length === 0;
  multiInput.disabled = multis.length === 0;

  mainTitle.textContent = currentBank.title || '線上模擬測驗';
  subtitle.textContent = `題庫共 ${questions.length} 題｜單選 ${singles.length} 題、複選 ${multis.length} 題`;
  restart(false);
}

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
    .replace(/[Ａ-Ｅ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[，,、\s]/g, '')
    .toUpperCase();
}

function answerToIndexes(answer) {
  const raw = normalizeAnswer(answer);
  const indexes = [];
  for (const ch of raw) {
    if (/^[1-9]$/.test(ch)) indexes.push(Number(ch) - 1);
    if (/^[A-E]$/.test(ch)) indexes.push(letters.indexOf(ch));
  }
  return [...new Set(indexes)].filter(i => i >= 0).sort((a, b) => a - b);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function guessVideoType(path) {
  const clean = String(path || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.webm')) return 'video/webm';
  if (clean.endsWith('.ogg') || clean.endsWith('.ogv')) return 'video/ogg';
  return 'video/mp4';
}

function formatTime(sec) {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function startTimer() {
  clearInterval(timerId);
  startTime = Date.now();
  timeUpAlerted = false;
  document.getElementById('timer').textContent = '00:00';
  timerId = setInterval(() => {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const timer = document.getElementById('timer');
    timer.textContent = formatTime(sec);
    if (sec >= EXAM_LIMIT_SECONDS && !timeUpAlerted) {
      timeUpAlerted = true;
      timer.classList.add('timeup');
      alert('時間到！已達 30 分鐘，請準備交卷。');
    }
  }, 500);
}

function pickQuestions() {
  const singles = questions.filter(q => (q.type || 'single') === 'single');
  const multis = questions.filter(q => q.type === 'multi');
  const singleCount = Math.min(Math.max(parseInt(singleInput.value || '0', 10), 0), singles.length);
  const multiCount = Math.min(Math.max(parseInt(multiInput.value || '0', 10), 0), multis.length);
  singleInput.value = singleCount;
  multiInput.value = multiCount;
  examQuestions = [
    ...shuffle(singles).slice(0, singleCount),
    ...shuffle(multis).slice(0, multiCount),
  ];
}

function renderQuiz() {
  graded = false;
  wrongOnly = false;
  lastWrongSet = new Set();
  document.getElementById('wrongBtn').textContent = '只看錯題';
  resultEl.innerHTML = '';
  quizEl.innerHTML = '';

  if (!examQuestions.length) {
    quizEl.innerHTML = '<div class="empty">本次沒有抽到題目，請確認題數設定。</div>';
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

    if (q.image) {
      html += `<div class="q-image-wrap"><img class="q-image" src="${escapeHtml(q.image)}" alt="題目圖片"></div>`;
    }
    if (q.video) {
      const videoSrc = escapeHtml(q.video);
      const videoType = q.videoType ? escapeHtml(q.videoType) : guessVideoType(q.video);
      html += `
        <div class="q-video-wrap">
          <video controls preload="metadata" playsinline class="question-video">
            <source src="${videoSrc}" type="${videoType}">
            此瀏覽器不支援影片播放。
          </video>
        </div>`;
    }
    if (q.youtube) {
      html += `
        <div class="q-video-wrap">
          <iframe class="question-video iframe-video"
            src="${escapeHtml(q.youtube)}"
            title="題目影片"
            loading="lazy"
            allowfullscreen></iframe>
        </div>`;
    }

    (q.options || []).forEach((opt, oi) => {
      html += `
        <label class="option" data-option-index="${oi}">
          <input type="${inputType}" name="q${qi}" value="${oi}">
          (${letters[oi] || (oi + 1)}) ${escapeHtml(opt)} <span class="mark"></span>
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
  lastWrongSet = new Set();

  examQuestions.forEach((q, qi) => {
    const correct = answerToIndexes(q.answer);
    const selected = selectedIndexes(qi);
    const isCorrect = sameArray(selected, correct);
    const options = document.querySelectorAll(`#q${qi} .option`);
    const qDiv = document.getElementById(`q${qi}`);
    qDiv.classList.remove('wrong-question', 'hidden-wrong-filter');

    if ((q.type || 'single') === 'single') singleTotal += 1;
    else multiTotal += 1;

    if (isCorrect) {
      if ((q.type || 'single') === 'single') singleCorrect += 1;
      else multiCorrect += 1;
    } else {
      lastWrongSet.add(qi);
      qDiv.classList.add('wrong-question');
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
  wrongOnly = false;
  document.getElementById('wrongBtn').textContent = '只看錯題';
  const singleScore = singleCorrect;
  const multiScore = multiCorrect * 2;
  const totalScore = singleScore + multiScore;
  const fullScore = singleTotal + multiTotal * 2;
  const sec = Math.floor((Date.now() - startTime) / 1000);

  resultEl.innerHTML = `
    <div class="score">分數：${totalScore} / ${fullScore}</div>
    <div>經過時間：${formatTime(sec)}${sec >= EXAM_LIMIT_SECONDS ? '（已超過 30 分鐘）' : ''}</div>
    <div class="summary">
      <div>單選<br><b>${singleCorrect} / ${singleTotal}</b></div>
      <div>複選<br><b>${multiCorrect} / ${multiTotal}</b></div>
      <div>錯題<br><b>${lastWrongSet.size}</b></div>
      <div>本次題數<br><b>${examQuestions.length}</b></div>
    </div>`;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleWrongOnly() {
  if (!graded) {
    alert('請先按「解答完畢看分數」，才能只看錯題。');
    return;
  }
  wrongOnly = !wrongOnly;
  examQuestions.forEach((_, qi) => {
    const qDiv = document.getElementById(`q${qi}`);
    qDiv.classList.toggle('hidden-wrong-filter', wrongOnly && !lastWrongSet.has(qi));
  });
  document.getElementById('wrongBtn').textContent = wrongOnly ? '顯示全部' : '只看錯題';
  if (wrongOnly) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restart(scrollTop = true) {
  pickQuestions();
  renderQuiz();
  startTimer();
  document.getElementById('timer').classList.remove('timeup');
  if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
}

bankSelect.addEventListener('change', () => loadBank(bankSelect.value));
document.getElementById('startBtn').addEventListener('click', () => restart(true));
document.getElementById('gradeBtn').addEventListener('click', gradeQuiz);
document.getElementById('wrongBtn').addEventListener('click', toggleWrongOnly);
document.getElementById('topBtn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

initBankSelect();
loadBank(currentBankId);
