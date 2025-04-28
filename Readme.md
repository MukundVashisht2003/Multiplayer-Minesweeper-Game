# 💣 Multiplayer Minesweeper

A real-time multiplayer implementation of the classic Minesweeper game using gRPC for client-server communication.

## ✨ Features

- 🎮 Real-time multiplayer gameplay
- 🔄 Synchronized game state across all clients
- 🎯 Classic Minesweeper mechanics
- 🎨 Beautiful CLI interface with colored output
- 👥 Support for multiple concurrent players

## 🚀 Getting Started

### Prerequisites

- Node.js (v12 or higher)
- npm (Node Package Manager)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/multiplayer-mines.git
cd multiplayer-mines
```

2. Install dependencies:
```bash
npm install
```

### Running the Game

1. Start the server:
```bash
npm run start:server
```

2. In a separate terminal, start a client:
```bash
npm run start:client
```

You can start multiple clients to play with friends!

## 🎮 How to Play

### Commands
- `reveal x y` or `r x y` - Reveal a cell at coordinates (x,y)
- `flag x y` or `f x y` - Toggle flag at coordinates (x,y)
- `quit` or `exit` - Leave the game

### Game Symbols
- `·` - Hidden cell
- `⚑` - Flagged cell
- `*` - Mine (revealed)
- `1-8` - Number of adjacent mines
- ` ` (empty) - Revealed cell with no adjacent mines

## 🏗️ Technical Details

### Architecture
- Built with Node.js and gRPC
- Uses Protocol Buffers for efficient data serialization
- Real-time updates using server streaming
- Concurrent game state management

### Dependencies
- `@grpc/grpc-js` - gRPC implementation
- `@grpc/proto-loader` - Protocol Buffers loader
- `chalk` - Terminal styling
- `uuid` - Unique player ID generation

## 🙏 Acknowledgments

- Inspired by the classic Minesweeper game
- Built with modern Node.js and gRPC technologies