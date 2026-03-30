// 全域錯誤攔截
window.addEventListener('error', function(event) { showErrorSheet(`Error: ${event.message}\nFile: ${event.filename}\nLine: ${event.lineno}:${event.colno}`); });
window.addEventListener('unhandledrejection', function(event) { showErrorSheet(`Unhandled Promise Rejection:\nReason: ${event.reason}`); });

function showErrorSheet(errorMsg) {
    const overlay = document.getElementById('overlay'); const errorSheet = document.getElementById('error-sheet'); const logOutput = document.getElementById('error-log-output');
    if(logOutput) logOutput.value = `[${new Date().toLocaleTimeString()}]\n${errorMsg}\n\n-------------------\n\n` + logOutput.value;
    if(overlay && errorSheet) { overlay.style.zIndex = "9998"; errorSheet.style.zIndex = "9999"; overlay.classList.add('active'); errorSheet.classList.add('active'); }
}
function closeErrorSheet() { document.getElementById('error-sheet').classList.remove('active'); if (!document.querySelector('.bottom-sheet.active:not(#error-sheet)')) { document.getElementById('overlay').classList.remove('active'); setTimeout(() => { document.getElementById('overlay').style.zIndex = "90"; }, 300); } }
function copyErrorLog() { const logOutput = document.getElementById('error-log-output'); logOutput.select(); document.execCommand('copy'); alert("✅ 錯誤代碼已複製！"); }

let currentMode = 'survival'; let bgmVolume = 0.5; let isBgmMuted = true; let bgmStarted = false; 

let bgmPlaylist = [
    "/audio/platform_at_midnight.mp3", 
    "/audio/Midnight_at_Platform_Four.mp3"
];
let currentBgmIndex = 0;

function toggleMute() {
    isBgmMuted = !isBgmMuted; if (!isBgmMuted && bgmVolume === 0) bgmVolume = 0.5;
    const icon = isBgmMuted ? '🔇' : '🔊'; document.getElementById('mute-btn').innerText = icon; document.getElementById('header-mute-btn').innerText = icon; document.getElementById('volume-slider').value = isBgmMuted ? 0 : bgmVolume;
    const bgm = document.getElementById('bgm-audio'); if (bgm) { if (isBgmMuted) bgm.pause(); else { bgm.volume = bgmVolume; bgm.play().catch(e=>console.log(e)); bgmStarted = true; } }
}
function updateVolume(val) {
    bgmVolume = parseFloat(val); isBgmMuted = (bgmVolume === 0);
    const icon = isBgmMuted ? '🔇' : '🔊'; document.getElementById('mute-btn').innerText = icon; document.getElementById('header-mute-btn').innerText = icon;
    const bgm = document.getElementById('bgm-audio'); if (bgm) { bgm.volume = bgmVolume; if (bgmVolume > 0) { if (bgm.paused) bgm.play().catch(e=>console.log(e)); bgmStarted = true; } else bgm.pause(); }
}

window.addEventListener('DOMContentLoaded', () => { 
    const bgm = document.getElementById('bgm-audio');
    if (bgm) {
        bgm.addEventListener('ended', () => {
            currentBgmIndex = (currentBgmIndex + 1) % bgmPlaylist.length;
            bgm.src = bgmPlaylist[currentBgmIndex];
            bgm.play().catch(e => console.log("切歌失敗:", e));
        });
    }
    
    document.body.addEventListener('click', () => { 
        if (bgm && !bgmStarted && !isBgmMuted) { 
            bgm.volume = bgmVolume; 
            bgm.play().catch(e => console.log("音樂啟動失敗:", e)); 
            bgmStarted = true; 
        } 
    }, { once: true }); 
});

