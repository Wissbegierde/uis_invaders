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
    var BG_ASSET_H = 764;
    var lastScoreValue = 0;
    var scoreJitterUntil = 0;
    var levelStatusUntil = 0;
    var previousLifeValue = 3;
    var lifeGainAnimUntil = 0;
    var lifeGainIndex = -1;
    var enemyImages = [], bossImages = [], enemyKilledImage, bossKilledImage;

    var player = null;
    var enemies = [];
    var playerShots = [];
    var enemyShots = [];
    var heartDrops = [];
    var deathEffects = [];

    var keyPressed = {};
    var keyMap = { left: 37, right: 39, fire: 32 };
    var fireLock = false;
    var nextPlayerShot = 0;
    var playerShotDelay = 380;

    var level = 1;
    var enemiesKilled = 0;
    var killsInLevel = 0;
    var killsTargetInLevel = 8;
    var levelMaxEnemiesAlive = 1;
    var sessionActive = false;
    var gameOver = false;
    var overlayShown = false;
    var startScreen = null;
    var gameState = GAME_STATE.SPLASH;
    var isFirstStart = true;
    var playerName = "jugador";
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
    };

    StartScreen.prototype.activateSelection = function () {
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
        this.shotCooldown = 40 + rand(140);
    }

    Enemy.prototype.update = function () {
        if (this.dead) { return; }
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
        this.shotCooldown--;
        if (this.shotCooldown <= 0) {
            this.shotCooldown = (this.isBoss ? 28 : 55) + rand(120) - Math.min(level * 2, 20);
            enemyShots.push({ x: this.posX + this.w / 2 - 4, y: this.posY + this.h, speed: 3.2 + level * 0.1, img: enemyShotImage });
        }
    };

    function isBossLevel() { return level % 3 === 0; }

    function configLevel() {
        killsInLevel = 0;
        enemies.length = 0;
        enemyShots.length = 0;
        playerShots.length = 0;
        heartDrops.length = 0;
        killsTargetInLevel = isBossLevel() ? 1 : (8 + level * 2);
        levelMaxEnemiesAlive = isBossLevel() ? 1 : Math.min(3, 1 + Math.floor(level / 2));
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
        configLevel();
        sessionActive = true;
        gameState = GAME_STATE.PLAYING;
        hideEndOverlay();
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
                sessionActive = false;
                hideEndOverlay();
                if (startScreen) { startScreen.activate(); }
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
        var scale = canvas.width / BG_ASSET_W;
        var drawH = BG_ASSET_H * scale;
        var yOffset = (bgScrollY / BG_ASSET_H) * drawH;
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
        bgScrollY += 0.5;
        if (bgScrollY >= BG_ASSET_H) { bgScrollY = 0; }

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

        // PROGRESS segmented bar
        var barX = x;
        var barY = y + rowGap * 4 + 1;
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
        bufferctx.restore();
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

    function playerAction() {
        var pw = spriteW(player.image, player.w);
        if (keyPressed.left && player.posX > 5) { player.posX -= player.speed; }
        if (keyPressed.right && player.posX < (canvas.width - pw - 5)) { player.posX += player.speed; }
        if (keyPressed.fire && !fireLock) {
            var now = Date.now();
            if (now >= nextPlayerShot) {
                nextPlayerShot = now + playerShotDelay;
                playerShots.push({ x: player.posX + pw / 2 - 4, y: player.posY, speed: 7.5, img: playerShotImage });
                fireLock = true;
            }
        }
    }

    function spawnEnemiesIfNeeded() {
        if (killsInLevel >= killsTargetInLevel) { return; }
        while (enemies.length < levelMaxEnemiesAlive && (killsInLevel + enemies.length) < killsTargetInLevel) {
            enemies.push(new Enemy(isBossLevel()));
        }
    }

    function maybeDropHeart(x, y) {
        if (Math.random() < 0.18) {
            var targetX = Math.max(8, Math.min(canvas.width - 30, x));
            heartDrops.push({ x: targetX, y: -24, speed: 2.1 + Math.random() * 1.1, w: 22, h: 22 });
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
                if (player.life < MAX_LIVES) { player.life += 1; }
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
            if (s.y < -10) { playerShots.splice(i, 1); continue; }
            var hitEnemy = false;
            for (var j = enemies.length - 1; j >= 0; j--) {
                var e = enemies[j];
                if (s.x >= e.posX && s.x <= e.posX + e.w && s.y >= e.posY && s.y <= e.posY + e.h) {
                    e.life -= 1;
                    hitEnemy = true;
                    if (e.life <= 0) {
                        e.dead = true;
                        player.score += e.pointsToKill;
                        enemiesKilled++;
                        killsInLevel++;
                        deathEffects.push({ x: e.posX, y: e.posY, w: e.w, h: e.h, ttl: 18, img: e.killedImage });
                        maybeDropHeart(e.posX + e.w / 2 - 10, e.posY + e.h / 2 - 10);
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
        if (killsInLevel >= killsTargetInLevel && enemies.length === 0) {
            levelStatusUntil = Date.now() + 1400;
            level++;
            configLevel();
        }
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
        if (gameOver) { draw(); return; }
        spawnEnemiesIfNeeded();
        playerAction();
        bufferctx.drawImage(player.image, player.posX, player.posY);
        updateEnemies();
        updateShots();
        drawDeathEffects();
        updateHearts();
        advanceLevelIfNeeded();
        drawHud();
        draw();
    }

    function draw() { ctx.drawImage(buffer, 0, 0); }

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
        add("Nombre", "cabecera"); add("Puntos", "cabecera"); add("Fecha", "cabecera");
        var top = readScoreRecords();
        for (var i = 0; i < top.length; i++) {
            var cls = i === 0 ? "negrita" : "";
            add(top[i].name || "—", cls);
            add(String(top[i].score), cls);
            add(top[i].date || "", cls);
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
    }

    function keyDown(e) {
        var key = window.event ? e.keyCode : e.which;
        if (startScreen && startScreen.handleKeyDown(key)) {
            e.preventDefault();
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
        startScreen = new StartScreen(canvas, bufferctx, startGame);
        bindUI();
        showBestScores();
        canvas.addEventListener("click", function (ev) {
            if (!startScreen) { return; }
            var rect = canvas.getBoundingClientRect();
            var px = ev.clientX - rect.left;
            var py = ev.clientY - rect.top;
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
