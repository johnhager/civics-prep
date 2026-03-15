import './style.css'

// State
let appMode = 'menu'; // 'menu', 'civics', 'reading', 'writing', 'n400'
let isFullMock = false;
let mockPhase = 0; // 0: N400, 1: Reading, 2: Writing, 3: Civics Practice
let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let isRevealed = false;
let isShuffle = false;
let isHardMode = false;
let isAutoPlay = true;
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
    if (appMode === 'civics') {
      checkVoiceAnswer(transcript);
    } else if (appMode === 'reading') {
      checkReadingAnswer(transcript);
    } else if (appMode === 'n400') {
      checkN400Answer(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    stopListeningUI();
  };

  recognition.onend = () => {
    stopListeningUI();
  };
}

let readingQuestions = [];
let currentReadingIndex = 0;

// Helper to "unlock" speech and mic on first user gesture
function primeBrowserSpeech() {
  // Silent speak to unlock iOS audio
  const silent = new SpeechSynthesisUtterance("");
  window.speechSynthesis.speak(silent);

  // Start mic just to trigger permission dialog
  if (recognition) {
    try {
      // Just start it. speakQuestion or other logic will stop it when they really start.
      recognition.start();
      // We don't stop it immediately in a callback to avoid race conditions 
      // with the first question's own start/stop logic.
    } catch (e) {
      // Already started or blocked
    }
  }
}

function renderMainMenu() {
  appMode = 'menu';
  isFullMock = false;
  isPracticeTest = false;
  isHardMode = false;
  isShuffle = false;
  mockPhase = 0;
  if (recognition) recognition.stop();
  window.speechSynthesis.cancel();

  app.innerHTML = `
    <header>
      <h1>US Civics Prep</h1>
      <p>Study for the 2025 Naturalization Test <span class="wa-badge">Washington State</span></p>
    </header>

  <div class="menu-container">
    <div class="menu-card" id="go-civics">
      <div class="menu-card-icon">🏛️</div>
      <div class="menu-card-content">
        <h3>Civics Study Flashcards</h3>
        <p>Practice the 128 official questions or take a randomized 20-question practice exam.</p>
      </div>
    </div>

    <div class="menu-card" id="go-reading">
      <div class="menu-card-icon">📖</div>
      <div class="menu-card-content">
        <h3>Reading Test Practice</h3>
        <p>Practice reading English sentences aloud with precise voice recognition grading.</p>
      </div>
    </div>

    <div class="menu-card" id="go-writing">
      <div class="menu-card-icon">✍️</div>
      <div class="menu-card-content">
        <h3>Writing Test Practice</h3>
        <p>Listen to an English sentence and practice typing it out correctly.</p>
      </div>
    </div>

    <div class="menu-card" id="go-n400">
      <div class="menu-card-icon">🇺🇸</div>
      <div class="menu-card-content">
        <h3>N-400 Review Simulator</h3>
        <p>Mock interview covering your application and the 'Yes/No' moral character questions.</p>
      </div>
    </div>

    <div class="menu-card" id="go-full-mock">
      <div class="menu-card-icon">🎓</div>
      <div class="menu-card-content">
        <h3>Full Mock Interview</h3>
        <p>A back-to-back simulation of all four interview components.</p>
      </div>
    </div>
  </div>
`;

  document.getElementById('go-civics').addEventListener('click', () => {
    primeBrowserSpeech();
    renderCivicsApp();
  });
  document.getElementById('go-reading').addEventListener('click', () => {
    primeBrowserSpeech();
    renderReadingTest();
  });
  document.getElementById('go-writing').addEventListener('click', renderWritingTest);
  document.getElementById('go-n400').addEventListener('click', () => {
    primeBrowserSpeech();
    renderN400Test();
  });
  document.getElementById('go-full-mock').addEventListener('click', () => {
    primeBrowserSpeech();
    startFullMock();
  });
}

