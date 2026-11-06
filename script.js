
"use strict";

/* =========================================
   1. GAME CONFIGURATION
========================================= */

const MOVES = {
  rock: {
    emoji: "✊",
    label: "ROCK"
  },
  paper: {
    emoji: "✋",
    label: "PAPER"
  },
  scissors: {
    emoji: "✌️",
    label: "SCISSORS"
  }
};

const WINS_AGAINST = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper"
};

const GAME_MODES = {
  best3: {
    label: "BEST OF 3",
    targetWins: 2,
    totalRounds: 3
  },
  best5: {
    label: "BEST OF 5",
    targetWins: 3,
    totalRounds: 5
  },
  endless: {
    label: "ENDLESS",
    targetWins: Infinity,
    totalRounds: Infinity
  }
};


/* =========================================
   2. GAME STATE
========================================= */

let gameMode = "best5";

let playerScore = 0;
let computerScore = 0;

// Counts only rounds with a winner.
// Draws never increase this value.
let roundsPlayed = 0;

let isPlaying = false;
let gameOver = false;

let soundEnabled = true;
let audioContext = null;


/* =========================================
   3. HTML ELEMENT REFERENCES
========================================= */

const elements = {
  playerScore: document.getElementById("playerScore"),
  computerScore: document.getElementById("computerScore"),

  roundNumber: document.getElementById("roundNumber"),
  roundTotal: document.getElementById("roundTotal"),
  roundProgress: document.getElementById("roundProgress"),

  playerHand: document.getElementById("playerHand"),
  computerHand: document.getElementById("computerHand"),

  playerStage: document.getElementById("playerStage"),
  computerStage: document.getElementById("computerStage"),

  playerCaption: document.getElementById("playerCaption"),
  computerCaption: document.getElementById("computerCaption"),

  resultTitle: document.getElementById("resultTitle"),
  resultMessage: document.getElementById("resultMessage"),

  statusPill: document.getElementById("statusPill"),

  choices: [...document.querySelectorAll(".choice-button")],
  modeButtons: [...document.querySelectorAll(".mode-button")],

  soundToggle: document.getElementById("soundToggle"),
  resetButton: document.getElementById("resetButton"),

  endModal: document.getElementById("endModal"),
  endTitle: document.getElementById("endTitle"),
  endMessage: document.getElementById("endMessage"),
  endTrophy: document.getElementById("endTrophy"),

  finalPlayerScore: document.getElementById("finalPlayerScore"),
  finalComputerScore: document.getElementById("finalComputerScore"),

  playAgainButton: document.getElementById("playAgainButton"),
  footerStatus: document.getElementById("footerStatus")
};


/* =========================================
   4. SOUND EFFECTS
========================================= */

function playTone(
  frequency,
  duration = 0.12,
  type = "sine",
  volume = 0.045,
  delay = 0
) {
  if (!soundEnabled) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    audioContext ||= new AudioContextClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const start = audioContext.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      start + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(start);
    oscillator.stop(start + duration);

  } catch (error) {
    console.warn("Audio is unavailable:", error);
  }
}


function playCountdown() {
  [0, 1, 2].forEach((step) => {
    playTone(
      step === 2 ? 660 : 440,
      0.09,
      "triangle",
      0.035,
      step * 0.24
    );
  });
}


function playResultSound(result) {
  if (result === "win") {
    playTone(523, .14, "sine", .05, 0);
    playTone(659, .14, "sine", .05, .12);
    playTone(784, .22, "sine", .05, .24);
  } else if (result === "lose") {
    playTone(330, .2, "triangle", .045, 0);
    playTone(247, .28, "triangle", .045, .16);
  } else {
    playTone(440, .13, "sine", .035, 0);
    playTone(440, .13, "sine", .035, .18);
  }
}


/* =========================================
   5. HELPER FUNCTIONS
========================================= */

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}


function randomMove() {
  const availableMoves = Object.keys(MOVES);

  return availableMoves[
    Math.floor(Math.random() * availableMoves.length)
  ];
}


function getModeSettings() {
  return GAME_MODES[gameMode];
}


/* =========================================
   6. STATUS DISPLAY
========================================= */

