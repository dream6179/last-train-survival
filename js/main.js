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

let currentMode = 'survival'; 

// ==========================================
// 🌟 音樂播放器核心 (SPA 終極無縫版)
// ==========================================
let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = savedVol !== null ? parseFloat(savedVol) : 0.3; 
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true; 

let bgmPlaylist = [
    "/audio/platform_at_midnight.mp3", 
    "/audio/Midnight_at_Platform_Four.mp3",
    "/audio/Waiting_at_the_Edge.mp3",
    "/audio/The_Three_AM_Wait.mp3"
];

let savedIndex = localStorage.getItem('bgmIndex');
let currentBgmIndex = savedIndex !== null ? parseInt(savedIndex) : Math.floor(Math.random() * bgmPlaylist.length);
let audioInitialized = false;

setInterval(() => {
    const bgm = document.getElementById('bgm-audio');
    if (bgm && !bgm.paused && bgm.currentTime > 0) {
        localStorage.setItem('bgmTime', bgm.currentTime);
        localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 500);

function initAndPlayAudio() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return;
    
    if (!audioInitialized) {
        bgm.removeAttribute('loop'); 
        bgm.src = bgmPlaylist[currentBgmIndex];
        bgm.addEventListener('loadedmetadata', () => {
            let savedTime = localStorage.getItem('bgmTime');
            if (savedTime && parseFloat(savedTime) > 0 && parseFloat(savedTime) < bgm.duration) {
                bgm.currentTime = parseFloat(savedTime);
            }
        }, { once: true });
        bgm.load();
        bgm.addEventListener('ended', () => {
            let nextIndex;
            do { nextIndex = Math.floor(Math.random() * bgmPlaylist.length); } while (nextIndex === currentBgmIndex && bgmPlaylist.length > 1);
            currentBgmIndex = nextIndex;
            bgm.src = bgmPlaylist[currentBgmIndex];
            localStorage.setItem('bgmTime', 0); 
            bgm.load();
            let p = bgm.play();
            if(p !== undefined) p.catch(e => console.log("切歌失敗:", e));
        });
        audioInitialized = true;
    }
    bgm.volume = bgmVolume;
    let p = bgm.play();
    if (p !== undefined) p.catch(e => console.log("等待使用者互動才能播放:", e));
}

function setupAudioUI() {
    const icon = isBgmMuted ? '🔇' : '🔊'; 
    const muteBtn = document.getElementById('mute-btn');
    const headerMuteBtn = document.getElementById('header-mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    if (muteBtn) muteBtn.innerText = icon; 
    if (headerMuteBtn) headerMuteBtn.innerText = icon; 
    if (volumeSlider) volumeSlider.value = isBgmMuted ? 0 : bgmVolume;
}

function toggleMute() {
    isBgmMuted = !isBgmMuted; 
    if (!isBgmMuted && bgmVolume === 0) bgmVolume = 0.3; 
    localStorage.setItem('isBgmMuted', isBgmMuted);
    localStorage.setItem('bgmVolume', bgmVolume);
    setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { if (isBgmMuted) bgm.pause(); else initAndPlayAudio(); }
}

function updateVolume(val) {
    bgmVolume = parseFloat(val); 
    isBgmMuted = (bgmVolume === 0);
    localStorage.setItem('isBgmMuted', isBgmMuted);
    localStorage.setItem('bgmVolume', bgmVolume);
    setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { if (isBgmMuted) bgm.pause(); else initAndPlayAudio(); }
}

window.addEventListener('load', () => { 
    setupAudioUI();
    if (window.parent !== window) {
        const bgm = document.getElementById('bgm-audio');
        if (bgm) { bgm.pause(); bgm.remove(); }
        const backBtns = document.querySelectorAll('.back-btn');
        backBtns.forEach(btn => {
            btn.removeAttribute('href');
            btn.onclick = (e) => {
                e.preventDefault();
                if (typeof window.parent.closeDynamicSheet === 'function') window.parent.closeDynamicSheet();
            };
            btn.innerHTML = '⬅ 返回'; 
        });
        return;
    }
    const globalWakeUp = () => {
        if (!isBgmMuted) initAndPlayAudio();
        ['touchstart', 'click', 'scroll'].forEach(evt => window.removeEventListener(evt, globalWakeUp, true));
    };
    if (!isBgmMuted) ['touchstart', 'click', 'scroll'].forEach(evt => window.addEventListener(evt, globalWakeUp, true));
});

// ==========================================
// 🌟 SPA 動態面板控制
// ==========================================
window.openPage = function(url) {
    const frame = document.getElementById('spa-frame');
    const sheet = document.getElementById('dynamic-sheet');
    const overlay = document.getElementById('overlay');
    if(!frame || !sheet || !overlay) { window.location.href = url; return; }
    frame.src = url;
    overlay.style.zIndex = "99990"; 
    overlay.classList.add('active');
    sheet.classList.add('active');
};

window.closeDynamicSheet = function() {
    const sheet = document.getElementById('dynamic-sheet');
    if(sheet) sheet.classList.remove('active');
    setTimeout(() => {
        const frame = document.getElementById('spa-frame');
        if(frame) frame.src = 'about:blank'; 
        const overlay = document.getElementById('overlay');
        if(overlay) {
            overlay.style.zIndex = "90"; 
            const hasOtherActive = document.querySelector('.bottom-sheet.active:not(#dynamic-sheet)');
            if(!hasOtherActive) overlay.classList.remove('active'); 
        }
    }, 300);
};

function closeAllSheets() { 
    ['advanced-sheet', 'settings-sheet', 'error-sheet', 'dynamic-sheet'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('active');
    });
    const overlay = document.getElementById('overlay'); 
    if(overlay) overlay.classList.remove('active'); 
    setTimeout(() => { 
        if(overlay) overlay.style.zIndex = "90"; 
        const frame = document.getElementById('spa-frame');
        if(frame) frame.src = 'about:blank';
    }, 300); 
}

// ==========================================
// 🛡️ 台灣鄉民防禦系統
// ==========================================
function getRealStationObj(inputName, type) {
    if (type === 'bus') return { id: inputName, name: inputName }; // 公車模式：直接回傳輸入文字
    if (!inputName || !globalStationData?.[type]) return null;
    let normInput = inputName.trim().replace(/臺/g, '台');
    if (normInput === '北車') normInput = '台北車站';
    let found = globalStationData[type].options.find(s => s.name.replace(/臺/g, '台') === normInput);
    if (found) return found;
    found = globalStationData[type].options.find(s => s.name.replace(/臺/g, '台').includes(normInput));
    return found || null;
}

function toggleAppMode() {
    const modeSurvival = document.getElementById('mode-survival'); const modeSearch = document.getElementById('mode-search'); const toggleBtn = document.getElementById('mode-toggle-btn'); const mainTitle = document.getElementById('main-title');
    if (currentMode === 'survival') { 
        modeSurvival.style.display = 'none'; modeSearch.style.display = 'block'; 
        toggleBtn.innerHTML = '🏠'; toggleBtn.title = '返回求生模式'; 
        mainTitle.innerHTML = '時刻表檢索'; mainTitle.style.color = 'var(--info)'; 
        currentMode = 'search';
    } else { 
        modeSearch.style.display = 'none'; modeSurvival.style.display = 'block'; 
        toggleBtn.innerHTML = '🔍'; toggleBtn.title = '切換至全查詢模式'; 
        if(localStorage.getItem('dev_mode_active') === 'true') { mainTitle.innerText = "末班車生存 (工程)"; mainTitle.style.color = "var(--warning)"; }
        else { mainTitle.innerText = "末班車生存"; mainTitle.style.color = "var(--danger)"; }
        currentMode = 'survival'; 
    }
}

// ==========================================
// 核心邏輯
// ==========================================
let isCountingDown = false; let timeLeft = 0; let timer; let offlineTimetableData = null; let globalStationData = null; let traOfflineDict = null;
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; let savedStart = localStorage.getItem('lastTrainStart') || '台北車站'; let savedEnd = localStorage.getItem('lastTrainEnd') || '台北車站';
const display = document.getElementById('time-display'); const statusText = document.getElementById('status-text'); const actionBtn = document.getElementById('action-btn'); const cancelBtn = document.getElementById('cancel-btn'); const speedModeText = document.getElementById('speed-mode'); const planBContainer = document.getElementById('plan-b-container'); 
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

window.addEventListener('load', async () => {
    if(localStorage.getItem('dev_mode_active') === 'true') {
        const mt = document.getElementById('main-title'); if(mt) { mt.innerText = "末班車生存 (工程)"; mt.style.color = "var(--warning)"; }
    }
    if (!document.getElementById('start-station-input')) return;

    try { 
        const timeRes = await fetchWithTimeout('/data/offline-timetable.json', { timeout: 4000 }); 
        if (timeRes.ok) offlineTimetableData = await timeRes.json(); 
    } catch (e) { console.error("離線時刻表載入失敗"); }

    try { 
        const stationRes = await fetchWithTimeout('/data/stations.json', { timeout: 4000 }); 
        if (stationRes.ok) { 
            globalStationData = await stationRes.json(); 
            initCustomAutocomplete(); 
            document.getElementById('start-station-input').value = savedStart; 
            document.getElementById('end-station-input').value = savedEnd; 
            checkTransferLock();
        }
    } catch (e) { showErrorSheet(`車站資料載入失敗`); }

    try {
        const dictRes = await fetchWithTimeout('/data/tra-last-hub.json', { timeout: 3000 });
        if (dictRes.ok) traOfflineDict = await dictRes.json();
    } catch (e) { console.log("離線字典載入跳過"); }
});

async function updateStationOptions(point) {
    const typeSelect = document.getElementById(point + '-type');
    const selectedType = typeSelect.value;
    const inputField = document.getElementById(point + '-station-input');
    const listContainer = document.getElementById(point + '-autocomplete-list');

    // 🌟 公車/客運：純手動輸入，關閉選單，隱藏自動完成
    if (selectedType === 'bus') {
        inputField.value = '';
        inputField.placeholder = "請輸入路線 (如: 265, 307, 1815)";
        if (listContainer) listContainer.style.display = 'none';
        if (point === 'start') checkTransferLock();
        return;
    }

    // 🚂 台鐵懶載入
    if (selectedType === 'tra' && !globalStationData.tra.isFullLoaded) {
        inputField.placeholder = "⏳ 載入中...";
        try {
            const res = await fetchWithTimeout('/data/tra-stations.json', { timeout: 8000 });
            if (res.ok) {
                const fullTraData = await res.json();
                globalStationData.tra.options = Array.isArray(fullTraData) ? fullTraData : (fullTraData.options || fullTraData.tra?.options || []);
                globalStationData.tra.isFullLoaded = true;
            }
        } catch (e) { console.error("台鐵載入失敗"); }
        inputField.placeholder = "輸入或選擇車站";
    }

    inputField.value = defaultStations[selectedType] || '';
    renderCustomDropdown(point);
    if (point === 'start') checkTransferLock();
}

function renderCustomDropdown(point) {
    const typeSelect = document.getElementById(point + '-type');
    if (typeSelect && typeSelect.value === 'bus') return; // 🌟 公車不支援下拉選單

    const inputField = document.getElementById(point + '-station-input');
    const listContainer = document.getElementById(point + '-autocomplete-list');
    const selectedType = typeSelect.value;
    let options = globalStationData?.[selectedType]?.options || [];
    
    listContainer.innerHTML = ''; 
    const filterText = inputField.value.trim().replace(/臺/g, '台').toLowerCase();
    let favList = []; let otherList = [];
    options.forEach(station => {
        const normStationName = station.name.replace(/臺/g, '台').toLowerCase();
        if (normStationName.includes(filterText) || filterText === '') {
            if (favoriteStations.includes(station.name)) favList.push(station); else otherList.push(station);
        }
    });

    const createItem = (station, isFav) => {
        const item = document.createElement('div'); item.className = 'dropdown-item';
        item.innerHTML = `<span>${station.name}</span><span class="star-icon" style="color:${isFav?'#ffca28':'#666'}">${isFav?'★':'☆'}</span>`;
        item.querySelector('.star-icon').addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(station.name); });
        item.addEventListener('click', () => { inputField.value = station.name; listContainer.style.display = 'none'; if (point === 'start') checkTransferLock(); });
        return item;
    };
    favList.forEach(s => listContainer.appendChild(createItem(s, true)));
    if (favList.length > 0 && otherList.length > 0) listContainer.appendChild(document.createElement('div')).className = 'dropdown-divider';
    otherList.forEach(s => listContainer.appendChild(createItem(s, false)));
    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

