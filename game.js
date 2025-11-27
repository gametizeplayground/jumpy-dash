import * as THREE from 'three';
import { TextureLoader } from 'three';

// --- Global Variables ---
let scene, camera, renderer;
let player;
let dirLight; 
let clock;
let obstacles = [];
let coins = [];
let groundBlocks = []; // Array of {mesh, originalY, falling: bool, rising: bool, velocity: num}
let gameActive = false;
let score = 0;
let speed = 5; // Start slower (was 8)
const minSpeed = 5;
const maxSpeed = 15;
const acceleration = 0.1; // Speed increase per second
const laneWidth = 1.2; 
const BLOCK_SIZE = 1;
let lastObstacleZ = -999;
let jumpSound; // Audio for jump sound effect
let collectSound; // Audio for coin collect sound
let bgMusic; // Background music
let musicEnabled = false; // Music toggle state (default off)
let textureLoader; // Texture loader for obstacle images
let cactusTexture;
let woodTexture;
let ufoTexture;
let gameStarted = false; // Track if game has started from home screen

// UI Elements
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const homeScreen = document.getElementById('home-screen');
const playBtn = document.getElementById('play-btn');
const musicBtn = document.getElementById('music-btn');
const musicToggle = document.getElementById('music-toggle');
const uiContainer = document.getElementById('ui-container');

// Colors (Vibrant Palette)
const COLOR_BG = 0x6A5ACD; // SlateBlue/Purple-ish
const COLOR_GROUND_TOP = 0xFFE4B5; // Vibrant Yellow-Orange (NavajoWhite)
const COLOR_GROUND_INNER = 0xFFCFA1; // Slightly Darker/Different for inner square
const COLOR_GROUND_SIDE = 0xFF9C59; // Vibrant Orange
const COLOR_GROUND_FRONT = 0xFF6600; // Brighter Orange for Front Face
const COLOR_GROUND_DIRT = 0x8B4513; // Darker dirt color for lower part of sides (SaddleBrown)
const COLOR_PLAYER = 0xFF0000; // Bright Red
const COLOR_NINJA_MASK = 0x000000; // Black for ninja mask
const COLOR_NINJA_BELT = 0x2F2F2F; // Dark gray for belt
const COLOR_OBSTACLE = 0x778899; // LightSlateGray
const COLOR_TREE_LEAVES = 0x00C957; // Vibrant Green
const COLOR_TREE_TRUNK = 0x8B4513; // SaddleBrown
const COLOR_COIN = 0xFFD700; // Gold
const COLOR_SHADOW = 0x8B4500; // Darker brown for tree shadow