function startFullMock() {
  isFullMock = true;
  mockPhase = 0;
  renderN400Test();

  setTimeout(() => {
    const msg = new SpeechSynthesisUtterance("Welcome to your mock interview. We will begin with your N-400 review, followed by the reading test, writing test, and civics test. Please press start interview when you are ready.");
    setPremiumVoice(msg);
    window.speechSynthesis.speak(msg);
  }, 500);
}

function advanceMockPhase() {
  mockPhase++;
  if (mockPhase === 1) {
    renderReadingTest();
  } else if (mockPhase === 2) {
    renderWritingTest();
  } else if (mockPhase === 3) {
    // Ensure data is loaded before starting the test!
    renderCivicsApp();
    const checkReady = setInterval(() => {
      if (allQuestions.length > 0) {
        clearInterval(checkReady);
        togglePracticeTest();
      }
    }, 100);
  } else {
    isFullMock = false;
    renderMainMenu();
    alert("Mock Interview Complete!");
  }
}

function renderCivicsApp() {
  appMode = 'civics';
  // If we aren't coming from a mock interview, reset the specific modes
  if (!isFullMock) {
    isPracticeTest = false;
    isHardMode = false;
    isShuffle = false;
  }
  app.innerHTML = `
    <header>
      <h1>US Civics Prep</h1>
      <p>Study for the 2025 Naturalization Test <span class="wa-badge">Washington State</span></p>
    </header>
    
    <div class="back-btn-container">
      <button class="back-btn" id="back-to-menu-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Menu
      </button>
    </div>

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
  document.getElementById('back-to-menu-btn').addEventListener('click', renderMainMenu);
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

  if (isAutoPlay) {
    document.getElementById('auto-play-btn').classList.add('active');
  }

  // Use a named function for the keydown listener so we can easily add/remove it if needed later,
  // but for now document listener is okay since civics is the only app using spacebar right now.
  document.addEventListener('keydown', handleCivicsKeydown);

  loadData();
}

function handleCivicsKeydown(e) {
  // Only handle if we're actually in the civics view
  if (!document.getElementById('reveal-btn')) return;

  if (e.key === ' ' || e.key === 'Enter') {
    if (!isRevealed) revealAnswer();
  } else if (e.key === 'ArrowRight') {
    nextQuestion();
  } else if (e.key === 'ArrowLeft') {
    prevQuestion();
  }
}

async function loadData() {
  try {
    const res = await fetch('/data/civics_questions.json');
    if (!res.ok) throw new Error('Failed to fetch data');
    allQuestions = await res.json();

    if (allQuestions.length > 0) {
      applyLocalizedAnswers();
      updateScoreboard();
      updateActiveDeck();
      // Add a tiny delay for the first question to allow priming to stabilize
      setTimeout(updateCard, 100);
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
    } else if (q.id === 30) { // Speaker
      q.answers = ["Mike Johnson"];
    } else if (q.id === 38) { // President
      q.answers = ["Donald J. Trump", "Donald Trump"];
    } else if (q.id === 39) { // VP
      q.answers = ["J.D. Vance", "James David Vance", "Vance"];
    } else if (q.id === 57) { // Chief Justice
      q.answers = ["John Roberts", "John G. Roberts, Jr."];
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
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // Ignore if not running
    }
  }
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
    // Force stop first to ensure a clean start state
    try { recognition.stop(); } catch (e) { }

    // Tiny delay to allow previous stop to process in some browser engines
    setTimeout(() => {
      try {
        recognition.start();

        const audioBtn = document.getElementById('audio-btn');
        if (audioBtn) {
          audioBtn.classList.add('listening');
          audioBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`;
        }

        // For Reading Test UI
        const readBtn = document.getElementById('r-audio-btn');
        if (readBtn && appMode === 'reading') {
          readBtn.innerHTML = `Listening...`;
          readBtn.classList.replace('btn-primary', 'btn-red');
          readBtn.style.animation = 'pulseMic 1.5s infinite';
        }

        // For N-400 Test UI
        const n400Btn = document.getElementById('n400-action-btn');
        if (n400Btn && appMode === 'n400') {
          n400Btn.innerHTML = `Listening...`;
          n400Btn.classList.replace('btn-primary', 'btn-red');
          n400Btn.style.animation = 'pulseMic 1.5s infinite';
          document.getElementById('n400-interviewer').innerHTML = '🗣️';
        }
      } catch (e) {
        console.error("Delayed start failed", e);
      }
    }, 50);
  } catch (e) {
    console.error("Main startListening block failed", e);
  }
}

