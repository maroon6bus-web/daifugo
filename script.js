/**
 * AUDIO MANAGER - Web Audio API Synthesis
 */
class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = true;
        this.bgmOscs = [];
        this.gainNode = null;
        this.currentTrack = 'none';
        this.bgmPlayer = document.getElementById('bgm-player');
        this.tracks = {
            mozart_pianosonata15: 'https://ontama-m.com/midi/data/mp3_file/classic/mozart_pianosonata15_1_piano.mp3',
            mozart_pianoconcerto21: 'https://ontama-m.com/midi/data/mp3_file/classic/mozart_pianoconcerto21_3.mp3',
            mozart_pianoconcerto26: 'https://ontama-m.com/midi/data/mp3_file/classic/mozart_pianoconcerto26_1.mp3',
            chopin_kareinaru: 'https://ontama-m.com/midi/data/mp3_file/classic/chopin_kareinaru_piano.mp3',
            chopin_koinunowaltz: 'https://ontama-m.com/midi/data/mp3_file/classic/chopin_koinunowaltz_piano.mp3',
            chopin_nocturne9_2: 'https://ontama-m.com/midi/data/mp3_file/classic/chopin_nocturne9_2_piano.mp3'
        };
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.5; // ボリューム
        this.gainNode.connect(this.ctx.destination);
    }

    toggle() {
        if (!this.ctx) this.init();
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBGM();
        } else {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.playBGM();
        }
        return this.isMuted;
    }

    setTrack(track) {
        this.currentTrack = track;
        if (!this.isMuted) {
            this.playBGM();
        }
    }

    playBGM() {
        this.stopBGM();
        if (this.isMuted || this.currentTrack === 'none') return;

        const url = this.tracks[this.currentTrack];
        if (url) {
            this.bgmPlayer.src = url;
            this.bgmPlayer.volume = 0.4;
            this.bgmPlayer.play().catch(e => console.error("BGM Play Error:", e));
        }
    }

    // 以前のシンセサイズ方式（将来の拡張やフォールバック用として残す場合はここに記述）
    playPianoStyle(melody) {
        // 現在は使用していません
    }

    stopBGM() {
        if (this.bgmPlayer) {
            this.bgmPlayer.pause();
            this.bgmPlayer.currentTime = 0;
        }
        this.bgmOscs.forEach(osc => {
            try { osc.stop(); } catch(e) {}
        });
        this.bgmOscs = [];
    }

    playSFX(type) {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.ctx.destination);

        switch(type) {
            case 'flip':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                g.gain.setValueAtTime(0.1, now);
                g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'click':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
                g.gain.setValueAtTime(0.2, now);
                g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'discard':
                const noise = this.ctx.createBufferSource();
                const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
                noise.buffer = buffer;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, now);
                filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                const ng = this.ctx.createGain();
                ng.gain.setValueAtTime(0.1, now);
                ng.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                noise.connect(filter);
                filter.connect(ng);
                ng.connect(this.ctx.destination);
                noise.start(now);
                break;
        }
    }
}

class DaifugoGame {
    constructor() {
        this.audio = new AudioManager();
        this.suits = ['♠', '♥', '♦', '♣'];
        this.ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        this.players = [
            { id: 0, name: 'YOU', isCPU: false, hand: [], rank: 0, passed: false, finished: false },
            { id: 1, name: 'FOX', isCPU: true, hand: [], rank: 0, passed: false, finished: false },
            { id: 2, name: 'BEAR', isCPU: true, hand: [], rank: 0, passed: false, finished: false },
            { id: 3, name: 'RABBIT', isCPU: true, hand: [], rank: 0, passed: false, finished: false }
        ];
        this.deck = [];
        this.currentPlayerIndex = 0;
        this.isGameOver = false;
        this.isAnimating = false;
        this.finishedPlayersCount = 0;
        this.selectedCardIndices = new Set();
        
        // Game State
        this.fieldCards = [];
        this.lastPlayerIndex = -1;
        this.isRevolution = false;
        this.roundTimeout = null;

        // DOM elements
        this.turnIndicator = document.getElementById('turn-indicator');
        this.messageOverlay = document.getElementById('message-overlay');
        this.specialOverlay = document.getElementById('special-overlay');
        this.startBtn = document.getElementById('start-btn');
        this.resultOverlay = document.getElementById('result-overlay');
        this.actionControls = document.getElementById('action-controls');
        this.playBtn = document.getElementById('play-btn');
        this.passBtn = document.getElementById('pass-btn');

        this.initEvents();
    }

