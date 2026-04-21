window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) { window.setTimeout(callback, 1000 / 60); };
})();

var game = (function () {
    var GAME_STATE = { SPLASH: 0, MENU: 1, PLAYING: 2, CREDITS: 3 };
    var STORAGE_SCORES = "invaders_high_scores_v2";
    var STORAGE_NAME = "invaders_player_name";
    var MAX_LIVES = 5;

    var canvas, ctx, buffer, bufferctx;
    var bgMain, bgBoss, playerShotImage, enemyShotImage, playerImage, playerKilledImage, heartImage;
    var bgScrollY = 0;
    var starsParallax = [];
    var BG_ASSET_W = 1168;
    var BG_ASSET_H = 784;
    var lastScoreValue = 0;
    var scoreJitterUntil = 0;
    var levelStatusUntil = 0;
    var previousLifeValue = 3;
    var lifeGainAnimUntil = 0;
    var lifeGainIndex = -1;
    var enemyImages = [], bossImages = [], enemyKilledImage, bossKilledImage;

    var player = null;
    
    // ==================== AUDIO MANAGER ====================
    const AudioManager = {
        currentMusic: null,
        musicMap: {},
        sfxMap: {},
        musicEnabled: true,
        sfxEnabled: true,
        sfxVolume: 0.7,
        musicVolume: 0.5,

        init() {
            // Initialize music mappings
            this.musicMap = {
                "bg_menu": "sounds/bg_menu.mp3",
                "bg_gameplay": "sounds/bg_gameplay.mp3",
                "bg_boss": "sounds/bg_boss.mp3",
                "bg_victory": "sounds/bg_victory.mp3",
                "bg_gameover": "sounds/bg_gameover.mp3"
            };

            // Initialize SFX mappings
            this.sfxMap = {
                "player_shoot": "sounds/player_shoot.wav",
                "enemy_shoot": "sounds/enemy_shoot.wav",
                "hit_enemy": "sounds/hit_enemy.wav",
                "hit_player": "sounds/hit_player.wav",
                "explosion_small": "sounds/explosion_small.wav",
                "explosion_big": "sounds/explosion_big.wav",
                "powerup_pick": "sounds/powerup_pick.wav",
                "heal": "sounds/heal.wav",
                "shield_on": "sounds/shield_on.wav",
                "menu_move": "sounds/menu_move.wav",
                "menu_select": "sounds/menu_select.wav",
                "game_start": "sounds/game_start.wav",
                "boss_warning": "sounds/boss_warning.wav",
                "wave_transition": "sounds/wave_transition.wav"
            };

            // Preload audio files
            this.preloadAudio();
        },

        preloadAudio() {
            // Preload music files
            for (let key in this.musicMap) {
                const audio = new Audio();
                audio.src = this.musicMap[key];
                audio.loop = true;
                audio.volume = this.musicVolume;
                audio.preload = "auto";
                this.musicMap[key] = audio;
            }

            // Preload SFX files
            for (let key in this.sfxMap) {
                const audio = new Audio();
                audio.src = this.sfxMap[key];
                audio.volume = this.sfxVolume;
                audio.preload = "auto";
                this.sfxMap[key] = audio;
            }
        },

        playMusic(name) {
            if (!this.musicEnabled || !this.musicMap[name]) return;

            // Stop current music
            this.stopMusic();

            // Play new music
            const music = this.musicMap[name];
            if (music) {
                music.currentTime = 0;
                music.volume = this.musicVolume;
                music.play().catch(e => console.log("Music play failed:", e));
                this.currentMusic = music;
            }
        },

        stopMusic() {
            if (this.currentMusic) {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
                this.currentMusic = null;
            }
        },

        playSfx(name) {
            if (!this.sfxEnabled || !this.sfxMap[name]) return;

            const sfx = this.sfxMap[name];
            if (sfx) {
                // Clone the audio to allow simultaneous playback
                const sfxClone = sfx.cloneNode();
                sfxClone.volume = this.sfxVolume;
                sfxClone.currentTime = 0;
                sfxClone.play().catch(e => console.log("SFX play failed:", e));
            }
        },

        setMusicVolume(volume) {
            this.musicVolume = Math.max(0, Math.min(1, volume));
            if (this.currentMusic) {
                this.currentMusic.volume = this.musicVolume;
            }
        },

        setSfxVolume(volume) {
            this.sfxVolume = Math.max(0, Math.min(1, volume));
            // Update volume for all SFX
            for (let key in this.sfxMap) {
                if (this.sfxMap[key] && this.sfxMap[key].volume !== undefined) {
                    this.sfxMap[key].volume = this.sfxVolume;
                }
            }
        },

        toggleMusic() {
            this.musicEnabled = !this.musicEnabled;
            if (!this.musicEnabled) {
                this.stopMusic();
            }
            return this.musicEnabled;
        },

        toggleSfx() {
            this.sfxEnabled = !this.sfxEnabled;
            return this.sfxEnabled;
        },

        // Context-aware audio methods
        playMenuMusic() {
            this.playMusic("bg_menu");
        },

        playGameplayMusic() {
            this.playMusic("bg_gameplay");
        },

        playBossMusic() {
            this.playMusic("bg_boss");
        },

        playVictoryMusic() {
            this.playMusic("bg_victory");
        },

        playGameOverMusic() {
            this.playMusic("bg_gameover");
        },

        // Game-specific SFX methods
        playPlayerShoot() {
            this.playSfx("player_shoot");
        },

        playEnemyShoot() {
            this.playSfx("enemy_shoot");
        },

        playHitEnemy() {
            this.playSfx("hit_enemy");
        },

        playHitPlayer() {
            this.playSfx("hit_player");
        },

        playExplosionSmall() {
            this.playSfx("explosion_small");
        },

        playExplosionBig() {
            this.playSfx("explosion_big");
        },

        playPowerUpPick() {
            this.playSfx("powerup_pick");
        },

        playHeal() {
            this.playSfx("heal");
        },

        playShieldOn() {
            this.playSfx("shield_on");
        },

        playMenuMove() {
            this.playSfx("menu_move");
        },

        playMenuSelect() {
            this.playSfx("menu_select");
        },

        playGameStart() {
            this.playSfx("game_start");
        },

        playBossWarning() {
            this.playSfx("boss_warning");
        },

        playWaveTransition() {
            this.playSfx("wave_transition");
        }
    };
    var enemies = [];
    var playerShots = [];
    var enemyShots = [];
    var heartDrops = [];
    var powerUpDrops = [];
    var deathEffects = [];

    var keyPressed = {};
    var keyMap = { left: 37, right: 39, fire: 32 };
    var fireLock = false;
    var nextPlayerShot = 0;
    var playerShotDelay = 380;

    var level = 1;
    var enemiesKilled = 0;
    var currentWave = 0;
    var totalWaves = 5;
    var waves = [];
    var waveState = "idle"; // idle | announce | fight | transition | completed
    var waveAnnouncementStart = 0;
    var waveAnnouncementDuration = 2000;
    var waveTransitionUntil = 0;
    var killsInLevel = 0;
    var killsTargetInLevel = 8;
    var levelMaxEnemiesAlive = 1;
    var sessionActive = false;
    var gameOver = false;
    var paused = false;
    var overlayShown = false;
    var startScreen = null;
    var gameState = GAME_STATE.SPLASH;
    var isFirstStart = true;
    var playerName = "jugador";
    var pauseOptions = ["REINICIAR NIVEL", "PANTALLA INICIAL"];
    var pauseSelection = 0;
    var activePowerUps = { triple: 0, shield: 0, speed: 0 };
    var powerUpDurations = { triple: 8000, shield: 5000, speed: 6000 };

    var formationOffsetX = 0;
    var formationDir = 1;
    var formationSpeed = 1;
    var activeFormationController = null;
    var secondaryFormationControllers = []; // Fix: Declare as global array
    
    // Boss system variables
    var bossHP = 0;
    var bossMaxHP = 0;
    var bossMinionWavesSpawned = 0;
    var maxBossMinionWaves = 5;
    var bossActive = false;
    var currentBoss = null;
    
    // Screen shake system variables
    var screenShake = {
        intensity: 0,
        duration: 0,
        startTime: 0,
        offsetX: 0,
        offsetY: 0
    };
    
    // Boss intro system variables
    var bossIntro = {
        active: false,
        startTime: 0,
        duration: 0,
        startY: -100,
        targetY: 80,
        warningText: "BOSS INCOMING"
    };
    
    // Combo multiplier system variables
    var combo = {
        count: 0,
        timer: 0,
        resetTime: 2500, // 2.5 seconds without kills = reset
        maxMultiplier: 5, // Maximum combo multiplier
        multiplier: 1,
        baseMultiplier: 1
    };
    
    // Floating text system variables
    var floatingTexts = []; // Array to hold all floating texts
    function getPlayerName() {
        var n = localStorage.getItem(STORAGE_NAME);
        if (n && n.replace(/\s/g, "").length) {
            return n.trim().substring(0, 24);
        }
        return "jugador";
    }

    function setPlayerName(name) {
        var t = (name || "").trim();
        if (!t.length) { t = "jugador"; }
        if (t.length > 24) { t = t.substring(0, 24); }
        playerName = t;
        localStorage.setItem(STORAGE_NAME, t);
        syncNameUI();
    }

    function syncNameUI() {
        playerName = getPlayerName();
        var show = document.getElementById("nombre-mostrar");
        var input = document.getElementById("nombre-jugador");
        if (show) { show.textContent = getPlayerName(); }
        if (input) { input.value = getPlayerName(); }
    }

    function preloadImages() {
        for (var i = 1; i <= 8; i++) {
            var ei = new Image();
            ei.src = "images/malo" + i + ".png";
            enemyImages.push(ei);
            var bi = new Image();
            bi.src = "images/jefe" + i + ".png";
            bossImages.push(bi);
        }
        enemyKilledImage = new Image();
        enemyKilledImage.src = "images/malo_muerto.png";
        bossKilledImage = new Image();
        bossKilledImage.src = "images/jefe_muerto.png";
        bgMain = new Image();
        bgMain.src = "images/fondovertical.png";
        bgBoss = new Image();
        bgBoss.src = "images/fondovertical_jefe.png";
        playerShotImage = new Image();
        playerShotImage.src = "images/disparo_bueno.png";
        enemyShotImage = new Image();
        enemyShotImage.src = "images/disparo_malo.png";
        playerImage = new Image();
        playerImage.src = "images/bueno.png";
        playerKilledImage = new Image();
        playerKilledImage.src = "images/bueno_muerto.png";
        heartImage = new Image();
        heartImage.src = "images/corazon.png";
        bgMain = new Image();
        bgMain.onerror = function () {
            bgMain.onerror = null;
            bgMain.src = "images/fondovertical.png";
        };
        bgMain.src = "images/Level_Normal_BG.jpg";

        bgBoss = new Image();
        bgBoss.onerror = function () {
            bgBoss.onerror = null;
            bgBoss.src = "images/fondovertical_jefe.png";
        };
        bgBoss.src = "images/Level_Boss_BG.jpg";
    }

    function spriteW(img, fallback) { return (img && (img.width || img.naturalWidth)) || fallback; }
    function spriteH(img, fallback) { return (img && (img.height || img.naturalHeight)) || fallback; }
    function rand(max) { return Math.floor(Math.random() * max); }

    function StartScreen(canvasEl, ctxEl, startCallback) {
        this.animImage = new Image();
        this.animImage.src = "images/fondo_pantalla_inicio.jpg";
        this.splashLogo = new Image();
        this.splashLogo.onerror = function () { this.splashLogo.src = "images/Studio_Branding.jpeg"; }.bind(this);
        this.splashLogo.src = "images/Studio_Branding.png";
        this.canvas = canvasEl;
        this.ctx = ctxEl;
        this.onStart = startCallback;
        this.font = "'Press Start 2P', monospace";
        this.menu = ["PLAY", "CREDITS"];
        this.selected = 0;
        this.mode = "menu";
        this.flicker = 1;
        this.flickerTick = 0;
        this.nebulaTick = 0;
        this.selectorTick = 0;
        this.showCreditsUntil = 0;
        this.nameInput = "";
        this.readyMessage = "";
        this.readyUntil = 0;
        this.introIndex = 0;
        this.introSceneStart = 0;
        this.introFadeMs = 1000;
        this.introSceneMs = 4200;
        this.splashStartMs = Date.now();
        this.splashTotalMs = 5000;
        this.splashFadeInMs = 2500;
        this.splashFadeOutMs = 1000;
        this.introSkipHint = "PRESS [S] TO SKIP STORY";
        
        this.introScenes = [
            {
                src: "images/Narrativa_escena1.jpg",
                text: "En el sector mas profundo de la Nebulosa Esmeralda, el planeta Aethel prosperaba bajo la proteccion de la Gran Medusa..."
            },
            {
                src: "images/Narrativa_escena2.jpg",
                text: "Pero la Hora Cero ha llegado. El Enjambre Voraz ha cruzado el vacio para consumirlo todo."
            },
            {
                src: "images/Narrativa_escena3.jpg",
                text: "Solo tu puedes interponerte. Defiende tu hogar, Guardiana!"
            }
        ];
        this.introImages = [];
        this.loadIntroImages();
        this.active = true;
        this.layers = [
            this.createStars(44, 0.25, 0.4, 1.2),
            this.createStars(26, 0.55, 0.8, 2.1),
            this.createStars(16, 0.9, 1.4, 3.2)
        ];
    }

    StartScreen.prototype.createStars = function (count, speed, sizeMin, sizeMax) {
        var stars = [];
        for (var i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: sizeMin + Math.random() * (sizeMax - sizeMin),
                speed: speed * (0.6 + Math.random() * 0.9),
                alpha: 0.35 + Math.random() * 0.6
            });
        }
        return stars;
    };

    StartScreen.prototype.loadIntroImages = function () {
        this.introImages.length = 0;
        for (var i = 0; i < this.introScenes.length; i++) {
            var img = new Image();
            img.src = this.introScenes[i].src;
            this.introImages.push(img);
        }
    };

    StartScreen.prototype.activate = function () {
        this.active = true;
        this.selected = 0;
        this.showCreditsUntil = 0;
        this.mode = "menu";
        this.nameInput = "";
        this.readyMessage = "";
        this.readyUntil = 0;
        gameState = GAME_STATE.MENU;
        
        // Play menu music when screen activates
        AudioManager.playMenuMusic();
    };

    StartScreen.prototype.playIntro = function () {
        this.mode = "intro";
        this.introIndex = 0;
        this.introSceneStart = Date.now();
    };

    StartScreen.prototype.openNameInput = function () {
        this.mode = "nameInput";
        this.nameInput = playerName === "jugador" ? "" : playerName;
    };

    StartScreen.prototype.update = function () {
        if (!this.active) { return; }
        this.nebulaTick += 0.008;
        this.selectorTick += 0.06;
        this.flickerTick++;
        if (this.flickerTick % 6 === 0) {
            this.flicker = 0.75 + Math.random() * 0.25;
        }
        for (var i = 0; i < this.layers.length; i++) {
            var layer = this.layers[i];
            for (var j = 0; j < layer.length; j++) {
                var s = layer[j];
                s.y += s.speed;
                if (s.y > this.canvas.height + 5) {
                    s.y = -5;
                    s.x = Math.random() * this.canvas.width;
                }
            }
        }
        if (this.mode === "intro") {
            var now = Date.now();
            if (now - this.introSceneStart >= this.introSceneMs) {
                this.introIndex++;
                if (this.introIndex >= this.introScenes.length) {
                    this.openNameInput();
                } else {
                    this.introSceneStart = now;
                }
            }
        }
        if (gameState === GAME_STATE.SPLASH) {
            var splashElapsed = Date.now() - this.splashStartMs;
            if (splashElapsed >= this.splashTotalMs) {
                gameState = GAME_STATE.MENU;
                // Play menu music when transitioning from splash to menu
                AudioManager.playMenuMusic();
            }
        }
        if (this.mode === "prepare" && Date.now() >= this.readyUntil) {
            this.active = false;
            if (typeof this.onStart === "function") { this.onStart(); }
        }
        if (gameState === GAME_STATE.CREDITS && Date.now() > this.showCreditsUntil) {
            gameState = GAME_STATE.MENU;
        }
    };

    StartScreen.prototype.drawSplash = function () {
        var c = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        var elapsed = Date.now() - this.splashStartMs;
        var alpha = 1;
        if (elapsed <= this.splashFadeInMs) {
            alpha = elapsed / this.splashFadeInMs;
        } else if (elapsed >= this.splashTotalMs - this.splashFadeOutMs) {
            alpha = Math.max(0, (this.splashTotalMs - elapsed) / this.splashFadeOutMs);
        }
        var logoW = 768;
        var logoH = 768;
        var x = (900 - 768) / 2;
        var y = (600 - 768) / 2;

        c.save();
        c.globalAlpha = alpha;
        if (this.splashLogo && this.splashLogo.complete && this.splashLogo.naturalWidth > 0) {
            c.drawImage(this.splashLogo, x, y, logoW, logoH);
        } else {
            c.fillStyle = "rgba(0,255,120,0.20)";
            c.fillRect(x, y, logoW, logoH);
        }
        c.textAlign = "center";
        c.fillStyle = "#00FF00";
        c.font = "14px " + this.font;
        c.fillText("Arcade is not dead, it has evolved.", w * 0.5, y + logoH + 28);
        c.restore();
    };

    StartScreen.prototype.drawNebula = function () {
        var c = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        var alphaA = 0.14 + (Math.sin(this.nebulaTick) * 0.08);
        var alphaB = 0.08 + (Math.cos(this.nebulaTick * 0.85) * 0.05);

        var g1 = c.createRadialGradient(w * 0.2, h * 0.28, 10, w * 0.2, h * 0.28, w * 0.52);
        g1.addColorStop(0, "rgba(0,255,0," + alphaA.toFixed(3) + ")");
        g1.addColorStop(1, "rgba(0,255,0,0)");
        c.fillStyle = g1;
        c.fillRect(0, 0, w, h);

        var g2 = c.createRadialGradient(w * 0.78, h * 0.6, 10, w * 0.78, h * 0.6, w * 0.46);
        g2.addColorStop(0, "rgba(70,255,160," + alphaB.toFixed(3) + ")");
        g2.addColorStop(1, "rgba(0,255,0,0)");
        c.fillStyle = g2;
        c.fillRect(0, 0, w, h);
    };

    StartScreen.prototype.drawBackgroundImage = function () {
        var c = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        var cx = w * 0.5;
        var cy = h * 0.39;
        var iw = Math.min(w * 0.58, 520);
        var ih = Math.min(h * 0.42, 320);

        c.save();
        c.shadowColor = "rgba(0,255,0,0.7)";
        c.shadowBlur = 22;
        var glow = c.createRadialGradient(cx, cy, 28, cx, cy, iw * 0.58);
        glow.addColorStop(0, "rgba(20,255,110,0.42)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = glow;
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "rgba(0,255,0,0.85)";
        c.lineWidth = 2;
        c.strokeRect(cx - iw / 2, cy - ih / 2, iw, ih);
        if (this.animImage && this.animImage.complete && this.animImage.naturalWidth > 0) {
            c.drawImage(this.animImage, cx - iw / 2 + 2, cy - ih / 2 + 2, iw - 4, ih - 4);
        } else {
            c.fillStyle = "rgba(0,255,0,0.12)";
            c.fillRect(cx - iw / 2 + 2, cy - ih / 2 + 2, iw - 4, ih - 4);
        }
        c.restore();
    };

    StartScreen.prototype.drawTitle = function () {
        var c = this.ctx;
        c.save();
        c.globalAlpha = this.flicker;
        c.textAlign = "center";
        c.font = "25px " + this.font;
        c.fillStyle = "#00FF00";
        c.shadowColor = "rgba(0,255,0,0.85)";
        c.shadowBlur = 14;
        c.fillText(" TENTACLE DEFENSE: ZERO HOUR", this.canvas.width * 0.5, 116);
        c.restore();
    };

    StartScreen.prototype.wrapStoryLines = function (text, maxWidth) {
        var c = this.ctx;
        var words = String(text || "").split(/\s+/);
        var lines = [];
        var current = "";
        for (var i = 0; i < words.length; i++) {
            var trial = current ? (current + " " + words[i]) : words[i];
            if (c.measureText(trial).width <= maxWidth) {
                current = trial;
            } else {
                if (current) { lines.push(current); }
                current = words[i];
            }
        }
        if (current) { lines.push(current); }
        return lines;
    };

    StartScreen.prototype.drawStoryTextBox = function (text) {
        var c = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        var boxX = 36;
        var boxY = h - 212;
        var boxW = w - 72;
        var boxH = 124;
        var textX = 52;
        var textY = h - 166;
        var maxTextWidth = boxW - 32;
        var lineHeight = 19;
        c.save();
        c.fillStyle = "rgba(0,0,0,0.72)";
        c.fillRect(boxX, boxY, boxW, boxH);
        c.strokeStyle = "#00FF00";
        c.lineWidth = 2;
        c.strokeRect(boxX, boxY, boxW, boxH);
        c.font = "10px " + this.font;
        c.fillStyle = "#00FF00";
        c.textAlign = "left";
        var lines = this.wrapStoryLines(text, maxTextWidth);
        var maxLines = 3;
        for (var i = 0; i < lines.length && i < maxLines; i++) {
            c.fillText(lines[i], textX, textY + (i * lineHeight));
        }
        c.font = "9px " + this.font;
        c.textAlign = "right";
        c.fillText(this.introSkipHint, w - 52, h - 98);
        c.restore();
    };

    StartScreen.prototype.drawIntroScene = function () {
        var c = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        var now = Date.now();
        var elapsed = now - this.introSceneStart;
        var alpha = 1;
        if (elapsed < this.introFadeMs) {
            alpha = elapsed / this.introFadeMs;
        } else if (elapsed > (this.introSceneMs - this.introFadeMs)) {
            alpha = Math.max(0, (this.introSceneMs - elapsed) / this.introFadeMs);
        }
        c.save();
        c.globalAlpha = alpha;
        var img = this.introImages[this.introIndex];
        if (img && img.complete && img.naturalWidth > 0) {
            c.drawImage(img, 0, 0, w, h);
        } else {
            c.fillStyle = "#040909";
            c.fillRect(0, 0, w, h);
            this.drawNebula();
        }
        c.restore();
        this.drawStoryTextBox(this.introScenes[this.introIndex].text);
    };

    StartScreen.prototype.drawNameInput = function () {
        var c = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        c.save();
        c.fillStyle = "rgba(0,0,0,0.76)";
        c.fillRect(84, h / 2 - 110, w - 168, 220);
        c.strokeStyle = "#00FF00";
        c.lineWidth = 2;
        c.strokeRect(84, h / 2 - 110, w - 168, 220);
        c.fillStyle = "#00FF00";
        c.textAlign = "center";
        c.font = "16px " + this.font;
        c.fillText("IDENTIFY GUARDIAN:", w / 2, h / 2 - 32);
        c.fillText("ENTER YOUR NAME", w / 2, h / 2 - 6);
        c.font = "14px " + this.font;
        var blink = Math.floor(Date.now() / 360) % 2 === 0 ? "_" : " ";
        c.fillText((this.nameInput || "") + blink, w / 2, h / 2 + 48);
        c.font = "10px " + this.font;
        c.fillText("ENTER TO CONFIRM", w / 2, h / 2 + 86);
        c.restore();
    };

    StartScreen.prototype.drawPrepareMessage = function () {
        var c = this.ctx;
        c.save();
        c.fillStyle = "rgba(0,0,0,0.7)";
        c.fillRect(80, this.canvas.height / 2 - 60, this.canvas.width - 160, 120);
        c.strokeStyle = "#00FF00";
        c.lineWidth = 2;
        c.strokeRect(80, this.canvas.height / 2 - 60, this.canvas.width - 160, 120);
        c.fillStyle = "#00FF00";
        c.textAlign = "center";
        c.font = "14px " + this.font;
        c.fillText(this.readyMessage, this.canvas.width / 2, this.canvas.height / 2 + 6);
        c.restore();
    };

    StartScreen.prototype.getMenuLayout = function () {
        var centerX = this.canvas.width * 0.5;
        var startY = this.canvas.height * 0.68;
        var spacing = 62;
        return { x: centerX, y: startY, spacing: spacing, textSize: 24 };
    };

    StartScreen.prototype.drawMenu = function () {
        var c = this.ctx;
        var layout = this.getMenuLayout();
        c.textAlign = "center";
        c.font = layout.textSize + "px " + this.font;
        for (var i = 0; i < this.menu.length; i++) {
            var y = layout.y + i * layout.spacing;
            var isSelected = i === this.selected;
            c.fillStyle = isSelected ? "#00FF00" : "rgba(0,255,0,0.65)";
            var alphaPulse = isSelected ? (0.55 + Math.abs(Math.sin(this.selectorTick)) * 0.45) : 0.8;
            c.globalAlpha = alphaPulse;
            c.fillText(this.menu[i], layout.x, y);
            if (isSelected) {
                c.globalAlpha = 1;
                c.font = "12px " + this.font;
                c.fillText("o8", layout.x - 176, y - 2);
                c.font = layout.textSize + "px " + this.font;
            }
        }
        c.globalAlpha = 1;
        c.font = "12px " + this.font;
        c.fillStyle = "rgba(0,255,0,0.75)";
        c.fillText("UP/DOWN + ENTER", this.canvas.width * 0.5, this.canvas.height - 24);
    };

    StartScreen.prototype.drawCreditsModal = function () {
        if (Date.now() > this.showCreditsUntil) { return; }
        var c = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        c.save();
        c.fillStyle = "rgba(0,0,0,0.62)";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#00FF00";
        c.lineWidth = 2;
        c.fillStyle = "rgba(4,18,8,0.95)";
        c.fillRect(w / 2 - 250, h / 2 - 72, 500, 144);
        c.strokeRect(w / 2 - 250, h / 2 - 72, 500, 144);
        c.textAlign = "center";
        c.fillStyle = "#00FF00";
        c.font = "18px " + this.font;
        c.fillText("CREDITS", w / 2, h / 2 - 16);
        c.font = "14px " + this.font;
        c.fillText("Developed by Gorgon Arcade Labs", w / 2, h / 2 + 22);
        c.restore();
    };

    StartScreen.prototype.render = function () {
        if (!this.active) { return; }
        var c = this.ctx;
        c.fillStyle = "#02060f";
        c.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (var i = 0; i < this.layers.length; i++) {
            var layer = this.layers[i];
            for (var j = 0; j < layer.length; j++) {
                var s = layer[j];
                c.globalAlpha = s.alpha;
                c.fillStyle = "#d8ffe1";
                c.fillRect(s.x, s.y, s.size, s.size);
            }
        }
        c.globalAlpha = 1;
        if (gameState === GAME_STATE.SPLASH) {
            this.drawSplash();
            return;
        }
        if (this.mode === "intro") {
            this.drawIntroScene();
            return;
        }
        this.drawNebula();
        if (this.mode === "nameInput") {
            this.drawTitle();
            this.drawNameInput();
            return;
        }
        if (this.mode === "prepare") {
            this.drawTitle();
            this.drawPrepareMessage();
            return;
        }
        this.drawBackgroundImage();
        this.drawTitle();
        this.drawMenu();
        this.drawCreditsModal();
    };

    StartScreen.prototype.changeSelection = function (dir) {
        this.selected = (this.selected + dir + this.menu.length) % this.menu.length;
        // Play menu move sound
        AudioManager.playMenuMove();
    };

    StartScreen.prototype.activateSelection = function () {
        // Play menu select sound
        AudioManager.playMenuSelect();
        
        if (this.menu[this.selected] === "PLAY") {
            if (isFirstStart) {
                this.playIntro();
            } else {
                this.active = false;
                if (typeof this.onStart === "function") { this.onStart(); }
            }
            return;
        }
        this.showCreditsUntil = Date.now() + 2200;
        gameState = GAME_STATE.CREDITS;
    };

    StartScreen.prototype.handleKeyDown = function (key) {
        if (!this.active) { return false; }
        if (gameState === GAME_STATE.SPLASH) {
            gameState = GAME_STATE.MENU;
            // Play menu music when skipping splash with key press
            AudioManager.playMenuMusic();
            return true;
        }
        if (this.mode === "intro") {
            if (key === 83) {
                this.openNameInput();
                return true;
            }
            return true;
        }
        if (this.mode === "nameInput") {
            if (key === 13 || key === 108) {
                setPlayerName(this.nameInput);
                this.readyMessage = "PREPARE FOR BATTLE, " + playerName.toUpperCase() + "!";
                this.mode = "prepare";
                this.readyUntil = Date.now() + 1100;
                isFirstStart = false;
                return true;
            }
            if (key === 8) {
                if (this.nameInput.length) { this.nameInput = this.nameInput.substring(0, this.nameInput.length - 1); }
                return true;
            }
            if (key >= 32 && key <= 126 && this.nameInput.length < 24) {
                this.nameInput += String.fromCharCode(key);
                return true;
            }
            return true;
        }
        if (this.mode === "prepare") { return true; }
        if (key === 38) { this.changeSelection(-1); return true; }
        if (key === 40) { this.changeSelection(1); return true; }
        if (key === 13 || key === 108) { this.activateSelection(); return true; }
        return false;
    };

    StartScreen.prototype.handleClick = function (x, y) {
        if (!this.active) { return false; }
        if (gameState === GAME_STATE.SPLASH) { return false; }
        var layout = this.getMenuLayout();
        var top = layout.y - 28;
        var widthHalf = 180;
        for (var i = 0; i < this.menu.length; i++) {
            var itemTop = top + i * layout.spacing;
            if (x >= (layout.x - widthHalf) && x <= (layout.x + widthHalf) && y >= itemTop && y <= itemTop + 44) {
                this.selected = i;
                this.activateSelection();
                return true;
            }
        }
        return false;
    };

    // ========================================
    // ARCADE FORMATION SYSTEM
    // ========================================
    
    /**
     * FormationController - Manages enemy group movement and positioning
     * Handles arcade-style formations with oscillating movement
     */
    function FormationController() {
        this.formationType = null;
        this.centerX = canvas.width / 2;
        this.centerY = 100;
        this.baseSpeed = 1.0;
        this.horizontalDirection = 1;
        this.oscillationAmount = 150;
        this.downwardDrift = 0.02;
        this.time = 0;
        this.enemies = [];
        this.isActive = false;
    }

    FormationController.prototype = {
        // Initialize formation with type and enemies
        initFormation: function(type, enemyList, waveLevel) {
            this.formationType = type;
            this.enemies = enemyList;
            this.isActive = true;
            this.time = 0;
            
            // Apply difficulty scaling
            this.baseSpeed = 0.8 + (waveLevel * 0.15);
            this.oscillationAmount = 120 + (waveLevel * 10);
            this.downwardDrift = 0.015 + (waveLevel * 0.005);
            
            // Position enemies in formation
            this.positionEnemiesInFormation();
            
            // Set initial shooting delays based on wave
            this.setInitialShootingDelays(waveLevel);
        },
        
        // Position enemies based on formation type
        positionEnemiesInFormation: function() {
            var count = this.enemies.length;
            
            switch(this.formationType) {
                case "grid":
                    this.positionGridFormation(count);
                    break;
                case "v-shape":
                    this.positionVShapeFormation(count);
                    break;
                case "line":
                    this.positionLineFormation(count);
                    break;
                case "sine-wave":
                    this.positionSineWaveFormation(count);
                    break;
                case "zigzag":
                    this.positionZigZagFormation(count);
                    break;
                default:
                    this.positionGridFormation(count);
            }
        },
        
        // Grid formation (classic arcade style) - Fixed overlapping
        positionGridFormation: function(count) {
            var cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(count))));
            var rows = Math.ceil(count / cols);
            var spacingX = 85; // Increased spacing to prevent overlap
            var spacingY = 70; // Increased spacing to prevent overlap
            
            for (var i = 0; i < count; i++) {
                var col = i % cols;
                var row = Math.floor(i / cols);
                var enemy = this.enemies[i];
                
                // Calculate position relative to center
                enemy.formationOffsetX = (col - (cols - 1) / 2) * spacingX;
                enemy.formationOffsetY = (row - (rows - 1) / 2) * spacingY;
                enemy.formationIndex = i;
                
                // Add small random offset to prevent perfect alignment overlap
                enemy.formationOffsetX += (Math.random() - 0.5) * 5;
                enemy.formationOffsetY += (Math.random() - 0.5) * 3;
            }
        },
        
        // V-Shape formation - Fixed overlapping
        positionVShapeFormation: function(count) {
            var spacing = 55; // Increased spacing
            var depth = 30;   // Increased vertical spacing
            
            for (var i = 0; i < count; i++) {
                var enemy = this.enemies[i];
                var level = Math.floor(i / 2);
                var side = (i % 2 === 0) ? -1 : 1;
                
                // Ensure proper spacing between levels
                enemy.formationOffsetX = side * spacing * (level + 1);
                enemy.formationOffsetY = depth * level;
                enemy.formationIndex = i;
                
                // Small random variation
                enemy.formationOffsetX += (Math.random() - 0.5) * 4;
                enemy.formationOffsetY += (Math.random() - 0.5) * 2;
            }
        },
        
        // Line formation - Fixed overlapping
        positionLineFormation: function(count) {
            var spacing = Math.max(75, 800 / count); // Dynamic spacing based on count
            
            for (var i = 0; i < count; i++) {
                var enemy = this.enemies[i];
                enemy.formationOffsetX = (i - (count - 1) / 2) * spacing;
                enemy.formationOffsetY = 0;
                enemy.formationIndex = i;
                
                // Small random variation
                enemy.formationOffsetY += (Math.random() - 0.5) * 5;
            }
        },
        
        // Sine Wave formation - Fixed overlapping
        positionSineWaveFormation: function(count) {
            var spacing = Math.max(65, 750 / count); // Dynamic spacing
            var amplitude = 45; // Increased amplitude
            
            for (var i = 0; i < count; i++) {
                var enemy = this.enemies[i];
                enemy.formationOffsetX = (i - (count - 1) / 2) * spacing;
                enemy.formationOffsetY = Math.sin((i / count) * Math.PI * 2) * amplitude;
                enemy.formationIndex = i;
                
                // Small random variation
                enemy.formationOffsetX += (Math.random() - 0.5) * 3;
                enemy.formationOffsetY += (Math.random() - 0.5) * 4;
            }
        },
        
        // Zig-Zag formation - Fixed overlapping
        positionZigZagFormation: function(count) {
            var spacing = Math.max(70, 800 / count); // Dynamic spacing
            var amplitude = 55; // Increased amplitude
            
            for (var i = 0; i < count; i++) {
                var enemy = this.enemies[i];
                enemy.formationOffsetX = (i - (count - 1) / 2) * spacing;
                enemy.formationOffsetY = ((i % 2) === 0 ? -amplitude : amplitude);
                enemy.formationIndex = i;
                
                // Small random variation
                enemy.formationOffsetX += (Math.random() - 0.5) * 4;
                enemy.formationOffsetY += (Math.random() - 0.5) * 3;
            }
        },
        
        // Update formation movement - Enhanced with dynamic lateral movement and evasion
        update: function() {
            if (!this.isActive || this.enemies.length === 0) return;
            
            this.time += 0.016; // ~60fps timing
            
            // Enhanced movement patterns
            this.updateFormationCenter();
            this.updateEvasionBehavior();
            
            // Update each enemy position with individual movement
            for (var i = 0; i < this.enemies.length; i++) {
                var enemy = this.enemies[i];
                if (enemy && !enemy.dead) {
                    this.updateEnemyPosition(enemy, i);
                }
            }
        },
        
        // Update formation center with complex movement patterns
        updateFormationCenter: function() {
            // Primary oscillating horizontal movement
            var primaryHorizontal = Math.sin(this.time * this.baseSpeed) * this.oscillationAmount;
            
            // Secondary lateral movement (figure-8 pattern)
            var secondaryHorizontal = Math.sin(this.time * this.baseSpeed * 2) * (this.oscillationAmount * 0.3);
            var verticalMovement = Math.cos(this.time * this.baseSpeed * 1.5) * 20;
            
            // Combine movements for complex pattern
            this.centerX = (canvas.width / 2) + primaryHorizontal + secondaryHorizontal;
            this.centerY += this.downwardDrift + (verticalMovement * 0.1);
            
            // Keep formation within bounds with smooth bouncing
            var margin = 100;
            if (this.centerX < margin) {
                this.centerX = margin;
                this.horizontalDirection = 1;
            } else if (this.centerX > canvas.width - margin) {
                this.centerX = canvas.width - margin;
                this.horizontalDirection = -1;
            }
        },
        
        // Evasion behavior - formation reacts to player position
        updateEvasionBehavior: function() {
            if (!player || player.dead) return;
            
            var playerCenterX = player.posX + player.w / 2;
            var formationCenterX = this.centerX;
            var distance = Math.abs(playerCenterX - formationCenterX);
            
            // If player is close, formation tries to evade
            if (distance < 150) {
                var evasionStrength = (150 - distance) / 150; // 0 to 1
                var evasionDirection = (formationCenterX < playerCenterX) ? -1 : 1;
                
                // Apply evasion movement
                this.centerX += evasionDirection * evasionStrength * 2;
                
                // Add vertical evasion when player is directly below
                if (player.posY > this.centerY + 100) {
                    this.centerY += evasionStrength * 0.5;
                }
            }
        },
        
        // Update individual enemy position with additional movement
        updateEnemyPosition: function(enemy, index) {
            // Base formation position
            var baseX = this.centerX + enemy.formationOffsetX;
            var baseY = this.centerY + enemy.formationOffsetY;
            
            // Individual enemy movement (dodging behavior)
            var individualOffsetX = Math.sin(this.time * 2 + index * 0.5) * 8;
            var individualOffsetY = Math.cos(this.time * 3 + index * 0.3) * 5;
            
            // Random micro-movements for more organic feel
            if (Math.random() < 0.02) { // 2% chance per frame
                enemy.dodgeX = (Math.random() - 0.5) * 15;
                enemy.dodgeY = (Math.random() - 0.5) * 10;
                enemy.dodgeDecay = 0.95;
            }
            
            // Apply dodge with decay
            if (enemy.dodgeX !== undefined) {
                individualOffsetX += enemy.dodgeX;
                individualOffsetY += enemy.dodgeY;
                enemy.dodgeX *= enemy.dodgeDecay;
                enemy.dodgeY *= enemy.dodgeDecay;
                
                // Remove dodge when it's too small
                if (Math.abs(enemy.dodgeX) < 0.5 && Math.abs(enemy.dodgeY) < 0.5) {
                    enemy.dodgeX = undefined;
                    enemy.dodgeY = undefined;
                }
            }
            
            // Final position calculation
            enemy.posX = baseX + individualOffsetX;
            enemy.posY = baseY + individualOffsetY;
            
            // Keep enemies within canvas bounds
            enemy.posX = Math.max(0, Math.min(canvas.width - enemy.w, enemy.posX));
            enemy.posY = Math.max(0, Math.min(canvas.height - enemy.h, enemy.posY));
        },
        
        // Set initial shooting delays to prevent immediate firing
        setInitialShootingDelays: function(waveLevel) {
            for (var i = 0; i < this.enemies.length; i++) {
                var enemy = this.enemies[i];
                // Stagger delays to prevent all enemies firing at once
                enemy.shootActivationTime = Date.now() + (2000 + (i * 200) + (waveLevel * 100));
                enemy.lastShotTime = 0;
                enemy.staggeredShotDelay = (i * 300) + rand(500); // Individual timing
            }
        },
        
        // Check if enemy can shoot (with delay and staggering)
        canEnemyShoot: function(enemy) {
            var now = Date.now();
            
            // Must wait for activation delay
            if (now < enemy.shootActivationTime) {
                return false;
            }
            
            // Stagger shooting between enemies
            var timeSinceLastShot = now - enemy.lastShotTime;
            var baseShotInterval = 1500 - (currentWave * 50); // Faster shooting in later waves
            var minInterval = Math.max(600, baseShotInterval); // Minimum interval cap
            
            return timeSinceLastShot > (minInterval + enemy.staggeredShotDelay);
        },
        
        // Mark enemy as having shot
        markEnemyShot: function(enemy) {
            enemy.lastShotTime = Date.now();
            enemy.staggeredShotDelay = 500 + rand(800); // Reset with new random delay
        },
        
        // Remove dead enemy from formation
        removeEnemy: function(enemy) {
            var index = this.enemies.indexOf(enemy);
            if (index > -1) {
                this.enemies.splice(index, 1);
            }
            
            // Deactivate if no enemies left
            if (this.enemies.length === 0) {
                this.isActive = false;
            }
        }
    };

    function Player() {
        this.image = playerImage;
        this.life = 3;
        this.score = 0;
        this.dead = false;
        this.speed = 5.2;
        this.w = 50;
        this.h = 66;
        this.posX = (canvas.width / 2) - (this.w / 2);
        this.posY = canvas.height - this.h - 10;
    }

    function Enemy(isBoss) {
        this.isBoss = !!isBoss;
        this.imageSet = this.isBoss ? bossImages : enemyImages;
        this.image = this.imageSet[0];
        this.killedImage = this.isBoss ? bossKilledImage : enemyKilledImage;
        this.frame = 0;
        this.animCount = 0;
        this.dead = false;
        this.w = this.isBoss ? 96 : 50;
        this.h = this.isBoss ? 86 : 50;
        this.posX = rand(Math.max(1, canvas.width - this.w));
        this.posY = -rand(250) - 40;
        this.downSpeed = this.isBoss ? (0.45 + level * 0.05) : (0.8 + level * 0.08);
        this.hDir = Math.random() < 0.5 ? -1 : 1;
        this.hSpeed = (this.isBoss ? 0.8 : 1.2) + (level * 0.08) + Math.random();
        this.phase = 40 + rand(120);
        this.phaseTick = 0;
        this.life = this.isBoss ? (8 + level * 2) : (2 + Math.floor(level / 2));
        this.pointsToKill = this.isBoss ? (40 + level * 7) : (6 + level * 2);
        this.spawnTime = Date.now();
        this.shootDelay = 1200 + rand(800);
        
        // Formation properties
        this.formationOffsetX = 0;
        this.formationOffsetY = 0;
        this.formationIndex = 0;
        this.isInFormation = false;
        
        // Shooting properties for formation system
        this.shootActivationTime = 0;
        this.lastShotTime = 0;
        this.staggeredShotDelay = 0;
    }

    Enemy.prototype.update = function () {
        if (this.dead) { return; }
        
        // Boss behavior
        if (this.isBoss && bossActive && this === currentBoss) {
            this.updateBossBehavior();
            return;
        }
        
        // If enemy is in formation, formation controller handles movement
        if (this.isInFormation && activeFormationController && activeFormationController.isActive) {
            // Formation controller handles position updates
            // Just handle animation here
            this.animCount++;
            if (this.animCount > 5) {
                this.animCount = 0;
                this.frame = (this.frame + 1) % 8;
                this.image = this.imageSet[this.frame];
            }
            
            // Simplified shooting for formation enemies
            if (this.isInFormation) {
                // Check if enemy can shoot (with delay)
                var now = Date.now();
                if (!this.lastShotTime || now - this.lastShotTime > 2000) { // 2 second cooldown
                    if (Math.random() < 0.3) { // 30% chance per cooldown
                        enemyShots.push({
                            x: this.posX + this.w / 2 - 4,
                            y: this.posY + this.h,
                            speed: 3.2 + level * 0.1,
                            img: enemyShotImage
                        });
                        this.lastShotTime = now;
                    }
                }
            }
            return;
        }
        
        // Legacy movement for non-formation enemies (bosses, etc.)
        this.posY += this.downSpeed;
        this.phaseTick++;
        if (this.phaseTick > this.phase) {
            this.phaseTick = 0;
            this.phase = 40 + rand(120);
            if (Math.random() < 0.45) { this.hDir *= -1; }
            this.hSpeed = (this.isBoss ? 0.8 : 1.1) + (level * 0.08) + Math.random() * 1.2;
        }
        this.posX += this.hSpeed * this.hDir;
        if (this.posX < 0) { this.posX = 0; this.hDir = 1; }
        if (this.posX > canvas.width - this.w) { this.posX = canvas.width - this.w; this.hDir = -1; }
        
        this.animCount++;
        if (this.animCount > 5) {
            this.animCount = 0;
            this.frame = (this.frame + 1) % 8;
            this.image = this.imageSet[this.frame];
        }
        
        // Legacy shooting for non-formation enemies
        if (!this.spawnTime) {
            this.spawnTime = Date.now();
            this.shootDelay = 700 + rand(800);
        }

        if (Date.now() - this.spawnTime < this.shootDelay) {
            return;
        }

        this.shotCooldown--;

        if (this.shotCooldown <= 0) {
            var baseCooldown = typeof this.customShootInterval === "number"
                ? this.customShootInterval
                : ((this.isBoss ? 40 : 80) + rand(100));

            if (Math.random() < 0.3) { // 30% probability
                enemyShots.push({
                    x: this.posX + this.w / 2 - 4,
                    y: this.posY + this.h,
                    speed: 3.2 + level * 0.1,
                    img: enemyShotImage
                });
            }

            this.shotCooldown = Math.max(25, baseCooldown);
        }
    };

    // Boss behavior update method
    Enemy.prototype.updateBossBehavior = function() {
        if (!this.isBoss || this.dead) return;
        
        // Animation
        this.animCount++;
        if (this.animCount > 5) {
            this.animCount = 0;
            this.frame = (this.frame + 1) % 8;
            this.image = this.imageSet[this.frame];
        }
        
        // Boss movement
        this.updateBossMovement();
        
        // Boss abilities
        this.updateBossAbilities();
        
        // Boss shooting
        this.updateBossShooting();
    };
    
    // Boss movement
    Enemy.prototype.updateBossMovement = function() {
        // Horizontal movement
        this.posX += this.hSpeed * this.bossDirection;
        
        // Bounce at edges
        if (this.posX <= 0) {
            this.posX = 0;
            this.bossDirection = 1;
        } else if (this.posX >= canvas.width - this.w) {
            this.posX = canvas.width - this.w;
            this.bossDirection = -1;
        }
        
        // Vertical movement - keep boss in upper area
        var targetY = 80; // Keep boss in upper area
        var verticalMovement = Math.sin(Date.now() * 0.0005) * 20; // Slower sine wave
        this.posY = targetY + verticalMovement;
        
        // Ensure boss stays on screen vertically
        if (this.posY < 30) this.posY = 30;
        if (this.posY > 200) this.posY = 200;
        
        // Dodge behavior - much lower probability
        this.bossDodgeCooldown--;
        if (this.bossDodgeCooldown <= 0 && Math.random() < 0.005) { // 0.5% chance
            this.bossDodgeCooldown = 120; // 2 second cooldown
            var dodgeDirection = (Math.random() < 0.5) ? -1 : 1;
            this.posX += dodgeDirection * 30; // Smaller dodge
        }
    };
    
    // Boss abilities
    Enemy.prototype.updateBossAbilities = function() {
        this.bossAbilityCooldown--;
        
        // Check if current ability should end
        if (this.currentAbility && this.abilityStartTime > 0) {
            var elapsed = Date.now() - this.abilityStartTime;
            if (elapsed >= this.abilityDuration) {
                this.deactivateCurrentAbility();
            }
        }
        
        // Trigger new abilities based on health percentage
        var healthPercentage = bossHP / bossMaxHP;
        
        if (this.bossAbilityCooldown <= 0 && !this.currentAbility) {
            if (healthPercentage < 0.7 && Math.random() < 0.3) {
                this.activateTripleShot();
            } else if (healthPercentage < 0.4 && Math.random() < 0.25) {
                this.activateShield();
            } else if (healthPercentage < 0.2 && Math.random() < 0.2) {
                this.activateSpeedBoost();
            }
        }
    };
    
    // Deactivate current ability
    Enemy.prototype.deactivateCurrentAbility = function() {
        if (this.currentAbility === "shield") {
            this.shielded = false;
        } else if (this.currentAbility === "speed") {
            this.hSpeed = this.originalSpeed; // Restore original speed
        }
        this.currentAbility = null;
        this.abilityStartTime = 0;
        this.abilityDuration = 0;
    };
    
    // Boss shooting
    Enemy.prototype.updateBossShooting = function() {
        // Don't shoot during intro phase
        if (!this.canAttack) return;
        
        this.shotCooldown--;
        if (this.shotCooldown <= 0) {
            // Triple shot ability
            if (this.currentAbility === "triple") {
                for (var i = -1; i <= 1; i++) {
                    enemyShots.push({
                        x: this.posX + this.w / 2 - 4 + (i * 20),
                        y: this.posY + this.h,
                        speed: 3.5 + level * 0.1,
                        img: enemyShotImage
                    });
                }
            } else {
                // Normal shot
                enemyShots.push({
                    x: this.posX + this.w / 2 - 4,
                    y: this.posY + this.h,
                    speed: 3.2 + level * 0.1,
                    img: enemyShotImage
                });
            }
            
            this.shotCooldown = this.customShootInterval || 60;
        }
    };
    
    // Boss ability: Triple Shot
    Enemy.prototype.activateTripleShot = function() {
        this.currentAbility = "triple";
        this.abilityStartTime = Date.now();
        this.abilityDuration = 3000; // 3 seconds
        this.bossAbilityCooldown = 180; // 3 second cooldown
    };
    
    // Boss ability: Shield
    Enemy.prototype.activateShield = function() {
        this.currentAbility = "shield";
        this.abilityStartTime = Date.now();
        this.abilityDuration = 4000; // 4 seconds
        this.shielded = true;
        this.bossAbilityCooldown = 240; // 4 second cooldown
    };
    
    // Boss ability: Speed Boost
    Enemy.prototype.activateSpeedBoost = function() {
        this.currentAbility = "speed";
        this.abilityStartTime = Date.now();
        this.abilityDuration = 3300; // 3.3 seconds
        this.hSpeed = this.originalSpeed * 1.2; // 1.2x speed boost
        this.bossAbilityCooldown = 200; // 3.3 second cooldown
    };

    function isBossLevel() { return currentWave === totalWaves; }

    function initWaves() {
        waves = [];
        // All formation types including the new ones
        var patterns = ["grid", "v-shape", "line", "sine-wave", "zigzag"];
        
        for (var i = 1; i <= totalWaves; i++) {
            if (i === totalWaves) {
                // Boss wave - doesn't use formation system
                waves.push({
                    enemyCount: 1,
                    enemySpeed: 1.6,
                    shootInterval: 40,
                    formationPattern: "v-shape",
                    boss: true
                });
            } else {
                // Regular waves with formation system
                waves.push({
                    enemyCount: 6 + ((i - 1) * 2), // Progressive enemy count
                    enemySpeed: 0.8 + (i * 0.15), // Progressive speed
                    shootInterval: Math.max(40, 120 - (i * 15)), // Faster shooting in later waves
                    formationPattern: patterns[(i - 1) % patterns.length],
                    boss: false
                });
            }
        }
    }

    function getCurrentWaveConfig() {
        return waves[Math.max(0, currentWave - 1)];
    }

    function beginWave(waveNumber) {
        currentWave = waveNumber;
        level = waveNumber;
        killsInLevel = 0;
        enemies.length = 0;
        enemyShots.length = 0;
        playerShots.length = 0;
        heartDrops.length = 0;
        powerUpDrops.length = 0;
        bgScrollY = 0;
        var cfg = getCurrentWaveConfig();
        killsTargetInLevel = cfg ? cfg.enemyCount : 1;
        waveState = "announce";
        waveAnnouncementStart = Date.now();
        
        // Play wave transition sound
        AudioManager.playWaveTransition();
        
        // Check if this is a boss wave and play boss music
        if (cfg && cfg.boss) {
            AudioManager.playBossWarning();
            setTimeout(function() {
                AudioManager.playBossMusic();
            }, 2000); // Wait for warning sound to finish
        }
    }

    function spawnRemainingEnemies(count) {
        var cfg = getCurrentWaveConfig();
        if (!cfg) return;
    
        for (var i = 0; i < count; i++) {
    
            var e = new Enemy(cfg.boss);
    
            // spawn arriba
            e.posX = rand(Math.max(1, canvas.width - e.w));
            e.posY = -rand(200) - 40;
    
            // velocidad base
            e.downSpeed = cfg.enemySpeed;
            e.hSpeed = 1 + (cfg.enemySpeed * 0.6);
    
            // movimiento lateral tipo formación
            e.baseX = e.posX;
            e.waveOffset = Math.random() * Math.PI * 2;
            e.waveSpeed = 0.02 + (currentWave * 0.002);
    
            // disparo controlado
            e.customShootInterval = cfg.shootInterval;
    
            // delay antes de disparar (clave)
            e.initialDelay = 60 + rand(60);
            e.shotCooldown = e.initialDelay;
    
            enemies.push(e);
        }
    }
    function spawnWaveEnemies() {
        var cfg = getCurrentWaveConfig();
        if (!cfg) { return; }
        enemies.length = 0;
        
        // Clean up any existing formation controller
        if (activeFormationController) {
            activeFormationController.isActive = false;
            activeFormationController = null;
        }
        
        if (cfg.boss) {
            // Initialize boss encounter with dramatic intro
            var boss = new Enemy(true);
            boss.posX = (canvas.width - boss.w) / 2;
            boss.posY = bossIntro.startY; // Start off screen for intro
            boss.downSpeed = 0; // No automatic movement during intro
            boss.hSpeed = 1.0 + (currentWave * 0.05); // Slower horizontal speed
            boss.customShootInterval = cfg.shootInterval;
            boss.shotCooldown = cfg.shootInterval;
            boss.isInFormation = false;
            boss.canAttack = false; // Disable attacks during intro
            
            // Initialize boss system
            currentBoss = boss;
            bossMaxHP = 50 + (currentWave * 20); // Scaling HP
            bossHP = bossMaxHP;
            bossActive = true;
            bossMinionWavesSpawned = 0;
            
            // Boss ability variables
            boss.bossDirection = 1;
            boss.bossDodgeCooldown = 0;
            boss.bossAbilityCooldown = 0;
            boss.currentAbility = null;
            boss.abilityStartTime = 0;
            boss.abilityDuration = 0;
            boss.originalSpeed = boss.hSpeed; // Store original speed
            
            enemies.push(boss);
            
            // Start dramatic boss intro
            startBossIntro();
            return;
        }
        
        // Create enemies for multiple formations if needed
        var count = cfg.enemyCount;
        var enemyList = [];
        var maxEnemiesPerFormation = getMaxEnemiesPerFormation(cfg.formationPattern);
        
        // Calculate how many formations we need
        var numFormations = Math.ceil(count / maxEnemiesPerFormation);
        var enemiesPerFormation = Math.ceil(count / numFormations);
        
        // console.log("Enemy count:", count, "Max per formation:", maxEnemiesPerFormation, "Formations needed:", numFormations);
        
        // Reset secondary controllers array
        secondaryFormationControllers = [];
        
        for (var formationIndex = 0; formationIndex < numFormations; formationIndex++) {
            var formationEnemies = [];
            var enemiesInThisFormation = Math.min(enemiesPerFormation, count - (formationIndex * enemiesPerFormation));
            
            // Create enemies for this formation
            for (var i = 0; i < enemiesInThisFormation; i++) {
                var e = new Enemy(false);
                e.isInFormation = true;
                e.formationGroup = formationIndex; // Track which formation group
                e.downSpeed = 0; // Formation controller handles movement
                e.hSpeed = 0;    // Formation controller handles movement
                formationEnemies.push(e);
                enemyList.push(e);
            }
            
            // Create formation controller for this group
            if (formationIndex === 0) {
                // Primary formation - uses the configured pattern
                activeFormationController = new FormationController();
                activeFormationController.initFormation(cfg.formationPattern, formationEnemies, currentWave);
                activeFormationController.formationGroup = 0;
            } else {
                // Secondary formations - use simpler patterns
                var secondaryController = new FormationController();
                var secondaryPattern = getSecondaryFormationPattern(formationIndex);
                secondaryController.initFormation(secondaryPattern, formationEnemies, currentWave);
                secondaryController.formationGroup = formationIndex;
                secondaryController.centerY = 50 + (formationIndex * 80); // Stagger vertically
                secondaryController.oscillationAmount = 80 - (formationIndex * 20); // Smaller movement for secondary formations
                
                // Store secondary controller
                secondaryFormationControllers.push(secondaryController);
            }
        }
        
        // Add all enemies to game
        enemies = enemyList;
    }

    // Spawn minion wave during boss fight using existing formation system
    function spawnBossMinionWave() {
        if (!bossActive || !currentBoss) return;
        
        bossMinionWavesSpawned++;
        var minionCount = 4 + Math.floor(currentWave / 2); // 4-6 minions
        var patterns = ["grid", "v-shape", "line"];
        var pattern = patterns[bossMinionWavesSpawned % patterns.length];
        
        // Create temporary wave config for minions
        var tempWave = {
            enemyCount: minionCount,
            enemySpeed: 0.8 + (currentWave * 0.1),
            shootInterval: 100 + (currentWave * 10),
            formationPattern: pattern,
            boss: false
        };
        
        // Use existing formation system
        var count = tempWave.enemyCount;
        var enemyList = [];
        var maxEnemiesPerFormation = getMaxEnemiesPerFormation(tempWave.formationPattern);
        var numFormations = Math.ceil(count / maxEnemiesPerFormation);
        var enemiesPerFormation = Math.ceil(count / numFormations);
        
        for (var formationIndex = 0; formationIndex < numFormations; formationIndex++) {
            var formationEnemies = [];
            var enemiesInThisFormation = Math.min(enemiesPerFormation, count - (formationIndex * enemiesPerFormation));
            
            for (var i = 0; i < enemiesInThisFormation; i++) {
                var e = new Enemy(false);
                e.isInFormation = true;
                e.formationGroup = formationIndex;
                e.downSpeed = 0;
                e.hSpeed = 0;
                formationEnemies.push(e);
                enemyList.push(e);
            }
            
            // Create formation controller
            if (formationIndex === 0) {
                var controller = new FormationController();
                controller.initFormation(tempWave.formationPattern, formationEnemies, currentWave);
                controller.formationGroup = formationIndex;
                controller.centerY = 200 + (formationIndex * 60); // Lower than boss
                controller.oscillationAmount = 60; // Smaller movement
                secondaryFormationControllers.push(controller);
            } else {
                var secondaryController = new FormationController();
                var secondaryPattern = getSecondaryFormationPattern(formationIndex);
                secondaryController.initFormation(secondaryPattern, formationEnemies, currentWave);
                secondaryController.formationGroup = formationIndex;
                secondaryController.centerY = 200 + (formationIndex * 60);
                secondaryController.oscillationAmount = 50;
                secondaryFormationControllers.push(secondaryController);
            }
        }
        
        // Add minions to game (keep boss)
        enemies = enemies.concat(enemyList);
    }

    // Get maximum enemies that can fit in a formation type
    function getMaxEnemiesPerFormation(pattern) {
        var maxPerFormation = {
            "grid": 20,      // 4x5 grid max
            "v-shape": 10,    // 5 per side max
            "line": 12,        // Line gets crowded after 12
            "sine-wave": 15,   // Wave pattern max
            "zigzag": 14       // Zigzag max
        };
        return maxPerFormation[pattern] || 12;
    }
    
    // Get pattern for secondary formations
    function getSecondaryFormationPattern(formationIndex) {
        var patterns = ["line", "v-shape", "grid"];
        return patterns[formationIndex % patterns.length];
    }

    function updateWaveSystem() {
        var now = Date.now();
        if (waveState === "announce") {
            if (now - waveAnnouncementStart >= waveAnnouncementDuration) {
                spawnWaveEnemies();
                waveState = "fight";
            }
            return;
        }
        if (waveState === "fight") {
            // Boss fight logic
            if (isBossLevel() && bossActive && currentBoss) {
                // Check if boss is dead
                if (currentBoss.dead || bossHP <= 0) {
                    bossActive = false;
                    currentBoss = null;
                    waveState = "completed";
                    finishGame(true, player.score);
                    return;
                }
                
                // Spawn minion waves when all enemies are dead
                if (enemies.length === 1 && enemies[0] === currentBoss) {
                    // Only boss remains, spawn next wave
                    if (bossMinionWavesSpawned < maxBossMinionWaves) {
                        spawnBossMinionWave();
                    }
                }
            } else {
                // Regular wave logic
                if (enemies.length === 0 && killsInLevel < killsTargetInLevel) {
                    var missing = killsTargetInLevel - killsInLevel;
                    spawnRemainingEnemies(missing);
                    return;
                }
                
                // Advance normally
                if (killsInLevel >= killsTargetInLevel && enemies.length === 0) {
                    if (currentWave >= totalWaves) {
                        waveState = "completed";
                        finishGame(true, player.score);
                    } else {
                        waveState = "transition";
                        waveTransitionUntil = now + 2000;
                    }
                }
            }
        }
        if (waveState === "transition" && now >= waveTransitionUntil) {
            beginWave(currentWave + 1);
        }
    }

    function configLevel() {
        killsInLevel = 0;
        enemies.length = 0;
        enemyShots.length = 0;
        playerShots.length = 0;
        heartDrops.length = 0;
        powerUpDrops.length = 0;
        var cfg = getCurrentWaveConfig();
        killsTargetInLevel = cfg ? cfg.enemyCount : 1;
        levelMaxEnemiesAlive = cfg && !cfg.boss ? Math.min(5, 2 + Math.floor(currentWave / 2)) : 1;
        bgScrollY = 0;
    }

    function startGame() {
        player = new Player();
        enemiesKilled = 0;
        level = 1;
        gameOver = false;
        overlayShown = false;
        fireLock = false;
        nextPlayerShot = 0;
        currentWave = 0;
        
        // Reset formation controllers to prevent freezing
        activeFormationController = null;
        secondaryFormationControllers = [];
        
        initWaves();
        beginWave(1);
        sessionActive = true;
        gameState = GAME_STATE.PLAYING;
        paused = false;
        pauseSelection = 0;
        keyPressed = {};
        hideEndOverlay();
        
        // Play game start sound and switch to gameplay music
        AudioManager.playGameStart();
        AudioManager.playGameplayMusic();
    }

    function restartCurrentLevel() {
        var keepScore = player ? player.score : 0;
        player = new Player();
        player.score = keepScore;
        player.life = 3;
        gameOver = false;
        overlayShown = false;
        paused = false;
        fireLock = false;
        nextPlayerShot = 0;
        keyPressed = {};
        configLevel();
        hideEndOverlay();
    }

    function backToStartMenu() {
        paused = false;
        sessionActive = false;
        keyPressed = {};
        hideEndOverlay();
        if (startScreen) { startScreen.activate(); }
    }

    function showGameOverOverlay(title, detail, points) {
        showEndOverlay(title, detail, points);
        var input = document.getElementById("nombre-overlay");
        var btnPlay = document.getElementById("btn-jugar-overlay");
        var btnRestart = document.getElementById("btn-volver-jugar");
        if (btnPlay) { btnPlay.classList.add("hidden"); }
        if (btnRestart) { btnRestart.classList.remove("hidden"); }
        if (input) {
            input.classList.remove("hidden");
            input.value = getPlayerName();
        }
    }

    function bindUI() {
        var btnPlay = document.getElementById("btn-jugar-overlay");
        var btnRestart = document.getElementById("btn-volver-jugar");
        var btnSaveName = document.getElementById("btn-guardar-nombre");
        var btnChangeName = document.getElementById("btn-cambiar-nombre");
        var inputName = document.getElementById("nombre-jugador");
        var inputOverlay = document.getElementById("nombre-overlay");
        var linkSpec = document.getElementById("btn-especificaciones");
        var linkTut = document.getElementById("link-tutorial");
        var closeSpec = document.getElementById("modal-esp-cerrar");
        var closeTut = document.getElementById("modal-tutorial-cerrar");

        if (btnPlay) {
            btnPlay.addEventListener("click", function () {
                setPlayerName(inputOverlay ? inputOverlay.value : "jugador");
                startGame();
            });
        }
        if (btnRestart) {
            btnRestart.addEventListener("click", function () {
                hideEndOverlay();
                // Restart immediately at level 1, skipping start/menu flow.
                startGame();
            });
        }
        if (btnSaveName && inputName) { btnSaveName.addEventListener("click", function () { setPlayerName(inputName.value); }); }
        if (btnChangeName && inputName) { btnChangeName.addEventListener("click", function () { inputName.focus(); inputName.select(); }); }
        if (linkSpec) { linkSpec.addEventListener("click", function () { showModal("modal-especificaciones"); }); }
        if (linkTut) { linkTut.addEventListener("click", function (e) { e.preventDefault(); showModal("modal-tutorial"); }); }
        if (closeSpec) { closeSpec.addEventListener("click", function () { hideModal("modal-especificaciones"); }); }
        if (closeTut) { closeTut.addEventListener("click", function () { hideModal("modal-tutorial"); }); }

        syncNameUI();
    }

    function showModal(id) {
        var m = document.getElementById(id);
        if (m) { m.classList.remove("hidden"); }
    }
    function hideModal(id) {
        var m = document.getElementById(id);
        if (m) { m.classList.add("hidden"); }
    }

    function drawBackground() {
        var bossAlive = false;
        var i;
        for (i = 0; i < enemies.length; i++) {
            if (enemies[i].isBoss && !enemies[i].dead) { bossAlive = true; break; }
        }
        var bg = bossAlive || isBossLevel() ? bgBoss : bgMain;
        var assetW = (bg && bg.naturalWidth) ? bg.naturalWidth : BG_ASSET_W;
        var assetH = (bg && bg.naturalHeight) ? bg.naturalHeight : BG_ASSET_H;
        var scale = canvas.width / assetW;
        var drawH = assetH * scale;
        if (drawH <= 0) { drawH = canvas.height; }
        if (bgScrollY >= drawH) { bgScrollY = bgScrollY % drawH; }
        var yOffset = bgScrollY;
        if (bg && bg.complete && bg.naturalWidth > 0) {
            bufferctx.drawImage(bg, 0, yOffset, canvas.width, drawH);
            bufferctx.drawImage(bg, 0, yOffset - drawH, canvas.width, drawH);
            if (drawH < canvas.height) {
                bufferctx.drawImage(bg, 0, yOffset + drawH, canvas.width, drawH);
            }
        } else {
            bufferctx.fillStyle = bossAlive || isBossLevel() ? "#140b12" : "#0b1d34";
            bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // Increase map motion speed as kills go up for more tension.
        var dynamicScrollSpeed = 0.5 + Math.min(2.2, enemiesKilled * 0.03);
        bgScrollY += dynamicScrollSpeed;
        if (bgScrollY >= drawH) { bgScrollY = 0; }

        for (i = 0; i < starsParallax.length; i++) {
            var s = starsParallax[i];
            s.y += 1.5;
            if (s.y > canvas.height + 2) {
                s.y = -2;
                s.x = Math.random() * canvas.width;
            }
            bufferctx.globalAlpha = s.alpha;
            bufferctx.fillStyle = "#ffffff";
            bufferctx.fillRect(s.x, s.y, s.size, s.size);
        }
        bufferctx.globalAlpha = 1;
    }

    function drawBossHealthBar() {
        if (!bossActive || !currentBoss || bossMaxHP <= 0) return;
        
        var barWidth = 300; // Smaller width
        var barHeight = 12; // Smaller height
        var barX = (canvas.width - barWidth) / 2;
        var barY = 25;
        var healthPercentage = Math.max(0, Math.min(1, bossHP / bossMaxHP));
        var healthWidth = barWidth * healthPercentage;
        
        // Background - more opaque
        bufferctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        bufferctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        // Border - thinner
        bufferctx.strokeStyle = "#FF0000";
        bufferctx.lineWidth = 1;
        bufferctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Health fill
        var healthColor = healthPercentage > 0.5 ? "#00FF00" : 
                         healthPercentage > 0.25 ? "#FFFF00" : "#FF0000";
        bufferctx.fillStyle = healthColor;
        bufferctx.fillRect(barX + 1, barY + 1, healthWidth - 2, barHeight - 2);
        
        // Boss name - smaller font
        bufferctx.fillStyle = "#FFFFFF";
        bufferctx.font = "10px 'Press Start 2P'";
        bufferctx.textAlign = "center";
        bufferctx.fillText("BOSS", canvas.width / 2, barY - 5);
        
        // Health text - smaller font
        bufferctx.font = "8px 'Press Start 2P'";
        bufferctx.fillText(bossHP + " / " + bossMaxHP, canvas.width / 2, barY + barHeight + 12);
    }

    // Screen shake system functions
    function startScreenShake(intensity, duration) {
        screenShake.intensity = intensity;
        screenShake.duration = duration;
        screenShake.startTime = Date.now();
        screenShake.offsetX = 0;
        screenShake.offsetY = 0;
    }
    
    function updateScreenShake() {
        if (screenShake.duration <= 0) return;
        
        var now = Date.now();
        var elapsed = now - screenShake.startTime;
        var progress = Math.min(1, elapsed / screenShake.duration);
        
        // Smooth decay using ease-out
        var decay = 1 - Math.pow(progress, 2);
        var currentIntensity = screenShake.intensity * decay;
        
        // Generate random offsets
        screenShake.offsetX = (Math.random() - 0.5) * currentIntensity * 2;
        screenShake.offsetY = (Math.random() - 0.5) * currentIntensity * 2;
        
        // Stop shake when duration is over
        if (progress >= 1) {
            screenShake.intensity = 0;
            screenShake.duration = 0;
            screenShake.offsetX = 0;
            screenShake.offsetY = 0;
        }
    }
    
    function applyScreenShake(x, y) {
        return {
            x: x + screenShake.offsetX,
            y: y + screenShake.offsetY
        };
    }
    
    // Boss intro system functions
    function startBossIntro() {
        bossIntro.active = true;
        bossIntro.startTime = Date.now();
        bossIntro.duration = 3000; // 3 second intro
    }
    
    function updateBossIntro() {
        if (!bossIntro.active) return;
        
        var now = Date.now();
        var elapsed = now - bossIntro.startTime;
        var progress = Math.min(1, elapsed / bossIntro.duration);
        
        // Smooth ease-out animation
        var easeProgress = 1 - Math.pow(1 - progress, 3);
        
        if (currentBoss) {
            // Smooth descent from top to target position
            currentBoss.posY = bossIntro.startY + (bossIntro.targetY - bossIntro.startY) * easeProgress;
            
            // Boss starts attacking after intro completes
            if (progress >= 1) {
                bossIntro.active = false;
                currentBoss.canAttack = true; // Enable boss attacks
            }
        }
    }
    
    function drawBossIntroWarning() {
        if (!bossIntro.active || !currentBoss) return;
        
        var now = Date.now();
        var elapsed = now - bossIntro.startTime;
        var progress = Math.min(1, elapsed / bossIntro.duration);
        
        // Flashing warning text
        var alpha = 0.5 + Math.sin(elapsed * 0.01) * 0.5;
        
        bufferctx.save();
        bufferctx.globalAlpha = alpha;
        bufferctx.fillStyle = "#FF0000";
        bufferctx.font = "bold 24px 'Press Start 2P'";
        bufferctx.textAlign = "center";
        bufferctx.fillText(bossIntro.warningText, canvas.width / 2, canvas.height / 2);
        bufferctx.restore();
    }

    // Combo system functions
    function updateCombo() {
        var now = Date.now();
        
        // Check if combo should reset
        if (now - combo.timer > combo.resetTime) {
            combo.count = 0;
            combo.multiplier = combo.baseMultiplier;
        }
    }
    
    function increaseCombo() {
        combo.count++;
        combo.timer = Date.now();
        
        // Calculate multiplier (capped at maxMultiplier)
        combo.multiplier = Math.min(combo.maxMultiplier, combo.baseMultiplier + combo.count);
    }
    
    function getComboMultiplier() {
        updateCombo();
        return combo.multiplier;
    }
    
    function drawComboUI() {
        if (combo.count <= 0) return;
        
        // Draw combo indicator
        var text = "x" + combo.multiplier + " COMBO";
        var alpha = 1.0;
        
        bufferctx.save();
        bufferctx.globalAlpha = alpha;
        bufferctx.fillStyle = "#FFD700"; // Gold color
        bufferctx.font = "bold 16px 'Press Start 2P'";
        bufferctx.textAlign = "right";
        bufferctx.fillText(text, canvas.width - 20, 40);
        
        // Draw combo count
        bufferctx.font = "12px 'Press Start 2P'";
        bufferctx.fillText("Kills: " + combo.count, canvas.width - 20, 60);
        bufferctx.restore();
    }
    
    // Floating text system functions
    function spawnFloatingText(x, y, text, color) {
        floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color || "#FFFFFF",
            speed: 1.5, // pixels per frame upward
            lifetime: 1200, // milliseconds
            startTime: Date.now(),
            alpha: 1.0
        });
    }
    
    function updateFloatingTexts() {
        var now = Date.now();
        
        for (var i = floatingTexts.length - 1; i >= 0; i--) {
            var text = floatingTexts[i];
            var elapsed = now - text.startTime;
            
            // Move upward
            text.y -= text.speed;
            
            // Calculate alpha (fade out over lifetime)
            var fadeStart = text.lifetime * 0.7; // Start fading at 70% of lifetime
            if (elapsed > fadeStart) {
                text.alpha = Math.max(0, 1 - (elapsed - fadeStart) / (text.lifetime - fadeStart));
            }
            
            // Remove if lifetime exceeded
            if (elapsed > text.lifetime) {
                floatingTexts.splice(i, 1);
            }
        }
    }
    
    function drawFloatingTexts() {
        for (var i = 0; i < floatingTexts.length; i++) {
            var text = floatingTexts[i];
            
            bufferctx.save();
            bufferctx.globalAlpha = text.alpha;
            bufferctx.fillStyle = text.color;
            bufferctx.font = "bold 14px 'Press Start 2P'";
            bufferctx.textAlign = "center";
            bufferctx.fillText(text.text, text.x, text.y);
            bufferctx.restore();
        }
    }

    function drawBossAbilityIndicators() {
        if (!bossActive || !currentBoss || !currentBoss.currentAbility) return;
        
        var bossX = currentBoss.posX + currentBoss.w / 2;
        var bossY = currentBoss.posY - 20;
        
        bufferctx.font = "8px 'Press Start 2P'";
        bufferctx.textAlign = "center";
        
        var ability = currentBoss.currentAbility;
        var elapsed = Date.now() - currentBoss.abilityStartTime;
        var remaining = Math.max(0, currentBoss.abilityDuration - elapsed);
        var percentage = remaining / currentBoss.abilityDuration;
        
        var color, text;
        switch(ability) {
            case "triple":
                color = "#FF6600";
                text = "TRIPLE";
                break;
            case "shield":
                color = "#00CCFF";
                text = "SHIELD";
                break;
            case "speed":
                color = "#FFFF00";
                text = "SPEED";
                break;
            default:
                return;
        }
        
        // Draw ability background
        bufferctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        var textWidth = bufferctx.measureText(text).width;
        bufferctx.fillRect(bossX - textWidth/2 - 4, bossY - 12, textWidth + 8, 16);
        
        // Draw ability text
        bufferctx.fillStyle = color;
        bufferctx.fillText(text, bossX, bossY);
        
        // Draw progress bar
        var barWidth = 40;
        var barHeight = 3;
        var barX = bossX - barWidth/2;
        var barY = bossY + 4;
        
        bufferctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        bufferctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        bufferctx.fillStyle = color;
        bufferctx.fillRect(barX, barY, barWidth * percentage, barHeight);
    }

    function drawHud() {
        var x = 70;
        var y = 16;
        var rowGap = 24;
        var now = Date.now();
        var progress = killsTargetInLevel > 0 ? (killsInLevel / killsTargetInLevel) : 0;
        if (progress < 0) { progress = 0; }
        if (progress > 1) { progress = 1; }
        if (player.score > lastScoreValue) {
            scoreJitterUntil = now + 100;
            lastScoreValue = player.score;
        }
        if (player.life > previousLifeValue) {
            lifeGainAnimUntil = 0;
            lifeGainIndex = -1;
        }
        previousLifeValue = player.life;

        bufferctx.save();
        bufferctx.font = "10px 'Press Start 2P', monospace";
        bufferctx.fillStyle = "#00FF00";
        bufferctx.shadowBlur = 8;
        bufferctx.shadowColor = "#00FF00";
        bufferctx.textBaseline = "top";

        // LIVES
        bufferctx.fillText("LIVES:", x, y);
        var nodeX = x + 52;
        for (var i = 0; i < 3; i++) {
            var alive = i < player.life;
            var blinkOff = (!alive && Math.floor(now / 200) % 2 === 0);
            if (alive) {
                bufferctx.fillStyle = "#00FF00";
                bufferctx.fillRect(nodeX + i * 13, y + 1, 7, 14);
            } else if (!blinkOff) {
                bufferctx.strokeStyle = "#ff2a2a";
                bufferctx.lineWidth = 1;
                bufferctx.strokeRect(nodeX + i * 13, y + 1, 7, 14);
            }
        }

        // SCORE
        var jitter = now < scoreJitterUntil ? (Math.random() < 0.5 ? -1 : 1) : 0;
        var scoreTxt = String(player.score);
        while (scoreTxt.length < 5) { scoreTxt = "0" + scoreTxt; }
        bufferctx.fillStyle = "#00FF00";
        bufferctx.fillText("SCORE:" + scoreTxt, x + jitter, y + rowGap);

        // KILLS / LEVEL
        bufferctx.fillText("KILLS:" + enemiesKilled, x, y + rowGap * 2);
        var lvl = level < 10 ? ("0" + level) : String(level);
        bufferctx.fillText("LEVEL:" + lvl, x, y + rowGap * 3);
        bufferctx.fillText("WAVE: " + currentWave + "/" + totalWaves, x, y + rowGap * 4);

        // PROGRESS segmented bar
        var barX = x;
        var barY = y + rowGap * 5 + 1;
        var barW = 124;
        var barH = 12;
        var segments = 10;
        var gap = 2;
        var segW = Math.floor((barW - ((segments + 1) * gap)) / segments);
        var filled = Math.floor(progress * segments + 0.0001);
        var fullBlink = progress >= 1 && Math.floor(now / 160) % 2 === 0;
        bufferctx.fillText("PROGRESS", x, barY - 12);
        bufferctx.strokeStyle = fullBlink ? "#ffffff" : "#00FF00";
        bufferctx.lineWidth = progress >= 1 ? 2 : 1;
        bufferctx.strokeRect(barX, barY, barW, barH);
        for (var s = 0; s < segments; s++) {
            var sx = barX + gap + s * (segW + gap);
            var sy = barY + 2;
            var sh = barH - 4;
            if (s < filled) {
                bufferctx.fillStyle = fullBlink ? "#ffffff" : "#00FF00";
                bufferctx.fillRect(sx, sy, segW, sh);
            }
        }

        if (isBossLevel() && Math.floor(now / 350) % 2 === 0) {
            bufferctx.shadowBlur = 0;
            bufferctx.fillStyle = "#ff3b3b";
            bufferctx.fillText("WARNING: BOSS", 210, 16);
        }
        if (now < levelStatusUntil) {
            bufferctx.shadowBlur = 0;
            bufferctx.fillStyle = "#d8ffd8";
            bufferctx.font = "14px 'Press Start 2P', monospace";
            bufferctx.fillText("LEVEL CLEARED!", 210, 36);
        }

        // Active power-ups HUD bottom-left.
        var px = 60;
        var py = canvas.height - 78;
        bufferctx.shadowBlur = 0;
        bufferctx.font = "9px 'Press Start 2P', monospace";
        bufferctx.fillStyle = "#9aff9a";
        function drawPowerLine(label, key, color) {
            if (!isPowerUpActive(key)) { return; }
            var ms = activePowerUps[key] - now;
            var secs = Math.max(0, Math.ceil(ms / 1000));
            bufferctx.fillStyle = color;
            bufferctx.fillText(label + ": " + secs + "s", px, py);
            py += 18;
        }
        drawPowerLine("TRIPLE", "triple", "#70e7ff");
        drawPowerLine("SHIELD", "shield", "#ffe98c");
        drawPowerLine("SPEED", "speed", "#7bff9f");
        bufferctx.restore();
    }

    function drawWaveAnnouncement() {
        if (waveState !== "announce") { return; }
        var elapsed = Date.now() - waveAnnouncementStart;
        var alpha = 1;
        var half = waveAnnouncementDuration / 2;
        if (elapsed < half) {
            alpha = elapsed / half;
        } else {
            alpha = Math.max(0, (waveAnnouncementDuration - elapsed) / half);
        }
        bufferctx.save();
        bufferctx.globalAlpha = alpha;
        bufferctx.textAlign = "center";
        bufferctx.fillStyle = "#00ff88";
        bufferctx.shadowBlur = 16;
        bufferctx.shadowColor = "#00ff88";
        bufferctx.font = "30px 'Press Start 2P', monospace";
        bufferctx.fillText("WAVE " + currentWave, canvas.width / 2, canvas.height / 2);
        bufferctx.restore();
    }

    function drawPauseOverlay() {
        var c = bufferctx;
        var w = canvas.width;
        var h = canvas.height;
        var panelW = 520;
        var panelH = 280;
        var x = (w - panelW) / 2;
        var y = (h - panelH) / 2;
        var pulse = 0.55 + Math.abs(Math.sin(Date.now() * 0.006)) * 0.45;

        c.save();
        c.fillStyle = "rgba(0,0,0,0.62)";
        c.fillRect(0, 0, w, h);

        c.fillStyle = "rgba(5,15,25,0.93)";
        c.fillRect(x, y, panelW, panelH);
        c.strokeStyle = "#00ff00";
        c.lineWidth = 3;
        c.shadowBlur = 16;
        c.shadowColor = "#00ff00";
        c.strokeRect(x, y, panelW, panelH);

        c.textAlign = "center";
        c.fillStyle = "#00ff00";
        c.font = "26px 'Press Start 2P', monospace";
        c.globalAlpha = pulse;
        c.fillText("PAUSA", w / 2, y + 56);
        c.globalAlpha = 1;

        for (var i = 0; i < pauseOptions.length; i++) {
            var oy = y + 130 + i * 58;
            var selected = i === pauseSelection;
            c.font = "14px 'Press Start 2P', monospace";
            c.fillStyle = selected ? "#ffffff" : "#00ff88";
            if (selected) {
                c.strokeStyle = "#00ff00";
                c.lineWidth = 2;
                c.strokeRect(x + 62, oy - 28, panelW - 124, 42);
                c.fillText("> " + pauseOptions[i] + " <", w / 2, oy);
            } else {
                c.fillText(pauseOptions[i], w / 2, oy);
            }
        }

        c.font = "10px 'Press Start 2P', monospace";
        c.fillStyle = "#9aff9a";
        c.fillText("P: CONTINUAR | ENTER: ACEPTAR", w / 2, y + panelH - 28);
        c.restore();
    }

    function initParallaxStars() {
        starsParallax.length = 0;
        for (var i = 0; i < 48; i++) {
            starsParallax.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: (Math.random() < 0.7) ? 1 : 2,
                alpha: 0.35 + Math.random() * 0.55
            });
        }
    }

    function firePlayerShot(vx) {
        var pw = spriteW(player.image, player.w);
        playerShots.push({ x: player.posX + pw / 2 - 4, y: player.posY, speed: 7.5, vx: vx || 0, img: playerShotImage });
        
        // Play player shoot sound
        AudioManager.playPlayerShoot();
    }

    function playerAction() {
        var pw = spriteW(player.image, player.w);
        var moveSpeed = isPowerUpActive("speed") ? (player.speed * 2) : player.speed;
        if (keyPressed.left && player.posX > 5) { player.posX -= moveSpeed; }
        if (keyPressed.right && player.posX < (canvas.width - pw - 5)) { player.posX += moveSpeed; }
        if (keyPressed.fire && !fireLock) {
            var now = Date.now();
            if (now >= nextPlayerShot) {
                nextPlayerShot = now + playerShotDelay;
                if (isPowerUpActive("triple")) {
                    firePlayerShot(-1.8);
                    firePlayerShot(0);
                    firePlayerShot(1.8);
                } else {
                    firePlayerShot(0);
                }
                fireLock = true;
            }
        }
    }

    function spawnEnemiesIfNeeded() {
        // Wave system now controls all enemy spawning.
    }

    function maybeDropHeart(x, y) {
        if (Math.random() < 0.18) {
            var targetX = Math.max(8, Math.min(canvas.width - 30, x));
            heartDrops.push({ x: targetX, y: -24, speed: 2.1 + Math.random() * 1.1, w: 22, h: 22 });
        }
    }

    function maybeDropPowerUp(x, y) {
        if (Math.random() > 0.20) { return; }
        var types = ["triple", "shield", "speed"];
        var type = types[rand(types.length)];
        powerUpDrops.push({
            type: type,
            x: Math.max(12, Math.min(canvas.width - 32, x)),
            y: y,
            w: 20,
            h: 20,
            speed: 2
        });
    }

    function activatePowerUp(type) {
        activePowerUps[type] = Date.now() + powerUpDurations[type];
    }

    function isPowerUpActive(type) {
        return activePowerUps[type] > Date.now();
    }

    function drawPowerUpDrop(p) {
        var c = bufferctx;
        if (p.type === "triple") {
            c.fillStyle = "#00d4ff";
            c.beginPath();
            c.moveTo(p.x + p.w / 2, p.y);
            c.lineTo(p.x + p.w, p.y + p.h);
            c.lineTo(p.x, p.y + p.h);
            c.closePath();
            c.fill();
            c.fillStyle = "#a7f3ff";
            c.font = "8px 'Press Start 2P', monospace";
            c.textAlign = "center";
            c.fillText("3X", p.x + p.w / 2, p.y + p.h + 10);
            return;
        }
        if (p.type === "shield") {
            c.strokeStyle = "#ffe66b";
            c.lineWidth = 2;
            c.beginPath();
            c.arc(p.x + p.w / 2, p.y + p.h / 2, 8, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = "#fff2ad";
            c.font = "8px 'Press Start 2P', monospace";
            c.textAlign = "center";
            c.fillText("SH", p.x + p.w / 2, p.y + p.h + 10);
            return;
        }
        c.fillStyle = "#00ff66";
        c.beginPath();
        c.moveTo(p.x + 2, p.y + p.h / 2);
        c.lineTo(p.x + 11, p.y + p.h / 2);
        c.lineTo(p.x + 11, p.y + 3);
        c.lineTo(p.x + p.w - 1, p.y + p.h / 2);
        c.lineTo(p.x + 11, p.y + p.h - 3);
        c.lineTo(p.x + 11, p.y + p.h / 2);
        c.lineTo(p.x + 2, p.y + p.h / 2);
        c.closePath();
        c.fill();
        c.fillStyle = "#9affb7";
        c.font = "8px 'Press Start 2P', monospace";
        c.textAlign = "center";
        c.fillText("SPD", p.x + p.w / 2, p.y + p.h + 10);
    }

    function updatePowerUps() {
        var pw = spriteW(player.image, player.w), ph = spriteH(player.image, player.h);
        for (var i = powerUpDrops.length - 1; i >= 0; i--) {
            var p = powerUpDrops[i];
            p.y += p.speed;
            drawPowerUpDrop(p);
            var hit = p.x < player.posX + pw && p.x + p.w > player.posX && p.y < player.posY + ph && p.y + p.h > player.posY;
            if (hit) {
                activatePowerUp(p.type);
                // Play power-up pickup sound
                AudioManager.playPowerUpPick();
                powerUpDrops.splice(i, 1);
            } else if (p.y > canvas.height + 24) {
                powerUpDrops.splice(i, 1);
            }
        }
    }

    function updateHearts() {
        var pw = spriteW(player.image, player.w), ph = spriteH(player.image, player.h);
        for (var i = heartDrops.length - 1; i >= 0; i--) {
            var h = heartDrops[i];
            h.y += h.speed;
            bufferctx.drawImage(heartImage, h.x, h.y, h.w, h.h);
            var hit = h.x < player.posX + pw && h.x + h.w > player.posX && h.y < player.posY + ph && h.y + h.h > player.posY;
            if (hit) {
                if (player.life < MAX_LIVES) { 
                    player.life += 1;
                    // Play heal sound
                    AudioManager.playHeal();
                }
                heartDrops.splice(i, 1);
            } else if (h.y > canvas.height + 30) {
                heartDrops.splice(i, 1);
            }
        }
    }

    function updateEnemies() {
        var pw = spriteW(player.image, player.w), ph = spriteH(player.image, player.h);
        for (var i = enemies.length - 1; i >= 0; i--) {
            var e = enemies[i];
            e.update();
            bufferctx.drawImage(e.image, e.posX, e.posY);
            if (e.posY > canvas.height + 30) {
                enemies.splice(i, 1);
                continue;
            }
            var bodyHit = e.posX < player.posX + pw && e.posX + e.w > player.posX && e.posY < player.posY + ph && e.posY + e.h > player.posY;
            if (bodyHit) { hurtPlayer(); return; }
        }
    }

    function updateShots() {
        var pw = spriteW(player.image, player.w), ph = spriteH(player.image, player.h);
        for (var i = playerShots.length - 1; i >= 0; i--) {
            var s = playerShots[i];
            s.y -= s.speed;
            s.x += s.vx || 0;
            if (s.y < -10 || s.x < -12 || s.x > canvas.width + 12) { playerShots.splice(i, 1); continue; }
            var hitEnemy = false;
            for (var j = enemies.length - 1; j >= 0; j--) {
                var e = enemies[j];
                if (s.x >= e.posX && s.x <= e.posX + e.w && s.y >= e.posY && s.y <= e.posY + e.h) {
                    e.life -= 1;
                    hitEnemy = true;
                    if (e.isBoss && bossActive && e === currentBoss) {
                        // Boss damage system - reduce HP instead of life
                        if (!e.shielded) {
                            bossHP -= 1;
                            console.log("Boss hit! HP:", bossHP, "/", bossMaxHP);
                            
                            // Strong screen shake for boss hit
                            startScreenShake(12, 400); // Strong shake for 400ms
                        } else {
                            console.log("Boss blocked by shield!");
                            
                            // Light screen shake for shield block
                            startScreenShake(4, 200); // Light shake for 200ms
                        }
                    } else if (e.life <= 0) {
                        // Regular enemy death
                        e.dead = true;
                        
                        // Play enemy hit sound
                        AudioManager.playHitEnemy();
                        
                        // Update combo and calculate score with multiplier
                        increaseCombo();
                        var multiplier = getComboMultiplier();
                        var scoreGained = e.pointsToKill * multiplier;
                        player.score += scoreGained;
                        
                        enemiesKilled++;
                        killsInLevel++;
                        deathEffects.push({ x: e.posX, y: e.posY, w: e.w, h: e.h, ttl: 18, img: e.killedImage });
                        maybeDropHeart(e.posX + e.w / 2 - 10, e.posY + e.h / 2 - 10);
                        maybeDropPowerUp(e.posX + e.w / 2 - 10, e.posY + e.h / 2 - 10);
                        
                        // Spawn floating text for score
                        var scoreText = "+" + scoreGained;
                        if (multiplier > 1) {
                            scoreText += " (x" + multiplier + ")";
                            spawnFloatingText(e.posX + e.w / 2, e.posY, scoreText, "#FFD700"); // Gold for combo
                        } else {
                            spawnFloatingText(e.posX + e.w / 2, e.posY, scoreText, "#FFFFFF"); // White for normal
                        }
                        
                        // Light screen shake for enemy death
                        startScreenShake(3, 150); // Light shake for 150ms
                        
                        // Remove from formation controller if in formation
                        if (e.isInFormation) {
                            // Check primary formation controller
                            if (activeFormationController && e.formationGroup === 0) {
                                activeFormationController.removeEnemy(e);
                            }
                            // Check secondary formation controllers
                            else if (secondaryFormationControllers && e.formationGroup > 0) {
                                var controller = secondaryFormationControllers[e.formationGroup - 1];
                                if (controller) {
                                    controller.removeEnemy(e);
                                }
                            }
                        }
                        
                        enemies.splice(j, 1);
                    }
                    break;
                }
            }
            if (hitEnemy) {
                playerShots.splice(i, 1);
            } else {
                bufferctx.drawImage(s.img, s.x, s.y);
            }
        }

        for (var k = enemyShots.length - 1; k >= 0; k--) {
            var es = enemyShots[k];
            es.y += es.speed;
            if (es.y > canvas.height + 10) { enemyShots.splice(k, 1); continue; }
            bufferctx.drawImage(es.img, es.x, es.y);
            if (es.x >= player.posX && es.x <= player.posX + pw && es.y >= player.posY && es.y <= player.posY + ph) {
                enemyShots.splice(k, 1);
                hurtPlayer();
                return;
            }
        }
    }

    function hurtPlayer() {
        if (player.dead || gameOver) { return; }
        if (isPowerUpActive("shield")) { 
            // Play shield activation sound
            AudioManager.playShieldOn();
            return; 
        }
        
        // Screen shake when player takes damage
        startScreenShake(8, 300); // Medium shake for 300ms
        
        // Play player hit sound
        AudioManager.playHitPlayer();
        
        // Reset combo when player takes damage
        combo.count = 0;
        combo.multiplier = combo.baseMultiplier;
        combo.timer = 0;
        
        player.dead = true;
        player.image = playerKilledImage;
        enemyShots.length = 0;
        playerShots.length = 0;
        var scoreKeep = player.score;
        var livesLeft = player.life - 1;
        if (livesLeft <= 0) {
            player.life = 0;
            finishGame(false, scoreKeep);
            return;
        }
        setTimeout(function () {
            player = new Player();
            player.life = livesLeft;
            player.score = scoreKeep;
            player.dead = false;
        }, 420);
    }

    function advanceLevelIfNeeded() {
        updateWaveSystem();
    }

    function drawDeathEffects() {
        for (var i = deathEffects.length - 1; i >= 0; i--) {
            var fx = deathEffects[i];
            bufferctx.drawImage(fx.img, fx.x, fx.y, fx.w, fx.h);
            fx.ttl--;
            if (fx.ttl <= 0) {
                deathEffects.splice(i, 1);
            }
        }
    }

    function loop() {
        if (!sessionActive) {
            if (startScreen) {
                startScreen.update();
                startScreen.render();
            }
            draw();
            return;
        }
        drawBackground();
        if (paused) {
            drawHud();
            drawPauseOverlay();
            draw();
            return;
        }
        if (gameOver) { draw(); return; }
        spawnEnemiesIfNeeded();
        playerAction();
        if (isPowerUpActive("speed")) {
            bufferctx.fillStyle = "rgba(80,255,140,0.25)";
            bufferctx.fillRect(player.posX + 12, player.posY + player.h - 4, 24, 12);
        }
        bufferctx.drawImage(player.image, player.posX, player.posY);
        if (isPowerUpActive("shield")) {
            bufferctx.strokeStyle = "rgba(255,233,140,0.95)";
            bufferctx.lineWidth = 2;
            bufferctx.beginPath();
            bufferctx.arc(player.posX + player.w / 2, player.posY + player.h / 2, Math.max(player.w, player.h) * 0.6 + Math.sin(Date.now() * 0.01) * 2, 0, Math.PI * 2);
            bufferctx.stroke();
        }
        
        // Update screen shake system
        updateScreenShake();
        
        // Update boss intro system
        updateBossIntro();
        
        // Update formation controllers if active
        if (activeFormationController && activeFormationController.isActive) {
            activeFormationController.update();
        }
        
        // Update secondary formation controllers
        if (secondaryFormationControllers && secondaryFormationControllers.length > 0) {
            for (var i = 0; i < secondaryFormationControllers.length; i++) {
                var controller = secondaryFormationControllers[i];
                if (controller && controller.isActive) {
                    controller.update();
                }
            }
        }
        
        updateEnemies();
        updateShots();
        drawDeathEffects();
        updateHearts();
        updatePowerUps();
        
        // Update combo and floating text systems
        updateCombo();
        updateFloatingTexts();
        
        // Draw boss intro warning if active
        drawBossIntroWarning();
        
        // Draw boss health bar if active
        drawBossHealthBar();
        
        // Draw combo and floating text systems
        drawComboUI();
        drawFloatingTexts();
        
        // Draw boss ability indicators
        drawBossAbilityIndicators();
        if (isPowerUpActive("triple")) {
            var remain = activePowerUps.triple - Date.now();
            var ratio = Math.max(0, Math.min(1, remain / powerUpDurations.triple));
            var tw = 54;
            var tx = player.posX + (player.w - tw) / 2;
            var ty = player.posY + player.h + 8;
            bufferctx.strokeStyle = "#70e7ff";
            bufferctx.lineWidth = 1;
            bufferctx.strokeRect(tx, ty, tw, 5);
            bufferctx.fillStyle = "#70e7ff";
            bufferctx.fillRect(tx + 1, ty + 1, Math.floor((tw - 2) * ratio), 3);
        }
        advanceLevelIfNeeded();
        drawWaveAnnouncement();
        drawHud();
        draw();
    }

    function draw() {
        // Apply screen shake to final render
        var shakeOffset = applyScreenShake(0, 0);
        ctx.drawImage(buffer, shakeOffset.x, shakeOffset.y);
    }

    function readScoreRecords() {
        try {
            var raw = localStorage.getItem(STORAGE_SCORES);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    function writeScoreRecords(arr) { localStorage.setItem(STORAGE_SCORES, JSON.stringify(arr)); }
    function formatDateTime() {
        var d = new Date();
        function z(n) { return n < 10 ? "0" + n : "" + n; }
        return z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear() + " " + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds());
    }

    function flashRankingIfNewTop(scoreValue) {
        var ranking = document.getElementById("puntuaciones");
        if (!ranking) { return; }
        var all = readScoreRecords();
        var prevMax = all.length ? parseInt(all[0].score, 10) : 0;
        if (scoreValue > prevMax) {
            ranking.classList.remove("flash-maximo");
            void ranking.offsetWidth;
            ranking.classList.add("flash-maximo");
            setTimeout(function () { ranking.classList.remove("flash-maximo"); }, 2800);
        }
    }

    function saveFinalScore(finalScore) {
        flashRankingIfNewTop(finalScore);
        var list = readScoreRecords();
        list.push({ name: getPlayerName(), score: finalScore, date: formatDateTime(), enemiesKilled: enemiesKilled, level: level });
        list.sort(function (a, b) { return parseInt(b.score, 10) - parseInt(a.score, 10); });
        list = list.slice(0, 5);
        writeScoreRecords(list);
        showBestScores();
    }

    function showBestScores() {
        var list = document.getElementById("puntuaciones");
        if (!list) { return; }
        list.innerHTML = "";
        function add(v, c) { var li = document.createElement("li"); li.textContent = v; if (c) { li.className = c; } list.appendChild(li); }
        add("Nombre", "cabecera"); add("Puntos", "cabecera");
        var top = readScoreRecords();
        for (var i = 0; i < top.length; i++) {
            var cls = i === 0 ? "negrita" : "";
            add(top[i].name || "—", cls);
            add(String(top[i].score), cls);
        }
    }

    function showEndOverlay(title, detail, points) {
        var ov = document.getElementById("overlay-fin");
        var t = document.getElementById("overlay-titulo");
        var d = document.getElementById("overlay-detalle");
        var p = document.getElementById("overlay-puntos");
        if (!ov || !t || !d || !p) { return; }
        t.textContent = title;
        d.textContent = detail;
        p.textContent = points;
        ov.classList.remove("hidden");
    }
    function hideEndOverlay() {
        var ov = document.getElementById("overlay-fin");
        if (ov) { ov.classList.add("hidden"); }
    }

    function finishGame(win, baseScore) {
        if (overlayShown) { return; }
        overlayShown = true;
        gameOver = true;
        var total = win ? (baseScore + player.life * 5) : baseScore;
        saveFinalScore(total);
        var detail = win ? "Excelente. Superaste el reto." : "Te quedaste sin vidas. Intenta de nuevo.";
        showGameOverOverlay(win ? "Victoria" : "Game Over", detail, "Puntos: " + total + " | Nivel alcanzado: " + level);
        
        // Play appropriate end game music
        if (win) {
            AudioManager.playVictoryMusic();
        } else {
            AudioManager.playGameOverMusic();
        }
    }

    function keyDown(e) {
        var key = window.event ? e.keyCode : e.which;
        if (startScreen && startScreen.handleKeyDown(key)) {
            e.preventDefault();
            return;
        }
        if (sessionActive && !gameOver && key === 80) {
            e.preventDefault();
            paused = !paused;
            keyPressed = {};
            return;
        }
        if (paused) {
            if (key === 38) { e.preventDefault(); pauseSelection = (pauseSelection + pauseOptions.length - 1) % pauseOptions.length; return; }
            if (key === 40) { e.preventDefault(); pauseSelection = (pauseSelection + 1) % pauseOptions.length; return; }
            if (key === 13 || key === 108) {
                e.preventDefault();
                if (pauseSelection === 0) { restartCurrentLevel(); } else { backToStartMenu(); }
                return;
            }
            if (key === 82) { e.preventDefault(); restartCurrentLevel(); return; } // R quick restart level
            if (key === 73 || key === 77) { e.preventDefault(); backToStartMenu(); return; } // I/M back to menu
            return;
        }
        for (var k in keyMap) {
            if (key === keyMap[k]) { e.preventDefault(); keyPressed[k] = true; }
        }
    }
    function keyUp(e) {
        var key = window.event ? e.keyCode : e.which;
        for (var k in keyMap) {
            if (key === keyMap[k]) {
                e.preventDefault();
                keyPressed[k] = false;
                if (k === "fire") { fireLock = false; }
            }
        }
    }

    function init() {
        preloadImages();
        canvas = document.getElementById("canvas");
        ctx = canvas.getContext("2d");
        buffer = document.createElement("canvas");
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext("2d");
        initParallaxStars();
        
        // Initialize Audio Manager
        AudioManager.init();
        
        startScreen = new StartScreen(canvas, bufferctx, startGame);
        bindUI();
        showBestScores();
        canvas.addEventListener("click", function (ev) {
            if (!startScreen) { return; }
            var rect = canvas.getBoundingClientRect();
            var px = ev.clientX - rect.left;
            var py = ev.clientY - rect.top;
            if (paused) {
                var panelW = 520;
                var panelH = 280;
                var x = (canvas.width - panelW) / 2;
                var y = (canvas.height - panelH) / 2;
                var firstTop = y + 102;
                var boxH = 42;
                var boxW = panelW - 124;
                for (var i = 0; i < pauseOptions.length; i++) {
                    var by = firstTop + i * 58;
                    if (px >= x + 62 && px <= x + 62 + boxW && py >= by && py <= by + boxH) {
                        pauseSelection = i;
                        if (i === 0) { restartCurrentLevel(); } else { backToStartMenu(); }
                        return;
                    }
                }
                return;
            }
            startScreen.handleClick(px, py);
        });
        document.addEventListener("keydown", keyDown);
        document.addEventListener("keyup", keyUp);
        function anim() { loop(); requestAnimFrame(anim); }
        anim();
    }

    return { init: init };
})();

document.addEventListener("DOMContentLoaded", function () { game.init(); });
