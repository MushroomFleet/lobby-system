# Lobby System Integration Guide

This guide walks you through integrating the Multiplayer Lobby System into your React game project. The component is designed to be modular and adaptable to various networking backends.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Basic Setup](#basic-setup)
4. [Component Architecture](#component-architecture)
5. [Networking Integration](#networking-integration)
6. [Customization](#customization)
7. [API Reference](#api-reference)
8. [Examples](#examples)

---

## Prerequisites

Before integrating the lobby system, ensure you have:

- React 18+ installed
- Tailwind CSS configured (or substitute your own styling)
- Lucide React icons (`npm install lucide-react`)
- A networking solution (WebSocket, Socket.io, Firebase, etc.)

```bash
npm install react lucide-react
npm install -D tailwindcss
```

---

## Installation

### Option 1: Copy the Component

Copy `lobby-system.jsx` into your project's components directory:

```
src/
├── components/
│   └── lobby/
│       └── LobbySystem.jsx
```

### Option 2: Import Individual Components

The file exports a default `MultiplayerLobby` component, but you can extract individual components:

```javascript
// Extract from the file
export { LobbyBrowser, LobbyRoom, CreateRoom, PlayerCard, LobbyChat };
```

---

## Basic Setup

### 1. Import the Component

```jsx
import MultiplayerLobby from './components/lobby/LobbySystem';

function App() {
  return (
    <div className="app">
      <MultiplayerLobby />
    </div>
  );
}
```

### 2. Configure Your Player

Replace the mock player with your authenticated user:

```jsx
// In your lobby component
const [currentPlayer, setCurrentPlayer] = useState(null);

useEffect(() => {
  // Get player from your auth system
  const player = {
    id: authUser.uid,
    name: authUser.displayName,
    avatar: authUser.photoURL || '🎮',
    level: userProfile.level,
  };
  setCurrentPlayer(player);
}, [authUser]);
```

### 3. Replace Mock Data

The component includes mock data for demonstration. Replace these with your actual data sources:

```javascript
// Remove these mock constants
const MOCK_PLAYERS = [...];

// Replace with your data fetching
const [rooms, setRooms] = useState([]);

useEffect(() => {
  // Fetch rooms from your backend
  const unsubscribe = subscribeToRooms((rooms) => {
    setRooms(rooms);
  });
  return unsubscribe;
}, []);
```

---

## Component Architecture

The lobby system consists of five main components:

```
MultiplayerLobby (Main Container)
├── LobbyBrowser      - Browse and search available rooms
├── CreateRoom        - Configure and create new rooms
├── LobbyRoom         - Main lobby view when in a room
│   ├── PlayerCard    - Individual player display
│   └── LobbyChat     - In-lobby chat system
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MultiplayerLobby                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  State: rooms, currentRoom, currentPlayer, view     │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│           ┌───────────────┼───────────────┐                │
│           ▼               ▼               ▼                │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│    │LobbyBrowser│  │ CreateRoom │  │ LobbyRoom  │         │
│    └────────────┘  └────────────┘  └────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## Networking Integration

### WebSocket Example

```jsx
import { useEffect, useState, useRef } from 'react';

function useWebSocketLobby(serverUrl) {
  const ws = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(serverUrl);
    
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    
    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'ROOMS_LIST':
          setRooms(message.rooms);
          break;
        case 'ROOM_JOINED':
          setCurrentRoom(message.room);
          break;
        case 'ROOM_UPDATED':
          setCurrentRoom(message.room);
          setRooms(prev => prev.map(r => 
            r.id === message.room.id ? message.room : r
          ));
          break;
        case 'PLAYER_JOINED':
        case 'PLAYER_LEFT':
        case 'PLAYER_READY':
          // Update room state
          break;
        case 'CHAT_MESSAGE':
          setCurrentRoom(prev => ({
            ...prev,
            messages: [...prev.messages, message.chatMessage]
          }));
          break;
        case 'GAME_STARTING':
          // Transition to game
          break;
      }
    };

    return () => ws.current?.close();
  }, [serverUrl]);

  const send = (type, payload) => {
    ws.current?.send(JSON.stringify({ type, ...payload }));
  };

  return {
    connected,
    rooms,
    currentRoom,
    createRoom: (config) => send('CREATE_ROOM', config),
    joinRoom: (roomId) => send('JOIN_ROOM', { roomId }),
    leaveRoom: () => send('LEAVE_ROOM'),
    toggleReady: () => send('TOGGLE_READY'),
    startGame: () => send('START_GAME'),
    sendMessage: (text) => send('CHAT_MESSAGE', { text }),
    kickPlayer: (playerId) => send('KICK_PLAYER', { playerId }),
  };
}
```

### Socket.io Example

```jsx
import { io } from 'socket.io-client';

function useSocketIOLobby(serverUrl) {
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);

  useEffect(() => {
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('rooms:list', setRooms);
    newSocket.on('room:joined', setCurrentRoom);
    newSocket.on('room:updated', (room) => {
      setCurrentRoom(room);
      setRooms(prev => prev.map(r => r.id === room.id ? room : r));
    });
    newSocket.on('chat:message', (msg) => {
      setCurrentRoom(prev => ({
        ...prev,
        messages: [...prev.messages, msg]
      }));
    });

    return () => newSocket.close();
  }, [serverUrl]);

  return {
    rooms,
    currentRoom,
    createRoom: (config) => socket?.emit('room:create', config),
    joinRoom: (roomId) => socket?.emit('room:join', roomId),
    leaveRoom: () => socket?.emit('room:leave'),
    toggleReady: () => socket?.emit('player:ready'),
    startGame: () => socket?.emit('game:start'),
    sendMessage: (text) => socket?.emit('chat:send', text),
    kickPlayer: (playerId) => socket?.emit('player:kick', playerId),
  };
}
```

### Firebase Realtime Database Example

```jsx
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from './firebase-config';

function useFirebaseLobby(currentPlayer) {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);

  // Subscribe to all rooms
  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    return onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      const roomsList = data ? Object.entries(data).map(([id, room]) => ({
        id,
        ...room,
        players: room.players ? Object.values(room.players) : [],
        messages: room.messages ? Object.values(room.messages) : [],
      })) : [];
      setRooms(roomsList);
    });
  }, []);

  // Subscribe to current room
  useEffect(() => {
    if (!currentRoomId) return;
    const roomRef = ref(db, `rooms/${currentRoomId}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCurrentRoom({
          id: currentRoomId,
          ...data,
          players: data.players ? Object.values(data.players) : [],
          messages: data.messages ? Object.values(data.messages) : [],
        });
      }
    });
  }, [currentRoomId]);

  const createRoom = async (config) => {
    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const room = {
      ...config,
      code: Math.random().toString(36).substr(2, 6).toUpperCase(),
      hostId: currentPlayer.id,
      players: { [currentPlayer.id]: currentPlayer },
      readyPlayers: [],
      messages: [],
      createdAt: Date.now(),
    };
    await set(newRoomRef, room);
    setCurrentRoomId(newRoomRef.key);
  };

  const joinRoom = async (roomId) => {
    const playerRef = ref(db, `rooms/${roomId}/players/${currentPlayer.id}`);
    await set(playerRef, currentPlayer);
    setCurrentRoomId(roomId);
  };

  const leaveRoom = async () => {
    if (!currentRoomId) return;
    const playerRef = ref(db, `rooms/${currentRoomId}/players/${currentPlayer.id}`);
    await remove(playerRef);
    setCurrentRoomId(null);
    setCurrentRoom(null);
  };

  const toggleReady = async () => {
    if (!currentRoom) return;
    const readyRef = ref(db, `rooms/${currentRoomId}/readyPlayers`);
    const isReady = currentRoom.readyPlayers?.includes(currentPlayer.id);
    const newReady = isReady
      ? currentRoom.readyPlayers.filter(id => id !== currentPlayer.id)
      : [...(currentRoom.readyPlayers || []), currentPlayer.id];
    await set(readyRef, newReady);
  };

  const sendMessage = async (text) => {
    const messagesRef = ref(db, `rooms/${currentRoomId}/messages`);
    await push(messagesRef, {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      text,
      timestamp: Date.now(),
    });
  };

  return {
    rooms,
    currentRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    sendMessage,
    // ... other methods
  };
}
```

---

## Customization

### Styling

The component uses Tailwind CSS. To customize:

1. **Colors**: Replace `indigo-*`, `slate-*`, etc. with your color scheme
2. **Fonts**: Update the font classes or import your own fonts
3. **Animations**: Modify the transition classes

```jsx
// Example: Custom theme wrapper
<div className="lobby-theme-dark">
  <MultiplayerLobby />
</div>
```

### Game Modes

Edit the `GAME_MODES` array to match your game:

```javascript
const GAME_MODES = [
  { id: 'deathmatch', name: 'Deathmatch', icon: '💀', description: 'Last one standing' },
  { id: 'capture', name: 'Capture the Flag', icon: '🚩', description: 'Capture enemy flags' },
  { id: 'race', name: 'Race', icon: '🏁', description: 'First to finish wins' },
  // Add your modes...
];
```

### Room Settings

Customize the settings in the `CreateRoom` component:

```jsx
const [settings, setSettings] = useState({
  map: 'Random',
  duration: '10 min',
  difficulty: 'Normal',
  // Add custom settings
  maxScore: 100,
  friendlyFire: false,
  powerUps: true,
});
```

### Player Data

Extend the player object with game-specific data:

```javascript
const player = {
  id: 'user-123',
  name: 'DragonSlayer99',
  avatar: '🐉',
  level: 42,
  // Add custom fields
  rank: 'Diamond',
  wins: 150,
  losses: 45,
  badges: ['veteran', 'champion'],
  customization: {
    color: '#ff0000',
    skin: 'dragon-armor',
  },
};
```

---

## API Reference

### MultiplayerLobby Props

| Prop | Type | Description |
|------|------|-------------|
| `onGameStart` | `(room, players) => void` | Called when the game starts |
| `onError` | `(error) => void` | Error handler |
| `theme` | `'dark' \| 'light'` | UI theme |
| `maxRooms` | `number` | Max rooms to display |

### LobbyRoom Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `room` | `Room` | Yes | Current room data |
| `currentPlayer` | `Player` | Yes | Current user |
| `onLeave` | `() => void` | Yes | Leave room handler |
| `onReady` | `() => void` | Yes | Toggle ready handler |
| `onStart` | `() => void` | Yes | Start game handler |
| `onKick` | `(playerId) => void` | Yes | Kick player handler |
| `onSendMessage` | `(text) => void` | Yes | Send chat message |

### Data Types

```typescript
interface Player {
  id: string;
  name: string;
  avatar: string;
  level: number;
}

interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  isPrivate: boolean;
  gameMode: string;
  readyPlayers: string[];
  settings: RoomSettings;
  messages: ChatMessage[];
}

interface RoomSettings {
  map: string;
  duration: string;
  difficulty: string;
}

interface ChatMessage {
  playerId?: string;
  playerName?: string;
  text: string;
  system?: boolean;
}
```

---

## Examples

### Minimal Integration

```jsx
import MultiplayerLobby from './LobbySystem';
import { useAuth } from './auth';
import { useLobbyNetwork } from './network';

function GameLobby() {
  const { user } = useAuth();
  const network = useLobbyNetwork();

  const handleGameStart = (room) => {
    // Navigate to game scene
    navigate(`/game/${room.id}`);
  };

  return (
    <MultiplayerLobby
      currentPlayer={{
        id: user.id,
        name: user.displayName,
        avatar: user.avatar,
        level: user.stats.level,
      }}
      rooms={network.rooms}
      currentRoom={network.currentRoom}
      onCreateRoom={network.createRoom}
      onJoinRoom={network.joinRoom}
      onLeaveRoom={network.leaveRoom}
      onToggleReady={network.toggleReady}
      onStartGame={handleGameStart}
      onSendMessage={network.sendMessage}
      onKickPlayer={network.kickPlayer}
    />
  );
}
```

### With Loading States

```jsx
function GameLobby() {
  const [loading, setLoading] = useState(true);
  const { rooms, connected } = useLobbyNetwork();

  if (!connected) {
    return <div>Connecting to server...</div>;
  }

  if (loading) {
    return <div>Loading lobbies...</div>;
  }

  return <MultiplayerLobby rooms={rooms} />;
}
```

---

## Troubleshooting

### Common Issues

1. **Players not updating**: Ensure your network subscription includes all room events
2. **Chat not working**: Verify message format matches `ChatMessage` interface
3. **Ready state not syncing**: Check that `readyPlayers` is an array of player IDs

### Performance Tips

- Use `React.memo` for PlayerCard components with many players
- Debounce room list updates if receiving frequent changes
- Virtualize room list for 50+ rooms

---

## Support

For issues and feature requests, visit: [GitHub Issues](https://github.com/MushroomFleet/lobby-system/issues)
