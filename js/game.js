// ==========================================
// 隱藏彩蛋三引擎 (v4.3 道具擴充與策略版)
// ==========================================

let activeGame = null; 
let gameAnimationId;
let frameCount = 0;
let score = 0;
let isGameRunning = false;

// 🌟 FPS 鎖定引擎 (防止高更新率螢幕遊戲過快)
let lastRenderTime = 0;
const FRAME_MIN_TIME = 1000 / 60; // 鎖定最高 60 FPS

// === 跑酷遊戲 (Runner) ===
let runnerClicks = 0; let runnerTimer;
let runnerPlayer = { x: 280, y: 140, w: 20, h: 30, dy: 0, gravity: 0.6, jumpPower: -10, isGrounded: true };
let runnerObstacles = [];
let runnerHighScore = localStorage.getItem('lateCommuterHighScore') || 0;
// 新增道具系統
let runnerItems = [];
let shoeTimer = 0;    // 增高鞋計時器
let rocketTimer = 0;  // 火箭計時器
let inputPressing = false; // 追蹤是否正在長按 (用於火箭推進)

// === 下樓梯遊戲 (Diver) ===
let diverClicks = 0; let diverTimer;
let diverPlayer = { x: 165, y: 50, w: 20, h: 30, dx: 0, dy: 0, speed: 1.8, gravity: 0.15 }; 
let platforms = [];
let diverHighScore = localStorage.getItem('deepStationHighScore') || 0;
let keys = { left: false, right: false };
let touchLeft = false; let touchRight = false;
let platformSpeed = 0.8; 
// 新增愛心系統
let diverHearts = 0;
let diverItems = [];

// === 終極密碼 (Password) 1~99 ===
let pwdClicks = 0; let pwdTimer;
let pwdTarget = 0;
let pwdGuesses = 0;
let pwdMin = 1; let pwdMax = 99;
let pwdHighScore = localStorage.getItem('passwordHighScore') || 999; 
let currentPwdInput = ""; 

// 建立小鍵盤 UI
function createPasswordKeyboard() {
    let keyboardHTML = `
        <div id="custom-keyboard" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; max-width: 280px; margin-top: 15px;">
            <button class="pwd-key" onclick="handlePwdKey(1)">1</button>
            <button class="pwd-key" onclick="handlePwdKey(2)">2</button>
            <button class="pwd-key" onclick="handlePwdKey(3)">3</button>
            <button class="pwd-key" onclick="handlePwdKey(4)">4</button>
            <button class="pwd-key" onclick="handlePwdKey(5)">5</button>
            <button class="pwd-key" onclick="handlePwdKey(6)">6</button>
            <button class="pwd-key" onclick="handlePwdKey(7)">7</button>
            <button class="pwd-key" onclick="handlePwdKey(8)">8</button>
            <button class="pwd-key" onclick="handlePwdKey(9)">9</button>
            <button class="pwd-key action-key" onclick="handlePwdKey('backspace')" style="background-color: var(--danger);">⌫</button>
            <button class="pwd-key" onclick="handlePwdKey(0)">0</button>
            <button class="pwd-key action-key" id="pwd-submit-key" onclick="submitPasswordGuess()" style="background-color: var(--success);">↵</button>
        </div>
        <style>
            .pwd-key { background-color: #333; color: white; border: none; border-radius: 10px; font-size: 24px; font-weight: bold; padding: 15px 0; cursor: pointer; transition: 0.1s; user-select: none; }
            .pwd-key:active { transform: scale(0.9); background-color: #555; }
            .pwd-key:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
            #pwd-display-box { width: 150px; height: 50px; font-size: 32px; font-weight: bold; text-align: center; border-radius: 12px; border: 2px solid #555; background: #222; color: white; display: flex; align-items: center; justify-content: center; letter-spacing: 2px; }
        </style>
    `;
    const uiContainer = document.getElementById('password-ui');
    if (!document.getElementById('custom-keyboard')) {
        uiContainer.innerHTML = `
            <div id="pwd-range-display" style="font-size: 32px; font-weight: bold; color: white; letter-spacing: 2px;">1 ~ 99</div>
            <div id="pwd-display-box">?</div>
            ${keyboardHTML}
        `;
    }
}

