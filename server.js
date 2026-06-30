// ==========================================
// 서양음악사 브루마블 - 실시간 멀티플레이 서버 (server.js)
// ==========================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Room Memory Map
// Key: roomCode (4-digit string)
// Value: { players: [], gameState: {}, chatLogs: [] }
const rooms = new Map();

// 32-Tile Board Configuration Template
const boardTemplate = [
  { index: 0, name: "과학 탐구실", composer: "START", type: "start", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 1, name: "철광석 광산", composer: "고체", type: "music", era: "baroque", price: 100, upgradePrice: 50, baseToll: 12, tolls: [0,12,24,48,84], owner: null, level: 0,
    trivia: { question: "Q. 담긴 용기에 관계없이 모양과 부피가 일정하며, 입자들이 매우 규칙적으로 배열되어 있고 제자리에서 진동 운동만 하는 물질의 상태는 무엇인가?", options: ["고체 상태", "액체 상태", "기체 상태", "플라스마 상태"], answer: "고체 상태" } },
  { index: 2, name: "흐르는 강물", composer: "액체", type: "music", era: "baroque", price: 120, upgradePrice: 60, baseToll: 15, tolls: [0,15,30,60,105], owner: null, level: 0,
    trivia: { question: "Q. 담는 용기에 따라 모양은 변하지만 부피는 일정하며, 입자들이 고체보다 비교적 자유롭게 운동하고 입자 배열이 비교적 불규칙한 물질의 상태는 무엇인가?", options: ["액체 상태", "고체 상태", "기체 상태", "승화 상태"], answer: "액체 상태" } },
  { index: 3, name: "돌발 과학 찬스", composer: "CHANCE", type: "chance", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 4, name: "바람개비 언덕", composer: "기체", type: "music", era: "baroque", price: 140, upgradePrice: 70, baseToll: 20, tolls: [0,20,40,80,140], owner: null, level: 0,
    trivia: { question: "Q. 모양과 부피가 모두 일정하지 않아 용기 전체로 쉽게 퍼져 나가며, 입자 사이의 거리가 매우 멀고 매우 활발하게 움직이는 물질의 상태는 무엇인가?", options: ["기체 상태", "고체 상태", "액체 상태", "응고 상태"], answer: "기체 상태" } },
  { index: 5, name: "끊임없는 춤교실", composer: "입자", type: "music", era: "baroque", price: 160, upgradePrice: 80, baseToll: 25, tolls: [0,25,50,100,175], owner: null, level: 0,
    trivia: { question: "Q. 물질을 구성하는 입자들이 스스로 끊임없이 움직이는 현상을 무엇이라고 하는가?", options: ["입자 운동", "중력 운동", "정지 상태", "마찰 운동"], answer: "입자 운동" } },
  { index: 6, name: "향수가 퍼지는 방", composer: "확산", type: "music", era: "baroque", price: 170, upgradePrice: 85, baseToll: 28, tolls: [0,28,56,112,196], owner: null, level: 0,
    trivia: { question: "Q. 물질을 구성하는 입자가 스스로 운동하여 액체나 기체 속으로 퍼져 나가는 현상을 무엇이라고 하는가? (예: 방 한구석에 뿌린 향수 냄새가 방 전체로 퍼진다.)", options: ["확산", "증발", "끓음", "응축"], answer: "확산" } },
  { index: 7, name: "입자 간격 비교실", composer: "입자 거리", type: "music", era: "baroque", price: 180, upgradePrice: 90, baseToll: 30, tolls: [0,30,60,120,210], owner: null, level: 0,
    trivia: { question: "Q. 고체, 액체, 기체 상태 중 물질을 구성하는 입자 사이의 거리가 가장 먼 상태는 무엇인가?", options: ["기체 상태", "고체 상태", "액체 상태", "융해 상태"], answer: "기체 상태" } },
  
  { index: 8, name: "절대 0도의 방", composer: "샤를", type: "trap", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 9, name: "초콜릿 퐁듀 카페", composer: "융해", type: "music", era: "classical", price: 200, upgradePrice: 100, baseToll: 35, tolls: [0,35,70,140,245], owner: null, level: 0,
    trivia: { question: "Q. 고체 상태의 물질이 열에너지를 흡수하여 액체 상태로 변하는 현상을 무엇이라고 하는가?", options: ["융해", "응고", "기화", "액화"], answer: "융해" } },
  { index: 10, name: "바람 부는 빨래터", composer: "기화", type: "music", era: "classical", price: 220, upgradePrice: 110, baseToll: 40, tolls: [0,40,80,160,280], owner: null, level: 0,
    trivia: { question: "Q. 액체 상태의 물질이 열에너지를 흡수하여 기체 상태로 변하는 현상을 무엇이라고 하는가?", options: ["기화", "액화", "응고", "융해"], answer: "기화" } },
  { index: 11, name: "돌발 과학 찬스", composer: "CHANCE", type: "chance", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 12, name: "얼음 조각 전시장", composer: "융해열", type: "music", era: "classical", price: 240, upgradePrice: 120, baseToll: 45, tolls: [0,45,90,180,315], owner: null, level: 0,
    trivia: { question: "Q. 고체가 액체로 녹을 때 주변으로부터 열에너지를 흡수하는 현상을 무엇이라고 하는가? 이로 인해 주변 온도가 낮아진다.", options: ["융해열 흡수", "응고열 방출", "액화열 방출", "기화열 방출"], answer: "융해열 흡수" } },
  { index: 13, name: "여름날의 분수대", composer: "기화열", type: "music", era: "classical", price: 260, upgradePrice: 130, baseToll: 50, tolls: [0,50,100,200,350], owner: null, level: 0,
    trivia: { question: "Q. 액체가 기체로 기화할 때 주변으로부터 열에너지를 흡수하는 현상을 무엇이라고 하는가? 더운 여름철 마당에 물을 뿌리면 시원해지는 원리이다.", options: ["기화열 흡수", "액화열 방출", "응고열 방출", "융해열 흡수"], answer: "기화열 흡수" } },
  { index: 14, name: "땀이 마르는 언덕", composer: "기화열 흡수", type: "music", era: "classical", price: 270, upgradePrice: 135, baseToll: 52, tolls: [0,52,104,208,364], owner: null, level: 0,
    trivia: { question: "Q. 더운 날 몸에 묻은 땀이 마르면서 몸이 시원해지는 현상은 어떤 상태 변화열 흡수를 이용한 것인가?", options: ["기화열 흡수", "융해열 흡수", "승화열 흡수", "응고열 방출"], answer: "기화열 흡수" } },
  { index: 15, name: "드라이아이스 실험실", composer: "승화(흡열)", type: "music", era: "classical", price: 280, upgradePrice: 140, baseToll: 55, tolls: [0,55,110,220,385], owner: null, level: 0,
    trivia: { question: "Q. 고체 상태의 물질이 액체 상태를 거치지 않고 직접 기체 상태로 변하는 현상을 무엇이라고 하는가? (예: 드라이아이스 크기가 점점 줄어든다.)", options: ["승화", "응고", "액화", "융해"], answer: "승화" } },
  
  { index: 16, name: "상태 변화 터널", composer: "WARP", type: "warp", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 17, name: "겨울 고드름 처마", composer: "응고", type: "music", era: "romantic", price: 300, upgradePrice: 150, baseToll: 60, tolls: [0,60,120,240,420], owner: null, level: 0,
    trivia: { question: "Q. 액체 상태의 물질이 열에너지를 방출하여 고체 상태로 변하는 현상을 무엇이라고 하는가?", options: ["응고", "융해", "기화", "액화"], answer: "응고" } },
  { index: 18, name: "안개 자욱한 아침 숲", composer: "액화", type: "music", era: "romantic", price: 310, upgradePrice: 155, baseToll: 62, tolls: [0,62,124,248,434], owner: null, level: 0,
    trivia: { question: "Q. 기체 상태의 물질이 열에너지를 방출하여 액체 상태로 변하는 현상을 무엇이라고 하는가?", options: ["액화", "기화", "융해", "응고"], answer: "액화" } },
  { index: 19, name: "돌발 과학 찬스", composer: "CHANCE", type: "chance", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 20, name: "이글루 물 뿌리기", composer: "응고열", type: "music", era: "romantic", price: 320, upgradePrice: 160, baseToll: 65, tolls: [0,65,130,260,455], owner: null, level: 0,
    trivia: { question: "Q. 액체가 고체로 얼 때 주변으로 열에너지를 방출하는 현상을 무엇이라고 하는가? 추운 겨울 에스키모가 이글루 내부에 물을 뿌려 내부를 따뜻하게 하는 데 활용된다.", options: ["응고열 방출", "융해열 흡수", "기화열 흡수", "액화열 방출"], answer: "응고열 방출" } },
  { index: 21, name: "김 서린 대중탕", composer: "액화열", type: "music", era: "romantic", price: 340, upgradePrice: 170, baseToll: 70, tolls: [0,70,140,280,490], owner: null, level: 0,
    trivia: { question: "Q. 기체가 액체로 변할 때 주변으로 열에너지를 방출하는 현상을 무엇이라고 하는가? 목욕탕 천장에 맺힌 물방울이 떨어져 피부에 닿으면 뜨겁게 느껴지는 원리이다.", options: ["액화열 방출", "기화열 흡수", "융해열 흡수", "승화열 흡수"], answer: "액화열 방출" } },
  { index: 22, name: "눈 내리는 하늘", composer: "승화열 방출", type: "music", era: "romantic", price: 350, upgradePrice: 175, baseToll: 72, tolls: [0,72,144,288,504], owner: null, level: 0,
    trivia: { question: "Q. 구름 속의 수증기가 직접 얼어서 눈이 될 때 주변으로 열에너지를 방출하여 날씨가 포근해지는 현상은 어떤 상태 변화열을 이용한 것인가?", options: ["승화열 방출", "융해열 흡수", "액화열 방출", "응고열 방출"], answer: "승화열 방출" } },
  { index: 23, name: "겨울 창문 성에 방", composer: "승화(발열)", type: "music", era: "romantic", price: 360, upgradePrice: 180, baseToll: 75, tolls: [0,75,150,300,525], owner: null, level: 0,
    trivia: { question: "Q. 기체 상태의 물질이 액체 상태를 거치지 않고 직접 고체 상태로 변하는 현상을 무엇이라고 하는가? (예: 찬 바람이 부는 날 창문에 성에가 낀다.)", options: ["승화", "액화", "기화", "융해"], answer: "승화" } },
  
  { index: 24, name: "융합 과학 찬스 코너", composer: "CHANCE", type: "chance-corner", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 25, name: "휴대용 에어컨", composer: "기화열 흡수", type: "music", era: "modern", price: 400, upgradePrice: 200, baseToll: 90, tolls: [0,90,180,360,630], owner: null, level: 0,
    trivia: { question: "Q. 에어컨은 냉매 액체가 어떤 상태 변화를 일으키며 열에너지를 흡수하여 주변 온도를 낮추는 기계인가?", options: ["기화", "액화", "응고", "융해"], answer: "기화" } },
  { index: 26, name: "이글루의 지혜", composer: "응고열 방출", type: "music", era: "modern", price: 420, upgradePrice: 210, baseToll: 95, tolls: [0,95,190,380,665], owner: null, level: 0,
    trivia: { question: "Q. 겨울철 에스키모가 이글루 바닥에 물을 뿌려 실내 온도를 높이는 것은 어떤 열에너지 변화를 이용한 것인가?", options: ["응고열 방출", "융해열 흡수", "기화열 흡수", "액화열 방출"], answer: "응고열 방출" } },
  { index: 27, name: "돌발 과학 찬스", composer: "CHANCE", type: "chance", era: null, price: 0, baseToll: 0, tolls: [0,0,0,0,0] },
  { index: 28, name: "아이스크림 포장", composer: "드라이아이스 승화", type: "music", era: "modern", price: 440, upgradePrice: 220, baseToll: 100, tolls: [0,100,200,400,700], owner: null, level: 0,
    trivia: { question: "Q. 아이스크림을 포장할 때 함께 넣는 드라이아이스는 어떤 상태 변화를 거치며 주변 온도를 낮게 유지해 주는가?", options: ["승화 (고체→기체)", "융해 (고체→액체)", "기화 (액체→기체)", "액화 (기체→액체)"], answer: "승화 (고체→기체)" } },
  { index: 29, name: "안개와 김", composer: "수증기 액화", type: "music", era: "modern", price: 460, upgradePrice: 230, baseToll: 110, tolls: [0,110,220,440,770], owner: null, level: 0,
    trivia: { question: "Q. 끓는 주전자 주둥이 앞에 하얗게 보이는 '김'이나 이른 아침 강가에 끼는 '안개'는 수증기가 어떤 상태 변화를 거쳐 생긴 미세한 물방울인가?", options: ["액화", "기화", "융해", "승화"], answer: "액화" } },
  { index: 30, name: "스팀 난방기", composer: "액화열 방출", type: "music", era: "modern", price: 470, upgradePrice: 235, baseToll: 115, tolls: [0,115,230,460,805], owner: null, level: 0,
    trivia: { question: "Q. 겨울철 건물 내부의 스팀 난방기는 파이프 안의 뜨거운 수증기가 물로 변할 때 방출하는 어떤 에너지를 이용해 방 안을 따뜻하게 하는가?", options: ["액화열 방출", "기화열 흡수", "융해열 흡수", "응고열 방출"], answer: "액화열 방출" } },
  { index: 31, name: "눈 올 때 따뜻함", composer: "상태변화와 열", type: "music", era: "modern", price: 480, upgradePrice: 240, baseToll: 120, tolls: [0,120,240,480,840], owner: null, level: 0,
    trivia: { question: "Q. 겨울철 함박눈이 내릴 때 날씨가 포근하게 느껴지는 주된 이유는 구름 속의 물방울이 얼거나(응고) 수증기가 눈(승화)으로 변하면서 어떤 현상이 발생하기 때문인가?", options: ["열에너지 방출", "열에너지 흡수", "기화열 흡수", "융해열 흡수"], answer: "열에너지 방출" } }
];

