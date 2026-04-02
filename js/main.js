let currentMode = 'survival'; 
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; 
let savedStart = localStorage.getItem('lastTrainStart') || '台北車站'; 
let savedEnd = localStorage.getItem('lastTrainEnd') || '台北車站';
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

// SPA 視窗與 UI 切換
window.openPage = function(url) { document.getElementById('spa-frame').src = url; document.getElementById('overlay').classList.add('active'); document.getElementById('overlay').style.zIndex="99990"; document.getElementById('dynamic-sheet').classList.add('active'); };
window.closeDynamicSheet = function() { document.getElementById('dynamic-sheet').classList.remove('active'); setTimeout(() => { document.getElementById('spa-frame').src='about:blank'; document.getElementById('overlay').classList.remove('active'); document.getElementById('overlay').style.zIndex="90"; }, 300); };
function closeAllSheets() { document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); document.getElementById('overlay').classList.remove('active'); }
function toggleAppMode() {
    const modeSurvival = document.getElementById('mode-survival'); const modeSearch = document.getElementById('mode-search'); const toggleBtn = document.getElementById('mode-toggle-btn'); const mainTitle = document.getElementById('main-title');
    if (currentMode === 'survival') { modeSurvival.style.display = 'none'; modeSearch.style.display = 'block'; toggleBtn.innerHTML = '🏠'; mainTitle.innerHTML = '時刻表檢索'; currentMode = 'search'; } 
    else { modeSearch.style.display = 'none'; modeSurvival.style.display = 'block'; toggleBtn.innerHTML = '🔍'; mainTitle.innerText = "末班車生存"; currentMode = 'survival'; }
}

// 站點資料載入
let offlineTimetableData = null; let globalStationData = null;
window.addEventListener('load', async () => {
    try { const res = await fetch('/data/stations.json'); if(res.ok) { globalStationData = await res.json(); document.getElementById('start-station-input').value = savedStart; document.getElementById('end-station-input').value = savedEnd; } } catch(e){}
    try { const timeRes = await fetch('/data/offline-timetable.json'); if(timeRes.ok) offlineTimetableData = await timeRes.json(); } catch(e){}
});

// 🌟 核心修改：處理公車專屬的站牌輸入框顯示/隱藏
async function updateStationOptions(point) {
    const typeSelect = document.getElementById(point + '-type');
    const inputField = document.getElementById(point + '-station-input');
    const busStopBlock = document.getElementById(point + '-bus-stop-block');
    
    if (typeSelect.value === 'bus') {
        inputField.value = ''; inputField.placeholder = "輸入路線 (如: 265)";
        if(busStopBlock) busStopBlock.style.display = 'flex'; // 顯示站牌欄位
        return;
    } else {
        if(busStopBlock) busStopBlock.style.display = 'none'; // 隱藏站牌欄位
    }
    inputField.value = defaultStations[typeSelect.value] || '';
    if (point === 'start') checkTransferLock();
}

function checkTransferLock() {
    const startType = document.getElementById('start-type').value;
    const transferBlock = document.getElementById('transfer-block');
    if (startType === 'tra' || startType === 'thsr') transferBlock.style.display = 'flex'; else transferBlock.style.display = 'none';
}

function getRealStationObj(inputName, type) {
    if (type === 'bus') return { id: inputName, name: inputName }; 
    if (!inputName || !globalStationData?.[type]) return null;
    let found = globalStationData[type].options.find(s => s.name.replace(/臺/g, '台') === inputName.trim().replace(/臺/g, '台'));
    return found || null;
}

// 🌟 核心修改：打包路線與站牌給 Routing 處理
async function handleAction() {
    const startType = document.getElementById('start-type').value; 
    let startName = document.getElementById('start-station-input').value.trim();
    if (startType === 'bus') {
        let stopInput = document.getElementById('start-bus-stop-input').value.trim();
        if (stopInput) startName += `|${stopInput}`; // 用 | 符號綁定
    }

    const endType = document.getElementById('end-type').value;
    let endName = document.getElementById('end-station-input').value.trim();
    
    if (!startName || !endName) return alert("⚠️ 請輸入起訖點");
    const actionBtn = document.getElementById('action-btn'); actionBtn.innerHTML = "⏳ 計算中..."; actionBtn.disabled = true;
    
    try {
        let res = await fetchTwoStageSurvivalTime(startType, startName, '', '', endName, offlineTimetableData);
        if (res.time) { document.getElementById('speed-mode').innerText = res.time; document.getElementById('cancel-btn').style.display='flex'; actionBtn.style.display='none'; }
        else alert(res.status);
    } catch (e) { alert("計算失敗"); }
    finally { actionBtn.disabled = false; actionBtn.innerHTML = "開始計算轉乘"; }
}

// 🌟 核心修改：檢索模式也支援路線與站牌打包
async function executeFullSearch() {
    const searchType = document.getElementById('search-type').value; 
    let searchName = document.getElementById('search-station-input').value.trim();
    if (searchType === 'bus') {
        let stopInput = document.getElementById('search-bus-stop-input').value.trim();
        if (stopInput) searchName += `|${stopInput}`;
    }

    if (!searchName) return alert("⚠️ 請先輸入名稱！");
    const resultBox = document.getElementById('search-result-box'); resultBox.innerHTML = `正在連線 TDX...`;
    
    try {
        let res = await fetchSingleStationTime(searchName, searchType, offlineTimetableData, 'now');
        if (res.status === "not_found" || res.data.length === 0) { resultBox.innerHTML = `⚠️ 找不到資料。`; return; }
        let html = `<div style="width: 100%; text-align: left;"><h4>時刻表：${searchName.split('|')[0]}</h4>`;
        res.data.forEach(item => { html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #333;"><span>${item.destination}</span><b>${item.time}</b></div>`; });
        resultBox.innerHTML = html + `</div>`;
    } catch (e) { resultBox.innerHTML = `⚠️ 系統錯誤或無公車動態`; }
}
function resetPlan() { document.getElementById('action-btn').style.display = 'block'; document.getElementById('cancel-btn').style.display = 'none'; document.getElementById('speed-mode').innerText = '待查驗...'; }