function initCustomAutocomplete() {
    ['start', 'end', 'search'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        inputField.addEventListener('input', () => renderCustomDropdown(point));
        inputField.addEventListener('focus', () => { if(inputField.disabled) return; const type = document.getElementById(point + '-type').value; if(type !== 'bus') { inputField.value = ''; renderCustomDropdown(point); } });
    });
}

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
            transferInput.disabled = true; transferInput.style.opacity = '0.5';
        } else {
            transferInput.disabled = false; transferInput.style.opacity = '1';
            if (!transferStations.map(s => s.name === '萬華' ? '龍山寺' : s.name).includes(transferInput.value)) transferInput.value = '台北車站';
        }
        endTypeSelect.innerHTML = '<option value="trtc" selected>北捷</option>';
    } else {
        transferBlock.style.display = 'none';
        endTypeSelect.innerHTML = '<option value="trtc" selected>北捷</option><option value="thsr">高鐵</option><option value="bus">公車客運</option>';
    }
}

async function executeFullSearch() {
    const searchType = document.getElementById('search-type').value; 
    const searchStationName = document.getElementById('search-station-input').value; 
    const resultBox = document.getElementById('search-result-box'); 
    const searchBtn = document.getElementById('search-action-btn');
    if (!searchStationName) return alert("⚠️ 請先輸入名稱！");
    
    searchBtn.disabled = true; searchBtn.innerHTML = "⏳ 檢索中..."; 
    resultBox.innerHTML = `正在連線 TDX 資料庫...`;
    
    try {
        // 🌟 這裡之後會在 routing.js 實作公車查詢邏輯
        let res = await fetchSingleStationTime(searchStationName, searchType, offlineTimetableData, document.querySelector('input[name="search-time-mode"]:checked').value);
        if (res.status === "not_found" || res.data.length === 0) { resultBox.innerHTML = `⚠️ 找不到資料。`; return; }
        let html = `<div style="width: 100%; text-align: left;"><h4>時刻表：${searchStationName}</h4>`;
        res.data.forEach(item => { html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #333;"><span>往 ${item.destination}</span><b>${item.time}</b></div>`; });
        resultBox.innerHTML = html + `</div>`;
    } catch (e) { resultBox.innerHTML = `⚠️ 系統錯誤`; }
    finally { searchBtn.disabled = false; searchBtn.innerHTML = "🔍 重新查詢"; }
}

function updateClock() {
    if (!display) return;
    const now = getSystemTime();
    if (!isCountingDown) { 
        display.innerHTML = now.toTimeString().split(' ')[0]; 
    } else {
        if (timeLeft <= 0) { display.innerHTML = "來不及了💸"; resetPlan(); return; }
        timeLeft--;
        let m = Math.floor(timeLeft / 60); let s = timeLeft % 60;
        display.innerHTML = `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}
setInterval(updateClock, 1000);

async function handleAction() {
    const startType = document.getElementById('start-type').value; 
    const endType = document.getElementById('end-type').value;
    const startName = document.getElementById('start-station-input').value;
    const endName = document.getElementById('end-station-input').value;
    if (!startName || !endName) return alert("⚠️ 請輸入起訖點");

    actionBtn.innerHTML = "⏳ 演算法推演中..."; actionBtn.disabled = true;
    try {
        const startObj = getRealStationObj(startName, startType);
        const endObj = getRealStationObj(endName, endType);
        // 🌟 這裡之後會在 routing.js 整合公車查詢
        let res = await fetchTwoStageSurvivalTime(startType, startObj.id, (startType==='trtc'?'':document.getElementById('transfer-station-input').value), '', endObj.name, offlineTimetableData);
        if (res.time) {
            isCountingDown = true;
            const now = getSystemTime(); let target = getSystemTime(); 
            const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
            if (now > target) target.setDate(target.getDate() + 1);
            timeLeft = Math.floor((target - now) / 1000);
            speedModeText.innerText = res.time;
            actionBtn.style.display = 'none'; cancelBtn.style.display = 'flex';
        }
    } catch (e) { alert("計算失敗"); }
    finally { actionBtn.disabled = false; actionBtn.innerHTML = "開始計算轉乘"; }
}

function resetPlan() { isCountingDown = false; actionBtn.style.display = 'block'; cancelBtn.style.display = 'none'; speedModeText.innerText = '待查驗...'; }
function toggleContact() { const l = document.getElementById('contact-links'); l.style.display = l.style.display === "flex" ? "none" : "flex"; }
function openAdvancedSheet() { document.getElementById('overlay').classList.add('active'); document.getElementById('advanced-sheet').classList.add('active'); }
function openSettingsSheet() { document.getElementById('overlay').classList.add('active'); document.getElementById('settings-sheet').classList.add('active'); }
function closeAllSheets() { document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); document.getElementById('overlay').classList.remove('active'); }
