// client.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

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

// Command line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connection details
let serverAddress = 'localhost:50051';
let playerId = null;
let gameState = null;

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
  serverAddress = args[0];
}

// Connect to server
const client = new minesProto.MinesGame(
  serverAddress,
  grpc.credentials.createInsecure()
);

// Draw the game board
function drawBoard() {
  if (!gameState) return;

  console.clear();
  const { cells, boardWidth, boardHeight, gameStatus, message, minesRemaining } = gameState;

  console.log(chalk.bold(`Game Status: ${gameStatus.toUpperCase()}`));
  console.log(chalk.bold(`Mines Remaining: ${minesRemaining}`));
  console.log(chalk.cyan(message));
  console.log();

  // Column indices
  process.stdout.write('   ');
  for (let x = 0; x < boardWidth; x++) {
    process.stdout.write(chalk.gray(` ${x < 10 ? x : x % 10} `));
  }
  process.stdout.write('\n');

  // Top border
  process.stdout.write('   ');
  process.stdout.write(chalk.gray('┌' + '───┬'.repeat(boardWidth - 1) + '───┐\n'));

  for (let y = 0; y < boardHeight; y++) {
    // Row indices
    process.stdout.write(chalk.gray(`${y < 10 ? ' ' + y : y} `));
    
    for (let x = 0; x < boardWidth; x++) {
      const cell = cells[y * boardWidth + x];
      process.stdout.write(chalk.gray('│'));
      
      if (cell.revealed) {
        if (cell.isMine) {
          process.stdout.write(chalk.red(' * '));
        } else {
          const count = cell.adjacentMines;
          let color;
          if (count === 0) color = chalk.white;
          else if (count === 1) color = chalk.blue;
          else if (count === 2) color = chalk.green;
          else if (count === 3) color = chalk.red;
          else if (count === 4) color = chalk.magenta;
          else color = chalk.yellow;
          
          process.stdout.write(count === 0 ? '   ' : ` ${color(count)} `);
        }
      } else if (cell.flagged) {
        process.stdout.write(chalk.red(' ⚑ '));
      } else {
        process.stdout.write(chalk.gray(' · '));
      }
    }
    
    process.stdout.write(chalk.gray('│\n'));
    
    // Row divider
    if (y < boardHeight - 1) {
      process.stdout.write('   ');
      process.stdout.write(chalk.gray('├' + '───┼'.repeat(boardWidth - 1) + '───┤\n'));
    }
  }
  
  // Bottom border
  process.stdout.write('   ');
  process.stdout.write(chalk.gray('└' + '───┴'.repeat(boardWidth - 1) + '───┘\n'));
  
  console.log();
  console.log(chalk.yellow('Commands: reveal x y | flag x y | quit'));
}

// Join game
function joinGame() {
  rl.question('Enter your name: ', (playerName) => {
    console.log(`Joining game as ${playerName}...`);
    
    const call = client.joinGame({ playerName });
    
    call.on('data', (newState) => {
      gameState = newState;
      drawBoard();
    });
    
    call.on('end', () => {
      console.log('Connection closed by server.');
      process.exit(0);
    });
    
    call.on('error', (error) => {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    });
    
    // Wait for the first gameState update to get our playerId
    const waitForGameState = setInterval(() => {
      if (gameState) {
        clearInterval(waitForGameState);
        
        // Find our player ID
        const players = gameState.players;
        for (const player of players) {
          if (player.name === playerName) {
            playerId = player.id;
            break;
          }
        }
        
        if (!playerId) {
          console.error('Could not find player ID.');
          process.exit(1);
        }
        
        // Process user input
        processCommands();
      }
    }, 100);
  });
}

function processCommands() {
  rl.on('line', (input) => {
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    
    if (command === 'quit' || command === 'exit') {
      console.log('Thanks for playing!');
      process.exit(0);
    } else if (command === 'reveal' || command === 'r') {
      if (parts.length < 3) {
        console.log('Usage: reveal x y');
        return;
      }
      
      const x = parseInt(parts[1]);
      const y = parseInt(parts[2]);
      
      if (isNaN(x) || isNaN(y)) {
        console.log('Invalid coordinates. Usage: reveal x y');
        return;
      }
      
      client.revealCell({ playerId, x, y }, (error, response) => {
        if (error) {
          console.error(`Error: ${error.message}`);
        } else if (!response.success) {
          console.log(`Failed: ${response.message}`);
        }
      });
    } else if (command === 'flag' || command === 'f') {
      if (parts.length < 3) {
        console.log('Usage: flag x y');
        return;
      }
      
      const x = parseInt(parts[1]);
      const y = parseInt(parts[2]);
      
      if (isNaN(x) || isNaN(y)) {
        console.log('Invalid coordinates. Usage: flag x y');
        return;
      }
      
      client.flagCell({ playerId, x, y }, (error, response) => {
        if (error) {
          console.error(`Error: ${error.message}`);
        } else if (!response.success) {
          console.log(`Failed: ${response.message}`);
        }
      });
    } else {
      console.log('Unknown command. Available commands: reveal x y | flag x y | quit');
    }
  });
}

// Start the client
joinGame();