function toggleAppMode() {
    const modeSurvival = document.getElementById('mode-survival'); const modeSearch = document.getElementById('mode-search'); const toggleBtn = document.getElementById('mode-toggle-btn'); const mainTitle = document.getElementById('main-title');
    if (currentMode === 'survival') { 
        modeSurvival.style.display = 'none'; modeSearch.style.display = 'block'; 
        toggleBtn.innerHTML = '🏠'; toggleBtn.title = '返回求生模式'; 
        mainTitle.innerHTML = '時刻表檢索'; mainTitle.style.color = 'var(--info)'; 
        currentMode = 'search'; document.getElementById('search-station-input').value = savedStart; 
    } else { 
        modeSearch.style.display = 'none'; modeSurvival.style.display = 'block'; 
        toggleBtn.innerHTML = '🔍'; toggleBtn.title = '切換至全查詢模式'; 
        
        // 🌟 判斷是否為工程模式
        if(localStorage.getItem('dev_mode_active') === 'true') {
            mainTitle.innerText = "末班車生存 (工程)"; 
            mainTitle.style.color = "var(--warning)";
        } else {
            mainTitle.innerText = "末班車生存"; 
            mainTitle.style.color = "var(--danger)"; 
        }
        currentMode = 'survival'; 
    }
}

async function executeFullSearch() {
    const searchType = document.getElementById('search-type').value; 
    const searchStationName = document.getElementById('search-station-input').value; 
    const resultBox = document.getElementById('search-result-box'); 
    const searchBtn = document.getElementById('search-action-btn');
    const searchMode = document.querySelector('input[name="search-time-mode"]:checked').value;

    if (!searchStationName) { alert("⚠️ 請先選擇或輸入要查詢的車站！"); return; }
    
    searchBtn.disabled = true; searchBtn.innerHTML = "⏳ 連線檢索中..."; 
    resultBox.style.justifyContent = 'center'; resultBox.innerHTML = `正在為您連線交通部與本地資料庫...`;
    
    try {
        try { 
            if (!cachedTdxToken && ['trtc', 'tra', 'thsr'].includes(searchType)) { 
                const tokenRes = await fetchWithTimeout('/api/get-token', { timeout: 3500 });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json(); 
                    cachedTdxToken = tokenData.access_token; 
                }
            } 
        } catch(networkErr) { console.log("網路異常或管制，跳過 Token 取得"); }
        
        let res = await fetchSingleStationTime(searchStationName, searchType, offlineTimetableData, cachedTdxToken, searchMode);
        
        if (res.status === "TOKEN_EXPIRED") { 
            try { 
                const tokenRes = await fetchWithTimeout('/api/get-token', { timeout: 3500 }); 
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json(); 
                    cachedTdxToken = tokenData.access_token; 
                    res = await fetchSingleStationTime(searchStationName, searchType, offlineTimetableData, cachedTdxToken, searchMode); 
                }
            } catch(networkErr) { } 
        }

        if (res.status === "TOKEN_EXPIRED") {
            res = await fetchSingleStationTime(searchStationName, searchType, offlineTimetableData, null, searchMode);
        }
        
        if (res.status === "not_found" || res.data.length === 0) { resultBox.innerHTML = `<span style="color:var(--warning)">⚠️ 找不到「${searchStationName}」的資料。</span>`; return; }
        
        let titleText = searchMode === 'last' ? '🚨 終極末班車時刻表' : '🚉 接下來發車時刻表';
        let html = `<div style="width: 100%; text-align: left;"><h4 style="color: white; margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 8px;">${titleText}<br><span style="font-size:12px; color:#aaa; font-weight:normal;">車站：${searchStationName}</span></h4>`;
        
        res.data.forEach(item => { 
            let colorTag = item.source === "即時連線" ? "color: var(--success);" : "color: var(--warning);"; 
            html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed #333;"><span style="font-weight: bold; color: #ddd; font-size: 14px;">往 ${item.destination}</span><span style="font-size: 18px; font-weight: bold; font-variant-numeric: tabular-nums; color: white;">${item.time} <span style="font-size: 10px; font-weight: normal; ${colorTag}; display: block; text-align: right; margin-top: 2px;">(${item.source})</span></span></div>`; 
        });
        html += `</div>`; 
        resultBox.style.justifyContent = 'flex-start'; resultBox.innerHTML = html;
    } catch (e) { 
        console.error(e); resultBox.innerHTML = `<span style="color:var(--danger)">⚠️ 系統讀取失敗。<br>這可能是網路不穩定或資料庫無回應。</span>`; throw e; 
    } finally { 
        searchBtn.disabled = false; searchBtn.innerHTML = "🔍 重新查詢"; 
    }
}

