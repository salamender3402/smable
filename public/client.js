// ==========================================
// 서양음악사 브루마블 - 실시간 클라이언트 모듈 (client.js)
// ==========================================

const socket = io();

// Client State
let myPlayerIndex = null;
let myRoomCode = null;
let currentRoom = null;
let isMoving = false;
let audioEnabled = true;
let audioCtx = null;
let quizTimerInterval = null;
let warpTargetSelected = null;
let tollModalTimeout = null;
let previousPlayerGold = [1500, 1500, 1500, 1500];
let isCameraZoomedOutForWarp = false;
let isCameraZoomedIn = false;
let pendingMoveData = null;

// 3D Visual player token animation positions
const playerVisualPositions = [
  { x: null, y: null, targetX: null, targetY: null, isAnimating: false, animId: null, startTime: 0 },
  { x: null, y: null, targetX: null, targetY: null, isAnimating: false, animId: null, startTime: 0 },
  { x: null, y: null, targetX: null, targetY: null, isAnimating: false, animId: null, startTime: 0 },
  { x: null, y: null, targetX: null, targetY: null, isAnimating: false, animId: null, startTime: 0 }
];

// BGM State
const bgmPlayer = new Audio();
const bgmPlaylist = ["/bgm/bgm.mp3"];
let currentBgmIndex = 0;

// Lobby DOM Elements
const lobbyScreen = document.getElementById("lobby-screen");
const lobbyStep1 = document.getElementById("lobby-step-1");
const lobbyStep2 = document.getElementById("lobby-step-2");
const nameInput = document.getElementById("player-name-input");
const createRoomBtn = document.getElementById("create-room-btn");
const roomCodeInput = document.getElementById("room-code-input");
const joinRoomBtn = document.getElementById("join-room-btn");
const displayRoomCode = document.getElementById("display-room-code");
const connectedCount = document.getElementById("connected-count");
const lobbyPlayersList = document.getElementById("lobby-players-list");
const startGameBtn = document.getElementById("start-game-btn");
const waitingHostMsg = document.getElementById("waiting-host-msg");

// Game Board DOM Elements
const gameScreen = document.getElementById("game-screen");
const headerRoomCode = document.getElementById("header-room-code");
const currentTurnEl = document.getElementById("current-turn");
const activePlayerNameEl = document.getElementById("active-player-name");
const rollBtn = document.getElementById("roll-btn");
const warpActionBtn = document.getElementById("warp-action-btn");
const rollResultTextEl = document.getElementById("roll-result-text");
const consoleLogsEl = document.getElementById("console-logs");
const toggleSoundBtn = document.getElementById("toggle-sound-btn");

// Chat DOM Elements
const chatMessagesBox = document.getElementById("chat-messages-box");
const chatSendForm = document.getElementById("chat-send-form");
const chatTextInput = document.getElementById("chat-text-input");

// Modals
const audioStartModal = document.getElementById("audio-start-modal");
const audioAcceptBtn = document.getElementById("audio-accept-btn");
const quizModal = document.getElementById("quiz-modal");
const purchaseModal = document.getElementById("purchase-modal");
const tollModal = document.getElementById("toll-modal");
const chanceModal = document.getElementById("chance-modal");
const warpOverlay = document.getElementById("warp-overlay");
const gameOverModal = document.getElementById("game-over-modal");

// 1. WEB AUDIO SYNTHESIZER (클라이언트 오디오 합성)
// BGM Control Functions
function playNextBgm() {
  if (bgmPlaylist.length === 0) return;
  bgmPlayer.src = bgmPlaylist[currentBgmIndex];
  bgmPlayer.load();
  bgmPlayer.volume = 0.20; // 20% volume is perfect for background music
  bgmPlayer.play().catch(e => {
    console.log("BGM autoplay blocked or interrupted:", e);
  });
  currentBgmIndex = (currentBgmIndex + 1) % bgmPlaylist.length;
}

bgmPlayer.addEventListener("ended", playNextBgm);

function updateBgmState() {
  if (!bgmPlayer) return;

  let shouldMute = !audioEnabled;

  // Mute BGM if player is trapped in 4'33" room
  if (currentRoom && myPlayerIndex !== null) {
    const me = currentRoom.players[myPlayerIndex];
    if (me && me.isTrapped) {
      shouldMute = true;
    }
  }

  if (shouldMute) {
    bgmPlayer.muted = true;
  } else {
    bgmPlayer.muted = false;
    if (bgmPlayer.paused && audioEnabled) {
      if (!bgmPlayer.src) {
        playNextBgm();
      } else {
        bgmPlayer.play().catch(e => console.log("BGM play failed:", e));
      }
    }
  }
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (audioEnabled) {
    updateBgmState();
  }
}

function playSynthSound(type) {
  if (!audioEnabled || !audioCtx) return;

  // Mute audio if this client player is trapped in 4'33" room
  if (currentRoom && myPlayerIndex !== null) {
    const me = currentRoom.players[myPlayerIndex];
    if (me && me.isTrapped) return;
  }

  const dest = audioCtx.destination;

  switch (type) {
    case "roll": {
      let time = audioCtx.currentTime;
      for (let i = 0; i < 8; i++) {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(100 + Math.random() * 400, time);
        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(time);
        osc.stop(time + 0.08);
        time += 0.05;
      }
      break;
    }
    case "step": {
      let osc = audioCtx.createOscillator();
      let gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
      break;
    }
    case "success": {
      let notes = [261.63, 329.63, 392.00, 523.25];
      let time = audioCtx.currentTime;
      notes.forEach((freq, idx) => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time + idx * 0.1);
        gain.gain.setValueAtTime(0.08, time + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.1 + 0.15);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(time + idx * 0.1);
        osc.stop(time + idx * 0.1 + 0.2);
      });
      break;
    }
    case "fail": {
      let osc = audioCtx.createOscillator();
      let gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(90, audioCtx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
      break;
    }
    case "warp": {
      let osc = audioCtx.createOscillator();
      let gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.55);
      break;
    }
    case "dissonance": {
      let freqs = [311.13, 329.63, 349.23, 369.99];
      let time = audioCtx.currentTime;
      freqs.forEach((freq) => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.03, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(time);
        osc.stop(time + 0.4);
      });
      break;
    }
    case "landmark": {
      let fanfare = [
        { freq: 392.00, start: 0, dur: 0.15 },
        { freq: 392.00, start: 0.15, dur: 0.15 },
        { freq: 523.25, start: 0.3, dur: 0.3 },
        { freq: 659.25, start: 0.6, dur: 0.3 },
        { freq: 783.99, start: 0.9, dur: 0.5 }
      ];
      let time = audioCtx.currentTime;
      fanfare.forEach((n) => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(n.freq, time + n.start);
        gain.gain.setValueAtTime(0.1, time + n.start);
        gain.gain.exponentialRampToValueAtTime(0.001, time + n.start + n.dur);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(time + n.start);
        osc.stop(time + n.start + n.dur + 0.05);
      });
      break;
    }
  }
}

// 2. LOBBY EVENT HANDLERS
audioAcceptBtn.addEventListener("click", () => {
  initAudio();
  audioStartModal.classList.remove("active");
});

toggleSoundBtn.addEventListener("click", () => {
  audioEnabled = !audioEnabled;
  if (audioEnabled) {
    toggleSoundBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    initAudio();
  } else {
    toggleSoundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
  }
  updateBgmState();
});

// Create Room Action
createRoomBtn.addEventListener("click", () => {
  const playerName = nameInput.value.trim();
  if (!playerName) {
    alert("닉네임을 입력해 주세요.");
    return;
  }
  initAudio();
  socket.emit("createRoom", { playerName });
});

// Join Room Action
joinRoomBtn.addEventListener("click", () => {
  const playerName = nameInput.value.trim();
  const roomCode = roomCodeInput.value.trim();
  if (!playerName) {
    alert("닉네임을 입력해 주세요.");
    return;
  }
  if (!roomCode || roomCode.length !== 4) {
    alert("올바른 4자리 방 코드를 입력해 주세요.");
    return;
  }
  initAudio();
  socket.emit("joinRoom", { playerName, roomCode });
});

// Start Game (Host only)
startGameBtn.addEventListener("click", () => {
  if (myRoomCode) {
    socket.emit("startGame", { roomCode: myRoomCode });
  }
});

