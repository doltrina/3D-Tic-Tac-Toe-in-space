/**
 * Cosmic 3D Tic-Tac-Toe
 * Built with Three.js r128, WebGL, custom space particles & shaders, Audio Synth
 */

// --- Audio Synthesizer ---
class CosmicAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playLaser(freqStart, freqEnd, duration = 0.18, type = 'sine') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playMoveX() {
    this.playLaser(600, 220, 0.2, 'sawtooth');
  }

  playMoveO() {
    this.playLaser(320, 750, 0.22, 'sine');
  }

  playHover() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const chords = [392, 523.25, 659.25, 783.99, 1046.5];
    chords.forEach((f, i) => {
      setTimeout(() => {
        this.playLaser(f, f * 1.5, 0.4, 'triangle');
      }, i * 110);
    });
  }

  playDraw() {
    this.playLaser(300, 150, 0.35, 'sawtooth');
  }

  playSignalSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      // Futuristic transmission chirp
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.07);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  playMessageSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      // Futuristic communicator ping
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  playPromptSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      // Two-tone prompt chime
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(523.25, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }
}

// --- Theme Configs ---
const THEMES = {
  'neon-deep': {
    colorX: 0x00f0ff,
    colorO: 0xff007f,
    gridColor: 0x1a365d,
    activeGrid: 0x00f0ff,
    bgSpace: 0x04060d,
    starsCount: 2200,
    nebulaA: 0x0044ff,
    nebulaB: 0xff007f
  },
  'solar-flare': {
    colorX: 0xffaa00,
    colorO: 0xff0044,
    gridColor: 0x4a2800,
    activeGrid: 0xff9900,
    bgSpace: 0x0c0604,
    starsCount: 2200,
    nebulaA: 0xff6600,
    nebulaB: 0x990022
  },
  'alien-matrix': {
    colorX: 0x00ff88,
    colorO: 0x00a2ff,
    gridColor: 0x08331e,
    activeGrid: 0x00ff88,
    bgSpace: 0x020a06,
    starsCount: 2200,
    nebulaA: 0x00ff66,
    nebulaB: 0x0044aa
  }
};

// --- Main 3D Space Game Class ---
class Cosmic3DGame {
  constructor() {
    this.audio = new CosmicAudio();
    this.dimension = '3d'; // '3d' (3x3x3 = 27 cells) or '2d' (3x3 = 9 cells)
    this.gameMode = 'pvp'; // 'pvp', 'ai-easy', 'ai-hard', 'lan'
    this.themeKey = 'neon-deep';
    this.figureStyle = 'cosmic'; // 'cosmic' (Crystal/Saturn) or 'classic' (Cross/Torus)
    this.firstTurn = 'X';
    this.currentPlayer = 'X';
    this.isGameOver = false;
    this.visibleLayer = 'all'; // 'all', 0, 1, 2 for Z levels
    this.scores = { X: 0, O: 0, ties: 0 };

    this.starSpeed = 0.0006;
    this.cellPositions = [];
    this.boardState = []; // indexed 0..26 for 3d, or 0..8 for 2d
    this.placedMeshes = [];
    this.cellPlaceholderMeshes = [];

    this.hoveredCellIndex = null;
    this.winningLinesIndices = [];

    // Pointer & Tap discrimination state (crucial for mobile touch vs orbit drag)
    this.pointerStartPos = { x: 0, y: 0 };
    this.pointerStartTime = 0;
    this.pointerIsDown = false;

    // LAN Multiplayer state
    this.isDirectJoining = false;
    this.lan = {
      ws: null,
      isConnected: false,
      role: null, // 'X', 'O', or 'SPECTATOR'
      roomId: this.generateRoomCode(),
      opponentConnected: false,
      isReady: false,
      playerReady: { X: false, O: false },
      primaryUrl: '',
      primaryIp: '',
      interfaces: []
    };

    // Center Cell 3D rule (disable move to dead center index 13)
    this.disableCenter = localStorage.getItem('cosmic_3d_disable_center') !== null
      ? (localStorage.getItem('cosmic_3d_disable_center') === 'true')
      : true;

    // Nickname, Tactical Chat & Mobile Signals state
    this.nickname = localStorage.getItem('cosmic_3d_nickname') || this.getRandomNickname();
    localStorage.setItem('cosmic_3d_nickname', this.nickname);
    this.opponentNickname = null;
    this.chatUnread = 0;
    this.chatOpen = false;
    this.mobileEmotesOpen = false;
    this.pendingRestartProposal = null;

    this.initThree();
    this.buildStarsAndNebula();
    this.cacheDom();
    this.updateCenterCellButtons();
    this.bindDomEvents();
    this.generateWinningCombinations();
    this.buildBoard();
    this.updateStatsDisplay();
    this.initLanManager();
    this.animate();
  }

  getRandomNickname() {
    const COSMIC_NAMES = ['Сверхновая', 'Квант-7', 'Войд-Пилот', 'Астро-Лорд', 'Небула-9', 'Космо-Рейнджер', 'Пульсар-X', 'Кибер-Орион', 'Галактик', 'Апекс-1', 'Сириус', 'Фотон-9', 'Звёздный-Лис', 'Метеор-42', 'Зенит', 'Титан-V', 'Вортекс', 'Гелиос'];
    const idx = Math.floor(Math.random() * COSMIC_NAMES.length);
    const suffix = Math.floor(10 + Math.random() * 89);
    return `${COSMIC_NAMES[idx]}-${suffix}`;
  }

  // Generate catchy, memorable short room codes (e.g. NOVA-42, STAR-18)
  generateRoomCode() {
    const codenames = ['NOVA', 'STAR', 'VOID', 'PULSE', 'WARP', 'APEX', 'LUNA', 'MARS', 'AERO', 'SOLAR', 'CYBER', 'ZENITH', 'COSMO', 'ORION', 'COMET', 'NEBULA'];
    const name = codenames[Math.floor(Math.random() * codenames.length)];
    const num = Math.floor(10 + Math.random() * 89);
    return `${name}-${num}`;
  }

