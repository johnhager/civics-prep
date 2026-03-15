import './style.css'

// State
let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let isRevealed = false;
let isShuffle = false;
let isHardMode = false;
let isAutoPlay = false;
let isPracticeTest = false;
let practiceScore = { right: 0, wrong: 0, total: 20, asked: 0 };
let userProgress = JSON.parse(localStorage.getItem('civics-progress')) || {}; // { id: 'right' | 'wrong' }

// DOM Elements
const app = document.querySelector('#app');

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    checkVoiceAnswer(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    stopListeningUI();
  };

  recognition.onend = () => {
    stopListeningUI();
  };
}

function renderApp() {
  app.innerHTML = `
    <header>
      <h1>US Civics Prep</h1>
      <p>Study for the 2025 Naturalization Test <span class="wa-badge">Washington State</span></p>
    </header>
    
    <div class="top-controls">
      <button id="shuffle-btn" class="icon-btn" title="Toggle Shuffle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
        <span>Shuffle</span>
      </button>

      <button id="hard-mode-btn" class="icon-btn" title="Focus on questions marked 'Needs Review'">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>Needs Review</span>
      </button>

      <button id="auto-play-btn" class="icon-btn" title="Auto-play Audio">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
        <span>Auto-Play</span>
      </button>

      <button id="practice-test-btn" class="icon-btn" title="Take a 20 question practice test">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span>Practice Exam</span>
      </button>
      
      <div class="score-display">
        <span class="score-right" title="Known">✓ <span id="count-right">0</span></span>
        <span class="score-wrong" title="Needs Review">✗ <span id="count-wrong">0</span></span>
      </div>
    </div>

    <div class="flashcard-container">
      <div class="card" id="flashcard">
        <div class="card-header">
          <span class="question-id" id="q-id">#--</span>
          <span class="category" id="q-category">Loading...</span>
        </div>
        
        <div class="question-container">
          <div class="question-text" id="q-text">
            Loading questions...
          </div>
          <button id="audio-btn" class="audio-btn" title="Read Aloud">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>
        
        <div class="special-conditions hidden" id="q-conditions">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span id="q-conditions-text"></span>
        </div>
        
        <button id="reveal-btn" class="btn btn-primary">Reveal Answer</button>
        
        <div class="answers-section hidden" id="answers-container">
          <div id="answers-list"></div>
          
          <div class="rating-controls">
            <p class="rating-prompt">Did you know this?</p>
            <div class="rating-buttons">
              <button id="btn-wrong" class="btn btn-rating btn-red">✗ Needs Review</button>
              <button id="btn-right" class="btn btn-rating btn-green">✓ Got it!</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="controls">
        <button id="prev-btn" class="btn btn-secondary" disabled>← Previous</button>
        <div id="progress" class="progress">-- / --</div>
        <button id="next-btn" class="btn btn-secondary" disabled>Next →</button>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById('reveal-btn').addEventListener('click', revealAnswer);
  document.getElementById('prev-btn').addEventListener('click', prevQuestion);
  document.getElementById('next-btn').addEventListener('click', nextQuestion);
  document.getElementById('shuffle-btn').addEventListener('click', toggleShuffle);
  document.getElementById('hard-mode-btn').addEventListener('click', toggleHardMode);
  document.getElementById('auto-play-btn').addEventListener('click', toggleAutoPlay);
  document.getElementById('practice-test-btn').addEventListener('click', togglePracticeTest);
  document.getElementById('audio-btn').addEventListener('click', speakQuestion);

  document.getElementById('btn-wrong').addEventListener('click', () => markAnswer('wrong'));
  document.getElementById('btn-right').addEventListener('click', () => markAnswer('right'));

  // document level keybindings
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (!isRevealed) revealAnswer();
    } else if (e.key === 'ArrowRight') {
      nextQuestion();
    } else if (e.key === 'ArrowLeft') {
      prevQuestion();
    }
  });

  loadData();
}

async function loadData() {
  try {
    const res = await fetch('/data/civics_questions.json');
    if (!res.ok) throw new Error('Failed to fetch data');
    allQuestions = await res.json();

    if (allQuestions.length > 0) {
      applyLocalizedAnswers();
      activeQuestions = [...allQuestions];
      updateScoreboard();
      updateCard();
    }
  } catch (err) {
    document.getElementById('q-text').textContent = "Error loading questions. Please try again.";
    console.error(err);
  }
}

function applyLocalizedAnswers() {
  allQuestions.forEach(q => {
    if (q.id === 23) { // Senators
      q.answers = ["Patty Murray", "Maria Cantwell"];
      q.special_conditions = null;
    } else if (q.id === 29) { // Rep
      q.answers = ["Depends on your congressional district. Visit house.gov to find yours."];
      q.special_conditions = null;
    } else if (q.id === 61) { // Governor
      q.answers = ["Bob Ferguson"];
      q.special_conditions = null;
    } else if (q.id === 62) { // Capital
      q.answers = ["Olympia"];
      q.special_conditions = null;
    }
  });
}

function updateScoreboard() {
  let right = 0;
  let wrong = 0;

  Object.values(userProgress).forEach(status => {
    if (status === 'right') right++;
    if (status === 'wrong') wrong++;
  });

  document.getElementById('count-right').textContent = isPracticeTest ? practiceScore.right : right;
  document.getElementById('count-wrong').textContent = isPracticeTest ? practiceScore.wrong : wrong;
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  const btn = document.getElementById('shuffle-btn');

  if (isShuffle) {
    btn.classList.add('active');
    activeQuestions = [...allQuestions].sort(() => Math.random() - 0.5);
  } else {
    btn.classList.remove('active');
    activeQuestions = [...allQuestions];
  }

  currentIndex = 0;
  updateCard();
}

function updateActiveDeck() {
  let deck = [...allQuestions];

  // Apply "Needs Review" filter if active
  if (isHardMode) {
    deck = deck.filter(q => userProgress[q.id] === 'wrong');
    // If they have no wrong questions, alert them and turn off Hard Mode
    if (deck.length === 0) {
      alert("You don't have any questions marked 'Needs Review'! Great job.");
      toggleHardMode(); // toggle it back off
      return;
    }
  }

  // Apply "Shuffle" filter if active
  if (isShuffle) {
    deck = deck.sort(() => Math.random() - 0.5);
  }

  // Apply Practice Test filter if active
  if (isPracticeTest) {
    deck = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, 20);
    practiceScore = { right: 0, wrong: 0, total: 20, asked: 0 };
    updateScoreboard();
  }

  activeQuestions = deck;
  currentIndex = 0;
  updateCard();
}

function togglePracticeTest() {
  isPracticeTest = !isPracticeTest;
  const btn = document.getElementById('practice-test-btn');

  // Turn off other mutually exclusive modes
  if (isPracticeTest) {
    isHardMode = false;
    isShuffle = false;
    document.getElementById('hard-mode-btn').classList.remove('active');
    document.getElementById('shuffle-btn').classList.remove('active');
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }

  updateActiveDeck();
}

function toggleHardMode() {
  isHardMode = !isHardMode;
  const btn = document.getElementById('hard-mode-btn');

  if (isHardMode) {
    isPracticeTest = false;
    document.getElementById('practice-test-btn').classList.remove('active');
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }

  updateActiveDeck();
}

function toggleAutoPlay() {
  isAutoPlay = !isAutoPlay;
  const btn = document.getElementById('auto-play-btn');

  if (isAutoPlay) {
    btn.classList.add('active');
    speakQuestion();
  } else {
    btn.classList.remove('active');
    window.speechSynthesis.cancel();
  }
}

function setPremiumVoice(utterance) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;

  // Try to find a high-quality iOS/Mac/Android voice
  const bestVoice = voices.find(v => v.name.includes("Samantha") && v.name.includes("Enhanced")) ||
    voices.find(v => v.name.includes("Samantha")) ||
    voices.find(v => v.name.toLowerCase().includes("siri") && v.lang.includes("en-US")) ||
    voices.find(v => v.name.includes("Aaron") || v.name.includes("Nicky")) ||
    voices.find(v => v.lang === "en-US" && v.name.includes("Google")) ||
    voices.find(v => v.lang === "en-US");

  if (bestVoice) {
    utterance.voice = bestVoice;
  }
}

function speakQuestion() {
  // Wait to speak if they just finished the test
  if (isPracticeTest && activeQuestions.length === 0) return;

  window.speechSynthesis.cancel(); // Stop any current speech
  if (recognition) recognition.stop();
  stopListeningUI();

  const q = activeQuestions[currentIndex];
  // Filter out any markdown-like characters that might read awkwardly if present
  const textToRead = q.question.replace(/[*_]/g, '');
  const utterance = new SpeechSynthesisUtterance(textToRead);
  utterance.lang = 'en-US';
  utterance.rate = 0.9; // Slightly slower for clarity
  setPremiumVoice(utterance);

  if (isAutoPlay && recognition) {
    utterance.onend = () => {
      startListening();
    };
  }

  window.speechSynthesis.speak(utterance);
}

function startListening() {
  if (!recognition) return;
  try {
    recognition.start();
    const audioBtn = document.getElementById('audio-btn');
    audioBtn.classList.add('listening');
    audioBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`;
  } catch (e) {
    console.error("Could not start recognition", e);
  }
}

