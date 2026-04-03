// ==========================================
// 🔴 結果槽專屬大腦 (survival-engine.js)
// ==========================================

let isCountingDown = false; 
let timeLeft = 0; 
let offlineTimetableData = null;
let busMapData = {}; // 🌟 新增：用來存放公車字典

window.addEventListener('load', async () => {
    try { 
        // 載入離線時刻表
        const timeRes = await fetch('/data/offline-timetable.json'); 
        if(timeRes.ok) offlineTimetableData = await timeRes.json(); 

        // 🌟 新增：載入公車翻譯字典
        const busMapRes = await fetch('/data/bus-map.json');
        if(busMapRes.ok) busMapData = await busMapRes.json();
    } catch(e){
        console.error("資料載入失敗", e);
    }
});

// 🌟 復活：如月車站全域事件
window.triggerKisaragiEvent = function() {
    isCountingDown = false; timeLeft = 0;
    const bgm = document.getElementById('bgm-audio'); if (bgm) bgm.pause();
    
    const overlay = document.createElement('div');
    overlay.id = 'kisaragi-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background-color:#050505;z-index:9999999;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;text-align:center;font-family:"Courier New", monospace; pointer-events:all; animation: glitch 0.2s infinite;';
    
    const style = document.createElement('style');
    style.innerHTML = `@keyframes glitch { 0% { opacity: 1; filter: contrast(1); } 50% { opacity: 0.9; filter: contrast(1.5) invert(0.1); } 100% { opacity: 1; filter: contrast(1); } }`;
    document.head.appendChild(style);

    overlay.innerHTML = `
        <h1 style="color:#ff0000; font-size:45px; margin-bottom:20px; text-shadow: 2px 2px 20px #ff0000; letter-spacing: 8px;">如月車站</h1>
        <p style="color:#cccccc; font-size:15px; line-height:2.5; margin-bottom: 40px; text-align: left; border-left: 2px solid #ff0000; padding-left: 15px;">
            > 系統警告：電車已駛入未知的軌道。<br>
            > 錯誤：無法連接 TDX 資料庫。<br>
            > 錯誤：GPS 訊號遺失。<br>
            > 偵測到外部音源：微弱的太鼓聲...<br>
            <span style="color:#ff5252; font-size: 13px; font-weight:bold; display:block; margin-top:15px;">※ 警告：請勿離開車廂，請勿回頭。</span>
        </p>
        <button onclick="escapeKisaragi()" style="background:transparent; border:1px solid #ff0000; color:#ff0000; padding:15px 30px; border-radius:8px; font-size:16px; cursor:pointer; box-shadow: 0 0 15px rgba(255,0,0,0.4); font-weight:bold;">沿著伊佐貫隧道狂奔</button>
    `;
    document.body.appendChild(overlay);
};

window.escapeKisaragi = function() {
    const overlay = document.getElementById('kisaragi-overlay');
    if(overlay) overlay.remove();
    
    if (localStorage.getItem('unlock_kisaragi') === 'true') {
        alert('🏃‍♂️ 你死命地沿著隧道狂奔，身後的太鼓聲漸漸遠去，終於回到了現實世界...\n\n（你已經逃出過這裡了，但那股寒意依舊揮之不去...）');
    } else {
        localStorage.setItem('unlock_kisaragi', 'true');
        alert('🏃‍♂️ 你死命地沿著隧道狂奔，身後的太鼓聲漸漸遠去，終於回到了現實世界...\n\n🎉 恭喜解鎖隱藏成就【從不存在的車站歸來】！');
    }
    
    // SPA 架構跳轉彩蛋頁面
    if(typeof window.openPage === 'function') {
        window.openPage('/collection.html');
    }
};

window.handleAction = async function() {
    const startType = document.getElementById('start-type').value;
    const endType = document.getElementById('end-type').value; // 🌟 抓取終點的交通工具類型
    let startName = document.getElementById('start-station-input').value.trim();
    const endName = document.getElementById('end-station-input').value.trim();
    
    // 🌟 1. 攔截如月車站查詢
    if (endName === '如月車站' || endName.toUpperCase() === 'KISARAGI') {
        window.triggerKisaragiEvent();
        return;
    }

    // 🌟 2. 基礎空值防禦：檢查路線或車站是否為空
    if (!startName || !endName) {
        alert("🚨 求生警告：你還沒輸入起點或目的地！\n導遊沒辦法帶你去一個不存在的地方。");
        return;
    }
    
    // 🌟 3. 公車專屬檢查 (起點)
    if (startType === 'bus') {
        let startStop = document.getElementById('start-bus-stop-input').value.trim();
        if (!startStop) {
            alert("🚌 請輸入起點站牌！\n沒站牌，司機不知道要在哪裡接你喔。");
            return;
        }
        startName += `|${startStop}`;
    }

    // 🌟 4. 【新增】公車專屬檢查 (終點)
    if (endType === 'bus') {
        let endStop = document.getElementById('end-bus-stop-input').value.trim();
        if (!endStop) {
            alert("🚌 請輸入終點站牌！\n沒站牌，系統不知道你到底要在哪裡下車喔。");
            return;
        }
    }
    
    const btn = document.getElementById('action-btn'); btn.innerHTML = "⏳ 計算中..."; btn.disabled = true;
    try {
        let transferName = (startType === 'tra' || startType === 'thsr') ? document.getElementById('transfer-station-input').value : startName;
        let res = await fetchTwoStageSurvivalTime(startType, startName, startName, transferName, endName, offlineTimetableData);
        
        if (res.time) {
            document.getElementById('speed-mode').innerText = res.time;
            document.getElementById('cancel-btn').style.display = 'flex';
            btn.style.display = 'none';
            document.querySelector('.time-area .status').innerText = "剩餘時間";
            isCountingDown = true;
            
            const now = typeof window.getSystemTime === 'function' ? window.getSystemTime() : new Date();
            const [hh, mm] = res.time.split(':').map(Number);
            let nowTotalMins = now.getHours() < 4 ? (now.getHours() + 24) * 60 + now.getMinutes() : now.getHours() * 60 + now.getMinutes();
            let targetTotalMins = hh < 4 ? (hh + 24) * 60 + mm : hh * 60 + mm;
            let diffMins = targetTotalMins - nowTotalMins;

            if (diffMins <= 0) timeLeft = 0; else timeLeft = diffMins * 60 - now.getSeconds(); 
        } else {
            alert(res.status);
        }
    } catch (e) { alert("計算失敗"); }
    finally { btn.disabled = false; btn.innerHTML = "開始計算轉乘"; }
};

window.resetPlan = function() {
    isCountingDown = false;
    document.querySelector('.time-area .status').innerText = "現在時間";
    document.getElementById('action-btn').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'none';
    document.getElementById('plan-b-container').style.display = 'none';
    document.getElementById('speed-mode').innerText = '待查驗...';
    if(document.getElementById('time-display')) document.getElementById('time-display').style.fontSize = '55px';
};

setInterval(() => {
    const display = document.getElementById('time-display');
    if (!display) return;
    
    if (!isCountingDown) { 
        const now = typeof window.getSystemTime === 'function' ? window.getSystemTime() : new Date();
        display.innerHTML = now.toTimeString().split(' ')[0]; 
    } else {
        if (timeLeft <= 0) { 
            display.style.fontSize = '35px'; display.innerHTML = "來不及了 💸"; 
            document.getElementById('plan-b-container').style.display = 'flex'; 
            return; 
        }
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}, 1000);
