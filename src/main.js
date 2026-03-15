import './style.css'

// State
let questions = [];
let currentIndex = 0;
let isRevealed = false;

// DOM Elements
const app = document.querySelector('#app');

function renderApp() {
  app.innerHTML = `
    <header>
      <h1>US Civics Prep</h1>
      <p>Study for the 2025 Naturalization Test</p>
    </header>
    
    <div class="flashcard-container">
      <div class="card" id="flashcard">
        <div class="card-header">
          <span class="question-id" id="q-id">#--</span>
          <span class="category" id="q-category">Loading...</span>
        </div>
        
        <div class="question-text" id="q-text">
          Loading questions...
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
          <!-- Answers will be injected here -->
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

  // document level keybindings
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (!isRevealed) revealAnswer();
      else nextQuestion();
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
    questions = await res.json();

    if (questions.length > 0) {
      updateCard();
    }
  } catch (err) {
    document.getElementById('q-text').textContent = "Error loading questions. Please try again.";
    console.error(err);
  }
}

function updateCard() {
  const q = questions[currentIndex];
  isRevealed = false;

  const idEl = document.getElementById('q-id');
  const catEl = document.getElementById('q-category');
  const textEl = document.getElementById('q-text');
  const condEl = document.getElementById('q-conditions');
  const condTextEl = document.getElementById('q-conditions-text');
  const ansContainer = document.getElementById('answers-container');
  const revealBtn = document.getElementById('reveal-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const progressEl = document.getElementById('progress');

  idEl.textContent = `#${q.id}`;
  catEl.textContent = q.category;
  textEl.textContent = q.question;

  if (q.special_conditions) {
    condEl.classList.remove('hidden');
    condTextEl.textContent = q.special_conditions;
  } else {
    condEl.classList.add('hidden');
  }

  // Reset answers space
  ansContainer.innerHTML = '';
  q.answers.forEach(ans => {
    const div = document.createElement('div');
    div.className = 'answer-item';
    div.innerHTML = `<span class="answer-bullet">•</span> <span>${ans}</span>`;
    ansContainer.appendChild(div);
  });

  ansContainer.classList.add('hidden');
  revealBtn.style.display = 'block';

  // Animation reset
  const card = document.querySelector('.card');
  card.classList.remove('animate-fade-in');
  void card.offsetWidth; // trigger reflow
  card.classList.add('animate-fade-in');

  // Update controls
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === questions.length - 1;
  progressEl.textContent = `${currentIndex + 1} / ${questions.length}`;
}

function revealAnswer() {
  if (isRevealed) return;
  isRevealed = true;
  document.getElementById('answers-container').classList.remove('hidden');
  document.getElementById('reveal-btn').style.display = 'none';
}

function nextQuestion() {
  if (currentIndex < questions.length - 1) {
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

// Initialize
renderApp();