// --- Initialization ---
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLOR_BG);

    // Camera setup - Isometric
    const aspect = window.innerWidth / window.innerHeight;
    const d = 7; 
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    // Ensure canvas is touch-friendly
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.webkitTouchCallout = 'none';
    renderer.domElement.style.webkitUserSelect = 'none';
    renderer.domElement.style.userSelect = 'none';

    // Lights - Brighter for vibrant colors
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1); 
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 0.8); 
    dirLight.position.set(10, 20, 10); 
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    const shadowD = 15;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    scene.add(dirLight);

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    
    // Touch / Click Listeners
    document.addEventListener('mousedown', onInputStart, false);
    document.addEventListener('touchstart', onInputStart, { passive: false });
    document.addEventListener('mouseup', onInputEnd, false);
    document.addEventListener('touchend', onInputEnd, false);

    const handleRestart = (e) => {
        e.stopPropagation(); // Prevent jump on button click
        resetGame();
    };
    restartBtn.addEventListener('click', handleRestart);
    restartBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleRestart(e);
    });

    clock = new THREE.Clock();
    
    // Load textures for obstacles
    textureLoader = new TextureLoader();
    cactusTexture = textureLoader.load('asset/Cactus.png');
    cactusTexture.colorSpace = THREE.SRGBColorSpace; // Preserve original colors
    woodTexture = textureLoader.load('asset/wood.png');
    woodTexture.colorSpace = THREE.SRGBColorSpace; // Preserve original colors
    ufoTexture = textureLoader.load('asset/ufo.png');
    ufoTexture.colorSpace = THREE.SRGBColorSpace; // Preserve original colors
    
    // Load jump sound
    jumpSound = new Audio('asset/cartoon-jump-6462.mp3');
    jumpSound.volume = 0.5; // Set volume (0.0 to 1.0)
    jumpSound.preload = 'auto';
    
    // Load coin collect sound
    collectSound = new Audio('asset/collect.mp3');
    collectSound.volume = 0.5;
    collectSound.preload = 'auto';
    
    // Load background music (if available)
    bgMusic = new Audio('asset/backgroundmusic.mp3');
    bgMusic.volume = 0.3;
    bgMusic.loop = true;
    bgMusic.preload = 'auto';
    
    // Home screen button listeners (click and touch)
    const handlePlay = () => {
        homeScreen.style.display = 'none';
        uiContainer.style.display = 'block';
        musicToggle.style.display = 'block';
        gameStarted = true;
        startGame();
        if (musicEnabled && bgMusic) {
            bgMusic.play().catch(e => console.log("Music play failed:", e));
        }
    };
    playBtn.addEventListener('click', handlePlay);
    playBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlePlay();
    });
    
    const handleMusicBtn = () => {
        musicEnabled = !musicEnabled;
        updateMusicButton();
        if (musicEnabled && bgMusic) {
            bgMusic.play().catch(e => console.log("Music play failed:", e));
        } else if (bgMusic) {
            bgMusic.pause();
        }
    };
    musicBtn.addEventListener('click', handleMusicBtn);
    musicBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMusicBtn();
    });
    
    const handleMusicToggle = (e) => {
        e.stopPropagation();
        musicEnabled = !musicEnabled;
        updateMusicToggle();
        if (musicEnabled && bgMusic) {
            bgMusic.play().catch(e => console.log("Music play failed:", e));
        } else if (bgMusic) {
            bgMusic.pause();
        }
    };
    musicToggle.addEventListener('click', handleMusicToggle);
    musicToggle.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMusicToggle(e);
    });
    
    // Start animation loop (but don't start game yet)
    animate();
}

function startGame() {
    createPlayer();
    resetGame();
}

function resetGame() {
    // Clear existing objects
    obstacles.forEach(o => scene.remove(o.mesh));
    coins.forEach(c => scene.remove(c.mesh));
    groundBlocks.forEach(g => scene.remove(g.mesh));
    
    obstacles = [];
    coins = [];
    groundBlocks = [];
    
    score = 0;
    scoreEl.innerText = "0";
    gameActive = true;
    speed = minSpeed; // Reset to start speed
    lastObstacleZ = -999;
    
    player.position.set(0, 0.8, 0); // Raised to sit on top of ground tiles (ground top is at y=0.5) 
    player.currentLane = 0; 
    player.verticalVelocity = 0;
    player.isJumping = false;

    gameOverEl.style.display = 'none';

    // Initial Ground
    for (let i = -5; i < 15; i++) {
        spawnGroundRow(i * BLOCK_SIZE, true); 
    }
}