function setStatus(text, active = false) {
  elements.statusPill.innerHTML =
    `<span class="status-dot"></span>${text}`;

  elements.statusPill.style.color =
    active ? "var(--cyan)" : "var(--green)";

  elements.statusPill.style.borderColor =
    active
      ? "rgba(85,217,232,.2)"
      : "rgba(84,224,173,.18)";
}


/* =========================================
   7. SCOREBOARD
========================================= */

function animateScore(scoreElement) {
  scoreElement.classList.remove("score-pop");

  void scoreElement.offsetWidth;

  scoreElement.classList.add("score-pop");
}


function updateScoreboard() {
  const previousPlayerScore =
    Number(elements.playerScore.textContent);

  const previousComputerScore =
    Number(elements.computerScore.textContent);

  elements.playerScore.textContent = playerScore;
  elements.computerScore.textContent = computerScore;

  if (previousPlayerScore !== playerScore) {
    animateScore(elements.playerScore);
  }

  if (previousComputerScore !== computerScore) {
    animateScore(elements.computerScore);
  }

  const settings = getModeSettings();

  // The displayed round is based only on decisive rounds.
  elements.roundNumber.textContent =
    String(roundsPlayed + 1).padStart(2, "0");

  if (gameMode === "endless") {
    elements.roundTotal.textContent = "∞";
    elements.roundProgress.parentElement.style.display = "none";
  } else {
    elements.roundTotal.textContent =
      `/ ${String(settings.totalRounds).padStart(2, "0")}`;

    elements.roundProgress.parentElement.style.display = "block";

    elements.roundProgress.style.width =
      `${(roundsPlayed / settings.totalRounds) * 100}%`;
  }
}


/* =========================================
   8. ANIMATION CONTROLS
========================================= */

function clearHandStates() {
  [
    elements.playerStage,
    elements.computerStage
  ].forEach((stage) => {
    stage.classList.remove(
      "winner",
      "loser",
      "reveal",
      "shake"
    );
  });
}


function setMove(side, move) {
  const isPlayer = side === "player";

  const hand = isPlayer
    ? elements.playerHand
    : elements.computerHand;

  const caption = isPlayer
    ? elements.playerCaption
    : elements.computerCaption;

  const stage = isPlayer
    ? elements.playerStage
    : elements.computerStage;

  hand.textContent = MOVES[move].emoji;
  hand.setAttribute("aria-label", MOVES[move].label);

  caption.textContent = MOVES[move].label;

  stage.classList.remove("reveal");

  void stage.offsetWidth;

  stage.classList.add("reveal");
}


/* =========================================
   9. GAME LOGIC
========================================= */

function decideWinner(playerMove, computerMove) {
  if (playerMove === computerMove) {
    return "draw";
  }

  if (WINS_AGAINST[playerMove] === computerMove) {
    return "win";
  }

  return "lose";
}


/* =========================================
   10. DISPLAY ROUND RESULT
========================================= */

function showRoundResult(result, playerMove, computerMove) {
  const titles = {
    win: "You win this round!",
    lose: "Computer takes the round",
    draw: "It's a draw!"
  };

  const messages = {
    win:
      `${MOVES[playerMove].label} beats ${MOVES[computerMove].label}. Nice move!`,

    lose:
      `${MOVES[computerMove].label} beats ${MOVES[playerMove].label}. The machine got you.`,

    draw:
      `Both chose ${MOVES[playerMove].label}. No point awarded. Play this round again!`
  };

  elements.resultTitle.textContent = titles[result];
  elements.resultTitle.className = `result-title ${result}`;
  elements.resultMessage.textContent = messages[result];

  elements.playerStage.classList.toggle(
    "winner",
    result === "win"
  );

  elements.playerStage.classList.toggle(
    "loser",
    result === "lose"
  );

  elements.computerStage.classList.toggle(
    "winner",
    result === "lose"
  );

  elements.computerStage.classList.toggle(
    "loser",
    result === "win"
  );

  setStatus(
    result === "win"
      ? "ROUND WON"
      : result === "lose"
        ? "ROUND LOST"
        : "DRAW — REPLAY"
  );

  playResultSound(result);
}


