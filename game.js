// Game constants
const GAME_WIDTH = 1200;  // Base width
const GAME_HEIGHT = 900;  // Base height
const GRID_SIZE = 10;
const FPS = 15;

// Map configuration
const VOID_START_Y = 350;
const VOID_END_Y = 550;
const RAMP_WIDTH = 120;
const RAMP1_X = 300;
const RAMP2_X = 800;

// Particle configuration
const PARTICLE_COUNT = 20;
const PARTICLE_LIFETIME = 30; // frames
const PARTICLE_SPEED = 3;

// Scaling factors
let scaleX = 1;
let scaleY = 1;
let actualWidth = GAME_WIDTH;
let actualHeight = GAME_HEIGHT;

// Direction constants
const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

// Game elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuElement = document.getElementById('menu');
const gameOverElement = document.getElementById('game-over');
const winnerTextElement = document.getElementById('winner-text');
const startButton = document.getElementById('start-game');
const restartButton = document.getElementById('restart-game');

// Set canvas dimensions
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Game state
let gameRunning = false;
let gameLoop;
let trails = [];
let players = [];
let particles = [];
let gameMode = '2player'; // '2player' or 'singleplayer'
let aiType = 'balanced'; // 'balanced', 'aggressive', or 'cautious'
let winsNeeded = 3;
let playerWins = {};
let roundActive = false;
let countdownInterval;

// Particle class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.lifetime = PARTICLE_LIFETIME;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * PARTICLE_SPEED;
        this.size = Math.random() * 3 + 2;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.lifetime--;
        this.size *= 0.95;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.lifetime / PARTICLE_LIFETIME;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Player class
class Player {
    constructor(x, y, color, name, controls) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.name = name;
        this.direction = DIRECTIONS.RIGHT;
        this.nextDirection = DIRECTIONS.RIGHT;
        this.alive = true;
        this.controls = controls;
        
        // Sprint properties
        this.sprintAvailable = true;
        this.sprinting = false;
        this.sprintCooldown = 0;
        this.sprintDuration = 0;
        this.blinkTimer = 0;
        this.showBlink = false;
        
