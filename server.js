// server.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load proto definition
const PROTO_PATH = path.join(__dirname, 'proto/mines.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const minesProto = protoDescriptor.mines;

// Game settings
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 10;
const MINE_COUNT = 15;

class MinesGame {
  constructor() {
    this.players = new Map();
    this.cells = [];
    this.gameStatus = 'active';
    this.message = 'Game in progress';
    this.minesRemaining = MINE_COUNT;
    this.initializeBoard();
  }

  initializeBoard() {
    // Initialize empty board
    this.cells = Array(BOARD_WIDTH * BOARD_HEIGHT).fill().map(() => ({
      revealed: false,
      flagged: false,
      adjacentMines: 0,
      isMine: false
    }));

    // Place mines randomly
    let minesPlaced = 0;
    while (minesPlaced < MINE_COUNT) {
      const index = Math.floor(Math.random() * this.cells.length);
      if (!this.cells[index].isMine) {
        this.cells[index].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate adjacent mines
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (!this.getCellAt(x, y).isMine) {
          let count = 0;
          // Check all 8 surrounding cells
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < BOARD_WIDTH && ny >= 0 && ny < BOARD_HEIGHT) {
                if (this.getCellAt(nx, ny).isMine) count++;
              }
            }
          }
          this.getCellAt(x, y).adjacentMines = count;
        }
      }
    }
  }

  getCellAt(x, y) {
    return this.cells[y * BOARD_WIDTH + x];
  }

  setCellAt(x, y, cellData) {
    this.cells[y * BOARD_WIDTH + x] = { ...this.getCellAt(x, y), ...cellData };
  }

  addPlayer(playerName) {
    const playerId = uuidv4();
    this.players.set(playerId, { id: playerId, name: playerName });
    return playerId;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  revealCell(playerId, x, y) {
    if (!this.players.has(playerId)) {
      return { success: false, message: 'Player not found' };
    }

    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
      return { success: false, message: 'Invalid coordinates' };
    }

    if (this.gameStatus !== 'active') {
      return { success: false, message: `Game is over. Status: ${this.gameStatus}` };
    }

    const cell = this.getCellAt(x, y);
    if (cell.revealed || cell.flagged) {
      return { success: false, message: 'Cell already revealed or flagged' };
    }

    // Handle revealing a mine
    if (cell.isMine) {
      this.setCellAt(x, y, { revealed: true });
      this.gameStatus = 'lost';
      this.message = 'Game over - mine exploded!';
      
      // Reveal all mines
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i].isMine) {
          this.cells[i].revealed = true;
        }
      }
      
      return { success: true, message: 'You hit a mine!' };
    }

    // Reveal the cell
    this.revealCellRecursive(x, y);
    
    // Check for win condition
    const allNonMinesRevealed = this.cells.every(cell => 
      cell.isMine || cell.revealed
    );
    
    if (allNonMinesRevealed) {
      this.gameStatus = 'won';
      this.message = 'Congratulations! All cells cleared!';
      
      // Flag all mines
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i].isMine) {
          this.cells[i].flagged = true;
        }
      }
      this.minesRemaining = 0;
    }
    
    return { success: true, message: 'Cell revealed' };
  }

  revealCellRecursive(x, y) {
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
      return;
    }

    const cell = this.getCellAt(x, y);
    if (cell.revealed || cell.flagged || cell.isMine) {
      return;
    }

    // Reveal this cell
    this.setCellAt(x, y, { revealed: true });

    // If cell has no adjacent mines, reveal surrounding cells recursively
    if (cell.adjacentMines === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          this.revealCellRecursive(x + dx, y + dy);
        }
      }
    }
  }

  flagCell(playerId, x, y) {
    if (!this.players.has(playerId)) {
      return { success: false, message: 'Player not found' };
    }

    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
      return { success: false, message: 'Invalid coordinates' };
    }

    if (this.gameStatus !== 'active') {
      return { success: false, message: `Game is over. Status: ${this.gameStatus}` };
    }

    const cell = this.getCellAt(x, y);
    if (cell.revealed) {
      return { success: false, message: 'Cannot flag a revealed cell' };
    }

    // Toggle flag
    const newFlaggedState = !cell.flagged;
    this.setCellAt(x, y, { flagged: newFlaggedState });
    
    // Update mines remaining count
    this.minesRemaining += newFlaggedState ? -1 : 1;
    
    return { 
      success: true, 
      message: newFlaggedState ? 'Cell flagged' : 'Flag removed' 
    };
  }

  getGameState(includeMinesToPlayers = false) {
    // Create a safe copy of cells without revealing mine locations
    // to players unless the game is over
    const safeCells = this.cells.map(cell => ({
      revealed: cell.revealed,
      flagged: cell.flagged,
      adjacentMines: cell.revealed ? cell.adjacentMines : 0,
      isMine: (this.gameStatus !== 'active' || includeMinesToPlayers) ? cell.isMine : false
    }));

    return {
      cells: safeCells,
      players: Array.from(this.players.values()),
      boardWidth: BOARD_WIDTH,
      boardHeight: BOARD_HEIGHT,
      gameStatus: this.gameStatus,
      message: this.message,
      minesRemaining: this.minesRemaining
    };
  }
}

// Server implementation
const game = new MinesGame();
const playerStreams = new Map();

function broadcastGameState() {
  const gameState = game.getGameState();
  for (const stream of playerStreams.values()) {
    stream.write(gameState);
  }
}

const server = new grpc.Server();
server.addService(minesProto.MinesGame.service, {
  joinGame: (call, callback) => {
    const { playerName } = call.request;
    const playerId = game.addPlayer(playerName);
    
    console.log(`Player joined: ${playerName} (${playerId})`);
    
    playerStreams.set(playerId, call);
    
    // Send initial game state to the new player
    call.write({
      ...game.getGameState(),
      message: `Welcome ${playerName}! You joined the game.`
    });
    
    // Let other players know someone joined
    broadcastGameState();
    
    // Handle client disconnect
    call.on('cancelled', () => {
      console.log(`Player left: ${playerName} (${playerId})`);
      game.removePlayer(playerId);
      playerStreams.delete(playerId);
      broadcastGameState();
    });
  },
  
  revealCell: (call, callback) => {
    const { playerId, x, y } = call.request;
    console.log(`Player ${playerId} is revealing cell at (${x}, ${y})`);
    
    const result = game.revealCell(playerId, x, y);
    broadcastGameState();
    callback(null, result);
  },
  
  flagCell: (call, callback) => {
    const { playerId, x, y } = call.request;
    console.log(`Player ${playerId} is toggling flag at (${x}, ${y})`);
    
    const result = game.flagCell(playerId, x, y);
    broadcastGameState();
    callback(null, result);
  }
});

server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  server.start();
  console.log('Server running on port 50051');
});