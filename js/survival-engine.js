// ==========================================
// 🔴 結果槽專屬大腦 (survival-engine.js) - 跨日修正版
// ==========================================

let isCountingDown = false; 
let timeLeft = 0; 
let offlineTimetableData = null;

window.addEventListener('load', async () => {
    try { const timeRes = await fetch('/data/offline-timetable.json'); if(timeRes.ok) offlineTimetableData = await timeRes.json(); } catch(e){}
});

window.handleAction = async function() {
    const startType = document.getElementById('start-type').value;
    let startName = document.getElementById('start-station-input').value.trim();
    const endName = document.getElementById('end-station-input').value.trim();
    if(startType === 'bus') { let stop = document.getElementById('start-bus-stop-input').value.trim(); if(stop) startName += `|${stop}`; }
    
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
            
            // 🌟 核心修正：支援開發者時間與 04:00 營業日判定
            const now = typeof window.getSystemTime === 'function' ? window.getSystemTime() : new Date();
            const [hh, mm] = res.time.split(':').map(Number);
            
            let nowHours = now.getHours();
            let nowMinutes = now.getMinutes();
            let nowSeconds = now.getSeconds();

            // 將凌晨 00:00~03:59 視為同一營業日的「深夜」(+24小時)
            let nowTotalMins = nowHours < 4 ? (nowHours + 24) * 60 + nowMinutes : nowHours * 60 + nowMinutes;
            let targetTotalMins = hh < 4 ? (hh + 24) * 60 + mm : hh * 60 + mm;

            let diffMins = targetTotalMins - nowTotalMins;

            if (diffMins <= 0) {
                // 如果目前時間已經超過目標時間，代表「今晚的車已經開走」
                timeLeft = 0; 
            } else {
                // 還沒開走，正常倒數（無上限限制，早上查晚上也行）
                timeLeft = diffMins * 60 - nowSeconds; 
            }
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
        // 🌟 修正待機時間：連動開發者模式的鎖定時間
        const now = typeof window.getSystemTime === 'function' ? window.getSystemTime() : new Date();
        display.innerHTML = now.toTimeString().split(' ')[0]; 
    } else {
        if (timeLeft <= 0) { 
            display.style.fontSize = '35px'; 
            display.innerHTML = "來不及了 💸"; 
            document.getElementById('plan-b-container').style.display = 'flex'; 
            return; 
        }
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}, 1000);