// --- Player ---
function createPlayer() {
    // Create player as a group to add ninja decorations
    player = new THREE.Group();
    
    // 1. Main red cube body
    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: COLOR_PLAYER, 
        emissive: COLOR_PLAYER, 
        emissiveIntensity: 0.3 
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    player.add(body);
    
    // 2. Ninja mask on front face (black)
    const maskSize = 0.5;
    const maskGeometry = new THREE.PlaneGeometry(maskSize, maskSize * 0.6);
    const maskMaterial = new THREE.MeshStandardMaterial({ 
        color: COLOR_NINJA_MASK,
        emissive: COLOR_NINJA_MASK,
        emissiveIntensity: 0.1
    });
    const mask = new THREE.Mesh(maskGeometry, maskMaterial);
    mask.position.set(0, 0.1, 0.31); // Front face, slightly up
    mask.rotation.y = 0;
    player.add(mask);
    
    // 3. Ninja headband (horizontal black stripe on top)
    const headbandGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
    const headbandMaterial = new THREE.MeshStandardMaterial({ 
        color: COLOR_NINJA_MASK,
        emissive: COLOR_NINJA_MASK,
        emissiveIntensity: 0.1
    });
    const headband = new THREE.Mesh(headbandGeometry, headbandMaterial);
    headband.position.set(0, 0.35, 0);
    player.add(headband);
    
    // 4. Ninja belt (horizontal stripe around middle)
    const beltGeometry = new THREE.BoxGeometry(0.65, 0.08, 0.65);
    const beltMaterial = new THREE.MeshStandardMaterial({ 
        color: COLOR_NINJA_BELT,
        emissive: COLOR_NINJA_BELT,
        emissiveIntensity: 0.1
    });
    const belt = new THREE.Mesh(beltGeometry, beltMaterial);
    belt.position.set(0, -0.1, 0);
    player.add(belt);
    
    // 5. Ninja shuriken on side (small decorative element)
    const shurikenSize = 0.15;
    const shurikenGeometry = new THREE.PlaneGeometry(shurikenSize, shurikenSize);
    const shurikenMaterial = new THREE.MeshStandardMaterial({ 
        color: COLOR_NINJA_MASK,
        emissive: COLOR_NINJA_MASK,
        emissiveIntensity: 0.1,
        side: THREE.DoubleSide
    });
    const shuriken = new THREE.Mesh(shurikenGeometry, shurikenMaterial);
    shuriken.rotation.y = Math.PI / 2;
    shuriken.position.set(0.31, 0.2, 0); // Right side
    player.add(shuriken);
    
    player.castShadow = true;
    player.receiveShadow = true;
    player.position.y = 0.8; 
    scene.add(player);
    
    player.currentLane = 0; 
    player.targetX = 0;
    player.verticalVelocity = 0;
    player.isJumping = false;
    
    player.update = function(dt) {
        player.position.x = 0; 

        // Gravity and Jumping
        if (player.isJumping) {
            player.verticalVelocity -= 35 * dt;
            player.position.y += player.verticalVelocity * dt;
            
            if (player.position.y <= 0.8) {
                player.position.y = 0.8;
                player.isJumping = false;
                player.verticalVelocity = 0;
            }
        }
        
        player.position.z += speed * dt;
        
        // Camera Follow
        const offset = 10;
        camera.position.set(player.position.x - offset, player.position.y + offset, player.position.z - offset);
        camera.lookAt(player.position.x, player.position.y, player.position.z + 5); 
        
        // Light Follow
        dirLight.position.set(player.position.x + 10, player.position.y + 20, player.position.z + 10);
        dirLight.target.position.set(player.position.x, player.position.y, player.position.z);
        dirLight.target.updateMatrixWorld();
    };
}

// --- Input Handling ---
function onInputStart(event) {
    // Ignore touches/clicks on buttons
    const target = event.target;
    if (target.id === 'restart-btn' || target.id === 'play-btn' || 
        target.id === 'music-btn' || target.id === 'music-toggle' ||
        target.closest('button')) {
        return;
    }
    
    if (event.type === 'touchstart') event.preventDefault(); 
    
    if (!gameActive) return;

    if (!player.isJumping) {
        player.verticalVelocity = 15; 
        player.isJumping = true;
        
        // Play jump sound
        if (jumpSound) {
            jumpSound.currentTime = 0; // Reset to start
            jumpSound.play().catch(e => console.log("Audio play failed:", e));
        }
    }
}

function onInputEnd(event) {
    // Ignore touches/clicks on buttons
    const target = event.target;
    if (target.id === 'restart-btn' || target.id === 'play-btn' || 
        target.id === 'music-btn' || target.id === 'music-toggle' ||
        target.closest('button')) {
        return;
    }
    
    if (!gameActive) return;
    
    if (player.isJumping && player.verticalVelocity > 5) {
        player.verticalVelocity = 5;
    }
}

function onKeyDown(event) {
    if (['ArrowUp', 'KeyW', 'Space'].includes(event.code)) {
        onInputStart(event);
    }
}

function onKeyUp(event) {
    if (['ArrowUp', 'KeyW', 'Space'].includes(event.code)) {
        onInputEnd(event);
    }
}

// --- World Generation ---

