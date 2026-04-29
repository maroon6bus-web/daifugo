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
        this.bgmTimeout = null;
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

        const melodies = {
            satie: [369.99, 440.00, 392.00, 369.99, 277.18, 246.94], // ジムノペディ
            bach: [739.99, 659.25, 587.33, 554.37, 493.88, 466.16, 493.88, 392.00], // G線上のアリア
            beethoven: [207.65, 277.18, 329.63, 207.65, 277.18, 329.63, 220.00, 261.63, 349.23] // 月光
        };

        if (melodies[this.currentTrack]) {
            this.playPianoStyle(melodies[this.currentTrack]);
        }
    }

    playPianoStyle(melody) {
        let idx = 0;
        const play = () => {
            if (this.isMuted || this.currentTrack === 'none') return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            
            // ピアノらしい音色にするため正弦波とわずかな減衰
            osc.type = 'sine';
            osc.frequency.setValueAtTime(melody[idx], now);
            
            g.gain.setValueAtTime(0, now);
            g.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
            
            osc.connect(g);
            g.connect(this.gainNode);
            
            osc.start(now);
            osc.stop(now + 2.5);
            this.bgmOscs.push(osc);
            
            idx = (idx + 1) % melody.length;
            const tempos = { satie: 2500, bach: 2000, beethoven: 1200 };
            const tempo = tempos[this.currentTrack] || 1500;
            this.bgmTimeout = setTimeout(play, tempo);
        };
        play();
    }

    stopBGM() {
        clearTimeout(this.bgmTimeout);
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

class OldMaidGame {
    constructor() {
        this.audio = new AudioManager();
        this.suits = ['♠', '♥', '♦', '♣'];
        this.ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        this.players = [
            { id: 0, name: 'YOU', isCPU: false, hand: [], rank: 0 },
            { id: 1, name: 'FOX', isCPU: true, hand: [], rank: 0 },
            { id: 2, name: 'BEAR', isCPU: true, hand: [], rank: 0 },
            { id: 3, name: 'RABBIT', isCPU: true, hand: [], rank: 0 }
        ];
        this.deck = [];
        this.currentPlayerIndex = 0;
        this.isGameOver = false;
        this.isAnimating = false;
        this.finishedPlayersCount = 0;
        this.draggedCardIndex = null;

        // DOM elements
        this.turnIndicator = document.getElementById('turn-indicator');
        this.messageOverlay = document.getElementById('message-overlay');
        this.startBtn = document.getElementById('start-btn');
        this.resultOverlay = document.getElementById('result-overlay');

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
                // 自動的にミュート解除
                document.getElementById('sound-toggle').click();
            }
            this.audio.setTrack(e.target.value);
        });
    }

    startGame() {
        this.startBtn.classList.add('hidden');
        this.resultOverlay.classList.add('hidden');
        this.finishedPlayersCount = 0;
        this.isGameOver = false;
        this.isAnimating = false;
        
        if (this.shuffleInterval) clearInterval(this.shuffleInterval);
        this.shuffleInterval = setInterval(() => this.shuffleCPUsRandomly(), 8000);

        this.players.forEach(p => {
            p.hand = [];
            p.rank = 0;
            const badge = document.querySelector(`#player-${p.id} .rank-badge`);
            if (badge) {
                badge.classList.add('hidden');
                badge.textContent = '';
            }
        });

        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
        
        this.updateStatus('初期ペアを捨てています...');
        setTimeout(() => {
            this.players.forEach(p => {
                p.hand = this.removePairs(p.hand);
            });
            this.checkFinishedPlayers();
            this.renderAllHands();
            this.startTurns();
        }, 1500);
    }

    createDeck() {
        this.deck = [];
        for (const suit of this.suits) {
            for (const rank of this.ranks) {
                this.deck.push({ suit, rank, isJoker: false, id: `card-${suit}-${rank}` });
            }
        }
        this.deck.push({ suit: '🤡', rank: 'Joker', isJoker: true, id: 'card-joker' });
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

    removePairs(hand) {
        const rankGroups = {};
        hand.forEach(card => {
            if (card.isJoker) return;
            if (!rankGroups[card.rank]) rankGroups[card.rank] = [];
            rankGroups[card.rank].push(card);
        });

        const newHand = [];
        for (const rank in rankGroups) {
            const cards = rankGroups[rank];
            if (cards.length % 2 !== 0) {
                newHand.push(cards[0]);
            }
        }
        const joker = hand.find(c => c.isJoker);
        if (joker) newHand.push(joker);
        return newHand;
    }

    renderAllHands() {
        this.players.forEach(p => {
            // Show cards if it's player or if player is finished
            const isFaceDown = p.isCPU && p.hand.length > 0;
            this.renderHand(p, isFaceDown);
        });
    }

    renderHand(player, isFaceDown) {
        const container = document.getElementById(`hand-${player.id}`);
        container.innerHTML = '';
        const hand = player.hand;
        const totalCards = hand.length;
        if (totalCards === 0) return;

        const isVertical = player.id === 1 || player.id === 3;
        const dimension = isVertical ? 250 : Math.min(600, window.innerWidth - 400);
        const overlap = Math.min(isVertical ? 30 : 50, dimension / totalCards);
        
        hand.forEach((card, index) => {
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
            
            // Player hand drag and drop
            if (!player.isCPU && !this.isGameOver) {
                cardEl.setAttribute('draggable', 'true');
                cardEl.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
                cardEl.addEventListener('dragover', (e) => this.handleDragOver(e));
                cardEl.addEventListener('drop', (e) => this.handleDrop(e, index));
                cardEl.addEventListener('dragend', () => cardEl.classList.remove('dragging'));
            }

            // Interaction: Only allow picking from the NEXT player in cycle
            if (isFaceDown && !this.isGameOver) {
                const nextTargetIdx = this.findNextTargetIndex(this.currentPlayerIndex);
                if (player.id === nextTargetIdx && !this.players[this.currentPlayerIndex].isCPU) {
                    cardEl.addEventListener('click', () => this.handleCardClick(player.id, index, cardEl));
                    cardEl.style.cursor = 'pointer';
                }
            }
            
            container.appendChild(cardEl);
        });
    }

    handleDragStart(e, index) {
        this.draggedCardIndex = index;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    handleDrop(e, targetIndex) {
        e.stopPropagation();
        try {
            if (this.draggedCardIndex !== null && this.draggedCardIndex !== targetIndex) {
                const hand = this.players[0].hand;
                // 安全策: インデックスが有効か確認
                if (this.draggedCardIndex >= 0 && this.draggedCardIndex < hand.length) {
                    const movedCard = hand.splice(this.draggedCardIndex, 1)[0];
                    if (movedCard) {
                        hand.splice(targetIndex, 0, movedCard);
                        this.renderHand(this.players[0], false);
                        this.audio.playSFX('click');
                    }
                }
            }
        } catch (err) {
            console.error("Drop error:", err);
        } finally {
            this.draggedCardIndex = null;
        }
        return false;
    }

    async shuffleCPUsRandomly() {
        if (this.isGameOver || this.isAnimating) return;
        
        // Pick a random CPU player (1, 2, or 3)
        const cpuId = Math.floor(Math.random() * 3) + 1;
        const cpu = this.players[cpuId];
        if (cpu.hand.length < 2) return;

        this.isAnimating = true; // Block other actions
        try {
            const container = document.getElementById(`hand-${cpuId}`);
            container.classList.add('shuffling');
            
            // Logical shuffle
            for (let i = cpu.hand.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [cpu.hand[i], cpu.hand[j]] = [cpu.hand[j], cpu.hand[i]];
            }
            
            this.audio.playSFX('click');
            await this.delay(500);
            
            this.renderHand(cpu, true);
            container.classList.remove('shuffling');
        } catch (e) {
            console.error("Shuffle error:", e);
        } finally {
            this.isAnimating = false; // Release block
        }
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
                <div class="card-rank">Joker</div>
                <div class="card-suit">🤡</div>
                <div class="card-rank" style="transform: rotate(180deg)">Joker</div>
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

    updateStatus(text) {
        this.turnIndicator.textContent = text;
    }

    showMessage(text) {
        this.messageOverlay.textContent = text;
        this.messageOverlay.classList.remove('hidden');
        setTimeout(() => {
            this.messageOverlay.classList.add('hidden');
        }, 1200);
    }

    findNextTargetIndex(currentIndex) {
        let next = (currentIndex + 1) % this.players.length;
        while (this.players[next].hand.length === 0) {
            next = (next + 1) % this.players.length;
            if (next === currentIndex) return -1; // Should not happen
        }
        return next;
    }

    startTurns() {
        this.currentPlayerIndex = 0;
        this.processTurn();
    }

    updateActivePlayerUI() {
        this.players.forEach(p => {
            const infoEl = document.querySelector(`#player-${p.id} .player-info`);
            if (infoEl) {
                if (!this.isGameOver && p.id === this.currentPlayerIndex) {
                    infoEl.classList.add('active');
                } else {
                    infoEl.classList.remove('active');
                }
            }
        });
    }

    async processTurn() {
        if (this.isGameOver) return;
        
        this.updateActivePlayerUI();

        const currentPlayer = this.players[this.currentPlayerIndex];
        
        // If current player is finished, move to next
        if (currentPlayer.hand.length === 0) {
            this.nextTurn();
            return;
        }

        const targetIdx = this.findNextTargetIndex(this.currentPlayerIndex);
        const targetPlayer = this.players[targetIdx];

        if (currentPlayer.isCPU) {
            this.isAnimating = true; // CPU動作中もロックをかける
            try {
                this.updateStatus(`${currentPlayer.name}の番です...`);
                await this.delay(1000);
                
                const randomIndex = Math.floor(Math.random() * targetPlayer.hand.length);
                const card = targetPlayer.hand.splice(randomIndex, 1)[0];
                const cardEl = document.getElementById(card.id);
                
                if (cardEl) {
                    cardEl.classList.add('face-down');
                    this.audio.playSFX('click');
                    await this.animateCardToHand(cardEl, currentPlayer.id);
                }
                
                currentPlayer.hand.push(card);
                this.renderAllHands();
                
                const pairIndex = this.findPairIndex(currentPlayer.hand, card);
                if (pairIndex !== -1) {
                    await this.delay(500);
                    const card1 = card;
                    const card2 = currentPlayer.hand.splice(pairIndex, 1)[0];
                    const newCardIdx = currentPlayer.hand.indexOf(card1);
                    currentPlayer.hand.splice(newCardIdx, 1);
                    
                    this.showMessage(`${currentPlayer.name}がペアを捨てました`);
                    this.audio.playSFX('discard');
                    await this.animateDiscard(card1.id, card2.id);
                }
                
                this.checkFinishedPlayers();
                this.renderAllHands();
            } catch (e) {
                console.error("CPU turn error:", e);
            } finally {
                this.isAnimating = false; // 終了後にロック解除
                this.nextTurn();
            }
        } else {
            this.updateStatus(`あなたの番です。${targetPlayer.name}から引いてください`);
            this.renderAllHands();
        }
    }

    async handleCardClick(targetPlayerId, cardIndex, clickedEl) {
        if (this.players[this.currentPlayerIndex].isCPU || this.isAnimating) return;
        
        this.isAnimating = true;
        try {
            const targetPlayer = this.players[targetPlayerId];
            const card = targetPlayer.hand.splice(cardIndex, 1)[0];
            
            clickedEl.classList.remove('face-down');
            this.audio.playSFX('flip');
            await this.animateCardToHand(clickedEl, 0);
            
            const currentPlayer = this.players[0];
            currentPlayer.hand.push(card);
            this.renderAllHands();
            
            const pairIndex = this.findPairIndex(currentPlayer.hand, card);
            if (pairIndex !== -1) {
                await this.delay(500);
                const card1 = card;
                const card2 = currentPlayer.hand.splice(pairIndex, 1)[0];
                const newCardIdx = currentPlayer.hand.indexOf(card1);
                currentPlayer.hand.splice(newCardIdx, 1);
                
                this.showMessage('ペアが揃いました！');
                this.audio.playSFX('discard');
                await this.animateDiscard(card1.id, card2.id);
            }

            this.checkFinishedPlayers();
            this.renderAllHands();
        } catch (e) {
            console.error("Player turn error:", e);
        } finally {
            this.isAnimating = false;
            this.nextTurn();
        }
    }

    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        // If only one person left with cards, it's the loser
        const activePlayers = this.players.filter(p => p.hand.length > 0);
        if (activePlayers.length <= 1) {
            if (activePlayers.length === 1) {
                const loser = activePlayers[0];
                loser.rank = 4;
                const badge = document.querySelector(`#player-${loser.id} .rank-badge`);
                badge.textContent = `4位 (LOSE)`;
                badge.classList.remove('hidden');
            }
            this.endGame();
            return;
        }

        this.processTurn();
    }

    checkFinishedPlayers() {
        this.players.forEach(p => {
            if (p.hand.length === 0 && p.rank === 0) {
                this.finishedPlayersCount++;
                p.rank = this.finishedPlayersCount;
                const badge = document.querySelector(`#player-${p.id} .rank-badge`);
                badge.textContent = `${p.rank}位`;
                badge.classList.remove('hidden');
                this.showMessage(`${p.name}が上がりました！`);
            }
        });
    }

    findPairIndex(hand, newCard) {
        if (newCard.isJoker) return -1;
        return hand.findIndex(c => !c.isJoker && c.rank === newCard.rank && c.id !== newCard.id);
    }

    async animateCardToHand(cardEl, targetPlayerId) {
        const targetContainer = document.getElementById(`hand-${targetPlayerId}`);
        const rectStart = cardEl.getBoundingClientRect();
        const rectEnd = targetContainer.getBoundingClientRect();
        
        const deltaX = rectEnd.left + rectEnd.width/2 - (rectStart.left + rectStart.width/2);
        const deltaY = rectEnd.top + rectEnd.height/2 - (rectStart.top + rectStart.height/2);
        
        cardEl.style.transition = 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
        cardEl.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.1)`;
        cardEl.style.zIndex = '1000';
        
        await this.delay(600);
    }

    async animateDiscard(id1, id2) {
        const el1 = document.getElementById(id1);
        const el2 = document.getElementById(id2);
        const discardPile = document.getElementById('discard-pile');
        const rectDiscard = discardPile.getBoundingClientRect();

        const animate = (el) => {
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const dx = rectDiscard.left - rect.left;
            const dy = rectDiscard.top - rect.top;
            el.style.transition = 'all 0.8s ease-in';
            el.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg) scale(0.5)`;
            el.style.opacity = '0';
        };

        animate(el1);
        animate(el2);
        await this.delay(800);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    endGame() {
        this.isGameOver = true;
        if (this.shuffleInterval) clearInterval(this.shuffleInterval);
        this.updateActivePlayerUI();
        const playerRank = this.players[0].rank;
        let title = '';
        let message = '';

        if (playerRank === 1) {
            title = '👑 1位！';
            message = '最高です！あなたがチャンピオンです！';
        } else if (playerRank === 4) {
            title = '🤡 負け...';
            message = '残念ながらジョーカーが残ってしまいました。';
        } else {
            title = `${playerRank}位`;
            message = `お疲れ様でした！次は1位を目指しましょう。`;
        }

        document.getElementById('result-title').textContent = title;
        document.getElementById('result-message').textContent = message;
        this.resultOverlay.classList.remove('hidden');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new OldMaidGame();
});
