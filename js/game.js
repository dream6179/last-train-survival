// ==========================================
// 隱藏彩蛋雙引擎 (v3.0 跑酷 & 下樓梯豪華版)
// ==========================================

let activeGame = null; // 'runner' 或是 'diver'
let gameAnimationId;
let frameCount = 0;
let score = 0;
let isGameRunning = false;

// === 跑酷遊戲 (Runner) 變數 ===
let runnerClicks = 0; let runnerTimer;
let runnerPlayer = { x: 280, y: 140, w: 20, h: 30, dy: 0, gravity: 0.6, jumpPower: -10, isGrounded: true };
let runnerObstacles = [];
let runnerHighScore = localStorage.getItem('lateCommuterHighScore') || 0;

// === 下樓梯遊戲 (Diver) 變數 ===
let diverClicks = 0; let diverTimer;
let diverPlayer = { x: 165, y: 50, w: 20, h: 30, dx: 0, dy: 0, speed: 4, gravity: 0.4 };
let platforms = [];
let diverHighScore = localStorage.getItem('deepStationHighScore') || 0;
let keys = { left: false, right: false };
let touchLeft = false; let touchRight = false;
let platformSpeed = 2; // 樓梯上升速度

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

function openGameSheet() {
    document.getElementById('overlay').classList.add('active');
    document.getElementById('game-sheet').classList.add('active');
    initGameCanvas();
}

// === 遊戲初始化與共用控制 ===
function initGameCanvas() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // 依據遊戲調整畫布高度
    canvas.height = activeGame === 'runner' ? 200 : 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    document.getElementById('start-game-btn').style.display = 'inline-block';
    document.getElementById('start-game-btn').innerText = '開始挑戰';
    document.getElementById('game-score').innerText = '存活時間: 0 秒';

    if (activeGame === 'runner') {
        document.getElementById('game-title').innerText = '🏃‍♂️ 社畜的最後衝刺';
        document.getElementById('game-hint').innerText = '點擊畫面跳躍，閃避障礙物！';
        runnerHighScore = localStorage.getItem('lateCommuterHighScore') || 0;
        document.getElementById('game-high-score').innerText = `歷史最高: ${runnerHighScore} 秒`;
    } else {
        document.getElementById('game-title').innerText = '🚇 直奔最深月台';
        document.getElementById('game-hint').innerText = '點擊畫面左右半邊，或用鍵盤左右鍵移動！';
        diverHighScore = localStorage.getItem('deepStationHighScore') || 0;
        document.getElementById('game-high-score').innerText = `歷史最高: ${diverHighScore} 秒`;
    }
    document.getElementById('game-high-score').style.color = '#888';
}

function startActiveGame() {
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    isGameRunning = true; score = 0; frameCount = 0;
    document.getElementById('start-game-btn').style.display = 'none';

    if (activeGame === 'runner') {
        runnerPlayer.y = 140; runnerPlayer.dy = 0; runnerPlayer.isGrounded = true;
        runnerObstacles = [];
        runnerLoop();
    } else {
        diverPlayer.x = 165; diverPlayer.y = 50; diverPlayer.dx = 0; diverPlayer.dy = 0;
        platforms = []; platformSpeed = 2; keys.left = false; keys.right = false;
        // 初始第一塊安全平台
        platforms.push({ x: 140, y: 150, w: 70, h: 10, type: 'safe' });
        diverLoop();
    }
}

// === 輸入綁定 ===
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    // 電腦鍵盤
    document.addEventListener('keydown', (e) => { 
        if (!document.getElementById('game-sheet').classList.contains('active')) return;
        if (activeGame === 'runner' && (e.code === 'Space' || e.code === 'ArrowUp')) { e.preventDefault(); jumpRunner(); }
        if (activeGame === 'diver') {
            if (e.code === 'ArrowLeft') keys.left = true;
            if (e.code === 'ArrowRight') keys.right = true;
        }
    });
    document.addEventListener('keyup', (e) => { 
        if (activeGame === 'diver') {
            if (e.code === 'ArrowLeft') keys.left = false;
            if (e.code === 'ArrowRight') keys.right = false;
        }
    });

    // 手機觸控與滑鼠
    canvas.addEventListener('mousedown', (e) => handleTouchPoint(e, canvas));
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouchPoint(e.touches[0], canvas); }, {passive: false});
    
    // 釋放觸控 (專門給 Diver)
    canvas.addEventListener('mouseup', () => { touchLeft = false; touchRight = false; });
    canvas.addEventListener('touchend', () => { touchLeft = false; touchRight = false; });
});

function handleTouchPoint(e, canvas) {
    if (!isGameRunning) return;
    if (activeGame === 'runner') { jumpRunner(); }
    else if (activeGame === 'diver') {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < canvas.width / 2) { touchLeft = true; touchRight = false; }
        else { touchRight = true; touchLeft = false; }
    }
}

function jumpRunner() {
    if (runnerPlayer.isGrounded && isGameRunning) { runnerPlayer.dy = runnerPlayer.jumpPower; runnerPlayer.isGrounded = false; }
}

function gameOver(reason) {
    isGameRunning = false;
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'var(--danger)'; ctx.font = '22px bold sans-serif';
    ctx.fillText(reason, 40, canvas.height / 2);
    
    document.getElementById('start-game-btn').style.display = 'inline-block';
    document.getElementById('start-game-btn').innerText = '不甘心，再試一次';

    if (activeGame === 'runner' && score > runnerHighScore) {
        runnerHighScore = score; localStorage.setItem('lateCommuterHighScore', runnerHighScore);
        document.getElementById('game-high-score').innerText = `歷史最高: ${runnerHighScore} 秒 (新紀錄!)`;
        document.getElementById('game-high-score').style.color = 'var(--danger)';
    } else if (activeGame === 'diver' && score > diverHighScore) {
        diverHighScore = score; localStorage.setItem('deepStationHighScore', diverHighScore);
        document.getElementById('game-high-score').innerText = `歷史最高: ${diverHighScore} 秒 (新紀錄!)`;
        document.getElementById('game-high-score').style.color = 'var(--danger)';
    }
    if (typeof updateCollectionUI === 'function') updateCollectionUI();
}