function createBlock(x, y, z, colorTop, colorSide) {
    // Instead of a simple box, create a group with details
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // 1. Main Block
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    // Face order: +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back)
    // In our isometric view: Left visible side = -X, Right visible side = +Z
    const materials = [
        new THREE.MeshStandardMaterial({ color: colorSide, emissive: colorSide, emissiveIntensity: 0.2 }), // +X Right (hidden)
        new THREE.MeshStandardMaterial({ color: COLOR_GROUND_FRONT, emissive: COLOR_GROUND_FRONT, emissiveIntensity: 0.2 }), // -X Left (Visible Left - BRIGHTER)
        new THREE.MeshStandardMaterial({ color: colorTop, emissive: colorTop, emissiveIntensity: 0.2 }),   // +Y Top
        new THREE.MeshStandardMaterial({ color: colorSide, emissive: colorSide, emissiveIntensity: 0.2 }), // -Y Bottom
        new THREE.MeshStandardMaterial({ color: colorSide, emissive: colorSide, emissiveIntensity: 0.2 }), // +Z Front (Visible Right - DARKER)
        new THREE.MeshStandardMaterial({ color: colorSide, emissive: colorSide, emissiveIntensity: 0.2 })  // -Z Back (hidden)
    ];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 2. Inner Square Detail
    // Create a slightly smaller square on top
    const innerSize = BLOCK_SIZE * 0.6;
    const innerGeo = new THREE.PlaneGeometry(innerSize, innerSize);
    const innerMat = new THREE.MeshStandardMaterial({ 
        color: 0xFFDEAD, // NavajoWhite (slightly darker than top)
        side: THREE.DoubleSide 
    });
    const innerSquare = new THREE.Mesh(innerGeo, innerMat);
    innerSquare.rotation.x = -Math.PI / 2;
    innerSquare.position.y = BLOCK_SIZE / 2 + 0.01; // Slightly above
    innerSquare.receiveShadow = true;
    group.add(innerSquare);
    
    // 3. Even smaller center dot? (Optional, based on reference)
    const dotSize = BLOCK_SIZE * 0.2;
    const dotGeo = new THREE.PlaneGeometry(dotSize, dotSize);
    const dotMat = new THREE.MeshStandardMaterial({ color: colorTop });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = BLOCK_SIZE / 2 + 0.02;
    dot.receiveShadow = true;
    group.add(dot);

    // 4. Lower dirt layer on front face (-X, left visible side)
    const frontDirtHeight = BLOCK_SIZE * 0.5; // Lower half
    const frontDirtGeo = new THREE.PlaneGeometry(BLOCK_SIZE, frontDirtHeight);
    const frontDirtMat = new THREE.MeshStandardMaterial({ 
        color: COLOR_GROUND_DIRT,
        emissive: COLOR_GROUND_DIRT,
        emissiveIntensity: 0.15,
        side: THREE.DoubleSide
    });
    const frontDirt = new THREE.Mesh(frontDirtGeo, frontDirtMat);
    frontDirt.rotation.y = Math.PI / 2; // Face towards -X (left)
    frontDirt.position.set(-BLOCK_SIZE / 2 - 0.01, -BLOCK_SIZE / 4, 0); // Lower half, slightly forward
    frontDirt.receiveShadow = true;
    group.add(frontDirt);

    // 5. Lower dirt layer on side face (+Z, right visible side)
    const sideDirtHeight = BLOCK_SIZE * 0.5; // Lower half
    const sideDirtGeo = new THREE.PlaneGeometry(BLOCK_SIZE, sideDirtHeight);
    const sideDirtMat = new THREE.MeshStandardMaterial({ 
        color: COLOR_GROUND_DIRT,
        emissive: COLOR_GROUND_DIRT,
        emissiveIntensity: 0.15,
        side: THREE.DoubleSide
    });
    const sideDirt = new THREE.Mesh(sideDirtGeo, sideDirtMat);
    sideDirt.rotation.y = 0; // Face towards +Z (front/right)
    sideDirt.position.set(0, -BLOCK_SIZE / 4, BLOCK_SIZE / 2 + 0.01); // Lower half, slightly forward
    sideDirt.receiveShadow = true;
    group.add(sideDirt);

    // 6. Lower dirt layer on right face (+X, for decorative right blocks)
    const rightDirt = new THREE.Mesh(frontDirtGeo.clone(), frontDirtMat.clone());
    rightDirt.rotation.y = -Math.PI / 2; // Face towards +X (right)
    rightDirt.position.set(BLOCK_SIZE / 2 + 0.01, -BLOCK_SIZE / 4, 0); // Lower half, slightly forward
    rightDirt.receiveShadow = true;
    group.add(rightDirt);

    // 7. Lower dirt layer on back face (-Z, for completeness)
    const backDirt = new THREE.Mesh(sideDirtGeo.clone(), sideDirtMat.clone());
    backDirt.rotation.y = Math.PI; // Face towards -Z (back)
    backDirt.position.set(0, -BLOCK_SIZE / 4, -BLOCK_SIZE / 2 - 0.01); // Lower half, slightly forward
    backDirt.receiveShadow = true;
    group.add(backDirt);

    scene.add(group);
    return group;
}