let isCountingDown = false; let timeLeft = 0; let timer; let cachedTdxToken = ""; let offlineTimetableData = null; let globalStationData = null; let transferTimetableData = null; let isNotificationEnabled = false; let notificationTriggered = false;
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; let savedStart = localStorage.getItem('lastTrainStart') || '台北車站'; let savedEnd = localStorage.getItem('lastTrainEnd') || '台北車站';

const display = document.getElementById('time-display'); const statusText = document.getElementById('status-text'); const actionBtn = document.getElementById('action-btn'); const cancelBtn = document.getElementById('cancel-btn'); const speedModeText = document.getElementById('speed-mode'); const planBContainer = document.getElementById('plan-b-container'); 
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站' };

window.onload = async () => {
    // 🌟 啟動時檢查是否為工程模式，變更標題
    if(localStorage.getItem('dev_mode_active') === 'true') {
        const mt = document.getElementById('main-title');
        if(mt) {
            mt.innerText = "末班車生存 (工程)";
            mt.style.color = "var(--warning)";
        }
    }

    try { const timeRes = await fetchWithTimeout('/data/offline-timetable.json', { timeout: 4000 }); if (timeRes.ok) offlineTimetableData = await timeRes.json(); } catch (e) {}
    try { const transferRes = await fetchWithTimeout('/data/transfer-timetable.json', { timeout: 4000 }); if (transferRes.ok) transferTimetableData = await transferRes.json(); } catch (e) {}
    try { 
        const stationRes = await fetchWithTimeout('/data/stations.json', { timeout: 4000 }); 
        if (stationRes.ok) { 
            globalStationData = await stationRes.json(); 
            initCustomAutocomplete(); 
            document.getElementById('start-station-input').value = savedStart; 
            document.getElementById('end-station-input').value = savedEnd; 
            document.getElementById('search-station-input').value = savedStart; 
            checkTransferLock();
        } 
    } catch (e) {}
};

function toggleFavorite(stationName) {
    if (favoriteStations.includes(stationName)) favoriteStations = favoriteStations.filter(name => name !== stationName); else favoriteStations.push(stationName);
    localStorage.setItem('lastTrainFavs', JSON.stringify(favoriteStations));
    renderCustomDropdown('start'); renderCustomDropdown('end'); renderCustomDropdown('search'); renderCustomDropdown('transfer');
}

function renderCustomDropdown(point) {
    const inputField = document.getElementById(point + '-station-input');
    const listContainer = document.getElementById(point + '-autocomplete-list');
    let options = [];

    if (point === 'transfer') {
        const startType = document.getElementById('start-type').value;
        let rawOptions = globalStationData?.[startType]?.transferStations || [];
        options = rawOptions.map(s => {
            if (s.name === '萬華') return { ...s, name: '龍山寺' };
            return s;
        });
    } else {
        const selectedType = document.getElementById(point + '-type').value;
        options = globalStationData?.[selectedType]?.options || [];
    }
    
    listContainer.innerHTML = ''; 
    const filterText = inputField.value.trim().toLowerCase();
    
    let favList = []; let otherList = [];
    options.forEach(station => {
        if (station.name.toLowerCase().includes(filterText) || filterText === '') {
            if (favoriteStations.includes(station.name)) favList.push(station); else otherList.push(station);
        }
    });

    const createItem = (station, isFav) => {
        const item = document.createElement('div'); item.className = 'dropdown-item';
        const nameSpan = document.createElement('span'); nameSpan.textContent = station.name;
        const starSpan = document.createElement('span'); starSpan.className = 'star-icon';
        starSpan.textContent = isFav ? '★' : '☆'; starSpan.style.color = isFav ? '#ffca28' : '#666'; 
        starSpan.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); toggleFavorite(station.name); });
        item.addEventListener('mousedown', function(e) { e.preventDefault(); });
        item.addEventListener('click', function() { 
            inputField.value = station.name; 
            listContainer.style.display = 'none'; 
            if (point === 'start') checkTransferLock();
        });
        item.appendChild(nameSpan); item.appendChild(starSpan); return item;
    };

    favList.forEach(station => { listContainer.appendChild(createItem(station, true)); });
    if (favList.length > 0 && otherList.length > 0) { const divider = document.createElement('div'); divider.className = 'dropdown-divider'; listContainer.appendChild(divider); }
    otherList.forEach(station => { listContainer.appendChild(createItem(station, false)); });
    
    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