function stopListeningUI() {
  const audioBtn = document.getElementById('audio-btn');
  if (audioBtn) {
    audioBtn.classList.remove('listening');
    audioBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  }

  const readBtn = document.getElementById('r-audio-btn');
  if (readBtn && appMode === 'reading') {
    readBtn.innerHTML = `🎙️ Tap to Speak`;
    readBtn.classList.replace('btn-red', 'btn-primary');
    readBtn.style.animation = 'none';
  }

  const n400Btn = document.getElementById('n400-action-btn');
  if (n400Btn && appMode === 'n400') {
    n400Btn.innerHTML = `Tap to Answer (if audio stopped)`;
    n400Btn.classList.replace('btn-red', 'btn-primary');
    n400Btn.style.animation = 'none';
    document.getElementById('n400-interviewer').innerHTML = '👩‍⚖️';
  }
}

function checkVoiceAnswer(transcript) {
  const q = activeQuestions[currentIndex];
  if (!q) return;

  const normalize = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  };

  // Custom replacements for common misinterpretations / homophones
  let rawTranscript = transcript;
  rawTranscript = rawTranscript.replace(/hi texas/gi, "high taxes");
  rawTranscript = rawTranscript.replace(/free speech/gi, "freedom of speech");
  rawTranscript = rawTranscript.replace(/free religion/gi, "freedom of religion");
  rawTranscript = rawTranscript.replace(/george washington/gi, "washington");
  rawTranscript = rawTranscript.replace(/jefferson/gi, "thomas jefferson");
  rawTranscript = rawTranscript.replace(/hamilton/gi, "alexander hamilton");
  rawTranscript = rawTranscript.replace(/madison/gi, "james madison");
  rawTranscript = rawTranscript.replace(/roosevelt/gi, "franklin roosevelt");
  rawTranscript = rawTranscript.replace(/lincoln/gi, "abraham lincoln");

  const userText = normalize(rawTranscript);

  const getKeywords = (str) => {
    const stops = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'in', 'on', 'of', 'and', 'or', 'by', 'with']);
    return str.split(' ').filter(w => w.length > 2 && !stops.has(w));
  };

  const getRequiredCount = (cond) => {
    if (!cond) return 1;
    const match = cond.match(/Name (\w+)/i);
    if (!match) return 1;
    const words = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    return words[match[1].toLowerCase()] || 1;
  };

  const requiredCount = getRequiredCount(q.special_conditions);
  const matchedAnswers = new Set();

  for (const ans of q.answers) {
    const normAns = normalize(ans);
    let matchFound = false;

    // 1. Direct or robust substring match
    if (userText.includes(normAns) || (normAns.includes(userText) && userText.length > 4)) {
      matchFound = true;
    } else {
      // 2. Fuzzy Keyword matching approach
      const ansKeywords = getKeywords(normAns);
      if (ansKeywords.length > 0) {
        const matchCount = ansKeywords.filter(kw => userText.includes(kw)).length;
        if (matchCount === ansKeywords.length || (ansKeywords.length >= 3 && matchCount >= ansKeywords.length - 1)) {
          matchFound = true;
        }
      }
    }

    if (matchFound) {
      matchedAnswers.add(ans);
    }
  }

  const isCorrect = matchedAnswers.size >= requiredCount;

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

  idEl.textContent = `#${q.id} `;
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
    const bullet = document.createElement('span');
    bullet.className = 'answer-bullet';
    bullet.textContent = '•';
    const text = document.createElement('span');
    text.textContent = ans;
    div.appendChild(bullet);
    div.appendChild(text);
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

  if (isFullMock) {
    document.getElementById('q-category').textContent += " (Continuing to next phase in 5s...)";
    setTimeout(advanceMockPhase, 5000);
  }
}