function spawnGroundRow(z, instant = false) {
    // Main lane
    const x = 0;
    const startY = instant ? 0 : -5; 
    const block = createBlock(x, startY, z, COLOR_GROUND_TOP, COLOR_GROUND_SIDE);
    groundBlocks.push({ 
        mesh: block, 
        originalY: 0, 
        falling: false,
        rising: !instant,
        velocity: 0 
    });

    // Decorative lanes
    const decorativeLanes = [-1, 1]; 
    decorativeLanes.forEach(laneIndex => {
        const x = laneIndex * laneWidth;
        const targetY = -0.2;
        const startY = instant ? targetY : -5;
        const block = createBlock(x, startY, z, COLOR_GROUND_TOP, COLOR_GROUND_SIDE);
        groundBlocks.push({ 
            mesh: block, 
            originalY: targetY, 
            falling: false,
            rising: !instant,
            velocity: 0 
        });
        
        if (laneIndex === 1 && Math.random() < 0.6) {
            spawnTree(x, 0.6, z, instant); // Lowered from 0.8 to 0.6 to sit on side block
        }
    });

    if (z > 5) { 
        spawnItems(z, instant);
    }
}

function spawnTree(x, y, z, instant = false) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Tree Trunk
    const trunkGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
    const trunkMat = new THREE.MeshStandardMaterial({ 
        color: COLOR_TREE_TRUNK,
        emissive: COLOR_TREE_TRUNK,
        emissiveIntensity: 0.15
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    group.add(trunk);
    
    // Leaves
    const leavesGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const leavesMat = new THREE.MeshStandardMaterial({ 
        color: COLOR_TREE_LEAVES,
        emissive: COLOR_TREE_LEAVES,
        emissiveIntensity: 0.3
    });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 0.6;
    leaves.castShadow = true;
    group.add(leaves);

    // Square Shadow Base
    const shadowSize = 0.5;
    const shadowGeo = new THREE.PlaneGeometry(shadowSize, shadowSize);
    const shadowMat = new THREE.MeshBasicMaterial({ 
        color: COLOR_SHADOW,
        transparent: true,
        opacity: 0.5
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.3 + 0.02; // On top of the ground block (0.8 - 0.3 height - roughly)
    // Actually, tree is at y=0.8 relative to scene. Ground top is 0.5 (block height/2).
    // Tree group is at 0.8. Relative to group, y=0 is center of trunk (0.6h).
    // Trunk bottom is at -0.3. 
    // Ground top is at -0.3 relative to tree group center.
    shadow.position.y = -0.3 + 0.02; 
    group.add(shadow);

    if (!instant) group.scale.set(0.1, 0.1, 0.1);
    scene.add(group);
    
    obstacles.push({ mesh: group, isDecoration: true, growing: !instant });
}

function spawnItems(z, instant = false) {
    if (z - lastObstacleZ < 6) {
        if (Math.random() < 0.06) createCoin(0, z, false, instant);
        return;
    }

    if (Math.random() < 0.3) { 
        // Randomly choose obstacle type
        const obstacleType = Math.random();
        let isUfo = false;
        if (obstacleType < 0.10) {
            // UFO - 10% chance (air obstacle, must not jump)
            createUfo(0, z, instant);
            isUfo = true;
        } else if (obstacleType < 0.20) {
            // Cactus - 10% chance (less frequent)
            createCactus(0, z, instant);
        } else if (obstacleType < 0.50) {
            // Wood - 30% chance
            createWood(0, z, instant);
        } else {
            // Spike - 50% chance (most common)
            createObstacle(0, z, instant);
        }
        lastObstacleZ = z;
        
        if (Math.random() < 0.4) {
            // UFO: coin at bottom (player must stay low), others: coin in air (player must jump)
            createCoin(0, z, !isUfo, instant); 
        }
    } else if (Math.random() < 0.08) {
        createCoin(0, z, false, instant);
    }
}

function createObstacle(lane, z, instant = false) {
    // Spike obstacle
    const geometry = new THREE.ConeGeometry(0.4, 0.6, 4); 
    const material = new THREE.MeshStandardMaterial({ color: COLOR_OBSTACLE, flatShading: true });
    const obs = new THREE.Mesh(geometry, material);
    obs.position.set(lane * laneWidth, 0.8, z); 
    obs.rotation.y = Math.PI / 4; 
    obs.castShadow = true;
    if (!instant) obs.scale.set(0.1, 0.1, 0.1);
    scene.add(obs);
    // Collision box size: width 0.6, height 0.6, depth 0.6
    obstacles.push({ mesh: obs, hit: false, isDecoration: false, growing: !instant, collisionSize: new THREE.Vector3(0.6, 0.6, 0.6) });
}

function createCactus(lane, z, instant = false) {
    // Cactus obstacle - sprite style (image already designed in 3D perspective)
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: cactusTexture,
        transparent: true
    });
    const obs = new THREE.Sprite(spriteMaterial);
    obs.position.set(lane * laneWidth, 1.0, z);
    obs.scale.set(1.0, 1.2, 1.0); // Adjust size
    if (!instant) obs.scale.set(0.1, 0.1, 0.1);
    scene.add(obs);
    // Collision box size: width 0.6, height 0.8, depth 0.6 (similar to spike)
    obstacles.push({ mesh: obs, hit: false, isDecoration: false, growing: !instant, targetScale: new THREE.Vector3(1.0, 1.2, 1.0), collisionSize: new THREE.Vector3(0.6, 0.8, 0.6) });
}

function createWood(lane, z, instant = false) {
    // Wood obstacle - sprite style
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: woodTexture,
        transparent: true
    });
    const obs = new THREE.Sprite(spriteMaterial);
    obs.position.set(lane * laneWidth, 0.8, z);
    obs.scale.set(1.0, 0.8, 1.0); // Adjust size
    if (!instant) obs.scale.set(0.1, 0.1, 0.1);
    scene.add(obs);
    // Collision box size: width 0.7, height 0.5, depth 0.6 (wider like a log)
    obstacles.push({ mesh: obs, hit: false, isDecoration: false, growing: !instant, targetScale: new THREE.Vector3(1.0, 0.8, 1.0), collisionSize: new THREE.Vector3(0.7, 0.5, 0.6) });
}