// Chance Card List
const serverChanceCards = [
  { id: "gold_quest", title: "신비한 과학 탐구", description: "과학 탐구 발표 대회에서 최우수상을 받았습니다! 즉시 150골드를 획득합니다.", type: "gold", amount: 150 },
  { id: "gold_break", title: "실험 기구 파손", description: "과학 실험 중 비커와 시험관을 깨뜨려 변상 비용이 발생했습니다. 100골드를 은행에 지불합니다.", type: "gold", amount: -100 },
  { id: "gold_thesis", title: "과학 논문 등재", description: "작성한 '상태 변화와 입자 배열에 관한 연구' 논문이 국제 학술지에 게재되어 장학금을 받습니다! 보너스 200골드를 받습니다.", type: "gold", amount: 200 },
  { id: "warp_start", title: "열에너지의 이끌림", description: "강력한 열에너지의 이끌림에 의해 과학 탐구실(START) 칸으로 즉시 이동합니다.", type: "warp", target: 0 },
  { id: "warp_tunnel", title: "차원의 문 개방", description: "상태 변화 터널 칸으로 즉시 이동합니다.", type: "warp", target: 16 },
  { id: "gold_donation", title: "과학 전시회 기부", description: "학교 과학 동아리 전시회 활성화를 위해 후원금 100골드를 기부합니다.", type: "gold", amount: -100 },
  { id: "step_expansion", title: "급격한 부피 팽창", description: "액체가 기체로 기화하며 부피가 급격히 늘어나는 바람에 그 압력으로 3칸 뒤로 밀려납니다.", type: "step", steps: -3 },
  
  // Custom Gimmick Cards
  { id: "yellow_dust", title: "황사 경보", description: "급격한 기온 상승으로 황사지대가 형성되었습니다. 나를 제외한 모든 플레이어가 공기청정기 필터 교체비 50골드씩 나에게 지불합니다.", type: "custom" },
  { id: "expo_donation", title: "과학 엑스포 후원", description: "세계 과학 엑스포 후원을 위해 가장 부유한 플레이어가 100골드를 은행에 기부하고, 가장 가난한 플레이어가 지원금 100골드를 받습니다.", type: "custom" },
  { id: "property_crash", title: "부동산 대폭락", description: "부동산 시장 대폭락으로 인해 보유 기지 중 가장 가격이 높은 과학 기지 1곳이 반값에 강제 처분되어 매각됩니다.", type: "custom" },
  { id: "gold_redistribution", title: "에너지 등가 교환", description: "모든 에너지는 공평하게 순환합니다. 현재 생존한 모든 플레이어의 보유 골드를 합산하여 똑같이 균등하게 분배합니다.", type: "custom" },
  { id: "property_tax", title: "연구소 안전 점검", description: "소유한 모든 과학 기지에 안전 검진이 시작됩니다. 보유한 기지(부동산) 1개당 20골드씩 안전 진단비를 납부합니다.", type: "custom" },
  { id: "property_bonus", title: "특허권 로열티", description: "개발한 물질 상태 변화 제어 특허가 로열티를 발생시켰습니다! 소유한 기지 1개당 50골드씩 특허료 보너스를 획득합니다.", type: "custom" },
  { id: "warp_trap", title: "우주 방사선 폭풍", description: "강력한 우주 방사선 폭풍에 휩쓸려 에너지가 모두 차단된 절대 0도(Kelvin 0)의 방으로 강제 전송되어 갇힙니다.", type: "warp", target: 8 },
  { id: "gold_scholarship", title: "무상 과학 장학금", description: "과학 미래 인재로 선정되어 한국 과학 장학재단으로부터 무상 장학금 100골드를 지급받습니다.", type: "gold", amount: 100 }
];

