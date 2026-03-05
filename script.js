// Ultimate Horse Derby - Game Logic

const CONFIG = {
    HORSE_COUNT: 6,
    FINISH_LINE_PX: 0, // Will be calculated based on container width
    DASH_CHANCE_BASE: 0.005,
    STAMINA_DECAY_START: 0.7, // When 70% of race is done
    STARTING_BALANCE: 1000
};

const horseNames = [
    "Fúria do Trovão", "Relâmpago", "Sombra Veloz", "Ouro Puro",
    "Vento Sul", "Bravo Brulê", "Cometa", "Titã"
];

let gameState = {
    balance: parseInt(localStorage.getItem('derby_balance')) || CONFIG.STARTING_BALANCE,
    horses: [],
    selectedHorseIndex: null,
    betAmount: 100,
    isRacing: false,
    raceProgress: {}, // horseIndex: leftPosition
    winner: null,
    raceStartTime: 0
};

// UI Elements
const els = {
    balance: document.getElementById('balance-amount'),
    prepScreen: document.getElementById('prep-screen'),
    raceTrack: document.getElementById('race-track'),
    resultScreen: document.getElementById('result-screen'),
    horseList: document.getElementById('horse-selection-list'),
    betInput: document.getElementById('bet-amount'),
    startBtn: document.getElementById('start-race-btn'),
    selectedInfo: document.getElementById('selected-horse-info'),
    log: document.getElementById('log-messages'),
    winnerDisplay: document.getElementById('winner-display'),
    payoutInfo: document.getElementById('payout-info'),
    resetBtn: document.getElementById('reset-game-btn')
};

// Initialize Game
function init() {
    updateBalance(0);
    generateHorses();
    renderHorseSelection();

    els.betInput.addEventListener('change', (e) => {
        gameState.betAmount = Math.max(10, parseInt(e.target.value) || 10);
        e.target.value = gameState.betAmount;
    });

    els.startBtn.addEventListener('click', startRace);
    els.resetBtn.addEventListener('click', returnToPrep);
}

function updateBalance(change) {
    gameState.balance += change;
    els.balance.textContent = gameState.balance;
    localStorage.setItem('derby_balance', gameState.balance);
}

function generateHorses() {
    gameState.horses = [];
    for (let i = 0; i < CONFIG.HORSE_COUNT; i++) {
        // Attributes 1-10
        const speed = 4 + Math.random() * 6;
        const stamina = 4 + Math.random() * 6;
        const luck = 4 + Math.random() * 6;

        // Calculate Odds (simplified)
        const power = (speed * 1.5) + stamina + (luck * 0.5);
        const odds = (25 / power).toFixed(1);

        gameState.horses.push({
            id: i,
            name: horseNames[i],
            speed: speed.toFixed(1),
            stamina: stamina.toFixed(1),
            luck: luck.toFixed(1),
            odds: odds,
            color: `hsl(${i * (360 / CONFIG.HORSE_COUNT)}, 70%, 60%)`
        });
    }
}

function renderHorseSelection() {
    els.horseList.innerHTML = '';
    gameState.horses.forEach((horse, index) => {
        const card = document.createElement('div');
        card.className = 'horse-card';
        card.innerHTML = `
            <div class="horse-odds">x${horse.odds}</div>
            <h3>${horse.name}</h3>
            <div class="horse-stats">
                <span>Velocidade: ${horse.speed}</span>
                <span>Stamina: ${horse.stamina}</span>
                <span>Sorte: ${horse.luck}</span>
            </div>
        `;
        card.onclick = () => selectHorse(index);
        els.horseList.appendChild(card);
    });
}

function selectHorse(index) {
    gameState.selectedHorseIndex = index;
    const cards = document.querySelectorAll('.horse-card');
    cards.forEach((c, i) => {
        c.classList.toggle('selected', i === index);
    });

    const horse = gameState.horses[index];
    els.selectedInfo.textContent = `Apostando em ${horse.name} (Retorno: x${horse.odds})`;
    els.startBtn.disabled = false;
    log(`Você selecionou ${horse.name}.`);
}

function startRace() {
    if (gameState.balance < gameState.betAmount) {
        log("Saldo insuficiente para esta aposta!", "dash-msg");
        return;
    }

    updateBalance(-gameState.betAmount);
    gameState.isRacing = true;
    els.prepScreen.classList.add('hidden');
    els.raceTrack.classList.remove('hidden');
    els.raceTrack.classList.add('visible');

    setupTrack();
    log("A CORRIDA COMEÇOU!", "system-msg");

    gameState.winner = null;
    gameState.raceStartTime = performance.now();
    requestAnimationFrame(raceLoop);
}