// --- Reading Test Logic ---

function renderReadingTest() {
  appMode = 'reading';
  app.innerHTML = `
    <header>
      <h1>Reading Test</h1>
      <p>Please read the following sentence aloud.</p>
    </header>
    
    <div class="back-btn-container">
      <button class="back-btn" id="back-to-menu-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Menu
      </button>
    </div>

    <div class="flashcard-container">
      <div class="card">
        <div class="question-container" style="justify-content: center; text-align: center; padding: 2rem 0; min-height: 8rem; align-items: center;">
          <div class="question-text" id="r-text" style="font-size: 2rem; font-weight: normal;">Loading...</div>
        </div>
        
        <div class="special-conditions hidden" id="r-conditions" style="text-align: center; justify-content: center;">
           <span id="r-conditions-text"></span>
        </div>

        <button id="r-audio-btn" class="btn btn-primary" style="display: flex; gap: 0.5rem; justify-content: center; align-items: center; width: 100%; font-size: 1.1rem; padding: 1rem;">
          🎙️ Tap to Speak
        </button>
      </div>

      <div class="controls">
        <button id="r-prev-btn" class="btn btn-secondary" disabled>← Previous</button>
        <div id="r-progress" class="progress">-- / --</div>
        <button id="r-next-btn" class="btn btn-secondary" disabled>Next →</button>
      </div>
    </div>
`;
  document.getElementById('back-to-menu-btn').addEventListener('click', renderMainMenu);
  document.getElementById('r-audio-btn').addEventListener('click', () => {
    if (recognition) startListening();
    else alert("Speech Recognition is not supported on this browser.");
  });

  document.getElementById('r-prev-btn').addEventListener('click', () => {
    if (currentReadingIndex > 0) { currentReadingIndex--; updateReadingCard(); }
  });
  document.getElementById('r-next-btn').addEventListener('click', () => {
    if (currentReadingIndex < readingQuestions.length - 1) { currentReadingIndex++; updateReadingCard(); }
  });

  loadReadingData();
}

async function loadReadingData() {
  try {
    const res = await fetch('/data/reading_questions.json');
    if (!res.ok) throw new Error('Failed to fetch reading data');
    const data = await res.json();
    // Randomize for mock variety
    readingQuestions = data.sort(() => 0.5 - Math.random());
    currentReadingIndex = 0;
    updateReadingCard();
  } catch (err) {
    document.getElementById('r-text').textContent = "Error loading sentences.";
    console.error(err);
  }
}

function updateReadingCard() {
  if (readingQuestions.length === 0) return;
  const q = readingQuestions[currentReadingIndex];

  document.getElementById('r-text').textContent = q.question;

  const condEl = document.getElementById('r-conditions');
  condEl.classList.add('hidden');
  condEl.style.backgroundColor = '';
  condEl.style.color = '';

  document.getElementById('r-prev-btn').disabled = currentReadingIndex === 0;
  document.getElementById('r-next-btn').disabled = currentReadingIndex === readingQuestions.length - 1;
  const progressText = isFullMock ? "Mock Interview" : `${currentReadingIndex + 1} / ${readingQuestions.length}`;
  document.getElementById('r-progress').textContent = progressText;
}