// Special Card List (융합 과학 스페셜 - revised)
const serverSpecialCards = [
  { id: "gold_gain_300", title: "초전도 연구 지원금", description: "초전도체 연구 성과를 인정받아 정부로부터 300골드의 특별 연구 지원금을 획득합니다.", type: "special" },
  { id: "gold_donate_300", title: "과학 재단 기부", description: "기초 과학 발전을 위해 과학 재단에 300골드를 기부합니다.", type: "special" },
  { id: "property_discount_takeover", title: "선택한 영역 반값 인수", description: "원하는 상대방의 과학 기지 중 하나를 반값에 특별 인수할 수 있는 특권을 획득합니다. (게임 당 단 1회 발동, 4% 확률)", type: "special" },
  { id: "property_upgrade", title: "연구소 1단계 무료 업그레이드", description: "내가 소유한 과학 기지 중 하나를 선택하여 무료로 1단계 업그레이드합니다.", type: "special" },
  { id: "move_to_trap", title: "절대 0도의 방으로 이동", description: "갑작스러운 에너지 급강하로 인해 모든 입자의 운동이 정지되는 절대 0도(Kelvin 0)의 방으로 강제 전송됩니다.", type: "special" },
  { id: "gold_double_5", title: "양자 복제 대성공", description: "양자 얽힘 상태의 골드 복제 실험에 성공하여 현재 보유한 골드가 2배가 됩니다! (5% 확률)", type: "special" },
  { id: "gold_half_5", title: "블랙홀 골드 소실", description: "미니 블랙홀 발생으로 인해 현재 보유한 골드가 반토막(50% 차감) 납니다. (5% 확률)", type: "special" }
];