function setupTrack() {
    els.raceTrack.innerHTML = '<div class="finish-line"></div>';
    gameState.horses.forEach((horse, i) => {
        const lane = document.createElement('div');
        lane.className = 'lane';
        lane.innerHTML = `
            <span class="lane-num">${i + 1}</span>
            <div id="horse-sprite-${i}" class="horse-sprite">
                <div class="horse-label">${horse.name}</div>
                <img src="assets/horse.png" style="width: 100%; height: 100%; filter: drop-shadow(0 0 5px ${horse.color})">
            </div>
        `;
        els.raceTrack.appendChild(lane);
        gameState.raceProgress[i] = 0;
    });
}

function raceLoop(timestamp) {
    if (!gameState.isRacing) return;

    const trackWidth = els.raceTrack.offsetWidth - 160; // Finish line offset + sprite width
    let finishedHorses = [];

    gameState.horses.forEach((horse, i) => {
        if (gameState.raceProgress[i] >= trackWidth) {
            finishedHorses.push(i);
            return;
        }

        // Base Speed Calculation
        let currentSpeed = parseFloat(horse.speed) * 0.15;

        // Random fluctuation
        currentSpeed += (Math.random() - 0.4) * 0.5;

        // Stamina Effect
        const progressPercent = gameState.raceProgress[i] / trackWidth;
        if (progressPercent > CONFIG.STAMINA_DECAY_START) {
            const decay = (11 - horse.stamina) * 0.05 * (progressPercent - CONFIG.STAMINA_DECAY_START);
            currentSpeed -= decay;
        }

        // Luck Dash
        if (Math.random() < CONFIG.DASH_CHANCE_BASE * (horse.luck / 5)) {
            currentSpeed += 5;
            if (i === gameState.selectedHorseIndex) {
                log(`${horse.name} deu uma arrancada!`, "dash-msg");
            }
        }

        gameState.raceProgress[i] += Math.max(0.1, currentSpeed);

        const sprite = document.getElementById(`horse-sprite-${i}`);
        sprite.style.left = `${gameState.raceProgress[i]}px`;

        // Check for leader change (simplified)
        if (Math.random() < 0.01 && gameState.raceProgress[i] === Math.max(...Object.values(gameState.raceProgress))) {
            log(`${horse.name} está na liderança!`);
        }
    });

    if (finishedHorses.length > 0 && !gameState.winner) {
        gameState.winner = finishedHorses[0];
        gameState.isRacing = false;
        setTimeout(showResults, 1000);
    } else {
        requestAnimationFrame(raceLoop);
    }
}

function showResults() {
    const winner = gameState.horses[gameState.winner];
    els.resultScreen.classList.remove('hidden');
    els.resultScreen.classList.add('visible');

    els.winnerDisplay.innerHTML = `
        <h3 style="color: ${winner.color}; font-size: 2rem;">1º LUGAR: ${winner.name}</h3>
        <p>O Cavalo ${winner.id + 1} cruzou a linha de chegada primeiro!</p>
    `;

    if (parseInt(gameState.winner) === parseInt(gameState.selectedHorseIndex)) {
        const payout = Math.floor(gameState.betAmount * parseFloat(winner.odds));
        updateBalance(payout);
        els.payoutInfo.innerHTML = `<span class="system-msg" style="font-size: 1.5rem">PARABÉNS! Você ganhou ${payout} Moedas!</span>`;
        log(`VITÓRIA! Ganhou ${payout} moedas.`);
    } else {
        els.payoutInfo.innerHTML = `<span class="danger-msg" style="color: var(--danger)">Você perdeu a aposta. Boa sorte na próxima!</span>`;
        log(`DERROTA. ${winner.name} venceu.`);
    }
}

function returnToPrep() {
    els.resultScreen.classList.add('hidden');
    els.raceTrack.classList.add('hidden');
    els.raceTrack.classList.remove('visible');
    els.prepScreen.classList.remove('hidden');

    // Refresh horses for next race
    generateHorses();
    renderHorseSelection();
    gameState.selectedHorseIndex = null;
    els.startBtn.disabled = true;
    els.selectedInfo.textContent = "Selecione um cavalo acima";
    log("Nova rodada disponível.");
}

function log(msg, type = "") {
    const p = document.createElement('p');
    if (type) p.className = type;
    p.textContent = `[${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`;
    els.log.appendChild(p);
    els.log.scrollTop = 0;
}

// Start
init();