function checkReadingAnswer(transcript) {
  const q = readingQuestions[currentReadingIndex];
  if (!q) return;

  const normalize = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  };

  const userText = normalize(transcript);
  const targetText = normalize(q.question);

  // They just have to read it. Let's do a fuzzy comparison.
  // Count how many words they hit right.
  const targetWords = targetText.split(' ');
  const matchCount = targetWords.filter(w => userText.includes(w)).length;

  // If they hit 75%+ of the words, we count it as a successful reading.
  const isCorrect = (matchCount / targetWords.length) >= 0.75;

  const condEl = document.getElementById('r-conditions');
  const condTextEl = document.getElementById('r-conditions-text');

  condEl.classList.remove('hidden');
  condEl.className = 'special-conditions voice-feedback';
  condEl.style.backgroundColor = isCorrect ? 'var(--color-green-light)' : 'var(--color-red-light)';
  condEl.style.color = isCorrect ? '#047857' : '#B91C1C';
  condTextEl.innerHTML = `🎙️ Heard: <i>"${transcript}"</i>`;

  if (isCorrect) {
    const msg = new SpeechSynthesisUtterance("Passed.");
    msg.lang = 'en-US';
    msg.rate = 1.0;
    setPremiumVoice(msg);
    msg.onend = () => {
      if (isFullMock) {
        setTimeout(advanceMockPhase, 1500);
      } else if (currentReadingIndex < readingQuestions.length - 1) {
        currentReadingIndex++;
        updateReadingCard();
      } else {
        document.getElementById('r-progress').textContent = "Finished";
      }
    };
    window.speechSynthesis.speak(msg);
  } else {
    const msg = new SpeechSynthesisUtterance("Did not hear you read the sentence clearly. Please try again.");
    msg.lang = 'en-US';
    msg.rate = 0.9;
    setPremiumVoice(msg);
    window.speechSynthesis.speak(msg);
  }
}

// --- Writing Test Logic ---
let writingQuestions = [];
let currentWritingIndex = 0;

function renderWritingTest() {
  appMode = 'writing';
  if (recognition) recognition.stop();
  window.speechSynthesis.cancel();

  app.innerHTML = `
    <header>
      <h1>Writing Test</h1>
      <p>Listen to the sentence and write it precisely.</p>
    </header>
    
    <div class="back-btn-container">
      <button class="back-btn" id="back-to-menu-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Menu
      </button>
    </div>

    <div class="flashcard-container">
      <div class="card">
        <div style="text-align:center; padding: 1.5rem 0;">
           <button id="w-audio-btn" class="audio-btn" style="margin: 0 auto; width: 64px; height: 64px;">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
           </button>
           <p style="margin-top: 1rem; color: var(--color-text-muted); font-weight: 500;">Tap to Listen</p>
        </div>
        
        <div style="margin-top: 0.5rem;">
           <textarea id="w-input" class="w-input" placeholder="Type what you hear here..." rows="3" style="width: 100%; box-sizing: border-box; font-family: var(--font-sans); font-size: 1.25rem; padding: 1rem; border-radius: var(--radius-sm); border: 2px solid var(--color-border); outline: none; resize: none;"></textarea>
           <p id="w-validation" style="color: #B91C1C; font-size: 0.875rem; margin-top: 0.5rem; display: none;">Check your spelling and try again.</p>
        </div>

        <div class="special-conditions hidden" id="w-conditions" style="margin-top: 1rem;">
           <span id="w-conditions-text"></span>
        </div>

        <button id="w-check-btn" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">Check Answer</button>
        <button id="w-reveal-btn" class="btn btn-secondary" style="margin-top: 0.5rem; width: 100%;">Show Answer</button>
      </div>
      
      <div class="controls">
        <button id="w-prev-btn" class="btn btn-secondary" disabled>← Previous</button>
        <div id="w-progress" class="progress">-- / --</div>
        <button id="w-next-btn" class="btn btn-secondary" disabled>Next →</button>
      </div>
    </div>
  `;

  document.getElementById('back-to-menu-btn').addEventListener('click', renderMainMenu);

  document.getElementById('w-audio-btn').addEventListener('click', () => {
    const q = writingQuestions[currentWritingIndex];
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(q.question);
    msg.lang = 'en-US';
    msg.rate = 0.8;
    setPremiumVoice(msg);
    window.speechSynthesis.speak(msg);
  });

  document.getElementById('w-check-btn').addEventListener('click', checkWritingAnswer);
  document.getElementById('w-reveal-btn').addEventListener('click', revealWritingAnswer);

  document.getElementById('w-prev-btn').addEventListener('click', () => {
    if (currentWritingIndex > 0) { currentWritingIndex--; updateWritingCard(); }
  });
  document.getElementById('w-next-btn').addEventListener('click', () => {
    if (currentWritingIndex < writingQuestions.length - 1) { currentWritingIndex++; updateWritingCard(); }
  });

  loadWritingData();
}

