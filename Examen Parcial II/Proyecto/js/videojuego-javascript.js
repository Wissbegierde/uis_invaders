// nos marca los pulsos del juego
window.requestAnimFrame = (function () {
    return  window.requestAnimationFrame        ||
        window.webkitRequestAnimationFrame  ||
        window.mozRequestAnimationFrame     ||
        window.oRequestAnimationFrame       ||
        window.msRequestAnimationFrame      ||
        function ( /* function */ callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();
arrayRemove = function (array, from) {
    var rest = array.slice((from) + 1 || array.length);
    array.length = from < 0 ? array.length + from : from;
    return array.push.apply(array, rest);
};

var game = (function () {

    var STORAGE_SCORES = 'invaders_high_scores_v2';
    var STORAGE_NAME = 'invaders_player_name';
    var PLAYER_DEFAULT_W = 50;
    var PLAYER_DEFAULT_H = 66;

    var canvas,
        ctx,
        buffer,
        bufferctx,
        player,
        evil,
        playerShot,
        bgMain,
        bgBoss,
        evilSpeed = 1,
        totalEvils = 7,
        playerLife = 3,
        shotSpeed = 5,
        playerSpeed = 5,
        evilCounter = 0,
        youLoose = false,
        congratulations = false,
        sessionActive = false,
        evilShots = 5,
        evilLife = 3,
        finalBossShots = 30,
        finalBossLife = 12,
        totalBestScoresToShow = 5,
        playerShotsBuffer = [],
        evilShotsBuffer = [],
        evilShotImage,
        playerShotImage,
        playerKilledImage,
        evilImages = {
            animation : [],
            killed : new Image()
        },
        bossImages = {
            animation : [],
            killed : new Image()
        },
        keyPressed = {},
        keyMap = {
            left: 37,
            right: 39,
            fire: 32
        },
        nextPlayerShot = 0,
        playerShotDelay = 250,
        now = 0,
        enemiesKilled = 0,
        overlaySync = false;

    function getPlayerName() {
        var n = localStorage.getItem(STORAGE_NAME);
        if (n && n.replace(/\s/g, '').length) {
            return n.trim().substring(0, 24);
        }
        return 'jugador';
    }

    function setPlayerName(name) {
        var t = (name || '').trim();
        if (!t.length) {
            t = 'jugador';
        }
        if (t.length > 24) {
            t = t.substring(0, 24);
        }
        localStorage.setItem(STORAGE_NAME, t);
        syncNameUI();
    }

    function syncNameUI() {
        var show = document.getElementById('nombre-mostrar');
        var input = document.getElementById('nombre-jugador');
        if (show) {
            show.textContent = getPlayerName();
        }
        if (input) {
            input.value = getPlayerName();
        }
    }

    function getPlayerHitW() {
        if (!player) {
            return PLAYER_DEFAULT_W;
        }
        var w = player.width || player.naturalWidth;
        return w > 0 ? w : PLAYER_DEFAULT_W;
    }

    function getPlayerHitH() {
        if (!player) {
            return PLAYER_DEFAULT_H;
        }
        var h = player.height || player.naturalHeight;
        return h > 0 ? h : PLAYER_DEFAULT_H;
    }

    function loop() {
        update();
        draw();
    }

    function preloadImages () {
        for (var i = 1; i <= 8; i++) {
            var evilImage = new Image();
            evilImage.src = 'images/malo' + i + '.png';
            evilImages.animation[i-1] = evilImage;
            var bossImage = new Image();
            bossImage.src = 'images/jefe' + i + '.png';
            bossImages.animation[i-1] = bossImage;
        }
        evilImages.killed.src = 'images/malo_muerto.png';
        bossImages.killed.src = 'images/jefe_muerto.png';
        bgMain = new Image();
        bgMain.src = 'images/fondovertical.png';
        bgBoss = new Image();
        bgBoss.src = 'images/fondovertical_jefe.png';
        playerShotImage = new Image();
        playerShotImage.src = 'images/disparo_bueno.png';
        evilShotImage = new Image();
        evilShotImage.src = 'images/disparo_malo.png';
        playerKilledImage = new Image();
        playerKilledImage.src = 'images/bueno_muerto.png';

    }

    function readScoreRecords() {
        try {
            var raw = localStorage.getItem(STORAGE_SCORES);
            if (!raw) {
                return [];
            }
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writeScoreRecords(arr) {
        localStorage.setItem(STORAGE_SCORES, JSON.stringify(arr));
    }

    function bindUI() {
        var btnGuardar = document.getElementById('btn-guardar-nombre');
        var btnCambiar = document.getElementById('btn-cambiar-nombre');
        var input = document.getElementById('nombre-jugador');
        var btnEsp = document.getElementById('btn-especificaciones');
        var modal = document.getElementById('modal-especificaciones');
        var cerrar = document.getElementById('modal-esp-cerrar');
        var linkTut = document.getElementById('link-tutorial');
        var btnJugar = document.getElementById('btn-volver-jugar');
        var btnComenzar = document.getElementById('btn-comenzar-partida');

        if (btnComenzar) {
            addListener(btnComenzar, 'click', onComenzarPartida);
        }

        if (btnGuardar && input) {
            addListener(btnGuardar, 'click', function () {
                setPlayerName(input.value);
            });
        }
        if (btnCambiar && input) {
            addListener(btnCambiar, 'click', function () {
                input.focus();
                input.select();
            });
        }
        function openModal() {
            if (modal) {
                modal.classList.remove('hidden');
            }
        }
        function closeModal() {
            if (modal) {
                modal.classList.add('hidden');
            }
        }
        if (btnEsp) {
            addListener(btnEsp, 'click', function (e) {
                e.preventDefault();
                openModal();
            });
        }
        if (linkTut) {
            addListener(linkTut, 'click', function (e) {
                e.preventDefault();
                openModal();
            });
        }
        if (cerrar) {
            addListener(cerrar, 'click', closeModal);
        }
        if (modal) {
            addListener(modal, 'click', function (e) {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }
        if (btnJugar) {
            addListener(btnJugar, 'click', function () {
                prepararNuevaPartidaDesdeFin();
            });
        }
        syncNameUI();
        abrirModalInicio();
    }

    function abrirModalInicio() {
        var modalInicio = document.getElementById('modal-inicio');
        var inputPartida = document.getElementById('nombre-partida');
        if (modalInicio) {
            modalInicio.classList.remove('hidden');
        }
        if (inputPartida) {
            var actual = getPlayerName();
            inputPartida.value = actual === 'jugador' ? '' : actual;
            setTimeout(function () {
                inputPartida.focus();
                inputPartida.select();
            }, 50);
        }
    }

    function onComenzarPartida() {
        var inputPartida = document.getElementById('nombre-partida');
        var modalInicio = document.getElementById('modal-inicio');
        var v = inputPartida ? (inputPartida.value || '').trim() : '';
        setPlayerName(v.length ? v : 'jugador');
        if (modalInicio) {
            modalInicio.classList.add('hidden');
        }
        reallyRestart();
    }

    function prepararNuevaPartidaDesdeFin() {
        hideEndOverlay();
        overlaySync = false;
        youLoose = false;
        congratulations = false;
        sessionActive = false;
        abrirModalInicio();
    }

    function drawPantallaEspera() {
        bufferctx.fillStyle = "rgb(10,22,40)";
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        bufferctx.save();
        bufferctx.font = "16px Arial";
        bufferctx.fillStyle = "rgb(200,210,230)";
        var msg = "Indica tu nombre y pulsa «Comenzar partida».";
        var w = bufferctx.measureText(msg).width;
        bufferctx.fillText(msg, (canvas.width - w) / 2, canvas.height / 2);
        bufferctx.restore();
    }

    function showEndOverlay(titulo, detalle, puntosLinea) {
        var ov = document.getElementById('overlay-fin');
        var t = document.getElementById('overlay-titulo');
        var d = document.getElementById('overlay-detalle');
        var p = document.getElementById('overlay-puntos');
        if (!ov || !t || !d || !p) {
            return;
        }
        t.textContent = titulo;
        d.innerHTML = detalle;
        p.textContent = puntosLinea || '';
        ov.classList.remove('hidden');
    }

    function hideEndOverlay() {
        var ov = document.getElementById('overlay-fin');
        if (ov) {
            ov.classList.add('hidden');
        }
    }

    function reallyRestart() {
        youLoose = false;
        congratulations = false;
        hideEndOverlay();
        overlaySync = false;

        evilSpeed = 1;
        totalEvils = 7;
        playerLife = 3;
        evilCounter = 1;
        enemiesKilled = 0;
        playerShotsBuffer.length = 0;
        evilShotsBuffer.length = 0;
        keyPressed = {};

        player = new Player(playerLife, 0);
        createNewEvil();
        sessionActive = true;
        showBestScores();
    }

    function init() {
        preloadImages();
        bindUI();

        showBestScores();

        canvas = document.getElementById('canvas');
        ctx = canvas.getContext("2d");

        buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext("2d");

        sessionActive = false;

        addListener(document, 'keydown', keyDown);
        addListener(document, 'keyup', keyUp);

        function anim () {
            loop();
            requestAnimFrame(anim);
        }
        anim();
    }

    function drawHudText(text, x, y) {
        bufferctx.save();
        bufferctx.font = "bold 16px Arial";
        bufferctx.lineWidth = 3;
        bufferctx.strokeStyle = "rgb(0,0,0)";
        bufferctx.fillStyle = "rgb(255,248,220)";
        bufferctx.strokeText(text, x, y);
        bufferctx.fillText(text, x, y);
        bufferctx.restore();
    }

    function showLifeAndScore() {
        if (!player) {
            return;
        }
        var pad = 12;
        var y1 = 22;
        var y2 = 42;
        var y3 = 62;
        var y4 = 82;
        drawHudText("Jugador: " + getPlayerName(), pad, y1);
        drawHudText("Puntos: " + player.score, pad, y2);
        drawHudText("Vidas: " + player.life, pad, y3);
        drawHudText("Enemigos eliminados: " + enemiesKilled, pad, y4);

        if (evil && !evil.dead) {
            bufferctx.save();
            bufferctx.font = "bold 14px Arial";
            bufferctx.lineWidth = 3;
            if (evil instanceof FinalBoss) {
                bufferctx.strokeStyle = "rgb(0,0,0)";
                bufferctx.fillStyle = "rgb(255,217,61)";
                var bossMsg = "JEFE FINAL";
                bufferctx.strokeText(bossMsg, canvas.width / 2 - 55, 26);
                bufferctx.fillText(bossMsg, canvas.width / 2 - 55, 26);
            } else if (totalEvils === 2) {
                bufferctx.strokeStyle = "rgb(0,0,0)";
                bufferctx.fillStyle = "rgb(255,140,90)";
                var warn = "Siguiente enemigo: JEFE FINAL";
                bufferctx.strokeText(warn, canvas.width / 2 - 120, 26);
                bufferctx.fillText(warn, canvas.width / 2 - 120, 26);
            }
            bufferctx.restore();
        }
    }

    function getRandomNumber(range) {
        return Math.floor(Math.random() * range);
    }

    function Player(life, score) {
        var settings = {
            marginBottom : 10,
            defaultHeight : PLAYER_DEFAULT_H
        };
        player = new Image();
        player.src = 'images/bueno.png';
        var halfW = getPlayerHitW() / 2;
        player.posX = (canvas.width / 2) - halfW;
        player.posY = canvas.height - settings.defaultHeight - settings.marginBottom;
        player.life = life;
        player.score = score;
        player.dead = false;
        player.speed = playerSpeed;

        player.onload = function () {
            var w = getPlayerHitW();
            if (player.posX + w > canvas.width - 5) {
                player.posX = canvas.width - w - 5;
            }
            if (player.posX < 5) {
                player.posX = 5;
            }
        };

        var shoot = function () {
            if (nextPlayerShot < now || now === 0) {
                playerShot = new PlayerShot(player.posX + (getPlayerHitW() / 2) - 5 , player.posY);
                playerShot.add();
                now += playerShotDelay;
                nextPlayerShot = now + playerShotDelay;
            } else {
                now = new Date().getTime();
            }
        };

        player.doAnything = function() {
            if (player.dead) {
                return;
            }
            var pw = getPlayerHitW();
            if (keyPressed.left && player.posX > 5) {
                player.posX -= player.speed;
            }
            if (keyPressed.right && player.posX < (canvas.width - pw - 5)) {
                player.posX += player.speed;
            }
            if (keyPressed.fire) {
                shoot();
            }
        };

        player.killPlayer = function() {
            if (this.dead) {
                return;
            }
            this.dead = true;
            evilShotsBuffer.splice(0, evilShotsBuffer.length);
            playerShotsBuffer.splice(0, playerShotsBuffer.length);
            this.src = playerKilledImage.src;
            createNewEvil();
            var restantes = this.life - 1;
            var puntos = this.score;
            if (restantes > 0) {
                setTimeout(function () {
                    player = new Player(restantes, puntos);
                }, 500);
            } else {
                setTimeout(function () {
                    saveFinalScore(false);
                    youLoose = true;
                }, 500);
            }
        };

        return player;
    }

    function Shot( x, y, array, img) {
        this.posX = x;
        this.posY = y;
        this.image = img;
        this.speed = shotSpeed;
        this.identifier = 0;
        this.add = function () {
            array.push(this);
        };
        this.deleteShot = function (identificador) {
            arrayRemove(array, identificador);
        };
    }

    function PlayerShot (x, y) {
        Object.getPrototypeOf(PlayerShot.prototype).constructor.call(this, x, y, playerShotsBuffer, playerShotImage);
        this.isHittingEvil = function() {
            return (!evil.dead && this.posX >= evil.posX && this.posX <= (evil.posX + evil.image.width) &&
                this.posY >= evil.posY && this.posY <= (evil.posY + evil.image.height));
        };
    }

    PlayerShot.prototype = Object.create(Shot.prototype);
    PlayerShot.prototype.constructor = PlayerShot;

    function EvilShot (x, y) {
        Object.getPrototypeOf(EvilShot.prototype).constructor.call(this, x, y, evilShotsBuffer, evilShotImage);
        this.isHittingPlayer = function() {
            var pw = getPlayerHitW();
            var ph = getPlayerHitH();
            return (this.posX >= player.posX && this.posX <= (player.posX + pw)
                && this.posY >= player.posY && this.posY <= (player.posY + ph));
        };
    }

    EvilShot.prototype = Object.create(Shot.prototype);
    EvilShot.prototype.constructor = EvilShot;

    function enemySpriteW(img) {
        if (!img) {
            return 48;
        }
        var w = img.width || img.naturalWidth;
        return w > 0 ? w : 48;
    }

    function Enemy(life, shots, enemyImages) {
        this.image = enemyImages.animation[0];
        this.imageNumber = 1;
        this.animation = 0;
        var ew0 = enemySpriteW(this.image);
        this.posX = getRandomNumber(Math.max(1, canvas.width - ew0));
        this.posY = -50;
        this.life = life ? life : evilLife;
        this.speed = evilSpeed;
        this.shots = shots ? shots : evilShots;
        this.dead = false;
        this.hDir = Math.random() > 0.5 ? 1 : -1;
        this.hSpeedFactor = 1;
        this.hMag = 0;
        this.horizontalTimer = 0;
        this.horizontalPhaseMax = 70 + getRandomNumber(140);

        this.kill = function(killedByPlayer) {
            var byPlayer = killedByPlayer !== false;
            this.dead = true;
            totalEvils--;
            if (byPlayer) {
                enemiesKilled++;
            }
            this.image = enemyImages.killed;
            verifyToCreateNewEvil();
        };

        this.update = function () {
            this.posY += this.goDownSpeed;
            var ew = enemySpriteW(this.image);
            this.horizontalTimer++;
            if (this.horizontalTimer >= this.horizontalPhaseMax) {
                this.horizontalTimer = 0;
                this.horizontalPhaseMax = 50 + getRandomNumber(200);
                if (Math.random() < 0.5) {
                    this.hDir *= -1;
                }
                var base = evilSpeed * this.hSpeedFactor;
                this.hMag = base * (0.55 + Math.random() * 1.15);
            }
            if (!this.hMag) {
                this.hMag = evilSpeed * this.hSpeedFactor * (0.75 + Math.random() * 0.5);
            }
            this.posX += this.hMag * this.hDir;
            if (this.posX <= 0) {
                this.posX = 0;
                this.hDir = 1;
                this.hMag = evilSpeed * this.hSpeedFactor * (0.65 + Math.random() * 0.85);
                this.horizontalTimer = 0;
            } else if (this.posX >= canvas.width - ew) {
                this.posX = canvas.width - ew;
                this.hDir = -1;
                this.hMag = evilSpeed * this.hSpeedFactor * (0.65 + Math.random() * 0.85);
                this.horizontalTimer = 0;
            }
            this.animation++;
            if (this.animation > 5) {
                this.animation = 0;
                this.imageNumber ++;
                if (this.imageNumber > 8) {
                    this.imageNumber = 1;
                }
                this.image = enemyImages.animation[this.imageNumber - 1];
            }
        };

        this.isOutOfScreen = function() {
            return this.posY > (canvas.height + 15);
        };

        function shoot() {
            if (evil.shots > 0 && !evil.dead) {
                var disparo = new EvilShot(evil.posX + (evil.image.width / 2) - 5 , evil.posY + evil.image.height);
                disparo.add();
                evil.shots--;
                setTimeout(function() {
                    shoot();
                }, getRandomNumber(3000));
            }
        }
        setTimeout(function() {
            shoot();
        }, 1000 + getRandomNumber(2500));

        this.toString = function () {
            return 'Enemigo con vidas:' + this.life + 'shotss: ' + this.shots + ' puntos por matar: ' + this.pointsToKill;
        };

    }

    function Evil (vidas, disparos) {
        Object.getPrototypeOf(Evil.prototype).constructor.call(this, vidas, disparos, evilImages);
        this.goDownSpeed = evilSpeed;
        this.pointsToKill = 5 + evilCounter;
    }

    Evil.prototype = Object.create(Enemy.prototype);
    Evil.prototype.constructor = Evil;

    function FinalBoss () {
        Object.getPrototypeOf(FinalBoss.prototype).constructor.call(this, finalBossLife, finalBossShots, bossImages);
        this.goDownSpeed = evilSpeed/2;
        this.pointsToKill = 20;
        this.hSpeedFactor = 0.68;
    }

    FinalBoss.prototype = Object.create(Enemy.prototype);
    FinalBoss.prototype.constructor = FinalBoss;

    function verifyToCreateNewEvil() {
        if (totalEvils > 0) {
            setTimeout(function() {
                createNewEvil();
                evilCounter ++;
            }, getRandomNumber(3000));

        } else {
            setTimeout(function() {
                saveFinalScore(true);
                congratulations = true;
            }, 2000);

        }
    }

    function createNewEvil() {
        if (totalEvils !== 1) {
            evil = new Evil(evilLife + evilCounter - 1, evilShots + evilCounter - 1);
        } else {
            evil = new FinalBoss();
        }
    }

    function isEvilHittingPlayer() {
        var pw = getPlayerHitW();
        var ph = getPlayerHitH();
        return ( ( (evil.posY + evil.image.height) > player.posY && (player.posY + ph) >= evil.posY ) &&
            ((player.posX >= evil.posX && player.posX <= (evil.posX + evil.image.width)) ||
                (player.posX + pw >= evil.posX && (player.posX + pw) <= (evil.posX + evil.image.width))));
    }

    function checkCollisions(shot) {
        if (shot.isHittingEvil()) {
            if (evil.life > 1) {
                evil.life--;
            } else {
                evil.kill(true);
                player.score += evil.pointsToKill;
            }
            shot.deleteShot(parseInt(shot.identifier, 10));
            return false;
        }
        return true;
    }

    function playerAction() {
        player.doAnything();
    }

    function addListener(element, type, expression, bubbling) {
        bubbling = bubbling || false;

        if (window.addEventListener) {
            element.addEventListener(type, expression, bubbling);
        } else if (window.attachEvent) {
            element.attachEvent('on' + type, expression);
        }
    }

    function keyDown(e) {
        var key = (window.event ? e.keyCode : e.which);
        for (var inkey in keyMap) {
            if (key === keyMap[inkey]) {
                e.preventDefault();
                keyPressed[inkey] = true;
            }
        }
    }

    function keyUp(e) {
        var key = (window.event ? e.keyCode : e.which);
        for (var inkey in keyMap) {
            if (key === keyMap[inkey]) {
                e.preventDefault();
                keyPressed[inkey] = false;
            }
        }
    }

    function draw() {
        ctx.drawImage(buffer, 0, 0);
    }

    function showGameOver() {
        bufferctx.fillStyle = "rgba(0,0,0,0.5)";
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        bufferctx.save();
        bufferctx.font = "bold 42px Arial";
        bufferctx.lineWidth = 4;
        bufferctx.strokeStyle = "rgb(0,0,0)";
        bufferctx.fillStyle = "rgb(255,80,80)";
        var title = "GAME OVER";
        var tw = bufferctx.measureText(title).width;
        bufferctx.strokeText(title, (canvas.width - tw) / 2, canvas.height / 2 - 20);
        bufferctx.fillText(title, (canvas.width - tw) / 2, canvas.height / 2 - 20);
        bufferctx.font = "bold 18px Arial";
        bufferctx.fillStyle = "rgb(255,248,220)";
        var sub = getPlayerName() + " · Puntos: " + player.score + " · Eliminados: " + enemiesKilled;
        var sw = bufferctx.measureText(sub).width;
        bufferctx.fillText(sub, (canvas.width - sw) / 2, canvas.height / 2 + 25);
        bufferctx.restore();

        if (!overlaySync) {
            overlaySync = true;
            showEndOverlay(
                "Fin de la partida",
                "Has perdido todas las vidas. Puedes cambiar tu nombre a la izquierda y volver a intentarlo.",
                "Puntos: " + player.score + " · Enemigos eliminados: " + enemiesKilled
            );
        }
    }

    function showCongratulations () {
        bufferctx.fillStyle = "rgba(0,20,40,0.65)";
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        bufferctx.save();
        bufferctx.font = "bold 24px Arial";
        bufferctx.lineWidth = 3;
        bufferctx.strokeStyle = "rgb(0,0,0)";
        bufferctx.fillStyle = "rgb(255,215,0)";
        var line1 = "¡Enhorabuena, te has pasado el juego!";
        var w1 = bufferctx.measureText(line1).width;
        bufferctx.strokeText(line1, (canvas.width - w1) / 2, canvas.height / 2 - 50);
        bufferctx.fillText(line1, (canvas.width - w1) / 2, canvas.height / 2 - 50);

        bufferctx.font = "bold 18px Arial";
        bufferctx.fillStyle = "rgb(255,248,220)";
        var bonus = player.life * 5;
        var line2 = "Puntos de juego: " + player.score;
        var line3 = "Vidas restantes: " + player.life + " (bonus +" + bonus + ")";
        var line4 = "Puntuación total: " + getTotalScore();
        var y0 = canvas.height / 2 - 10;
        [line2, line3, line4].forEach(function (line, i) {
            var w = bufferctx.measureText(line).width;
            bufferctx.fillText(line, (canvas.width - w) / 2, y0 + i * 26);
        });
        bufferctx.restore();

        if (!overlaySync) {
            overlaySync = true;
            showEndOverlay(
                "¡Victoria!",
                "Has derrotado al jefe final. La puntuación total suma el bonus por las vidas que te quedaban.",
                "Puntuación total: " + getTotalScore() + " (incluye bonus de vidas)"
            );
        }
    }

    function getTotalScore() {
        return player.score + player.life * 5;
    }

    function update() {

        if (!sessionActive) {
            drawPantallaEspera();
            draw();
            return;
        }

        drawBackground();

        if (congratulations) {
            showCongratulations();
            return;
        }

        if (youLoose) {
            showGameOver();
            return;
        }

        hideEndOverlay();
        overlaySync = false;

        bufferctx.drawImage(player, player.posX, player.posY);
        bufferctx.drawImage(evil.image, evil.posX, evil.posY);

        updateEvil();

        for (var j = 0; j < playerShotsBuffer.length; j++) {
            var disparoBueno = playerShotsBuffer[j];
            updatePlayerShot(disparoBueno, j);
        }

        if (isEvilHittingPlayer()) {
            player.killPlayer();
        } else {
            for (var i = 0; i < evilShotsBuffer.length; i++) {
                var evilShot = evilShotsBuffer[i];
                updateEvilShot(evilShot, i);
            }
        }

        showLifeAndScore();

        playerAction();
    }

    function updatePlayerShot(playerShot, id) {
        if (playerShot) {
            playerShot.identifier = id;
            if (checkCollisions(playerShot)) {
                if (playerShot.posY > 0) {
                    playerShot.posY -= playerShot.speed;
                    bufferctx.drawImage(playerShot.image, playerShot.posX, playerShot.posY);
                } else {
                    playerShot.deleteShot(parseInt(playerShot.identifier, 10));
                }
            }
        }
    }

    function updateEvilShot(evilShot, id) {
        if (evilShot) {
            evilShot.identifier = id;
            if (!evilShot.isHittingPlayer()) {
                if (evilShot.posY <= canvas.height) {
                    evilShot.posY += evilShot.speed;
                    bufferctx.drawImage(evilShot.image, evilShot.posX, evilShot.posY);
                } else {
                    evilShot.deleteShot(parseInt(evilShot.identifier, 10));
                }
            } else {
                player.killPlayer();
            }
        }
    }

    function drawBackground() {
        var background;
        if (evil instanceof FinalBoss) {
            background = bgBoss;
        } else {
            background = bgMain;
        }
        bufferctx.drawImage(background, 0, 0);
    }

    function updateEvil() {
        if (!evil.dead) {
            evil.update();
            if (evil.isOutOfScreen()) {
                evil.kill(false);
            }
        }
    }

    function saveFinalScore(isVictory) {
        isVictory = !!isVictory;
        var total = isVictory ? getTotalScore() : player.score;
        var record = {
            name: getPlayerName(),
            score: total,
            date: formatDateTime(),
            enemiesKilled: enemiesKilled
        };
        var list = readScoreRecords();
        list.push(record);
        list.sort(function (a, b) {
            return parseInt(b.score, 10) - parseInt(a.score, 10);
        });
        list = list.slice(0, totalBestScoresToShow);
        writeScoreRecords(list);
        showBestScores();
    }

    function formatDateTime() {
        var date = new Date();
        return fillZero(date.getDate()) + '/' +
            fillZero(date.getMonth() + 1) + '/' +
            date.getFullYear() + ' ' +
            fillZero(date.getHours()) + ':' +
            fillZero(date.getMinutes()) + ':' +
            fillZero(date.getSeconds());
    }

    function fillZero(number) {
        if (number < 10) {
            return '0' + number;
        }
        return number;
    }

    function showBestScores() {
        var bestScoresList = document.getElementById('puntuaciones');
        if (!bestScoresList) {
            return;
        }
        bestScoresList.innerHTML = '';
        var cab1 = document.createElement('li');
        cab1.className = 'cabecera';
        cab1.textContent = 'Nombre';
        var cab2 = document.createElement('li');
        cab2.className = 'cabecera';
        cab2.textContent = 'Puntos';
        var cab3 = document.createElement('li');
        cab3.className = 'cabecera';
        cab3.textContent = 'Fecha';
        bestScoresList.appendChild(cab1);
        bestScoresList.appendChild(cab2);
        bestScoresList.appendChild(cab3);

        var records = readScoreRecords().slice(0, totalBestScoresToShow);
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            var nameClass = i === 0 ? 'negrita' : null;
            addListElement(bestScoresList, r.name || '—', nameClass);
            addListElement(bestScoresList, String(r.score), nameClass);
            addListElement(bestScoresList, r.date || '', nameClass);
        }
    }

    function addListElement(list, content, className) {
        var element = document.createElement('li');
        if (className) {
            element.setAttribute("class", className);
        }
        element.textContent = content;
        list.appendChild(element);
    }

    return {
        init: init,
        reallyRestart: reallyRestart
    };
})();

document.addEventListener('DOMContentLoaded', function () {
    game.init();
});