// Helper: Generate a unique room code
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create Room
  socket.on("createRoom", ({ playerName }) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const newRoom = {
      code: roomCode,
      players: [
        {
          socketId: socket.id,
          name: playerName,
          color: "#ff3366", // Red
          avatar: "fa-atom",
          gold: 1500,
          estate: 0,
          position: 0,
          isTrapped: false,
          trappedTurns: 0,
          hasWarpPending: false,
          properties: [],
          isHost: true
        }
      ],
      gameState: {
        status: "waiting",
        activePlayerIdx: 0,
        turnCount: 1,
        boardTiles: JSON.parse(JSON.stringify(boardTemplate)) // Deep copy
      },
      chatLogs: []
    };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);
    
    socket.emit("joinSuccess", { roomCode, playerIndex: 0 });
    io.to(roomCode).emit("roomStateUpdate", newRoom);
    console.log(`Room created: ${roomCode} by ${playerName}`);
  });

  // Join Room
  socket.on("joinRoom", ({ playerName, roomCode }) => {
    const code = roomCode.toUpperCase();
    if (!rooms.has(code)) {
      socket.emit("joinError", "방이 존재하지 않습니다.");
      return;
    }

    const room = rooms.get(code);
    
    // Check if player with the same name already exists in this room
    const existingPlayerIndex = room.players.findIndex(p => p.name === playerName);

    if (existingPlayerIndex !== -1) {
      if (room.gameState.status === "playing") {
        // Rejoin existing active slot!
        const existingPlayer = room.players[existingPlayerIndex];
        existingPlayer.socketId = socket.id;
        existingPlayer.isOffline = false;

        socket.join(code);
        socket.emit("joinSuccess", { roomCode: code, playerIndex: existingPlayerIndex });
        
        sendSystemChatMessage(code, `🔄 ${playerName} 님이 재접속하셨습니다.`);
        io.to(code).emit("roomStateUpdate", room);
        console.log(`User ${playerName} rejoined Room ${code}`);
        return;
      } else {
        socket.emit("joinError", "이미 동일한 이름의 플레이어가 대기실에 있습니다.");
        return;
      }
    }

    // New player join checks
    if (room.gameState.status !== "waiting") {
      socket.emit("joinError", "이미 게임이 시작되었습니다.");
      return;
    }

    if (room.players.length >= 4) {
      socket.emit("joinError", "방이 꽉 찼습니다. (최대 4인)");
      return;
    }

    // Configure client profile based on index
    const index = room.players.length;
    const colors = ["#ff3366", "#00e5ff", "#ffb300", "#e040fb"]; // P1, P2, P3, P4
    const avatars = ["fa-atom", "fa-flask", "fa-temperature-half", "fa-dna"];
    
    const newPlayer = {
      socketId: socket.id,
      name: playerName,
      color: colors[index],
      avatar: avatars[index],
      gold: 1500,
      estate: 0,
      position: 0,
      isTrapped: false,
      trappedTurns: 0,
      hasWarpPending: false,
      properties: [],
      isHost: false,
      isOffline: false
    };

    room.players.push(newPlayer);
    socket.join(code);
    
    socket.emit("joinSuccess", { roomCode: code, playerIndex: index });
    io.to(code).emit("roomStateUpdate", room);
    
    // Server chat join notify
    sendSystemChatMessage(code, `${playerName} 님이 입장하셨습니다.`);
    console.log(`User ${playerName} joined Room ${code}`);
  });

  // Start Game
  socket.on("startGame", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.isHost) return;

    room.gameState.status = "playing";
    room.gameState.activePlayerIdx = 0;
    room.gameState.turnCount = 1;

    io.to(roomCode).emit("gameStart");
    io.to(roomCode).emit("roomStateUpdate", room);
    sendSystemChatMessage(roomCode, "과학 개념 브루마블(상태변화와 열에너지) 게임이 시작되었습니다!");
  });

  // Chat message
  socket.on("sendChat", ({ roomCode, message }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const chat = {
      sender: player.name,
      color: player.color,
      message: message,
      timestamp: new Date().toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' })
    };

    room.chatLogs.push(chat);
    io.to(roomCode).emit("chatReceived", chat);
  });

  // Helper: Roll a single weighted die based on power gauge value
  function rollWeightedDie(power) {
    const t = (power !== undefined && power !== null) ? power : 0.5;
    
    // W(x, t) = (1 - t) * (7 - x) + t * x
    const weights = [];
    let totalWeight = 0;
    for (let x = 1; x <= 6; x++) {
      const w = (1 - t) * (7 - x) + t * x;
      weights.push(w);
      totalWeight += w;
    }

    const r = Math.random() * totalWeight;
    let runningSum = 0;
    for (let i = 0; i < 6; i++) {
      runningSum += weights[i];
      if (r <= runningSum) {
        return i + 1;
      }
    }
    return 6;
  }

  // Dice Roll Handler
  socket.on("rollDice", ({ roomCode, power }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return; // Not their turn

    // Calculate Roll using weighted probability
    const val1 = rollWeightedDie(power);
    const val2 = rollWeightedDie(power);
    const total = val1 + val2;

    const isDouble = val1 === val2;

    if (isDouble && !activeP.isTrapped) {
      room.gameState.doubleCount = (room.gameState.doubleCount || 0) + 1;
    } else {
      room.gameState.doubleCount = 0;
    }

    // Save initial state for movement tracking
    const oldPosition = activeP.position;
    
    // Update player position
    activeP.position = (activeP.position + total) % 32;

    let passedStart = false;
    if (activeP.position < oldPosition) {
      passedStart = true;
      activeP.gold += 200;
      sendSystemChatMessage(roomCode, `🧪 ${activeP.name} 님이 과학 탐구실(START)을 통과하여 탐구 지원금 200골드를 획득하셨습니다.`);
    }

    // Broadcast roll animation details to everyone
    io.to(roomCode).emit("diceRolled", {
      playerIndex: room.gameState.activePlayerIdx,
      rolls: [val1, val2],
      total: total,
      isDouble: isDouble,
      newPosition: activeP.position,
      passedStart: passedStart
    });

    sendSystemChatMessage(roomCode, `${activeP.name} 님이 주사위를 던졌습니다! (${val1} + ${val2} = ${total})`);
  });

  // Trap escape payment
  socket.on("payTrapEscape", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    if (activeP.gold >= 100) {
      activeP.gold -= 100;
      activeP.isTrapped = false;
      activeP.trappedTurns = 0;
      
      sendSystemChatMessage(roomCode, `${activeP.name} 님이 침묵 탈옥금 100골드를 납부하셨습니다.`);
      io.to(roomCode).emit("roomStateUpdate", room);
      socket.emit("trapEscapeSuccess");
    }
  });

  // Roll escape try (trap)
  socket.on("rollTrapEscape", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const val1 = Math.floor(Math.random() * 6) + 1;
    const val2 = Math.floor(Math.random() * 6) + 1;
    const isDouble = val1 === val2;

    io.to(roomCode).emit("diceRolled", {
      playerIndex: room.gameState.activePlayerIdx,
      rolls: [val1, val2],
      total: val1 + val2,
      isDouble: isDouble,
      newPosition: activeP.position,
      passedStart: false,
      isEscapeRoll: true
    });

    if (isDouble) {
      activeP.isTrapped = false;
      activeP.trappedTurns = 0;
      activeP.position = (activeP.position + val1 + val2) % 32;
      
      sendSystemChatMessage(roomCode, `🎉 더블(${val1}) 등장! ${activeP.name} 님이 절대 0도의 방을 무료 탈출했습니다.`);
      
      // Delay response to sync animation
      setTimeout(() => {
        io.to(roomCode).emit("roomStateUpdate", room);
        io.to(roomCode).emit("resolveLandedTile");
      }, 3500);
    } else {
      activeP.trappedTurns--;
      sendSystemChatMessage(roomCode, `${activeP.name} 님이 탈출에 실패했습니다. (주사위: ${val1}, ${val2})`);
      
      if (activeP.trappedTurns <= 0) {
        activeP.isTrapped = false;
        sendSystemChatMessage(roomCode, `${activeP.name} 님이 다음 턴에 자동 석방됩니다.`);
      }
      
      setTimeout(() => {
        io.to(roomCode).emit("roomStateUpdate", room);
        endTurn(roomCode);
      }, 2000);
    }
  });

  // Player confirms moving (Click -> Move)
  socket.on("confirmMove", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;
    io.to(roomCode).emit("moveConfirmed");
  });

  // Land complete, resolve tile actions
  socket.on("clientFinishedMoving", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const tile = room.gameState.boardTiles[activeP.position];

    // Trigger action on active client
    socket.emit("triggerTileAction", { tile });
  });

  // Buy Property
  socket.on("buyProperty", ({ roomCode, tileIndex, level, isFree }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const tile = room.gameState.boardTiles[tileIndex];
    const cost = isFree ? 0 : tile.upgradePrice;

    if (activeP.gold >= cost) {
      activeP.gold -= cost;
      tile.owner = room.gameState.activePlayerIdx;
      tile.level = level;

      if (!activeP.properties.includes(tileIndex)) {
        activeP.properties.push(tileIndex);
      }

      const lvNames = ["공터", "간이 연구소", "지역 센터", "국립 과학관", "에너지 메가 돔 (랜드마크)"];
      sendSystemChatMessage(roomCode, `${activeP.name} 님이 ${tile.name}에 '${lvNames[level]}'을(를) 완공했습니다.`);

      // Sync and next turn
      io.to(roomCode).emit("roomStateUpdate", room);
      endTurn(roomCode);
    }
  });

  // Quiz Failure
  socket.on("quizFailed", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    // Penalty gold
    activeP.gold -= 50;
    if (activeP.gold < 0) activeP.gold = 0;
    
    sendSystemChatMessage(roomCode, `${activeP.name} 님이 퀴즈 정답 맞추기에 실패하여 50골드 페널티를 납부했습니다.`);
    
    // Check bankrupt
    checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);

    io.to(roomCode).emit("roomStateUpdate", room);
    endTurn(roomCode);
  });

  // Upgrade Property
  socket.on("upgradeProperty", ({ roomCode, tileIndex }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const tile = room.gameState.boardTiles[tileIndex];
    if (tile.owner !== room.gameState.activePlayerIdx) return;
    
    const nextLevel = tile.level + 1;
    if (nextLevel > 4) return; // Max level reached

    const cost = tile.upgradePrice;
    if (activeP.gold >= cost) {
      activeP.gold -= cost;
      tile.level = nextLevel;

      const lvNames = ["공터", "간이 연구소", "지역 센터", "국립 과학관", "에너지 메가 돔 (랜드마크)"];
      sendSystemChatMessage(roomCode, `${activeP.name} 님이 ${tile.name} 기지를 '${lvNames[nextLevel]}'으로 업그레이드했습니다.`);

      io.to(roomCode).emit("roomStateUpdate", room);
      endTurn(roomCode);
    }
  });

  // Pay Toll Only (No Takeover)
  socket.on("payTollOnly", ({ roomCode, tileIndex }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const tile = room.gameState.boardTiles[tileIndex];
    const ownerIndex = tile.owner;
    const owner = room.players[ownerIndex];
    
    // Apply round multiplier to the toll fee
    const turnCount = room.gameState.turnCount || 1;
    const roundMult = getRoundMultiplier(turnCount);
    const baseToll = tile.tolls[tile.level];
    const toll = Math.floor(baseToll * roundMult);

    // Transfer gold
    const actualToll = Math.min(activeP.gold, toll);
    activeP.gold -= actualToll;
    owner.gold += actualToll;

    sendSystemChatMessage(roomCode, `${activeP.name} 님이 ${owner.name} 님에게 통행료 ${actualToll}골드를 납부하셨습니다.`);

    // Check bankrupt
    checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);

    io.to(roomCode).emit("closeTollModal");
    io.to(roomCode).emit("roomStateUpdate", room);
    endTurn(roomCode);
  });

  // Pay Toll and Takeover Property
  socket.on("payTollAndTakeover", ({ roomCode, tileIndex }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const tile = room.gameState.boardTiles[tileIndex];
    const ownerIndex = tile.owner;
    const owner = room.players[ownerIndex];
    
    // Apply round multiplier to the toll fee
    const turnCount = room.gameState.turnCount || 1;
    const roundMult = getRoundMultiplier(turnCount);
    const baseToll = tile.tolls[tile.level];
    const toll = Math.floor(baseToll * roundMult);

    // 1. Pay Toll
    const actualToll = Math.min(activeP.gold, toll);
    activeP.gold -= actualToll;
    owner.gold += actualToll;

    sendSystemChatMessage(roomCode, `${activeP.name} 님이 ${owner.name} 님에게 통행료 ${actualToll}골드를 납부하셨습니다.`);

    // Check bankrupt from toll payment
    checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);

    // 2. Perform Takeover if active player is not bankrupt
    if (activeP.gold > 0) {
      const originalValue = tile.price + (tile.level - 1) * tile.upgradePrice;
      let multiplier = 2.0;
      if (tile.level === 1) multiplier = 1.5;
      else if (tile.level === 3) multiplier = 2.5;
      
      // Apply round multiplier to takeover cost
      const takeoverCost = Math.floor(originalValue * multiplier * roundMult);

      if (activeP.gold >= takeoverCost) {
        activeP.gold -= takeoverCost;
        owner.gold += takeoverCost;

        // Transfer ownership
        owner.properties = owner.properties.filter(idx => idx !== tileIndex);
        activeP.properties.push(tileIndex);

        tile.owner = room.gameState.activePlayerIdx;

        sendSystemChatMessage(roomCode, `💳 ${activeP.name} 님이 ${owner.name} 님의 ${tile.name} 기지를 ${takeoverCost}골드에 강제 인수했습니다!`);
        
        io.to(roomCode).emit("propertyTakeoverNotification", {
          buyerIdx: room.gameState.activePlayerIdx,
          sellerIdx: ownerIndex,
          tileIndex: tileIndex,
          cost: takeoverCost
        });
      }
    }

    io.to(roomCode).emit("closeTollModal");
    io.to(roomCode).emit("roomStateUpdate", room);
    endTurn(roomCode);
  });

  // Skip buy/upgrade
  socket.on("declineBuy", ({ roomCode }) => {
    endTurn(roomCode);
  });

  // Trap room landing complete
  socket.on("landTrapRoom", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    activeP.isTrapped = true;
    activeP.trappedTurns = 3;

    io.to(roomCode).emit("roomStateUpdate", room);
    endTurn(roomCode);
  });

  // Warp machine setup complete
  socket.on("landWarpMachine", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    activeP.hasWarpPending = true;

    io.to(roomCode).emit("roomStateUpdate", room);
    endTurn(roomCode);
  });

  // Teleport warp selection
  socket.on("warpPlayer", ({ roomCode, targetIndex }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const oldPos = activeP.position;
    activeP.position = targetIndex;
    activeP.hasWarpPending = false;

    // Check if crossed START
    let passedStart = false;
    if (targetIndex < oldPos) {
      passedStart = true;
      activeP.gold += 200;
      sendSystemChatMessage(roomCode, `🧪 ${activeP.name} 님이 과학 탐구실(START)을 통과하여 탐구 지원금 200골드를 획득하셨습니다.`);
    }

    sendSystemChatMessage(roomCode, `${activeP.name} 님이 ${room.gameState.boardTiles[targetIndex].name} 칸으로 우주 점프했습니다.`);
    
    io.to(roomCode).emit("roomStateUpdate", room);

    // Resolve landing directly
    socket.emit("triggerTileAction", { tile: room.gameState.boardTiles[targetIndex] });
  });

  // Draw Chance Card
  socket.on("drawChance", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    // Initialize custom card tracking counters if not present
    if (room.gameState.redistributionCount === undefined) room.gameState.redistributionCount = 0;
    if (room.gameState.propertyCrashCount === undefined) room.gameState.propertyCrashCount = 0;

    // Draw card with customized probabilities
    const r = Math.random();
    let card = null;

    if (r < 0.01 && room.gameState.redistributionCount < 1) {
      card = serverChanceCards.find(c => c.id === "gold_redistribution");
      room.gameState.redistributionCount++;
    } else if (r >= 0.01 && r < 0.02 && room.gameState.propertyCrashCount < 2) {
      card = serverChanceCards.find(c => c.id === "property_crash");
      room.gameState.propertyCrashCount++;
    }

    // Fallback: draw one of the other 13 normal cards uniformly
    if (!card) {
      const normalCards = serverChanceCards.filter(c => c.id !== "gold_redistribution" && c.id !== "property_crash");
      const cardIdx = Math.floor(Math.random() * normalCards.length);
      card = normalCards[cardIdx];
    }

    let actionMsg = "";
    if (card.type === "gold") {
      activeP.gold += card.amount;
      if (activeP.gold < 0) activeP.gold = 0;
      actionMsg = card.amount > 0 ? `${Math.abs(card.amount)}골드 획득!` : `${Math.abs(card.amount)}골드 차감.`;
      
      // Check bankrupt
      checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);
    } else if (card.type === "warp") {
      // Warp directly
      const oldPos = activeP.position;
      activeP.position = card.target;
      if (card.target === 8) {
        activeP.isTrapped = true;
        activeP.trappedTurns = 3;
        actionMsg = `절대 0도의 방으로 즉시 이동하여 갇힘!`;
      } else {
        if (card.target < oldPos) {
          activeP.gold += 200;
          sendSystemChatMessage(roomCode, `🧪 ${activeP.name} 님이 과학 탐구실(START)을 통과하여 탐구 지원금 200골드를 획득하셨습니다.`);
        }
        if (card.target === 16) {
          activeP.hasWarpPending = true;
        }
        actionMsg = `${room.gameState.boardTiles[card.target].name} 칸으로 즉시 이동!`;
      }
    } else if (card.type === "step") {
      // Step back/forward
      activeP.position = (activeP.position + card.steps + 32) % 32;
      actionMsg = `${Math.abs(card.steps)}칸 뒤로 이동!`;
    } else if (card.type === "custom") {
      if (card.id === "yellow_dust") {
        let collected = 0;
        room.players.forEach((p, idx) => {
          if (idx !== room.gameState.activePlayerIdx && p.gold > 0) {
            const payAmount = Math.min(p.gold, 50);
            p.gold -= payAmount;
            collected += payAmount;
            checkPlayerBankruptcy(roomCode, idx);
          }
        });
        activeP.gold += collected;
        actionMsg = `필터 교체비 총 ${collected}골드 획득!`;
      } else if (card.id === "expo_donation") {
        let activePlayers = room.players.filter(p => p.gold > 0);
        if (activePlayers.length > 0) {
          activePlayers.sort((a, b) => b.gold - a.gold);
          const richest = activePlayers[0];
          const poorest = activePlayers[activePlayers.length - 1];
          
          const richestIdx = room.players.indexOf(richest);
          const poorestIdx = room.players.indexOf(poorest);
          
          richest.gold = Math.max(0, richest.gold - 100);
          checkPlayerBankruptcy(roomCode, richestIdx);
          
          poorest.gold += 100;
          actionMsg = `기부와 지원이 완료되었습니다.`;
          sendSystemChatMessage(roomCode, `📢 가장 부유한 ${richest.name} 님이 100골드를 후원하고, 가장 가난한 ${poorest.name} 님이 100골드 지원금을 받았습니다.`);
        } else {
          actionMsg = `활성화된 플레이어가 없습니다.`;
        }
      } else if (card.id === "property_crash") {
        if (activeP.properties.length > 0) {
          // Sort properties by value in ascending order
          activeP.properties.sort((a, b) => {
            const tileA = room.gameState.boardTiles[a];
            const tileB = room.gameState.boardTiles[b];
            const valA = tileA.price + (tileA.level - 1) * tileA.upgradePrice;
            const valB = tileB.price + (tileB.level - 1) * tileB.upgradePrice;
            return valA - valB;
          });
          
          const tileIdx = activeP.properties.pop(); // Pop the most expensive
          const tile = room.gameState.boardTiles[tileIdx];
          const totalVal = tile.price + (tile.level - 1) * tile.upgradePrice;
          const refund = Math.floor(totalVal / 2);

          tile.owner = null;
          tile.level = 0;
          activeP.gold += refund;
          
          actionMsg = `${tile.name} 기지 반값 강제 매각 (+${refund}골드)`;
          sendSystemChatMessage(roomCode, `📉 부동산 대폭락! ${activeP.name} 님의 ${tile.name} 기지가 ${refund}골드에 강제 처분되어 매각되었습니다.`);
        } else {
          actionMsg = `소유한 기지가 없어 대폭락 피해를 면했습니다!`;
        }
      } else if (card.id === "gold_redistribution") {
        let activePlayers = room.players.filter(p => p.gold > 0);
        if (activePlayers.length > 0) {
          let totalGold = activePlayers.reduce((sum, p) => sum + p.gold, 0);
          let fairShare = Math.floor(totalGold / activePlayers.length);
          activePlayers.forEach(p => {
            p.gold = fairShare;
          });
          actionMsg = `전체 골드를 균등 분배 완료!`;
          sendSystemChatMessage(roomCode, `⚖️ 에너지 균형! 생존 플레이어들의 골드가 각 ${fairShare}골드로 평등하게 분배되었습니다.`);
        } else {
          actionMsg = `활성화된 플레이어가 없습니다.`;
        }
      } else if (card.id === "property_tax") {
        let propertyCount = activeP.properties.length;
        let tax = propertyCount * 20;
        activeP.gold = Math.max(0, activeP.gold - tax);
        actionMsg = `기지 점검 수수료 ${tax}골드 지불!`;
        checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);
      } else if (card.id === "property_bonus") {
        let propertyCount = activeP.properties.length;
        let bonus = propertyCount * 50;
        activeP.gold += bonus;
        actionMsg = `특허권 기술료 ${bonus}골드 획득!`;
      }
    }

    sendSystemChatMessage(roomCode, `🃏 찬스 발동 [${card.title}]: ${card.description}`);

    io.to(roomCode).emit("chanceDrawn", { card, actionMsg });
  });

  // End Chance turn
  socket.on("finishChanceTurn", ({ roomCode }) => {
    io.to(roomCode).emit("closeChanceModal");
    endTurn(roomCode);
  });

  // Draw Special Card (융합 과학 스페셜 - revised)
  socket.on("drawSpecialCard", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    // Roll probability
    const r = Math.random();
    let card = null;

    if (r < 0.04 && (room.gameState.discountTakeoverCount || 0) < 1) {
      card = serverSpecialCards.find(c => c.id === "property_discount_takeover");
      room.gameState.discountTakeoverCount = (room.gameState.discountTakeoverCount || 0) + 1;
    } else if (r >= 0.04 && r < 0.09) {
      card = serverSpecialCards.find(c => c.id === "gold_double_5");
    } else if (r >= 0.09 && r < 0.14) {
      card = serverSpecialCards.find(c => c.id === "gold_half_5");
    } else {
      // 86% pool shared equally among: gold_gain_300, gold_donate_300, property_upgrade, move_to_trap
      const normalIds = ["gold_gain_300", "gold_donate_300", "property_upgrade", "move_to_trap"];
      const selectedId = normalIds[Math.floor(Math.random() * normalIds.length)];
      card = serverSpecialCards.find(c => c.id === selectedId);
    }

    // Fallback if card is still null (e.g. if r < 0.04 but discountTakeoverCount is already >= 1)
    if (!card) {
      const normalIds = ["gold_gain_300", "gold_donate_300", "property_upgrade", "move_to_trap"];
      const selectedId = normalIds[Math.floor(Math.random() * normalIds.length)];
      card = serverSpecialCards.find(c => c.id === selectedId);
    }

    let actionMsg = "";
    let options = null;

    if (card.id === "gold_gain_300") {
      activeP.gold += 300;
      actionMsg = "+300골드 획득";
    } 
    else if (card.id === "gold_donate_300") {
      activeP.gold = Math.max(0, activeP.gold - 300);
      checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);
      actionMsg = "300골드 기부";
    } 
    else if (card.id === "property_discount_takeover") {
      options = [];
      room.gameState.boardTiles.forEach((tile, index) => {
        // Must be owned by an opponent, and level < 4 (no landmark)
        if (tile.owner !== null && tile.owner !== room.gameState.activePlayerIdx && tile.level < 4) {
          const originalValue = tile.price + (tile.level - 1) * tile.upgradePrice;
          let multiplier = 2.0;
          if (tile.level === 1) multiplier = 1.5;
          else if (tile.level === 3) multiplier = 2.5;
          
          // Apply round multiplier
          const turnCount = room.gameState.turnCount || 1;
          const roundMult = getRoundMultiplier(turnCount);
          const normalTakeoverCost = Math.floor(originalValue * multiplier * roundMult);
          const cost = Math.floor(normalTakeoverCost * 0.5); // 50% discount
          const ownerName = room.players[tile.owner].name;
          options.push({
            index: index,
            name: tile.name,
            ownerName: ownerName,
            cost: cost
          });
        }
      });
      actionMsg = "반값 인수권 획득";
    } 
    else if (card.id === "property_upgrade") {
      options = [];
      activeP.properties.forEach(tileIdx => {
        const tile = room.gameState.boardTiles[tileIdx];
        if (tile && tile.level < 4) {
          options.push({
            index: tileIdx,
            name: tile.name,
            level: tile.level
          });
        }
      });
      actionMsg = "연구 기지 무료 1단계 업그레이드 기회 획득";
    } 
    else if (card.id === "move_to_trap") {
      activeP.position = 8;
      activeP.isTrapped = true;
      activeP.trappedTurns = 3;
      actionMsg = "절대 0도의 방으로 전송";
    } 
    else if (card.id === "gold_double_5") {
      const bonus = activeP.gold;
      activeP.gold += bonus;
      actionMsg = "보유 골드 2배 복제 성공";
    } 
    else if (card.id === "gold_half_5") {
      const penalty = Math.floor(activeP.gold / 2);
      activeP.gold -= penalty;
      checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);
      actionMsg = "보유 골드 반토막 소실";
    }

    sendSystemChatMessage(roomCode, `💥 스페셜 찬스 발동 [${card.title}]: ${card.description}`);

    io.to(roomCode).emit("specialCardDrawn", { card, actionMsg, options });
  });

  socket.on("finishSpecialTurn", ({ roomCode }) => {
    io.to(roomCode).emit("closeSpecialModal");
    endTurn(roomCode);
  });

  // Handle choice for free level upgrade from property_upgrade special card
  socket.on("specialSelectUpgrade", ({ roomCode, tileIndex }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const tile = room.gameState.boardTiles[tileIndex];
    if (tile.owner !== room.gameState.activePlayerIdx) return;
    if (tile.level >= 4) return;

    tile.level += 1;
    const lvNames = ["공터", "간이 연구소", "지역 센터", "국립 과학관", "에너지 메가 돔 (랜드마크)"];
    sendSystemChatMessage(roomCode, `💎 스페셜 업그레이드! ${activeP.name} 님이 ${tile.name} 기지를 '${lvNames[tile.level]}'으로 무료 업그레이드했습니다.`);

    io.to(roomCode).emit("closeSpecialModal");
    io.to(roomCode).emit("roomStateUpdate", room);
    endTurn(roomCode);
  });

  // Handle choice for half-price takeover from property_discount_takeover special card
  socket.on("specialSelectTakeover", ({ roomCode, tileIndex }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const activeP = room.players[room.gameState.activePlayerIdx];
    if (activeP.socketId !== socket.id) return;

    const tile = room.gameState.boardTiles[tileIndex];
    if (tile.owner === null || tile.owner === room.gameState.activePlayerIdx || tile.level >= 4) return;

    const originalValue = tile.price + (tile.level - 1) * tile.upgradePrice;
    let multiplier = 2.0;
    if (tile.level === 1) multiplier = 1.5;
    else if (tile.level === 3) multiplier = 2.5;
    
    // Apply round multiplier
    const turnCount = room.gameState.turnCount || 1;
    const roundMult = getRoundMultiplier(turnCount);
    const normalTakeoverCost = Math.floor(originalValue * multiplier * roundMult);
    const discountCost = Math.floor(normalTakeoverCost * 0.5);

    if (activeP.gold >= discountCost) {
      const ownerIndex = tile.owner;
      const owner = room.players[ownerIndex];

      activeP.gold -= discountCost;
      owner.gold += discountCost;

      // Transfer ownership
      owner.properties = owner.properties.filter(idx => idx !== tileIndex);
      activeP.properties.push(tileIndex);
      tile.owner = room.gameState.activePlayerIdx;

      sendSystemChatMessage(roomCode, `💳 스페셜 인수! ${activeP.name} 님이 ${owner.name} 님의 ${tile.name} 기지를 반값인수(${discountCost}골드) 하였습니다.`);

      // Check if previous owner is bankrupt
      checkPlayerBankruptcy(roomCode, ownerIndex);
      checkPlayerBankruptcy(roomCode, room.gameState.activePlayerIdx);

      // Notify of takeover
      io.to(roomCode).emit("propertyTakeoverNotification", {
        buyerIdx: room.gameState.activePlayerIdx,
        sellerIdx: ownerIndex,
        tileIndex: tileIndex,
        cost: discountCost
      });
    }

    io.to(roomCode).emit("closeSpecialModal");
    io.to(roomCode).emit("roomStateUpdate", room);
    endTurn(roomCode);
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find room they were in
    for (const [code, room] of rooms.entries()) {
      const pIdx = room.players.findIndex(p => p.socketId === socket.id);
      if (pIdx !== -1) {
        const pName = room.players[pIdx].name;
        const isHost = room.players[pIdx].isHost;

        if (room.gameState.status === "playing") {
          // If game is in progress, mark player as offline, do NOT splice them out
          room.players[pIdx].isOffline = true;
          sendSystemChatMessage(code, `⚠️ ${pName} 님이 접속이 끊겼습니다. 재접속을 대기합니다.`);
          
          // Check if all players in the room are offline. If so, destroy the room.
          const allOffline = room.players.every(p => p.isOffline);
          if (allOffline) {
            rooms.delete(code);
            console.log(`Room ${code} deleted because all players disconnected.`);
          } else {
            io.to(code).emit("roomStateUpdate", room);
          }
        } else {
          // If game hasn't started yet, remove player completely (normal lobby behavior)
          room.players.splice(pIdx, 1);
          sendSystemChatMessage(code, `${pName} 님이 퇴장하셨습니다.`);

          if (room.players.length === 0) {
            rooms.delete(code);
            console.log(`Room ${code} deleted.`);
          } else {
            // Migrate host if host left
            if (isHost) {
              room.players[0].isHost = true;
              sendSystemChatMessage(code, `${room.players[0].name} 님이 방장이 되었습니다.`);
            }
            io.to(code).emit("roomStateUpdate", room);
          }
        }
        break;
      }
    }
  });
});

