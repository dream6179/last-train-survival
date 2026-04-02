// ==========================================
// 🚀 核心業務與時鐘 (main.js)
// ==========================================
let isCountingDown = false; 
let timeLeft = 0;           
let globalStationData = null;
let offlineTimetableData = null;
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

window.addEventListener('load', async () => {
    try { 
        const res = await fetch('/data/stations.json'); 
        if(res.ok) {
            globalStationData = await res.json();
            if (typeof initCustomAutocomplete === 'function') initCustomAutocomplete();
            document.getElementById('start-station-input').value = localStorage.getItem('lastTrainStart') || '台北車站';
            document.getElementById('end-station-input').value = localStorage.getItem('lastTrainEnd') || '台北車站';
        }
    } catch(e){}
    try { 
        const timeRes = await fetch('/data/offline-timetable.json'); 
        if(timeRes.ok) offlineTimetableData = await timeRes.json(); 
    } catch(e){}
});

window.handleAction = async function() {
    const startType = document.getElementById('start-type').value;
    let startInput = document.getElementById('start-station-input').value.trim();
    let endInput = document.getElementById('end-station-input').value.trim();
    const statusLabel = document.querySelector('.time-area .status:first-child'); // 抓取「現在時間」標籤

    if (!startInput || !endInput) return alert("⚠️ 請輸入起訖點");
    const btn = document.getElementById('action-btn'); btn.innerHTML = "⏳ 計算中..."; btn.disabled = true;

    try {
        let transferName = startInput;
        if (startType === 'tra' || startType === 'thsr') {
            transferName = document.getElementById('transfer-station-input').value;
        }

        let res = await window.fetchTwoStageSurvivalTime(startType, startInput, startInput, transferName, endInput, offlineTimetableData);
        
        if (res.time) {
            document.getElementById('speed-mode').innerText = res.time;
            document.getElementById('cancel-btn').style.display = 'flex';
            btn.style.display = 'none';
            
            // 🌟 狀態切換與倒數初始化
            if (statusLabel) statusLabel.innerText = "剩餘時間";
            isCountingDown = true;
            
            const now = new Date(); let target = new Date();
            const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
            if (now > target) target.setDate(target.getDate() + 1);
            timeLeft = Math.floor((target - now) / 1000);
            if (timeLeft > 28800) timeLeft = 0; 
        } else {
            alert("❌ " + res.status);
        }
    } catch (e) { alert("系統計算異常"); }
    finally { btn.disabled = false; btn.innerHTML = "開始計算轉乘"; }
};

window.resetPlan = function() {
    isCountingDown = false;
    const statusLabel = document.querySelector('.time-area .status:first-child');
    if (statusLabel) statusLabel.innerText = "現在時間";
    
    document.getElementById('action-btn').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'none';
    document.getElementById('plan-b-container').style.display = 'none';
    document.getElementById('speed-mode').innerText = '待查驗...';
    const disp = document.getElementById('time-display');
    if(disp) disp.style.fontSize = '50px';
};

function updateClock() {
    const display = document.getElementById('time-display');
    if (!display) return;
    const now = new Date();
    
    if (!isCountingDown) { 
        display.innerHTML = now.toTimeString().split(' ')[0]; 
    } else {
        if (timeLeft <= 0) { 
            display.style.fontSize = '32px'; 
            display.innerHTML = "來不及了 💸"; 
            document.getElementById('plan-b-container').style.display = 'flex'; 
            document.getElementById('cancel-btn').style.display = 'none';
            return; 
        }
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h<10?'0':''}${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}
setInterval(updateClock, 1000);