  // --- Three.js Setup ---
  initThree() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(THEMES[this.themeKey].bgSpace);
    this.scene.fog = new THREE.FogExp2(THEMES[this.themeKey].bgSpace, 0.015);

    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.resetCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Orbit controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 50;
    this.controls.minDistance = 6;

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.2);
    this.dirLight1.position.set(10, 20, 15);
    this.scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0xff007f, 1.2);
    this.dirLight2.position.set(-15, -10, -10);
    this.scene.add(this.dirLight2);

    // Raycaster for 3D interactions
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener('resize', () => this.onWindowResize());

    // Both desktop mouse and mobile touch listeners
    this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.renderer.domElement.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
  }

  resetCameraPosition() {
    const isPortrait = window.innerWidth < window.innerHeight;
    if (this.dimension === '3d') {
      if (isPortrait) {
        // Pulled back on mobile portrait to ensure 3D cube is completely visible and centered
        this.camera.position.set(16, 13, 20);
      } else {
        this.camera.position.set(12, 10, 16);
      }
    } else {
      if (isPortrait) {
        this.camera.position.set(0, 16, 18);
      } else {
        this.camera.position.set(0, 12, 14);
      }
    }
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  buildStarsAndNebula() {
    // Starfield particles
    const theme = THEMES[this.themeKey];
    const starGeo = new THREE.BufferGeometry();
    const starCount = theme.starsCount;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const c1 = new THREE.Color(theme.nebulaA);
    const c2 = new THREE.Color(theme.nebulaB);
    const cWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      const radius = 60 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[idx] = radius * Math.sin(phi) * Math.cos(theta);
      positions[idx + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[idx + 2] = radius * Math.cos(phi);

      const mix = Math.random();
      const col = mix < 0.6 ? cWhite : (mix < 0.8 ? c1 : c2);
      colors[idx] = col.r;
      colors[idx + 1] = col.g;
      colors[idx + 2] = col.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starPoints);
  }

  // Pre-calculate winning combos
  generateWinningCombinations() {
    this.winningCombinations = [];

    if (this.dimension === '2d') {
      // 3x3 plane (indices 0..8)
      // Rows
      for (let r = 0; r < 3; r++) {
        this.winningCombinations.push([r * 3, r * 3 + 1, r * 3 + 2]);
      }
      // Cols
      for (let c = 0; c < 3; c++) {
        this.winningCombinations.push([c, c + 3, c + 6]);
      }
      // Diagonals
      this.winningCombinations.push([0, 4, 8]);
      this.winningCombinations.push([2, 4, 6]);
    } else {
      // 3x3x3 Cube (indices 0..26)
      // coordinate map index -> {x, y, z} where coords in {0,1,2}
      // index = x + y*3 + z*9
      const getIdx = (x, y, z) => x + y * 3 + z * 9;

      // 1. Lines along axes (3 * 9 = 27 lines)
      // Along X
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          this.winningCombinations.push([getIdx(0, y, z), getIdx(1, y, z), getIdx(2, y, z)]);
        }
      }
      // Along Y
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          this.winningCombinations.push([getIdx(x, 0, z), getIdx(x, 1, z), getIdx(x, 2, z)]);
        }
      }
      // Along Z
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          this.winningCombinations.push([getIdx(x, y, 0), getIdx(x, y, 1), getIdx(x, y, 2)]);
        }
      }

      // 2. Planar diagonals (2 per plane * 3 axes * 3 slices = 18 lines)
      // In XY planes for each Z
      for (let z = 0; z < 3; z++) {
        this.winningCombinations.push([getIdx(0, 0, z), getIdx(1, 1, z), getIdx(2, 2, z)]);
        this.winningCombinations.push([getIdx(2, 0, z), getIdx(1, 1, z), getIdx(0, 2, z)]);
      }
      // In XZ planes for each Y
      for (let y = 0; y < 3; y++) {
        this.winningCombinations.push([getIdx(0, y, 0), getIdx(1, y, 1), getIdx(2, y, 2)]);
        this.winningCombinations.push([getIdx(2, y, 0), getIdx(1, y, 1), getIdx(0, y, 2)]);
      }
      // In YZ planes for each X
      for (let x = 0; x < 3; x++) {
        this.winningCombinations.push([getIdx(x, 0, 0), getIdx(x, 1, 1), getIdx(x, 2, 2)]);
        this.winningCombinations.push([getIdx(x, 2, 0), getIdx(x, 1, 1), getIdx(x, 0, 2)]);
      }

      // 3. Main 4 space diagonals across the full 3D cube!
      this.winningCombinations.push([getIdx(0, 0, 0), getIdx(1, 1, 1), getIdx(2, 2, 2)]);
      this.winningCombinations.push([getIdx(2, 0, 0), getIdx(1, 1, 1), getIdx(0, 2, 2)]);
      this.winningCombinations.push([getIdx(0, 2, 0), getIdx(1, 1, 1), getIdx(2, 0, 2)]);
      this.winningCombinations.push([getIdx(2, 2, 0), getIdx(1, 1, 1), getIdx(0, 0, 2)]);
    }
  }

  buildBoard() {
    // Clear old elements
    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
    }
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    this.cellPositions = [];
    this.cellPlaceholderMeshes = [];
    this.placedMeshes = [];

    const spacing = 3.6;
    const theme = THEMES[this.themeKey];

    if (this.dimension === '2d') {
      this.boardState = Array(9).fill(null);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const index = r * 3 + c;
          const pos = new THREE.Vector3((c - 1) * spacing, 0, (r - 1) * spacing);
          this.cellPositions.push(pos);
          this.createPlaceholderCell(index, pos, 0);
        }
      }
    } else {
      this.boardState = Array(27).fill(null);
      for (let z = 0; z < 3; z++) {
        for (let y = 0; y < 3; y++) {
          for (let x = 0; x < 3; x++) {
            const index = x + y * 3 + z * 9;
            const pos = new THREE.Vector3(
              (x - 1) * spacing,
              (y - 1) * spacing,
              (z - 1) * spacing
            );
            this.cellPositions.push(pos);
            this.createPlaceholderCell(index, pos, z);
          }
        }
      }
    }

    this.createGridLines();
    this.applyLayerVisibility();
  }

  createPlaceholderCell(index, pos, zLevel) {
    const isBlockedCenter = (this.dimension === '3d' && index === 13 && this.disableCenter);

    // Outer translucent sphere node
    const geo = new THREE.SphereGeometry(0.75, 24, 24);
    const mat = new THREE.MeshPhysicalMaterial({
      color: isBlockedCenter ? 0xff0044 : 0x224488,
      transparent: true,
      opacity: isBlockedCenter ? 0.38 : 0.18,
      roughness: 0.2,
      transmission: isBlockedCenter ? 0.2 : 0.6,
      ior: 1.4,
      wireframe: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData = { index, zLevel, isCellPlaceholder: true, isBlocked: isBlockedCenter };

    if (isBlockedCenter) {
      // Cosmic barrier core: glowing red/crimson torus
      const coreGeo = new THREE.TorusGeometry(0.35, 0.08, 12, 24);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xff0055,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.rotation.x = Math.PI / 4;
      core.userData = { index, isBlocked: true };
      mesh.add(core);

      // Warning inner disc
      const ringGeo = new THREE.RingGeometry(0.18, 0.42, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff1144,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.userData = { index, isBlocked: true };
      mesh.add(ring);
    } else {
      // Small pulsing core indicator
      const coreGeo = new THREE.OctahedronGeometry(0.2, 0);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x4a7cff,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.userData = { index };
      mesh.add(core);
    }

    // Invisible hit proxy with enlarged radius for effortless touch on mobile phones
    const hitProxyGeo = new THREE.SphereGeometry(1.25, 12, 12);
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxy.userData = { index, isHitProxy: true, isBlocked: isBlockedCenter };
    mesh.add(hitProxy);

    this.boardGroup.add(mesh);
    this.cellPlaceholderMeshes.push(mesh);
  }

  createGridLines() {
    const theme = THEMES[this.themeKey];
    const lineMat = new THREE.LineBasicMaterial({
      color: theme.gridColor,
      transparent: true,
      opacity: 0.35
    });

    // Outer bounding wireframe box
    const size = this.dimension === '3d' ? 7.6 : 7.6;
    const boxGeo = this.dimension === '3d'
      ? new THREE.BoxGeometry(size, size, size)
      : new THREE.BoxGeometry(size, 0.1, size);

    const edges = new THREE.EdgesGeometry(boxGeo);
    const wire = new THREE.LineSegments(edges, lineMat);
    this.boardGroup.add(wire);
  }

  // --- Dynamic 3D Figure Creation ---
  createFigureMesh(player, pos) {
    const theme = THEMES[this.themeKey];
    const isX = player === 'X';
    const colorHex = isX ? theme.colorX : theme.colorO;
    const group = new THREE.Group();
    group.position.copy(pos);

    if (this.figureStyle === 'classic') {
      if (isX) {
        // 3D Cross (Two intersecting cylinders/bars)
        const barGeo = new THREE.CylinderGeometry(0.22, 0.22, 2.2, 16);
        const barMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.6,
          roughness: 0.2,
          metalness: 0.8
        });

        const bar1 = new THREE.Mesh(barGeo, barMat);
        bar1.rotation.z = Math.PI / 4;
        const bar2 = new THREE.Mesh(barGeo, barMat);
        bar2.rotation.z = -Math.PI / 4;

        group.add(bar1);
        group.add(bar2);
      } else {
        // 3D Torus
        const torusGeo = new THREE.TorusGeometry(1.0, 0.25, 20, 36);
        const torusMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.6,
          roughness: 0.2,
          metalness: 0.8
        });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        group.add(torus);
      }
    } else {
      // Cosmic figure style
      if (isX) {
        // Cosmic Stella / Quad-Crystal Supernova
        const crystalGeo = new THREE.OctahedronGeometry(1.1, 0);
        const crystalMat = new THREE.MeshPhysicalMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.7,
          roughness: 0.1,
          transmission: 0.4,
          metalness: 0.5
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);

        // Surrounding orbital ring
        const ringGeo = new THREE.TorusGeometry(1.3, 0.05, 12, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 3;

        group.add(crystal);
        group.add(ring);
      } else {
        // Antimatter Ring Planet / Saturn Vortex
        const sphereGeo = new THREE.SphereGeometry(0.7, 24, 24);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.5,
          roughness: 0.3,
          metalness: 0.8
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);

        const ringGeo = new THREE.RingGeometry(0.9, 1.45, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.2;

        group.add(sphere);
        group.add(ring);
      }
    }

    // Spawn entrance animation scaling
    group.scale.set(0.01, 0.01, 0.01);
    group.userData = { targetScale: 1, currentScale: 0.01, player };

    this.boardGroup.add(group);
    return group;
  }

  // --- Interaction / Raycast ---
  // --- Interaction / Raycast & Tap Detection ---
  onPointerMove(e) {
    // On touch devices, do not do mouse hover highlighting during orbit rotation
    if (e.pointerType === 'touch') return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const activePlaceholders = this.cellPlaceholderMeshes.filter(m => m.visible && this.boardState[m.userData.index] === null);
    const intersects = this.raycaster.intersectObjects(activePlaceholders, true);

    let newHoverIndex = null;
    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      while (hitObj && hitObj.userData.index === undefined && hitObj.parent) {
        hitObj = hitObj.parent;
      }
      if (hitObj && hitObj.userData.index !== undefined) {
        const idx = hitObj.userData.index;
        if (this.boardState[idx] === null && !this.isGameOver) {
          // If center is blocked in 3D, do not highlight as a valid move target
          if (!(this.dimension === '3d' && idx === 13 && this.disableCenter)) {
            if (this.gameMode !== 'lan' || (this.lan.isConnected && this.lan.role === this.currentPlayer)) {
              newHoverIndex = idx;
            }
          }
        }
      }
    }

    if (newHoverIndex !== this.hoveredCellIndex) {
      // Un-highlight previous
      if (this.hoveredCellIndex !== null && this.cellPlaceholderMeshes[this.hoveredCellIndex]) {
        const prevMesh = this.cellPlaceholderMeshes[this.hoveredCellIndex];
        const isPrevBlocked = (this.dimension === '3d' && this.hoveredCellIndex === 13 && this.disableCenter);
        prevMesh.material.opacity = isPrevBlocked ? 0.38 : 0.18;
        prevMesh.material.color.setHex(isPrevBlocked ? 0xff0044 : 0x224488);
        prevMesh.scale.set(1, 1, 1);
      }

      this.hoveredCellIndex = newHoverIndex;

      // Highlight new
      if (this.hoveredCellIndex !== null) {
        const nextMesh = this.cellPlaceholderMeshes[this.hoveredCellIndex];
        const isX = this.currentPlayer === 'X';
        const color = isX ? THEMES[this.themeKey].colorX : THEMES[this.themeKey].colorO;
        nextMesh.material.opacity = 0.55;
        nextMesh.material.color.setHex(color);
        nextMesh.scale.set(1.18, 1.18, 1.18);
        this.audio.playHover();
      }
    }
  }

  onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.pointerStartPos = { x: e.clientX, y: e.clientY };
    this.pointerStartTime = performance.now();
    this.pointerIsDown = true;
  }

  onPointerCancel() {
    this.pointerIsDown = false;
  }

  onPointerUp(e) {
    if (!this.pointerIsDown) return;
    this.pointerIsDown = false;

    const dx = e.clientX - this.pointerStartPos.x;
    const dy = e.clientY - this.pointerStartPos.y;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - this.pointerStartTime;

    // Distinguish a clean click/tap from dragging camera rotation!
    // Movement under 14px and duration under 480ms is treated as a deliberate tap
    if (dist < 14 && dt < 480) {
      this.handleCellTap(e.clientX, e.clientY);
    }
  }

  handleCellTap(clientX, clientY) {
    if (this.isGameOver) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const activePlaceholders = this.cellPlaceholderMeshes.filter(m => m.visible && this.boardState[m.userData.index] === null);
    const intersects = this.raycaster.intersectObjects(activePlaceholders, true);

    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      while (hitObj && hitObj.userData.index === undefined && hitObj.parent) {
        hitObj = hitObj.parent;
      }
      if (hitObj && hitObj.userData.index !== undefined) {
        const idx = hitObj.userData.index;
        this.attemptCellMove(idx);
      }
    }
  }

  attemptCellMove(idx) {
    if (this.boardState[idx] !== null || this.isGameOver) return;

    if (this.dimension === '3d' && idx === 13 && this.disableCenter) {
      this.flashTurnBanner('🚫 Ядро куба заблокировано настройками боя!', '#ff0055');
      this.audio.playLaser(180, 80, 0.25, 'sawtooth');
      if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
      return;
    }

    if (this.gameMode === 'lan') {
      if (!this.lan.isConnected) {
        this.openLanModal();
        return;
      }
      if (this.lan.role === 'SPECTATOR') {
        this.flashTurnBanner('Вы в режиме наблюдателя', 'var(--text-muted)');
        return;
      }
      // Strict role enforcement: a device can ONLY move for its assigned role!
      if (this.lan.role !== this.currentPlayer) {
        const myName = this.lan.role === 'X' ? 'Сверхновой (X)' : 'Антиматерии (O)';
        const oppName = this.lan.role === 'X' ? 'Антиматерии (O)' : 'Сверхновой (X)';
        this.flashTurnBanner(`Сейчас ход соперника: ${oppName}! (Вы: ${myName})`, '#ff007f');
        this.audio.playDraw();
        return;
      }

      if (navigator.vibrate) navigator.vibrate(35);
      this.sendLanMove(idx);
      return;
    }

    if (this.gameMode !== 'pvp' && this.currentPlayer === 'O') return;

    if (navigator.vibrate) navigator.vibrate(35);
    this.makeMove(idx, this.currentPlayer);

    if (!this.isGameOver && this.gameMode !== 'pvp' && this.currentPlayer === 'O') {
      setTimeout(() => this.triggerAiMove(), 380);
    }
  }

  placePiece(index, player) {
    if (this.boardState[index] !== null) return;

    this.boardState[index] = player;
    const pos = this.cellPositions[index];

    // Hide placeholder sphere
    const placeholder = this.cellPlaceholderMeshes[index];
    if (placeholder) {
      placeholder.visible = false;
    }

    // Spawn 3D figure
    const mesh = this.createFigureMesh(player, pos);
    mesh.userData.zLevel = placeholder ? placeholder.userData.zLevel : 0;
    this.placedMeshes[index] = mesh;

    if (player === 'X') {
      this.audio.playMoveX();
    } else {
      this.audio.playMoveO();
    }
  }

  makeMove(index, player) {
    if (this.boardState[index] !== null || this.isGameOver) return;

    this.placePiece(index, player);

    // Check game condition
    const win = this.checkWin(this.boardState);
    if (win) {
      this.handleWin(win);
    } else if (this.isBoardFull()) {
      this.handleDraw();
    } else {
      this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
      this.updateTurnDisplay();
    }
  }

  triggerAiMove() {
    if (this.isGameOver) return;

    let move = null;
    if (this.dimension === '2d') {
      if (this.gameMode === 'ai-easy') {
        move = Math.random() < 0.6 ? this.getRandomMove() : this.getBestMove2D();
      } else {
        move = this.getBestMove2D();
      }
    } else {
      // 3D AI
      if (this.gameMode === 'ai-easy') {
        move = Math.random() < 0.7 ? this.getRandomMove() : this.getHeuristicMove3D();
      } else {
        move = this.getHeuristicMove3D();
      }
    }

    if (move !== null && move !== undefined) {
      this.makeMove(move, 'O');
    }
  }

  getRandomMove() {
    const free = [];
    this.boardState.forEach((val, i) => {
      if (val === null) {
        if (this.dimension === '3d' && i === 13 && this.disableCenter) return;
        free.push(i);
      }
    });
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  // 2D Minimax
  getBestMove2D() {
    let bestScore = -Infinity;
    let bestMove = null;

    for (let i = 0; i < 9; i++) {
      if (this.boardState[i] === null) {
        this.boardState[i] = 'O';
        const score = this.minimax2D(this.boardState, 0, false);
        this.boardState[i] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }
    return bestMove !== null ? bestMove : this.getRandomMove();
  }

  minimax2D(board, depth, isMaximizing) {
    const win = this.checkWin(board);
    if (win) {
      return win.player === 'O' ? 10 - depth : depth - 10;
    }
    if (this.isBoardFull(board)) return 0;

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'O';
          maxScore = Math.max(maxScore, this.minimax2D(board, depth + 1, false));
          board[i] = null;
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'X';
          minScore = Math.min(minScore, this.minimax2D(board, depth + 1, true));
          board[i] = null;
        }
      }
      return minScore;
    }
  }

  // 3D Strategic Heuristic (Instant response for 27 cells)
  getHeuristicMove3D() {
    // 1. Can AI win immediately in one move?
    for (let i = 0; i < 27; i++) {
      if (i === 13 && this.disableCenter) continue;
      if (this.boardState[i] === null) {
        this.boardState[i] = 'O';
        if (this.checkWin(this.boardState)) {
          this.boardState[i] = null;
          return i;
        }
        this.boardState[i] = null;
      }
    }

    // 2. Can Player win immediately? Block them!
    for (let i = 0; i < 27; i++) {
      if (i === 13 && this.disableCenter) continue;
      if (this.boardState[i] === null) {
        this.boardState[i] = 'X';
        if (this.checkWin(this.boardState)) {
          this.boardState[i] = null;
          return i;
        }
        this.boardState[i] = null;
      }
    }

    // 3. Score potential moves by how many winning lines they participate in
    let bestScore = -1;
    let candidateMoves = [];

    // Prioritize center cube (1,1,1 -> index 13) if permitted
    const centerIdx = 13;
    if (!this.disableCenter && this.boardState[centerIdx] === null) {
      return centerIdx;
    }

    for (let i = 0; i < 27; i++) {
      if (i === 13 && this.disableCenter) continue;
      if (this.boardState[i] === null) {
        let score = 0;
        for (const combo of this.winningCombinations) {
          if (combo.includes(i)) {
            const hasO = combo.some(c => this.boardState[c] === 'O');
            const hasX = combo.some(c => this.boardState[c] === 'X');
            if (hasO && !hasX) score += 4; // Extend our line
            else if (!hasO && hasX) score += 3; // Block opponent potential
            else if (!hasO && !hasX) score += 1; // Open line
          }
        }
        if (score > bestScore) {
          bestScore = score;
          candidateMoves = [i];
        } else if (score === bestScore) {
          candidateMoves.push(i);
        }
      }
    }

    return candidateMoves.length ? candidateMoves[Math.floor(Math.random() * candidateMoves.length)] : this.getRandomMove();
  }

  checkWin(board = this.boardState) {
    for (const combo of this.winningCombinations) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { player: board[a], combo };
      }
    }
    return null;
  }

  isBoardFull(board = this.boardState) {
    if (this.dimension === '3d' && this.disableCenter) {
      return board.every((cell, idx) => idx === 13 || cell !== null);
    }
    return board.every(cell => cell !== null);
  }

  handleWin(winResult) {
    this.isGameOver = true;
    const { player, combo } = winResult;
    this.scores[player]++;
    this.updateStatsDisplay();
    this.audio.playVictory();

    // Spawn 3D Energy Beam across winning combo
    this.drawWinningLaserBeam(combo, player);

    let winnerTitle = '';
    if (this.gameMode === 'lan') {
      const isMe = this.lan.role === player;
      const baseName = player === 'X' ? 'СВЕРХНОВАЯ (X)' : 'АНТИМАТЕРИЯ (O)';
      winnerTitle = isMe ? `${baseName} (ВЫ)` : `${baseName} (СОПЕРНИК)`;
    } else {
      winnerTitle = player === 'X'
        ? 'СВЕРХНОВАЯ (X)'
        : (this.gameMode === 'pvp' ? 'АНТИМАТЕРИЯ (O)' : 'КВАНТОВЫЙ ИИ');
    }

    this.turnBannerText.innerHTML = `🏆 Победитель: <b style="color:${player === 'X' ? 'var(--neon-cyan)' : 'var(--neon-magenta)'}">${winnerTitle}</b>`;

    setTimeout(() => {
      this.modalWinnerTitle.textContent = 'ПОБЕДА!';
      this.modalWinnerDesc.textContent = `${winnerTitle} одержал абсолютное превосходство в секторе!`;
      this.modalGlow.style.background = player === 'X'
        ? 'radial-gradient(circle, rgba(0, 240, 255, 0.5) 0%, transparent 70%)'
        : 'radial-gradient(circle, rgba(255, 0, 127, 0.5) 0%, transparent 70%)';
      this.modalOverlay.classList.add('active');
    }, 900);
  }

  handleDraw() {
    this.isGameOver = true;
    this.scores.ties++;
    this.updateStatsDisplay();
    this.audio.playDraw();

    this.turnBannerText.textContent = '⚖ ВРЕМЕННЫЙ ПАРИТЕТ (НИЧЬЯ)';

    setTimeout(() => {
      this.modalWinnerTitle.textContent = 'РАВНОВЕСИЕ';
      this.modalWinnerDesc.textContent = 'Ни одна из космических сил не смогла одолеть соперника!';
      this.modalOverlay.classList.add('active');
    }, 700);
  }

  drawWinningLaserBeam(combo, player) {
    const posA = this.cellPositions[combo[0]];
    const posC = this.cellPositions[combo[2]];

    const distance = posA.distanceTo(posC) + 2.5;
    const cylinderGeo = new THREE.CylinderGeometry(0.18, 0.18, distance, 16);
    const theme = THEMES[this.themeKey];
    const beamColor = player === 'X' ? theme.colorX : theme.colorO;

    const beamMat = new THREE.MeshBasicMaterial({
      color: beamColor,
      transparent: true,
      opacity: 0.95
    });

    const beam = new THREE.Mesh(cylinderGeo, beamMat);
    const midPoint = new THREE.Vector3().addVectors(posA, posC).multiplyScalar(0.5);
    beam.position.copy(midPoint);

    // Orient cylinder along direction
    const direction = new THREE.Vector3().subVectors(posC, posA).normalize();
    const arrow = new THREE.Vector3(0, 1, 0);
    beam.quaternion.setFromUnitVectors(arrow, direction);

    this.boardGroup.add(beam);
    this.laserBeamMesh = beam;

    // Pulse winning pieces
    combo.forEach(idx => {
      if (this.placedMeshes[idx]) {
        this.placedMeshes[idx].userData.isWinner = true;
      }
    });
  }

  // --- Layer Visibility Filter for 3D Cube ---
  cycleLayerVisibility() {
    if (this.dimension === '2d') return;

    if (this.visibleLayer === 'all') this.visibleLayer = 0;
    else if (this.visibleLayer === 0) this.visibleLayer = 1;
    else if (this.visibleLayer === 1) this.visibleLayer = 2;
    else this.visibleLayer = 'all';

    const label = this.visibleLayer === 'all'
      ? '👁 ВСЕ СЛОИ (Z)'
      : `👁 СЛОЙ Z = ${this.visibleLayer + 1}`;
    document.getElementById('layer-btn-text').textContent = label;

    this.applyLayerVisibility();
  }

  applyLayerVisibility() {
    const is3d = this.dimension === '3d';
    this.cellPlaceholderMeshes.forEach(mesh => {
      const z = mesh.userData.zLevel;
      const isVisible = !is3d || this.visibleLayer === 'all' || this.visibleLayer === z;
      const idx = mesh.userData.index;
      mesh.visible = isVisible && (this.boardState[idx] === null);
    });

    this.placedMeshes.forEach((mesh, idx) => {
      if (mesh) {
        const z = mesh.userData.zLevel;
        mesh.visible = !is3d || this.visibleLayer === 'all' || this.visibleLayer === z;
      }
    });
  }

  // --- Reset & New Round ---
  resetRound(isSynced = false) {
    if (this.gameMode === 'lan' && this.lan.isConnected && !isSynced) {
      this.proposeRestart();
      return;
    }

    this.isGameOver = false;
    this.hoveredCellIndex = null;
    this.modalOverlay.classList.remove('active');
    if (this.promptRestartModal) {
      this.promptRestartModal.classList.remove('active');
    }
    if (this.toastRestartWaiting) {
      this.toastRestartWaiting.style.display = 'none';
    }

    // Remove beam
    if (this.laserBeamMesh) {
      this.boardGroup.remove(this.laserBeamMesh);
      this.laserBeamMesh = null;
    }

    this.buildBoard();
    this.currentPlayer = this.firstTurn;
    this.updateTurnDisplay();

    if (this.gameMode !== 'pvp' && this.gameMode !== 'lan' && this.currentPlayer === 'O') {
      setTimeout(() => this.triggerAiMove(), 450);
    }
  }

  proposeRestart(turn = null) {
    if (!this.lan.isConnected || !this.lan.ws) {
      this.resetRound(true);
      return;
    }

    this.lan.ws.send(JSON.stringify({
      type: 'PROPOSE_RESTART',
      nickname: this.nickname,
      firstTurn: turn
    }));
  }

  proposeRestartWithTurn(turn) {
    if (this.settingsDrawer) {
      this.settingsDrawer.classList.remove('open');
    }
    const roleName = turn === 'X' ? 'Сверхновая (X)' : 'Антиматерия (O)';
    this.flashTurnBanner(`⏳ Запрос сопернику на перезапуск с первым ходом: ${roleName}...`, 'var(--neon-gold)');
    this.proposeRestart(turn);
  }

  respondRestart(accept) {
    if (this.promptRestartModal) {
      this.promptRestartModal.classList.remove('active');
    }

    if (this.lan.isConnected && this.lan.ws) {
      this.lan.ws.send(JSON.stringify({
        type: 'RESPOND_RESTART',
        accept
      }));
    }
  }

  cancelRestartRequest() {
    if (this.toastRestartWaiting) {
      this.toastRestartWaiting.style.display = 'none';
    }

    if (this.lan.isConnected && this.lan.ws) {
      this.lan.ws.send(JSON.stringify({
        type: 'CANCEL_RESTART_REQUEST'
      }));
    }
  }

  resetAllStats() {
    if (this.gameMode === 'lan' && this.lan.isConnected) {
      this.lan.ws.send(JSON.stringify({ type: 'RESET_ALL_SCORES' }));
      return;
    }
    this.scores = { X: 0, O: 0, ties: 0 };
    this.updateStatsDisplay();
    this.resetRound();
  }

  // --- UI & Dom Bindings ---
  cacheDom() {
    this.cosmicHeader = document.querySelector('.cosmic-header');
    this.turnBannerText = document.getElementById('turn-banner-text');
    this.statCardX = document.getElementById('stat-card-x');
    this.statCardO = document.getElementById('stat-card-o');
    this.scoreP1 = document.getElementById('score-p1');
    this.scoreP2 = document.getElementById('score-p2');
    this.scoreDraw = document.getElementById('score-draw');
    this.labelP1 = document.getElementById('label-p1');
    this.labelP2 = document.getElementById('label-p2');
    this.labelDraw = document.getElementById('label-draw');

    // Header buttons & room chip
    this.headerRoomChip = document.getElementById('header-room-chip');
    this.headerRoomCode = document.getElementById('header-room-code');
    this.btnMainMenu = document.getElementById('btn-main-menu');
    this.btnHeaderCollapse = document.getElementById('btn-header-collapse');

    // Winner Modal
    this.modalOverlay = document.getElementById('victory-modal');
    this.modalWinnerTitle = document.getElementById('modal-winner-title');
    this.modalWinnerDesc = document.getElementById('modal-winner-desc');
    this.modalGlow = document.getElementById('modal-glow');
    this.modalBtnAgain = document.getElementById('modal-btn-again');

    // Settings drawer
    this.settingsDrawer = document.getElementById('settings-drawer');

    // Main Menu Modal Elements
    this.mainMenuModal = document.getElementById('main-menu-modal');
    this.menuBtnPvp = document.getElementById('menu-btn-pvp');
    this.menuBtnLanFlow = document.getElementById('menu-btn-lan-flow');
    this.menuBtnAiEasy = document.getElementById('menu-btn-ai-easy');
    this.menuBtnAiHard = document.getElementById('menu-btn-ai-hard');
    this.menuPrimaryModes = document.getElementById('menu-primary-modes');
    this.menuLanSubpanel = document.getElementById('menu-lan-subpanel');

    // LAN Tab Elements in Main Menu
    this.tabBtnCreateRoom = document.getElementById('tab-btn-create-room');
    this.tabBtnJoinRoom = document.getElementById('tab-btn-join-room');
    this.viewHostRoom = document.getElementById('view-host-room');
    this.viewJoinRoom = document.getElementById('view-join-room');

    this.hostRoomCodeVal = document.getElementById('host-room-code-val');
    this.btnCopyRoomCode = document.getElementById('btn-copy-room-code');
    this.btnRegenRoomCode = document.getElementById('btn-regen-room-code');
    this.hostQrImage = document.getElementById('host-qr-image');
    this.hostQrFallback = document.getElementById('host-qr-fallback');
    this.hostDirectUrl = document.getElementById('host-direct-url');
    this.btnCopyDirectUrl = document.getElementById('btn-copy-direct-url');
    this.hostWaitingStatus = document.getElementById('host-waiting-status');
    this.hostWaitingText = document.getElementById('host-waiting-text');
    this.hostFirstTurnControl = document.getElementById('host-first-turn-control');
    this.hostCenterCellControl = document.getElementById('host-center-cell-control');
    this.centerCellControl = document.getElementById('center-cell-control');
    this.btnHostStartGame = document.getElementById('btn-host-start-game');
    this.btnLanReady = document.getElementById('btn-lan-ready');
    this.btnReadyText = document.getElementById('btn-ready-text');
    this.lobbyRowHost = document.getElementById('lobby-row-host');
    this.lobbyNickHost = document.getElementById('lobby-nick-host');
    this.lobbyReadyBadgeHost = document.getElementById('lobby-ready-badge-host');
    this.lobbyRowGuest = document.getElementById('lobby-row-guest');
    this.lobbyNickGuest = document.getElementById('lobby-nick-guest');
    this.lobbyReadyBadgeGuest = document.getElementById('lobby-ready-badge-guest');
    this.lobbyWaitingBeacon = document.getElementById('lobby-waiting-beacon');
    this.btnLanBackToModes = document.getElementById('btn-lan-back-to-modes');

    this.inputJoinRoomCode = document.getElementById('input-join-room-code');
    this.inputJoinCustomIp = document.getElementById('input-join-custom-ip');
    this.btnSubmitJoinCode = document.getElementById('btn-submit-join-code');
    this.btnJoinBackToModes = document.getElementById('btn-join-back-to-modes');
    this.joinFeedbackMsg = document.getElementById('join-feedback-msg');

    // Connecting toast overlay
    this.connectingOverlay = document.getElementById('connecting-overlay');
    this.connectingRoomName = document.getElementById('connecting-room-name');

    // LAN Modal (Secondary via 🌐 button)
    this.btnLanToggle = document.getElementById('btn-lan-toggle');
    this.lanHeaderDot = document.getElementById('lan-header-dot');
    this.lanModal = document.getElementById('lan-modal');
    this.btnCloseLan = document.getElementById('btn-close-lan');
    this.btnCloseLanConfirm = document.getElementById('btn-close-lan-confirm');
    this.lanModalBeacon = document.getElementById('lan-modal-beacon');
    this.lanModalStatus = document.getElementById('lan-modal-status');
    this.lanModalRole = document.getElementById('lan-modal-role');
    this.lanModalRoomCode = document.getElementById('lan-modal-room-code');
    this.btnCopyModalCode = document.getElementById('btn-copy-modal-code');
    this.lanDisplayUrl = document.getElementById('lan-display-url');
    this.btnCopyLanUrl = document.getElementById('btn-copy-lan-url');
    this.copyBtnLabel = document.getElementById('copy-btn-label');
    this.lanQrImage = document.getElementById('lan-qr-image');
    this.lanQrFallback = document.getElementById('lan-qr-fallback');
    this.inputLanRoom = document.getElementById('input-lan-room');
    this.btnLanConnectManual = document.getElementById('btn-lan-connect-manual');

    this.floatingEmotesContainer = document.getElementById('floating-emotes-container');

    // Nickname elements
    this.inputPlayerNickname = document.getElementById('input-player-nickname');
    this.btnRandomNickname = document.getElementById('btn-random-nickname');
    if (this.inputPlayerNickname) {
      this.inputPlayerNickname.value = this.nickname;
    }

    // Mobile Emotes Elements
    this.btnMobileEmotesToggle = document.getElementById('btn-mobile-emotes-toggle');
    this.mobileEmotesPanel = document.getElementById('mobile-emotes-panel');

    // Restart Proposal Elements
    this.promptRestartModal = document.getElementById('prompt-restart-modal');
    this.restartProposerName = document.getElementById('restart-proposer-name');
    this.restartFirstTurnInfo = document.getElementById('restart-first-turn-info');
    this.restartProposedTurnText = document.getElementById('restart-proposed-turn-text');
    this.btnAcceptRestart = document.getElementById('btn-accept-restart');
    this.btnDeclineRestart = document.getElementById('btn-decline-restart');
    this.toastRestartWaiting = document.getElementById('toast-restart-waiting');
    this.toastRestartText = document.getElementById('toast-restart-text');
    this.btnCancelRestart = document.getElementById('btn-cancel-restart');

    // Tactical Chat Elements
    this.btnChatToggle = document.getElementById('btn-chat-toggle');
    this.chatUnreadBadge = document.getElementById('chat-unread-badge');
    this.chatDrawer = document.getElementById('chat-drawer');
    this.btnCloseChat = document.getElementById('btn-close-chat');
    this.chatChannelBadge = document.getElementById('chat-channel-badge');
    this.chatMessagesContainer = document.getElementById('chat-messages-container');
    this.inputChatText = document.getElementById('input-chat-text');
    this.btnSendChat = document.getElementById('btn-send-chat');
  }

  bindDomEvents() {
    document.getElementById('btn-new-round').addEventListener('click', () => this.resetRound());
    document.getElementById('modal-btn-again').addEventListener('click', () => this.resetRound());

    document.getElementById('btn-camera-reset').addEventListener('click', () => this.resetCameraPosition());

    const soundBtn = document.getElementById('btn-sound-toggle');
    soundBtn.addEventListener('click', () => {
      this.audio.enabled = !this.audio.enabled;
      soundBtn.textContent = this.audio.enabled ? '🔊' : '🔇';
    });

    const settingsBtn = document.getElementById('btn-settings-toggle');
    const closeSettingsBtn = document.getElementById('btn-close-settings');
    settingsBtn.addEventListener('click', () => this.settingsDrawer.classList.toggle('open'));
    closeSettingsBtn.addEventListener('click', () => this.settingsDrawer.classList.remove('open'));

    // Mobile Header Collapse Toggle
    if (this.btnHeaderCollapse) {
      this.btnHeaderCollapse.addEventListener('click', () => {
        this.cosmicHeader.classList.toggle('collapsed');
        this.updateTurnDisplay();
      });
    }

    // Home / Main Menu Button
    if (this.btnMainMenu) {
      this.btnMainMenu.addEventListener('click', () => {
        this.openMainMenu();
      });
    }

    // --- Main Menu Mode Selection ---
    if (this.menuBtnPvp) {
      this.menuBtnPvp.addEventListener('click', () => {
        this.setGameMode('pvp');
        this.closeMainMenu();
        this.resetRound();
      });
    }

    if (this.menuBtnAiEasy) {
      this.menuBtnAiEasy.addEventListener('click', () => {
        this.setGameMode('ai-easy');
        this.closeMainMenu();
        this.resetRound();
      });
    }

    if (this.menuBtnAiHard) {
      this.menuBtnAiHard.addEventListener('click', () => {
        this.setGameMode('ai-hard');
        this.closeMainMenu();
        this.resetRound();
      });
    }

    if (this.menuBtnLanFlow) {
      this.menuBtnLanFlow.addEventListener('click', () => {
        this.openLanSubpanel();
      });
    }

    if (this.btnLanBackToModes) {
      this.btnLanBackToModes.addEventListener('click', () => {
        this.closeLanSubpanel();
      });
    }

    if (this.btnJoinBackToModes) {
      this.btnJoinBackToModes.addEventListener('click', () => {
        this.closeLanSubpanel();
      });
    }

    // Tab switching in LAN subpanel
    if (this.tabBtnCreateRoom && this.tabBtnJoinRoom) {
      this.tabBtnCreateRoom.addEventListener('click', () => {
        this.tabBtnCreateRoom.classList.add('active');
        this.tabBtnJoinRoom.classList.remove('active');
        this.viewHostRoom.classList.add('active');
        this.viewJoinRoom.classList.remove('active');
      });

      this.tabBtnJoinRoom.addEventListener('click', () => {
        this.tabBtnJoinRoom.classList.add('active');
        this.tabBtnCreateRoom.classList.remove('active');
        this.viewJoinRoom.classList.add('active');
        this.viewHostRoom.classList.remove('active');
        if (this.inputJoinRoomCode) {
          setTimeout(() => this.inputJoinRoomCode.focus(), 100);
        }
      });
    }

    // Copy Host Room Code
    if (this.btnCopyRoomCode) {
      this.btnCopyRoomCode.addEventListener('click', () => {
        this.copyToClipboard(this.lan.roomId, this.btnCopyRoomCode, '✓ Код скопирован!');
      });
    }

    if (this.btnCopyModalCode) {
      this.btnCopyModalCode.addEventListener('click', () => {
        this.copyToClipboard(this.lan.roomId, this.btnCopyModalCode, '✓ Код скопирован!');
      });
    }

    // Copy Direct Host URL
    if (this.btnCopyDirectUrl) {
      this.btnCopyDirectUrl.addEventListener('click', () => {
        const fullUrl = this.getFullRoomUrl();
        this.copyToClipboard(fullUrl, this.btnCopyDirectUrl, '✓ Ссылка скопирована!');
      });
    }

    // Regenerate room code button
    if (this.btnRegenRoomCode) {
      this.btnRegenRoomCode.addEventListener('click', () => {
        this.lan.roomId = this.generateRoomCode();
        this.updateRoomDisplays();
        // Reconnect as host with new room
        const host = window.location.host || 'localhost:3000';
        this.connectWebSocket(host, this.lan.roomId);
      });
    }

    // Host start game button (proceed to table while waiting) / Ready button
    if (this.btnHostStartGame) {
      this.btnHostStartGame.addEventListener('click', () => {
        this.toggleLanReady();
      });
    }

    if (this.btnLanReady) {
      this.btnLanReady.addEventListener('click', () => {
        this.toggleLanReady();
      });
    }

    // Join by room code button
    if (this.btnSubmitJoinCode) {
      this.btnSubmitJoinCode.addEventListener('click', () => {
        this.handleJoinByCode();
      });
    }

    if (this.inputJoinRoomCode) {
      this.inputJoinRoomCode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleJoinByCode();
        }
      });
      // Auto uppercase input
      this.inputJoinRoomCode.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    }

    // Host first turn selection in LAN create panel
    if (this.hostFirstTurnControl) {
      const turnBtns = this.hostFirstTurnControl.querySelectorAll('.seg-btn');
      turnBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          turnBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const turn = btn.getAttribute('data-turn');
          this.firstTurn = turn;
          this.currentPlayer = turn;
          this.updateTurnDisplay();

          if (this.lan.isConnected && this.lan.ws && this.lan.ws.readyState === WebSocket.OPEN) {
            this.lan.ws.send(JSON.stringify({
              type: 'CHANGE_CONFIG',
              firstTurn: turn
            }));
          }
        });
      });
    }

    // Center Cell 3D Toggle in Host Setup Lobby
    if (this.hostCenterCellControl) {
      const centerBtns = this.hostCenterCellControl.querySelectorAll('.seg-btn');
      centerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-center');
          this.setDisableCenter(action === 'block');
        });
      });
    }

    // Layer filter
    document.getElementById('btn-layer-filter').addEventListener('click', () => this.cycleLayerVisibility());

    // Game Mode selector in drawer
    const modeButtons = document.querySelectorAll('#mode-control .seg-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.setGameMode(mode);

        if (mode === 'lan') {
          if (!this.lan.isConnected) {
            this.openLanModal();
          } else {
            this.updateTurnDisplay();
          }
        } else {
          this.resetRound();
        }
      });
    });

    // Theme selector
    const themeButtons = document.querySelectorAll('#theme-control .theme-btn');
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        themeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.themeKey = btn.getAttribute('data-theme');
        this.applyTheme();

        if (this.gameMode === 'lan' && this.lan.isConnected && this.lan.role === 'X') {
          this.lan.ws.send(JSON.stringify({
            type: 'CHANGE_CONFIG',
            themeKey: this.themeKey
          }));
        }
      });
    });

    // Figures Style
    const figureButtons = document.querySelectorAll('#figures-control .seg-btn');
    figureButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        figureButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.figureStyle = btn.getAttribute('data-fig');
        this.resetRound();

        if (this.gameMode === 'lan' && this.lan.isConnected && this.lan.role === 'X') {
          this.lan.ws.send(JSON.stringify({
            type: 'CHANGE_CONFIG',
            figureStyle: this.figureStyle
          }));
        }
      });
    });

    // First Move
    const turnButtons = document.querySelectorAll('#first-turn-control .seg-btn');
    turnButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const turn = btn.getAttribute('data-turn');
        if (this.gameMode === 'lan' && this.lan.isConnected) {
          if (turn === this.firstTurn) return;
          // In LAN, changing first turn requires mutual agreement with round restart
          this.proposeRestartWithTurn(turn);
          return;
        }
        turnButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.firstTurn = turn;
        this.resetRound();
      });
    });

    // Center Cell 3D Toggle in Settings Drawer
    if (this.centerCellControl) {
      const centerBtns = this.centerCellControl.querySelectorAll('.seg-btn');
      centerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-center');
          this.setDisableCenter(action === 'block');
        });
      });
    }

    // Stars Speed
    const speedSlider = document.getElementById('range-stars-speed');
    speedSlider.addEventListener('input', (e) => {
      this.starSpeed = (parseFloat(e.target.value) / 100) * 0.002;
    });

    // Reset scores
    document.getElementById('btn-reset-scores').addEventListener('click', () => this.resetAllStats());

    // --- LAN Event Bindings ---
    if (this.btnLanToggle) {
      this.btnLanToggle.addEventListener('click', () => this.openLanModal());
    }
    if (this.btnCloseLan) {
      this.btnCloseLan.addEventListener('click', () => this.closeLanModal());
    }
    if (this.btnCloseLanConfirm) {
      this.btnCloseLanConfirm.addEventListener('click', () => this.closeLanModal());
    }

    // Copy LAN URL button inside lan-modal
    if (this.btnCopyLanUrl) {
      this.btnCopyLanUrl.addEventListener('click', () => {
        const url = this.getFullRoomUrl();
        this.copyToClipboard(url, this.copyBtnLabel, '✓ Скопировано!');
      });
    }

    // Manual connect button in lan-modal
    if (this.btnLanConnectManual) {
      this.btnLanConnectManual.addEventListener('click', () => {
        const room = (this.inputLanRoom.value.trim() || this.lan.roomId).toUpperCase();
        const targetHost = window.location.host || 'localhost:3000';
        this.connectWebSocket(targetHost, room);
      });
    }

    // Quick Emotes Buttons (desktop & mobile)
    const emotePills = document.querySelectorAll('.emote-pill');
    emotePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const emoji = pill.getAttribute('data-emote');
        this.sendEmote(emoji);
        // Optional: auto-close mobile flyout on emote click
        this.closeMobileEmotes();
      });
    });

    // Mobile Emotes Toggle Button
    if (this.btnMobileEmotesToggle) {
      this.btnMobileEmotesToggle.addEventListener('click', () => {
        this.toggleMobileEmotes();
      });
    }

    // Nickname randomizer & input
    if (this.btnRandomNickname) {
      this.btnRandomNickname.addEventListener('click', () => {
        this.nickname = this.getRandomNickname();
        if (this.inputPlayerNickname) {
          this.inputPlayerNickname.value = this.nickname;
        }
        localStorage.setItem('cosmic_3d_nickname', this.nickname);
        this.audio.playSignalSound();
        this.syncNicknameWithServer();
      });
    }

    if (this.inputPlayerNickname) {
      this.inputPlayerNickname.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
          this.nickname = val.slice(0, 20);
          localStorage.setItem('cosmic_3d_nickname', this.nickname);
          this.syncNicknameWithServer();
        }
      });
    }

    // Restart Proposal dialog buttons
    if (this.btnAcceptRestart) {
      this.btnAcceptRestart.addEventListener('click', () => {
        this.respondRestart(true);
      });
    }

    if (this.btnDeclineRestart) {
      this.btnDeclineRestart.addEventListener('click', () => {
        this.respondRestart(false);
      });
    }

    if (this.btnCancelRestart) {
      this.btnCancelRestart.addEventListener('click', () => {
        this.cancelRestartRequest();
      });
    }

    // Tactical Chat Events
    if (this.btnChatToggle) {
      this.btnChatToggle.addEventListener('click', () => {
        this.toggleChatDrawer();
      });
    }

    if (this.btnCloseChat) {
      this.btnCloseChat.addEventListener('click', () => {
        this.closeChatDrawer();
      });
    }

    if (this.btnSendChat) {
      this.btnSendChat.addEventListener('click', () => {
        this.sendChatMessage();
      });
    }

    if (this.inputChatText) {
      this.inputChatText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.sendChatMessage();
        }
      });
    }

    const chatChips = document.querySelectorAll('.chat-chip-btn');
    chatChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const msg = chip.getAttribute('data-msg');
        this.sendChatMessage(msg);
      });
    });
  }

  copyToClipboard(text, targetEl, feedbackText = '✓ Скопировано!') {
    const originalText = targetEl.textContent;
    const restore = () => {
      targetEl.textContent = feedbackText;
      setTimeout(() => { targetEl.textContent = originalText; }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(restore).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        restore();
      } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  getFullRoomUrl() {
    const base = this.lan.primaryUrl || (window.location.protocol.startsWith('http')
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://192.168.1.8:3000');
    return `${base}/?room=${encodeURIComponent(this.lan.roomId)}`;
  }

  updateRoomDisplays() {
    const fullUrl = this.getFullRoomUrl();

    if (this.hostRoomCodeVal) this.hostRoomCodeVal.textContent = this.lan.roomId;
    if (this.lanModalRoomCode) this.lanModalRoomCode.textContent = this.lan.roomId;
    if (this.headerRoomCode) this.headerRoomCode.textContent = this.lan.roomId;
    if (this.inputLanRoom) this.inputLanRoom.value = this.lan.roomId;

    if (this.hostDirectUrl) this.hostDirectUrl.textContent = fullUrl;
    if (this.lanDisplayUrl) this.lanDisplayUrl.textContent = fullUrl;

    this.updateQrCode(fullUrl);
  }

  openMainMenu() {
    if (this.mainMenuModal) {
      this.mainMenuModal.classList.add('active');
    }
    this.closeLanSubpanel();
  }

  closeMainMenu() {
    if (this.mainMenuModal) {
      this.mainMenuModal.classList.remove('active');
    }
  }

  openLanSubpanel() {
    if (this.menuPrimaryModes && this.menuLanSubpanel) {
      this.menuPrimaryModes.style.display = 'none';
      this.menuLanSubpanel.style.display = 'flex';
      this.updateRoomDisplays();
      this.updateLobbyUI();
      this.updateReadyButtonUI();

      // Automatically connect host WebSocket if not connected
      if (!this.lan.isConnected && window.location.protocol.startsWith('http')) {
        this.connectWebSocket(window.location.host, this.lan.roomId);
      }
    }
  }

  closeLanSubpanel() {
    if (this.menuPrimaryModes && this.menuLanSubpanel) {
      this.menuPrimaryModes.style.display = 'flex';
      this.menuLanSubpanel.style.display = 'none';
      this.lan.isReady = false;
      this.updateReadyButtonUI();
      if (this.lan.isConnected && this.lan.ws && this.lan.ws.readyState === WebSocket.OPEN) {
        this.lan.ws.send(JSON.stringify({ type: 'SET_READY', ready: false }));
      }
    }
  }

  handleJoinByCode() {
    const code = (this.inputJoinRoomCode.value || '').trim().toUpperCase();
    if (!code) {
      if (this.joinFeedbackMsg) {
        this.joinFeedbackMsg.className = 'join-feedback-msg error';
        this.joinFeedbackMsg.textContent = 'Пожалуйста, введите код комнаты!';
      }
      return;
    }

    if (this.joinFeedbackMsg) {
      this.joinFeedbackMsg.className = 'join-feedback-msg';
      this.joinFeedbackMsg.textContent = `Подключение к комнате [${code}]...`;
    }

    let targetHost = (this.inputJoinCustomIp && this.inputJoinCustomIp.value.trim()) || window.location.host;
    if (!targetHost) targetHost = 'localhost:3000';
    targetHost = targetHost.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

    this.isDirectJoining = true;
    this.setGameMode('lan');
    this.connectWebSocket(targetHost, code);
  }

  openLanModal() {
    if (this.lanModal) {
      this.lanModal.classList.add('active');
    }
    this.fetchLanInfo();
    this.updateRoomDisplays();
  }

  closeLanModal() {
    if (this.lanModal) {
      this.lanModal.classList.remove('active');
    }
  }

  setGameMode(mode) {
    this.gameMode = mode;
    const modeButtons = document.querySelectorAll('#mode-control .seg-btn');
    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    if (this.headerRoomChip) {
      this.headerRoomChip.style.display = mode === 'lan' && this.lan.isConnected ? 'inline-flex' : 'none';
    }
    this.updateStatsDisplay();
    this.updateTurnDisplay();
  }

  setDisableCenter(disable) {
    this.disableCenter = !!disable;
    localStorage.setItem('cosmic_3d_disable_center', this.disableCenter ? 'true' : 'false');
    this.updateCenterCellButtons();
    this.buildBoard();

    if (this.gameMode === 'lan' && this.lan.isConnected && this.lan.ws && this.lan.ws.readyState === WebSocket.OPEN) {
      this.lan.ws.send(JSON.stringify({
        type: 'CHANGE_CONFIG',
        disableCenter: this.disableCenter
      }));
    }
  }

  updateCenterCellButtons() {
    const targetState = this.disableCenter ? 'block' : 'allow';
    const allBtns = document.querySelectorAll('#center-cell-control .seg-btn, #host-center-cell-control .seg-btn');
    allBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-center') === targetState);
    });
  }

  getClientId() {
    let id = localStorage.getItem('cosmic_3d_client_id');
    if (!id) {
      id = 'client_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('cosmic_3d_client_id', id);
    }
    return id;
  }

  // --- LAN Networking Manager ---
  async initLanManager() {
    // 1. Fetch IP discovery from local server
    await this.fetchLanInfo();

    // 2. Check if user arrived via QR Code or direct invitation link with ?room=XYZ or #XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || window.location.hash.replace('#', '').trim();

    if (roomParam) {
      const cleanRoom = roomParam.toUpperCase();
      this.lan.roomId = cleanRoom;
      this.isDirectJoining = true;

      // Show connecting overlay briefly
      if (this.connectingOverlay) {
        if (this.connectingRoomName) this.connectingRoomName.textContent = cleanRoom;
        this.connectingOverlay.style.display = 'flex';
      }

      // Keep start menu OPEN so the guest player can enter nickname & click Ready!
      this.openMainMenu();
      this.openLanSubpanel();
      this.setGameMode('lan');

      if (window.innerWidth <= 600 && this.cosmicHeader) {
        this.cosmicHeader.classList.add('collapsed');
      }

      // Auto-connect to host's room!
      const targetHost = window.location.host || 'localhost:3000';
      this.connectWebSocket(targetHost, cleanRoom);
    } else {
      // Normal start: generate room code, prepare displays, show main menu
      this.updateRoomDisplays();
      this.openMainMenu();

      // If on mobile screen, auto-collapse the header by default to preserve maximum 3D view
      if (window.innerWidth <= 600 && this.cosmicHeader) {
        this.cosmicHeader.classList.add('collapsed');
      }
    }
  }

  async fetchLanInfo() {
    try {
      const endpoint = window.location.protocol.startsWith('http')
        ? '/api/lan-info'
        : 'http://localhost:3000/api/lan-info';

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Network response not ok');
      const data = await res.json();

      this.lan.primaryIp = data.primaryIp;
      this.lan.primaryUrl = data.primaryUrl;
      this.lan.interfaces = data.interfaces || [];

      this.updateRoomDisplays();
    } catch (e) {
      const fallbackUrl = window.location.protocol.startsWith('http')
        ? `${window.location.protocol}//${window.location.host}`
        : 'http://192.168.1.8:3000';

      this.lan.primaryUrl = fallbackUrl;
      this.updateRoomDisplays();
    }
  }

  updateQrCode(url) {
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;

    // Update modal QR
    if (this.lanQrImage) {
      this.lanQrImage.src = qrApiUrl;
      this.lanQrImage.onload = () => {
        this.lanQrImage.style.display = 'block';
        if (this.lanQrFallback) this.lanQrFallback.style.display = 'none';
      };
      this.lanQrImage.onerror = () => {
        this.lanQrImage.style.display = 'none';
        if (this.lanQrFallback) {
          this.lanQrFallback.textContent = url;
          this.lanQrFallback.style.display = 'block';
        }
      };
    }

    // Update start menu host QR
    if (this.hostQrImage) {
      this.hostQrImage.src = qrApiUrl;
      this.hostQrImage.onload = () => {
        this.hostQrImage.style.display = 'block';
        if (this.hostQrFallback) this.hostQrFallback.style.display = 'none';
      };
      this.hostQrImage.onerror = () => {
        this.hostQrImage.style.display = 'none';
        if (this.hostQrFallback) {
          this.hostQrFallback.textContent = url;
          this.hostQrFallback.style.display = 'block';
        }
      };
    }
  }

  connectWebSocket(targetHost, roomId = 'COSMIC-1') {
    if (this.lan.ws) {
      try { this.lan.ws.close(); } catch (e) {}
    }

    this.lan.roomId = roomId;
    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = `${proto}${targetHost}/ws`;

    if (this.lanModalStatus) this.lanModalStatus.textContent = 'Подключение к серверу...';
    if (this.lanModalBeacon) this.lanModalBeacon.className = 'lan-beacon waiting';

    try {
      this.lan.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.onWsDisconnected();
      return;
    }

    this.lan.ws.onopen = () => {
      this.lan.isConnected = true;
      this.lan.ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId: this.lan.roomId,
        clientId: this.getClientId(),
        nickname: this.nickname
      }));
    };

    this.lan.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleLanMessage(msg);
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    };

    this.lan.ws.onclose = () => {
      this.onWsDisconnected();
    };

    this.lan.ws.onerror = (err) => {
      console.warn('WS Error:', err);
      this.onWsDisconnected();
    };
  }

  handleLanMessage(msg) {
    switch (msg.type) {
      case 'JOINED': {
        this.setGameMode('lan');
        this.lan.role = msg.role;
        this.lan.opponentConnected = msg.opponentConnected;
        this.lan.playerReady = msg.playerReady || { X: false, O: false };
        this.lan.isReady = !!(this.lan.playerReady && this.lan.playerReady[this.lan.role]);
        this.syncGameState(msg.gameState);

        if (msg.playerNicknames) {
          const oppRole = msg.role === 'X' ? 'O' : 'X';
          this.opponentNickname = msg.playerNicknames[oppRole] || null;
        }

        // Hide connecting toast if visible
        if (this.connectingOverlay) {
          this.connectingOverlay.style.display = 'none';
        }

        // KEEP main menu open for both Host and Guest!
        if (this.mainMenuModal) {
          this.mainMenuModal.classList.add('active');
        }
        if (this.menuPrimaryModes && this.menuLanSubpanel) {
          this.menuPrimaryModes.style.display = 'none';
          this.menuLanSubpanel.style.display = 'flex';
        }
        // Activate viewHostRoom (the active lobby)
        if (this.tabBtnCreateRoom && this.tabBtnJoinRoom && this.viewHostRoom && this.viewJoinRoom) {
          this.tabBtnCreateRoom.classList.add('active');
          this.tabBtnJoinRoom.classList.remove('active');
          this.viewHostRoom.classList.add('active');
          this.viewJoinRoom.classList.remove('active');
        }

        if (this.joinFeedbackMsg) {
          this.joinFeedbackMsg.className = 'join-feedback-msg success';
          this.joinFeedbackMsg.textContent = `✓ Успешно подключено к [${this.lan.roomId}]!`;
        }

        const roleText = msg.role === 'X' ? 'Сверхновая (X) [Хост]' : 'Антиматерия (O) [Гость]';
        this.flashTurnBanner(`🚀 Подключено к комнате [${this.lan.roomId}]! Ваша роль: ${roleText}`, 'var(--neon-cyan)');

        this.updateReadyButtonUI();
        this.updateLobbyUI();
        this.updateLanUI();
        break;
      }
      case 'PLAYER_JOINED': {
        this.setGameMode('lan');
        this.lan.opponentConnected = msg.opponentConnected;
        if (msg.playerReady) this.lan.playerReady = msg.playerReady;

        if (msg.role !== this.lan.role) {
          this.opponentNickname = msg.nickname || (msg.role === 'X' ? 'Сверхновая (X)' : 'Антиматерия (O)');
          this.flashTurnBanner(`⚡ Соперник подключился: [${this.opponentNickname}]! Нажмите «ГОТОВ К БИТВЕ»`, '#00ff88');
          this.audio.playPromptSound();

          // System message in chat
          this.appendChatMessage({
            isSystem: true,
            text: `Пилот [${this.opponentNickname}] вышел на тактическую связь.`
          });
        }
        this.updateLobbyUI();
        this.updateLanUI();
        break;
      }
      case 'PLAYER_READY_CHANGED': {
        this.lan.playerReady = msg.playerReady || { X: false, O: false };
        if (msg.role === this.lan.role) {
          this.lan.isReady = !!msg.ready;
          this.updateReadyButtonUI();
        } else {
          // Opponent toggled ready status
          if (msg.ready) {
            this.audio.playSignalSound();
            const oppName = this.opponentNickname || (msg.role === 'X' ? 'Хост' : 'Гость');
            this.flashTurnBanner(`⚡ [${oppName}] готов к битве!`, 'var(--neon-gold)');
          }
        }
        this.updateLobbyUI();
        break;
      }
      case 'NICKNAME_UPDATED': {
        if (msg.role !== this.lan.role) {
          this.opponentNickname = msg.nickname;
          this.flashTurnBanner(`🛰 Позывной соперника: [${msg.nickname}]`, 'var(--neon-cyan)');
        }
        this.updateStatsDisplay();
        this.updateLobbyUI();
        break;
      }
      case 'MATCH_START': {
        this.lan.playerReady = { X: true, O: true };
        if (msg.playerNicknames) {
          const oppRole = this.lan.role === 'X' ? 'O' : 'X';
          this.opponentNickname = msg.playerNicknames[oppRole] || this.opponentNickname;
        }
        this.closeMainMenu();
        this.closeLanModal();
        this.audio.playVictory();
        this.flashTurnBanner('⚔️ ОБА ПИЛОТА ГОТОВЫ! БИТВА НАЧАЛАСЬ!', '#00ff88');
        this.updateStatsDisplay();
        this.updateTurnDisplay();
        break;
      }
      case 'MOVE_MADE': {
        this.onLanMoveMade(msg);
        break;
      }
      case 'ROUND_RESTARTED': {
        if (this.promptRestartModal) {
          this.promptRestartModal.classList.remove('active');
        }
        if (this.toastRestartWaiting) {
          this.toastRestartWaiting.style.display = 'none';
        }

        this.syncGameState(msg.gameState);
        this.resetRound(true);

        const bannerMsg = msg.accepted
          ? (msg.firstTurnChanged ? '⚡ Реванш принят! Первый ход обновлён!' : '⚡ Реванш принят! Новый раунд начался!')
          : '⚡ Раунд перезапущен!';

        this.flashTurnBanner(bannerMsg, '#00ff88');
        this.audio.playVictory();
        break;
      }
      case 'RESTART_PROPOSED': {
        if (this.promptRestartModal) {
          if (this.restartProposerName) {
            this.restartProposerName.textContent = msg.nickname || 'Соперник';
          }
          if (this.restartFirstTurnInfo && this.restartProposedTurnText) {
            if (msg.firstTurn) {
              this.restartFirstTurnInfo.style.display = 'flex';
              this.restartProposedTurnText.textContent = msg.firstTurn === 'X' ? 'СВЕРХНОВАЯ (X)' : 'АНТИМАТЕРИЯ (O)';
            } else {
              this.restartFirstTurnInfo.style.display = 'none';
            }
          }
          this.promptRestartModal.classList.add('active');
        }
        this.audio.playPromptSound();
        break;
      }
      case 'RESTART_PENDING': {
        if (this.toastRestartWaiting) {
          if (this.toastRestartText) {
            this.toastRestartText.textContent = msg.firstTurn
              ? 'Ожидание согласия соперника на смену хода и перезапуск...'
              : 'Ожидание согласия соперника на новый раунд...';
          }
          this.toastRestartWaiting.style.display = 'block';
        }
        break;
      }
      case 'RESTART_DECLINED': {
        if (this.toastRestartWaiting) {
          this.toastRestartWaiting.style.display = 'none';
        }
        const who = msg.nickname || 'Соперник';
        this.flashTurnBanner(`⚠️ ${who} отклонил предложение о новом раунде.`, '#ff0055');
        break;
      }
      case 'RESTART_CANCELLED': {
        if (this.promptRestartModal) {
          this.promptRestartModal.classList.remove('active');
        }
        this.flashTurnBanner('ℹ️ Запрос на перезапуск был отменён.', 'var(--neon-gold)');
        break;
      }
      case 'CHAT_MESSAGE': {
        this.appendChatMessage(msg);
        break;
      }
      case 'CONFIG_CHANGED': {
        this.syncGameState(msg.gameState);
        break;
      }
      case 'SCORES_RESET': {
        this.scores = msg.gameState.scores;
        this.updateStatsDisplay();
        this.resetRound(true);
        break;
      }
      case 'EMOTE_RECEIVED': {
        this.audio.playSignalSound();
        this.displayFloatingEmote(msg.emoji, msg.fromPlayer);
        break;
      }
      case 'PLAYER_LEFT': {
        this.lan.opponentConnected = false;
        if (msg.playerReady) {
          this.lan.playerReady = msg.playerReady;
        } else if (msg.role) {
          this.lan.playerReady[msg.role] = false;
        }
        this.updateReadyButtonUI();
        this.updateLobbyUI();
        this.updateLanUI();
        this.flashTurnBanner('⚠️ Второй игрок отключился. Ожидание...', '#ff0055');
        break;
      }
      case 'MOVE_REJECTED': {
        this.flashTurnBanner(msg.reason || 'Ход отклонён', '#ff0055');
        break;
      }
    }
  }

  toggleLanReady() {
    this.lan.isReady = !this.lan.isReady;
    this.updateReadyButtonUI();
    this.updateLobbyUI();

    if (this.lan.isConnected && this.lan.ws && this.lan.ws.readyState === WebSocket.OPEN) {
      this.lan.ws.send(JSON.stringify({
        type: 'SET_READY',
        ready: this.lan.isReady
      }));
    } else {
      if (this.lan.roomId) {
        const host = window.location.host || 'localhost:3000';
        this.connectWebSocket(host, this.lan.roomId);
      }
    }
  }

  updateReadyButtonUI() {
    const btn = this.btnLanReady || this.btnHostStartGame;
    if (!btn) return;
    const txt = this.btnReadyText || btn.querySelector('span');

    if (this.lan.isReady) {
      btn.classList.add('is-ready');
      btn.classList.remove('glow-cyan');
      if (txt) txt.textContent = '✓ ВЫ ГОТОВЫ (ЖДЕМ СОПЕРНИКА)';
    } else {
      btn.classList.remove('is-ready');
      btn.classList.add('glow-cyan');
      if (txt) txt.textContent = '⚡ ГОТОВ К БИТВЕ';
    }
  }

  updateLobbyUI() {
    const isHost = this.lan.role === 'X';
    const isGuest = this.lan.role === 'O';

    const hostNick = isHost ? this.nickname : (this.opponentNickname || 'Хост');
    const guestNick = isGuest ? this.nickname : (this.lan.opponentConnected ? (this.opponentNickname || 'Гость') : 'Ожидание...');

    if (this.lobbyNickHost) this.lobbyNickHost.textContent = hostNick + (isHost ? ' (Вы)' : '');
    if (this.lobbyNickGuest) this.lobbyNickGuest.textContent = guestNick + (isGuest ? ' (Вы)' : '');

    const hostReady = !!(this.lan.playerReady && this.lan.playerReady.X);
    const guestReady = !!(this.lan.playerReady && this.lan.playerReady.O);

    if (this.lobbyReadyBadgeHost) {
      this.lobbyReadyBadgeHost.className = `lobby-ready-status ${hostReady ? 'ready' : 'not-ready'}`;
      this.lobbyReadyBadgeHost.textContent = hostReady ? '✓ ГОТОВ' : '⚪ Не готов';
    }

    if (this.lobbyReadyBadgeGuest) {
      if (!this.lan.opponentConnected && !isGuest) {
        this.lobbyReadyBadgeGuest.className = 'lobby-ready-status not-ready';
        this.lobbyReadyBadgeGuest.textContent = '⚪ Не подключен';
      } else {
        this.lobbyReadyBadgeGuest.className = `lobby-ready-status ${guestReady ? 'ready' : 'not-ready'}`;
        this.lobbyReadyBadgeGuest.textContent = guestReady ? '✓ ГОТОВ' : '⚪ Не готов';
      }
    }

    if (this.hostWaitingText) {
      if (!this.lan.opponentConnected && isHost) {
        this.hostWaitingText.textContent = 'Ожидание подключения второго игрока...';
        if (this.hostWaitingStatus) this.hostWaitingStatus.style.color = '#ffb703';
        if (this.lobbyWaitingBeacon) this.lobbyWaitingBeacon.className = 'lan-beacon waiting';
      } else if (hostReady && guestReady) {
        this.hostWaitingText.textContent = '⚡ Оба игрока готовы! Запуск миссии...';
        if (this.hostWaitingStatus) this.hostWaitingStatus.style.color = '#00ff88';
        if (this.lobbyWaitingBeacon) this.lobbyWaitingBeacon.className = 'lan-beacon connected';
      } else if ((isHost && hostReady) || (isGuest && guestReady)) {
        this.hostWaitingText.textContent = '⏳ Вы готовы. Ожидание готовности соперника...';
        if (this.hostWaitingStatus) this.hostWaitingStatus.style.color = '#ffb703';
        if (this.lobbyWaitingBeacon) this.lobbyWaitingBeacon.className = 'lan-beacon waiting';
      } else if (this.lan.opponentConnected) {
        this.hostWaitingText.textContent = '⚡ Соперник подключен! Нажмите «ГОТОВ К БИТВЕ».';
        if (this.hostWaitingStatus) this.hostWaitingStatus.style.color = '#00f0ff';
        if (this.lobbyWaitingBeacon) this.lobbyWaitingBeacon.className = 'lan-beacon connected';
      }
    }
  }

  syncNicknameWithServer() {
    this.updateStatsDisplay();
    this.updateLobbyUI();
    if (this.lan.isConnected && this.lan.ws && this.lan.ws.readyState === WebSocket.OPEN) {
      this.lan.ws.send(JSON.stringify({
        type: 'SET_NICKNAME',
        nickname: this.nickname
      }));
    }
  }

  syncGameState(state) {
    if (!state) return;
    if (state.dimension && state.dimension !== this.dimension) {
      this.dimension = state.dimension;
      this.generateWinningCombinations();
      this.resetCameraPosition();
      this.buildBoard();
    }
    if (state.themeKey && state.themeKey !== this.themeKey) {
      this.themeKey = state.themeKey;
      this.applyTheme(true);
    }
    if (state.figureStyle && state.figureStyle !== this.figureStyle) {
      this.figureStyle = state.figureStyle;
    }
    if (state.firstTurn && state.firstTurn !== this.firstTurn) {
      this.firstTurn = state.firstTurn;
      if (this.hostFirstTurnControl) {
        const turnBtns = this.hostFirstTurnControl.querySelectorAll('.seg-btn');
        turnBtns.forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-turn') === state.firstTurn);
        });
      }
      const firstTurnBtns = document.querySelectorAll('#first-turn-control .seg-btn');
      firstTurnBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-turn') === state.firstTurn);
      });
    }
    if (state.scores) {
      this.scores = state.scores;
      this.updateStatsDisplay();
    }
    // Reconstruct already placed pieces from server state
    if (state.boardState) {
      for (let i = 0; i < state.boardState.length; i++) {
        const piece = state.boardState[i];
        if (piece && this.boardState[i] !== piece) {
          this.placePiece(i, piece);
        }
      }
    }
    if (state.currentPlayer) {
      this.currentPlayer = state.currentPlayer;
      this.updateTurnDisplay();
    }
    if (state.disableCenter !== undefined && state.disableCenter !== this.disableCenter) {
      this.disableCenter = !!state.disableCenter;
      localStorage.setItem('cosmic_3d_disable_center', this.disableCenter ? 'true' : 'false');
      this.updateCenterCellButtons();
      this.buildBoard();
    }
  }

  onWsDisconnected() {
    this.lan.isConnected = false;
    this.lan.role = null;
    this.lan.opponentConnected = false;
    if (this.connectingOverlay) {
      this.connectingOverlay.style.display = 'none';
    }
    this.updateLanUI();
  }

  updateLanUI() {
    if (this.headerRoomChip && this.headerRoomCode) {
      if (this.gameMode === 'lan' && this.lan.isConnected) {
        this.headerRoomChip.style.display = 'inline-flex';
        this.headerRoomCode.textContent = this.lan.roomId;
      } else {
        this.headerRoomChip.style.display = 'none';
      }
    }

    if (!this.lan.isConnected) {
      this.lanHeaderDot.className = 'lan-status-beacon';
      this.lanModalBeacon.className = 'lan-beacon';
      this.lanModalStatus.textContent = 'Автономный режим (Не в сети)';
      this.lanModalRole.textContent = 'РОЛЬ: НЕ ПОДКЛЮЧЕН';
      this.lanModalRole.className = 'lan-role-tag';
      return;
    }

    if (this.lan.opponentConnected) {
      this.lanHeaderDot.className = 'lan-status-beacon online-paired';
      this.lanModalBeacon.className = 'lan-beacon connected';
      this.lanModalStatus.textContent = 'Оба игрока в сети (Битва активна)';
    } else {
      this.lanHeaderDot.className = 'lan-status-beacon online-waiting';
      this.lanModalBeacon.className = 'lan-beacon waiting';
      this.lanModalStatus.textContent = 'Ожидание подключения второго игрока...';
    }

    let roleText = 'РОЛЬ: НАБЛЮДАТЕЛЬ';
    let roleClass = 'lan-role-tag';

    if (this.lan.role === 'X') {
      roleText = 'ВЫ: СВЕРХНОВАЯ (X) [ХОСТ]';
      roleClass = 'lan-role-tag';
    } else if (this.lan.role === 'O') {
      roleText = 'ВЫ: АНТИМАТЕРИЯ (O) [ГОСТЬ]';
      roleClass = 'lan-role-tag role-o';
    }

    this.lanModalRole.textContent = roleText;
    this.lanModalRole.className = roleClass;

    this.updateTurnDisplay();
  }

  sendLanMove(index) {
    if (!this.lan.ws || this.lan.ws.readyState !== WebSocket.OPEN) return;

    // Check tentative win / draw
    const testBoard = [...this.boardState];
    testBoard[index] = this.lan.role;
    const win = this.checkWin(testBoard);
    const isDraw = !win && this.isBoardFull(testBoard);

    this.lan.ws.send(JSON.stringify({
      type: 'MAKE_MOVE',
      index,
      winResult: win,
      isDraw
    }));
  }

  onLanMoveMade(data) {
    const { index, player, nextPlayer, isGameOver, winner, winningCombo, scores, boardState } = data;

    this.placePiece(index, player);

    if (boardState) {
      this.boardState[index] = player;
    }

    if (scores) {
      this.scores = scores;
      this.updateStatsDisplay();
    }

    if (isGameOver) {
      if (winner === 'DRAW') {
        this.handleDraw();
      } else if (winner && winningCombo) {
        this.handleWin({ player: winner, combo: winningCombo });
      }
    } else {
      this.currentPlayer = nextPlayer;
      this.updateTurnDisplay();
    }
  }

  sendEmote(emoji) {
    this.audio.playSignalSound();
    if (this.lan.isConnected && this.lan.ws) {
      this.lan.ws.send(JSON.stringify({
        type: 'SEND_EMOTE',
        emoji
      }));
    } else {
      // Local preview
      this.displayFloatingEmote(emoji, this.currentPlayer);
    }
  }

  displayFloatingEmote(emoji, player = 'X') {
    if (!this.floatingEmotesContainer) return;

    const el = document.createElement('div');
    el.className = 'floating-emote';
    el.textContent = emoji;

    // Random horizontal position near center
    const xPercent = 25 + Math.random() * 50;
    const yPercent = 55 + Math.random() * 25;
    el.style.left = `${xPercent}%`;
    el.style.top = `${yPercent}%`;

    this.floatingEmotesContainer.appendChild(el);
    this.audio.playHover();

    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 2500);
  }

  // --- Mobile Emotes Toggle ---
  toggleMobileEmotes() {
    this.mobileEmotesOpen = !this.mobileEmotesOpen;
    if (this.btnMobileEmotesToggle) {
      this.btnMobileEmotesToggle.classList.toggle('active', this.mobileEmotesOpen);
    }
    if (this.mobileEmotesPanel) {
      this.mobileEmotesPanel.classList.toggle('active', this.mobileEmotesOpen);
    }
  }

  closeMobileEmotes() {
    this.mobileEmotesOpen = false;
    if (this.btnMobileEmotesToggle) {
      this.btnMobileEmotesToggle.classList.remove('active');
    }
    if (this.mobileEmotesPanel) {
      this.mobileEmotesPanel.classList.remove('active');
    }
  }

  // --- Tactical Chat Manager ---
  openChatDrawer() {
    this.chatOpen = true;
    if (this.chatDrawer) this.chatDrawer.classList.add('open');
    this.chatUnread = 0;
    if (this.chatUnreadBadge) this.chatUnreadBadge.style.display = 'none';
    if (this.chatChannelBadge) {
      this.chatChannelBadge.textContent = `СВЯЗЬ: ${this.lan.roomId}`;
    }
    if (this.inputChatText) {
      setTimeout(() => this.inputChatText.focus(), 150);
    }
  }

  closeChatDrawer() {
    this.chatOpen = false;
    if (this.chatDrawer) this.chatDrawer.classList.remove('open');
  }

  toggleChatDrawer() {
    if (this.chatOpen) {
      this.closeChatDrawer();
    } else {
      this.openChatDrawer();
    }
  }

  sendChatMessage(customText = null) {
    const text = (customText !== null ? customText : (this.inputChatText ? this.inputChatText.value : '')).trim();
    if (!text) return;

    if (this.inputChatText && customText === null) {
      this.inputChatText.value = '';
    }

    if (this.lan.isConnected && this.lan.ws && this.lan.ws.readyState === WebSocket.OPEN) {
      this.lan.ws.send(JSON.stringify({
        type: 'SEND_CHAT',
        text,
        nickname: this.nickname
      }));
    } else {
      // Local fallback
      this.appendChatMessage({
        senderRole: 'X',
        nickname: this.nickname,
        text,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      });
    }
  }

  appendChatMessage(msg) {
    if (!this.chatMessagesContainer) return;

    if (msg.isSystem) {
      const sysEl = document.createElement('div');
      sysEl.className = 'chat-system-msg';
      sysEl.innerHTML = `<span>🛰 ${this.escapeHtml(msg.text)}</span>`;
      this.chatMessagesContainer.appendChild(sysEl);
      this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
      return;
    }

    const isSelf = (this.gameMode === 'lan' && this.lan.role === msg.senderRole) || (!this.lan.isConnected && msg.senderRole === 'X');
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${isSelf ? 'msg-self' : 'msg-opponent'}`;

    const roleTag = msg.senderRole === 'X' ? '✦ Сверхновая' : '◎ Антиматерия';
    const headerEl = document.createElement('div');
    headerEl.className = 'chat-msg-header';
    headerEl.innerHTML = `<span>${this.escapeHtml(msg.nickname || roleTag)}</span> <span class="chat-msg-time">${msg.time || ''}</span>`;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'chat-msg-body';
    bodyEl.textContent = msg.text;

    msgEl.appendChild(headerEl);
    msgEl.appendChild(bodyEl);
    this.chatMessagesContainer.appendChild(msgEl);

    // Auto-scroll
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;

    // Incoming notification sound & badge
    if (!isSelf) {
      this.audio.playMessageSound();
      if (!this.chatOpen) {
        this.chatUnread++;
        if (this.chatUnreadBadge) {
          this.chatUnreadBadge.textContent = this.chatUnread;
          this.chatUnreadBadge.style.display = 'block';
        }
      }
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  flashTurnBanner(text, color = 'var(--neon-cyan)') {
    if (!this.turnBannerText) return;
    const originalHtml = this.turnBannerText.innerHTML;
    this.turnBannerText.innerHTML = `<span style="color:${color}; font-weight:700;">${text}</span>`;
    setTimeout(() => {
      this.updateTurnDisplay();
    }, 2800);
  }

  applyTheme(isSynced = false) {
    const theme = THEMES[this.themeKey];
    this.scene.background = new THREE.Color(theme.bgSpace);
    this.scene.fog.color = new THREE.Color(theme.bgSpace);
    this.dirLight1.color.setHex(theme.colorX);
    this.dirLight2.color.setHex(theme.colorO);

    // Rebuild stars with new theme
    if (this.starPoints) {
      this.scene.remove(this.starPoints);
    }
    this.buildStarsAndNebula();
    this.resetRound(isSynced);
  }

  updateTurnDisplay() {
    const isX = this.currentPlayer === 'X';
    this.statCardX.classList.toggle('active-turn', isX);
    this.statCardO.classList.toggle('active-turn', !isX);

    const isMobile = window.innerWidth <= 768;
    const isCollapsed = this.cosmicHeader && this.cosmicHeader.classList.contains('collapsed');

    if (this.gameMode === 'lan') {
      const myTurn = this.lan.role === this.currentPlayer;

      // When mobile header is collapsed, show ultra-clean turn indicator: "⚡ ВЫ" or "⏳ СОПЕР"
      if (isMobile && isCollapsed) {
        if (myTurn) {
          this.turnBannerText.innerHTML = '<b style="color:#00ff88; font-weight:800;">⚡ ВЫ</b>';
        } else {
          this.turnBannerText.innerHTML = '<b style="color:#ffb703; font-weight:800;">⏳ СОПЕР</b>';
        }
        return;
      }

      const roleName = isX
        ? (isMobile ? 'СВЕРХ (X)' : 'СВЕРХНОВАЯ (X)')
        : (isMobile ? 'АНТИ (O)' : 'АНТИМАТЕРИЯ (O)');
      const myRoleBadge = this.lan.role === 'X'
        ? '<span style="color:var(--neon-cyan); font-weight:800;">✦ ВЫ (X)</span>'
        : (this.lan.role === 'O'
          ? '<span style="color:var(--neon-magenta); font-weight:800;">◎ ВЫ (O)</span>'
          : '<span style="color:var(--text-muted)">👁 НАБЛ.</span>');
      const turnHint = myTurn ? '⚡ ВАШ ХОД!' : '⏳ Ход соперника...';
      const hintColor = myTurn ? '#00ff88' : '#ffb703';

      if (isMobile) {
        this.turnBannerText.innerHTML = `${myRoleBadge} &bull; <b style="color:${isX ? 'var(--neon-cyan)' : 'var(--neon-magenta)'}">${roleName}</b> &bull; <span style="color:${hintColor}; font-weight:700;">${turnHint}</span>`;
      } else {
        this.turnBannerText.innerHTML = `${myRoleBadge} &bull; Ход: <b style="color:${isX ? 'var(--neon-cyan)' : 'var(--neon-magenta)'}">${roleName}</b> &bull; <span style="color:${hintColor}; font-weight:700;">${turnHint}</span>`;
      }
      return;
    }

    if (isMobile && isCollapsed) {
      this.turnBannerText.innerHTML = `<b style="color:${isX ? 'var(--neon-cyan)' : 'var(--neon-magenta)'}">ХОД: ${isX ? 'X' : 'O'}</b>`;
      return;
    }

    const name = isX
      ? (isMobile ? 'СВЕРХ (X)' : 'СВЕРХНОВАЯ (X)')
      : (this.gameMode === 'pvp'
        ? (isMobile ? 'АНТИ (O)' : 'АНТИМАТЕРИЯ (O)')
        : (isMobile ? 'ИИ (O)' : 'КВАНТОВЫЙ ИИ'));

    this.turnBannerText.innerHTML = `Ход: <b style="color:${isX ? 'var(--neon-cyan)' : 'var(--neon-magenta)'}">${name}</b>`;
  }

  updateStatsDisplay() {
    this.scoreP1.textContent = this.scores.X;
    this.scoreP2.textContent = this.scores.O;
    this.scoreDraw.textContent = this.scores.ties;

    const isMobile = window.innerWidth <= 768;
    if (this.labelP1) {
      this.labelP1.textContent = isMobile ? 'СВЕРХ (X)' : 'СВЕРХНОВАЯ (X)';
    }
    if (this.labelDraw) {
      this.labelDraw.textContent = isMobile ? 'НИЧЬИ' : 'РАВНОВЕСИЕ';
    }
    if (this.labelP2) {
      if (this.gameMode === 'lan' || this.gameMode === 'pvp') {
        this.labelP2.textContent = isMobile ? 'АНТИ (O)' : 'АНТИМАТЕРИЯ (O)';
      } else {
        this.labelP2.textContent = isMobile ? 'ИИ (O)' : 'КВАНТОВЫЙ ИИ (O)';
      }
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.updateStatsDisplay();
    this.updateTurnDisplay();
  }

  // --- Render Loop ---
  animate() {
    requestAnimationFrame(() => this.animate());

    // Rotate starfield
    if (this.starPoints) {
      this.starPoints.rotation.y += this.starSpeed;
      this.starPoints.rotation.x += this.starSpeed * 0.4;
    }

    // Animate figure scale-in and continuous idle floating rotation
    this.placedMeshes.forEach(mesh => {
      if (mesh) {
        if (mesh.userData.currentScale < mesh.userData.targetScale) {
          mesh.userData.currentScale += 0.08;
          mesh.scale.setScalar(mesh.userData.currentScale);
        }
        mesh.rotation.y += 0.015;
        mesh.rotation.x += 0.008;

        if (mesh.userData.isWinner) {
          mesh.scale.setScalar(1.2 + Math.sin(Date.now() * 0.008) * 0.15);
        }
      }
    });

    // Soft rotation on hovering placeholder
    if (this.hoveredCellIndex !== null && this.cellPlaceholderMeshes[this.hoveredCellIndex]) {
      const core = this.cellPlaceholderMeshes[this.hoveredCellIndex].children[0];
      if (core) {
        core.rotation.y += 0.05;
        core.rotation.x += 0.03;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Start game on load
window.addEventListener('DOMContentLoaded', () => {
  window.cosmicGame = new Cosmic3DGame();
});