        // Sprint constants
        this.SPRINT_DURATION = 1.5 * FPS; // 1.5 seconds in frames
        this.SPRINT_COOLDOWN = 5 * FPS;   // 5 seconds in frames
        this.SPRINT_SPEED = 2;            // Speed multiplier during sprint
    }

    update() {
        if (!this.alive) return;

        // Update direction
        this.direction = this.nextDirection;

        // Add current position to trail
        trails.push({
            x: this.x,
            y: this.y,
            color: this.color
        });

        // Update sprint status
        this.updateSprintStatus();

        // Move player (with sprint boost if active)
        const speedMultiplier = this.sprinting ? this.SPRINT_SPEED : 1;
        this.x += this.direction.x * GRID_SIZE * speedMultiplier;
        this.y += this.direction.y * GRID_SIZE * speedMultiplier;

        // Check for collisions
        this.checkCollision();
    }
    
    updateSprintStatus() {
        // Update sprint cooldown
        if (!this.sprintAvailable && this.sprintCooldown > 0) {
            this.sprintCooldown--;
            
            // Make the indicator blink when sprint is almost ready
            if (this.sprintCooldown < FPS) {
                this.blinkTimer = (this.blinkTimer + 1) % 5;
                this.showBlink = this.blinkTimer < 3;
            }
            
            // Sprint becomes available again
            if (this.sprintCooldown <= 0) {
                this.sprintAvailable = true;
                this.showBlink = true;
            }
        }
        
        // Update sprint duration
        if (this.sprinting) {
            this.sprintDuration--;
            
            // Sprint ends
            if (this.sprintDuration <= 0) {
                this.sprinting = false;
                this.sprintAvailable = false;
                this.sprintCooldown = this.SPRINT_COOLDOWN;
                this.showBlink = false;
            }
        }
    }
    
    activateSprint() {
        if (this.sprintAvailable && !this.sprinting) {
            this.sprinting = true;
            this.sprintDuration = this.SPRINT_DURATION;
        }
    }

    checkCollision() {
        // Check wall collision
        if (this.x < 0 || this.x >= GAME_WIDTH || this.y < 0 || this.y >= GAME_HEIGHT) {
            this.die();
            return;
        }

        // Check void area collision
        if (this.y >= VOID_START_Y && this.y <= VOID_END_Y) {
            // Check if not on one of the ramps
            const onRamp1 = (this.x >= RAMP1_X && this.x <= RAMP1_X + RAMP_WIDTH);
            const onRamp2 = (this.x >= RAMP2_X && this.x <= RAMP2_X + RAMP_WIDTH);
            
            if (!onRamp1 && !onRamp2) {
                this.die();
                return;
            }
        }

        // Check trail collision
        for (let i = 0; i < trails.length; i++) {
            const trail = trails[i];
            if (this.x === trail.x && this.y === trail.y) {
                this.die();
                return;
            }
        }
    }

    die() {
        if (this.alive) {
            this.alive = false;
            // Create explosion particles
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(new Particle(this.x, this.y, this.color));
            }
        }
    }

    draw() {
        if (!this.alive) return;

        // Draw neon bike - no need to apply scaling here as it's already applied in update()
        ctx.save();
        
        // Glow effect - enhanced during sprint
        ctx.shadowBlur = this.sprinting ? 30 : 20;
        ctx.shadowColor = this.color;
        
        ctx.fillStyle = this.color;
        
        // Determine bike orientation based on direction
        if (this.direction === DIRECTIONS.UP || this.direction === DIRECTIONS.DOWN) {
            // Vertical bike
            ctx.fillRect(this.x, this.y - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE * 2);
            
            // Bike details
            ctx.fillRect(this.x - GRID_SIZE / 2, this.y, GRID_SIZE * 2, GRID_SIZE / 3);
            
            // Draw sprint indicator
            if (this.sprintAvailable && this.showBlink) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(this.x - GRID_SIZE / 2, this.y - GRID_SIZE, GRID_SIZE * 2, GRID_SIZE / 4);
            } else if (this.sprinting) {
                // Draw sprint effect
                ctx.fillStyle = '#fff';
                ctx.fillRect(this.x - GRID_SIZE / 2, this.y + GRID_SIZE, GRID_SIZE * 2, GRID_SIZE / 4);
            }
        } else {
            // Horizontal bike
            ctx.fillRect(this.x - GRID_SIZE / 2, this.y, GRID_SIZE * 2, GRID_SIZE);
            
            // Bike details
            ctx.fillRect(this.x, this.y - GRID_SIZE / 2, GRID_SIZE / 3, GRID_SIZE * 2);
            
            // Draw sprint indicator
            if (this.sprintAvailable && this.showBlink) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(this.x - GRID_SIZE, this.y - GRID_SIZE / 2, GRID_SIZE / 4, GRID_SIZE * 2);
            } else if (this.sprinting) {
                // Draw sprint effect
                ctx.fillStyle = '#fff';
                ctx.fillRect(this.x + GRID_SIZE, this.y - GRID_SIZE / 2, GRID_SIZE / 4, GRID_SIZE * 2);
            }
        }
        
        ctx.restore();
    }

    changeDirection(newDirection) {
        // Prevent 180-degree turns
        if (
            (this.direction === DIRECTIONS.UP && newDirection === DIRECTIONS.DOWN) ||
            (this.direction === DIRECTIONS.DOWN && newDirection === DIRECTIONS.UP) ||
            (this.direction === DIRECTIONS.LEFT && newDirection === DIRECTIONS.RIGHT) ||
            (this.direction === DIRECTIONS.RIGHT && newDirection === DIRECTIONS.LEFT)
        ) {
            return;
        }

        this.nextDirection = newDirection;
    }
}

// Initialize game
function initGame(mode) {
    // Set game mode
    gameMode = mode || gameMode;
    
    // Reset game state
    trails = [];
    particles = [];
    gameRunning = true;
    roundActive = false;
    
    // Get wins needed from the appropriate selector
    winsNeeded = parseInt(document.getElementById(gameMode === '2player' ? 'two-player-win-count' : 'ai-win-count').value);
    
    // Initialize player wins only if it's the first game
    if (Object.keys(playerWins).length === 0) {
        playerWins = {};
    }
    
    // Make sure the canvas size is correct
    resizeGame();
    
    // Create players based on game mode
    if (gameMode === '2player') {
        players = [
            new Player(GRID_SIZE * 30, GRID_SIZE * 20, '#0ff', 'Player 1', {
                up: 'ArrowUp',
                down: 'ArrowDown',
                left: 'ArrowLeft',
                right: 'ArrowRight',
                sprint: ' '
            }),
            new Player(GRID_SIZE * 30, GRID_SIZE * 70, '#f0f', 'Player 2', {
                up: 'w',
                down: 's',
                left: 'a',
                right: 'd',
                sprint: 'Shift'
            })
        ];
    } else {
        // Single player mode with 3 AI opponents
        players = [
            new Player(GRID_SIZE * 30, GRID_SIZE * 20, '#0ff', 'Player 1', {
                up: 'ArrowUp',
                down: 'ArrowDown',
                left: 'ArrowLeft',
                right: 'ArrowRight',
                sprint: ' '
            }),
            new Player(GRID_SIZE * 90, GRID_SIZE * 70, '#f0f', 'AI 1', null),
            new Player(GRID_SIZE * 30, GRID_SIZE * 70, '#f00', 'AI 2', null),
            new Player(GRID_SIZE * 90, GRID_SIZE * 20, '#0f0', 'AI 3', null)
        ];
    }
    
    // Initialize wins for new players
    players.forEach(player => {
        if (!playerWins[player.color]) {
            playerWins[player.color] = 0;
        }
    });
    
    // Show appropriate score display
    updateScoreDisplay();
    
    // Clear any existing game loop
    if (gameLoop) {
        clearInterval(gameLoop);
    }
    
    // Hide menu and show game
    menuElement.style.display = 'none';
    gameOverElement.style.display = 'none';
    
    // Start countdown
    startCountdown();
}