function initCustomAutocomplete() {
    ['start', 'end', 'search', 'transfer'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        inputField.addEventListener('input', () => renderCustomDropdown(point));
        inputField.addEventListener('focus', () => { 
            if(inputField.disabled) return; 
            inputField.value = ''; 
            renderCustomDropdown(point); 
        });
        inputField.addEventListener('blur', () => {
            if (point === 'start') setTimeout(checkTransferLock, 100); 
        });
    });
}

document.addEventListener('click', function (e) {
    ['start', 'end', 'search', 'transfer'].forEach(point => {
        const wrapper = document.getElementById(point + '-station-input').parentElement;
        if (!wrapper.contains(e.target)) document.getElementById(point + '-autocomplete-list').style.display = 'none';
    });
});

function checkTransferLock() {
    const startType = document.getElementById('start-type').value;
    const startInput = document.getElementById('start-station-input').value;
    const transferBlock = document.getElementById('transfer-block');
    const transferInput = document.getElementById('transfer-station-input');
    const endTypeSelect = document.getElementById('end-type');

    if (startType === 'tra' || startType === 'thsr') {
        transferBlock.style.display = 'flex';
        
        const transferStations = globalStationData?.[startType]?.transferStations || [];
        const isOriginTransferStation = transferStations.some(s => s.name === startInput);

        if (isOriginTransferStation) {
            transferInput.value = startInput === '萬華' ? '龍山寺' : startInput;
            transferInput.disabled = true;
            transferInput.style.opacity = '0.5';
            transferInput.style.pointerEvents = 'none'; 
        } else {
            transferInput.disabled = false;
            transferInput.style.opacity = '1';
            transferInput.style.pointerEvents = 'auto';
            
            let validNames = transferStations.map(s => s.name === '萬華' ? '龍山寺' : s.name);
            if (!validNames.includes(transferInput.value)) {
                transferInput.value = validNames[0] || '南港';
            }
        }

        if (endTypeSelect.options.length > 1) {
            endTypeSelect.innerHTML = '<option value="trtc" selected>北捷</option>';
            document.getElementById('end-station-input').value = defaultStations['trtc'];
            renderCustomDropdown('end');
        }

    } else {
        transferBlock.style.display = 'none';
        if (endTypeSelect.options.length === 1) {
            endTypeSelect.innerHTML = '<option value="trtc" selected>北捷</option><option value="thsr">高鐵</option>';
        }
    }
}

function updateStationOptions(point) {
    if (point !== 'transfer') {
        const typeSelect = document.getElementById(point + '-type');
        document.getElementById(point + '-station-input').value = defaultStations[typeSelect.value] || '';
        renderCustomDropdown(point);
    }
    if (point === 'start') {
        checkTransferLock();
    }
}

function toggleNotificationState() {
    isNotificationEnabled = !isNotificationEnabled;
    if (isNotificationEnabled) { actionBtn.innerHTML = "🔕 關閉發車通知"; actionBtn.classList.replace('btn-danger', 'btn-warning'); alert("🔔 已開啟通知！"); } 
    else { actionBtn.innerHTML = "🔔 開啟發車通知"; actionBtn.classList.replace('btn-warning', 'btn-danger'); }
}

