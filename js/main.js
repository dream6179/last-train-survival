// ==========================================
// 核心變數
// ==========================================
let currentMode = 'survival'; 
let isCountingDown = false; 
let timeLeft = 0;           
let globalStationData = null;
let offlineTimetableData = null;
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

// ==========================================
// 視窗控制 (SPA & Sheets)
// ==========================================
window.openPage = function(url) { 
    document.getElementById('spa-frame').src = url; 
    document.getElementById('overlay').classList.add('active'); 
    document.getElementById('overlay').style.zIndex="99990"; 
    document.getElementById('dynamic-sheet').classList.add('active'); 
};

window.closeDynamicSheet = function() { 
    document.getElementById('dynamic-sheet').classList.remove('active'); 
    setTimeout(() => { 
        document.getElementById('spa-frame').src='about:blank'; 
        document.getElementById('overlay').classList.remove('active'); 
        document.getElementById('overlay').style.zIndex="90"; 
    }, 300); 
};

function closeAllSheets() { 
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); 
    document.getElementById('overlay').classList.remove('active'); 
}

// 🌟 之前弄丟的兩個關鍵 UI 函數補回來了！
function toggleContact() {
    const l = document.getElementById('contact-links');
    if(l) l.style.display = (l.style.display === "flex") ? "none" : "flex";
}

function openSettingsSheet() {
    const overlay = document.getElementById('overlay');
    const sheet = document.getElementById('settings-sheet');
    if(overlay && sheet) {
        overlay.classList.add('active');
        sheet.classList.add('active');
    }
}

// ==========================================
// 核心功能邏輯
// ==========================================
window.addEventListener('load', async () => {
    try { const res = await fetch('/data/stations.json'); if(res.ok) globalStationData = await res.json(); } catch(e){}
    try { const timeRes = await fetch('/data/offline-timetable.json'); if(timeRes.ok) offlineTimetableData = await timeRes.json(); } catch(e){}
});

async function updateStationOptions(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById(point + '-bus-stop-block');
    if (type === 'bus') {
        input.value = ''; input.placeholder = "輸入路線 (如: 265)";
        if(busBlock) busBlock.style.display = 'flex';
    } else {
        if(busBlock) busBlock.style.display = 'none';
        input.value = defaultStations[type] || '';
    }
}

async function handleAction() {
    const type = document.getElementById('start-type').value;
    let start = document.getElementById('start-station-input').value.trim();
    if(type === 'bus') {
        let stop = document.getElementById('start-bus-stop-input').value.trim();
        if(stop) start += `|${stop}`;
    }
    const end = document.getElementById('end-station-input').value.trim();
    
    const btn = document.getElementById('action-btn'); btn.innerHTML = "⏳ 計算中..."; btn.disabled = true;
    try {
        let res = await fetchTwoStageSurvivalTime(type, start, '', '', end, offlineTimetableData);
        if (res.time) {
            document.getElementById('speed-mode').innerText = res.time;
            document.getElementById('cancel-btn').style.display='flex';
            btn.style.display='none';
            isCountingDown = true;
            const now = getSystemTime(); let target = getSystemTime();
            const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
            if (now > target) target.setDate(target.getDate() + 1);
            timeLeft = Math.floor((target - now) / 1000);
            if (timeLeft > 28800) timeLeft = 0; 
        } else alert(res.status);
    } catch (e) { alert("計算失敗"); }
    finally { btn.disabled = false; btn.innerHTML = "開始計算轉乘"; }
}

function resetPlan() { 
    isCountingDown = false; 
    document.getElementById('action-btn').style.display = 'block'; 
    document.getElementById('cancel-btn').style.display = 'none'; 
    document.getElementById('plan-b-container').style.display = 'none'; 
    document.getElementById('speed-mode').innerText = '待查驗...'; 
}

function updateClock() {
    const display = document.getElementById('time-display');
    if (!display || typeof getSystemTime !== 'function') return;
    const now = getSystemTime();
    if (!isCountingDown) { 
        display.innerHTML = now.toTimeString().split(' ')[0]; 
    } else {
        if (timeLeft <= 0) { display.innerHTML = "來不及了💸"; document.getElementById('plan-b-container').style.display = 'flex'; return; }
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h<10?'0':''}${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}
setInterval(updateClock, 1000);
