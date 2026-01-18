# 🎮 Multiplayer Lobby System

A comprehensive, modular lobby system for adding multiplayer functionality to React games. Features room browsing, creation, player management, ready-up mechanics, and in-lobby chat.

![Lobby System Preview](https://img.shields.io/badge/React-18%2B-61dafb?style=flat-square&logo=react)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=flat-square)

## ✨ Features

- **🔍 Lobby Browser** — Search, filter, and browse available game rooms
- **➕ Room Creation** — Configure rooms with custom settings, privacy, and game modes
- **👥 Player Management** — Host controls including kick functionality and player limits
- **✅ Ready System** — Players ready-up before game starts; host launches when all ready
- **💬 Lobby Chat** — Real-time chat with system messages for join/leave events
- **🔒 Private Rooms** — Share room codes for invite-only games
- **🎨 Modern UI** — Sleek, gaming-focused dark theme with animations

## 🚀 Quick Start

### Preview the Demo

Open `demo.html` in your browser for an interactive demonstration of all features:

```bash
# Clone the repository
git clone https://github.com/MushroomFleet/lobby-system.git

# Open the demo
open demo.html
```

The demo includes:
- Browsing and joining existing rooms
- Creating new rooms with custom settings
- Ready-up mechanics and game start flow
- In-lobby chat functionality
- All UI interactions and animations

### Install in Your Project

```bash
# Copy the component to your project
cp lobby-system.jsx your-project/src/components/

# Install dependencies
npm install lucide-react
```

```jsx
import MultiplayerLobby from './components/lobby-system';

function App() {
  return <MultiplayerLobby />;
}
```

## 📁 Files

| File | Description |
|------|-------------|
| `lobby-system.jsx` | Main React component with all lobby functionality |
| `demo.html` | Standalone HTML demo — open in browser to preview |
| `lobby-system-integration.md` | Developer guide for integrating with your game |
| `cloudflare-firebase-infrastructure.md` | Full-stack deployment guide with D1, R2, and Firebase |

## 🧩 Components

The system is composed of modular, reusable components:

```
MultiplayerLobby          # Main container managing state and views
├── LobbyBrowser          # Browse/search/filter available rooms
├── CreateRoom            # Room configuration and creation
├── LobbyRoom             # Active room view
│   ├── PlayerCard        # Individual player display with status
│   └── LobbyChat         # Real-time chat system
```

## 🔌 Network Integration

The component uses local state for demonstration. For production, integrate with your networking layer:

- **WebSocket** — Direct socket connections
- **Socket.io** — Real-time bidirectional communication
- **Firebase** — Realtime Database or Firestore
- **Colyseus** — Multiplayer game server framework
- **Photon** — Cross-platform multiplayer engine

See [`lobby-system-integration.md`](./lobby-system-integration.md) for detailed integration examples with each backend.

## 🏗️ Full-Stack Deployment

For a complete production setup using Cloudflare and Firebase, see:

**[📘 Infrastructure Guide](./cloudflare-firebase-infrastructure.md)**

Provides CLI-optimized instructions (designed for Claude Code) covering:

- **Cloudflare D1** — SQLite database for players, rooms, matches, leaderboards
- **Cloudflare R2** — Object storage for avatars and game assets
- **Cloudflare Workers** — API layer with full CRUD operations
- **Firebase Hosting** — Static site hosting with CDN
- **Firebase Auth** — Google sign-in for player identity
- Complete database schema with migrations
- React hooks for auth and lobby state
- Deployment and maintenance commands

## ⚙️ Configuration

### Game Modes

Customize game modes in the `GAME_MODES` array:

```javascript
const GAME_MODES = [
  { id: 'ffa', name: 'Free For All', icon: '⚔️', description: 'Every player for themselves' },
  { id: 'teams', name: 'Team Battle', icon: '👥', description: '2 teams compete' },
  // Add your custom modes...
];
```

### Room Settings

Extend room settings for your game:

```javascript
const settings = {
  map: 'Forest',
  duration: '10 min',
  difficulty: 'Normal',
  // Add custom settings
  scoreLimit: 100,
  friendlyFire: false,
};
```

### Player Data

Add game-specific player properties:

```javascript
const player = {
  id: 'user-123',
  name: 'DragonSlayer99',
  avatar: '🐉',
  level: 42,
  // Custom fields
  rank: 'Diamond',
  badges: ['veteran'],
};
```

## 🎨 Customization

The component uses Tailwind CSS with a dark gaming aesthetic. Customize by:

1. **Colors** — Replace `indigo-*`, `slate-*` with your palette
2. **Fonts** — The demo uses Orbitron and Rajdhani
3. **Animations** — Modify transition/animation classes
4. **Icons** — Uses Lucide React (easily swappable)

## 📖 Documentation

For comprehensive integration instructions, see:

**[📘 Integration Guide](./lobby-system-integration.md)**

Covers:
- Step-by-step setup
- Network backend examples (WebSocket, Socket.io, Firebase)
- Component API reference
- Data type definitions
- Customization options
- Troubleshooting

## 🛠️ Tech Stack

- **React 18** — UI framework with hooks
- **Tailwind CSS** — Utility-first styling
- **Lucide React** — Icon library

## 📋 Requirements

- React 18+
- Node.js 16+
- Modern browser with ES6+ support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 📚 Citation

### Academic Citation

If you use this codebase in your research or project, please cite:

```bibtex
@software{lobby_system,
  title = {Multiplayer Lobby System: A modular React lobby system for multiplayer games},
  author = {Drift Johnson},
  year = {2025},
  url = {https://github.com/MushroomFleet/lobby-system},
  version = {1.0.0}
}
```

### Donate:

[![Ko-Fi](https://cdn.ko-fi.com/cdn/kofi3.png?v=3)](https://ko-fi.com/driftjohnson)
