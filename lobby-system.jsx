import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Crown, CheckCircle, Circle, MessageSquare, Settings, ArrowLeft, Copy, RefreshCw, X, Gamepad2, Globe, Lock, Clock, Zap } from 'lucide-react';

// ============================================================================
// MOCK DATA & SIMULATION (Replace with real networking in production)
// ============================================================================

const generateId = () => Math.random().toString(36).substr(2, 9);

const MOCK_PLAYERS = [
  { id: 'p1', name: 'DragonSlayer99', avatar: '🐉', level: 42 },
  { id: 'p2', name: 'PixelNinja', avatar: '🥷', level: 28 },
  { id: 'p3', name: 'CosmicGamer', avatar: '🚀', level: 35 },
  { id: 'p4', name: 'ShadowWolf', avatar: '🐺', level: 19 },
  { id: 'p5', name: 'CrystalMage', avatar: '💎', level: 51 },
];

const GAME_MODES = [
  { id: 'ffa', name: 'Free For All', icon: '⚔️', description: 'Every player for themselves' },
  { id: 'teams', name: 'Team Battle', icon: '👥', description: '2 teams compete' },
  { id: 'coop', name: 'Co-op', icon: '🤝', description: 'Work together to win' },
  { id: 'tournament', name: 'Tournament', icon: '🏆', description: 'Bracket-style elimination' },
];

// ============================================================================
// PLAYER CARD COMPONENT
// ============================================================================