function startCountdown() {
    let count = 3;
    const countdownElement = document.getElementById('countdown');
    const countdownText = document.getElementById('countdown-text');
    
    countdownElement.style.display = 'block';
    countdownText.textContent = count;
    
    // Draw initial game state
    draw();
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.textContent = count;
            // Redraw to update countdown number
            draw();
        } else {
            countdownText.textContent = 'GO!';
            setTimeout(() => {
                countdownElement.style.display = 'none';
                roundActive = true;
                // Start the game loop after countdown
                gameLoop = setInterval(() => {
                    update();
                    draw();
                }, 1000 / FPS);
            }, 500);
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function updateScoreDisplay() {
    const scoreDisplay2P = document.getElementById('score-display-2player');
    const scoreDisplayAI = document.getElementById('score-display-ai');
    
    // Hide both score displays first
    scoreDisplay2P.style.display = 'none';
    scoreDisplayAI.style.display = 'none';
    
    // Show the appropriate score display based on game mode
    if (gameMode === '2player') {
        scoreDisplay2P.style.display = 'block';
        // Update scores for 2-player mode
        players.forEach((player, index) => {
            const scoreElement = document.querySelector(`#score-display-2player .score-item:nth-child(${index + 1}) .score-value`);
            if (scoreElement) {
                scoreElement.textContent = playerWins[player.color];
            }
        });
    } else {
        scoreDisplayAI.style.display = 'block';
        // Update scores for AI mode
        players.forEach((player, index) => {
            const scoreElement = document.querySelector(`#score-display-ai .score-item:nth-child(${index + 1}) .score-value`);
            if (scoreElement) {
                scoreElement.textContent = playerWins[player.color];
            }
        });
    }
}

function checkGameOver() {
    if (!roundActive) return;
    
    const alivePlayers = players.filter(player => player.alive);
    
    if (alivePlayers.length <= 1) {
        roundActive = false;
        
        if (alivePlayers.length === 1) {
            const winner = alivePlayers[0];
            playerWins[winner.color]++;
            updateScoreDisplay();
            
            // Check if game is completely over
            if (playerWins[winner.color] >= winsNeeded) {
                gameRunning = false;
                clearInterval(gameLoop);
                gameOverElement.style.display = 'flex';
                winnerTextElement.textContent = `${winner.name} Wins the Match!`;
            } else {
                // Start new round after a delay
                setTimeout(() => {
                    initGame(gameMode);
                }, 2000);
            }
        } else {
            // Draw - no one wins
            setTimeout(() => {
                initGame(gameMode);
            }, 2000);
        }
    }
}

// Update game state
function update() {
    if (!gameRunning || !roundActive) return;

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].lifetime <= 0) {
            particles.splice(i, 1);
        }
    }

    // Update players
    for (let player of players) {
        player.update();
    }

    // Update AI if in single player mode
    if (gameMode === 'singleplayer') {
        for (let i = 1; i < players.length; i++) {
            updateAI(i);
        }
    }

    // Check for game over
    checkGameOver();
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply scaling
    applyScaling(ctx);

    // Draw game elements
    drawGrid();
    drawTrails();
    
    // Draw particles
    for (let particle of particles) {
        particle.draw();
    }

    // Draw players
    for (let player of players) {
        player.draw();
    }

    // Restore scaling
    restoreScaling(ctx);
}

// Draw grid background
function drawGrid() {
    ctx.strokeStyle = '#0a1a2a';
    ctx.lineWidth = 1;
    
    // Draw void area
    ctx.fillStyle = 'rgba(0, 0, 40, 0.7)';
    ctx.fillRect(0, VOID_START_Y, GAME_WIDTH, VOID_END_Y - VOID_START_Y);
    
    // Draw ramps
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.fillRect(RAMP1_X, VOID_START_Y, RAMP_WIDTH, VOID_END_Y - VOID_START_Y);
    ctx.fillRect(RAMP2_X, VOID_START_Y, RAMP_WIDTH, VOID_END_Y - VOID_START_Y);
    
    // Add ramp edges for better visibility
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    
    // Ramp 1 edges
    ctx.beginPath();
    ctx.moveTo(RAMP1_X, VOID_START_Y);
    ctx.lineTo(RAMP1_X, VOID_END_Y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(RAMP1_X + RAMP_WIDTH, VOID_START_Y);
    ctx.lineTo(RAMP1_X + RAMP_WIDTH, VOID_END_Y);
    ctx.stroke();
    
    // Ramp 2 edges
    ctx.beginPath();
    ctx.moveTo(RAMP2_X, VOID_START_Y);
    ctx.lineTo(RAMP2_X, VOID_END_Y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(RAMP2_X + RAMP_WIDTH, VOID_START_Y);
    ctx.lineTo(RAMP2_X + RAMP_WIDTH, VOID_END_Y);
    ctx.stroke();
    
    // Draw horizontal lines for void edges
    ctx.beginPath();
    ctx.moveTo(0, VOID_START_Y);
    ctx.lineTo(GAME_WIDTH, VOID_START_Y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, VOID_END_Y);
    ctx.lineTo(GAME_WIDTH, VOID_END_Y);
    ctx.stroke();
    
    // Draw regular grid
    ctx.strokeStyle = '#0a1a2a';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= GAME_WIDTH; x += GRID_SIZE * 2) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_HEIGHT);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= GAME_HEIGHT; y += GRID_SIZE * 2) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_WIDTH, y);
        ctx.stroke();
    }
}

