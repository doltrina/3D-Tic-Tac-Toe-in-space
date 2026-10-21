const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// Detect active local network IPv4 addresses
function getNetworkInterfaces() {
  const nets = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        let priority = 10;
        let displayName = name;

        // Give Wi-Fi top priority, and deprioritize virtual/tunnel adapters
        if (/wi-?fi|беспроводн|wlan/i.test(name)) {
          priority = 0;
          displayName = `Wi-Fi (${name})`;
        } else if (/virtual|vbox|vmware|vethernet|host-only|happ-tun/i.test(name) || net.address.startsWith('192.168.56.')) {
          priority = 20;
          displayName = `Виртуальный (${name})`;
        } else if (/ethernet|проводн/i.test(name)) {
          priority = 2;
          displayName = `Ethernet (${name})`;
        } else if (/vpn|radmin|hamachi/i.test(name)) {
          priority = 10;
          displayName = `VPN (${name})`;
        }

        if (priority === 0 && net.address.startsWith('192.168.')) {
          priority = -1; // Highest priority: Wi-Fi on 192.168.x.x
        }

        results.push({
          name: displayName,
          rawName: name,
          ip: net.address,
          priority
        });
      }
    }
  }

  // Sort by priority (lower number = better)
  results.sort((a, b) => a.priority - b.priority);
  return results;
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

// HTTP Server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // API endpoint for LAN IP discovery
  if (pathname === '/api/lan-info') {
    const interfaces = getNetworkInterfaces();
    const primaryIp = interfaces.length > 0 ? interfaces[0].ip : '127.0.0.1';
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      primaryIp,
      port: PORT,
      primaryUrl: `http://${primaryIp}:${PORT}`,
      interfaces: interfaces.map(i => ({
        name: i.name,
        ip: i.ip,
        url: `http://${i.ip}:${PORT}`
      }))
    }));
    return;
  }

  // Static file serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check to prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routes if file not found
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// WebSocket Multiplayer Server
const wss = new WebSocketServer({ server });

// Room storage
// roomId -> { id, players: { X: ws, O: ws }, spectators: [], state: {...} }
const rooms = new Map();

function getOrCreateRoom(roomId = 'COSMIC-1') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: { X: null, O: null },
      playerIds: { X: null, O: null },
      playerNicknames: { X: 'Сверхновая', O: 'Антиматерия' },
      playerReady: { X: false, O: false },
      pendingRestart: null,
      spectators: new Set(),
      gameState: {
        dimension: '3d', // '3d' or '2d'
        themeKey: 'neon-deep',
        figureStyle: 'cosmic',
        disableCenter: true,
        boardState: Array(27).fill(null),
        firstTurn: 'X',
        currentPlayer: 'X',
        scores: { X: 0, O: 0, ties: 0 },
        isGameOver: false,
        winningCombo: null,
        winner: null
      }
    });
  }
  const r = rooms.get(roomId);
  if (!r.playerReady) r.playerReady = { X: false, O: false };
  return r;
}