// Helper: Send System message in room chat
function sendSystemChatMessage(roomCode, message) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const chat = {
    sender: "SYSTEM",
    color: "#ffaa00",
    message: message,
    timestamp: new Date().toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' })
  };

  room.chatLogs.push(chat);
  io.to(roomCode).emit("chatReceived", chat);
}

// End Turn Core logic
function endTurn(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const activeP = room.players[room.gameState.activePlayerIdx];

  // 1. If player rolled 3 doubles, send to jail (4'33" room, Index 8)
  if (room.gameState.doubleCount >= 3) {
    room.gameState.doubleCount = 0;
    activeP.position = 8;
    activeP.isTrapped = true;
    activeP.trappedTurns = 3;
    sendSystemChatMessage(roomCode, `🚨 더블 3회 연속 달성! ${activeP.name} 님이 급격한 에너지 방출로 절대 0도의 방에 갇혔습니다.`);
  } 
  // 2. If double rolled, keep turn (unless they went bankrupt, or trapped on this turn)
  else if (room.gameState.doubleCount > 0 && activeP.gold > 0 && !activeP.isTrapped) {
    sendSystemChatMessage(roomCode, `🎲 더블! ${activeP.name} 님에게 주사위를 한 번 더 던질 기회가 주어집니다.`);
    io.to(roomCode).emit("roomStateUpdate", room);
    return;
  }

  // Proceed to next player
  room.gameState.doubleCount = 0; // Reset double count

  let loopCount = 0;
  let nextIdx = room.gameState.activePlayerIdx;
  
  do {
    nextIdx = (nextIdx + 1) % room.players.length;
    loopCount++;
    // Skip players with 0 gold (bankrupt)
  } while (room.players[nextIdx].gold <= 0 && loopCount < room.players.length);

  room.gameState.activePlayerIdx = nextIdx;

  // If we wrapped back to index 0, increment turn count
  if (nextIdx === 0) {
    room.gameState.turnCount++;
    if (room.gameState.turnCount > 30) {
      declareTimeGameOver(roomCode);
      return;
    }
  }

  // Double check if only 1 player remains active (others bankrupt)
  const activePlayers = room.players.filter(p => p.gold > 0);
  if (activePlayers.length === 1) {
    declareWinner(roomCode, activePlayers[0]);
    return;
  }

  io.to(roomCode).emit("roomStateUpdate", room);
}