// Draw trails with glow effect
function drawTrails() {
    trails.forEach(trail => {
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = trail.color;
        
        ctx.fillStyle = trail.color;
        ctx.fillRect(trail.x, trail.y, GRID_SIZE, GRID_SIZE);
        
        // Reset shadow
        ctx.shadowBlur = 0;
    });
}

// AI logic for single player mode
function updateAI(aiIndex) {
    const ai = players[aiIndex];
    const player = players[0]; // Human player is always at index 0
    
    // Current position and direction
    const currentX = ai.x;
    const currentY = ai.y;
    const currentDir = ai.direction;
    
    // Possible directions the AI can move (excluding 180-degree turns)
    const possibleDirections = [];
    const directionScores = {};
    
    // Check each possible direction
    if (currentDir !== DIRECTIONS.DOWN && !willCollide(currentX, currentY - GRID_SIZE)) {
        possibleDirections.push(DIRECTIONS.UP);
        directionScores["UP"] = 0;
    }
    if (currentDir !== DIRECTIONS.UP && !willCollide(currentX, currentY + GRID_SIZE)) {
        possibleDirections.push(DIRECTIONS.DOWN);
        directionScores["DOWN"] = 0;
    }
    if (currentDir !== DIRECTIONS.RIGHT && !willCollide(currentX - GRID_SIZE, currentY)) {
        possibleDirections.push(DIRECTIONS.LEFT);
        directionScores["LEFT"] = 0;
    }
    if (currentDir !== DIRECTIONS.LEFT && !willCollide(currentX + GRID_SIZE, currentY)) {
        possibleDirections.push(DIRECTIONS.RIGHT);
        directionScores["RIGHT"] = 0;
    }
    
    // If there are possible moves, choose the best one based on AI index
    if (possibleDirections.length > 0) {
        // Assign different AI behaviors based on player index
        // Player 1 (index 0) is human
        // Player 2 (index 1) uses the selected AI type from UI
        // Player 3 (index 2) is always aggressive
        // Player 4 (index 3) is always cautious
        if (aiIndex === 1) {
            // Player 2 uses the selected AI type from UI
            switch(aiType) {
                case 'aggressive':
                    updateAggressiveAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores);
                    break;
                case 'cautious':
                    updateCautiousAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores);
                    break;
                case 'balanced':
                default:
                    updateBalancedAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores);
                    break;
            }
        } else if (aiIndex === 2) {
            // Player 3 (Red) is always aggressive
            updateAggressiveAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores);
        } else if (aiIndex === 3) {
            // Player 4 (Green) is always cautious
            updateCautiousAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores);
        }
    }
    // If no possible moves, AI will continue in current direction and likely crash
    
    // Handle AI sprint decisions based on their personality
    if (ai.sprintAvailable && !ai.sprinting) {
        if (aiIndex === 1) {
            // Player 2 uses the selected AI type from UI for sprint decisions
            switch(aiType) {
                case 'aggressive':
                    decideAggressiveSprint(ai, player);
                    break;
                case 'cautious':
                    decideCautiousSprint(ai, player);
                    break;
                case 'balanced':
                default:
                    decideBalancedSprint(ai, player);
                    break;
            }
        } else if (aiIndex === 2) {
            // Player 3 (Red) is always aggressive with sprint
            decideAggressiveSprint(ai, player);
        } else if (aiIndex === 3) {
            // Player 4 (Green) is always cautious with sprint
            decideCautiousSprint(ai, player);
        }
    }
}

// Sprint decision logic for aggressive AI
function decideAggressiveSprint(ai, player) {
    // Calculate distance to player
    const distToPlayer = Math.sqrt(
        Math.pow(player.x - ai.x, 2) + 
        Math.pow(player.y - ai.y, 2)
    );
    
    // Aggressive AI uses sprint to intercept the player
    // or when it sees an opportunity to cut the player off
    if (distToPlayer < 15 * GRID_SIZE) {
        // Check if AI is moving toward player
        const movingTowardPlayer = 
            (ai.direction === DIRECTIONS.RIGHT && player.x > ai.x) ||
            (ai.direction === DIRECTIONS.LEFT && player.x < ai.x) ||
            (ai.direction === DIRECTIONS.DOWN && player.y > ai.y) ||
            (ai.direction === DIRECTIONS.UP && player.y < ai.y);
            
        if (movingTowardPlayer) {
            // 80% chance to sprint when moving toward player
            if (Math.random() < 0.8) {
                ai.activateSprint();
            }
        }
    }
}