function broadcastToRoom(room, messageObj, excludeWs = null) {
  const json = JSON.stringify(messageObj);
  const targets = [room.players.X, room.players.O, ...room.spectators];
  for (const client of targets) {
    if (client && client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

wss.on('connection', (ws, req) => {
  let currentRoomId = null;
  let currentRole = null; // 'X', 'O', or 'SPECTATOR'

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'JOIN_ROOM') {
        const roomId = (msg.roomId || 'COSMIC-1').trim().toUpperCase();
        const room = getOrCreateRoom(roomId);
        currentRoomId = roomId;
        const clientId = msg.clientId || null;

        // Check if this clientId already owns X or O (reconnection/refresh)
        if (clientId && room.playerIds.X === clientId) {
          room.players.X = ws;
          currentRole = 'X';
        } else if (clientId && room.playerIds.O === clientId) {
          room.players.O = ws;
          currentRole = 'O';
        } else if (!room.players.X || room.players.X.readyState !== WebSocket.OPEN) {
          room.players.X = ws;
          room.playerIds.X = clientId;
          currentRole = 'X';
        } else if (!room.players.O || room.players.O.readyState !== WebSocket.OPEN) {
          room.players.O = ws;
          room.playerIds.O = clientId;
          currentRole = 'O';
        } else {
          room.spectators.add(ws);
          currentRole = 'SPECTATOR';
        }

        if (msg.nickname && (currentRole === 'X' || currentRole === 'O')) {
          room.playerNicknames[currentRole] = String(msg.nickname).trim().slice(0, 20);
        }

        const opponentConnected = !!(room.players.X && room.players.O &&
                                     room.players.X.readyState === WebSocket.OPEN &&
                                     room.players.O.readyState === WebSocket.OPEN);

        // Send confirmation and current state to joining player
        ws.send(JSON.stringify({
          type: 'JOINED',
          roomId,
          role: currentRole,
          opponentConnected,
          playerNicknames: room.playerNicknames,
          playerReady: room.playerReady,
          gameState: room.gameState
        }));

        // Notify room that player joined
        broadcastToRoom(room, {
          type: 'PLAYER_JOINED',
          role: currentRole,
          nickname: room.playerNicknames[currentRole] || currentRole,
          playerNicknames: room.playerNicknames,
          playerReady: room.playerReady,
          opponentConnected,
          gameState: room.gameState
        }, ws);
      }

      if (msg.type === 'MAKE_MOVE') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        // Validation: must be this player's turn
        if (currentRole !== room.gameState.currentPlayer) {
          ws.send(JSON.stringify({ type: 'MOVE_REJECTED', reason: 'Сейчас ход соперника!' }));
          return;
        }

        const index = msg.index;
        if (index < 0 || index >= room.gameState.boardState.length) return;
        if (room.gameState.boardState[index] !== null || room.gameState.isGameOver) return;

        // Validation: blocked center cell
        if (index === 13 && room.gameState.dimension === '3d' && room.gameState.disableCenter) {
          ws.send(JSON.stringify({ type: 'MOVE_REJECTED', reason: 'Центр куба заблокирован правилами матча!' }));
          return;
        }

        // Apply move
        room.gameState.boardState[index] = currentRole;

        // Check win or draw using combinations provided by client or server
        const win = msg.winResult; // client or server evaluated
        if (win) {
          room.gameState.isGameOver = true;
          room.gameState.winner = currentRole;
          room.gameState.winningCombo = win.combo;
          room.gameState.scores[currentRole]++;
        } else if (msg.isDraw) {
          room.gameState.isGameOver = true;
          room.gameState.winner = 'DRAW';
          room.gameState.scores.ties++;
        } else {
          room.gameState.currentPlayer = currentRole === 'X' ? 'O' : 'X';
        }

        // Broadcast move to all players in the room
        broadcastToRoom(room, {
          type: 'MOVE_MADE',
          index,
          player: currentRole,
          nextPlayer: room.gameState.currentPlayer,
          isGameOver: room.gameState.isGameOver,
          winner: room.gameState.winner,
          winningCombo: room.gameState.winningCombo,
          scores: room.gameState.scores,
          boardState: room.gameState.boardState
        });
      }

      if (msg.type === 'RESTART_ROUND') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const totalCells = room.gameState.dimension === '3d' ? 27 : 9;
        room.gameState.boardState = Array(totalCells).fill(null);
        room.gameState.isGameOver = false;
        room.gameState.winningCombo = null;
        room.gameState.winner = null;
        room.gameState.currentPlayer = room.gameState.firstTurn;

        broadcastToRoom(room, {
          type: 'ROUND_RESTARTED',
          gameState: room.gameState
        });
      }

      // Propose a round restart (requires opponent agreement if opponent connected)
      if (msg.type === 'PROPOSE_RESTART') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const opponentRole = currentRole === 'X' ? 'O' : 'X';
        const opponentWs = room.players[opponentRole];

        // If playing solo (opponent not connected), restart immediately
        if (!opponentWs || opponentWs.readyState !== WebSocket.OPEN) {
          const totalCells = room.gameState.dimension === '3d' ? 27 : 9;
          room.gameState.boardState = Array(totalCells).fill(null);
          if (msg.firstTurn) room.gameState.firstTurn = msg.firstTurn;
          room.gameState.isGameOver = false;
          room.gameState.winningCombo = null;
          room.gameState.winner = null;
          room.gameState.currentPlayer = room.gameState.firstTurn;

          broadcastToRoom(room, {
            type: 'ROUND_RESTARTED',
            gameState: room.gameState,
            bySolo: true
          });
          return;
        }

        // Store pending proposal
        const proposerNick = msg.nickname || room.playerNicknames[currentRole] || (currentRole === 'X' ? 'Сверхновая (X)' : 'Антиматерия (O)');
        room.pendingRestart = {
          requestedBy: currentRole,
          nickname: proposerNick,
          firstTurn: msg.firstTurn || null
        };

        // Notify opponent
        opponentWs.send(JSON.stringify({
          type: 'RESTART_PROPOSED',
          requestedBy: currentRole,
          nickname: proposerNick,
          firstTurn: room.pendingRestart.firstTurn
        }));

        // Notify requester that proposal was sent
        ws.send(JSON.stringify({
          type: 'RESTART_PENDING',
          firstTurn: room.pendingRestart.firstTurn
        }));
      }

      // Respond to a pending restart proposal (accept / decline)
      if (msg.type === 'RESPOND_RESTART') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room || !room.pendingRestart) return;

        const requesterRole = room.pendingRestart.requestedBy;
        const requesterWs = room.players[requesterRole];
        const proposedFirstTurn = room.pendingRestart.firstTurn;

        if (msg.accept) {
          const totalCells = room.gameState.dimension === '3d' ? 27 : 9;
          room.gameState.boardState = Array(totalCells).fill(null);
          if (proposedFirstTurn) {
            room.gameState.firstTurn = proposedFirstTurn;
          }
          room.gameState.currentPlayer = room.gameState.firstTurn;
          room.gameState.isGameOver = false;
          room.gameState.winningCombo = null;
          room.gameState.winner = null;
          room.pendingRestart = null;

          broadcastToRoom(room, {
            type: 'ROUND_RESTARTED',
            gameState: room.gameState,
            accepted: true,
            firstTurnChanged: !!proposedFirstTurn
          });
        } else {
          // Declined by opponent
          const declinerNick = room.playerNicknames[currentRole] || currentRole;
          room.pendingRestart = null;

          if (requesterWs && requesterWs.readyState === WebSocket.OPEN) {
            requesterWs.send(JSON.stringify({
              type: 'RESTART_DECLINED',
              declinedBy: currentRole,
              nickname: declinerNick
            }));
          }
        }
      }

      // Cancel a pending restart request
      if (msg.type === 'CANCEL_RESTART_REQUEST') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        room.pendingRestart = null;

        const opponentRole = currentRole === 'X' ? 'O' : 'X';
        const opponentWs = room.players[opponentRole];
        if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
          opponentWs.send(JSON.stringify({ type: 'RESTART_CANCELLED' }));
        }
      }

      // Cosmic In-Game Tactical Chat
      if (msg.type === 'SEND_CHAT') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const text = String(msg.text || '').trim();
        if (!text) return;

        const senderNick = msg.nickname || room.playerNicknames[currentRole] || (currentRole === 'X' ? 'Сверхновая' : 'Антиматерия');
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        broadcastToRoom(room, {
          type: 'CHAT_MESSAGE',
          senderRole: currentRole,
          nickname: senderNick,
          text: text.slice(0, 200),
          time: timeStr
        });
      }

      if (msg.type === 'CHANGE_CONFIG') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        if (msg.dimension) {
          room.gameState.dimension = msg.dimension;
          const totalCells = msg.dimension === '3d' ? 27 : 9;
          room.gameState.boardState = Array(totalCells).fill(null);
          room.gameState.isGameOver = false;
        }
        if (msg.themeKey) {
          room.gameState.themeKey = msg.themeKey;
        }
        if (msg.figureStyle) {
          room.gameState.figureStyle = msg.figureStyle;
        }
        if (msg.firstTurn) {
          room.gameState.firstTurn = msg.firstTurn;
          const movesMade = room.gameState.boardState.some(c => c !== null);
          if (!movesMade) {
            room.gameState.currentPlayer = msg.firstTurn;
          }
        }
        if (msg.disableCenter !== undefined) {
          room.gameState.disableCenter = !!msg.disableCenter;
        }

        broadcastToRoom(room, {
          type: 'CONFIG_CHANGED',
          gameState: room.gameState
        });
      }

      if (msg.type === 'SEND_EMOTE') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        broadcastToRoom(room, {
          type: 'EMOTE_RECEIVED',
          emoji: msg.emoji,
          fromPlayer: currentRole
        });
      }

      if (msg.type === 'RESET_ALL_SCORES') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        room.gameState.scores = { X: 0, O: 0, ties: 0 };
        const totalCells = room.gameState.dimension === '3d' ? 27 : 9;
        room.gameState.boardState = Array(totalCells).fill(null);
        room.gameState.isGameOver = false;

        broadcastToRoom(room, {
          type: 'SCORES_RESET',
          gameState: room.gameState
        });
      }

      // Set Ready status
      if (msg.type === 'SET_READY') {
        if (!currentRoomId || !currentRole) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        if (currentRole !== 'X' && currentRole !== 'O') return;

        const ready = !!msg.ready;
        room.playerReady[currentRole] = ready;

        broadcastToRoom(room, {
          type: 'PLAYER_READY_CHANGED',
          role: currentRole,
          ready,
          playerReady: room.playerReady
        });

        // Launch game when BOTH players are connected and ready!
        const xConnected = room.players.X && room.players.X.readyState === WebSocket.OPEN;
        const oConnected = room.players.O && room.players.O.readyState === WebSocket.OPEN;

        if (xConnected && oConnected && room.playerReady.X && room.playerReady.O) {
          broadcastToRoom(room, {
            type: 'MATCH_START',
            playerNicknames: room.playerNicknames,
            gameState: room.gameState
          });
        }
      }

      // Update Nickname in real-time
      if (msg.type === 'SET_NICKNAME') {
        if (!currentRoomId || !currentRole) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const nick = String(msg.nickname || '').trim().slice(0, 20);
        if (nick && (currentRole === 'X' || currentRole === 'O')) {
          room.playerNicknames[currentRole] = nick;
          broadcastToRoom(room, {
            type: 'NICKNAME_UPDATED',
            role: currentRole,
            nickname: nick,
            playerNicknames: room.playerNicknames
          });
        }
      }

      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (room.players.X === ws) {
      room.players.X = null;
      room.playerReady.X = false;
      broadcastToRoom(room, {
        type: 'PLAYER_LEFT',
        role: 'X',
        opponentConnected: false,
        playerReady: room.playerReady
      });
    } else if (room.players.O === ws) {
      room.players.O = null;
      room.playerReady.O = false;
      broadcastToRoom(room, {
        type: 'PLAYER_LEFT',
        role: 'O',
        opponentConnected: false,
        playerReady: room.playerReady
      });
    } else {
      room.spectators.delete(ws);
    }

    // Clean up empty rooms after 5 minutes
    if (!room.players.X && !room.players.O && room.spectators.size === 0) {
      setTimeout(() => {
        if (!room.players.X && !room.players.O && room.spectators.size === 0) {
          rooms.delete(currentRoomId);
        }
      }, 300000);
    }
  });
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  const interfaces = getNetworkInterfaces();
  const primaryIp = interfaces.length > 0 ? interfaces[0].ip : '127.0.0.1';

  console.log('\n======================================================');
  console.log('  🚀 COSMIC 3D TIC-TAC-TOE LAN SERVER ЗАПУЩЕН!');
  console.log('======================================================');
  console.log(`  🖥️  На этом компьютере:`);
  console.log(`      ➜ http://localhost:${PORT}`);
  console.log(`\n  📱 На другом устройстве (телефон, ноутбук, планшет):`);
  console.log(`      ➜ Введите в браузере: http://${primaryIp}:${PORT}`);
  
  if (interfaces.length > 1) {
    console.log(`\n  🌐 Другие доступные сетевые интерфейсы:`);
    interfaces.slice(1).forEach(iface => {
      console.log(`      • ${iface.name}: http://${iface.ip}:${PORT}`);
    });
  }
  console.log('======================================================\n');
});