function createUfo(lane, z, instant = false) {
    // UFO obstacle - floating in the air, player must NOT jump (go under it)
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: ufoTexture,
        transparent: true
    });
    const obs = new THREE.Sprite(spriteMaterial);
    obs.position.set(lane * laneWidth, 2.2, z); // High position - player passes underneath
    obs.scale.set(1.2, 0.8, 1.0); // UFO shape (wider)
    if (!instant) obs.scale.set(0.1, 0.1, 0.1);
    scene.add(obs);
    // Collision box: positioned high so jumping into it causes collision
    // Player height ~0.5, jump height ~2.0, so UFO at 2.2 with height 0.8 will catch jumping players
    obstacles.push({ mesh: obs, hit: false, isDecoration: false, growing: !instant, targetScale: new THREE.Vector3(1.2, 0.8, 1.0), collisionSize: new THREE.Vector3(0.8, 0.6, 0.6) });
}

function createCoin(lane, z, high = false, instant = false) {
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.05);
    const material = new THREE.MeshStandardMaterial({ 
        color: COLOR_COIN,
        emissive: COLOR_COIN,
        emissiveIntensity: 0.4
    });
    const coin = new THREE.Mesh(geometry, material);
    coin.rotation.z = Math.PI / 4;
    
    const yPos = high ? 2.5 : 1.0; 
    coin.position.set(lane * laneWidth, yPos, z);
    if (!instant) coin.scale.set(0.1, 0.1, 0.1);
    scene.add(coin);
    coins.push({ mesh: coin, active: true, growing: !instant });
}