async function loadWritingData() {
  try {
    const res = await fetch('/data/writing_questions.json');
    if (!res.ok) throw new Error('Failed to fetch writing data');
    const data = await res.json();
    // Randomize for mock variety
    writingQuestions = data.sort(() => 0.5 - Math.random());
    currentWritingIndex = 0;
    updateWritingCard();
  } catch (err) {
    console.error(err);
  }
}

function updateWritingCard() {
  if (writingQuestions.length === 0) return;
  document.getElementById('w-input').value = "";
  document.getElementById('w-validation').style.display = "none";
  document.getElementById('w-input').disabled = false;

  const condEl = document.getElementById('w-conditions');
  condEl.classList.add('hidden');
  condEl.className = 'special-conditions hidden';
  condEl.style.backgroundColor = '';
  condEl.style.color = '';

  document.getElementById('w-reveal-btn').style.display = "block";
  document.getElementById('w-check-btn').style.display = "block";

  document.getElementById('w-prev-btn').disabled = currentWritingIndex === 0;
  document.getElementById('w-next-btn').disabled = currentWritingIndex === writingQuestions.length - 1;
  const progressText = isFullMock ? "Mock Interview" : `${currentWritingIndex + 1} / ${writingQuestions.length}`;
  document.getElementById('w-progress').textContent = progressText;
}

function checkWritingAnswer() {
  const q = writingQuestions[currentWritingIndex];
  const userText = document.getElementById('w-input').value;

  // Normalize both by removing case and strictly non-word characters for a lenient compare
  const normalize = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  };

  const isCorrect = normalize(userText) === normalize(q.question);

  if (isCorrect) {
    document.getElementById('w-validation').style.display = "none";
    const condEl = document.getElementById('w-conditions');
    const condTextEl = document.getElementById('w-conditions-text');

    condEl.classList.remove('hidden');
    condEl.className = 'special-conditions voice-feedback';
    condEl.style.backgroundColor = 'var(--color-green-light)';
    condEl.style.color = '#047857';
    condTextEl.innerHTML = `✅ Correct! <i>"${q.question}"</i>`;

    document.getElementById('w-input').disabled = true;
    document.getElementById('w-check-btn').style.display = "none";
    document.getElementById('w-reveal-btn').style.display = "none";

    const msg = new SpeechSynthesisUtterance("Correct.");
    msg.lang = 'en-US';
    msg.rate = 1.0;
    setPremiumVoice(msg);
    window.speechSynthesis.speak(msg);

    setTimeout(() => {
      if (isFullMock) {
        advanceMockPhase();
      } else if (currentWritingIndex < writingQuestions.length - 1) {
        currentWritingIndex++;
        updateWritingCard();
      } else {
        document.getElementById('w-progress').textContent = "Finished";
      }
    }, 2000);
  } else {
    document.getElementById('w-validation').style.display = "block";
    const msg = new SpeechSynthesisUtterance("Needs review. Try again.");
    msg.lang = 'en-US';
    msg.rate = 1.0;
    setPremiumVoice(msg);
    window.speechSynthesis.speak(msg);
  }
}