// Sprint decision logic for cautious AI
function decideCautiousSprint(ai, player) {
    // Calculate distance to player
    const distToPlayer = Math.sqrt(
        Math.pow(player.x - ai.x, 2) + 
        Math.pow(player.y - ai.y, 2)
    );
    
    // Cautious AI uses sprint to escape when player is close
    // or when it's about to hit a wall and needs to make a quick turn
    if (distToPlayer < 10 * GRID_SIZE) {
        // Check if AI is moving away from player
        const movingAwayFromPlayer = 
            (ai.direction === DIRECTIONS.RIGHT && player.x < ai.x) ||
            (ai.direction === DIRECTIONS.LEFT && player.x > ai.x) ||
            (ai.direction === DIRECTIONS.DOWN && player.y < ai.y) ||
            (ai.direction === DIRECTIONS.UP && player.y > ai.y);
            
        if (movingAwayFromPlayer) {
            // 70% chance to sprint when escaping player
            if (Math.random() < 0.7) {
                ai.activateSprint();
            }
        }
    }
    
    // Check if approaching a wall
    const distToWallX = (ai.direction.x > 0) ? (GAME_WIDTH - ai.x) : (ai.direction.x < 0 ? ai.x : Infinity);
    const distToWallY = (ai.direction.y > 0) ? (GAME_HEIGHT - ai.y) : (ai.direction.y < 0 ? ai.y : Infinity);
    const wallDistance = Math.min(distToWallX, distToWallY);
    
    // If approaching a wall but not too close, sprint to get away
    if (wallDistance < 8 * GRID_SIZE && wallDistance > 3 * GRID_SIZE) {
        // 50% chance to sprint when approaching a wall
        if (Math.random() < 0.5) {
            ai.activateSprint();
        }
    }
}

// Sprint decision logic for balanced AI
function decideBalancedSprint(ai, player) {
    // Calculate distance to player
    const distToPlayer = Math.sqrt(
        Math.pow(player.x - ai.x, 2) + 
        Math.pow(player.y - ai.y, 2)
    );
    
    // Balanced AI uses sprint in various situations
    // 1. Sometimes to escape (like cautious)
    // 2. Sometimes to intercept (like aggressive)
    // 3. Sometimes randomly to be unpredictable
    
    // Situation 1: Player is close and AI is in danger
    if (distToPlayer < 12 * GRID_SIZE) {
        // 40% chance to sprint when player is close
        if (Math.random() < 0.4) {
            ai.activateSprint();
            return;
        }
    }
    
    // Situation 2: AI sees a good opportunity to cut off player
    // Check if AI and player are moving perpendicular to each other
    const perpendicularMovement = 
        (Math.abs(ai.direction.x) === 1 && Math.abs(player.direction.x) === 0) ||
        (Math.abs(ai.direction.y) === 1 && Math.abs(player.direction.y) === 0);
        
    if (perpendicularMovement && distToPlayer < 20 * GRID_SIZE) {
        // 30% chance to sprint when there's an interception opportunity
        if (Math.random() < 0.3) {
            ai.activateSprint();
            return;
        }
    }
    
    // Situation 3: Random sprint for unpredictability
    // 5% chance to sprint randomly
    if (Math.random() < 0.05) {
        ai.activateSprint();
    }
}

// Balanced AI - mix of survival and occasional aggression
function updateBalancedAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores) {
    possibleDirections.forEach(direction => {
        let dirKey = getDirectionKey(direction);
        let newX = currentX + direction.x * GRID_SIZE;
        let newY = currentY + direction.y * GRID_SIZE;
        
        // Prioritize continuing in the same direction
        if (direction === currentDir) {
            directionScores[dirKey] += 2;
        }
        
        // Look ahead 3 steps to check for dead ends
        let openSpace = countOpenSpaces(newX, newY, direction, 3);
        directionScores[dirKey] += openSpace;
        
        // Avoid moving toward walls
        const distToWallX = (direction.x > 0) ? (GAME_WIDTH - newX) : (direction.x < 0 ? newX : Infinity);
        const distToWallY = (direction.y > 0) ? (GAME_HEIGHT - newY) : (direction.y < 0 ? newY : Infinity);
        if (Math.min(distToWallX, distToWallY) < 5 * GRID_SIZE) {
            directionScores[dirKey] -= 3;
        }
        
        // Consider player position - try to move toward player sometimes
        // This makes the AI more aggressive but not too predictable
        if (Math.random() < 0.3) { // 30% chance to consider player position
            const playerDirX = player.x - currentX;
            const playerDirY = player.y - currentY;
            
            if ((playerDirX > 0 && direction === DIRECTIONS.RIGHT) ||
                (playerDirX < 0 && direction === DIRECTIONS.LEFT) ||
                (playerDirY > 0 && direction === DIRECTIONS.DOWN) ||
                (playerDirY < 0 && direction === DIRECTIONS.UP)) {
                directionScores[dirKey] += 1;
            }
        }
    });
    
    // Choose the direction with the highest score
    chooseDirectionWithHighestScore(ai, currentDir, possibleDirections, directionScores);
}