// --- Game Logic ---
function update(dt) {
    if (!gameActive) return;

    player.update(dt);
    
    // Accelerate
    if (speed < maxSpeed) {
        speed += acceleration * dt;
    }

    const playerZ = player.position.z;
    
    // 1. Spawn new rows - Reduced lookahead for "building near" effect
    const lastBlock = groundBlocks[groundBlocks.length - 1];
    if (lastBlock && lastBlock.mesh.position.z < playerZ + 15) { 
        spawnGroundRow(lastBlock.mesh.position.z + BLOCK_SIZE);
    }
    
    // 2. Manage Ground Blocks (Rise & Fall)
    for (let i = groundBlocks.length - 1; i >= 0; i--) {
        const b = groundBlocks[i];
        
        // Rising (Building Effect)
        if (b.rising) {
            // Faster rise
            b.mesh.position.y += (b.originalY - b.mesh.position.y) * 10 * dt;
            if (Math.abs(b.mesh.position.y - b.originalY) < 0.05) {
                b.mesh.position.y = b.originalY;
                b.rising = false;
            }
        }

        // Check Falling
        if (b.mesh.position.z < playerZ - 3) {
            b.falling = true;
            b.rising = false;
        }
        
        if (b.falling) {
            b.velocity += 20 * dt; 
            b.mesh.position.y -= b.velocity * dt;
            
            if (b.mesh.position.y < -10) {
                scene.remove(b.mesh);
                groundBlocks.splice(i, 1);
            }
        }
    }

    checkCollisions(dt);
    
    // Rotate items
    coins.forEach(c => c.mesh.rotation.y += 2 * dt);
}

function checkCollisions(dt) {
    const playerBox = new THREE.Box3().setFromObject(player);
    playerBox.expandByScalar(-0.1);

    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        
        // Pop-in animation
        if (obs.growing) {
            const targetScale = obs.targetScale || new THREE.Vector3(1, 1, 1);
            const s = obs.mesh.scale.x + 5 * dt;
            if (s >= targetScale.x) {
                obs.mesh.scale.copy(targetScale);
                obs.growing = false;
            } else {
                const ratio = s / targetScale.x;
                obs.mesh.scale.set(targetScale.x * ratio, targetScale.y * ratio, targetScale.z * ratio);
            }
        }

        if (obs.mesh.position.z < player.position.z - 5) {
            scene.remove(obs.mesh);
            obstacles.splice(i, 1);
            continue;
        }

        if (obs.isDecoration) continue; 
        
        // Use custom collision size for consistent hitbox
        const pos = obs.mesh.position;
        const size = obs.collisionSize || new THREE.Vector3(0.6, 0.6, 0.6);
        const obsBox = new THREE.Box3(
            new THREE.Vector3(pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2),
            new THREE.Vector3(pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2)
        );
        
        if (playerBox.intersectsBox(obsBox)) {
            gameOver();
        }
    }

    // Coins
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        
        // Pop-in animation
        if (coin.growing) {
            const s = coin.mesh.scale.x + 5 * dt;
            if (s >= 1) {
                coin.mesh.scale.set(1, 1, 1);
                coin.growing = false;
            } else {
                coin.mesh.scale.set(s, s, s);
            }
        }

        if (coin.mesh.position.z < player.position.z - 5) {
            scene.remove(coin.mesh);
            coins.splice(i, 1);
            continue;
        }
        
        if (coin.active && coin.mesh.position.distanceTo(player.position) < 1.5) {
            collectCoin(coin);
            coins.splice(i, 1);
        }
    }
}

function collectCoin(coinObj) {
    scene.remove(coinObj.mesh);
    score += 1;
    scoreEl.innerText = score;
    
    // Play collect sound
    if (collectSound) {
        collectSound.currentTime = 0;
        collectSound.play().catch(e => console.log("Audio play failed:", e));
    }
}

function gameOver() {
    gameActive = false;
    finalScoreEl.innerText = score;
    gameOverEl.style.display = 'block';
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 7; 
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (gameStarted) {
        update(dt);
    }
    renderer.render(scene, camera);
}

function updateMusicButton() {
    if (musicEnabled) {
        musicBtn.textContent = '🎵 MUSIC: ON';
        musicBtn.classList.remove('off');
    } else {
        musicBtn.textContent = '🎵 MUSIC: OFF';
        musicBtn.classList.add('off');
    }
}

function updateMusicToggle() {
    if (musicEnabled) {
        musicToggle.textContent = '🎵 ON';
        musicToggle.classList.remove('off');
    } else {
        musicToggle.textContent = '🎵 OFF';
        musicToggle.classList.add('off');
    }
}

init();