function handlePwdKey(key) {
    if (!isGameRunning) return;
    const displayBox = document.getElementById('pwd-display-box');
    if (key === 'backspace') {
        currentPwdInput = currentPwdInput.slice(0, -1);
    } else {
        if (currentPwdInput.length < 2) {
            if (currentPwdInput.length === 0 && key === 0) return;
            currentPwdInput += key;
        }
    }
    displayBox.innerText = currentPwdInput === "" ? "?" : currentPwdInput;
}

// === 觸發器 ===
function triggerEasterEgg(force = false) {
    runnerClicks++; clearTimeout(runnerTimer);
    runnerTimer = setTimeout(() => { runnerClicks = 0; }, 1500);
    if (runnerClicks >= 5 || force) {
        runnerClicks = 0; activeGame = 'runner';
        localStorage.setItem('unlock_runner', 'true');
        if (typeof updateCollectionUI === 'function') updateCollectionUI();
        openGameSheet();
    }
}

function triggerEasterEgg2(force = false) {
    diverClicks++; clearTimeout(diverTimer);
    diverTimer = setTimeout(() => { diverClicks = 0; }, 1500);
    if (diverClicks >= 5 || force) {
        diverClicks = 0; activeGame = 'diver';
        localStorage.setItem('unlock_diver', 'true');
        if (typeof updateCollectionUI === 'function') updateCollectionUI();
        openGameSheet();
    }
}

function triggerEasterEgg3(force = false) {
    pwdClicks++; clearTimeout(pwdTimer);
    pwdTimer = setTimeout(() => { pwdClicks = 0; }, 1500);
    if (pwdClicks >= 5 || force) {
        pwdClicks = 0; activeGame = 'password';
        localStorage.setItem('unlock_password', 'true');
        if (typeof updateCollectionUI === 'function') updateCollectionUI();
        openGameSheet();
    }
}

function openGameSheet() {
    document.getElementById('overlay').classList.add('active');
    document.getElementById('game-sheet').classList.add('active');
    initGameCanvas();
}

// === 遊戲初始化 ===
function initGameCanvas() {
    const canvas = document.getElementById('game-canvas');
    const pwdUI = document.getElementById('password-ui');
    const ctx = canvas.getContext('2d');
    
    document.getElementById('start-game-btn').style.display = 'inline-block';
    document.getElementById('start-game-btn').innerText = '開始挑戰';
    document.getElementById('game-score').innerText = '準備中...';

    if (activeGame === 'password') {
        canvas.style.display = 'none'; pwdUI.style.display = 'flex';
        document.getElementById('game-title').innerText = '🔢 終極密碼';
        document.getElementById('game-hint').innerText = '在範圍內輸入數字並猜測！';
        pwdHighScore = localStorage.getItem('passwordHighScore') || 999;
        let showScore = pwdHighScore == 999 ? '無' : `${pwdHighScore} 次`;
        document.getElementById('game-high-score').innerText = `最佳運氣: ${showScore}`;
        
        createPasswordKeyboard(); 
        document.getElementById('pwd-range-display').innerText = '1 ~ 99';
        document.getElementById('pwd-range-display').style.color = 'white';
        document.getElementById('pwd-display-box').innerText = '?';
        currentPwdInput = "";
        document.querySelectorAll('.pwd-key').forEach(btn => btn.disabled = true);
        
    } else {
        canvas.style.display = 'block'; pwdUI.style.display = 'none';
        canvas.height = activeGame === 'runner' ? 200 : 300;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666'; ctx.font = '16px sans-serif'; ctx.fillText('準備好挑戰了嗎？', 100, 100);

        if (activeGame === 'runner') {
            document.getElementById('game-title').innerText = '🏃‍♂️ 社畜的最後衝刺';
            document.getElementById('game-hint').innerText = '點擊跳躍，可撿增高鞋與火箭道具！';
            runnerHighScore = localStorage.getItem('lateCommuterHighScore') || 0;
            document.getElementById('game-high-score').innerText = `歷史最高: ${runnerHighScore} 秒`;
        } else {
            document.getElementById('game-title').innerText = '🚇 直奔最深月台';
            document.getElementById('game-hint').innerText = '點擊左右閃避，每20層送愛心抵擋紅梯！';
            diverHighScore = localStorage.getItem('deepStationHighScore') || 0;
            document.getElementById('game-high-score').innerText = `歷史最高: B${diverHighScore} 層`;
        }
    }
    document.getElementById('game-high-score').style.color = '#888';
}