// Aggressive AI - actively tries to cut off the player
function updateAggressiveAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores) {
    // Predict player's future position (2 steps ahead)
    const predictedPlayerX = player.x + player.direction.x * GRID_SIZE * 2;
    const predictedPlayerY = player.y + player.direction.y * GRID_SIZE * 2;
    
    possibleDirections.forEach(direction => {
        let dirKey = getDirectionKey(direction);
        let newX = currentX + direction.x * GRID_SIZE;
        let newY = currentY + direction.y * GRID_SIZE;
        
        // Basic survival check - avoid immediate collisions
        let openSpace = countOpenSpaces(newX, newY, direction, 2);
        directionScores[dirKey] += openSpace * 0.5; // Lower weight on open space
        
        // Strongly prioritize intercepting the player's path
        const interceptScore = calculateInterceptScore(newX, newY, direction, predictedPlayerX, predictedPlayerY, player.direction);
        directionScores[dirKey] += interceptScore * 3; // Higher weight on interception
        
        // Move toward player's current position with high probability
        const playerDirX = player.x - currentX;
        const playerDirY = player.y - currentY;
        
        if ((playerDirX > 0 && direction === DIRECTIONS.RIGHT) ||
            (playerDirX < 0 && direction === DIRECTIONS.LEFT) ||
            (playerDirY > 0 && direction === DIRECTIONS.DOWN) ||
            (playerDirY < 0 && direction === DIRECTIONS.UP)) {
            directionScores[dirKey] += 4;
        }
        
        // Slightly favor continuing in the same direction for momentum
        if (direction === currentDir) {
            directionScores[dirKey] += 1;
        }
    });
    
    // Choose the direction with the highest score
    chooseDirectionWithHighestScore(ai, currentDir, possibleDirections, directionScores);
}

// Cautious AI - prioritizes survival and open space
function updateCautiousAI(ai, player, currentX, currentY, currentDir, possibleDirections, directionScores) {
    possibleDirections.forEach(direction => {
        let dirKey = getDirectionKey(direction);
        let newX = currentX + direction.x * GRID_SIZE;
        let newY = currentY + direction.y * GRID_SIZE;
        
        // Strongly prioritize open spaces - look further ahead
        let openSpace = countOpenSpaces(newX, newY, direction, 5); // Look 5 steps ahead
        directionScores[dirKey] += openSpace * 3; // Higher weight on open space
        
        // Heavily avoid walls
        const distToWallX = (direction.x > 0) ? (GAME_WIDTH - newX) : (direction.x < 0 ? newX : Infinity);
        const distToWallY = (direction.y > 0) ? (GAME_HEIGHT - newY) : (direction.y < 0 ? newY : Infinity);
        const wallDistance = Math.min(distToWallX, distToWallY);
        
        if (wallDistance < 8 * GRID_SIZE) {
            directionScores[dirKey] -= (8 * GRID_SIZE - wallDistance) / GRID_SIZE;
        }
        
        // Avoid moving toward player
        const playerDirX = player.x - currentX;
        const playerDirY = player.y - currentY;
        
        if ((playerDirX > 0 && direction === DIRECTIONS.RIGHT) ||
            (playerDirX < 0 && direction === DIRECTIONS.LEFT) ||
            (playerDirY > 0 && direction === DIRECTIONS.DOWN) ||
            (playerDirY < 0 && direction === DIRECTIONS.UP)) {
            // Only avoid if player is close
            const distToPlayer = Math.sqrt(playerDirX * playerDirX + playerDirY * playerDirY);
            if (distToPlayer < 10 * GRID_SIZE) {
                directionScores[dirKey] -= 3;
            }
        }
        
        // Favor continuing in the same direction for predictability
        if (direction === currentDir) {
            directionScores[dirKey] += 2;
        }
    });
    
    // Choose the direction with the highest score
    chooseDirectionWithHighestScore(ai, currentDir, possibleDirections, directionScores);
}