// Receive Join Success
socket.on("joinSuccess", ({ roomCode, playerIndex }) => {
  myRoomCode = roomCode;
  myPlayerIndex = playerIndex;
  isRollPending = false; // Reset lock on join
  
  displayRoomCode.innerText = roomCode;
  headerRoomCode.innerText = roomCode;

  // Toggle Step
  lobbyStep1.classList.remove("active");
  lobbyStep2.classList.add("active");
});

socket.on("joinError", (errorMsg) => {
  alert(errorMsg);
});

// 3. GAME RUNTIME LOBBY & BOARD SYNC
socket.on("roomStateUpdate", (room) => {
  currentRoom = room;
  
  // A. If game started, switch to game layout
  if (room.gameState.status === "playing") {
    lobbyScreen.classList.remove("active");
    gameScreen.classList.add("active");
    
    // Render current active player details
    const activeP = room.players[room.gameState.activePlayerIdx];
    activePlayerNameEl.innerText = activeP.name;

    // Enable/Disable dice roll controls for this client
    const isMyTurn = room.gameState.activePlayerIdx === myPlayerIndex;
    if (!isMyTurn && !isMoving && !pendingMoveData) {
      isMoving = false;
    }
    
    if (!isMoving && !pendingMoveData) {
      if (isMyTurn) {
        if (activeP.hasWarpPending) {
          rollBtn.classList.add("hidden");
          warpActionBtn.classList.remove("hidden");
        } else {
          rollBtn.classList.remove("hidden");
          warpActionBtn.classList.add("hidden");
          rollBtn.disabled = false;
          rollBtn.innerHTML = `<span class="btn-shine"></span><span class="btn-text">주사위 굴리기</span>`;
          rollResultTextEl.innerText = "당신의 차례입니다! 주사위를 던지세요.";
        }
      } else {
        rollBtn.classList.remove("hidden");
        warpActionBtn.classList.add("hidden");
        rollBtn.disabled = true;
        rollBtn.innerHTML = `<span class="btn-shine"></span><span class="btn-text">주사위 굴리기</span>`;
        rollResultTextEl.innerText = `${activeP.name} 님의 차례입니다.`;
      }
    }
  }

  // B. Render Lobby lists (Step 2 waiting area)
  connectedCount.innerText = room.players.length;
  lobbyPlayersList.innerHTML = "";
  
  room.players.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "lobby-player-row";
    
    let avatarClass = "avatar-red";
    if (idx === 1) avatarClass = "avatar-cyan";
    if (idx === 2) avatarClass = "avatar-yellow";
    if (idx === 3) avatarClass = "avatar-purple";

    row.innerHTML = `
      <div class="lobby-player-meta">
        <div class="lobby-avatar-icon ${avatarClass}"><i class="fa-solid ${p.avatar}"></i></div>
        <span class="lobby-player-name">${p.name}</span>
      </div>
      ${p.isHost ? '<span class="host-badge">방장 (Host)</span>' : ""}
    `;
    lobbyPlayersList.appendChild(row);
  });

  // Toggle Start button visibility for Host
  const me = room.players.find(p => p.socketId === socket.id);
  if (me && me.isHost) {
    startGameBtn.classList.remove("hidden");
    waitingHostMsg.classList.add("hidden");
    // Enable game starting only with 2 or more players
    startGameBtn.disabled = room.players.length < 2;
    startGameBtn.innerText = room.players.length < 2 ? "인원 대기 중 (최소 2명)" : "게임 시작하기";
  } else {
    startGameBtn.classList.add("hidden");
    waitingHostMsg.classList.remove("hidden");
  }

  // C. Sync Dashboard stats
  playersSyncDashboard(room);

  // D. Sync Board Tiles (ownership, levels)
  boardTilesSync(room);

  // Sync background music state (e.g., mute if trapped)
  updateBgmState();
});

// Synchronize Player dashboards
function playersSyncDashboard(room) {
  currentTurnEl.innerText = room.gameState.turnCount;

  // Iterate 4 slots P0-P3
  for (let i = 0; i < 4; i++) {
    const panel = document.getElementById(`panel-p${i}`);
    
    if (i < room.players.length) {
      // Show card and update values
      panel.classList.remove("hidden");
      
      const p = room.players[i];
      let nameHTML = p.name;
      if (i === myPlayerIndex) {
        nameHTML += ` <span class="me-badge">나</span>`;
      }
      if (p.isOffline) {
        nameHTML += ` <span class="offline-badge">오프라인</span>`;
        panel.style.opacity = "0.55";
      } else {
        panel.style.opacity = "1.0";
      }
      document.getElementById(`p${i}-name`).innerHTML = nameHTML;
      
      // Calculate gold change and trigger animation
      const oldGold = previousPlayerGold[i] !== undefined ? previousPlayerGold[i] : p.gold;
      if (p.gold !== oldGold) {
        triggerGoldChangeAnimation(i, p.gold - oldGold);
      }
      previousPlayerGold[i] = p.gold;

      document.getElementById(`p${i}-gold`).innerText = p.gold.toLocaleString();

      // calculate estate value
      let estateVal = 0;
      p.properties.forEach((tileIdx) => {
        const tile = room.gameState.boardTiles[tileIdx];
        estateVal += tile.price + (tile.level - 1) * tile.upgradePrice;
      });
      const total = p.gold + estateVal;
      document.getElementById(`p${i}-total`).innerText = total.toLocaleString();

      // Sync Trap badge
      const trapBadge = document.getElementById(`p${i}-trap-badge`);
      const trapTurnsSpan = document.getElementById(`p${i}-trap-turns`);
      if (p.isTrapped) {
        trapBadge.classList.remove("hidden");
        trapTurnsSpan.innerText = p.trappedTurns;
      } else {
        trapBadge.classList.add("hidden");
      }

      // Sync Warp badge
      const warpBadge = document.getElementById(`p${i}-warp-badge`);
      if (p.hasWarpPending) {
        warpBadge.classList.remove("hidden");
      } else {
        warpBadge.classList.add("hidden");
      }

      // Active player panel outline
      panel.className = `player-panel player-${i}-panel`;
      if (room.gameState.activePlayerIdx === i) {
        panel.classList.add("active");
        panel.classList.add(`active-p${i}`);
      }
    } else {
      // Hide card
      panel.classList.add("hidden");
    }
  }
}

// Synchronize board tiles
function boardTilesSync(room) {
  room.gameState.boardTiles.forEach((tile) => {
    // Sync slots built
    for (let lv = 1; lv <= 4; lv++) {
      const slotEl = document.querySelector(`[data-index="${tile.index}"] .landmark-slots .slot[data-lv="${lv}"]`);
      if (slotEl) {
        if (tile.level >= lv) {
          slotEl.classList.add("built");
        } else {
          slotEl.classList.remove("built");
        }
      }
    }

    // Sync ownership flag colors
    const flag = document.querySelector(`[data-index="${tile.index}"] .owner-flag`);
    if (flag) {
      if (tile.owner !== null) {
        flag.className = `owner-flag owner-p${tile.owner}`;
      } else {
        flag.className = "owner-flag";
      }
    }

    // Sync tile owner borders
    const tileEl = document.querySelector(`.tile[data-index="${tile.index}"]`);
    if (tileEl) {
      tileEl.classList.remove("tile-owner-p0", "tile-owner-p1", "tile-owner-p2", "tile-owner-p3");
      if (tile.owner !== null) {
        tileEl.classList.add(`tile-owner-p${tile.owner}`);
      }
    }
  });

  // Sync token places
  updateTokenDisplay(room);
}

// Helper: Calculate dynamic multiplier based on rounds (turnCount) to manage gold inflation
function getRoundMultiplier(turnCount) {
  if (!turnCount || turnCount <= 9) return 1.0;
  if (turnCount <= 14) {
    // Round 10 to 14: scale from 1.2 to 2.0
    return 1.0 + (turnCount - 9) * 0.2;
  }
  // Round 15+: scale from 2.0 + 0.45 per round (2.45 at Rd 15, 4.70 at Rd 20)
  return 2.0 + (turnCount - 14) * 0.45;
}