function startActiveGame() {
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    isGameRunning = true; score = 0; frameCount = 0;
    document.getElementById('start-game-btn').style.display = 'none';
    lastRenderTime = performance.now(); 

    if (activeGame === 'runner') {
        runnerPlayer.y = 140; runnerPlayer.dy = 0; runnerPlayer.isGrounded = true;
        runnerObstacles = []; runnerItems = []; 
        shoeTimer = 0; rocketTimer = 0; inputPressing = false;
        runnerLoop(performance.now());
    } else if (activeGame === 'diver') {
        diverPlayer.x = 165; diverPlayer.y = 50; diverPlayer.dx = 0; diverPlayer.dy = 0;
        platforms = []; platformSpeed = 0.8; keys.left = false; keys.right = false; 
        diverHearts = 0; diverItems = [];
        platforms.push({ x: 140, y: 150, w: 70, h: 10, type: 'safe' });
        diverLoop(performance.now());
    } else if (activeGame === 'password') {
        startPasswordGame();
    }
}

// === 輸入綁定 ===
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    document.addEventListener('keydown', (e) => { 
        if (!document.getElementById('game-sheet').classList.contains('active')) return;
        if (activeGame === 'runner' && (e.code === 'Space' || e.code === 'ArrowUp')) { 
            e.preventDefault(); 
            inputPressing = true;
            if (!e.repeat) jumpRunner(); 
        }
        if (activeGame === 'diver') {
            if (e.code === 'ArrowLeft') keys.left = true;
            if (e.code === 'ArrowRight') keys.right = true;
        }
        if (activeGame === 'password') {
            if (e.code === 'Enter') { e.preventDefault(); if(isGameRunning) submitPasswordGuess(); }
            if (e.code === 'Backspace') { e.preventDefault(); handlePwdKey('backspace'); }
            if (e.key >= '0' && e.key <= '9') { handlePwdKey(parseInt(e.key)); }
        }
    });
    document.addEventListener('keyup', (e) => { 
        if (activeGame === 'runner' && (e.code === 'Space' || e.code === 'ArrowUp')) inputPressing = false;
        if (activeGame === 'diver') {
            if (e.code === 'ArrowLeft') keys.left = false;
            if (e.code === 'ArrowRight') keys.right = false;
        }
    });

    canvas.addEventListener('mousedown', (e) => { inputPressing = true; handleTouchPoint(e, canvas); });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); inputPressing = true; handleTouchPoint(e.touches[0], canvas); }, {passive: false});
    canvas.addEventListener('mouseup', () => { inputPressing = false; touchLeft = false; touchRight = false; });
    canvas.addEventListener('touchend', () => { inputPressing = false; touchLeft = false; touchRight = false; });
});

function handleTouchPoint(e, canvas) {
    if (!isGameRunning) return;
    if (activeGame === 'runner') { jumpRunner(); }
    else if (activeGame === 'diver') {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        if (x < canvas.width / 2) { touchLeft = true; touchRight = false; }
        else { touchRight = true; touchLeft = false; }
    }
}

function jumpRunner() {
    let isDashing = (rocketTimer > 0 && inputPressing); // 衝刺狀態不可普通跳躍
    if (runnerPlayer.isGrounded && isGameRunning && !isDashing) { 
        runnerPlayer.dy = runnerPlayer.jumpPower; 
        runnerPlayer.isGrounded = false; 
    }
}