function revealWritingAnswer() {
  const q = writingQuestions[currentWritingIndex];

  const condEl = document.getElementById('w-conditions');
  const condTextEl = document.getElementById('w-conditions-text');

  condEl.classList.remove('hidden');
  condEl.className = 'special-conditions voice-feedback';
  condEl.style.backgroundColor = 'var(--color-accent)';
  condEl.style.color = 'var(--color-primary)';
  condTextEl.innerHTML = `📝 Answer: <b>${q.question}</b>`;

  document.getElementById('w-input').disabled = true;
  document.getElementById('w-check-btn').style.display = "none";
  document.getElementById('w-reveal-btn').style.display = "none";
}

// --- N-400 Review Simulator Logic ---
let n400Questions = [];
let n400Deck = [];
let currentN400Index = 0;

function renderN400Test() {
  appMode = 'n400';
  if (recognition) recognition.stop();
  window.speechSynthesis.cancel();

  app.innerHTML = `
    <header>
      <h1>N-400 Simulator</h1>
      <p>Mock interview for your application details.</p>
    </header>
    
    <div class="back-btn-container">
      <button class="back-btn" id="back-to-menu-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Menu
      </button>
    </div>

    <div class="flashcard-container">
      <div class="card" style="text-align: center; padding: 2.5rem 1.5rem;">
         <div id="n400-interviewer" style="font-size: 5rem; margin-bottom: 1rem; transition: all 0.2s;">👩‍⚖️</div>
         <h2 id="n400-category" style="color: var(--color-primary); margin-bottom: 1rem; font-size: 1.5rem;">Ready to begin</h2>
         
         <p id="n400-question-text" style="font-size: 1.25rem; min-height: 4rem; margin-bottom: 1rem; color: var(--color-text-muted); font-style: italic;">
            Click "Start Interview" when you are ready.
         </p>
         
         <div id="n400-feedback" class="special-conditions hidden" style="margin-bottom: 1.5rem; justify-content: center;"></div>

         <button id="n400-action-btn" class="btn btn-primary" style="width: 100%; font-size: 1.1rem; padding: 1rem;">
            Start Interview
         </button>
      </div>
      
      <div class="controls">
         <div id="n400-progress" class="progress" style="width: 100%;">-- / --</div>
      </div>
    </div>
  `;

  document.getElementById('back-to-menu-btn').addEventListener('click', renderMainMenu);

  document.getElementById('n400-action-btn').addEventListener('click', () => {
    const btn = document.getElementById('n400-action-btn');
    if (btn.innerText.includes("Start")) {
      currentN400Index = 0;
      askN400Question();
    } else {
      // Fallback if voice gets stuck
      if (recognition) startListening();
    }
  });

  loadN400Data();
}

async function loadN400Data() {
  try {
    const res = await fetch('/data/n400_questions.json');
    if (!res.ok) throw new Error('Failed to fetch N400 data');
    n400Questions = await res.json();

    // Create a mock interview deck: 
    // 6 Background, 7 Part 10 (No), 2 Part 10 (Yes), 5 Definitions
    const bg = n400Questions.filter(q => q.category === 'Background').sort(() => 0.5 - Math.random()).slice(0, 6);
    const p10no = n400Questions.filter(q => q.type === 'no').sort(() => 0.5 - Math.random()).slice(0, 7);
    const p10yes = n400Questions.filter(q => q.type === 'yes').sort(() => 0.5 - Math.random()).slice(0, 2);
    const defs = n400Questions.filter(q => q.category === 'Definitions').sort(() => 0.5 - Math.random()).slice(0, 5);

    n400Deck = [...bg, ...p10no, ...p10yes, ...defs];
    // Shuffle the deck slightly so it's not perfectly grouped, but keep background mostly early
    const laterPart = n400Deck.slice(bg.length).sort(() => 0.5 - Math.random());
    n400Deck = [...bg, ...laterPart];

  } catch (err) {
    console.error(err);
  }
}