function stopListeningUI() {
  const audioBtn = document.getElementById('audio-btn');
  if (audioBtn) {
    audioBtn.classList.remove('listening');
    audioBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  }
}

function checkVoiceAnswer(transcript) {
  const q = activeQuestions[currentIndex];
  if (!q) return;

  const normalize = (str) => {
    return str.toLowerCase().replace(/[^\w\s]/gi, '').trim();
  };

  const userText = normalize(transcript);
  let isCorrect = false;

  for (const ans of q.answers) {
    const normAns = normalize(ans);
    if (userText.includes(normAns) || (normAns.includes(userText) && userText.length > 3)) {
      isCorrect = true;
      break;
    }
  }

  const condEl = document.getElementById('q-conditions');
  const condTextEl = document.getElementById('q-conditions-text');

  condEl.classList.remove('hidden');
  condEl.className = 'special-conditions voice-feedback';
  condEl.style.backgroundColor = isCorrect ? 'var(--color-green-light)' : 'var(--color-red-light)';
  condEl.style.color = isCorrect ? '#047857' : '#B91C1C';
  condTextEl.innerHTML = `🎙️ Heard: <i>"${transcript}"</i>`;

  if (!isRevealed) revealAnswer();

  window.speechSynthesis.cancel();

  if (isCorrect) {
    const msg = new SpeechSynthesisUtterance("Correct.");
    msg.lang = 'en-US';
    msg.rate = 1.0;
    setPremiumVoice(msg);
    msg.onend = () => markAnswer('right');
    window.speechSynthesis.speak(msg);
  } else {
    const answersText = q.answers.join(" ... or ... ");
    const msg = new SpeechSynthesisUtterance("Needs review. Acceptable answers are: " + answersText);
    msg.lang = 'en-US';
    msg.rate = 0.9;
    setPremiumVoice(msg);
    msg.onend = () => markAnswer('wrong');
    window.speechSynthesis.speak(msg);
  }
}