function gameOver(reason) {
    isGameRunning = false; inputPressing = false;
    document.getElementById('start-game-btn').style.display = 'inline-block';
    document.getElementById('start-game-btn').innerText = '再玩一次';

    if (activeGame === 'runner' || activeGame === 'diver') {
        const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'var(--danger)'; ctx.font = '22px bold sans-serif';
        ctx.fillText(reason, 40, canvas.height / 2);

        if (activeGame === 'runner' && score > runnerHighScore) {
            runnerHighScore = score; localStorage.setItem('lateCommuterHighScore', runnerHighScore);
            document.getElementById('game-high-score').innerText = `歷史最高: ${runnerHighScore} 秒 (新紀錄!)`;
            document.getElementById('game-high-score').style.color = 'var(--danger)';
        } else if (activeGame === 'diver' && score > diverHighScore) {
            diverHighScore = score; localStorage.setItem('deepStationHighScore', diverHighScore);
            document.getElementById('game-high-score').innerText = `歷史最高: B${diverHighScore} 層 (新紀錄!)`;
            document.getElementById('game-high-score').style.color = 'var(--danger)';
        }
    } else if (activeGame === 'password') {
        document.getElementById('game-hint').innerText = reason;
        document.getElementById('game-hint').style.color = 'var(--success)';
        document.getElementById('game-hint').style.fontSize = '16px';
        document.querySelectorAll('.pwd-key').forEach(btn => btn.disabled = true);
        
        if (pwdGuesses < pwdHighScore) {
            pwdHighScore = pwdGuesses; localStorage.setItem('passwordHighScore', pwdHighScore);
            document.getElementById('game-high-score').innerText = `最佳運氣: ${pwdHighScore} 次 (新紀錄!)`;
            document.getElementById('game-high-score').style.color = 'var(--danger)';
        }
    }
    if (typeof updateCollectionUI === 'function') updateCollectionUI();
}

// === 1. 跑酷遊戲 (Runner) FPS 鎖定版 + 道具 ===
function runnerLoop(currentTime) {
    if (!isGameRunning || activeGame !== 'runner') return;
    gameAnimationId = requestAnimationFrame(runnerLoop);
    
    const deltaTime = currentTime - lastRenderTime;
    if (deltaTime < FRAME_MIN_TIME) return;
    lastRenderTime = currentTime - (deltaTime % FRAME_MIN_TIME);

    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    if (shoeTimer > 0) shoeTimer--;
    if (rocketTimer > 0) rocketTimer--;

    // 判斷狀態
    let isDashing = (rocketTimer > 0 && inputPressing);
    runnerPlayer.jumpPower = (shoeTimer > 0) ? -13 : -10; // 增高鞋強化跳躍

    if (isDashing) {
        runnerPlayer.y = 90; // 火箭起飛高度
        runnerPlayer.dy = 0; runnerPlayer.gravity = 0; runnerPlayer.isGrounded = false;
        ctx.font = '35px Arial'; ctx.fillText('🚀', runnerPlayer.x, runnerPlayer.y + 30);
    } else {
        runnerPlayer.gravity = 0.6;
        runnerPlayer.dy += runnerPlayer.gravity; runnerPlayer.y += runnerPlayer.dy;
        if (runnerPlayer.y >= 140) { runnerPlayer.y = 140; runnerPlayer.dy = 0; runnerPlayer.isGrounded = true; }
        ctx.font = '35px Arial'; ctx.fillText('🏃‍♂️', runnerPlayer.x, runnerPlayer.y + 30);
    }

    let speedMult = isDashing ? 3 : 1; // 衝刺時畫面背景(障礙物)加速

    // 繪製增益 UI
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = '12px sans-serif';
    let uiY = 20;
    if (shoeTimer > 0) { ctx.fillText(`👟 增高鞋: ${Math.ceil(shoeTimer/60)}s`, 10, uiY); uiY += 18; }
    if (rocketTimer > 0) { ctx.fillText(`🚀 火箭(長按): ${Math.ceil(rocketTimer/60)}s`, 10, uiY); }

    // 生成道具 (約每 6 秒)
    if (frameCount % 360 === 0) {
        runnerItems.push({ x: -30, y: 70 + Math.random() * 20, w: 25, h: 25, type: Math.random() > 0.5 ? 'shoe' : 'rocket' });
    }

    // 更新道具
    for (let i = runnerItems.length - 1; i >= 0; i--) {
        let item = runnerItems[i];
        item.x += 5 * speedMult;
        ctx.font = '25px Arial'; ctx.fillText(item.type === 'shoe' ? '👟' : '🚀', item.x, item.y + 25);

        let px = runnerPlayer.x, py = runnerPlayer.y, pw = 20, ph = 30;
        if (px < item.x + item.w && px + pw > item.x && py < item.y + item.h && py + ph > item.y) {
            if (item.type === 'shoe') shoeTimer = 1800; // 重置為 30秒
            if (item.type === 'rocket') rocketTimer = 1800;
            runnerItems.splice(i, 1);
        } else if (item.x > canvas.width + 30) {
            runnerItems.splice(i, 1);
        }
    }

    // 生成與更新障礙物
    let spawnRate = isDashing ? 30 : 90; 
    if (frameCount % spawnRate === 0 || (frameCount % 130 === 0 && Math.random() > 0.5)) {
        runnerObstacles.push({ x: -30, y: 145, w: 20, h: 25, type: Math.random() > 0.4 ? '🚧' : '🧹' });
    }

    for (let i = runnerObstacles.length - 1; i >= 0; i--) {
        let obs = runnerObstacles[i]; obs.x += 5 * speedMult;
        ctx.font = '25px Arial'; ctx.fillText(obs.type, obs.x, obs.y + 25);

        let px = runnerPlayer.x + 5, py = runnerPlayer.y + 5, pw = 15, ph = 25; 
        let ox = obs.x + 5, oy = obs.y + 5, ow = 15, oh = 20;
        
        // 只有在非衝刺狀態才會被絆倒
        if (!isDashing && px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
            return gameOver('慘了，被絆倒錯過車了💸');
        }
        if (obs.x > canvas.width + 30) runnerObstacles.splice(i, 1);
    }
    
    if (frameCount % 60 === 0) { score++; document.getElementById('game-score').innerText = `存活時間: ${score} 秒`; }
}