// Helper: Map tile positions (0-31) to 9x9 CSS Grid Row and Column
function getTileGridCoords(index) {
  let row = 9;
  let col = 9;
  if (index >= 0 && index <= 8) {
    row = 9;
    col = 9 - index;
  } else if (index >= 8 && index <= 16) {
    row = 9 - (index - 8);
    col = 1;
  } else if (index >= 16 && index <= 24) {
    row = 1;
    col = 1 + (index - 16);
  } else if (index >= 24 && index <= 31) {
    row = 1 + (index - 24);
    col = 9;
  }
  return { row, col };
}

// Helper: Calculate center coordinates of a tile relative to game-board container with player offset
function getTileCenterCoordinates(position, playerIndex) {
  const boardEl = document.getElementById("game-board");
  if (!boardEl) return { x: 0, y: 0 };

  const w = boardEl.offsetWidth || 760;
  const h = boardEl.offsetHeight || 760;

  const coords = getTileGridCoords(position);
  let x = ((coords.col - 0.5) / 9) * w;
  let y = ((coords.row - 0.5) / 9) * h;

  // Add offset to avoid direct overlapping of multiple players on same tile
  const offsetX = (playerIndex % 2 === 0 ? -9 : 9);
  const offsetY = (playerIndex < 2 ? -9 : 9) + 4;

  return { x: x + offsetX, y: y + offsetY };
}