/* =========================================
   11. BUTTON LOCKING
========================================= */

function setControlsDisabled(disabled) {
  elements.choices.forEach((button) => {
    button.disabled = disabled;
  });

  elements.modeButtons.forEach((button) => {
    button.disabled = disabled;
  });

  elements.resetButton.disabled = disabled;

  elements.resetButton.style.opacity =
    disabled ? ".45" : "1";
}


/* =========================================
   12. PLAY A ROUND
========================================= */

async function playRound(playerMove) {
  if (isPlaying || gameOver) return;

  isPlaying = true;

  setControlsDisabled(true);
  clearHandStates();

  elements.resultTitle.className = "result-title";
  elements.resultTitle.textContent = "Rock...";

  elements.resultMessage.textContent =
    "Get ready to reveal your moves.";

  elements.playerCaption.textContent = "LOCKED IN";
  elements.computerCaption.textContent = "THINKING...";

  setStatus("GET READY", true);

  playCountdown();

  // Rapidly cycle both hands through Rock, Paper and Scissors.
  const moveSequence = ["rock", "paper", "scissors"];
  let animationStep = 0;

  const handCycle = window.setInterval(() => {
    const playerCyclingMove =
      moveSequence[animationStep % moveSequence.length];

    const computerCyclingMove =
      moveSequence[(animationStep + 1) % moveSequence.length];

    elements.playerHand.textContent =
      MOVES[playerCyclingMove].emoji;

    elements.computerHand.textContent =
      MOVES[computerCyclingMove].emoji;

    elements.playerHand.setAttribute(
      "aria-label",
      `Revealing ${MOVES[playerCyclingMove].label}`
    );

    elements.computerHand.setAttribute(
      "aria-label",
      "Computer move is being revealed"
    );

    animationStep++;
  }, 85);

  // Countdown: Rock, Paper, Scissors.
  for (const word of ["Rock...", "Paper...", "Scissors..."]) {
    elements.resultTitle.classList.remove("countdown");

    elements.resultTitle.textContent = word;

    void elements.resultTitle.offsetWidth;

    elements.resultTitle.classList.add("countdown");

    await wait(450);
  }

  // Stop cycling before revealing the real moves.
  window.clearInterval(handCycle);

  const computerMove = randomMove();

  elements.resultTitle.classList.remove("countdown");

  setMove("player", playerMove);
  setMove("computer", computerMove);

  const result = decideWinner(playerMove, computerMove);

  /*
    IMPORTANT DRAW RULE:

    Only a decisive result increases roundsPlayed.
    A draw changes neither score nor round count.
  */

  if (result === "win") {
    playerScore++;
    roundsPlayed++;
  } else if (result === "lose") {
    computerScore++;
    roundsPlayed++;
  }

  // For a draw, all three counters remain unchanged.
  updateScoreboard();

  showRoundResult(result, playerMove, computerMove);

  await wait(850);

  // Check if the match has ended.
  if (checkMatchWinner()) {
    finishGame();
    return;
  }

  isPlaying = false;

  setControlsDisabled(false);

  if (result === "draw") {
    elements.footerStatus.textContent = "DRAW — REPLAY THE SAME ROUND";

    elements.resultMessage.textContent =
      "No score and no round consumed. Choose again to replay this round.";
  } else {
    elements.footerStatus.textContent =
      gameMode === "endless"
        ? "ENDLESS MODE — KEEP PLAYING"
        : "NEXT ROUND — MAKE YOUR MOVE";

    elements.resultMessage.textContent +=
      " Choose again for the next round.";
  }

  setStatus(
    result === "draw" ? "REPLAY ROUND" : "YOUR MOVE"
  );
}


/* =========================================
   13. CHECK MATCH WINNER
========================================= */

function checkMatchWinner() {
  if (gameMode === "endless") {
    return false;
  }

  const target = getModeSettings().targetWins;

  return (
    playerScore >= target ||
    computerScore >= target
  );
}


/* =========================================
   14. FINISH MATCH
========================================= */

