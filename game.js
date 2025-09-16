// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.players = {};
        this.avatars = {};
        this.myPlayerId = null;
        this.myPlayer = null;
        
        // Image cache
        this.imageCache = {};
        
        // Viewport
        this.viewportX = 0;
        this.viewportY = 0;
        this.avatarSize = 32;
        
        // WebSocket
        this.socket = null;
        
        // Movement
        this.pressedKeys = new Set();
        this.currentDirection = null;
        this.movementInterval = null;
        
        // Jump
        this.isJumping = false;
        this.jumpStartTime = 0;
        this.jumpDuration = 600; // 600ms jump duration
        this.jumpHeight = 20; // pixels to jump up
        this.jumpOffset = 0;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupKeyboardControls();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.drawWorld();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.drawWorld();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        // Prevent default arrow key behavior (page scrolling)
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
        }
        
        // Handle spacebar for jumping
        if (event.code === 'Space') {
            event.preventDefault();
            this.startJump();
            return;
        }
        
        const keyToDirection = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        const direction = keyToDirection[event.code];
        if (direction && !this.pressedKeys.has(event.code)) {
            this.pressedKeys.add(event.code);
            this.startMovement();
        }
    }
    
    handleKeyUp(event) {
        const keyToDirection = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        const direction = keyToDirection[event.code];
        if (direction && this.pressedKeys.has(event.code)) {
            this.pressedKeys.delete(event.code);
            this.updateMovement();
        }
    }
    
    startMovement() {
        if (this.movementInterval) return; // Already moving
        
        this.movementInterval = setInterval(() => {
            if (this.pressedKeys.size > 0) {
                // Get the first pressed direction (or implement priority system)
                const keyToDirection = {
                    'ArrowUp': 'up',
                    'ArrowDown': 'down',
                    'ArrowLeft': 'left',
                    'ArrowRight': 'right'
                };
                
                // Find the first pressed key
                for (const key of this.pressedKeys) {
                    const direction = keyToDirection[key];
                    if (direction) {
                        this.sendMoveCommand(direction);
                        break;
                    }
                }
            }
        }, 100); // Send move command every 100ms
    }
    
    stopMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }
    }
    
    sendMoveCommand(direction) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.socket.send(JSON.stringify(moveMessage));
        this.currentDirection = direction;
    }
    
    sendStopCommand() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.socket.send(JSON.stringify(stopMessage));
        this.currentDirection = null;
    }
    
    updateMovement() {
        if (this.pressedKeys.size === 0) {
            // No keys pressed, stop movement
            this.stopMovement();
            this.sendStopCommand();
        }
        // If keys are still pressed, the interval will continue sending move commands
    }
    
    startJump() {
        if (this.isJumping) return; // Already jumping
        
        this.isJumping = true;
        this.jumpStartTime = Date.now();
        
        // Start animation loop
        this.animateJump();
    }
    
    animateJump() {
        if (!this.isJumping) return;
        
        const elapsed = Date.now() - this.jumpStartTime;
        const progress = Math.min(elapsed / this.jumpDuration, 1);
        
        // Calculate jump height using a sine wave for smooth up and down motion
        const jumpOffset = Math.sin(progress * Math.PI) * this.jumpHeight;
        
        // Update jump offset for rendering
        this.jumpOffset = jumpOffset;
        
        if (progress < 1) {
            // Continue animation
            requestAnimationFrame(() => this.animateJump());
        } else {
            // Jump finished
            this.isJumping = false;
            this.jumpOffset = 0;
        }
        
        // Only redraw the players, not the entire scene
        this.drawPlayers();
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,  // Source rectangle (viewport)
            0, 0, this.canvas.width, this.canvas.height  // Destination rectangle (full canvas)
        );
    }
    
    connectToServer() {
        this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.socket.onopen = () => {
            console.log('Connected to game server');
            this.joinGame();
        };
        
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from game server');
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Vinita'
        };
        
        this.socket.send(JSON.stringify(joinMessage));
    }
    
    handleServerMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.myPlayer = this.players[this.myPlayerId];
                    this.updateViewport();
                    this.render();
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.render();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                // Update our player reference if it changed
                if (this.myPlayerId && message.players[this.myPlayerId]) {
                    this.myPlayer = message.players[this.myPlayerId];
                }
                this.updateViewport();
                this.render();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.render();
                break;
        }
    }
    
    updateViewport() {
        if (!this.myPlayer) return;
        
        // Center viewport on player
        const centerX = this.myPlayer.x - this.canvas.width / 2;
        const centerY = this.myPlayer.y - this.canvas.height / 2;
        
        // Clamp to world boundaries
        this.viewportX = Math.max(0, Math.min(centerX, this.worldWidth - this.canvas.width));
        this.viewportY = Math.max(0, Math.min(centerY, this.worldHeight - this.canvas.height));
    }
    
    worldToCanvas(worldX, worldY) {
        return {
            x: worldX - this.viewportX,
            y: worldY - this.viewportY
        };
    }
    
    render() {
        this.drawWorld();
        this.drawPlayers();
    }
    
    drawPlayers() {
        // Clear only the area where players are drawn (not the entire canvas)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw the world first
        this.drawWorld();
        
        // Then draw all players
        Object.values(this.players).forEach(player => {
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        const canvasPos = this.worldToCanvas(player.x, player.y);
        
        // Check if player is visible in viewport
        if (canvasPos.x < -this.avatarSize || canvasPos.x > this.canvas.width + this.avatarSize ||
            canvasPos.y < -this.avatarSize || canvasPos.y > this.canvas.height + this.avatarSize) {
            return;
        }
        
        // Get avatar data
        const avatar = this.avatars[player.avatar];
        if (!avatar) return;
        
        // Get current frame based on direction and animation
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        const frames = avatar.frames[direction];
        
        if (!frames || !frames[frameIndex]) return;
        
        // Create cache key for this specific frame
        const cacheKey = `${player.avatar}_${direction}_${frameIndex}`;
        
        // Check if image is already cached
        if (this.imageCache[cacheKey]) {
            this.drawPlayerWithImage(player, canvasPos, this.imageCache[cacheKey]);
        } else {
            // Load and cache the image
            const img = new Image();
            img.onload = () => {
                this.imageCache[cacheKey] = img;
                this.drawPlayerWithImage(player, canvasPos, img);
            };
            img.src = frames[frameIndex];
        }
    }
    
    drawPlayerWithImage(player, canvasPos, img) {
        // Calculate position (center avatar on player position)
        let x = canvasPos.x - this.avatarSize / 2;
        let y = canvasPos.y - this.avatarSize / 2;
        
        // Apply jump offset if this is our player and they're jumping
        if (player.id === this.myPlayerId && this.isJumping) {
            y -= this.jumpOffset;
        }
        
        // Draw avatar
        this.ctx.drawImage(img, x, y, this.avatarSize, this.avatarSize);
        
        // Draw username label
        this.drawPlayerLabel(player.username, x, y);
    }
    
    drawPlayerLabel(username, x, y) {
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const labelY = y - 5;
        
        // Draw text outline
        this.ctx.strokeText(username, x + this.avatarSize / 2, labelY);
        // Draw text fill
        this.ctx.fillText(username, x + this.avatarSize / 2, labelY);
    }
    
    destroy() {
        this.stopMovement();
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