function updateCard() {
  if (activeQuestions.length === 0) {
    if (isPracticeTest) {
      showPracticeResults();
    }
    return; // Prevent errors if deck is empty
  }

  const q = activeQuestions[currentIndex];
  isRevealed = false;

  // Stop speech if we navigate away
  window.speechSynthesis.cancel();
  if (recognition) recognition.stop();
  stopListeningUI();

  const idEl = document.getElementById('q-id');
  const catEl = document.getElementById('q-category');
  const textEl = document.getElementById('q-text');
  const condEl = document.getElementById('q-conditions');

  // reset styles
  condEl.style.backgroundColor = '';
  condEl.style.color = '';
  condEl.className = 'special-conditions hidden';

  const condTextEl = document.getElementById('q-conditions-text');
  const ansContainer = document.getElementById('answers-container');
  const ansList = document.getElementById('answers-list');
  const revealBtn = document.getElementById('reveal-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const progressEl = document.getElementById('progress');

  idEl.textContent = `#${q.id}`;
  catEl.textContent = q.category;
  textEl.textContent = q.question;

  // Optional status badge from previous progress
  const pastStatus = userProgress[q.id];
  if (pastStatus) {
    idEl.className = `question-id status-${pastStatus}`;
  } else {
    idEl.className = 'question-id';
  }

  if (q.special_conditions) {
    condEl.classList.remove('hidden');
    condTextEl.textContent = q.special_conditions;
  } else {
    condEl.classList.add('hidden');
  }

  // Reset answers space
  ansList.innerHTML = '';
  q.answers.forEach(ans => {
    const div = document.createElement('div');
    div.className = 'answer-item';
    div.innerHTML = `<span class="answer-bullet">•</span> <span>${ans}</span>`;
    ansList.appendChild(div);
  });

  ansContainer.classList.add('hidden');
  revealBtn.style.display = 'block';

  // Animation reset
  const card = document.querySelector('.card');
  card.className = 'card animate-fade-in';
  void card.offsetWidth; // trigger reflow

  document.querySelector('.question-container').style.display = 'flex';

  // Update controls
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === activeQuestions.length - 1;
  progressEl.textContent = `${currentIndex + 1} / ${activeQuestions.length}`;

  if (isAutoPlay) {
    speakQuestion();
  }
}

function revealAnswer() {
  if (isRevealed) return;
  isRevealed = true;
  document.getElementById('answers-container').classList.remove('hidden');
  document.getElementById('reveal-btn').style.display = 'none';
}

function markAnswer(status) {
  const q = activeQuestions[currentIndex];

  if (isPracticeTest) {
    if (status === 'right') practiceScore.right++;
    if (status === 'wrong') practiceScore.wrong++;
    practiceScore.asked++;
    userProgress[q.id] = status; // Still save progress!
    localStorage.setItem('civics-progress', JSON.stringify(userProgress));
    updateScoreboard();

    const idEl = document.getElementById('q-id');
    idEl.className = `question-id status-${status}`;

    // Check win condition
    if (practiceScore.right >= 12 || practiceScore.wrong >= 9 || practiceScore.asked >= 20) {
      setTimeout(showPracticeResults, 250);
      return;
    }
  } else {
    userProgress[q.id] = status;
    localStorage.setItem('civics-progress', JSON.stringify(userProgress));
    updateScoreboard();

    const idEl = document.getElementById('q-id');
    idEl.className = `question-id status-${status}`;
  }

  // Automatically move to the next question if possible
  if (currentIndex < activeQuestions.length - 1) {
    setTimeout(nextQuestion, 250); // slight delay to feel the click
  } else if (isHardMode && status === 'right') {
    // If we are at the end of the Hard Mode deck, and just got the last one right,
    // the array will shrink next time we update the deck. Re-evaluate deck.
    setTimeout(updateActiveDeck, 250);
  }
}

function nextQuestion() {
  if (currentIndex < activeQuestions.length - 1) {
    currentIndex++;
    updateCard();
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    updateCard();
  }
}

function showPracticeResults() {
  window.speechSynthesis.cancel();
  const card = document.querySelector('.card');
  const condEl = document.getElementById('q-conditions');

  let resultTemplate = "";
  if (practiceScore.right >= 12) {
    resultTemplate = `
      <div style="text-align: center; padding: 2rem;">
        <h2 style="font-size: 2rem; color: #047857; margin-bottom: 1rem;">Congratulations! You Passed.</h2>
        <p style="font-size: 1.25rem;">You answered 12 questions correctly.</p>
        <p style="margin-top: 1rem; color: #64748B;">You only needed ${practiceScore.asked} to pass!</p>
      </div>`;
  } else {
    resultTemplate = `
      <div style="text-align: center; padding: 2rem;">
        <h2 style="font-size: 2rem; color: #B91C1C; margin-bottom: 1rem;">Test Failed.</h2>
        <p style="font-size: 1.25rem;">You did not answer enough correctly this time.</p>
        <p style="margin-top: 1rem; color: #64748B;">Keep studying your review deck!</p>
      </div>`;
  }

  document.getElementById('q-category').textContent = "Practice Test Complete";
  document.getElementById('q-id').textContent = "Result";
  document.getElementById('q-id').className = "question-id";
  document.querySelector('.question-container').style.display = 'none';
  document.getElementById('answers-container').classList.add('hidden');
  document.getElementById('reveal-btn').style.display = 'none';
  condEl.classList.remove('hidden');
  condEl.innerHTML = resultTemplate;

  // Disable controls
  document.getElementById('prev-btn').disabled = true;
  document.getElementById('next-btn').disabled = true;
  document.getElementById('progress').textContent = "Finished";
}

// Initialize
renderApp();