// === 2. 下樓梯遊戲 (Diver) FPS 鎖定版 + 愛心 ===
function diverLoop(currentTime) {
    if (!isGameRunning || activeGame !== 'diver') return;
    gameAnimationId = requestAnimationFrame(diverLoop);

    const deltaTime = currentTime - lastRenderTime;
    if (deltaTime < FRAME_MIN_TIME) return;
    lastRenderTime = currentTime - (deltaTime % FRAME_MIN_TIME);

    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    // 繪製愛心 UI
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = '16px sans-serif';
    ctx.fillText(`❤️ x ${diverHearts}`, canvas.width - 65, 25);

    if (frameCount % 600 === 0) platformSpeed += 0.05; 

    if (keys.left || touchLeft) diverPlayer.x -= diverPlayer.speed;
    if (keys.right || touchRight) diverPlayer.x += diverPlayer.speed;
    if (diverPlayer.x < 0) diverPlayer.x = 0;
    if (diverPlayer.x + diverPlayer.w > canvas.width) diverPlayer.x = canvas.width - diverPlayer.w;

    let onPlatform = false; diverPlayer.dy += diverPlayer.gravity;

    for (let i = 0; i < platforms.length; i++) {
        let p = platforms[i]; p.y -= platformSpeed; 
        if (diverPlayer.dy > 0 && diverPlayer.x + diverPlayer.w > p.x && diverPlayer.x < p.x + p.w && diverPlayer.y + diverPlayer.h >= p.y && diverPlayer.y + diverPlayer.h <= p.y + diverPlayer.dy + platformSpeed + 5) {
            
            // 碰到紅梯，優先消耗愛心
            if (p.type === 'danger') {
                if (diverHearts > 0) {
                    diverHearts--;
                    p.type = 'safe'; // 淨化紅梯
                } else {
                    return gameOver('踩到碎玻璃受傷，急診送醫🚑');
                }
            }
            
            onPlatform = true; diverPlayer.y = p.y - diverPlayer.h; diverPlayer.dy = 0; 
            if (p.type === 'belt_left') diverPlayer.x -= 0.8;
            if (p.type === 'belt_right') diverPlayer.x += 0.8;
        }
        if (p.type === 'safe') ctx.fillStyle = '#4caf50';
        else if (p.type === 'danger') ctx.fillStyle = '#ff5252';
        else ctx.fillStyle = '#ffb300'; 
        ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    if (!onPlatform) { diverPlayer.y += diverPlayer.dy; } 
    ctx.font = '25px Arial'; ctx.fillText('🏃‍♂️', diverPlayer.x - 5, diverPlayer.y + 25);

    if (diverPlayer.y < -30) return gameOver('動作太慢，被關在閘門外了💸');
    if (diverPlayer.y > canvas.height) return gameOver('踩空摔斷腿，急診室見🚑');

    // 平台生成與愛心發放
    if (frameCount % 60 === 0) {
        let yPos = canvas.height + 10;
        let safeW = 70 + Math.random() * 40; let safeX = Math.random() * (canvas.width - safeW);
        let safeType = 'safe'; let r = Math.random();
        if (r > 0.8) safeType = 'belt_left'; else if (r > 0.6) safeType = 'belt_right';
        platforms.push({ x: safeX, y: yPos, w: safeW, h: 10, type: safeType });

        if (Math.random() > 0.7) {
            let dangerW = 50 + Math.random() * 30; let dangerX;
            if (safeX > canvas.width / 2) dangerX = Math.random() * (safeX - dangerW - 10); 
            else dangerX = safeX + safeW + 10 + Math.random() * (canvas.width - (safeX + safeW + 10) - dangerW);
            if (dangerX < 0) dangerX = 0; if (dangerX + dangerW > canvas.width) dangerX = canvas.width - dangerW;
            platforms.push({ x: dangerX, y: yPos, w: dangerW, h: 10, type: 'danger' });
        }

        score++; document.getElementById('game-score').innerText = `深入月台: B${score} 層`; 
        
        // 每 20 層生成一顆愛心在剛剛生成的安全平台上
        if (score > 0 && score % 20 === 0) {
            let target = platforms.find(p => p.y === yPos && p.type !== 'danger') || platforms[platforms.length - 1];
            diverItems.push({ x: target.x + target.w / 2 - 10, y: yPos - 25, w: 20, h: 20, type: 'heart' });
        }
    }
    platforms = platforms.filter(p => p.y > -20);

    // 更新與繪製愛心道具
    for (let i = diverItems.length - 1; i >= 0; i--) {
        let item = diverItems[i]; item.y -= platformSpeed;
        ctx.font = '18px Arial'; ctx.fillText('❤️', item.x, item.y + 18);

        let px = diverPlayer.x, py = diverPlayer.y, pw = diverPlayer.w, ph = diverPlayer.h;
        if (px < item.x + item.w && px + pw > item.x && py < item.y + item.h && py + ph > item.y) {
            diverHearts++; diverItems.splice(i, 1);
        } else if (item.y < -30) {
            diverItems.splice(i, 1);
        }
    }
}

// === 3. 終極密碼 (Password 1~99) 小鍵盤版 ===
function startPasswordGame() {
    pwdTarget = Math.floor(Math.random() * 99) + 1; pwdGuesses = 0; pwdMin = 1; pwdMax = 99; currentPwdInput = "";
    document.getElementById('game-score').innerText = `目前猜了: 0 次`;
    document.getElementById('game-hint').innerText = '請點擊數字並猜測！'; document.getElementById('game-hint').style.color = '#888';
    document.getElementById('pwd-range-display').innerText = `${pwdMin} ~ ${pwdMax}`; document.getElementById('pwd-range-display').style.color = 'white';
    document.getElementById('pwd-display-box').innerText = '?';
    document.querySelectorAll('.pwd-key').forEach(btn => btn.disabled = false);
}

function submitPasswordGuess() {
    if (!isGameRunning || currentPwdInput === "") return;
    const num = parseInt(currentPwdInput);
    if (isNaN(num) || num <= pwdMin || num >= pwdMax) {
        document.getElementById('game-hint').innerText = `請輸入大於 ${pwdMin} 且小於 ${pwdMax} 的數字！`;
        document.getElementById('game-hint').style.color = 'var(--warning)';
        currentPwdInput = ""; document.getElementById('pwd-display-box').innerText = "?"; return;
    }
    pwdGuesses++; document.getElementById('game-score').innerText = `目前猜了: ${pwdGuesses} 次`;
    currentPwdInput = ""; document.getElementById('pwd-display-box').innerText = "?";
    
    if (num === pwdTarget) {
        document.getElementById('pwd-range-display').innerText = `🎉 ${pwdTarget} 🎉`;
        document.getElementById('pwd-range-display').style.color = 'var(--success)';
        gameOver(`🎉 砰！密碼就是 ${pwdTarget}！`);
    } else {
        if (num > pwdTarget) { pwdMax = num; document.getElementById('game-hint').innerText = `${num} 太大了！往下猜👇`; } 
        else { pwdMin = num; document.getElementById('game-hint').innerText = `${num} 太小了！往上猜👆`; }
        document.getElementById('pwd-range-display').innerText = `${pwdMin} ~ ${pwdMax}`;
        document.getElementById('game-hint').style.color = 'var(--warning)';
        if (pwdMax - pwdMin === 2 && pwdMin + 1 === pwdTarget) document.getElementById('game-hint').innerText = `只剩一個數字了，你沒得選啦🤣`;
    }
}