// Helper function to calculate how well a move intercepts the player's path
function calculateInterceptScore(aiX, aiY, aiDirection, playerX, playerY, playerDirection) {
    // Calculate future positions for AI (3 steps ahead)
    const futureAiX = aiX + aiDirection.x * GRID_SIZE * 3;
    const futureAiY = aiY + aiDirection.y * GRID_SIZE * 3;
    
    // Calculate future positions for player (3 steps ahead)
    const futurePlayerX = playerX + playerDirection.x * GRID_SIZE * 3;
    const futurePlayerY = playerY + playerDirection.y * GRID_SIZE * 3;
    
    // Calculate distance between future positions
    const futureDistance = Math.sqrt(
        Math.pow(futureAiX - futurePlayerX, 2) + 
        Math.pow(futureAiY - futurePlayerY, 2)
    );
    
    // Check if AI path crosses player path
    const aiPath = {
        startX: aiX,
        startY: aiY,
        endX: futureAiX,
        endY: futureAiY
    };
    
    const playerPath = {
        startX: playerX,
        startY: playerY,
        endX: futurePlayerX,
        endY: futurePlayerY
    };
    
    // Simple path intersection check
    if (doPathsIntersect(aiPath, playerPath)) {
        return 5; // High score for intercepting paths
    }
    
    // Otherwise, score based on proximity (closer is better for interception)
    return 10 / (futureDistance / GRID_SIZE + 1);
}

// Simple path intersection check
function doPathsIntersect(path1, path2) {
    // For simplicity, we'll just check if the paths are perpendicular and cross
    const isPath1Horizontal = path1.startY === path1.endY;
    const isPath2Horizontal = path2.startY === path2.endY;
    
    // If both paths have the same orientation, they don't intersect in our grid-based game
    if (isPath1Horizontal === isPath2Horizontal) {
        return false;
    }
    
    // Check if the horizontal path crosses the vertical path
    if (isPath1Horizontal) {
        const minX1 = Math.min(path1.startX, path1.endX);
        const maxX1 = Math.max(path1.startX, path1.endX);
        const minY2 = Math.min(path2.startY, path2.endY);
        const maxY2 = Math.max(path2.startY, path2.endY);
        
        return (path2.startX >= minX1 && path2.startX <= maxX1 && 
                path1.startY >= minY2 && path1.startY <= maxY2);
    } else {
        const minY1 = Math.min(path1.startY, path1.endY);
        const maxY1 = Math.max(path1.startY, path1.endY);
        const minX2 = Math.min(path2.startX, path2.endX);
        const maxX2 = Math.max(path2.startX, path2.endX);
        
        return (path1.startX >= minX2 && path1.startX <= maxX2 && 
                path2.startY >= minY1 && path2.startY <= maxY1);
    }
}

// Helper function to choose the direction with the highest score
function chooseDirectionWithHighestScore(ai, currentDir, possibleDirections, directionScores) {
    let bestDirection = currentDir;
    let bestScore = -Infinity;
    
    possibleDirections.forEach(direction => {
        const dirKey = getDirectionKey(direction);
        if (directionScores[dirKey] > bestScore) {
            bestScore = directionScores[dirKey];
            bestDirection = direction;
        }
    });
    
    ai.changeDirection(bestDirection);
}

// Helper function to get a string key for a direction
function getDirectionKey(direction) {
    if (direction === DIRECTIONS.UP) return "UP";
    if (direction === DIRECTIONS.DOWN) return "DOWN";
    if (direction === DIRECTIONS.LEFT) return "LEFT";
    if (direction === DIRECTIONS.RIGHT) return "RIGHT";
    return "UNKNOWN";
}

// Helper function to count open spaces in a direction (non-recursive to avoid stack overflow)
function countOpenSpaces(startX, startY, direction, maxDepth) {
    let count = 0;
    let x = startX;
    let y = startY;
    
    // Check forward path
    for (let i = 0; i < maxDepth; i++) {
        if (willCollide(x, y)) {
            break;
        }
        count++;
        x += direction.x * GRID_SIZE;
        y += direction.y * GRID_SIZE;
    }
    
    // Check left path
    const leftDir = { x: direction.y, y: -direction.x }; // 90 degrees left
    x = startX + leftDir.x * GRID_SIZE;
    y = startY + leftDir.y * GRID_SIZE;
    if (!willCollide(x, y)) {
        count++;
    }
    
    // Check right path
    const rightDir = { x: -direction.y, y: direction.x }; // 90 degrees right
    x = startX + rightDir.x * GRID_SIZE;
    y = startY + rightDir.y * GRID_SIZE;
    if (!willCollide(x, y)) {
        count++;
    }
    
    return count;
}

// Helper function to check if moving to a position would cause a collision
function willCollide(x, y) {
    // Check wall collision
    if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) {
        return true;
    }
    
    // Check void area collision
    if (y >= VOID_START_Y && y <= VOID_END_Y) {
        // Check if not on one of the ramps
        const onRamp1 = (x >= RAMP1_X && x <= RAMP1_X + RAMP_WIDTH);
        const onRamp2 = (x >= RAMP2_X && x <= RAMP2_X + RAMP_WIDTH);
        
        if (!onRamp1 && !onRamp2) {
            return true;
        }
    }
    
    // Check trail collision
    for (let i = 0; i < trails.length; i++) {
        const trail = trails[i];
        if (x === trail.x && y === trail.y) {
            return true;
        }
    }
    
    return false;
}