// Camera control: Zoom and pan to focus on the active player
function updateCamera(room, positionOverride) {
  const boardEl = document.getElementById("game-board");
  if (!boardEl) {
    console.warn("[Camera] game-board element not found!");
    return;
  }

  console.log("[Camera] updateCamera called. warp:", isCameraZoomedOutForWarp, "room:", !!room);

  if (isCameraZoomedOutForWarp || !room || room.gameState.status !== "playing" || !isCameraZoomedIn) {
    console.log("[Camera] Zooming out to default (1.0x). reason: warp=" + isCameraZoomedOutForWarp + ", status=" + (room ? room.gameState.status : "N/A") + ", zoomedIn=" + isCameraZoomedIn);
    boardEl.style.transform = "scale(1) translate(0%, 0%)";
    return;
  }

  const activeIdx = room.gameState.activePlayerIdx;
  if (activeIdx === undefined || activeIdx === null) {
    console.log("[Camera] Zooming out to default (1.0x). reason: activeIdx is null");
    boardEl.style.transform = "scale(1) translate(0%, 0%)";
    return;
  }

  const activeP = room.players[activeIdx];
  if (!activeP) {
    console.log("[Camera] Zooming out to default (1.0x). reason: activeP is null");
    boardEl.style.transform = "scale(1) translate(0%, 0%)";
    return;
  }

  const position = positionOverride !== undefined ? positionOverride : activeP.position;

  // Center on active player's current visual coordinate if animating, otherwise center on tile
  const visual = playerVisualPositions[activeIdx];
  let fx, fy;
  if (visual && visual.x !== null && visual.isAnimating) {
    const w = boardEl.offsetWidth || 760;
    const h = boardEl.offsetHeight || 760;
    fx = visual.x / w;
    fy = visual.y / h;
    console.log("[Camera] Centering on animating token:", visual.x, visual.y, "fx:", fx, "fy:", fy);
  } else {
    const coords = getTileGridCoords(position);
    fx = (coords.col - 0.5) / 9;
    fy = (coords.row - 0.5) / 9;
    console.log("[Camera] Centering on static tile index:", position, "coords:", coords, "fx:", fx, "fy:", fy);
  }

  // Camera zoom math: translate the target point to (0.5, 0.5) and scale by 1.35
  const tx = (0.5 - fx) * 100;
  const ty = (0.5 - fy) * 100;

  const transformStr = `scale(1.35) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
  console.log("[Camera] Applying transform:", transformStr);
  boardEl.style.transform = transformStr;
}

// Helper: Triggers requestAnimationFrame parabolic jump for player tokens
function triggerTokenJump(playerIndex, startPosition, endPosition) {
  const visual = playerVisualPositions[playerIndex];
  const tokenEl = document.getElementById(`token-3d-${playerIndex}`);
  if (!tokenEl) return;

  // Cancel any existing animation frame
  if (visual.animId) {
    cancelAnimationFrame(visual.animId);
  }

  visual.isAnimating = true;

  // Starting visual coordinates (interrupted mid-movement or starting from startPosition)
  const startX = visual.x !== null ? visual.x : getTileCenterCoordinates(startPosition, playerIndex).x;
  const startY = visual.y !== null ? visual.y : getTileCenterCoordinates(startPosition, playerIndex).y;

  // Target end coordinates
  const targetCoords = getTileCenterCoordinates(endPosition, playerIndex);
  const endX = targetCoords.x;
  const endY = targetCoords.y;

  const jumpDuration = 250; // 250ms jump duration
  const bounceDuration = 100; // 100ms bounce-out cushion duration
  const totalDuration = jumpDuration + bounceDuration;
  const maxJumpHeight = 45; // Max visual elevation height in pixels

  const startTime = performance.now();
  visual.startTime = startTime;

  // Play "step" sound exactly at 120ms (peak of the jump)
  setTimeout(() => {
    // Verify player is still jumping and it's the exact same jump animation
    if (visual.isAnimating && visual.startTime === startTime) {
      playSynthSound("step");
    }
  }, 120);

  function tick(now) {
    const elapsed = now - startTime;

    if (elapsed >= totalDuration) {
      // Completed animation sequence
      visual.x = endX;
      visual.y = endY;
      visual.isAnimating = false;
      visual.animId = null;

      tokenEl.style.left = `${endX}px`;
      tokenEl.style.top = `${endY}px`;
      tokenEl.style.transform = `translate(-50%, -100%)`;

      updateCamera(currentRoom);
      callback();
      return;
    }

    let x = endX;
    let y = endY;
    let z = 0;

    if (elapsed < jumpDuration) {
      // 1. Parabolic jump phase (Sine wave)
      const p = elapsed / jumpDuration;
      x = startX + (endX - startX) * p;
      y = startY + (endY - startY) * p;
      z = Math.sin(p * Math.PI) * maxJumpHeight;
    } else {
      // 2. Bounce out landing cushion phase (Decaying Sine wave)
      const bp = (elapsed - jumpDuration) / bounceDuration;
      const decay = 1 - bp;
      z = -Math.sin(bp * Math.PI) * 6 * decay; // bounce squish downwards
    }

    // Keep visual representation coordinates updated
    visual.x = x;
    visual.y = y;

    tokenEl.style.left = `${x}px`;
    tokenEl.style.top = `${y}px`;
    tokenEl.style.transform = `translate(-50%, -100%) translateY(${-z}px)`;

    updateCamera(currentRoom);

    visual.animId = requestAnimationFrame(tick);
  }

  visual.animId = requestAnimationFrame(tick);
}

// Render player tokens on board (Supports 3D coordinates + image 에셋)
function updateTokenDisplay(room) {
  // Clear previous 2D player lists inside tiles
  for (let i = 0; i < 32; i++) {
    const container = document.getElementById(`tile-players-${i}`);
    if (container) container.innerHTML = "";
  }

  const boardEl = document.getElementById("game-board");
  if (!boardEl) return;

  // First, hide all 3D tokens
  for (let i = 0; i < 4; i++) {
    const tokenEl = document.getElementById(`token-3d-${i}`);
    if (tokenEl) tokenEl.style.display = "none";
  }

  // Draw connected tokens on board
  room.players.forEach((p, idx) => {
    let tokenEl = document.getElementById(`token-3d-${idx}`);
    if (!tokenEl) {
      tokenEl = document.createElement("div");
      tokenEl.id = `token-3d-${idx}`;
      tokenEl.className = `token-3d token-3d-p${idx}`;
      
      const innerEl = document.createElement("div");
      innerEl.className = "token-3d-inner";
      tokenEl.appendChild(innerEl);

      const nameplateEl = document.createElement("div");
      nameplateEl.className = "token-nameplate";
      tokenEl.appendChild(nameplateEl);
      
      boardEl.appendChild(tokenEl);
    }

    tokenEl.title = p.name;
    tokenEl.style.display = "block"; // Make sure present players have visible tokens

    // Toggle active-turn class for highlight glow (no scaling)
    if (room.gameState.activePlayerIdx === idx) {
      tokenEl.classList.add("active-turn");
    } else {
      tokenEl.classList.remove("active-turn");
    }

    // Update nameplate text (P1: Nickname)
    let nameplateEl = tokenEl.querySelector(".token-nameplate");
    if (!nameplateEl) {
      nameplateEl = document.createElement("div");
      nameplateEl.className = "token-nameplate";
      tokenEl.appendChild(nameplateEl);
    }
    nameplateEl.innerText = `P${idx + 1}: ${p.name}`;

    const tileCoords = getTileCenterCoordinates(p.position, idx);
    const visual = playerVisualPositions[idx];

    if (visual.x === null) {
      // Initialize starting position immediately without visual jumps
      visual.x = tileCoords.x;
      visual.y = tileCoords.y;
      tokenEl.style.left = `${tileCoords.x}px`;
      tokenEl.style.top = `${tileCoords.y}px`;
      tokenEl.style.transform = `translate(-50%, -100%)`;
    } else if (!visual.isAnimating) {
      // Snap to tile center coordinates if not in step-by-step jump mode
      visual.x = tileCoords.x;
      visual.y = tileCoords.y;
      tokenEl.style.left = `${tileCoords.x}px`;
      tokenEl.style.top = `${tileCoords.y}px`;
      tokenEl.style.transform = `translate(-50%, -100%)`;
    }
  });

  // Focus camera on the active player
  updateCamera(room);
}

// 4. DICE ROLL TRIGGER WITH POWER GAUGE
let isCharging = false;
let chargeValue = 0;
let chargeDirection = 1;
let lastTime = 0;
let isRollPending = false; // Prevent double rolls
let isTouchDevice = false; // Bypass mouse events emulation on touch devices

function startCharging() {
  if (isMoving || pendingMoveData || isRollPending) return;
  if (!currentRoom) return;
  
  const activeP = currentRoom.players[currentRoom.gameState.activePlayerIdx];
  // Verify it is indeed this player's turn and they are not trapped (trapped has confirm alert)
  if (currentRoom.gameState.activePlayerIdx !== myPlayerIndex) return;
  if (activeP.isTrapped) return;

  isCharging = true;
  chargeValue = 0;
  chargeDirection = 1;
  lastTime = performance.now();

  const gaugeContainer = document.getElementById("gauge-container");
  if (gaugeContainer) {
    gaugeContainer.style.opacity = "1";
  }
  const gaugeLabelText = document.getElementById("gauge-label-text");
  if (gaugeLabelText) {
    gaugeLabelText.innerText = "파워 충전 중...";
  }

  requestAnimationFrame(chargeLoop);
}

function stopChargingAndRoll() {
  if (!isCharging) return;
  isCharging = false;

  isRollPending = true; // Lock roll request

  const gaugeContainer = document.getElementById("gauge-container");
  if (gaugeContainer) {
    gaugeContainer.style.opacity = "0.6";
  }
  const gaugeLabelText = document.getElementById("gauge-label-text");
  if (gaugeLabelText) {
    gaugeLabelText.innerText = "주사위 파워 게이지";
  }

  // Emit rollDice with power!
  socket.emit("rollDice", { roomCode: myRoomCode, power: chargeValue / 100 });
}

function chargeLoop(time) {
  if (!isCharging) return;

  const delta = time - lastTime;
  lastTime = time;

  const speed = 0.15; // 0.15% per millisecond
  chargeValue += chargeDirection * speed * delta;

  if (chargeValue >= 100) {
    chargeValue = 100;
    chargeDirection = -1;
  } else if (chargeValue <= 0) {
    chargeValue = 0;
    chargeDirection = 1;
  }

  const gaugeText = document.getElementById("gauge-text");
  const gaugeBar = document.getElementById("gauge-bar");
  if (gaugeText) gaugeText.innerText = Math.round(chargeValue);
  if (gaugeBar) gaugeBar.style.width = `${chargeValue}%`;

  requestAnimationFrame(chargeLoop);
}

// Bind charging events
rollBtn.addEventListener("mousedown", (e) => {
  if (isTouchDevice) return; // Skip mouse events on touch devices
  if (e.button !== 0) return; // Only left click
  startCharging();
});

rollBtn.addEventListener("touchstart", (e) => {
  isTouchDevice = true; // Mark as touch device to block emulator events
  startCharging();
});

window.addEventListener("mouseup", () => {
  if (isTouchDevice) {
    // Reset touch flag after a short timeout for hybrid screen users
    setTimeout(() => { isTouchDevice = false; }, 500);
    return;
  }
  stopChargingAndRoll();
});

window.addEventListener("touchend", () => {
  isTouchDevice = true;
  stopChargingAndRoll();
});

rollBtn.addEventListener("click", (e) => {
  if (pendingMoveData) return; // Managed by dynamic move click handler

  if (currentRoom) {
    const activeP = currentRoom.players[currentRoom.gameState.activePlayerIdx];
    
    // If trapped, double check escapes (click is handled here because confirm is synchronous)
    if (activeP.isTrapped && currentRoom.gameState.activePlayerIdx === myPlayerIndex) {
      if (isRollPending) return; // Prevent double escape trigger
      const payEscape = confirm(`${activeP.name}은(는) 절대 0도의 방에 갇혀 있습니다.\n100 골드를 내고 즉시 탈출하시겠습니까?\n[취소] 클릭 시 주사위 더블(동일 숫자) 탈출을 시도합니다. (남은 감옥 대기 턴: ${activeP.trappedTurns}턴)`);
      isRollPending = true; // Lock roll request
      if (payEscape && activeP.gold >= 100) {
        socket.emit("payTrapEscape", { roomCode: myRoomCode });
      } else {
        socket.emit("rollTrapEscape", { roomCode: myRoomCode });
      }
      return;
    }

    // Normal rolls are triggered by mouseup/touchend, so we do nothing here to prevent double rolls!
  }
});

// Escape success callback, roll next immediately
socket.on("trapEscapeSuccess", () => {
  isRollPending = true;
  socket.emit("rollDice", { roomCode: myRoomCode });
});

// Sync Dice roll visual
socket.on("diceRolled", ({ playerIndex, rolls, total, isDouble, newPosition, passedStart, isEscapeRoll }) => {
  isRollPending = false; // Reset lock on response
  isMoving = true;
  rollBtn.disabled = true;
  playSynthSound("roll");

  // Save pending move data for synchronization
  pendingMoveData = { playerIndex, rolls, total, isDouble, newPosition, passedStart, isEscapeRoll };

  // Spin Dice animation
  const dice1 = document.getElementById("dice-1");
  const dice2 = document.getElementById("dice-2");
  dice1.classList.add("rolling");
  dice2.classList.add("rolling");

  setTimeout(() => {
    dice1.classList.remove("rolling");
    dice2.classList.remove("rolling");

    setDiceFace(dice1, rolls[0]);
    setDiceFace(dice2, rolls[1]);

    const p = currentRoom.players[playerIndex];
    rollResultTextEl.innerText = `주사위 결과: ${rolls[0]} + ${rolls[1]} = ${total}`;

    const setupMoveConfirmation = () => {
      // Highlight target tile
      const targetTileEl = document.querySelector(`.tile[data-index="${newPosition}"]`);
      if (targetTileEl) {
        targetTileEl.classList.add("landing-pending-highlight");
      }

      if (playerIndex === myPlayerIndex) {
        rollBtn.disabled = false;
        rollBtn.innerHTML = `<span class="btn-shine"></span><span class="btn-text">이동하기</span>`;
        rollResultTextEl.innerText = "목적지가 표시되었습니다. '이동하기' 버튼이나 대상 칸을 클릭하여 이동하세요.";

        const onMoveClick = () => {
          rollBtn.disabled = true;
          rollBtn.innerHTML = `<span class="btn-shine"></span><span class="btn-text">주사위 굴리기</span>`;
          rollBtn.removeEventListener("click", onMoveClick);
          if (targetTileEl) {
            targetTileEl.onclick = null;
          }
          socket.emit("confirmMove", { roomCode: myRoomCode });
        };
        rollBtn.addEventListener("click", onMoveClick);

        if (targetTileEl) {
          targetTileEl.onclick = () => {
            rollBtn.disabled = true;
            rollBtn.innerHTML = `<span class="btn-shine"></span><span class="btn-text">주사위 굴리기</span>`;
            rollBtn.removeEventListener("click", onMoveClick);
            targetTileEl.onclick = null;
            socket.emit("confirmMove", { roomCode: myRoomCode });
          };
        }
      } else {
        rollBtn.disabled = true;
        rollBtn.innerHTML = `<span class="btn-shine"></span><span class="btn-text">${p.name} 이동 대기 중...</span>`;
        rollResultTextEl.innerText = `${p.name} 님이 이동을 시작하기를 기다리고 있습니다.`;
      }
    };

    if (isEscapeRoll) {
      if (isDouble) {
        rollResultTextEl.innerText += " (더블! 탈출 성공)";
        isCameraZoomedIn = true;
        updateCamera(currentRoom);
        animateSteps(playerIndex, total, false, () => {
          isMoving = false;
          isCameraZoomedIn = false;
          updateCamera(currentRoom);
        });
      } else {
        rollResultTextEl.innerText += " (탈출 실패)";
        isMoving = false;
      }
      pendingMoveData = null;
      return;
    }

    if (isDouble) {
      rollResultTextEl.innerText += " (더블!)";
      
      // Show double alert modal for 1.8s
      const doubleModal = document.getElementById("double-alert-modal");
      if (doubleModal) {
        doubleModal.classList.add("active");
        playSynthSound("success");
        setTimeout(() => {
          doubleModal.classList.remove("active");
          setupMoveConfirmation();
        }, 1800);
      } else {
        setupMoveConfirmation();
      }
    } else {
      setupMoveConfirmation();
    }

  }, 600);
});

function setDiceFace(cubeEl, value) {
  const rotMap = {
    1: "rotateY(0deg) rotateX(0deg)",
    2: "rotateY(180deg) rotateX(0deg)",
    3: "rotateY(-90deg) rotateX(0deg)",
    4: "rotateY(90deg) rotateX(0deg)",
    5: "rotateX(-90deg) rotateY(0deg)",
    6: "rotateX(90deg) rotateY(0deg)"
  };
  cubeEl.style.transform = `translateZ(-20px) ${rotMap[value]}`;
}

// Movement confirmed by active player, start animation for all clients
socket.on("moveConfirmed", () => {
  if (!pendingMoveData) return;
  const { playerIndex, rolls, total, isDouble, newPosition, passedStart, isEscapeRoll } = pendingMoveData;
  pendingMoveData = null; // Reset pending move data

  // Clear highlight
  document.querySelectorAll(".tile").forEach((el) => {
    el.classList.remove("landing-pending-highlight");
  });

  // Zoom in camera to follow
  isCameraZoomedIn = true;
  updateCamera(currentRoom);

  // Animate step-by-step
  animateSteps(playerIndex, total, passedStart, () => {
    isMoving = false;
    
    // Zoom out camera when movement is finished
    isCameraZoomedIn = false;
    updateCamera(currentRoom);

    // Only active player client emits landing complete to server
    if (playerIndex === myPlayerIndex) {
      socket.emit("clientFinishedMoving", { roomCode: myRoomCode });
    }
  });
});

// Step-by-step local animation (Ting-ting parabolic jump mode)
function animateSteps(playerIndex, steps, passedStart, callback) {
  const p = currentRoom.players[playerIndex];
  let currentSteps = 0;
  const direction = steps >= 0 ? 1 : -1;
  const totalSteps = Math.abs(steps);

  function takeStep() {
    if (currentSteps >= totalSteps) {
      callback();
      return;
    }

    const startPosition = p.position;
    p.position = (p.position + direction + 32) % 32;
    const endPosition = p.position;
    currentSteps++;

    // Trigger the parabolic 3D Tween jump!
    triggerTokenJump(playerIndex, startPosition, endPosition);

    // Visual START warning check (START index is 0)
    if (direction === 1 && p.position === 0 && passedStart) {
      setTimeout(() => {
        playSynthSound("success");
      }, 250); // Play success chime when landing on start
    }

    setTimeout(takeStep, 250);
  }

  takeStep();
}

// 5. LAND RESOLUTION POPUP ROUTER
socket.on("triggerTileAction", ({ tile }) => {
  // If not my turn, we don't open modals, just wait
  const isMyTurn = currentRoom.gameState.activePlayerIdx === myPlayerIndex;
  if (!isMyTurn) return;

  switch (tile.type) {
    case "start":
      // Lands exactly on START -> notify server directly to switch turns
      socket.emit("declineBuy", { roomCode: myRoomCode });
      break;

    case "trap":
      // Land on감옥
      socket.emit("landTrapRoom", { roomCode: myRoomCode });
      break;

    case "warp": {
      // Bypass warp land confirmation modal, emit immediately
      socket.emit("landWarpMachine", { roomCode: myRoomCode });
      break;
    }

    case "chance":
      // Emits card draw request
      socket.emit("drawChance", { roomCode: myRoomCode });
      break;

    case "chance-corner":
      // Emits special card draw request
      socket.emit("drawSpecialCard", { roomCode: myRoomCode });
      break;

    case "music":
      if (tile.owner === null) {
        triggerQuizModal(tile);
      } else if (tile.owner === myPlayerIndex) {
        if (tile.level < 4) {
          triggerUpgradeModal(tile);
        } else {
          socket.emit("declineBuy", { roomCode: myRoomCode });
        }
      } else {
        if (tollModalTimeout) {
          clearTimeout(tollModalTimeout);
          tollModalTimeout = null;
        }
        // Show toll modal to active player for click confirmation
        const owner = currentRoom.players[tile.owner];
        document.getElementById("toll-prop-name").innerText = tile.name;
        document.getElementById("toll-owner-name").innerText = owner.name;
        const lvNames = ["공터", "간이 연구소", "지역 센터", "국립 과학관", "에너지 메가 돔 (랜드마크)"];
        document.getElementById("toll-prop-level").innerText = lvNames[tile.level];
        // Apply round multiplier to the toll fee
        const turnCount = currentRoom.gameState.turnCount || 1;
        const roundMult = getRoundMultiplier(turnCount);
        const baseTollFee = tile.tolls[tile.level];
        const tollFee = Math.floor(baseTollFee * roundMult);
        document.getElementById("toll-fee").innerText = `${tollFee} Gold`;

        // Calculate takeover cost
        const originalValue = tile.price + (tile.level - 1) * tile.upgradePrice;
        let multiplier = 2.0;
        if (tile.level === 1) multiplier = 1.5;
        else if (tile.level === 3) multiplier = 2.5;
        
        // Apply round multiplier to takeover cost
        const takeoverCost = Math.floor(originalValue * multiplier * roundMult);
        document.getElementById("takeover-cost").innerText = `${takeoverCost} Gold`;

        const me = currentRoom.players[myPlayerIndex];
        document.getElementById("toll-my-gold").innerText = `${me.gold} Gold`;
        const takeoverInfoBox = document.getElementById("takeover-info-box");
        const payOnlyBtn = document.getElementById("toll-pay-only-btn");
        const takeoverBtn = document.getElementById("toll-takeover-btn");

        // Can takeover check: level < 4 and enough gold for BOTH toll and takeover
        const isLandmark = tile.level >= 4;
        const canAffordTakeover = me.gold >= (tollFee + takeoverCost);

        if (isLandmark) {
          if (takeoverInfoBox) takeoverInfoBox.classList.add("hidden");
          if (takeoverBtn) {
            takeoverBtn.classList.add("hidden");
          }
        } else {
          if (takeoverInfoBox) takeoverInfoBox.classList.remove("hidden");
          if (takeoverBtn) {
            takeoverBtn.classList.remove("hidden");
            if (canAffordTakeover) {
              takeoverBtn.disabled = false;
              takeoverBtn.innerText = "인수하기";
            } else {
              takeoverBtn.disabled = true;
              takeoverBtn.innerText = "골드 부족";
            }
          }
        }

        if (payOnlyBtn) {
          payOnlyBtn.disabled = false;
          payOnlyBtn.innerText = "통행료 납부";
          
          payOnlyBtn.onclick = () => {
            if (payOnlyBtn) payOnlyBtn.disabled = true;
            if (takeoverBtn) takeoverBtn.disabled = true;
            payOnlyBtn.innerText = "납부 중...";
            socket.emit("payTollOnly", { roomCode: myRoomCode, tileIndex: tile.index });
          };
        }

        if (takeoverBtn) {
          takeoverBtn.onclick = () => {
            if (payOnlyBtn) payOnlyBtn.disabled = true;
            if (takeoverBtn) takeoverBtn.disabled = true;
            takeoverBtn.innerText = "인수 중...";
            socket.emit("payTollAndTakeover", { roomCode: myRoomCode, tileIndex: tile.index });
          };
        }

        tollModal.classList.add("active");
      }
      break;
  }
});

// Dynamic arrival modal function
function triggerArrivalModal(tile) {
  const arrivalModal = document.getElementById("arrival-modal");
  const arrivalTitle = document.getElementById("arrival-title");
  const arrivalConfirmBtn = document.getElementById("arrival-confirm-btn");

  if (arrivalModal && arrivalTitle && arrivalConfirmBtn) {
    arrivalTitle.innerText = `[개념 기지] ${tile.name}`;
    arrivalModal.classList.add("active");
    playSynthSound("success");

    arrivalConfirmBtn.onclick = () => {
      arrivalModal.classList.remove("active");
      triggerQuizModal(tile);
    };
  } else {
    // Fallback directly to quiz modal if elements aren't found
    triggerQuizModal(tile);
  }
}

// A. 퀴즈 팝업 시스템 (Quiz Popup)
function triggerQuizModal(tile) {
  const trivia = tile.trivia;

  let eraK = "입자 운동 및 상태";
  if (tile.era === "classical") eraK = "열에너지 흡수";
  if (tile.era === "romantic") eraK = "열에너지 방출";
  if (tile.era === "modern") eraK = "상태 변화와 생활";

  const eraBadge = document.getElementById("quiz-tile-era");
  eraBadge.className = `badge era-badge-${tile.era}`;
  eraBadge.innerText = eraK;

  document.getElementById("quiz-tile-name").innerText = `[개념] ${tile.name}`;
  document.getElementById("quiz-question-text").innerText = trivia.question;

  const container = document.getElementById("quiz-options-container");
  container.innerHTML = "";

  document.getElementById("quiz-feedback").className = "quiz-result-feedback hidden";
  const confirmBtn = document.getElementById("quiz-confirm-btn");
  confirmBtn.classList.add("hidden");

  // Options buttons (shuffled randomly using Fisher-Yates)
  const shuffledOptions = [...trivia.options];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffledOptions[i];
    shuffledOptions[i] = shuffledOptions[j];
    shuffledOptions[j] = temp;
  }

  shuffledOptions.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerText = opt;
    btn.onclick = () => handleQuizSubmission(btn, opt, trivia.answer, tile);
    container.appendChild(btn);
  });

  quizModal.classList.add("active");

  // Timer 15s
  const progress = document.getElementById("quiz-timer-progress");
  progress.style.transition = "none";
  progress.style.width = "100%";

  setTimeout(() => {
    progress.style.transition = "width 15s linear";
    progress.style.width = "0%";
  }, 50);

  let timeLeft = 15;
  clearInterval(quizTimerInterval);
  quizTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(quizTimerInterval);
      handleQuizTimeout();
    }
  }, 1000);
}

function handleQuizSubmission(selectedBtn, chosenOpt, correctAns, tile) {
  clearInterval(quizTimerInterval);
  document.getElementById("quiz-timer-progress").style.transition = "none";

  const buttons = document.querySelectorAll("#quiz-options-container .option-btn");
  buttons.forEach(b => b.disabled = true);

  const isCorrect = chosenOpt === correctAns;
  const feedback = document.getElementById("quiz-feedback");
  const confirmBtn = document.getElementById("quiz-confirm-btn");

  if (isCorrect) {
    selectedBtn.classList.add("correct-choice");
    feedback.className = "quiz-result-feedback correct";
    document.getElementById("quiz-feedback-title").innerText = "정답입니다! 🎉";
    document.getElementById("quiz-feedback-desc").innerText = "1단계 연구 기지(간이 연구소)를 무료로 즉시 건설할 수 있습니다!";
    playSynthSound("success");

    confirmBtn.onclick = () => {
      quizModal.classList.remove("active");
      socket.emit("buyProperty", { roomCode: myRoomCode, tileIndex: tile.index, level: 1, isFree: true });
    };
  } else {
    selectedBtn.classList.add("wrong-choice");
    buttons.forEach((b) => {
      if (b.innerText === correctAns) b.classList.add("correct-choice");
    });

    feedback.className = "quiz-result-feedback wrong";
    document.getElementById("quiz-feedback-title").innerText = "오답입니다... ❌";
    document.getElementById("quiz-feedback-desc").innerText = "오답 감점 페널티로 50골드를 지불하며 건설 권한이 상실됩니다.";
    playSynthSound("fail");

    confirmBtn.onclick = () => {
      quizModal.classList.remove("active");
      socket.emit("quizFailed", { roomCode: myRoomCode });
    };
  }

  confirmBtn.classList.remove("hidden");
}

function handleQuizTimeout() {
  const buttons = document.querySelectorAll("#quiz-options-container .option-btn");
  buttons.forEach(b => b.disabled = true);

  const feedback = document.getElementById("quiz-feedback");
  const confirmBtn = document.getElementById("quiz-confirm-btn");

  feedback.className = "quiz-result-feedback wrong";
  document.getElementById("quiz-feedback-title").innerText = "시간 초과! ⏰";
  document.getElementById("quiz-feedback-desc").innerText = "시간 제한(15초) 초과로 50골드 페널티 및 건설 권한 상실 처리됩니다.";
  playSynthSound("fail");

  confirmBtn.onclick = () => {
    quizModal.classList.remove("active");
    socket.emit("quizFailed", { roomCode: myRoomCode });
  };
  confirmBtn.classList.remove("hidden");
}

// B. 건설 업그레이드 모달
function triggerUpgradeModal(tile) {
  const nextLevel = tile.level + 1;
  const cost = tile.upgradePrice;
  const targetToll = tile.tolls[nextLevel];

  let eraColor = "var(--color-baroque)";
  if (tile.era === "classical") eraColor = "var(--color-classical)";
  if (tile.era === "romantic") eraColor = "var(--color-romantic)";
  if (tile.era === "modern") eraColor = "var(--color-modern)";
  
  document.getElementById("prop-era-color").style.backgroundColor = eraColor;
  document.getElementById("prop-title").innerText = tile.name;
  document.getElementById("prop-composer").innerText = tile.composer;

  const lvNames = ["공터", "🪵 1단계: 간이 연구소", "🧪 2단계: 지역 센터", "🏫 3단계: 국립 과학관", "📡 4단계: 에너지 메가 돔 (랜드마크)"];
  document.getElementById("prop-current-level").innerText = lvNames[tile.level];

  document.getElementById("upgrade-target-title").innerText = `${nextLevel}단계 업그레이드: ${lvNames[nextLevel].split(": ")[1] || lvNames[nextLevel]}`;
  document.getElementById("upgrade-cost").innerText = `${cost} Gold`;
  document.getElementById("upgrade-toll").innerText = `${targetToll} Gold`;

  const confirmBtn = document.getElementById("buy-confirm-btn");
  const me = currentRoom.players[myPlayerIndex];
  
  if (me.gold < cost) {
    confirmBtn.disabled = true;
    confirmBtn.innerText = "골드 부족";
  } else {
    confirmBtn.disabled = false;
    confirmBtn.innerText = "건설하기";
  }

  purchaseModal.classList.add("active");

  confirmBtn.onclick = () => {
    purchaseModal.classList.remove("active");
    socket.emit("buyProperty", { roomCode: myRoomCode, tileIndex: tile.index, level: nextLevel, isFree: false });
  };

  document.getElementById("buy-decline-btn").onclick = () => {
    purchaseModal.classList.remove("active");
    socket.emit("declineBuy", { roomCode: myRoomCode });
  };
}

// C. 통행료 모달 & 인수 제안
socket.on("closeTollModal", () => {
  if (tollModalTimeout) {
    clearTimeout(tollModalTimeout);
    tollModalTimeout = null;
  }
  tollModal.classList.remove("active");
});

// D. 찬스 카드 연출 (Chance Card)
socket.on("chanceDrawn", ({ card, actionMsg }) => {
  const isMyTurn = currentRoom.gameState.activePlayerIdx === myPlayerIndex;
  const activeP = currentRoom.players[currentRoom.gameState.activePlayerIdx];

  document.getElementById("chance-title").innerText = card.title;
  document.getElementById("chance-description").innerText = card.description;

  const frontTitle = document.querySelector("#chance-modal .card-front h3");
  const frontSubtitle = document.querySelector("#chance-modal .card-front p");

  const chanceCardEl = document.getElementById("chance-card-element");
  const closeBtn = document.getElementById("chance-close-btn");

  if (isMyTurn) {
    if (frontTitle) frontTitle.innerText = "역사적 찬스";
    if (frontSubtitle) frontSubtitle.innerText = "카드를 눌러 뒤집으세요";
    document.getElementById("chance-card-badge").innerText = "찬스 카드";
    closeBtn.classList.remove("hidden");

    chanceCardEl.classList.remove("flipped");
    chanceModal.classList.add("active");
    playSynthSound("warp");

    chanceCardEl.onclick = () => {
      chanceCardEl.classList.add("flipped");
      playSynthSound("success");
      chanceCardEl.onclick = null;
    };

    closeBtn.onclick = () => {
      socket.emit("finishChanceTurn", { roomCode: myRoomCode });
    };
  } else {
    // Other players see warning/alert
    if (frontTitle) frontTitle.innerText = `${activeP.name} 님의 찬스 카드`;
    if (frontSubtitle) frontSubtitle.innerText = "카드가 열리기를 대기 중...";
    document.getElementById("chance-card-badge").innerText = `${activeP.name} 님의 찬스`;
    closeBtn.classList.add("hidden");

    chanceCardEl.classList.remove("flipped");
    chanceModal.classList.add("active");

    // Auto flip for others after 1.5s so they see the result
    setTimeout(() => {
      if (chanceModal.classList.contains("active")) {
        chanceCardEl.classList.add("flipped");
        playSynthSound("success");
      }
    }, 1500);

    chanceCardEl.onclick = null;
  }
});

socket.on("closeChanceModal", () => {
  chanceModal.classList.remove("active");
  const chanceCardEl = document.getElementById("chance-card-element");
  chanceCardEl.classList.remove("flipped");
  chanceCardEl.onclick = null;
});

// D.5 스페셜 카드 연출 (Special Card)
const specialModal = document.getElementById("special-modal");

socket.on("specialCardDrawn", ({ card, actionMsg, options }) => {
  const isMyTurn = currentRoom.gameState.activePlayerIdx === myPlayerIndex;
  const activeP = currentRoom.players[currentRoom.gameState.activePlayerIdx];
  const me = currentRoom.players[myPlayerIndex];

  document.getElementById("special-title").innerText = card.title;
  document.getElementById("special-description").innerText = card.description;

  const frontTitle = document.querySelector("#special-modal .special-card-front h3");
  const frontSubtitle = document.querySelector("#special-modal .special-card-front p");

  const specialCardEl = document.getElementById("special-card-element");
  const closeBtn = document.getElementById("special-close-btn");
  const optionsContainer = document.getElementById("special-options-container");

  if (optionsContainer) {
    optionsContainer.innerHTML = "";
  }

  if (isMyTurn) {
    if (frontTitle) frontTitle.innerText = "융합 과학 스페셜";
    if (frontSubtitle) frontSubtitle.innerText = "초정밀 고위험 카드를 눌러 뒤집으세요";
    document.getElementById("special-card-badge").innerText = "스페셜 카드";
    
    if (options && options.length > 0) {
      closeBtn.classList.add("hidden");
    } else {
      closeBtn.classList.remove("hidden");
    }

    specialCardEl.classList.remove("flipped");
    specialModal.classList.add("active");
    playSynthSound("warp");

    specialCardEl.onclick = () => {
      specialCardEl.classList.add("flipped");
      playSynthSound("success");
      specialCardEl.onclick = null;

      if (options && options.length > 0 && optionsContainer) {
        options.forEach(opt => {
          const btn = document.createElement("button");
          btn.className = "btn btn-primary";
          btn.style.margin = "4px 0";
          btn.style.width = "100%";
          btn.style.fontSize = "12px";
          btn.style.padding = "8px";

          if (card.id === "property_upgrade") {
            btn.innerText = `[${opt.name}] Lv.${opt.level} ➔ Lv.${opt.level + 1} 업그레이드`;
            btn.onclick = () => {
              socket.emit("specialSelectUpgrade", { roomCode: myRoomCode, tileIndex: opt.index });
            };
          } else if (card.id === "property_discount_takeover") {
            const canAfford = me.gold >= opt.cost;
            btn.innerText = `[${opt.name}] (${opt.ownerName} 소유) - ${opt.cost}G로 인수`;
            btn.disabled = !canAfford;
            if (!canAfford) {
              btn.style.opacity = "0.5";
              btn.innerText += " (골드 부족)";
            }
            btn.onclick = () => {
              socket.emit("specialSelectTakeover", { roomCode: myRoomCode, tileIndex: opt.index });
            };
          }
          optionsContainer.appendChild(btn);
        });
      }
    };

    closeBtn.onclick = () => {
      socket.emit("finishSpecialTurn", { roomCode: myRoomCode });
    };
  } else {
    // Other players see warning/alert
    if (frontTitle) frontTitle.innerText = `${activeP.name} 님의 스페셜 카드`;
    if (frontSubtitle) frontSubtitle.innerText = "카드가 열리기를 대기 중...";
    document.getElementById("special-card-badge").innerText = `${activeP.name} 님의 스페셜`;
    closeBtn.classList.add("hidden");

    specialCardEl.classList.remove("flipped");
    specialModal.classList.add("active");

    setTimeout(() => {
      if (specialModal.classList.contains("active")) {
        specialCardEl.classList.add("flipped");
        playSynthSound("success");
        
        if (options && options.length > 0 && optionsContainer) {
          options.forEach(opt => {
            const p = document.createElement("p");
            p.style.fontSize = "11px";
            p.style.color = "#aaa";
            p.style.margin = "2px 0";
            if (card.id === "property_upgrade") {
              p.innerText = `• ${opt.name} (Lv.${opt.level} ➔ Lv.${opt.level + 1})`;
            } else if (card.id === "property_discount_takeover") {
              p.innerText = `• ${opt.name} (${opt.ownerName} 소유) - ${opt.cost}G`;
            }
            optionsContainer.appendChild(p);
          });
        }
      }
    }, 1500);

    specialCardEl.onclick = null;
  }
});

socket.on("closeSpecialModal", () => {
  specialModal.classList.remove("active");
  const specialCardEl = document.getElementById("special-card-element");
  specialCardEl.classList.remove("flipped");
  specialCardEl.onclick = null;
});

// E. 상태 변화 터널 도약 (Warp machine)
warpActionBtn.addEventListener("click", () => {
  openWarpSelection();
});

function openWarpSelection() {
  isCameraZoomedOutForWarp = true;
  updateCamera(currentRoom);

  warpOverlay.classList.add("active");
  warpTargetSelected = null;

  // Highlight all tiles as targets
  currentRoom.gameState.boardTiles.forEach((tile) => {
    const tileEl = document.querySelector(`[data-index="${tile.index}"]`);
    if (tileEl) {
      tileEl.classList.add("warp-highlight-target");
      tileEl.onclick = () => selectWarpTarget(tile.index);
    }
  });

  document.getElementById("warp-confirm-btn").disabled = true;
  document.getElementById("warp-target-preview").innerText = "이동할 개념 기지 칸을 선택해 주세요.";
}

function selectWarpTarget(tileIndex) {
  warpTargetSelected = tileIndex;
  const tile = currentRoom.gameState.boardTiles[tileIndex];
  
  document.getElementById("warp-target-preview").innerText = `선택 완료: [${tile.name}] (이동 후 해당 기믹 수행)`;
  document.getElementById("warp-confirm-btn").disabled = false;
  
  // Highlight selection outline
  currentRoom.gameState.boardTiles.forEach((t) => {
    const el = document.querySelector(`[data-index="${t.index}"]`);
    if (el) el.style.boxShadow = "";
  });
  const selEl = document.querySelector(`[data-index="${tileIndex}"]`);
  if (selEl) selEl.style.boxShadow = "0 0 15px #ffd700, inset 0 0 8px #ffd700";
}

document.getElementById("warp-confirm-btn").addEventListener("click", () => {
  if (warpTargetSelected === null) return;

  closeWarpOverlay();
  socket.emit("warpPlayer", { roomCode: myRoomCode, targetIndex: warpTargetSelected });
});

document.getElementById("warp-cancel-btn").addEventListener("click", () => {
  closeWarpOverlay();
});

function closeWarpOverlay() {
  isCameraZoomedOutForWarp = false;
  updateCamera(currentRoom);

  warpOverlay.classList.remove("active");
  currentRoom.gameState.boardTiles.forEach((tile) => {
    const tileEl = document.querySelector(`[data-index="${tile.index}"]`);
    if (tileEl) {
      tileEl.classList.remove("warp-highlight-target");
      tileEl.onclick = null;
      tileEl.style.boxShadow = "";
    }
  });
}

// 6. REAL-TIME CHAT SYNC
chatSendForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatTextInput.value.trim();
  if (!text) return;

  socket.emit("sendChat", { roomCode: myRoomCode, message: text });
  chatTextInput.value = "";
});

socket.on("chatReceived", (chat) => {
  const p = document.createElement("p");
  p.className = "chat-bubble";
  
  if (chat.sender === "SYSTEM") {
    p.className += " chat-system";
    p.innerHTML = `[중계] ${chat.message} <span class="time">${chat.timestamp}</span>`;
  } else {
    p.innerHTML = `<span class="sender" style="color: ${chat.color}">${chat.sender}:</span>${chat.message} <span class="time">${chat.timestamp}</span>`;
  }

  chatMessagesBox.appendChild(p);
  chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
  
  // Also push to bottom mid console for duplicate sync tracking if it exists
  if (chat.sender === "SYSTEM" && consoleLogsEl) {
    const consoleLog = document.createElement("p");
    consoleLog.className = "log-system";
    consoleLog.innerText = chat.message;
    consoleLogsEl.appendChild(consoleLog);
    consoleLogsEl.scrollTop = consoleLogsEl.scrollHeight;
  }
});

// 7. GAME OVER & DISCONNECT EVENTS
socket.on("gameOver", ({ winnerName, reason }) => {
  document.getElementById("winner-announcement").innerText = `🏆 최종 승리: ${winnerName} 🏆`;
  document.getElementById("game-over-reason").innerText = reason;

  const container = document.getElementById("game-over-scores-container");
  container.innerHTML = "";

  currentRoom.players.forEach((p, idx) => {
    const card = document.createElement("div");
    card.className = `score-card card-p${idx}`;
    card.innerHTML = `
      <span>${p.name}</span>
      <strong>${p.gold.toLocaleString()} G</strong>
    `;
    container.appendChild(card);
  });

  gameOverModal.classList.add("active");
  playSynthSound("landmark");
  triggerConfetti();
});

socket.on("gameAborted", (reason) => {
  alert(`게임이 조기 종료되었습니다: ${reason}`);
  window.location.reload();
});

// 8. CANVAS CONFETTI PARTICLE SYSTEM
const canvas = document.getElementById("celebration-canvas");
const ctx = canvas.getContext("2d");
let particles = [];
let animFrameId = null;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function triggerConfetti() {
  particles = [];
  const colors = ["#ff3366", "#00e5ff", "#ffd700", "#39ff14", "#e040fb"];
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.8) * 12,
      radius: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  }
  if (animFrameId) cancelAnimationFrame(animFrameId);
  updateConfetti();
}

function updateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let active = false;

  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2; // gravity
    p.alpha -= 0.015; // fade
    p.rotation += p.rotSpeed;

    if (p.alpha > 0) {
      active = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
      ctx.restore();
    }
  });

  if (active) {
    animFrameId = requestAnimationFrame(updateConfetti);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// 9. TAKEOVER NOTIFICATION ALERT LISTENER
socket.on("propertyTakeoverNotification", ({ buyerIdx, sellerIdx, tileIndex, cost }) => {
  const tile = currentRoom.gameState.boardTiles[tileIndex];
  const buyer = currentRoom.players[buyerIdx];
  const seller = currentRoom.players[sellerIdx];

  const titleEl = document.getElementById("takeover-alert-title");
  const descEl = document.getElementById("takeover-alert-desc");
  const propNameEl = document.getElementById("takeover-alert-prop-name");
  const buyerNameEl = document.getElementById("takeover-alert-buyer-name");
  const priceEl = document.getElementById("takeover-alert-price-received");
  const alertIcon = document.querySelector(".alert-icon-shake i");

  if (!tile || !buyer || !seller) return;

  propNameEl.innerText = tile.name;
  buyerNameEl.innerText = buyer.name;

  if (myPlayerIndex === sellerIdx) {
    // I am the victim (lost property)
    titleEl.innerText = "연구 기지를 강탈당했습니다! 😭";
    descEl.innerText = `${buyer.name} 님이 당신의 소중한 연구 기지를 강제 인수하였습니다.`;
    priceEl.innerText = `+${cost} G`;
    priceEl.className = "text-green"; // Green since they get gold
    if (alertIcon) alertIcon.className = "fa-solid fa-house-circle-exclamation";
    playSynthSound("fail");
  } else if (myPlayerIndex === buyerIdx) {
    // I am the buyer
    titleEl.innerText = "연구 기지 인수 완료! 💳";
    descEl.innerText = `${seller.name} 님의 연구 기지를 돈으로 사서 내 것으로 만들었습니다!`;
    priceEl.innerText = `-${cost} G`;
    priceEl.className = "text-red";
    if (alertIcon) alertIcon.className = "fa-solid fa-house-circle-check";
    playSynthSound("success");
  } else {
    // Spectator
    titleEl.innerText = "연구 기지 주인 바뀜! 🏛️";
    descEl.innerText = `${buyer.name} 님이 ${seller.name} 님의 연구 기지를 인수했습니다.`;
    priceEl.innerText = `${cost} G`;
    priceEl.className = "text-gold";
    if (alertIcon) alertIcon.className = "fa-solid fa-people-arrows";
    playSynthSound("step");
  }

  const takeoverAlertModal = document.getElementById("takeover-alert-modal");
  if (takeoverAlertModal) takeoverAlertModal.classList.add("active");

  const closeBtn = document.getElementById("takeover-alert-close-btn");
  if (closeBtn) {
    closeBtn.onclick = () => {
      takeoverAlertModal.classList.remove("active");
    };
  }
});

// 10. RESOLVE LANDED TILE AFTER TRAP ESCAPE
socket.on("resolveLandedTile", () => {
  isMoving = false;
  if (currentRoom) {
    const isMyTurn = currentRoom.gameState.activePlayerIdx === myPlayerIndex;
    if (isMyTurn) {
      socket.emit("clientFinishedMoving", { roomCode: myRoomCode });
    }
  }
});

// 11. GOLD CHANGE ANIMATION EFFECT
function triggerGoldChangeAnimation(playerIndex, amount) {
  if (amount === 0) return;

  const panel = document.getElementById(`panel-p${playerIndex}`);
  if (!panel) return;

  const playerCard = panel.querySelector(".player-card");
  if (!playerCard) return;

  // Create floating indicator bubble
  const indicator = document.createElement("div");
  indicator.className = "gold-change-indicator " + (amount > 0 ? "positive" : "negative");
  indicator.innerText = (amount > 0 ? "+" : "") + amount.toLocaleString() + " G";

  // Position it inside the player panel card (relative boundaries)
  indicator.style.right = "25px";
  indicator.style.bottom = "65px";

  playerCard.appendChild(indicator);

  // Auto clean up after animation finishes
  setTimeout(() => {
    indicator.remove();
  }, 1500);

  // Flash the gold element value text
  const goldValEl = document.getElementById(`p${playerIndex}-gold`);
  if (goldValEl) {
    const flashClass = amount > 0 ? "flash-gold-gain" : "flash-gold-loss";
    goldValEl.classList.add(flashClass);
    setTimeout(() => {
      goldValEl.classList.remove(flashClass);
    }, 1000);
  }
}

// Socket disconnect auto-reload handler to handle server restarts gracefully
socket.on("disconnect", (reason) => {
  if (reason === "transport close" || reason === "io server disconnect") {
    alert("서버와의 연결이 끊어졌거나 재시작되었습니다. 로비로 이동합니다.");
    window.location.reload();
  }
});