// === 1. 跑酷遊戲邏輯 (Runner) ===
function runnerLoop() {
    if (!isGameRunning || activeGame !== 'runner') return;
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    runnerPlayer.dy += runnerPlayer.gravity; runnerPlayer.y += runnerPlayer.dy;
    if (runnerPlayer.y >= 140) { runnerPlayer.y = 140; runnerPlayer.dy = 0; runnerPlayer.isGrounded = true; }

    ctx.font = '35px Arial'; ctx.fillText('🏃‍♂️', runnerPlayer.x, runnerPlayer.y + 30);

    if (frameCount % 90 === 0 || (frameCount % 130 === 0 && Math.random() > 0.5)) {
        runnerObstacles.push({ x: -30, y: 145, w: 20, h: 25, type: Math.random() > 0.4 ? '🚧' : '🧹' });
    }

    for (let i = 0; i < runnerObstacles.length; i++) {
        let obs = runnerObstacles[i]; obs.x += 5;
        ctx.font = '25px Arial'; ctx.fillText(obs.type, obs.x, obs.y + 25);

        let px = runnerPlayer.x + 5, py = runnerPlayer.y + 5, pw = 15, ph = 25; 
        let ox = obs.x + 5, oy = obs.y + 5, ow = 15, oh = 20;
        if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
            return gameOver('慘了，被絆倒錯過車了💸');
        }
    }
    runnerObstacles = runnerObstacles.filter(o => o.x < canvas.width + 30);

    if (frameCount % 60 === 0) { score++; document.getElementById('game-score').innerText = `存活時間: ${score} 秒`; }
    gameAnimationId = requestAnimationFrame(runnerLoop);
}

// === 2. 下樓梯遊戲邏輯 (Diver) ===
function diverLoop() {
    if (!isGameRunning || activeGame !== 'diver') return;
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    // 隨時間加快平台速度
    if (frameCount % 600 === 0) platformSpeed += 0.2; 

    // 控制左右
    if (keys.left || touchLeft) diverPlayer.x -= diverPlayer.speed;
    if (keys.right || touchRight) diverPlayer.x += diverPlayer.speed;
    
    // 牆壁邊界
    if (diverPlayer.x < 0) diverPlayer.x = 0;
    if (diverPlayer.x + diverPlayer.w > canvas.width) diverPlayer.x = canvas.width - diverPlayer.w;

    // 物理與碰撞
    let onPlatform = false;
    diverPlayer.dy += diverPlayer.gravity;

    for (let i = 0; i < platforms.length; i++) {
        let p = platforms[i];
        p.y -= platformSpeed; // 平台往上移

        // 碰撞判定：玩家往下掉，且腳底碰到平台上方
        if (diverPlayer.dy > 0 && 
            diverPlayer.x + diverPlayer.w > p.x && 
            diverPlayer.x < p.x + p.w && 
            diverPlayer.y + diverPlayer.h >= p.y && 
            diverPlayer.y + diverPlayer.h <= p.y + diverPlayer.dy + platformSpeed + 5) {
            
            if (p.type === 'danger') {
                return gameOver('踩到碎玻璃受傷，急診送醫🚑');
            }
            
            onPlatform = true;
            diverPlayer.y = p.y - diverPlayer.h;
            diverPlayer.dy = 0; // 站在平台上不往下掉
            
            // 輸送帶效果
            if (p.type === 'belt_left') diverPlayer.x -= 2;
            if (p.type === 'belt_right') diverPlayer.x += 2;
        }
        
        // 畫出平台
        if (p.type === 'safe') ctx.fillStyle = '#4caf50';
        else if (p.type === 'danger') ctx.fillStyle = '#ff5252';
        else ctx.fillStyle = '#ffb300'; // 輸送帶
        ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    if (!onPlatform) { diverPlayer.y += diverPlayer.dy; } // 如果沒踩在平台上，繼續往下掉

    // 畫出主角
    ctx.font = '25px Arial'; ctx.fillText('🏃‍♂️', diverPlayer.x - 5, diverPlayer.y + 25);

    // 死亡判定
    if (diverPlayer.y < -30) return gameOver('動作太慢，被關在閘門外了💸');
    if (diverPlayer.y > canvas.height) return gameOver('踩空摔斷腿，急診室見🚑');

    // 隨機生成新平台
    if (frameCount % 45 === 0) {
        let w = 70 + Math.random() * 40;
        let x = Math.random() * (canvas.width - w);
        let rand = Math.random();
        let type = 'safe';
        if (rand > 0.8) type = 'danger'; // 20% 是危險平台
        else if (rand > 0.6) type = 'belt_left'; // 20% 向左
        else if (rand > 0.4) type = 'belt_right'; // 20% 向右
        platforms.push({ x: x, y: canvas.height + 10, w: w, h: 10, type: type });
    }

    // 清除畫面上方的平台
    platforms = platforms.filter(p => p.y > -20);

    if (frameCount % 60 === 0) { score++; document.getElementById('game-score').innerText = `深入月台: B${score} 層`; }
    gameAnimationId = requestAnimationFrame(diverLoop);
}
