// ==========================================
// 隱藏彩蛋：社畜的最後衝刺 (v2.1 收集冊與成就版)
// ==========================================

let eggClicks = 0; 
let eggTimer;
let isGameRunning = false;
let score = 0;
let frameCount = 0;
let gameAnimationId;
let highScore = localStorage.getItem('lateCommuterHighScore') || 0;

// 🌟 人物放在右邊 (x: 280)，模擬向左跑
let player = { x: 280, y: 140, width: 20, height: 30, dy: 0, gravity: 0.6, jumpPower: -10, isGrounded: true };
let obstacles = [];

// force 參數是為了讓收集冊可以直接點擊啟動遊戲
function triggerEasterEgg(force = false) {
    eggClicks++;
    clearTimeout(eggTimer);
    eggTimer = setTimeout(() => { eggClicks = 0; }, 1500);
    
    if (eggClicks >= 5 || force) {
        eggClicks = 0;
        
        // 🌟 核心：只要觸發過一次，就永久解鎖這個彩蛋！
        localStorage.setItem('unlock_runner', 'true');
        if (typeof updateCollectionUI === 'function') updateCollectionUI(); // 通知首頁更新圖鑑

        document.getElementById('overlay').classList.add('active');
        document.getElementById('game-sheet').classList.add('active');
        initGameCanvas();
    }
}

function initGameCanvas() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666'; 
    ctx.font = '16px sans-serif';
    ctx.fillText('準備好衝刺了嗎？', 100, 100);
    
    document.getElementById('start-game-btn').style.display = 'inline-block';
    document.getElementById('start-game-btn').innerText = '開始衝刺';
    document.getElementById('game-score').innerText = '存活時間: 0 秒';
    
    highScore = localStorage.getItem('lateCommuterHighScore') || 0;
    document.getElementById('game-high-score').innerText = `歷史最高: ${highScore} 秒`;
    document.getElementById('game-high-score').style.color = '#888';
}

function startRunnerGame() {
    player.y = 140; 
    player.dy = 0; 
    player.isGrounded = true;
    obstacles = []; 
    score = 0; 
    frameCount = 0; 
    isGameRunning = true;
    
    document.getElementById('start-game-btn').style.display = 'none';
    
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    gameLoop();
}

function jumpGamePlayer() {
    if (player.isGrounded && isGameRunning) {
        player.dy = player.jumpPower; 
        player.isGrounded = false;
    }
}

// 綁定跳躍事件
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        canvas.addEventListener('mousedown', jumpGamePlayer);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jumpGamePlayer(); }, {passive: false});
    }
});

document.addEventListener('keydown', (e) => { 
    if ((e.code === 'Space' || e.code === 'ArrowUp') && document.getElementById('game-sheet').classList.contains('active')) {
        e.preventDefault(); 
        jumpGamePlayer(); 
    } 
});

function gameLoop() {
    if (!isGameRunning) return;
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    // 1. 物理引擎 (重力)
    player.dy += player.gravity;
    player.y += player.dy;
    if (player.y >= 140) { player.y = 140; player.dy = 0; player.isGrounded = true; }

    // 2. 畫出主角 (奔跑的社畜) - 現在放在右邊
    ctx.font = '35px Arial';
    ctx.fillText('🏃‍♂️', player.x, player.y + 30);

    // 3. 生成與移動障礙物 (從左邊出現，往右飛)
    if (frameCount % 90 === 0 || (frameCount % 130 === 0 && Math.random() > 0.5)) {
        obstacles.push({ x: -30, y: 145, w: 20, h: 25, type: Math.random() > 0.4 ? '🚧' : '🧹' });
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x += 5; // 往右跑
        
        ctx.font = '25px Arial';
        ctx.fillText(obs.type, obs.x, obs.y + 25);

        // 4. 碰撞判定
        let px = player.x + 5, py = player.y + 5, pw = 15, ph = 25; 
        let ox = obs.x + 5, oy = obs.y + 5, ow = 15, oh = 20;
        
        if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
            isGameRunning = false;
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'var(--danger)'; ctx.font = '24px bold sans-serif';
            ctx.fillText('慘了，錯過車了💸', 80, 100);
            
            document.getElementById('start-game-btn').style.display = 'inline-block';
            document.getElementById('start-game-btn').innerText = '不甘心，再跑一次';
            
            // 紀錄最高分
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('lateCommuterHighScore', highScore);
                document.getElementById('game-high-score').innerText = `歷史最高: ${highScore} 秒 (新紀錄!)`;
                document.getElementById('game-high-score').style.color = 'var(--danger)';
                if (typeof updateCollectionUI === 'function') updateCollectionUI(); // 更新圖鑑分數
            }
            return;
        }
    }
    
    // 清除跑出畫面右側的障礙物
    obstacles = obstacles.filter(o => o.x < canvas.width + 30);

    // 5. 計分板 
    if (frameCount % 60 === 0) { 
        score++; 
        document.getElementById('game-score').innerText = `存活時間: ${score} 秒`; 
    }

    gameAnimationId = requestAnimationFrame(gameLoop);
}