// Event listeners
document.getElementById('two-player-mode').addEventListener('click', () => {
    document.getElementById('game-modes').style.display = 'none';
    document.getElementById('two-player-options').style.display = 'block';
});

document.getElementById('single-player-mode').addEventListener('click', () => {
    document.getElementById('game-modes').style.display = 'none';
    document.getElementById('ai-options').style.display = 'block';
});

document.getElementById('start-with-ai').addEventListener('click', () => {
    menuElement.style.display = 'none';
    document.getElementById('ai-options').style.display = 'none';
    aiType = document.querySelector('input[name="ai-type"]:checked').value;
    initGame('singleplayer');
});

document.getElementById('start-two-player').addEventListener('click', () => {
    menuElement.style.display = 'none';
    document.getElementById('two-player-options').style.display = 'none';
    initGame('2player');
});

document.getElementById('restart-game').addEventListener('click', () => {
    gameOverElement.style.display = 'none';
    initGame(gameMode);
});

document.getElementById('back-to-main').addEventListener('click', () => {
    gameOverElement.style.display = 'none';
    menuElement.style.display = 'block';
    document.getElementById('game-modes').style.display = 'flex';
    document.getElementById('ai-options').style.display = 'none';
    document.getElementById('two-player-options').style.display = 'none';
    document.getElementById('score-display-2player').style.display = 'none';
    document.getElementById('score-display-ai').style.display = 'none';
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;

    // Handle sprint for all players
    players.forEach(player => {
        if (player.controls && e.key === player.controls.sprint) {
            player.activateSprint();
        }
    });

    // Handle movement for player 1
    if (players[0].alive) {
        switch (e.key) {
            case players[0].controls.up:
                players[0].changeDirection(DIRECTIONS.UP);
                break;
            case players[0].controls.down:
                players[0].changeDirection(DIRECTIONS.DOWN);
                break;
            case players[0].controls.left:
                players[0].changeDirection(DIRECTIONS.LEFT);
                break;
            case players[0].controls.right:
                players[0].changeDirection(DIRECTIONS.RIGHT);
                break;
        }
    }

    // Handle movement for player 2 (if in 2-player mode)
    if (gameMode === '2player' && players[1].alive) {
        switch (e.key) {
            case players[1].controls.up:
                players[1].changeDirection(DIRECTIONS.UP);
                break;
            case players[1].controls.down:
                players[1].changeDirection(DIRECTIONS.DOWN);
                break;
            case players[1].controls.left:
                players[1].changeDirection(DIRECTIONS.LEFT);
                break;
            case players[1].controls.right:
                players[1].changeDirection(DIRECTIONS.RIGHT);
                break;
        }
    }
});

// Initialize the game when the window loads
window.addEventListener('load', () => {
    // Show menu
    menuElement.style.display = 'flex';
    
    // Set initial canvas size
    resizeGame();
});

// Set canvas dimensions
function resizeGame() {
    // Get the maximum available space while keeping some margin
    const maxWidth = window.innerWidth * 0.95;
    const maxHeight = window.innerHeight * 0.9;
    
    // Calculate aspect ratio of the game
    const gameRatio = GAME_WIDTH / GAME_HEIGHT;
    
    // Determine actual dimensions, maintaining aspect ratio
    if (maxWidth / maxHeight > gameRatio) {
        // Height is the limiting factor
        actualHeight = maxHeight;
        actualWidth = actualHeight * gameRatio;
    } else {
        // Width is the limiting factor
        actualWidth = maxWidth;
        actualHeight = actualWidth / gameRatio;
    }
    
    // Update canvas dimensions
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    // Update scale factors
    scaleX = actualWidth / GAME_WIDTH;
    scaleY = actualHeight / GAME_HEIGHT;
    
    // Set CSS dimensions explicitly to match canvas
    canvas.style.width = `${actualWidth}px`;
    canvas.style.height = `${actualHeight}px`;
    
    // Update container size
    const container = document.querySelector('.game-container');
    container.style.width = `${actualWidth}px`;
    container.style.height = `${actualHeight}px`;
    
    // Redraw if game is not running
    if (!gameRunning && !gameLoop) {
        draw();
    }
}

// Add window resize event listener
window.addEventListener('resize', resizeGame);

// Adjust transformation for drawing
function applyScaling(ctx) {
    ctx.save();
    ctx.scale(scaleX, scaleY);
}

function restoreScaling(ctx) {
    ctx.restore();
}

// Helper function to convert screen/pixel coordinates to game coordinates
function pixelToGameX(pixelX) {
    return pixelX / scaleX;
}

function pixelToGameY(pixelY) {
    return pixelY / scaleY;
}

// Helper function to convert game coordinates to screen/pixel coordinates
function gameToPixelX(gameX) {
    return gameX * scaleX;
}

function gameToPixelY(gameY) {
    return gameY * scaleY;
}