function finishGame() {
  gameOver = true;
  isPlaying = false;

  elements.modeButtons.forEach((button) => {
    button.disabled = false;
  });

  elements.resetButton.disabled = false;
  elements.resetButton.style.opacity = "1";

  const playerWon = playerScore > computerScore;

  elements.endTitle.textContent = playerWon
    ? "Victory is yours!"
    : "The machine wins!";

  elements.endMessage.textContent = playerWon
    ? `You won ${getModeSettings().label}. Champion status: unlocked.`
    : `The computer won ${getModeSettings().label}. Ready for a rematch?`;

  elements.endTrophy.textContent =
    playerWon ? "🏆" : "🤖";

  elements.finalPlayerScore.textContent = playerScore;
  elements.finalComputerScore.textContent = computerScore;

  elements.footerStatus.textContent = "MATCH COMPLETE";

  setStatus("MATCH COMPLETE");

  window.setTimeout(() => {
    elements.endModal.hidden = false;
    elements.playAgainButton.focus();
  }, 250);
}


/* =========================================
   15. CHANGE GAME MODE
========================================= */

function changeGameMode(newMode) {
  if (!GAME_MODES[newMode]) return;
  if (gameMode === newMode) return;

  gameMode = newMode;

  elements.modeButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.mode === gameMode
    );
  });

  resetGame();
}


/* =========================================
   16. RESET GAME
========================================= */

function resetGame() {
  playerScore = 0;
  computerScore = 0;
  roundsPlayed = 0;

  isPlaying = false;
  gameOver = false;

  elements.endModal.hidden = true;

  elements.playerHand.textContent = "✊";
  elements.computerHand.textContent = "✊";

  elements.playerHand.setAttribute("aria-label", "Your move");
  elements.computerHand.setAttribute("aria-label", "Computer move");

  elements.playerCaption.textContent = "READY TO PLAY";
  elements.computerCaption.textContent = "WAITING...";

  elements.resultTitle.textContent = "Ready when you are";
  elements.resultTitle.className = "result-title";

  elements.resultMessage.textContent =
    "Choose your move below to start the game.";

  elements.footerStatus.textContent =
    `${getModeSettings().label} MODE`;

  setControlsDisabled(false);

  clearHandStates();

  setStatus("YOUR MOVE");

  updateScoreboard();
}


/* =========================================
   17. SOUND TOGGLE
========================================= */

function toggleSound() {
  soundEnabled = !soundEnabled;

  elements.soundToggle.classList.toggle(
    "muted",
    !soundEnabled
  );

  elements.soundToggle.setAttribute(
    "aria-pressed",
    String(soundEnabled)
  );

  elements.soundToggle.setAttribute(
    "aria-label",
    soundEnabled ? "Mute sound" : "Enable sound"
  );

  if (soundEnabled) {
    playTone(660, .1, "sine", .04);
  }
}


/* =========================================
   18. EVENT LISTENERS
========================================= */

elements.choices.forEach((button) => {
  button.addEventListener("click", () => {
    playRound(button.dataset.move);
  });
});


elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    changeGameMode(button.dataset.mode);
  });
});


elements.resetButton.addEventListener("click", resetGame);

elements.playAgainButton.addEventListener("click", resetGame);

elements.soundToggle.addEventListener("click", toggleSound);


/* =========================================
   19. KEYBOARD SHORTCUTS
========================================= */

document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }

  const activeTag = document.activeElement?.tagName;

  if (
    activeTag === "INPUT" ||
    activeTag === "TEXTAREA"
  ) {
    return;
  }

  if (isPlaying) return;

  const keyMoves = {
    "1": "rock",
    "2": "paper",
    "3": "scissors"
  };

  if (keyMoves[event.key]) {
    playRound(keyMoves[event.key]);
  }

  if (
    event.key.toLowerCase() === "r" &&
    elements.endModal.hidden
  ) {
    resetGame();
  }

  if (
    event.key === "Escape" &&
    !elements.endModal.hidden
  ) {
    resetGame();
  }
});


/* =========================================
   20. INITIALIZE GAME
========================================= */

updateScoreboard();

setStatus("YOUR MOVE");

elements.footerStatus.textContent = "BEST OF 5 MODE";

console.log("RPS Arena initialized successfully!");