function askN400Question() {
  if (currentN400Index >= n400Deck.length) {
    document.getElementById('n400-category').textContent = "Interview Complete";
    document.getElementById('n400-question-text').textContent = "You have finished the N-400 review portion.";
    if (isFullMock) {
      document.getElementById('n400-question-text').textContent += " Continuing to next phase...";
      setTimeout(advanceMockPhase, 3000);
    }
    document.getElementById('n400-action-btn').style.display = 'none';
    document.getElementById('n400-feedback').classList.add('hidden');
    return;
  }

  const q = n400Deck[currentN400Index];

  document.getElementById('n400-category').textContent = q.category;
  document.getElementById('n400-question-text').textContent = "(Listening...)";
  document.getElementById('n400-progress').textContent = `${currentN400Index + 1} / ${n400Deck.length}`;

  const fbEl = document.getElementById('n400-feedback');
  fbEl.classList.add('hidden');

  document.getElementById('n400-action-btn').textContent = "Repeat Question";

  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(q.question);
  msg.lang = 'en-US';
  msg.rate = 1.0;
  // Use a different premium voice specifically for the interviewer? We'll just use default premium
  setPremiumVoice(msg);

  msg.onend = () => {
    if (appMode === 'n400' && recognition) {
      startListening();
    }
  };

  window.speechSynthesis.speak(msg);
}

function checkN400Answer(transcript) {
  const q = n400Deck[currentN400Index];
  const t = transcript.toLowerCase();

  const fbEl = document.getElementById('n400-feedback');
  fbEl.classList.remove('hidden');
  fbEl.className = 'special-conditions voice-feedback';

  // Grade it
  let isCorrect = false;
  let expectedTypeLabel = q.type.toUpperCase();

  if (q.type === 'yes') {
    isCorrect = t.includes('yes') || t.includes('yeah') || t.includes('do');
  } else if (q.type === 'no') {
    isCorrect = t.includes('no') || t.includes('not') || t.includes('never');
  } else if (q.type === 'no_or_open') {
    isCorrect = t.length >= 2; // Accept 'no' or any name
    expectedTypeLabel = "YES or NO (or other names)";
  } else if (q.type === 'keywords') {
    isCorrect = q.keywords.some(k => t.includes(k.toLowerCase()));
    expectedTypeLabel = "a definition using your own words";
  } else {
    // Open ended, just accept that they spoke
    isCorrect = t.length > 2;
  }

  document.getElementById('n400-question-text').textContent = `"${q.question}"`;

  if (isCorrect) {
    fbEl.style.backgroundColor = 'var(--color-green-light)';
    fbEl.style.color = '#047857';
    fbEl.innerHTML = `✅ You said: <i>"${transcript}"</i>`;

    const phrases = ["Okay.", "Thank you.", "Moving on.", "Alright."];
    const ack = new SpeechSynthesisUtterance(phrases[Math.floor(Math.random() * phrases.length)]);
    setPremiumVoice(ack);
    ack.rate = 1.1;

    currentN400Index++;
    ack.onend = () => {
      setTimeout(askN400Question, 1000);
    };
    window.speechSynthesis.speak(ack);
  } else {
    fbEl.style.backgroundColor = 'var(--color-red-light)';
    fbEl.style.color = '#B91C1C';
    fbEl.innerHTML = `⚠️ You said: <i>"${transcript}"</i>. Expected ${expectedTypeLabel}.`;

    const rep = new SpeechSynthesisUtterance("Let me repeat the question.");
    setPremiumVoice(rep);
    rep.onend = () => {
      setTimeout(askN400Question, 500);
    };
    window.speechSynthesis.speak(rep);
  }
}

// Initialize
renderMainMenu();