    initEvents() {
        this.startBtn.addEventListener('click', () => {
            this.audio.init();
            this.startGame();
        });
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.resultOverlay.classList.add('hidden');
            this.startBtn.classList.remove('hidden');
        });
        document.getElementById('sound-toggle').addEventListener('click', (e) => {
            const isMuted = this.audio.toggle();
            e.target.textContent = isMuted ? '🔇' : '🔊';
        });
        document.getElementById('bgm-selector').addEventListener('change', (e) => {
            this.audio.init();
            if (this.audio.isMuted) {
                document.getElementById('sound-toggle').click();
            }
            this.audio.setTrack(e.target.value);
        });
        this.playBtn.addEventListener('click', () => this.handlePlayClick());
        this.passBtn.addEventListener('click', () => this.handlePassClick());
    }

    startGame() {
        this.startBtn.classList.add('hidden');
        this.resultOverlay.classList.add('hidden');
        this.finishedPlayersCount = 0;
        this.isGameOver = false;
        this.isAnimating = false;
        this.isRevolution = false;
        this.fieldCards = [];
        this.lastPlayerIndex = -1;
        this.selectedCardIndices.clear();
        if (this.roundTimeout) clearTimeout(this.roundTimeout);

        // UIの初期化
        document.getElementById('field-cards').innerHTML = '';
        this.specialOverlay.classList.add('hidden');
        this.specialOverlay.textContent = '';

        const previousRanks = this.players.map(p => ({ id: p.id, rank: p.rank }));
        const hasPreviousRanks = previousRanks.some(r => r.rank > 0);

        this.players.forEach(p => {
            p.hand = [];
            p.rank = 0;
            p.passed = false;
            p.finished = false;
        });

        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
        this.sortHands();

        let starterIndex = 0;
        if (hasPreviousRanks) {
            this.exchangeCards(previousRanks);
            const daihinmin = this.players.find(p => previousRanks.find(r => r.id === p.id).rank === 4);
            if (daihinmin) starterIndex = daihinmin.id;
        }
        
        this.renderAllHands();
        this.startTurns(starterIndex);
    }

    exchangeCards(previousRanks) {
        const daifugo = this.players.find(p => previousRanks.find(r => r.id === p.id).rank === 1);
        const fugo = this.players.find(p => previousRanks.find(r => r.id === p.id).rank === 2);
        const hinmin = this.players.find(p => previousRanks.find(r => r.id === p.id).rank === 3);
        const daihinmin = this.players.find(p => previousRanks.find(r => r.id === p.id).rank === 4);

        if (!daifugo || !daihinmin) return;

        // 大富豪と大貧民の交換 (2枚)
        const daifugoWeakest = daifugo.hand.splice(0, 2);
        const daihinminStrongest = daihinmin.hand.splice(-2);
        daifugo.hand.push(...daihinminStrongest);
        daihinmin.hand.push(...daifugoWeakest);

        // 富豪と貧民の交換 (1枚)
        if (fugo && hinmin) {
            const fugoWeakest = fugo.hand.splice(0, 1);
            const hinminStrongest = hinmin.hand.splice(-1);
            fugo.hand.push(...hinminStrongest);
            hinmin.hand.push(...fugoWeakest);
        }

        this.sortHands();
        this.showSpecialMessage('カード交換が行われました', 2000);
        this.audio.playSFX('discard');
    }

    startTurns(starterIndex = 0) {
        this.currentPlayerIndex = starterIndex;
        this.processTurn();
    }

    createDeck() {
        this.deck = [];
        this.ranks.forEach((rank, val) => {
            this.suits.forEach(suit => {
                this.deck.push({ 
                    suit, rank, 
                    value: val + 1, // 3=1, 4=2, ..., 2=12
                    isJoker: false, 
                    id: `card-${suit}-${rank}` 
                });
            });
        });
        // 2 Jokers for Daifugo
        this.deck.push({ suit: '🤡', rank: 'JK', value: 13, isJoker: true, id: 'card-joker-1' });
        this.deck.push({ suit: '🤡', rank: 'JK', value: 13, isJoker: true, id: 'card-joker-2' });
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        this.deck.forEach((card, index) => {
            const playerIdx = index % this.players.length;
            this.players[playerIdx].hand.push(card);
        });
    }

    sortHands() {
        this.players.forEach(p => {
            p.hand.sort((a, b) => a.value - b.value);
        });
    }

    renderAllHands() {
        this.players.forEach(p => {
            this.renderHand(p);
        });
    }

    renderHand(player) {
        const container = document.getElementById(`hand-${player.id}`);
        container.innerHTML = '';
        const hand = player.hand;
        const totalCards = hand.length;
        if (totalCards === 0) return;

        const isVertical = player.id === 1 || player.id === 3;
        const isMobile = window.innerWidth <= 768;
        
        let dimension;
        if (isVertical) {
            dimension = isMobile ? window.innerHeight * 0.4 : 250;
        } else {
            dimension = isMobile ? window.innerWidth - 80 : Math.min(600, window.innerWidth - 300);
        }
        
        const maxOverlap = isVertical ? (isMobile ? 15 : 25) : (isMobile ? 25 : 40);
        const overlap = Math.min(maxOverlap, dimension / Math.max(1, totalCards));
        
        hand.forEach((card, index) => {
            const isFaceDown = player.isCPU && !this.isGameOver;
            const cardEl = this.createCardElement(card, isFaceDown);
            
            const offset = (index - (totalCards - 1) / 2) * overlap;
            
            if (isVertical) {
                cardEl.style.top = `calc(50% + ${offset}px)`;
                cardEl.style.left = '50%';
                cardEl.style.transform = `translate(-50%, -50%) rotate(${player.id === 1 ? 90 : -90}deg)`;
            } else {
                cardEl.style.left = `calc(50% + ${offset}px)`;
                cardEl.style.top = '50%';
                const rotation = (index - (totalCards - 1) / 2) * 2;
                cardEl.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
            }
            
            cardEl.style.zIndex = index;

            if (!player.isCPU && !this.isGameOver) {
                let isSelectable = true;
                if (this.selectedCardIndices.size > 0 && !this.selectedCardIndices.has(index)) {
                    const selectedCards = Array.from(this.selectedCardIndices).map(i => player.hand[i]);
                    const nonJokers = selectedCards.filter(c => !c.isJoker);
                    const targetValue = nonJokers.length > 0 ? nonJokers[0].value : null;

                    if (!card.isJoker && targetValue !== null && card.value !== targetValue) {
                        isSelectable = false;
                    }
                }

                if (this.selectedCardIndices.has(index)) {
                    cardEl.classList.add('selected');
                } else if (!isSelectable) {
                    cardEl.classList.add('unselectable');
                }

                cardEl.addEventListener('click', () => this.toggleCardSelection(index));
            }
            
            container.appendChild(cardEl);
        });
    }

    createCardElement(card, isFaceDown) {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${card.isJoker ? 'joker' : ''} ${isFaceDown ? 'face-down' : ''}`;
        cardEl.id = card.id;

        const inner = document.createElement('div');
        inner.className = 'card-inner';

        const front = document.createElement('div');
        front.className = 'card-front';
        
        if (card.isJoker) {
            front.innerHTML = `
                <div class="card-rank">JK</div>
                <div class="card-suit">🤡</div>
                <div class="card-rank" style="transform: rotate(180deg)">JK</div>
            `;
        } else {
            const isRed = card.suit === '♥' || card.suit === '♦';
            const suitClass = isRed ? 'suit-red' : 'suit-black';
            front.innerHTML = `
                <div class="card-rank ${suitClass}">${card.rank}</div>
                <div class="card-suit ${suitClass}">${card.suit}</div>
                <div class="card-rank ${suitClass}" style="transform: rotate(180deg)">${card.rank}</div>
            `;
        }

        const back = document.createElement('div');
        back.className = 'card-back';

        inner.appendChild(front);
        inner.appendChild(back);
        cardEl.appendChild(inner);

        return cardEl;
    }

    toggleCardSelection(index) {
        if (this.isAnimating || this.currentPlayerIndex !== 0) return;
        
        if (this.selectedCardIndices.has(index)) {
            this.selectedCardIndices.delete(index);
        } else {
            const player = this.players[0];
            const clickedCard = player.hand[index];
            
            if (this.selectedCardIndices.size > 0) {
                const selectedCards = Array.from(this.selectedCardIndices).map(i => player.hand[i]);
                const nonJokers = selectedCards.filter(c => !c.isJoker);
                const targetValue = nonJokers.length > 0 ? nonJokers[0].value : null;

                if (!clickedCard.isJoker && targetValue !== null && clickedCard.value !== targetValue) {
                    return; // Invalid selection
                }
            }

            this.selectedCardIndices.add(index);
        }
        this.renderHand(this.players[0]);
        this.audio.playSFX('click');
        this.updateActionButtons();
    }

    updateActionButtons() {
        const selectedCards = Array.from(this.selectedCardIndices).map(i => this.players[0].hand[i]);
        const isValid = this.isValidMove(selectedCards);
        this.playBtn.disabled = !isValid;
    }

    isValidMove(selectedCards) {
        if (selectedCards.length === 0) return false;

        // Check if all selected cards are of the same rank (or include Joker)
        const nonJokers = selectedCards.filter(c => !c.isJoker);
        if (nonJokers.length > 0) {
            const rank = nonJokers[0].value;
            if (!nonJokers.every(c => c.value === rank)) return false;
        }

        // If field is empty, any set is valid
        if (this.fieldCards.length === 0) return true;

        // Must play same number of cards
        if (selectedCards.length !== this.fieldCards.length) return false;

        // Compare values
        const fieldVal = this.getFieldValue();
        const playVal = this.getCardsValue(selectedCards);

        if (this.isRevolution) {
            return playVal < fieldVal;
        } else {
            return playVal > fieldVal;
        }
    }

    getCardsValue(cards) {
        // For a set, we can just take the value of any non-joker, or Joker value (13)
        const nonJoker = cards.find(c => !c.isJoker);
        return nonJoker ? nonJoker.value : 13;
    }

    getFieldValue() {
        return this.getCardsValue(this.fieldCards);
    }

    async handlePlayClick() {
        if (this.isAnimating) return;
        const indices = Array.from(this.selectedCardIndices).sort((a, b) => b - a);
        const cardsToPlay = indices.map(i => this.players[0].hand.splice(i, 1)[0]);
        this.selectedCardIndices.clear();
        await this.playCards(cardsToPlay, 0);
    }

    async handlePassClick() {
        if (this.isAnimating) return;
        this.players[0].passed = true;
        this.audio.playSFX('click');
        this.nextTurn();
    }

    async playCards(cards, playerIndex) {
        this.isAnimating = true;
        const player = this.players[playerIndex];
        
        // Cards stack on the field, so we don't clear visuals here anymore
        // They will be cleared in resetRound when everyone passes

        this.fieldCards = cards;
        this.lastPlayerIndex = playerIndex;
        this.audio.playSFX('flip');

        // Animation: move cards to field
        const promises = cards.map(card => {
            const el = document.getElementById(card.id);
            if (el) {
                el.classList.remove('face-down');
                return this.animateCardToField(el);
            }
            return Promise.resolve();
        });
        await Promise.all(promises);

        // Render field
        this.renderField();
        this.renderHand(player);

        // Check for 8-giri
        const is8Giri = cards.some(c => c.rank === '8');
        // Check for Revolution
        if (cards.length >= 4) {
            this.isRevolution = !this.isRevolution;
            this.showSpecialMessage('REVOLUTION!', 2000);
            this.audio.playSFX('discard');
        }

        // Check if player finished
        if (player.hand.length === 0) {
            this.finishPlayer(player);
        }

        if (is8Giri) {
            this.showSpecialMessage('8-GIRI', 1000);
            this.audio.playSFX('discard');
            await this.delay(1000);
            await this.resetRound(playerIndex);
        } else {
            this.isAnimating = false;
            this.nextTurn();
        }
    }

    renderField() {
        const container = document.getElementById('field-cards');
        // Do not clear innerHTML so cards stack
        
        // Add a slight random offset for the whole play to make it look like a pile
        const pileOffsetX = (Math.random() * 30 - 15);
        const pileOffsetY = (Math.random() * 30 - 15);

        // Darken any existing cards on the field to make the new ones pop
        const existingCards = Array.from(container.children);
        existingCards.forEach(el => el.classList.add('darkened'));

        this.fieldCards.forEach((card, index) => {
            const el = this.createCardElement(card, false);
            const isMobile = window.innerWidth <= 768;
            const offset = (index - (this.fieldCards.length - 1) / 2) * (isMobile ? 15 : 30);
            el.style.left = `calc(50% + ${offset + pileOffsetX}px)`;
            el.style.top = `calc(50% + ${pileOffsetY}px)`;
            el.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 20 - 10}deg)`;
            container.appendChild(el);
        });
    }

    async clearFieldVisuals() {
        const container = document.getElementById('field-cards');
        const cards = Array.from(container.children);
        const promises = cards.map(el => {
            el.style.transition = 'all 0.5s ease-in';
            el.style.transform = 'translate(1000px, -500px) rotate(360deg) scale(0.1)';
            el.style.opacity = '0';
            return this.delay(500);
        });
        await Promise.all(promises);
        container.innerHTML = '';
    }

    async resetRound(starterIndex) {
        this.fieldCards = [];
        this.selectedCardIndices.clear(); // 選択をクリア
        this.players.forEach(p => p.passed = false);
        await this.clearFieldVisuals();
        this.isAnimating = false; // アニメーションロックを解除
        this.currentPlayerIndex = starterIndex;
        // If starter finished, move to next
        if (this.players[this.currentPlayerIndex].finished) {
            this.currentPlayerIndex = this.findNextActivePlayer(this.currentPlayerIndex);
        }
        this.updateActivePlayerUI();
        this.processTurn();
    }

    findNextActivePlayer(currentIdx) {
        let next = (currentIdx + 1) % 4;
        let count = 0;
        while (this.players[next].finished && count < 4) {
            next = (next + 1) % 4;
            count++;
        }
        return next;
    }

    nextTurn() {
        const activePlayersCount = this.players.filter(p => !p.finished).length;
        if (activePlayersCount <= 1) {
            this.endGame();
            return;
        }

        // Find next player who hasn't passed and hasn't finished
        let nextIdx = (this.currentPlayerIndex + 1) % 4;
        let loopCount = 0;
        while ((this.players[nextIdx].passed || this.players[nextIdx].finished) && loopCount < 4) {
            nextIdx = (nextIdx + 1) % 4;
            loopCount++;
        }

        // If everyone else passed, the last player to play wins the round
        const stillInRound = this.players.filter(p => !p.passed && !p.finished);
        if (stillInRound.length === 1 && stillInRound[0].id === this.lastPlayerIndex) {
            this.roundTimeout = setTimeout(() => this.resetRound(this.lastPlayerIndex), 800);
            return;
        }
        
        // If somehow everyone passed (shouldn't happen with above logic but for safety)
        if (stillInRound.length === 0) {
            this.roundTimeout = setTimeout(() => this.resetRound(this.lastPlayerIndex !== -1 ? this.lastPlayerIndex : 0), 800);
            return;
        }

        this.currentPlayerIndex = nextIdx;
        this.processTurn();
    }

    async processTurn() {
        if (this.isGameOver) return;
        this.updateActivePlayerUI();
        
        const player = this.players[this.currentPlayerIndex];
        if (!player.isCPU) {
            this.actionControls.classList.remove('hidden');
            this.updateActionButtons();
            this.updateStatus('あなたの番です。出すカードを選んでください');
        } else {
            this.actionControls.classList.add('hidden');
            this.updateStatus(`${player.name}の番です...`);
            await this.delay(1000);
            this.cpuPlay(player);
        }
    }

    cpuPlay(player) {
        const hand = player.hand;
        const fieldCount = this.fieldCards.length || 1;
        const isFieldEmpty = this.fieldCards.length === 0;
        
        // Group cards by value
        const groups = {};
        hand.forEach(c => {
            if (c.isJoker) return;
            if (!groups[c.value]) groups[c.value] = [];
            groups[c.value].push(c);
        });

        let possibleMoves = [];
        const jokers = hand.filter(c => c.isJoker);
        
        if (isFieldEmpty) {
            for (let size = 1; size <= 4; size++) {
                for (let val in groups) {
                    if (groups[val].length === size) {
                        possibleMoves.push(groups[val]);
                    }
                }
            }
            if (jokers.length > 0) possibleMoves.push([jokers[0]]);
        } else {
            for (let val in groups) {
                if (groups[val].length >= fieldCount) {
                    const move = groups[val].slice(0, fieldCount);
                    if (this.isValidMove(move)) possibleMoves.push(move);
                }
            }
            if (jokers.length > 0) {
                for (let val in groups) {
                    if (groups[val].length >= fieldCount - 1) {
                        const move = [...groups[val].slice(0, fieldCount - 1), jokers[0]];
                        if (this.isValidMove(move)) possibleMoves.push(move);
                    }
                }
                if (jokers.length >= fieldCount) {
                    const move = jokers.slice(0, fieldCount);
                    if (this.isValidMove(move)) possibleMoves.push(move);
                }
            }
        }

        if (possibleMoves.length > 0) {
            // Annotate moves
            possibleMoves.forEach(move => {
                move.sortValue = this.getCardsValue(move);
                move.is8Giri = move.some(c => c.rank === '8');
                move.hasJoker = move.some(c => c.isJoker);
                move.size = move.length;
            });

            // AI Personalities
            if (player.name === 'RABBIT') {
                // Aggressive: Prioritize 8-giri and multiple cards if field is empty
                possibleMoves.sort((a, b) => {
                    if (a.is8Giri && !b.is8Giri) return -1;
                    if (!a.is8Giri && b.is8Giri) return 1;
                    if (isFieldEmpty) {
                        if (a.size !== b.size) return b.size - a.size; // Prefer larger sets
                    }
                    return this.isRevolution ? b.sortValue - a.sortValue : a.sortValue - b.sortValue;
                });
            } else if (player.name === 'BEAR') {
                // Cautious: Sort by weakest first
                possibleMoves.sort((a, b) => this.isRevolution ? b.sortValue - a.sortValue : a.sortValue - b.sortValue);
                
                let move = possibleMoves[0];
                let isStrong = this.isRevolution ? move.sortValue <= 3 : move.sortValue >= 11; // K, A, 2 (or 3, 4, 5 in Rev)
                if (!isFieldEmpty && hand.length > 3) {
                    if (isStrong || move.hasJoker) {
                        // 80% chance to pass to save strong cards
                        if (Math.random() < 0.8) {
                            possibleMoves = []; // Force pass
                        }
                    }
                }
            } else if (player.name === 'FOX') {
                // Smart: Conserve Joker for strong plays or 8-giri
                possibleMoves.sort((a, b) => this.isRevolution ? b.sortValue - a.sortValue : a.sortValue - b.sortValue);
                
                possibleMoves = possibleMoves.filter(move => {
                    if (!move.hasJoker) return true;
                    let isStrong = this.isRevolution ? move.sortValue <= 4 : move.sortValue >= 10;
                    if (hand.length <= 3) return true;
                    if (move.is8Giri) return true;
                    if (isStrong) return true;
                    // If no other valid moves without Joker exist, and we filtered it out, we might pass.
                    // To be smarter, FOX prefers to pass rather than waste Joker.
                    return false;
                });

                if (isFieldEmpty && possibleMoves.length > 0) {
                    // Re-sort to prioritize 8-giri or strong pairs to keep initiative
                    possibleMoves.sort((a, b) => {
                        if (a.is8Giri && !b.is8Giri) return -1;
                        if (!a.is8Giri && b.is8Giri) return 1;
                        let aIsStrong = this.isRevolution ? a.sortValue <= 4 : a.sortValue >= 10;
                        let bIsStrong = this.isRevolution ? b.sortValue <= 4 : b.sortValue >= 10;
                        if (a.size > 1 && aIsStrong && (b.size === 1 || !bIsStrong)) return -1;
                        return this.isRevolution ? b.sortValue - a.sortValue : a.sortValue - b.sortValue;
                    });
                }
            } else {
                possibleMoves.sort((a, b) => this.isRevolution ? b.sortValue - a.sortValue : a.sortValue - b.sortValue);
            }

            if (possibleMoves.length > 0) {
                const move = possibleMoves[0];
                // Remove from hand
                move.forEach(card => {
                    const idx = player.hand.findIndex(c => c.id === card.id);
                    player.hand.splice(idx, 1);
                });
                this.playCards(move, player.id);
            } else {
                player.passed = true;
                this.showMessage(`${player.name}がパスしました`);
                this.nextTurn();
            }
        } else {
            player.passed = true;
            this.showMessage(`${player.name}がパスしました`);
            this.nextTurn();
        }
    }

    finishPlayer(player) {
        player.finished = true;
        this.finishedPlayersCount++;
        player.rank = this.finishedPlayersCount;
        
        const titles = ['大富豪', '富豪', '貧民', '大貧民'];
        const rankClass = ['rank-daifugo', 'rank-fugo', 'rank-hinmin', 'rank-daihinmin'];
        
        const label = document.querySelector(`#player-${player.id} .rank-label`);
        label.textContent = titles[player.rank - 1] || '貧民';
        label.className = `rank-label ${rankClass[player.rank - 1] || 'rank-hinmin'}`;
        label.classList.remove('hidden');
        
        this.showSpecialMessage(`${player.name} FINISH!`, 1500);
    }

    updateActivePlayerUI() {
        this.players.forEach(p => {
            const infoEl = document.querySelector(`#player-${p.id} .player-info`);
            if (infoEl) {
                if (p.id === this.currentPlayerIndex && !this.isGameOver) {
                    infoEl.classList.add('active');
                } else {
                    infoEl.classList.remove('active');
                }
            }
        });
    }

    async animateCardToField(cardEl) {
        const fieldRect = document.getElementById('table-area').getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        const dx = fieldRect.left + fieldRect.width/2 - (cardRect.left + cardRect.width/2);
        const dy = fieldRect.top + fieldRect.height/2 - (cardRect.top + cardRect.height/2);
        
        cardEl.style.transition = 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
        cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.1) rotate(${Math.random() * 20 - 10}deg)`;
        cardEl.style.zIndex = '1000';
        await this.delay(600);
    }

    showSpecialMessage(text, duration) {
        this.specialOverlay.textContent = text;
        this.specialOverlay.classList.remove('hidden');
        setTimeout(() => this.specialOverlay.classList.add('hidden'), duration);
    }

    showMessage(text) {
        this.messageOverlay.textContent = text;
        this.messageOverlay.classList.remove('hidden');
        setTimeout(() => this.messageOverlay.classList.add('hidden'), 1500);
    }

    updateStatus(text) {
        this.turnIndicator.textContent = text;
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    endGame() {
        this.isGameOver = true;
        this.actionControls.classList.add('hidden');
        
        // The last remaining player gets the last rank
        const loser = this.players.find(p => !p.finished);
        if (loser) {
            this.finishPlayer(loser);
        }

        const titles = ['大富豪', '富豪', '貧民', '大貧民'];
        const rankListEl = document.getElementById('rank-list');
        rankListEl.innerHTML = '';
        
        [...this.players].sort((a, b) => a.rank - b.rank).forEach(p => {
            const item = document.createElement('div');
            item.className = 'rank-item';
            item.innerHTML = `<span>${p.rank}位: ${p.name}</span> <span class="rank-label">${titles[p.rank-1] || '貧民'}</span>`;
            rankListEl.appendChild(item);
        });

        document.getElementById('result-title').textContent = this.players[0].id === 0 ? '👑 勝利！' : '終了';
        this.resultOverlay.classList.remove('hidden');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new DaifugoGame();
});