function PlayerCard({ player, isHost, isReady, isCurrentUser, onKick, canKick }) {
  return (
    <div className={`
      flex items-center gap-3 p-3 rounded-lg transition-all
      ${isCurrentUser ? 'bg-indigo-900/40 ring-1 ring-indigo-500' : 'bg-slate-800/50'}
      ${isReady ? 'border-l-4 border-emerald-500' : 'border-l-4 border-slate-600'}
    `}>
      <div className="text-3xl">{player.avatar}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate">{player.name}</span>
          {isHost && <Crown className="w-4 h-4 text-amber-400" />}
          {isCurrentUser && <span className="text-xs text-indigo-400">(You)</span>}
        </div>
        <div className="text-xs text-slate-400">Level {player.level}</div>
      </div>
      <div className="flex items-center gap-2">
        {isReady ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="w-4 h-4" /> Ready
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Circle className="w-4 h-4" /> Waiting
          </span>
        )}
        {canKick && !isCurrentUser && (
          <button
            onClick={() => onKick(player.id)}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LOBBY CHAT COMPONENT
// ============================================================================

function LobbyChat({ messages, onSendMessage, currentPlayer }) {
  const [input, setInput] = useState('');
  const messagesEndRef = React.useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-64 bg-slate-900/50 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border-b border-slate-700">
        <MessageSquare className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-300">Lobby Chat</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={msg.system ? 'text-center' : ''}>
            {msg.system ? (
              <span className="text-xs text-slate-500 italic">{msg.text}</span>
            ) : (
              <div>
                <span className={`text-sm font-medium ${msg.playerId === currentPlayer?.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                  {msg.playerName}:
                </span>
                <span className="text-sm text-slate-400 ml-2">{msg.text}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2 p-2 bg-slate-800/30">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// LOBBY ROOM COMPONENT
// ============================================================================

function LobbyRoom({ room, currentPlayer, onLeave, onReady, onStart, onKick, onSendMessage }) {
  const isHost = room.hostId === currentPlayer?.id;
  const currentPlayerReady = room.readyPlayers.includes(currentPlayer?.id);
  const allReady = room.players.every(p => room.readyPlayers.includes(p.id) || p.id === room.hostId);
  const canStart = isHost && allReady && room.players.length >= 2;

  const copyRoomCode = () => {
    navigator.clipboard?.writeText(room.code);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Leave Lobby</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Room Code:</span>
          <code className="px-3 py-1 bg-slate-800 rounded-lg text-indigo-400 font-mono">{room.code}</code>
          <button
            onClick={copyRoomCode}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Room Info */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl p-6 border border-indigo-800/30">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{room.name}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {room.players.length}/{room.maxPlayers} Players
              </span>
              <span className="flex items-center gap-1">
                {room.isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                {room.isPrivate ? 'Private' : 'Public'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl mb-1">{GAME_MODES.find(m => m.id === room.gameMode)?.icon}</div>
            <div className="text-sm text-slate-300">{GAME_MODES.find(m => m.id === room.gameMode)?.name}</div>
          </div>
        </div>

        {/* Game Settings Summary */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-slate-900/50 rounded-lg">
          <div className="text-center">
            <div className="text-xs text-slate-500 uppercase">Map</div>
            <div className="text-sm text-white">{room.settings?.map || 'Random'}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 uppercase">Duration</div>
            <div className="text-sm text-white">{room.settings?.duration || '10 min'}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 uppercase">Difficulty</div>
            <div className="text-sm text-white">{room.settings?.difficulty || 'Normal'}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Players List */}
        <div className="bg-slate-800/30 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Players
          </h3>
          <div className="space-y-2">
            {room.players.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                isHost={player.id === room.hostId}
                isReady={room.readyPlayers.includes(player.id)}
                isCurrentUser={player.id === currentPlayer?.id}
                onKick={onKick}
                canKick={isHost}
              />
            ))}
            {/* Empty slots */}
            {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/20 border border-dashed border-slate-700">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">?</div>
                <span className="text-slate-500">Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div>
          <LobbyChat
            messages={room.messages}
            onSendMessage={onSendMessage}
            currentPlayer={currentPlayer}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-4">
        {!isHost && (
          <button
            onClick={onReady}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-lg transition-all
              ${currentPlayerReady
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30'
              }
            `}
          >
            {currentPlayerReady ? (
              <>
                <Circle className="w-5 h-5" />
                Cancel Ready
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Ready Up
              </>
            )}
          </button>
        )}
        {isHost && (
          <button
            onClick={onStart}
            disabled={!canStart}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-lg transition-all
              ${canStart
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-900/30'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Zap className="w-5 h-5" />
            {canStart ? 'Start Game' : `Waiting for ${room.players.filter(p => !room.readyPlayers.includes(p.id) && p.id !== room.hostId).length} players`}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CREATE ROOM COMPONENT
// ============================================================================

function CreateRoom({ onBack, onCreate, currentPlayer }) {
  const [name, setName] = useState(`${currentPlayer?.name}'s Room`);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [gameMode, setGameMode] = useState('ffa');
  const [settings, setSettings] = useState({
    map: 'Random',
    duration: '10 min',
    difficulty: 'Normal',
  });

  const handleCreate = () => {
    onCreate({
      name,
      maxPlayers,
      isPrivate,
      gameMode,
      settings,
    });
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Lobby Browser</span>
      </button>

      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-700/50">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Plus className="w-7 h-7 text-indigo-400" />
          Create New Room
        </h2>

        <div className="space-y-6">
          {/* Room Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Room Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter room name..."
            />
          </div>

          {/* Game Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Game Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {GAME_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setGameMode(mode.id)}
                  className={`
                    p-4 rounded-lg text-left transition-all
                    ${gameMode === mode.id
                      ? 'bg-indigo-600 ring-2 ring-indigo-400'
                      : 'bg-slate-800 hover:bg-slate-700'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">{mode.icon}</span>
                    <span className="font-semibold text-white">{mode.name}</span>
                  </div>
                  <p className="text-xs text-slate-400">{mode.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Max Players: {maxPlayers}</label>
            <input
              type="range"
              min="2"
              max="8"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>2</span>
              <span>8</span>
            </div>
          </div>

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              {isPrivate ? <Lock className="w-5 h-5 text-amber-400" /> : <Globe className="w-5 h-5 text-emerald-400" />}
              <div>
                <div className="font-medium text-white">{isPrivate ? 'Private Room' : 'Public Room'}</div>
                <div className="text-xs text-slate-400">
                  {isPrivate ? 'Only players with the code can join' : 'Anyone can find and join'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`
                w-14 h-8 rounded-full transition-colors relative
                ${isPrivate ? 'bg-amber-600' : 'bg-slate-600'}
              `}
            >
              <div className={`
                w-6 h-6 bg-white rounded-full absolute top-1 transition-transform
                ${isPrivate ? 'translate-x-7' : 'translate-x-1'}
              `} />
            </button>
          </div>

          {/* Game Settings */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Game Settings
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Map</label>
                <select
                  value={settings.map}
                  onChange={(e) => setSettings({ ...settings, map: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option>Random</option>
                  <option>Forest</option>
                  <option>Desert</option>
                  <option>Snow</option>
                  <option>Volcano</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Duration</label>
                <select
                  value={settings.duration}
                  onChange={(e) => setSettings({ ...settings, duration: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option>5 min</option>
                  <option>10 min</option>
                  <option>15 min</option>
                  <option>20 min</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Difficulty</label>
                <select
                  value={settings.difficulty}
                  onChange={(e) => setSettings({ ...settings, difficulty: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option>Easy</option>
                  <option>Normal</option>
                  <option>Hard</option>
                  <option>Extreme</option>
                </select>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreate}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold text-lg text-white transition-all shadow-lg shadow-indigo-900/30"
          >
            Create Room
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOBBY BROWSER COMPONENT
// ============================================================================

function LobbyBrowser({ rooms, onJoin, onCreate, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(search.toLowerCase());
    const matchesMode = filterMode === 'all' || room.gameMode === filterMode;
    return matchesSearch && matchesMode && !room.isPrivate;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Gamepad2 className="w-7 h-7 text-indigo-400" />
          Game Lobbies
        </h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Room
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full pl-10 pr-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="px-4 py-3 bg-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Modes</option>
          {GAME_MODES.map(mode => (
            <option key={mode.id} value={mode.id}>{mode.name}</option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Room List */}
      <div className="space-y-3">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl">
            <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">No rooms found</p>
            <button
              onClick={onCreate}
              className="mt-4 text-indigo-400 hover:text-indigo-300"
            >
              Create the first one!
            </button>
          </div>
        ) : (
          filteredRooms.map(room => (
            <div
              key={room.id}
              className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all cursor-pointer group"
              onClick={() => onJoin(room.id)}
            >
              <div className="text-4xl">{GAME_MODES.find(m => m.id === room.gameMode)?.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">{room.name}</h3>
                  {room.isPrivate && <Lock className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>{GAME_MODES.find(m => m.id === room.gameMode)?.name}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {room.settings?.duration}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-white">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>{room.players.length}/{room.maxPlayers}</span>
                  </div>
                  <div className={`text-xs ${room.players.length < room.maxPlayers ? 'text-emerald-400' : 'text-red-400'}`}>
                    {room.players.length < room.maxPlayers ? 'Open' : 'Full'}
                  </div>
                </div>
                <button
                  disabled={room.players.length >= room.maxPlayers}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all
                    ${room.players.length < room.maxPlayers
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }
                  `}
                >
                  Join
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN LOBBY SYSTEM COMPONENT
// ============================================================================

export default function MultiplayerLobby() {
  const [view, setView] = useState('browser'); // 'browser' | 'create' | 'room'
  const [currentPlayer] = useState(MOCK_PLAYERS[0]);
  const [rooms, setRooms] = useState([
    {
      id: 'r1',
      code: 'ABC123',
      name: 'Epic Battle Arena',
      hostId: 'p2',
      players: [MOCK_PLAYERS[1], MOCK_PLAYERS[2]],
      maxPlayers: 4,
      isPrivate: false,
      gameMode: 'ffa',
      readyPlayers: ['p2'],
      settings: { map: 'Forest', duration: '10 min', difficulty: 'Normal' },
      messages: [{ system: true, text: 'Room created' }],
    },
    {
      id: 'r2',
      code: 'XYZ789',
      name: 'Team Champions',
      hostId: 'p4',
      players: [MOCK_PLAYERS[3], MOCK_PLAYERS[4]],
      maxPlayers: 6,
      isPrivate: false,
      gameMode: 'teams',
      readyPlayers: [],
      settings: { map: 'Desert', duration: '15 min', difficulty: 'Hard' },
      messages: [],
    },
  ]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  const handleCreateRoom = (config) => {
    const newRoom = {
      id: generateId(),
      code: Math.random().toString(36).substr(2, 6).toUpperCase(),
      name: config.name,
      hostId: currentPlayer.id,
      players: [currentPlayer],
      maxPlayers: config.maxPlayers,
      isPrivate: config.isPrivate,
      gameMode: config.gameMode,
      readyPlayers: [],
      settings: config.settings,
      messages: [{ system: true, text: 'Room created' }],
    };
    setRooms([...rooms, newRoom]);
    setCurrentRoom(newRoom);
    setView('room');
  };

  const handleJoinRoom = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (room && room.players.length < room.maxPlayers) {
      const updatedRoom = {
        ...room,
        players: [...room.players, currentPlayer],
        messages: [...room.messages, { system: true, text: `${currentPlayer.name} joined the room` }],
      };
      setRooms(rooms.map(r => r.id === roomId ? updatedRoom : r));
      setCurrentRoom(updatedRoom);
      setView('room');
    }
  };

  const handleLeaveRoom = () => {
    if (currentRoom) {
      const updatedRoom = {
        ...currentRoom,
        players: currentRoom.players.filter(p => p.id !== currentPlayer.id),
        readyPlayers: currentRoom.readyPlayers.filter(id => id !== currentPlayer.id),
        messages: [...currentRoom.messages, { system: true, text: `${currentPlayer.name} left the room` }],
      };
      setRooms(rooms.map(r => r.id === currentRoom.id ? updatedRoom : r));
      setCurrentRoom(null);
      setView('browser');
    }
  };

  const handleToggleReady = () => {
    if (currentRoom) {
      const isReady = currentRoom.readyPlayers.includes(currentPlayer.id);
      const updatedRoom = {
        ...currentRoom,
        readyPlayers: isReady
          ? currentRoom.readyPlayers.filter(id => id !== currentPlayer.id)
          : [...currentRoom.readyPlayers, currentPlayer.id],
      };
      setRooms(rooms.map(r => r.id === currentRoom.id ? updatedRoom : r));
      setCurrentRoom(updatedRoom);
    }
  };

  const handleStartGame = () => {
    setGameStarted(true);
  };

  const handleKickPlayer = (playerId) => {
    if (currentRoom && currentRoom.hostId === currentPlayer.id) {
      const kickedPlayer = currentRoom.players.find(p => p.id === playerId);
      const updatedRoom = {
        ...currentRoom,
        players: currentRoom.players.filter(p => p.id !== playerId),
        readyPlayers: currentRoom.readyPlayers.filter(id => id !== playerId),
        messages: [...currentRoom.messages, { system: true, text: `${kickedPlayer?.name} was kicked` }],
      };
      setRooms(rooms.map(r => r.id === currentRoom.id ? updatedRoom : r));
      setCurrentRoom(updatedRoom);
    }
  };

  const handleSendMessage = (text) => {
    if (currentRoom) {
      const updatedRoom = {
        ...currentRoom,
        messages: [...currentRoom.messages, {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          text,
        }],
      };
      setRooms(rooms.map(r => r.id === currentRoom.id ? updatedRoom : r));
      setCurrentRoom(updatedRoom);
    }
  };

  if (gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Started!</h1>
          <p className="text-slate-400 mb-6">Your game would load here</p>
          <button
            onClick={() => {
              setGameStarted(false);
              setCurrentRoom(null);
              setView('browser');
            }}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Current Player Banner */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{currentPlayer.avatar}</div>
            <div>
              <div className="font-semibold">{currentPlayer.name}</div>
              <div className="text-xs text-slate-400">Level {currentPlayer.level}</div>
            </div>
          </div>
          <div className="text-sm text-slate-400">
            Online Players: <span className="text-emerald-400">1,247</span>
          </div>
        </div>

        {/* Main Content */}
        {view === 'browser' && (
          <LobbyBrowser
            rooms={rooms}
            onJoin={handleJoinRoom}
            onCreate={() => setView('create')}
            onRefresh={() => {}}
          />
        )}
        {view === 'create' && (
          <CreateRoom
            onBack={() => setView('browser')}
            onCreate={handleCreateRoom}
            currentPlayer={currentPlayer}
          />
        )}
        {view === 'room' && currentRoom && (
          <LobbyRoom
            room={currentRoom}
            currentPlayer={currentPlayer}
            onLeave={handleLeaveRoom}
            onReady={handleToggleReady}
            onStart={handleStartGame}
            onKick={handleKickPlayer}
            onSendMessage={handleSendMessage}
          />
        )}
      </div>
    </div>
  );
}