function updateClock() {
    // 🌟 套用時光機
    const now = getSystemTime();
    
    if (!isCountingDown) { 
        display.innerHTML = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`; 
    } else {
        if (timeLeft <= 0) { clearInterval(timer); display.innerHTML = "來不及了💸"; display.style.fontSize = "50px"; display.style.color = "#ff5252"; actionBtn.style.display = "none"; cancelBtn.style.display = "none"; planBContainer.style.display = "flex"; document.querySelectorAll('.vehicle-option').forEach(btn => btn.style.display = "flex"); statusText.innerHTML = "人生不是只有末班車..."; return; }
        timeLeft--;
        if (isNotificationEnabled && !notificationTriggered && timeLeft === 600) { new Notification("🏃‍♂️ 末班車警報！", { body: "距離發車只剩最後 10 分鐘！" }); notificationTriggered = true; }
        let h = Math.floor(timeLeft / 3600); let m = Math.floor((timeLeft % 3600) / 60); let s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}
updateClock(); timer = setInterval(updateClock, 1000);

async function handleAction() {
    const startType = document.getElementById('start-type').value; 
    const endType = document.getElementById('end-type').value;
    const startStationName = document.getElementById('start-station-input').value; 
    const endStationName = document.getElementById('end-station-input').value;
    
    const uiTransferName = document.getElementById('transfer-station-input').value;
    const railTransferName = uiTransferName === '龍山寺' ? '萬華' : uiTransferName;
    const trtcTransferName = uiTransferName; 

    if (isCountingDown) { if ("Notification" in window) { if (Notification.permission === "granted") toggleNotificationState(); else if (Notification.permission !== "denied") Notification.requestPermission().then(p => { if (p === "granted") toggleNotificationState(); }); else alert("⚠️ 您之前拒絕了通知權限，請手動開啟！"); } else alert("⚠️ 不支援推播通知！"); return; }
    
    const startStationObj = globalStationData[startType]?.options.find(s => s.name === startStationName);
    const endStationObj = globalStationData[endType]?.options.find(s => s.name === endStationName);
    if (!startStationObj || !endStationObj) return alert("⚠️ 找不到起訖車站！");
    
    localStorage.setItem('lastTrainStart', startStationName); localStorage.setItem('lastTrainEnd', endStationName);
    const startStation = startStationObj.id; const endStation = endStationObj.id;

    if (startType === endType && startStation === endStation) { clearInterval(timer); isCountingDown = false; display.innerHTML = "恭喜到達🎉"; display.style.fontSize = "40px"; display.style.color = "#4caf50"; statusText.innerHTML = "早點回家洗洗睡！"; actionBtn.style.display = "none"; cancelBtn.style.display = "none"; planBContainer.style.display = "flex"; document.querySelectorAll('.vehicle-option').forEach(btn => btn.style.display = "none"); return; }

    actionBtn.innerHTML = "⏳ 演算法推演中..."; actionBtn.disabled = true;

   try {
        let finalTime = "23:59"; let status = "系統預設";
        let transferPenalty = 0; 
        
        if (startType === 'tra' || startType === 'thsr') {
            const transferStationObj = globalStationData[startType]?.transferStations?.find(s => s.name === railTransferName);
            if (!transferStationObj) { alert("⚠️ 無效的轉乘站"); actionBtn.disabled = false; actionBtn.innerHTML = "開始計算轉乘"; return; }
            
            try { 
                if (!cachedTdxToken) { 
                    const tokenRes = await fetchWithTimeout('/api/get-token', { timeout: 3500 }); 
                    if (tokenRes.ok) { const tokenData = await tokenRes.json(); cachedTdxToken = tokenData.access_token; }
                } 
            } catch(e) { console.log("網路異常或管制，跳過 Token 取得"); }
            
            let res = await fetchTwoStageSurvivalTime(startType, startStation, transferStationObj.id, trtcTransferName, endStationName, offlineTimetableData, cachedTdxToken);
            
            if (res.time === "TOKEN_EXPIRED") { 
                try {
                    const tokenRes = await fetchWithTimeout('/api/get-token', { timeout: 3500 }); 
                    if (tokenRes.ok) {
                        const tokenData = await tokenRes.json(); cachedTdxToken = tokenData.access_token;
                        res = await fetchTwoStageSurvivalTime(startType, startStation, transferStationObj.id, trtcTransferName, endStationName, offlineTimetableData, cachedTdxToken);
                    }
                } catch(e) {}
            }

            if (res.time && res.time !== "TOKEN_EXPIRED") {
                finalTime = res.time; status = res.status;
            } else {
                alert(`⚠️ ${res.status || '轉乘計算失敗'}！今晚可能無法透過這條路線回家了。`);
                throw new Error(res.status);
            }

        } 
        else {
            const offlineComputedTime = calculateOfflineTime(offlineTimetableData, startStationName, endStationName, startType);
            if (offlineComputedTime) { finalTime = offlineComputedTime; status = "離線演算法"; } 
            else { alert("⚠️ 跨線轉乘資料尚未備齊，使用 23:59 估算。"); }
        }
        
        isCountingDown = true; statusText.innerHTML = "距離末班車發車還剩"; display.style.color = "#4caf50"; speedModeText.innerHTML = `${finalTime} <span style="font-size:10px; color:#aaa;">(${status})</span>`; actionBtn.innerHTML = "🔔 開啟發車通知"; actionBtn.classList.replace('btn-success', 'btn-danger'); cancelBtn.style.display = "flex";
        
        // 🌟 套用時光機計算倒數差距
        const now = getSystemTime(); 
        let target = getSystemTime(); 
        
        const [hh, mm] = finalTime.split(':').map(Number); target.setHours(hh, mm, 0, 0); 
        if (now.getHours() >= 4 && hh < 4) target.setDate(target.getDate() + 1); else if (now.getHours() < 4 && hh >= 4) target.setDate(target.getDate() - 1); 
        timeLeft = Math.floor((target.getTime() - now.getTime()) / 1000) - transferPenalty; if (timeLeft < 0) timeLeft = 0; updateClock(); 
        
    } catch (error) { 
        isCountingDown = false; 
        actionBtn.innerHTML = "開始計算轉乘"; actionBtn.disabled = false;
    } 
}

function resetPlan() {
    clearInterval(timer); isCountingDown = false; isNotificationEnabled = false; notificationTriggered = false; planBContainer.style.display = "none"; cancelBtn.style.display = "none"; actionBtn.style.display = "block"; actionBtn.innerHTML = "開始計算轉乘"; actionBtn.classList.remove('btn-danger', 'btn-warning'); actionBtn.classList.add('btn-success'); actionBtn.disabled = false;
    statusText.innerHTML = "現在時間"; speedModeText.innerHTML = "待查驗..."; display.style.color = "#e0e0e0"; display.style.fontSize = "50px"; document.querySelectorAll('.vehicle-option').forEach(btn => btn.style.display = "flex"); updateClock(); timer = setInterval(updateClock, 1000);
}

function shareApp() { 
    if (navigator.share) {
        navigator.share({ title: '末班車生存', text: '趕不上末班車？快用這個工具一鍵查詢倒數！', url: window.location.href })
        .catch(err => {
            if (err.name !== 'AbortError') console.error("分享失敗:", err);
        });
    } else { 
        navigator.clipboard.writeText(window.location.href); 
        alert("✅ 網址已複製！"); 
    } 
}

function toggleContact() { const l = document.getElementById('contact-links'); l.style.display = l.style.display === "flex" ? "none" : "flex"; }
function openAdvancedSheet() { document.getElementById('overlay').style.zIndex = "90"; document.getElementById('overlay').classList.add('active'); document.getElementById('advanced-sheet').classList.add('active'); }
function openSettingsSheet() { document.getElementById('overlay').style.zIndex = "90"; document.getElementById('overlay').classList.add('active'); document.getElementById('settings-sheet').classList.add('active'); }
function closeAllSheets() { document.getElementById('advanced-sheet').classList.remove('active'); document.getElementById('settings-sheet').classList.remove('active'); document.getElementById('error-sheet').classList.remove('active'); const overlay = document.getElementById('overlay'); overlay.classList.remove('active'); setTimeout(() => { overlay.style.zIndex = "90"; }, 300); }
