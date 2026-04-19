window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) { window.setTimeout(callback, 1000 / 60); };
})();

var game = (function () {
    var STORAGE_SCORES = "invaders_high_scores_v2";
    var STORAGE_NAME = "invaders_player_name";
    var MAX_LIVES = 5;

    var canvas, ctx, buffer, bufferctx;
    var bgMain, bgBoss, playerShotImage, enemyShotImage, playerImage, playerKilledImage, heartImage;
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
        localStorage.setItem(STORAGE_NAME, t);
        syncNameUI();
    }

    function syncNameUI() {
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
    }

    function spriteW(img, fallback) { return (img && (img.width || img.naturalWidth)) || fallback; }
    function spriteH(img, fallback) { return (img && (img.height || img.naturalHeight)) || fallback; }
    function rand(max) { return Math.floor(Math.random() * max); }

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
        hideEndOverlay();
    }

    function showStartOverlay() {
        showEndOverlay("UIS Invaders", "Introduce tu nombre y pulsa jugar para comenzar.", "");
        var input = document.getElementById("nombre-overlay");
        var btnPlay = document.getElementById("btn-jugar-overlay");
        var btnRestart = document.getElementById("btn-volver-jugar");
        if (btnPlay) { btnPlay.classList.remove("hidden"); }
        if (btnRestart) { btnRestart.classList.add("hidden"); }
        if (input) {
            input.classList.remove("hidden");
            var current = getPlayerName();
            input.value = current === "jugador" ? "" : current;
            setTimeout(function () { input.focus(); input.select(); }, 60);
        }
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
                showStartOverlay();
            });
        }
        if (btnSaveName && inputName) { btnSaveName.addEventListener("click", function () { setPlayerName(inputName.value); }); }
        if (btnChangeName && inputName) { btnChangeName.addEventListener("click", function () { inputName.focus(); inputName.select(); }); }
        if (linkSpec) { linkSpec.addEventListener("click", function () { showModal("modal-especificaciones"); }); }
        if (linkTut) { linkTut.addEventListener("click", function (e) { e.preventDefault(); showModal("modal-tutorial"); }); }
        if (closeSpec) { closeSpec.addEventListener("click", function () { hideModal("modal-especificaciones"); }); }
        if (closeTut) { closeTut.addEventListener("click", function () { hideModal("modal-tutorial"); }); }

        syncNameUI();
        showStartOverlay();
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
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i].isBoss && !enemies[i].dead) { bossAlive = true; break; }
        }
        var bg = bossAlive || isBossLevel() ? bgBoss : bgMain;
        bufferctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    }

    function drawHud() {
        function txt(t, x, y, size) {
            bufferctx.font = "bold " + (size || 16) + "px Arial";
            bufferctx.strokeStyle = "#000";
            bufferctx.lineWidth = 3;
            bufferctx.fillStyle = "#fff6d0";
            bufferctx.strokeText(t, x, y);
            bufferctx.fillText(t, x, y);
        }
        txt("Jugador: " + getPlayerName(), 12, 22, 16);
        txt("Puntos: " + player.score, 12, 44, 16);
        txt("Vidas: " + player.life, 12, 66, 16);
        txt("Nivel: " + level, 12, 88, 16);
        txt("Eliminados: " + enemiesKilled, 12, 110, 16);
        txt("Progreso: " + killsInLevel + "/" + killsTargetInLevel, 12, 132, 16);
        if (!isBossLevel() && ((level + 1) % 3 === 0)) {
            txt("Siguiente nivel: JEFE", canvas.width / 2 - 120, 26, 14);
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
            level++;
            configLevel();
        }
    }

    function drawWaitMessage() {
        bufferctx.fillStyle = "#0b1d34";
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        bufferctx.fillStyle = "#d8e5ff";
        bufferctx.font = "18px Arial";
        var m = "Pulsa Jugar para iniciar.";
        bufferctx.fillText(m, (canvas.width - bufferctx.measureText(m).width) / 2, canvas.height / 2);
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
        if (!sessionActive) { drawWaitMessage(); draw(); return; }
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
        bindUI();
        showBestScores();
        document.addEventListener("keydown", keyDown);
        document.addEventListener("keyup", keyUp);
        function anim() { loop(); requestAnimFrame(anim); }
        anim();
    }

    return { init: init };
})();

document.addEventListener("DOMContentLoaded", function () { game.init(); });
