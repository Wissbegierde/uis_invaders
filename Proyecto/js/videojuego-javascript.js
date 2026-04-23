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
    var STORAGE_ACHIEVEMENTS = "invaders_achievements_v1";
    var MAX_LIVES = 5;

    var canvas, ctx, buffer, bufferctx;
    var bgMain, bgBoss, playerShotImage, enemyShotImage, playerImage, playerKilledImage, heartImage;
    var bgScrollY = 0;
    var starsParallax = [];
    var BG_ASSET_W = 1168;
    var BG_ASSET_H = 784;
    
    // ==================== ACHIEVEMENTS SYSTEM ====================
    var achievementManager = null;
    var activeAchievementPopups = [];
    
    // Achievement definitions with retro arcade theme
    var ACHIEVEMENTS = {
        first_blood: {
            id: "first_blood",
            title: "FIRST BLOOD",
            description: "Destroy your first enemy",
            icon: "🎯",
            requirement: 1,
            type: "enemies_killed"
        },
        combo_master: {
            id: "combo_master",
            title: "COMBO MASTER",
            description: "Reach 5x combo",
            icon: "⚡",
            requirement: 5,
            type: "max_combo"
        },
        untouchable: {
            id: "untouchable",
            title: "UNTOUCHABLE",
            description: "Complete a wave without taking damage",
            icon: "🛡️",
            requirement: 1,
            type: "wave_no_damage"
        },
        boss_slayer: {
            id: "boss_slayer",
            title: "BOSS SLAYER",
            description: "Defeat a boss enemy",
            icon: "👹",
            requirement: 1,
            type: "bosses_killed"
        },
        survivor: {
            id: "survivor",
            title: "SURVIVOR",
            description: "Survive for 5 minutes",
            icon: "⏰",
            requirement: 300, // 5 minutes in seconds
            type: "survival_time"
        },
        sharpshooter: {
            id: "sharpshooter",
            title: "SHARPSHOOTER",
            description: "Achieve 80% accuracy",
            icon: "🎪",
            requirement: 0.8,
            type: "accuracy"
        },
        wave_conqueror: {
            id: "wave_conqueror",
            title: "WAVE CONQUEROR",
            description: "Complete all 5 waves",
            icon: "🌊",
            requirement: 5,
            type: "waves_completed"
        },
        destroyer: {
            id: "destroyer",
            title: "DESTROYER",
            description: "Destroy 50 enemies in one run",
            icon: "💥",
            requirement: 50,
            type: "enemies_killed"
        }
    };
    
    // Achievement Manager Class
    function AchievementManager() {
        this.unlockedAchievements = this.loadAchievements();
        this.trackingStats = {
            enemies_killed: 0,
            max_combo: 0,
            wave_no_damage: 0,
            bosses_killed: 0,
            survival_time: 0,
            shots_fired: 0,
            shots_hit: 0,
            waves_completed: 0,
            current_combo: 0,
            wave_start_time: 0,
            run_start_time: 0,
            last_damage_time: 0
        };
        this.sessionStartTime = Date.now();
    }
    
    AchievementManager.prototype = {
        // Initialize tracking for new game session
        initSession: function() {
            this.trackingStats.current_combo = 0;
            this.trackingStats.wave_start_time = Date.now();
            this.trackingStats.run_start_time = Date.now();
            this.trackingStats.last_damage_time = 0;
        },
        
        // Load achievements from localStorage
        loadAchievements: function() {
            var saved = localStorage.getItem(STORAGE_ACHIEVEMENTS);
            return saved ? JSON.parse(saved) : [];
        },
        
        // Save achievements to localStorage
        saveAchievements: function() {
            localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(this.unlockedAchievements));
        },
        
        // Check if achievement is unlocked
        isUnlocked: function(achievementId) {
            return this.unlockedAchievements.indexOf(achievementId) !== -1;
        },
        
        // Unlock achievement with popup notification
        unlockAchievement: function(achievementId) {
            if (this.isUnlocked(achievementId)) return false;
            
            this.unlockedAchievements.push(achievementId);
            this.saveAchievements();
            
            var achievement = ACHIEVEMENTS[achievementId];
            if (achievement) {
                this.showAchievementPopup(achievement);
                return true;
            }
            return false;
        },
        
        // Show animated popup notification
        showAchievementPopup: function(achievement) {
            var popup = {
                achievement: achievement,
                startTime: Date.now(),
                duration: 3000, // 3 seconds
                y: -100, // Start off-screen
                targetY: 150,
                alpha: 0,
                targetAlpha: 1,
                state: "slide_in" // slide_in, display, slide_out
            };
            
            activeAchievementPopups.push(popup);
            
            // Play achievement sound (reuse existing sound system)
            if (typeof AudioManager !== 'undefined') {
                AudioManager.playSfx("powerup_pick");
            }
        },
        
        // Update achievement popups
        updatePopups: function() {
            var now = Date.now();
            
            for (var i = activeAchievementPopups.length - 1; i >= 0; i--) {
                var popup = activeAchievementPopups[i];
                var elapsed = now - popup.startTime;
                
                if (popup.state === "slide_in") {
                    popup.y += (popup.targetY - popup.y) * 0.15;
                    popup.alpha += (popup.targetAlpha - popup.alpha) * 0.15;
                    
                    if (Math.abs(popup.y - popup.targetY) < 1) {
                        popup.state = "display";
                        popup.displayStartTime = now;
                    }
                } else if (popup.state === "display") {
                    if (now - popup.displayStartTime > 2000) {
                        popup.state = "slide_out";
                        popup.targetY = -100;
                        popup.targetAlpha = 0;
                    }
                } else if (popup.state === "slide_out") {
                    popup.y += (popup.targetY - popup.y) * 0.15;
                    popup.alpha += (popup.targetAlpha - popup.alpha) * 0.15;
                    
                    if (popup.y < -90) {
                        activeAchievementPopups.splice(i, 1);
                    }
                }
            }
        },
        
        // Draw achievement popups
        drawPopups: function(ctx) {
            for (var i = 0; i < activeAchievementPopups.length; i++) {
                var popup = activeAchievementPopups[i];
                var achievement = popup.achievement;
                
                ctx.save();
                ctx.globalAlpha = popup.alpha;
                
                // Background panel with neon effect
                ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
                ctx.strokeStyle = "#00FF88";
                ctx.lineWidth = 2;
                ctx.shadowColor = "#00FF88";
                ctx.shadowBlur = 10;
                
                var panelWidth = 300;
                var panelHeight = 80;
                var panelX = (canvas.width - panelWidth) / 2;
                var panelY = popup.y;
                
                ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
                ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
                
                // Achievement content
                ctx.shadowBlur = 0;
                ctx.fillStyle = "#00FF88";
                ctx.font = "bold 16px 'Press Start 2P', monospace";
                ctx.textAlign = "left";
                ctx.fillText(achievement.icon + " " + achievement.title, panelX + 15, panelY + 30);
                
                ctx.fillStyle = "#00FFFF";
                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.fillText(achievement.description, panelX + 15, panelY + 50);
                
                // "UNLOCKED" text
                ctx.fillStyle = "#FFFF00";
                ctx.font = "bold 8px 'Press Start 2P', monospace";
                ctx.textAlign = "right";
                ctx.fillText("UNLOCKED!", panelX + panelWidth - 15, panelY + 65);
                
                ctx.restore();
            }
        },
        
        // Track various game events
        trackEnemyKill: function() {
            this.trackingStats.enemies_killed++;
            this.trackingStats.current_combo++;
            
            if (this.trackingStats.current_combo > this.trackingStats.max_combo) {
                this.trackingStats.max_combo = this.trackingStats.max_combo;
            }
            
            this.checkAchievements();
        },
        
        trackShotFired: function() {
            this.trackingStats.shots_fired++;
        },
        
        trackShotHit: function() {
            this.trackingStats.shots_hit++;
        },
        
        trackDamageTaken: function() {
            this.trackingStats.last_damage_time = Date.now();
        },
        
        trackWaveCompleted: function() {
            this.trackingStats.waves_completed++;
            
            // Check if wave was completed without damage
            var waveTime = Date.now() - this.trackingStats.wave_start_time;
            if (this.trackingStats.last_damage_time < this.trackingStats.wave_start_time) {
                this.trackingStats.wave_no_damage++;
            }
            
            this.trackingStats.wave_start_time = Date.now();
            this.checkAchievements();
        },
        
        trackBossKilled: function() {
            this.trackingStats.bosses_killed++;
            this.checkAchievements();
        },
        
        // Check and unlock achievements based on current stats
        checkAchievements: function() {
            for (var id in ACHIEVEMENTS) {
                var achievement = ACHIEVEMENTS[id];
                if (this.isUnlocked(id)) continue;
                
                var currentValue = this.trackingStats[achievement.type];
                var shouldUnlock = false;
                
                switch (achievement.type) {
                    case "accuracy":
                        if (this.trackingStats.shots_fired > 0) {
                            var accuracy = this.trackingStats.shots_hit / this.trackingStats.shots_fired;
                            shouldUnlock = accuracy >= achievement.requirement;
                        }
                        break;
                    case "survival_time":
                        var survivalSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000);
                        shouldUnlock = survivalSeconds >= achievement.requirement;
                        break;
                    default:
                        shouldUnlock = currentValue >= achievement.requirement;
                        break;
                }
                
                if (shouldUnlock) {
                    this.unlockAchievement(id);
                }
            }
        },
        
        // Get all achievements with unlock status
        getAllAchievements: function() {
            var result = [];
            for (var id in ACHIEVEMENTS) {
                result.push({
                    achievement: ACHIEVEMENTS[id],
                    unlocked: this.isUnlocked(id)
                });
            }
            return result;
        },
        
        // Reset combo when player takes damage
        resetCombo: function() {
            this.trackingStats.current_combo = 0;
        }
    };
    
    // ==================== CREDITS SYSTEM ====================
    var creditsActive = false;
    var creditsScrollY = 0;
    var creditsScrollSpeed = 0.8;
    var creditsStars = [];
    var creditsTextLines = [];
    
    // Menu credits (separate from post-victory credits)
    var menuCreditsActive = false;
    var menuCreditsScrollY = 0;
    var menuCreditsScrollSpeed = 0.8;
    var menuCreditsStars = [];
    var menuCreditsTextLines = [];
    
    function initCredits() {
        creditsActive = true;
        creditsScrollY = canvas.height + 50;
        creditsStars = [];
        
        // Initialize starfield for credits
        for (var i = 0; i < 100; i++) {
            creditsStars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.5 + 0.5
            });
        }
        
        // Set up credits text lines
        creditsTextLines = [
            { text: "=== CREDITS ===", size: 28, color: "#00FF00", spacing: 60 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Tentacle Defense: Zero Hour", size: 24, color: "#00FFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Developed by:", size: 20, color: "#00FF00", spacing: 40 },
            { text: "Sergio Andrés Martinez Perez", size: 18, color: "#FFFFFF", spacing: 30 },
            { text: "Daniel Fernando Leal Ayala", size: 18, color: "#FFFFFF", spacing: 30 },
            { text: "Juan David Mena Gamboa", size: 18, color: "#FFFFFF", spacing: 30 },
            { text: "Miguel Ángel Bolaño López", size: 18, color: "#FFFFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Universidad Industrial de Santander (UIS)", size: 18, color: "#00FF00", spacing: 30 },
            { text: "Software Engineering Project", size: 18, color: "#00FF00", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Special Thanks:", size: 20, color: "#00FF00", spacing: 40 },
            { text: "Leonardo AI", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "Pixabay", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "Freesound", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "Epic 8-bit Music YouTube Channel", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "HTML5 Canvas", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "JavaScript ES5", size: 18, color: "#FFFFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Powered by:", size: 20, color: "#00FF00", spacing: 40 },
            { text: "Canvas HTML5 + JavaScript", size: 18, color: "#00FFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "PRESS ENTER TO RETURN TO MENU", size: 16, color: "#FFFF00", spacing: 30 }
        ];
    }
    
    function drawCreditsBackground() {
        // Draw dark space background
        bufferctx.fillStyle = "#02060f";
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw stars
        for (var i = 0; i < creditsStars.length; i++) {
            var s = creditsStars[i];
            s.y += s.speed;
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
    
    function drawCredits() {
        if (!creditsActive) return;
        
        drawCreditsBackground();
        
        var currentY = creditsScrollY;
        var centerX = canvas.width / 2;
        
        bufferctx.textAlign = "center";
        
        for (var i = 0; i < creditsTextLines.length; i++) {
            var line = creditsTextLines[i];
            if (line.text === "") {
                currentY += line.spacing;
                continue;
            }
            
            // Calculate fade based on position
            var fadeAlpha = 1;
            if (currentY < 100) {
                fadeAlpha = Math.max(0, currentY / 100);
            } else if (currentY > canvas.height - 100) {
                fadeAlpha = Math.max(0, (canvas.height - currentY) / 100);
            }
            
            bufferctx.globalAlpha = fadeAlpha;
            bufferctx.fillStyle = line.color;
            bufferctx.font = line.size + "px 'Press Start 2P', monospace";
            bufferctx.fillText(line.text, centerX, currentY);
            
            currentY += line.spacing;
        }
        
        bufferctx.globalAlpha = 1;
    }
    
    function updateCredits() {
        if (!creditsActive) return;
        
        creditsScrollY -= creditsScrollSpeed;
        
        // Check if credits have finished scrolling
        var totalHeight = 0;
        for (var i = 0; i < creditsTextLines.length; i++) {
            totalHeight += creditsTextLines[i].spacing;
        }
        
        if (creditsScrollY < -totalHeight) {
            // Credits finished, return to menu
            creditsActive = false;
            backToStartMenu();
        }
    }
    
    function skipCredits() {
        if (!creditsActive) return;
        creditsActive = false;
        backToStartMenu();
    }
    
    function initMenuCredits(canvasRef) {
        if (!canvasRef) {
            console.error("Canvas not defined in initMenuCredits");
            return;
        }
        menuCreditsActive = true;
        menuCreditsScrollY = canvasRef.height + 50;
        menuCreditsStars = [];
        
        // Initialize starfield for menu credits
        for (var i = 0; i < 100; i++) {
            menuCreditsStars.push({
                x: Math.random() * canvasRef.width,
                y: Math.random() * canvasRef.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.5 + 0.5
            });
        }
        
        // Set up menu credits text lines
        menuCreditsTextLines = [
            { text: "Tentacle Defense: Zero Hour", size: 24, color: "#00FFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Developed by:", size: 20, color: "#00FF00", spacing: 40 },
            { text: "Sergio Andrés Martinez Perez", size: 18, color: "#FFFFFF", spacing: 30 },
            { text: "Daniel Fernando Leal Ayala", size: 18, color: "#FFFFFF", spacing: 30 },
            { text: "Juan David Mena Gamboa", size: 18, color: "#FFFFFF", spacing: 30 },
            { text: "Miguel Ángel Bolaño López", size: 18, color: "#FFFFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Universidad Industrial de Santander (UIS)", size: 18, color: "#00FF00", spacing: 30 },
            { text: "Software Engineering Project", size: 18, color: "#00FF00", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Special Thanks:", size: 20, color: "#00FF00", spacing: 40 },
            { text: "Leonardo AI", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "Pixabay", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "Freesound", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "Epic 8-bit Music YouTube Channel", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "HTML5 Canvas", size: 18, color: "#FFFFFF", spacing: 25 },
            { text: "JavaScript ES5", size: 18, color: "#FFFFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "Powered by:", size: 20, color: "#00FF00", spacing: 40 },
            { text: "Canvas HTML5 + JavaScript", size: 18, color: "#00FFFF", spacing: 50 },
            { text: "", size: 20, color: "#00FFFF", spacing: 30 },
            { text: "PRESS ENTER OR ESC TO RETURN", size: 16, color: "#FFFF00", spacing: 30 }
        ];
    }
    
    function drawMenuCreditsBackground() {
        // Draw dark space background
        ctx.fillStyle = "#02060f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw stars
        for (var i = 0; i < menuCreditsStars.length; i++) {
            var s = menuCreditsStars[i];
            s.y += s.speed;
            if (s.y > canvas.height + 2) {
                s.y = -2;
                s.x = Math.random() * canvas.width;
            }
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
    }
    
    function drawMenuCredits() {
        if (!menuCreditsActive) return;
        
        drawMenuCreditsBackground();
        
        var currentY = menuCreditsScrollY;
        var centerX = canvas.width / 2;
        
        ctx.textAlign = "center";
        
        for (var i = 0; i < menuCreditsTextLines.length; i++) {
            var line = menuCreditsTextLines[i];
            if (line.text === "") {
                currentY += line.spacing;
                continue;
            }
            
            // Calculate fade based on position
            var fadeAlpha = 1;
            if (currentY < 100) {
                fadeAlpha = Math.max(0, currentY / 100);
            } else if (currentY > canvas.height - 100) {
                fadeAlpha = Math.max(0, (canvas.height - currentY) / 100);
            }
            
            ctx.globalAlpha = fadeAlpha;
            ctx.fillStyle = line.color;
            ctx.font = line.size + "px 'Press Start 2P', monospace";
            ctx.fillText(line.text, centerX, currentY);
            
            currentY += line.spacing;
        }
        
        ctx.globalAlpha = 1;
    }
    
    function updateMenuCredits() {
        if (!menuCreditsActive) return;
        
        menuCreditsScrollY -= menuCreditsScrollSpeed;
        
        // Check if credits have finished scrolling
        var totalHeight = 0;
        for (var i = 0; i < menuCreditsTextLines.length; i++) {
            totalHeight += menuCreditsTextLines[i].spacing;
        }
        
        if (menuCreditsScrollY < -totalHeight) {
            // Credits finished, return to menu
            menuCreditsActive = false;
            if (startScreen) {
                startScreen.active = true;
                startScreen.mode = "menu";
            }
        }
    }
    
    function skipMenuCredits() {
        if (!menuCreditsActive) return;
        menuCreditsActive = false;
        if (startScreen) {
            startScreen.active = true;
            startScreen.mode = "menu";
        }
    }
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
    var keyMap = { left: 37, right: 39, up: 38, down: 40, fire: 32 };
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
    var pauseOptions = ["CONTINUAR", "REINICIAR NIVEL", "PANTALLA INICIAL"];
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
    var lastMinionWaveTime = 0;
    var bossActive = false;
    var currentBoss = null;
    
    // Support boss system variables
    var supportBossSpawned = false;
    var supportBoss = null;
    var supportBossHP = 0;
    var supportBossMaxHP = 0;
    var boss75PercentTriggered = false;
    
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
    
    // ==================== COLLISION DETECTION HELPER ====================
    // Función estandarizada para colisiones AABB con hitboxes ajustadas
    function checkAABBCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.w &&
               rect1.x + rect1.w > rect2.x &&
               rect1.y < rect2.y + rect2.h &&
               rect1.y + rect1.h > rect2.y;
    }
    
    // Obtener hitbox ajustada del jugador
    function getPlayerHitbox() {
        return {
            x: player.posX + player.hitboxOffsetX,
            y: player.posY + player.hitboxOffsetY,
            w: player.hitboxW,
            h: player.hitboxH
        };
    }
    
    // Obtener hitbox ajustada de un enemigo
    function getEnemyHitbox(enemy) {
        return {
            x: enemy.posX + enemy.hitboxOffsetX,
            y: enemy.posY + enemy.hitboxOffsetY,
            w: enemy.hitboxW,
            h: enemy.hitboxH
        };
    }
    
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
        // Load 4 player animation frames
        playerFrames = [];
        for (var i = 1; i <= 4; i++) {
            var frame = new Image();
            frame.src = "images/bueno" + i + ".png";
            playerFrames.push(frame);
        }
        playerImage = playerFrames[0]; // Default to first frame for compatibility
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
        c.fillStyle = "rgba(0,0,0,0.85)";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#00FF00";
        c.lineWidth = 2;
        c.fillStyle = "rgba(4,18,8,0.95)";
        c.fillRect(w / 2 - 320, h / 2 - 160, 640, 320);
        c.strokeRect(w / 2 - 320, h / 2 - 160, 640, 320);
        c.textAlign = "center";
        
        var y = h / 2 - 130;
        
        c.fillStyle = "#00FF00";
        c.font = "20px " + this.font;
        c.fillText("Tentacle Defense: Zero Hour", w / 2, y);
        y += 30;
        
        c.font = "12px " + this.font;
        c.fillStyle = "#FFFF00";
        c.fillText("Videojuego Desarrollado por Gorgon Arcade Labs", w / 2, y);
        y += 30;
        
        
        
        c.fillStyle = "#FFFFFF";
        c.font = "12px " + this.font;
        c.fillText("Sergio Andrés Martinez Perez", w / 2, y);
        y += 18;
        c.fillText("Daniel Fernando Leal Ayala", w / 2, y);
        y += 18;
        c.fillText("Juan David Mena Gamboa", w / 2, y);
        y += 18;
        c.fillText("Miguel Ángel Bolaño López", w / 2, y);
        y += 25;
        
        c.fillStyle = "#00FF00";
        c.font = "14px " + this.font;
        c.fillText("Universidad Industrial de Santander (UIS)", w / 2, y);
        y += 18;
        c.fillText("Software Engineering Project", w / 2, y);
        y += 25;
        
        c.fillStyle = "#00FFFF";
        c.fillText("Special Thanks:", w / 2, y);
        y += 22;
        
        c.fillStyle = "#FFFFFF";
        c.font = "12px " + this.font;
        c.fillText("Leonardo AI, Pixabay, Freesound", w / 2, y);
        y += 18;
        c.fillText("Epic 8-bit Music YouTube Channel", w / 2, y);
        y += 18;
        c.fillText("HTML5 Canvas, JavaScript ES5", w / 2, y);
        y += 25;
        
        c.fillStyle = "#00FF00";
        c.font = "14px " + this.font;
        c.fillText("Powered by: Canvas HTML5 + JavaScript", w / 2, y);
        
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
        // Use existing credits system
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
        
        // Dynamic formation change properties
        this.lastFormationChangeTime = 0;
        this.enemiesKilled = 0;
        this.formationChangeTime = 0;
    }

    FormationController.prototype = {
        // Initialize formation with type and enemies
        initFormation: function(type, enemyList, waveLevel) {
            this.formationType = type;
            this.enemies = enemyList;
            this.isActive = true;
            this.time = 0;
            
            // Apply difficulty scaling - balanced movement
            this.baseSpeed = 0.6 + (waveLevel * 0.06); // 2x faster base speed
            this.oscillationAmount = 80 + (waveLevel * 8); // Moderate lateral movement
            this.downwardDrift = 0.15 + (waveLevel * 0.03); // Balanced vertical movement
            
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
        
        // Update formation movement - Enhanced with dynamic formation changes
        update: function() {
            if (!this.isActive || this.enemies.length === 0) return;
            
            this.time += 0.016; // ~60fps timing
            
            // Check if formation should change
            if (this.shouldChangeFormation()) {
                this.changeFormationType();
                this.lastFormationChangeTime = Date.now();
                this.enemiesKilled = 0; // Reset killed counter
            }
            
            // Enhanced movement patterns with multiple behaviors
            this.updateFormationCenter();
            this.updateEvasionBehavior();
            this.updateCoordinatedMovement();
            this.updatePatternTransitions();
            
            // Update each enemy position with individual movement
            for (var i = 0; i < this.enemies.length; i++) {
                var enemy = this.enemies[i];
                if (enemy && !enemy.dead) {
                    this.updateEnemyPosition(enemy, i);
                    this.updateEnemyShooting(enemy, i);
                }
            }
        },
        
        // Update formation center — horizontal movement with vertical boundary system
        updateFormationCenter: function() {
            // Primary oscillating horizontal movement
            var primaryHorizontal = Math.sin(this.time * this.baseSpeed) * this.oscillationAmount;
            
            // Secondary lateral movement (figure-8 pattern)
            var secondaryHorizontal = Math.sin(this.time * this.baseSpeed * 2) * (this.oscillationAmount * 0.3);
            
            // Horizontal movement
            this.centerX = (canvas.width / 2) + primaryHorizontal + secondaryHorizontal;
            
            // Vertical boundary system - keep formations in upper 60% of screen
            var softLowerBoundary = canvas.height * 0.6; // 60% of screen height
            var preferredUpperZone = canvas.height * 0.3; // Preferred center area (30%)
            var recoveryStrength = 0.08; // Gentle recovery force
            
            // Apply normal downward drift
            this.centerY += this.downwardDrift;
            
            // Apply recovery movement if formation is too low
            if (this.centerY > softLowerBoundary) {
                // Calculate how far beyond the boundary
                var excessDistance = this.centerY - softLowerBoundary;
                // Apply proportional recovery force (stronger when further down)
                var recoveryForce = recoveryStrength * (1 + excessDistance / 100);
                // Move upward toward preferred zone
                this.centerY -= recoveryForce * excessDistance;
            }
            // Gentle upward drift if in preferred zone to prevent settling at boundary
            else if (this.centerY > preferredUpperZone) {
                this.centerY -= this.downwardDrift * 0.3; // Counteract some of the downward drift
            }
            
            // Hard boundaries to prevent formations from going completely off-screen
            var minY = 50; // Minimum Y position
            var maxY = canvas.height * 0.75; // Absolute maximum (75% of screen)
            
            if (this.centerY < minY) {
                this.centerY = minY;
            } else if (this.centerY > maxY) {
                this.centerY = maxY;
            }
            
            // Keep formation within horizontal bounds with smooth bouncing
            var margin = 100;
            if (this.centerX < margin) {
                this.centerX = margin;
                this.horizontalDirection = 1;
            } else if (this.centerX > canvas.width - margin) {
                this.centerX = canvas.width - margin;
                this.horizontalDirection = -1;
            }
        },
        
        // Coordinated group movement patterns
        updateCoordinatedMovement: function() {
            // Wave synchronization - enemies move in coordinated waves
            var wavePhase = this.time * 3;
            var waveAmplitude = 15;
            
            for (var i = 0; i < this.enemies.length; i++) {
                var enemy = this.enemies[i];
                if (enemy && !enemy.dead) {
                    // Individual wave offset based on position in formation
                    var waveOffset = Math.sin(wavePhase + (i * 0.5)) * waveAmplitude;
                    enemy.coordinatedOffsetX = waveOffset;
                    
                    // Vertical wave movement
                    var verticalWave = Math.cos(wavePhase * 1.5 + (i * 0.3)) * (waveAmplitude * 0.5);
                    enemy.coordinatedOffsetY = verticalWave;
                }
            }
        },
        
        // Pattern transitions for dynamic behavior changes
        updatePatternTransitions: function() {
            // Change movement patterns periodically
            if (!this.patternChangeTime) this.patternChangeTime = 0;
            
            this.patternChangeTime += 0.016;
            
            // Change pattern every 5-8 seconds
            if (this.patternChangeTime > (5 + Math.random() * 3)) {
                this.patternChangeTime = 0;
                this.changeMovementPattern();
            }
        },
        
        // Change to different movement pattern
        changeMovementPattern: function() {
            var patterns = ['aggressive', 'evasive', 'circular', 'zigzag', 'scattered'];
            var newPattern = patterns[Math.floor(Math.random() * patterns.length)];
            
            switch(newPattern) {
                case 'aggressive':
                    this.baseSpeed = Math.min(2.5, this.baseSpeed * 1.3);
                    this.oscillationAmount = Math.max(100, this.oscillationAmount * 0.8);
                    break;
                case 'evasive':
                    this.baseSpeed = Math.min(2.2, this.baseSpeed * 1.2);
                    this.oscillationAmount = Math.min(200, this.oscillationAmount * 1.4);
                    break;
                case 'circular':
                    this.movementPattern = 'circular';
                    this.patternStartTime = this.time;
                    break;
                case 'zigzag':
                    this.movementPattern = 'zigzag';
                    this.patternStartTime = this.time;
                    break;
                case 'scattered':
                    this.movementPattern = 'scattered';
                    this.patternStartTime = this.time;
                    break;
            }
        },
        
        // Change formation type dynamically during gameplay
        changeFormationType: function() {
            if (!this.isActive || this.enemies.length === 0) return;
            
            var formationTypes = ['grid', 'v-shape', 'line', 'sine-wave', 'zigzag'];
            var currentType = this.formationType;
            
            // Select a different formation type
            var availableTypes = formationTypes.filter(function(type) { return type !== currentType; });
            var newType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            
            // Change formation type and reposition enemies
            this.formationType = newType;
            this.positionEnemiesInFormation();
            
            // Add visual feedback
            this.formationChangeTime = Date.now();
        },
        
        // Check if formation should change based on enemies killed or time
        shouldChangeFormation: function() {
            // Change formation every 8-12 seconds
            if (!this.lastFormationChangeTime) this.lastFormationChangeTime = Date.now();
            
            var timeSinceChange = Date.now() - this.lastFormationChangeTime;
            var timeThreshold = 8000 + Math.random() * 4000; // 8-12 seconds
            
            // Also change when certain number of enemies are killed
            var originalCount = this.enemies.length;
            var killedThreshold = Math.max(2, Math.floor(originalCount * 0.3)); // 30% of enemies
            
            return timeSinceChange > timeThreshold || (this.enemiesKilled >= killedThreshold);
        },
        
        // Evasion behavior - formation reacts to player position
        updateEvasionBehavior: function() {
            if (!player || player.dead) return;
            
            var playerCenterX = player.posX + player.w / 2;
            var formationCenterX = this.centerX;
            var distance = Math.abs(playerCenterX - formationCenterX);
            
            // If player is close, formation tries to evade horizontally
            if (distance < 150) {
                var evasionStrength = (150 - distance) / 150;
                var evasionDirection = (formationCenterX < playerCenterX) ? -1 : 1;
                this.centerX += evasionDirection * evasionStrength * 2;
            }
        },
        
        // Update individual enemy position — horizontal movement only
        updateEnemyPosition: function(enemy, index) {
            // Base formation position
            var baseX = this.centerX + enemy.formationOffsetX;
            var baseY = this.centerY + enemy.formationOffsetY;
            
            // Individual horizontal movement only
            var individualOffsetX = Math.sin(this.time * 2 + index * 0.5) * 8;
            
            // Random horizontal micro-movements
            if (Math.random() < 0.02) {
                enemy.dodgeX = (Math.random() - 0.5) * 15;
                enemy.dodgeDecay = 0.95;
            }
            
            // Apply dodge with decay
            if (enemy.dodgeX !== undefined) {
                individualOffsetX += enemy.dodgeX;
                enemy.dodgeX *= enemy.dodgeDecay;
                
                if (Math.abs(enemy.dodgeX) < 0.5) {
                    enemy.dodgeX = undefined;
                }
            }
            
            // Final position calculation — Y stays fixed at formation position
            enemy.posX = baseX + individualOffsetX;
            enemy.posY = baseY;
            
            // Keep enemies within canvas bounds
            enemy.posX = Math.max(0, Math.min(canvas.width - enemy.w, enemy.posX));
            enemy.posY = Math.max(0, Math.min(canvas.height - enemy.h, enemy.posY));
        },
        
        // Enhanced enemy shooting with balanced speed and frequency
        updateEnemyShooting: function(enemy, index) {
            if (!this.canEnemyShoot(enemy)) return;
            
            var now = Date.now();
            var shootChance = 0.25 + (level * 0.03); // Moderate shooting chance per level
            shootChance = Math.min(0.6, shootChance); // Cap at 60% - reasonable frequency
            
            if (Math.random() < shootChance) {
                // Calculate shot speed based on level - balanced
                var shotSpeed = 2.5 + (level * 0.15); // Slower shots at higher levels
                shotSpeed = Math.min(5.0, shotSpeed); // Lower maximum speed
                
                // Add slight aiming variation based on level
                var aimVariation = (Math.random() - 0.5) * (0.4 - (level * 0.03));
                aimVariation = Math.max(0.02, aimVariation); // Minimum variation - more accurate
                
                enemyShots.push({
                    x: enemy.posX + enemy.w / 2 - 4,
                    y: enemy.posY + enemy.h,
                    speed: shotSpeed,
                    vx: aimVariation,
                    img: enemyShotImage
                });
                
                this.markEnemyShot(enemy);
            }
        },
        
        // Set initial shooting delays for much faster shooting
        setInitialShootingDelays: function(waveLevel) {
            for (var i = 0; i < this.enemies.length; i++) {
                var enemy = this.enemies[i];
                // Much shorter delays - enemies start shooting quickly
                enemy.shootActivationTime = Date.now() + (500 + (i * 50) + (waveLevel * 20));
                enemy.lastShotTime = 0;
                enemy.staggeredShotDelay = (i * 100) + rand(200); // Much shorter stagger delays
            }
        },
        
        // Check if enemy can shoot - much faster shooting
        canEnemyShoot: function(enemy) {
            var now = Date.now();
            
            // Must wait for activation delay
            if (now < enemy.shootActivationTime) {
                return false;
            }
            
            // Much shorter shooting intervals
            var timeSinceLastShot = now - enemy.lastShotTime;
            var baseShotInterval = 800 - (currentWave * 20); // Slower shooting in later waves
            var minInterval = Math.max(300, baseShotInterval); // Longer minimum interval
            
            return timeSinceLastShot > (minInterval + enemy.staggeredShotDelay);
        },
        
        // Mark enemy as having shot - much faster reset
        markEnemyShot: function(enemy) {
            enemy.lastShotTime = Date.now();
            enemy.staggeredShotDelay = 100 + rand(300); // Much shorter reset delay for rapid fire
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
        
        // Hitbox ajustada para correspondencia visual con el sprite de la medusa
        // Reduce el área de colisión para evitar falsos positivos en bordes vacíos
        this.hitboxOffsetX = 8;  // Margen izquierdo ajustado
        this.hitboxOffsetY = 10; // Margen superior ajustado
        this.hitboxW = 34;       // Ancho de hitbox (50 - 8 - 8)
        this.hitboxH = 46;       // Alto de hitbox (66 - 10 - 10)
        
        // Animation properties for dynamic movement
        this.breathOffset = 0;
        this.breathSpeed = 0.002;
        this.breathTime = 0;
        this.baseY = this.posY;
        this.shootAnimation = 0;
        
        // Frame-based animation properties
        this.frames = playerFrames;
        this.currentFrame = 0;
        this.frameTimer = Date.now(); // Initialize timer
        this.frameInterval = 120; // Change frame every 120ms
        this.isMoving = false;
        this.shootAnimationSpeed = 0.3;
        this.pulseScale = 1;
        this.pulseSpeed = 0.001;
        this.pulseTime = 0;
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
        
        // Hitbox ajustada para correspondencia visual con los sprites
        if (this.isBoss) {
            this.hitboxOffsetX = 12; // Margen para boss
            this.hitboxOffsetY = 15;
            this.hitboxW = 72;        // Ancho de hitbox (96 - 12 - 12)
            this.hitboxH = 56;        // Alto de hitbox (86 - 15 - 15)
        } else {
            this.hitboxOffsetX = 6;  // Margen para enemigo normal
            this.hitboxOffsetY = 8;
            this.hitboxW = 38;        // Ancho de hitbox (50 - 6 - 6)
            this.hitboxH = 34;        // Alto de hitbox (50 - 8 - 8)
        }
        
        this.downSpeed = this.isBoss ? (0.4 + level * 0.05) : (0.6 + level * 0.08); // Moderately faster vertical movement
        this.hDir = Math.random() < 0.5 ? -1 : 1;
        this.hSpeed = (this.isBoss ? 1.2 : 1.8) + (level * 0.1) + Math.random() * 0.5; // Moderately faster horizontal movement
        this.phase = 40 + rand(120);
        this.phaseTick = 0;
        this.life = this.isBoss ? (8 + level * 2) : (2 + Math.floor(level / 2));
        this.pointsToKill = this.isBoss ? (40 + level * 7) : (6 + level * 2);
        this.spawnTime = Date.now();
        this.shootDelay = 3500 + rand(2000);
        
        // Formation properties
        this.formationOffsetX = 0;
        this.formationOffsetY = 0;
        this.formationIndex = 0;
        this.isInFormation = false;
        
        // Shooting properties for formation system
        this.shootActivationTime = 0;
        this.lastShotTime = 0;
        this.staggeredShotDelay = 0;
        
        // Hit flash properties
        this.hitFlashUntil = 0;
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
            
            // Enhanced shooting for formation enemies - much faster
            if (this.isInFormation) {
                // Check if enemy can shoot (with much shorter delay)
                var now = Date.now();
                if (!this.lastShotTime || now - this.lastShotTime > 800) { // 0.8 second cooldown - much faster
                    if (Math.random() < 0.4) { // 40% chance per cooldown - much higher
                        enemyShots.push({
                            x: this.posX + this.w / 2 - 4,
                            y: this.posY + this.h,
                            speed: 4.0 + level * 0.2, // Much faster shots
                            img: enemyShotImage
                        });
                        this.lastShotTime = now;
                    }
                }
            }
            return;
        }
        
        // Legacy movement for non-formation enemies (bosses, etc.)
        if (this.formationCenterY !== undefined) {
            // Boss minion - oscillate up and down in formation
            this.verticalTime += this.verticalSpeed;
            var verticalOffset = Math.sin(this.verticalTime) * this.verticalAmplitude;
            this.posY = this.formationCenterY + verticalOffset;
            
            // Apply vertical boundaries for boss minions
            var minY = 30;
            var maxY = canvas.height * 0.7; // Keep boss minions in upper 70%
            if (this.posY < minY) this.posY = minY;
            if (this.posY > maxY) this.posY = maxY;
        } else {
            // Regular enemy or boss - normal downward movement with boundaries
            this.posY += this.downSpeed * 0.6; // Noticeable downward drift
            
            // Apply vertical boundaries for regular enemies/bosses
            var minY = 20;
            var maxY = canvas.height * 0.75; // Absolute maximum at 75% of screen
            if (this.posY < minY) this.posY = minY;
            if (this.posY > maxY) this.posY = maxY;
        }
        
        this.phaseTick++;
        if (this.phaseTick > this.phase) {
            this.phaseTick = 0;
            this.phase = 40 + rand(120);
            if (Math.random() < 0.45) { this.hDir *= -1; }
            this.hSpeed = (this.isBoss ? 0.3 : 0.35) + (level * 0.03) + Math.random() * 0.4;
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
            this.shootDelay = 3000 + rand(2000);
        }

        if (Date.now() - this.spawnTime < this.shootDelay) {
            return;
        }

        this.shotCooldown--;

        if (this.shotCooldown <= 0) {
            var baseCooldown = typeof this.customShootInterval === "number"
                ? this.customShootInterval
                : ((this.isBoss ? 90 : 180) + rand(200));

            // Boss minions shoot almost always - very high probability
            var shootProbability = this.isBoss ? 0.08 : 0.85; // 85% for minions, 8% for boss
            if (Math.random() < shootProbability) {
                enemyShots.push({
                    x: this.posX + this.w / 2 - 4,
                    y: this.posY + this.h,
                    speed: this.isBoss ? (5.0 + level * 0.3) : (3.5 + level * 0.2), // Faster for minions
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
    
    // Boss movement - enhanced with full directional movement
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
        
        // Enhanced vertical movement with more range
        var baseY = 100; // Base position
        var verticalAmplitude = 60; // Larger vertical range
        var verticalSpeed = this.currentAbility === "speed" ? 0.001 : 0.0005; // Faster vertical movement during speed boost
        var verticalMovement = Math.sin(Date.now() * verticalSpeed) * verticalAmplitude;
        
        // Add random vertical movement changes
        if (!this.verticalDirectionChangeTime || Date.now() - this.verticalDirectionChangeTime > 3000) {
            this.verticalTarget = baseY + (Math.random() - 0.5) * 100; // Random target within range
            this.verticalDirectionChangeTime = Date.now();
        }
        
        // Smooth movement to vertical target
        var verticalDiff = this.verticalTarget - this.posY;
        this.posY += verticalDiff * 0.02 + verticalMovement;
        
        // Ensure boss stays on screen vertically
        if (this.posY < 20) this.posY = 20;
        if (this.posY > 250) this.posY = 250;
        
        // Enhanced dodge behavior
        this.bossDodgeCooldown--;
        if (this.bossDodgeCooldown <= 0 && Math.random() < 0.01) { // Increased dodge chance
            this.bossDodgeCooldown = 90; // Shorter cooldown
            var dodgeDirection = (Math.random() < 0.5) ? -1 : 1;
            var dodgeAmount = this.currentAbility === "speed" ? 50 : 30; // Larger dodge during speed boost
            this.posX += dodgeDirection * dodgeAmount;
            
            // Occasionally dodge vertically too
            if (Math.random() < 0.3) {
                var verticalDodge = (Math.random() < 0.5) ? -1 : 1;
                this.posY += verticalDodge * 20;
            }
        }
    };
    
    // Boss abilities - enhanced with random triggers and varied timing
    Enemy.prototype.updateBossAbilities = function() {
        this.bossAbilityCooldown--;
        
        // Check if current ability should end
        if (this.currentAbility && this.abilityStartTime > 0) {
            var elapsed = Date.now() - this.abilityStartTime;
            if (elapsed >= this.abilityDuration) {
                this.deactivateCurrentAbility();
                // Random cooldown after ability ends
                this.bossAbilityCooldown = 120 + Math.random() * 180; // 2-5 seconds random cooldown
            }
        }
        
        // Trigger new abilities based on health percentage and random factors
        var healthPercentage = bossHP / bossMaxHP;
        
        if (this.bossAbilityCooldown <= 0 && !this.currentAbility) {
            var randomFactor = Math.random();
            var abilityChance = 0.4 + (1 - healthPercentage) * 0.3; // Higher chance at lower health
            
            if (randomFactor < abilityChance) {
                // Random ability selection based on health and randomness
                var abilityRoll = Math.random();
                
                if (healthPercentage < 0.3) {
                    // Low health - any ability
                    if (abilityRoll < 0.4) {
                        this.activateTripleShot();
                    } else if (abilityRoll < 0.7) {
                        this.activateShield();
                    } else {
                        this.activateSpeedBoost();
                    }
                } else if (healthPercentage < 0.6) {
                    // Medium health - triple shot or shield
                    if (abilityRoll < 0.6) {
                        this.activateTripleShot();
                    } else {
                        this.activateShield();
                    }
                } else {
                    // High health - mostly triple shot
                    this.activateTripleShot();
                }
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
            // Triple shot ability - much faster
            if (this.currentAbility === "triple") {
                for (var i = -1; i <= 1; i++) {
                    enemyShots.push({
                        x: this.posX + this.w / 2 - 4 + (i * 20),
                        y: this.posY + this.h,
                        speed: 6.0 + level * 0.4, // Even faster for triple shot
                        img: enemyShotImage
                    });
                }
            } else {
                // Normal shot - much faster than regular enemies
                enemyShots.push({
                    x: this.posX + this.w / 2 - 4,
                    y: this.posY + this.h,
                    speed: 5.0 + level * 0.3, // Much faster than regular enemies (3.0-6.0)
                    img: enemyShotImage
                });
            }
            
            this.shotCooldown = this.customShootInterval || 140;
        }
    };
    
    // Boss ability: Triple Shot - extended duration
    Enemy.prototype.activateTripleShot = function() {
        this.currentAbility = "triple";
        this.abilityStartTime = Date.now();
        this.abilityDuration = 6000; // 6 seconds - double the duration
        this.bossAbilityCooldown = 240; // 4 second cooldown
    };
    
    // Boss ability: Shield
    Enemy.prototype.activateShield = function() {
        this.currentAbility = "shield";
        this.abilityStartTime = Date.now();
        this.abilityDuration = 4000; // 4 seconds
        this.shielded = true;
        this.bossAbilityCooldown = 240; // 4 second cooldown
    };
    
    // Boss ability: Speed Boost - enhanced
    Enemy.prototype.activateSpeedBoost = function() {
        this.currentAbility = "speed";
        this.abilityStartTime = Date.now();
        this.abilityDuration = 4000; // 4 seconds
        this.hSpeed = this.originalSpeed * 2.0; // 2x speed boost - much more noticeable
        this.bossAbilityCooldown = 180; // 3 second cooldown
        
        // Visual feedback - change shooting pattern during speed boost
        this.shotCooldown = Math.max(30, this.shotCooldown * 0.5); // Shoot twice as fast during speed boost
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
                    enemySpeed: 0.5,
                    shootInterval: 120,
                    formationPattern: "v-shape",
                    boss: true
                });
            } else {
                // Regular waves with formation system
                waves.push({
                    enemyCount: 5 + ((i - 1) * 2), // Progressive enemy count
                    enemySpeed: 0.2 + (i * 0.05), // Progressive speed
                    shootInterval: Math.max(120, 250 - (i * 20)), // Progressive shooting
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
        powerUpDrops.length = 0;
        heartDrops.length = 0;
        bgScrollY = 0;
        var cfg = getCurrentWaveConfig();
        killsTargetInLevel = cfg ? cfg.enemyCount : 1;
        waveState = "announce";
        waveAnnouncementStart = Date.now();
        activeFormationController = null;
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
            e.downSpeed = cfg.enemySpeed * 0.5;
            e.hSpeed = 0.3 + (cfg.enemySpeed * 0.3);
    
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
            boss.posY = 50; // Start in visible area, not too high
            boss.downSpeed = 0; // No automatic movement during intro
            boss.hSpeed = 1.5 + (currentWave * 0.05); // Good horizontal speed
            boss.customShootInterval = 50; // Almost instant shooting
            boss.shotCooldown = 50; // Start shooting immediately
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
                // Position secondary formations within the safe upper zone (respecting 60% boundary)
                var maxSafeY = (canvas.height * 0.6) - 100; // Stay well within the safe zone
                secondaryController.centerY = Math.min(50 + (formationIndex * 60), maxSafeY); // Stagger vertically within bounds
                secondaryController.oscillationAmount = 80 - (formationIndex * 20); // Smaller movement for secondary formations
                
                // Store secondary controller
                secondaryFormationControllers.push(secondaryController);
            }
        }
        
        // Add all enemies to game
        enemies = enemyList;
    }

    // Spawn minion wave during boss fight - enhanced system
    function spawnBossMinionWave() {
        if (!bossActive || !currentBoss) return;
        
        bossMinionWavesSpawned++;
        
        // Progressive difficulty - more minions as waves continue
        var baseMinionCount = 4 + Math.floor(bossMinionWavesSpawned / 2); // Increases every 2 waves
        var minionCount = Math.min(8, baseMinionCount); // Cap at 8 minions
        
        // Random pattern selection
        var patterns = ["grid", "v-shape", "line", "sine-wave"];
        var pattern = patterns[Math.floor(Math.random() * patterns.length)];
        
        // Progressive difficulty for minions
        var minionSpeed = 0.6 + (bossMinionWavesSpawned * 0.1) + (currentWave * 0.05);
        var minionShootInterval = Math.max(80, 150 - (bossMinionWavesSpawned * 10) - (currentWave * 5));
        
        // Create temporary wave config for minions
        var tempWave = {
            enemyCount: minionCount,
            enemySpeed: minionSpeed,
            shootInterval: minionShootInterval,
            formationPattern: pattern,
            boss: false
        };
        
        // Use existing formation system
        var count = tempWave.enemyCount;
        var enemyList = [];
        var maxEnemiesPerFormation = getMaxEnemiesPerFormation(tempWave.formationPattern);
        var numFormations = Math.ceil(count / maxEnemiesPerFormation);
        var enemiesPerFormation = Math.ceil(count / numFormations);
        
        // Create boss minions exactly like regular enemies
        for (var i = 0; i < count; i++) {
            var e = new Enemy(false);
            e.isInFormation = false; // Don't use formation system
            e.formationGroup = 0;
            
            // Position in formation pattern but with individual movement
            var rows = Math.ceil(Math.sqrt(count));
            var cols = Math.ceil(count / rows);
            var row = Math.floor(i / cols);
            var col = i % cols;
            var spacing = 60;
            
            // Center the formation
            var formationWidth = (cols - 1) * spacing;
            var formationHeight = (rows - 1) * spacing;
            var startX = (canvas.width - formationWidth) / 2;
            var startY = 120; // Start in visible area
            
            e.posX = startX + (col * spacing);
            e.posY = startY + (row * spacing);
            
            // Formation movement - up and down oscillation instead of going down
            e.downSpeed = 0; // No constant downward movement
            e.hSpeed = 2.0 + (tempWave.enemySpeed * 0.5); // Fast horizontal movement
            e.hDir = Math.random() < 0.5 ? -1 : 1;
            e.phase = 20 + rand(60); // Phase for oscillation
            e.phaseTick = 0;
            
            // Formation oscillation properties
            e.formationCenterY = 120 + (row * 60); // Center position for this row
            e.verticalAmplitude = 40; // How far up and down to move
            e.verticalSpeed = 0.05; // Speed of up/down oscillation
            e.verticalTime = Math.random() * Math.PI * 2; // Random starting phase
            
            // Shooting much faster and more frequent
            e.shootDelay = Math.max(200, tempWave.shootInterval * 0.5); // Half the delay
            e.lastShotTime = 0;
            e.shotCooldown = 300; // Start shooting quickly
            
            enemyList.push(e);
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

    // Spawn support boss when main boss reaches 75% HP
    function spawnSupportBoss() {
        if (supportBossSpawned || !currentBoss) return;
        
        supportBossSpawned = true;
        
        // Create support boss with same sprite/behavior
        var support = new Enemy(true);
        support.isSupportBoss = true; // Flag to prevent recursive spawning
        support.posX = 100; // Position on left side
        support.posY = 120; // Slightly lower than main boss
        support.downSpeed = 0;
        support.hSpeed = 1.0 + (currentWave * 0.04); // Slower than main boss (1.5)
        support.customShootInterval = 70; // Slower shooting (50 for main boss)
        support.shotCooldown = 70;
        support.isInFormation = false;
        support.canAttack = true; // Can attack immediately (no intro needed)
        
        // Set support boss HP to 25% of main boss max HP
        supportBossMaxHP = Math.floor(bossMaxHP * 0.25);
        supportBossHP = supportBossMaxHP;
        
        // Boss ability variables for support boss
        support.bossDirection = 1;
        support.bossDodgeCooldown = 0;
        support.bossAbilityCooldown = 120; // Longer cooldown for support boss
        support.currentAbility = null;
        support.abilityStartTime = 0;
        support.abilityDuration = 0;
        support.originalSpeed = support.hSpeed;
        
        // Add support boss to enemies array
        supportBoss = support;
        enemies.push(support);
        
        // Visual feedback - screen shake and warning
        startScreenShake(8, 500);
        console.log("Support boss spawned! HP:", supportBossHP, "/", supportBossMaxHP);
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
                // Check if support boss is dead and remove it
                if (supportBoss && (supportBoss.dead || supportBossHP <= 0)) {
                    supportBoss.dead = true;
                    supportBoss = null;
                    supportBossHP = 0;
                    // Support boss death is handled in enemy death logic (score/effects)
                }
                
                // Check if main boss is dead - level ends only when main boss dies
                if (currentBoss.dead || bossHP <= 0) {
                    bossActive = false;
                    currentBoss = null;
                    
                    // Track boss defeat for achievements
                    if (achievementManager) {
                        achievementManager.trackBossKilled();
                    }
                    
                    waveState = "completed";
                    finishGame(true, player.score);
                    return;
                }
                
                // Spawn minion waves continuously when only bosses remain
                var bossCount = 1; // Always count main boss
                if (supportBoss && !supportBoss.dead) bossCount++;
                
                if (enemies.length === bossCount) {
                    // Only boss(es) remain, spawn next wave continuously
                    if (bossActive && currentBoss) {
                        // Add delay between waves to prevent overwhelming
                        // Longer delay when support boss is alive to reduce projectile spam
                        var minionDelay = (supportBoss && !supportBoss.dead) ? 4000 : 3000;
                        if (!lastMinionWaveTime || Date.now() - lastMinionWaveTime > minionDelay) {
                            spawnBossMinionWave();
                            lastMinionWaveTime = Date.now();
                        }
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
                    // Track wave completion for achievements
                    if (achievementManager) {
                        achievementManager.trackWaveCompleted();
                    }
                    
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
        
        // Initialize achievement tracking for new session
        if (achievementManager) {
            achievementManager.initSession();
        }
        
        // Reset formation controllers to prevent freezing
        activeFormationController = null;
        secondaryFormationControllers = [];
        
        // Reset support boss state
        supportBossSpawned = false;
        supportBoss = null;
        supportBossHP = 0;
        supportBossMaxHP = 0;
        boss75PercentTriggered = false;
        
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
        var keepLevel = level || 1;
        player = new Player();
        player.score = keepScore;
        player.life = 3;
        gameOver = false;
        overlayShown = false;
        paused = false;
        fireLock = false;
        nextPlayerShot = 0;
        keyPressed = {};
        
        // Clear all game arrays to prevent duplicates and memory leaks
        enemies.length = 0;
        enemyShots.length = 0;
        playerShots.length = 0;
        heartDrops.length = 0;
        powerUpDrops.length = 0;
        deathEffects.length = 0;
        floatingTexts.length = 0;
        
        // Reset boss state completely
        bossActive = false;
        currentBoss = null;
        bossHP = 0;
        bossMaxHP = 0;
        lastMinionWaveTime = 0;
        
        // Reset support boss state
        supportBossSpawned = false;
        supportBoss = null;
        supportBossHP = 0;
        supportBossMaxHP = 0;
        boss75PercentTriggered = false;
        
        // Reset formation controllers to prevent freezing
        activeFormationController = null;
        secondaryFormationControllers = [];
        
        // Reset combo counter
        combo.count = 0;
        combo.timer = 0;
        combo.multiplier = 1;
        
        // Reset active power-ups
        activePowerUps = { triple: 0, shield: 0, speed: 0 };
        
        // Reset other game state variables
        killsInLevel = 0;
        enemiesKilled = 0;
        level = keepLevel;
        bgScrollY = 0;
        
        // Reset screen shake
        screenShake.active = false;
        screenShake.magnitude = 0;
        screenShake.duration = 0;
        screenShake.startTime = 0;
        
        // Ensure game state is properly set
        sessionActive = true;
        gameState = GAME_STATE.PLAYING;
        
        // Use beginWave to properly reset wave state and spawn enemies
        beginWave(level);
        hideEndOverlay();
    }

    function backToStartMenu() {
        paused = false;
        sessionActive = false;
        creditsActive = false;
        gameOver = false;
        overlayShown = false;
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
        // Hide name input — it's redundant since name is set from the left panel
        if (input) {
            input.classList.add("hidden");
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
        var linkLogros = document.getElementById("btn-logros");
        var closeSpec = document.getElementById("modal-esp-cerrar");
        var closeTut = document.getElementById("modal-tutorial-cerrar");
        var closeLogros = document.getElementById("modal-logros-cerrar");

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
        var btnMenuPrincipal = document.getElementById("btn-menu-principal");
        if (btnMenuPrincipal) {
            btnMenuPrincipal.addEventListener("click", function () {
                hideEndOverlay();
                // Return to main menu
                sessionActive = false;
                gameOver = false;
                overlayShown = false;
                if (startScreen) {
                    startScreen.activate();
                }
                AudioManager.playMenuMusic();
            });
        }
        if (btnSaveName && inputName) { btnSaveName.addEventListener("click", function () { setPlayerName(inputName.value); }); }
        if (btnChangeName && inputName) { btnChangeName.addEventListener("click", function () { inputName.focus(); inputName.select(); }); }
        if (linkSpec) { linkSpec.addEventListener("click", function () { showModal("modal-especificaciones"); }); }
        if (linkTut) { linkTut.addEventListener("click", function (e) { e.preventDefault(); showModal("modal-tutorial"); }); }
        if (linkLogros) { linkLogros.addEventListener("click", function () { showAchievementsModal(); }); }
        if (closeSpec) { closeSpec.addEventListener("click", function () { hideModal("modal-especificaciones"); }); }
        if (closeTut) { closeTut.addEventListener("click", function () { hideModal("modal-tutorial"); }); }
        if (closeLogros) { closeLogros.addEventListener("click", function () { hideModal("modal-logros"); }); }

        syncNameUI();
    }

    function showAchievementsModal() {
        if (!achievementManager) return;
        
        var achievementsContainer = document.getElementById("logros-contenido");
        var allAchievements = achievementManager.getAllAchievements();
        
        var html = "<div class='achievements-grid'>";
        
        for (var i = 0; i < allAchievements.length; i++) {
            var ach = allAchievements[i];
            var unlockedClass = ach.unlocked ? "achievement-unlocked" : "achievement-locked";
            var statusText = ach.unlocked ? "DESBLOQUEADO" : "BLOQUEADO";
            var statusColor = ach.unlocked ? "#00FF88" : "#666666";
            
            html += "<div class='achievement-item " + unlockedClass + "'>";
            html += "<div class='achievement-icon'>" + ach.achievement.icon + "</div>";
            html += "<div class='achievement-info'>";
            html += "<div class='achievement-title'>" + ach.achievement.title + "</div>";
            html += "<div class='achievement-description'>" + ach.achievement.description + "</div>";
            html += "<div class='achievement-status' style='color: " + statusColor + "'>" + statusText + "</div>";
            html += "</div>";
            html += "</div>";
        }
        
        html += "</div>";
        html += "<div class='achievements-stats'>";
        html += "<div class='stat-item'><span class='stat-label'>Progreso:</span> <span class='stat-value'>" + allAchievements.filter(function(a) { return a.unlocked; }).length + "/" + allAchievements.length + "</span></div>";
        html += "</div>";
        
        achievementsContainer.innerHTML = html;
        showModal("modal-logros");
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

        // Pause button indicator at top-right corner
        bufferctx.shadowBlur = 0;
        bufferctx.fillStyle = "rgba(0,0,0,0.5)";
        bufferctx.fillRect(canvas.width - 110, 8, 100, 28);
        bufferctx.strokeStyle = "#00ff00";
        bufferctx.lineWidth = 1;
        bufferctx.strokeRect(canvas.width - 110, 8, 100, 28);
        bufferctx.fillStyle = "#00ff00";
        bufferctx.font = "9px 'Press Start 2P', monospace";
        bufferctx.textAlign = "center";
        bufferctx.textBaseline = "middle";
        bufferctx.fillText("II PAUSA", canvas.width - 60, 22);
        bufferctx.textBaseline = "top";

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
        var panelH = 340;
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
            var oy = y + 120 + i * 52;
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
        c.fillText("ESC/P: CONTINUAR | ENTER: ACEPTAR", w / 2, y + panelH - 28);
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
        playerShots.push({ x: player.posX + pw / 2 - 28, y: player.posY - 20, speed: 7.5, vx: vx || 0, img: playerShotImage });
        
        // Track shot fired for achievements
        if (achievementManager) {
            achievementManager.trackShotFired();
        }
        
        // Play player shoot sound
        AudioManager.playPlayerShoot();
    }

    function playerAction() {
        var pw = spriteW(player.image, player.w);
        var ph = spriteH(player.image, player.h);
        var moveSpeed = isPowerUpActive("speed") ? (player.speed * 2) : player.speed;
        
        // Check if player is moving
        player.isMoving = false;
        
        // Horizontal movement
        if (keyPressed.left && player.posX > 5) { 
            player.posX -= moveSpeed; 
            player.isMoving = true;
        }
        if (keyPressed.right && player.posX < (canvas.width - pw - 5)) { 
            player.posX += moveSpeed; 
            player.isMoving = true;
        }
        
        // Vertical movement with limits (approximately one body height up/down)
        var minY = canvas.height - player.h - 10 - player.h; // One body height up from default position
        var maxY = canvas.height - player.h - 10; // Default position (bottom)
        
        if (keyPressed.up && player.posY > minY) { 
            player.posY -= moveSpeed * 0.7; // Slightly slower vertical movement
            player.isMoving = true;
        }
        if (keyPressed.down && player.posY < maxY) { 
            player.posY += moveSpeed * 0.7; // Slightly slower vertical movement
            player.isMoving = true;
        }
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
            heartDrops.push({ x: targetX, y: -24, speed: 1.2 + Math.random() * 0.6, w: 22, h: 22 });
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
            speed: 1.2
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
        var playerHitbox = getPlayerHitbox();
        for (var i = powerUpDrops.length - 1; i >= 0; i--) {
            var p = powerUpDrops[i];
            p.y += p.speed;
            drawPowerUpDrop(p);
            var hit = checkAABBCollision({x: p.x, y: p.y, w: p.w, h: p.h}, playerHitbox);
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
        var playerHitbox = getPlayerHitbox();
        for (var i = heartDrops.length - 1; i >= 0; i--) {
            var h = heartDrops[i];
            h.y += h.speed;
            bufferctx.drawImage(heartImage, h.x, h.y, h.w, h.h);
            var hit = checkAABBCollision({x: h.x, y: h.y, w: h.w, h: h.h}, playerHitbox);
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
        var playerHitbox = getPlayerHitbox();
        var now = Date.now();
        for (var i = enemies.length - 1; i >= 0; i--) {
            var e = enemies[i];
            e.update();
            // Draw enemy with hit flash effect
            if (e.hitFlashUntil && now < e.hitFlashUntil) {
                // Save context and apply red tint overlay
                bufferctx.drawImage(e.image, e.posX, e.posY);
                bufferctx.save();
                bufferctx.globalCompositeOperation = "source-atop";
                var flashAlpha = 0.6 + Math.sin((now - (e.hitFlashUntil - 200)) * 0.05) * 0.3;
                bufferctx.fillStyle = "rgba(255, 0, 0, " + Math.max(0.3, flashAlpha).toFixed(2) + ")";
                bufferctx.fillRect(e.posX, e.posY, e.w, e.h);
                bufferctx.restore();
                // Also draw a red border glow around the enemy
                bufferctx.save();
                bufferctx.strokeStyle = "#FF0000";
                bufferctx.lineWidth = 2;
                bufferctx.shadowColor = "#FF0000";
                bufferctx.shadowBlur = 12;
                bufferctx.strokeRect(e.posX - 2, e.posY - 2, e.w + 4, e.h + 4);
                bufferctx.restore();
            } else {
                bufferctx.drawImage(e.image, e.posX, e.posY);
            }
            if (e.posY > canvas.height + 30) {
                enemies.splice(i, 1);
                continue;
            }
            var enemyHitbox = getEnemyHitbox(e);
            var bodyHit = checkAABBCollision(enemyHitbox, playerHitbox);
            if (bodyHit) { hurtPlayer(); return; }
        }
    }

    function updateShots() {
        var playerHitbox = getPlayerHitbox();
        for (var i = playerShots.length - 1; i >= 0; i--) {
            var s = playerShots[i];
            s.y -= s.speed;
            s.x += s.vx || 0;
            if (s.y < -10 || s.x < -12 || s.x > canvas.width + 12) { playerShots.splice(i, 1); continue; }
            var hitEnemy = false;
            for (var j = enemies.length - 1; j >= 0; j--) {
                var e = enemies[j];
                var enemyHitbox = getEnemyHitbox(e);
                if (checkAABBCollision({x: s.x, y: s.y, w: s.w || 8, h: s.h || 8}, enemyHitbox)) {
                    e.life -= 1;
                    hitEnemy = true;
                    // Trigger hit flash on the enemy
                    e.hitFlashUntil = Date.now() + 200;
                    // Play hit sound for audio feedback
                    AudioManager.playHitEnemy();
                    
                    // Track shot hit for achievements
                    if (achievementManager) {
                        achievementManager.trackShotHit();
                    }
                    if (e.isBoss && bossActive && e === currentBoss) {
                        // Boss damage system - reduce HP instead of life
                        if (!e.shielded) {
                            bossHP -= 1;
                            console.log("Boss hit! HP:", bossHP, "/", bossMaxHP);
                            
                            // Check if boss reached 75% HP for the first time - spawn support boss
                            if (!boss75PercentTriggered && bossHP <= Math.floor(bossMaxHP * 0.75)) {
                                boss75PercentTriggered = true;
                                spawnSupportBoss();
                            }
                            
                            // Strong screen shake for boss hit
                            startScreenShake(12, 400); // Strong shake for 400ms
                        } else {
                            console.log("Boss blocked by shield!");
                            
                            // Light screen shake for shield block
                            startScreenShake(4, 200); // Light shake for 200ms
                        }
                    } else if (e.isBoss && bossActive && e === supportBoss) {
                        // Support boss damage system
                        if (!e.shielded) {
                            supportBossHP -= 1;
                            console.log("Support boss hit! HP:", supportBossHP, "/", supportBossMaxHP);
                            
                            // Check if support boss is dead
                            if (supportBossHP <= 0) {
                                e.dead = true;
                                e.life = 0; // Ensure life is also 0 for consistency
                                
                                // Play explosion sound for support boss death
                                AudioManager.playExplosionBig();
                                
                                // Update combo and calculate score with multiplier
                                increaseCombo();
                                var multiplier = getComboMultiplier();
                                var scoreGained = e.pointsToKill * multiplier;
                                player.score += scoreGained;
                                
                                enemiesKilled++;
                                killsInLevel++;
                                deathEffects.push({ x: e.posX, y: e.posY, w: e.w, h: e.h, ttl: 18, img: e.killedImage });
                                
                                // Track enemy kill for achievements
                                if (achievementManager) {
                                    achievementManager.trackEnemyKill();
                                }
                                
                                // Drop rewards
                                maybeDropHeart(e.posX + e.w / 2 - 10, e.posY + e.h / 2 - 10);
                                maybeDropPowerUp(e.posX + e.w / 2 - 10, e.posY + e.h / 2 - 10);
                                
                                // Spawn floating text for score
                                var scoreText = "+" + scoreGained;
                                if (multiplier > 1) {
                                    scoreText += " (x" + multiplier + ")";
                                    spawnFloatingText(e.posX + e.w / 2, e.posY, scoreText, "#FFD700");
                                } else {
                                    spawnFloatingText(e.posX + e.w / 2, e.posY, scoreText, "#FFFFFF");
                                }
                                
                                // Strong screen shake for support boss death
                                startScreenShake(10, 300);
                                
                                // Remove support boss from enemies array
                                enemies.splice(j, 1);
                                supportBoss = null;
                                
                                hitEnemy = true;
                                break; // Break the enemy loop since we removed this enemy
                            } else {
                                // Light screen shake for support boss hit
                                startScreenShake(6, 250);
                            }
                        } else {
                            // Light screen shake for shield block
                            startScreenShake(3, 150);
                        }
                    } else if (e.life <= 0) {
                        // Regular enemy death
                        e.dead = true;
                        
                        // Play explosion sound for kill
                        AudioManager.playExplosionSmall();
                        
                        // Update combo and calculate score with multiplier
                        increaseCombo();
                        var multiplier = getComboMultiplier();
                        var scoreGained = e.pointsToKill * multiplier;
                        player.score += scoreGained;
                        
                        enemiesKilled++;
                        killsInLevel++;
                        deathEffects.push({ x: e.posX, y: e.posY, w: e.w, h: e.h, ttl: 18, img: e.killedImage });
                        
                        // Track enemy kill for achievements
                        if (achievementManager) {
                            achievementManager.trackEnemyKill();
                        }
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
            // Draw enemy bullet with bright glow effect (red/orange) for visibility
            bufferctx.save();
            // Outer glow
            bufferctx.shadowColor = "#FF3300";
            bufferctx.shadowBlur = 14;
            bufferctx.fillStyle = "#FF4400";
            bufferctx.beginPath();
            bufferctx.arc(es.x + 4, es.y + 4, 5, 0, Math.PI * 2);
            bufferctx.fill();
            // Inner bright core
            bufferctx.shadowBlur = 0;
            bufferctx.fillStyle = "#FFDD00";
            bufferctx.beginPath();
            bufferctx.arc(es.x + 4, es.y + 4, 2.5, 0, Math.PI * 2);
            bufferctx.fill();
            bufferctx.restore();
            if (checkAABBCollision({x: es.x, y: es.y, w: 8, h: 8}, playerHitbox)) {
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
        
        // Track damage taken for achievements
        if (achievementManager) {
            achievementManager.trackDamageTaken();
            achievementManager.resetCombo();
        }
        
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
        
        // Handle credits state
        if (creditsActive) {
            updateCredits();
            drawCredits();
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
        // Update player animation
        updatePlayerAnimation();
        
        // Draw player with dynamic animations
        var drawX = player.renderX || player.posX;
        var drawY = player.renderY || player.posY;
        var drawW = player.w * player.pulseScale;
        var drawH = player.h * player.pulseScale;
        var offsetX = (player.w - drawW) / 2;
        var offsetY = (player.h - drawH) / 2;
        
        bufferctx.save();
        
        // Apply shoot animation effect
        if (player.shootAnimation > 0) {
            bufferctx.globalAlpha = 0.7 + player.shootAnimation * 0.3;
        }
        
        // Draw scaled player
        bufferctx.drawImage(player.image, drawX + offsetX, drawY + offsetY, drawW, drawH);
        
        bufferctx.restore();
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
        
        // Update formation controllers if active and not in boss battle
        if (activeFormationController && activeFormationController.isActive && !bossActive) {
            activeFormationController.update();
        }
        
        // Update secondary formation controllers
        if (secondaryFormationControllers && secondaryFormationControllers.length > 0 && !bossActive) {
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
            var ty = player.posY + player.h + 4;
            bufferctx.strokeStyle = "#70e7ff";
            bufferctx.lineWidth = 1;
            bufferctx.strokeRect(tx, ty, tw, 5);
            bufferctx.fillStyle = "#70e7ff";
            bufferctx.fillRect(tx + 1, ty + 1, Math.floor((tw - 2) * ratio), 3);
        }
        advanceLevelIfNeeded();
        drawWaveAnnouncement();
        drawHud();
        
        // Update achievement popups
        if (achievementManager) {
            achievementManager.updatePopups();
        }
        
        draw();
    }

    function updatePlayerAnimation() {
        if (!player || player.dead) return;
        
        // Update breathing animation (gentle up-down movement)
        player.breathTime += player.breathSpeed;
        player.breathOffset = Math.sin(player.breathTime) * 2; // 2 pixels breathing
        
        // Update pulse animation (subtle scale change)
        player.pulseTime += player.pulseSpeed;
        player.pulseScale = 1 + Math.sin(player.pulseTime) * 0.02; // 2% scale variation
        
        // Update shoot animation decay
        if (player.shootAnimation > 0) {
            player.shootAnimation -= player.shootAnimationSpeed;
        }
        
        // Update frame-based animation
        var now = Date.now();
        if (player.isMoving && now - player.frameTimer > player.frameInterval) {
            player.frameTimer = now;
            player.currentFrame = (player.currentFrame + 1) % player.frames.length;
            player.image = player.frames[player.currentFrame];
        } else if (!player.isMoving) {
            // Reset to first frame when idle
            player.currentFrame = 0;
            player.image = player.frames[0];
        }
        
        // Apply animations to render position
        player.renderX = player.posX;
        player.renderY = player.baseY + player.breathOffset;
    }

    function draw() {
        // Apply screen shake to final render
        var shakeOffset = applyScreenShake(0, 0);
        ctx.drawImage(buffer, shakeOffset.x, shakeOffset.y);
        
        // Draw achievement popups on top
        if (achievementManager) {
            achievementManager.drawPopups(ctx);
        }
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
        var currentName = getPlayerName();
        // Only keep the highest score per player name
        var existingIndex = -1;
        for (var i = 0; i < list.length; i++) {
            if (list[i].name === currentName) {
                existingIndex = i;
                break;
            }
        }
        if (existingIndex >= 0) {
            // Player already has a record — only update if new score is higher
            if (finalScore > parseInt(list[existingIndex].score, 10)) {
                list[existingIndex].score = finalScore;
                list[existingIndex].date = formatDateTime();
                list[existingIndex].enemiesKilled = enemiesKilled;
                list[existingIndex].level = level;
            }
        } else {
            list.push({ name: currentName, score: finalScore, date: formatDateTime(), enemiesKilled: enemiesKilled, level: level });
        }
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
            // After showing victory overlay, transition to credits
            setTimeout(function() {
                if (win && !creditsActive) {
                    hideEndOverlay();
                    initCredits();
                }
            }, 3000);
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
        // Skip credits with ESC or ENTER
        if (creditsActive && (key === 27 || key === 13)) {
            e.preventDefault();
            skipCredits();
            return;
        }
        if (sessionActive && !gameOver && (key === 80 || key === 27)) {
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
                if (pauseSelection === 0) { paused = false; keyPressed = {}; }
                else if (pauseSelection === 1) { restartCurrentLevel(); }
                else { backToStartMenu(); }
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
        
        // Initialize Achievement Manager
        achievementManager = new AchievementManager();
        
        startScreen = new StartScreen(canvas, bufferctx, startGame);
        bindUI();
        showBestScores();
        canvas.addEventListener("click", function (ev) {
            if (!startScreen) { return; }
            var rect = canvas.getBoundingClientRect();
            var px = ev.clientX - rect.left;
            var py = ev.clientY - rect.top;
            // Click on pause button in HUD
            if (sessionActive && !gameOver && !paused) {
                var scaleX = canvas.width / rect.width;
                var scaleY = canvas.height / rect.height;
                var cx = px * scaleX;
                var cy = py * scaleY;
                if (cx >= canvas.width - 110 && cx <= canvas.width - 10 && cy >= 8 && cy <= 36) {
                    paused = true;
                    keyPressed = {};
                    return;
                }
            }
            if (paused) {
                var panelW = 520;
                var panelH = 340;
                var x = (canvas.width - panelW) / 2;
                var y = (canvas.height - panelH) / 2;
                var firstTop = y + 102;
                var boxH = 42;
                var boxW = panelW - 124;
                for (var i = 0; i < pauseOptions.length; i++) {
                    var by = firstTop + i * 58;
                    if (px >= x + 62 && px <= x + 62 + boxW && py >= by && py <= by + boxH) {
                        pauseSelection = i;
                        if (i === 0) { paused = false; keyPressed = {}; }
                        else if (i === 1) { restartCurrentLevel(); }
                        else { backToStartMenu(); }
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