// Bankruptcy liquidator
function checkPlayerBankruptcy(roomCode, playerIndex) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const p = room.players[playerIndex];
  if (p.gold <= 0) {
    p.gold = 0;
    
    // Liquidate properties
    if (p.properties.length > 0) {
      sendSystemChatMessage(roomCode, `⚠️ ${p.name} 님이 파산 위기로 개념 기지를 반값 매각합니다.`);
      p.properties.sort((a, b) => room.gameState.boardTiles[a].price - room.gameState.boardTiles[b].price);
      
      while (p.gold <= 0 && p.properties.length > 0) {
        const tileIdx = p.properties.pop();
        const tile = room.gameState.boardTiles[tileIdx];
        const totalVal = tile.price + (tile.level - 1) * tile.upgradePrice;
        const refund = Math.floor(totalVal / 2);

        tile.owner = null;
        tile.level = 0;
        p.gold += refund;

        sendSystemChatMessage(roomCode, `🪵 ${tile.name} 기지가 ${refund}골드에 강제 매각되었습니다.`);
      }
    }

    if (p.gold <= 0) {
      sendSystemChatMessage(roomCode, `💥 ${p.name} 님이 결국 파산(Bankrupt)하였습니다.`);
    }
  }
}

function declareWinner(roomCode, winner) {
  const room = rooms.get(roomCode);
  room.gameState.status = "finished";
  
  io.to(roomCode).emit("gameOver", {
    winnerName: winner.name,
    reason: `나머지 플레이어의 파산으로 인한 ${winner.name} 님의 최종 대승리!`
  });
}

function declareTimeGameOver(roomCode) {
  const room = rooms.get(roomCode);
  room.gameState.status = "finished";

  // Calculate total assets for everyone
  let winner = null;
  let maxAssets = -1;

  room.players.forEach((p, idx) => {
    // calculate estate value
    let estateVal = 0;
    p.properties.forEach((tileIdx) => {
      const tile = room.gameState.boardTiles[tileIdx];
      estateVal += tile.price + (tile.level - 1) * tile.upgradePrice;
    });
    p.estate = estateVal;
    const total = p.gold + p.estate;

    if (total > maxAssets) {
      maxAssets = total;
      winner = p;
    }
  });

  io.to(roomCode).emit("gameOver", {
    winnerName: winner.name,
    reason: `30턴 시간 초과! 최종 총자산 ${maxAssets.toLocaleString()}골드를 보유한 ${winner.name} 님의 최종 승리!`
  });
}

// Start Server Listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
