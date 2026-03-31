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

// ==========================================
// 🌟 音樂播放器核心 (專治 iOS 傲嬌病版)
// ==========================================
let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = savedVol !== null ? parseFloat(savedVol) : 0.5; 
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true;
let bgmStarted = false; 

let bgmPlaylist = [
    "/audio/platform_at_midnight.mp3", 
    "/audio/Midnight_at_Platform_Four.mp3",
    "/audio/Waiting_at_the_Edge.mp3",
    "/audio/The_Three_AM_Wait.mp3"
];

let currentBgmIndex = Math.floor(Math.random() * bgmPlaylist.length);

function playBgm() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return;
    
    bgm.volume = bgmVolume;
    // 🌟 對付 iOS 的關鍵：只下達最純粹的 play 指令，絕對不能在這裡改 src 或 load
    let playPromise = bgm.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            bgmStarted = true;
        }).catch(e => console.log("iOS 依然傲嬌阻擋:", e));
    }
}

function toggleMute() {
    isBgmMuted = !isBgmMuted; 
    if (!isBgmMuted && bgmVolume === 0) bgmVolume = 0.5;
    
    localStorage.setItem('isBgmMuted', isBgmMuted);
    localStorage.setItem('bgmVolume', bgmVolume);

    const icon = isBgmMuted ? '🔇' : '🔊'; 
    const muteBtn = document.getElementById('mute-btn');
    const headerMuteBtn = document.getElementById('header-mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    
    if (muteBtn) muteBtn.innerText = icon; 
    if (headerMuteBtn) headerMuteBtn.innerText = icon; 
    if (volumeSlider) volumeSlider.value = isBgmMuted ? 0 : bgmVolume;
    
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { 
        if (isBgmMuted) {
            bgm.pause(); 
        } else { 
            playBgm(); 
        } 
    }
}

function updateVolume(val) {
    bgmVolume = parseFloat(val); 
    isBgmMuted = (bgmVolume === 0);
    
    localStorage.setItem('isBgmMuted', isBgmMuted);
    localStorage.setItem('bgmVolume', bgmVolume);

    const icon = isBgmMuted ? '🔇' : '🔊'; 
    const muteBtn = document.getElementById('mute-btn');
    const headerMuteBtn = document.getElementById('header-mute-btn');
    if (muteBtn) muteBtn.innerText = icon; 
    if (headerMuteBtn) headerMuteBtn.innerText = icon;
    
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { 
        if (isBgmMuted) {
            bgm.pause(); 
        } else {
            playBgm();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => { 
    const icon = isBgmMuted ? '🔇' : '🔊'; 
    const muteBtn = document.getElementById('mute-btn');
    const headerMuteBtn = document.getElementById('header-mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    if (muteBtn) muteBtn.innerText = icon; 
    if (headerMuteBtn) headerMuteBtn.innerText = icon; 
    if (volumeSlider) volumeSlider.value = isBgmMuted ? 0 : bgmVolume;

    const bgm = document.getElementById('bgm-audio');
    if (bgm) {
        // 🌟 對付 iOS 的關鍵 2：網頁一打開，趁 iOS 還沒注意，先偷偷把歌塞好載入
        bgm.src = bgmPlaylist[currentBgmIndex];
        bgm.load();

        bgm.addEventListener('ended', () => {
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * bgmPlaylist.length);
            } while (nextIndex === currentBgmIndex && bgmPlaylist.length > 1);
            
            currentBgmIndex = nextIndex;
            bgm.src = bgmPlaylist[currentBgmIndex];
            bgm.load();
            bgm.play().catch(e => console.log("切歌失敗:", e));
        });
    }
    
    // 🌟 iOS 終極解鎖魔法：在螢幕被「觸碰(touchstart)」的瞬間，騙到 iOS 的播放授權
    const unlockAudioForIOS = () => {
        if (bgm && !bgmStarted) {
            let p = bgm.play();
            if (p !== undefined) {
                p.then(() => {
                    if (isBgmMuted) {
                        bgm.pause(); // 拿到授權了，發現是靜音就趕快按暫停
                    } else {
                        bgmStarted = true; // 沒靜音就讓他繼續播
                    }
                }).catch(e => {});
            }
            document.body.removeEventListener('touchstart', unlockAudioForIOS);
            document.body.removeEventListener('click', unlockAudioForIOS);
        }
    };
    
    document.body.addEventListener('touchstart', unlockAudioForIOS, { once: true });
    document.body.addEventListener('click', unlockAudioForIOS, { once: true });
});

// ==========================================
// 核心路由與其餘功能
// ==========================================
function getSystemTime() {
    if (localStorage.getItem('dev_mode_active') === 'true') {
        let d = new Date(); d.setHours(23, 30, 0, 0); return d;
    }
    return new Date();
}

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
        
        if(localStorage.getItem('dev_mode_active') === 'true') {
            mainTitle.innerText = "末班車生存 (工程)"; mainTitle.style.color = "var(--warning)";
        } else {
            mainTitle.innerText = "末班車生存"; mainTitle.style.color = "var(--danger)"; 
        }
        currentMode = 'survival'; 
    }
}

function triggerKisaragiEvent() {
    clearInterval(timer); isCountingDown = false;
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
}

window.escapeKisaragi = function() {
    const overlay = document.getElementById('kisaragi-overlay');
    if(overlay) overlay.remove();
    
    if (localStorage.getItem('unlock_kisaragi') === 'true') {
        alert('🏃‍♂️ 你死命地沿著隧道狂奔，身後的太鼓聲漸漸遠去，終於回到了現實世界...\n\n（你已經逃出過這裡了，但那股寒意依舊揮之不去...）');
    } else {
        localStorage.setItem('unlock_kisaragi', 'true');
        alert('🏃‍♂️ 你死命地沿著隧道狂奔，身後的太鼓聲漸漸遠去，終於回到了現實世界...\n\n🎉 恭喜解鎖隱藏成就【從不存在的車站歸來】！');
    }
    window.location.href = '/collection.html';
};

async function executeFullSearch() {
    const searchType = document.getElementById('search-type').value; 
    const searchStationName = document.getElementById('search-station-input').value; 
    const resultBox = document.getElementById('search-result-box'); 
    const searchBtn = document.getElementById('search-action-btn');
    const searchMode = document.querySelector('input[name="search-time-mode"]:checked').value;

    if (!searchStationName) { alert("⚠️ 請先選擇或輸入要查詢的車站！"); return; }
    
    if (searchStationName === '如月車站' || searchStationName.toUpperCase() === 'KISARAGI') {
        triggerKisaragiEvent(); return;
    }
    
    searchBtn.disabled = true; searchBtn.innerHTML = "⏳ 連線檢索中..."; 
    resultBox.style.justifyContent = 'center'; resultBox.innerHTML = `正在為您連線交通部與本地資料庫...`;
    
    try {
        try { 
            if (!cachedTdxToken && ['trtc', 'tra', 'thsr'].includes(searchType)) { 
                const tokenRes = await fetchWithTimeout('/api/get-token', { timeout: 3500 });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json(); cachedTdxToken = tokenData.access_token; 
                }
            } 
        } catch(networkErr) { console.log("網路異常或管制，跳過 Token 取得"); }
        
        let res = await fetchSingleStationTime(searchStationName, searchType, offlineTimetableData, cachedTdxToken, searchMode);
        
        if (res.status === "TOKEN_EXPIRED") { 
            try { 
                const tokenRes = await fetchWithTimeout('/api/get-token', { timeout: 3500 }); 
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json(); cachedTdxToken = tokenData.access_token; 
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
    if(localStorage.getItem('dev_mode_active') === 'true') {
        const mt = document.getElementById('main-title');
        if(mt) { mt.innerText = "末班車生存 (工程)"; mt.style.color = "var(--warning)"; }
    }

    try { const timeRes = await fetchWithTimeout('/data/offline-timetable.json', { timeout: 4000 }); if (timeRes.ok) offlineTimetableData = await timeRes.json(); } catch (e) {}
    try { const transferRes = await fetchWithTimeout('/data/transfer-timetable.json', { timeout: 4000 }); if (transferRes.ok) transferTimetableData = await transferRes.json(); } catch (e) {}
    try { 
        const stationRes = await fetchWithTimeout('/data/stations.json', { timeout: 4000 }); 
        if (stationRes.ok) { 
            globalStationData = await stationRes.json(); 
            
            globalStationData['jp'] = { options: [{id: 'kisaragi', name: '如月車站'}] };
            defaultStations['jp'] = '如月車站';

            const now = getSystemTime();
            if (now.getMonth() === 3 && now.getDate() === 1) {
                const endTypeSelect = document.getElementById('end-type');
                const jpOption = document.createElement('option');
                jpOption.value = 'jp'; jpOption.textContent = '日鐵'; jpOption.style.color = '#ff5252'; jpOption.style.fontWeight = 'bold';
                endTypeSelect.appendChild(jpOption);
                
                endTypeSelect.value = 'jp'; savedEnd = '如月車站';
            }

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
        options = rawOptions.map(s => { if (s.name === '萬華') return { ...s, name: '龍山寺' }; return s; });
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
        
        if (station.name === '如月車站') {
            nameSpan.style.color = '#ff5252'; nameSpan.style.letterSpacing = '2px';
            item.appendChild(nameSpan);
        } else {
            const starSpan = document.createElement('span'); starSpan.className = 'star-icon';
            starSpan.textContent = isFav ? '★' : '☆'; starSpan.style.color = isFav ? '#ffca28' : '#666'; 
            starSpan.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); toggleFavorite(station.name); });
            item.appendChild(nameSpan); item.appendChild(starSpan); 
        }

        item.addEventListener('mousedown', function(e) { e.preventDefault(); });
        item.addEventListener('click', function() { 
            inputField.value = station.name; listContainer.style.display = 'none'; 
            if (point === 'start') checkTransferLock();
        });
        return item;
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
        inputField.addEventListener('focus', () => { if(inputField.disabled) return; inputField.value = ''; renderCustomDropdown(point); });
        inputField.addEventListener('blur', () => { if (point === 'start') setTimeout(checkTransferLock, 100); });
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
            transferInput.disabled = true; transferInput.style.opacity = '0.5'; transferInput.style.pointerEvents = 'none'; 
        } else {
            transferInput.disabled = false; transferInput.style.opacity = '1'; transferInput.style.pointerEvents = 'auto';
            let validNames = transferStations.map(s => s.name === '萬華' ? '龍山寺' : s.name);
            if (!validNames.includes(transferInput.value)) { transferInput.value = validNames[0] || '南港'; }
        }

        const hasJpOption = Array.from(endTypeSelect.options).some(opt => opt.value === 'jp');
        if (hasJpOption) {
            endTypeSelect.querySelector('option[value="jp"]').remove();
            if(document.getElementById('end-station-input').value === '如月車站') { document.getElementById('end-station-input').value = '台北車站'; }
        }

        if (endTypeSelect.options.length > 1) {
            endTypeSelect.innerHTML = '<option value="trtc" selected>北捷</option>';
            document.getElementById('end-station-input').value = defaultStations['trtc'];
            renderCustomDropdown('end');
        }

    } else {
        transferBlock.style.display = 'none';
        const now = getSystemTime();
        const isAprilFools = (now.getMonth() === 3 && now.getDate() === 1);
        let optionsHtml = '<option value="trtc" selected>北捷</option><option value="thsr">高鐵</option>';
        if (isAprilFools) { optionsHtml += '<option value="jp" style="color:#ff5252; font-weight:bold;">日鐵</option>'; }
        endTypeSelect.innerHTML = optionsHtml;
    }
}

function updateStationOptions(point) {
    if (point !== 'transfer') {
        const typeSelect = document.getElementById(point + '-type');
        document.getElementById(point + '-station-input').value = defaultStations[typeSelect.value] || '';
        renderCustomDropdown(point);
    }
    if (point === 'start') checkTransferLock();
}

function toggleNotificationState() {
    isNotificationEnabled = !isNotificationEnabled;
    if (isNotificationEnabled) { actionBtn.innerHTML = "🔕 關閉發車通知"; actionBtn.classList.replace('btn-danger', 'btn-warning'); alert("🔔 已開啟通知！"); } 
    else { actionBtn.innerHTML = "🔔 開啟發車通知"; actionBtn.classList.replace('btn-warning', 'btn-danger'); }
}

function updateClock() {
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

    if (endStationName === '如月車站' || endStationName.toUpperCase() === 'KISARAGI') {
        triggerKisaragiEvent(); return;
    }

    if (isCountingDown) { if ("Notification" in window) { if (Notification.permission === "granted") toggleNotificationState(); else if (Notification.permission !== "denied") Notification.requestPermission().then(p => { if (p === "granted") toggleNotificationState(); }); else alert("⚠️ 您之前拒絕了通知權限，請手動開啟！"); } else alert("⚠️ 不支援推播通知！"); return; }
    
    const startStationObj = globalStationData[startType]?.options.find(s => s.name === startStationName);
    const endStationObj = globalStationData[endType]?.options.find(s => s.name === endStationName);
    if (!startStationObj || !endStationObj) return alert("⚠️ 找不到起訖車站！");
    
    localStorage.setItem('lastTrainStart', startStationName); localStorage.setItem('lastTrainEnd', endStationName);
    const startStation = startStationObj.id; const endStation = endStationObj.id;

    if (startType === endType && startStation === endStation) { clearInterval(timer); isCountingDown = false; display.innerHTML = "恭喜到達🎉"; display.style.fontSize = "40px"; display.style.color = "#4caf50"; statusText.innerHTML = "早點回家洗洗睡！"; actionBtn.style.display = "none"; cancelBtn.style.display = "none"; planBContainer.style.display = "flex"; document.querySelectorAll('.vehicle-option').forEach(btn => btn.style.display = "none"); return; }

    actionBtn.innerHTML = "⏳ 演算法推演中..."; actionBtn.disabled = true;

   try {
        let finalTime = "23:59"; let status = "系統預設"; let transferPenalty = 0; 
        
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
        
        const now = getSystemTime(); let target = getSystemTime(); 
        const [hh, mm] = finalTime.split(':').map(Number); target.setHours(hh, mm, 0, 0); 
        if (now.getHours() >= 4 && hh < 4) target.setDate(target.getDate() + 1); else if (now.getHours() < 4 && hh >= 4) target.setDate(target.getDate() - 1); 
        timeLeft = Math.floor((target.getTime() - now.getTime()) / 1000) - transferPenalty; if (timeLeft < 0) timeLeft = 0; updateClock(); 
        
    } catch (error) { 
        isCountingDown = false; actionBtn.innerHTML = "開始計算轉乘"; actionBtn.disabled = false;
    } 
}

function resetPlan() {
    clearInterval(timer); isCountingDown = false; isNotificationEnabled = false; notificationTriggered = false; planBContainer.style.display = "none"; cancelBtn.style.display = "none"; actionBtn.style.display = "block"; actionBtn.innerHTML = "開始計算轉乘"; actionBtn.classList.remove('btn-danger', 'btn-warning'); actionBtn.classList.add('btn-success'); actionBtn.disabled = false;
    statusText.innerHTML = "現在時間"; speedModeText.innerHTML = "待查驗..."; display.style.color = "#e0e0e0"; display.style.fontSize = "50px"; document.querySelectorAll('.vehicle-option').forEach(btn => btn.style.display = "flex"); updateClock(); timer = setInterval(updateClock, 1000);
}

function shareApp() { 
    if (navigator.share) {
        navigator.share({ title: '末班車生存', text: '趕不上末班車？快用這個工具一鍵查詢倒數！', url: window.location.href }).catch(err => { if (err.name !== 'AbortError') console.error("分享失敗:", err); });
    } else { 
        navigator.clipboard.writeText(window.location.href); alert("✅ 網址已複製！"); 
    } 
}

function toggleContact() { const l = document.getElementById('contact-links'); l.style.display = l.style.display === "flex" ? "none" : "flex"; }
function openAdvancedSheet() { document.getElementById('overlay').style.zIndex = "90"; document.getElementById('overlay').classList.add('active'); document.getElementById('advanced-sheet').classList.add('active'); }
function openSettingsSheet() { document.getElementById('overlay').style.zIndex = "90"; document.getElementById('overlay').classList.add('active'); document.getElementById('settings-sheet').classList.add('active'); }
function closeAllSheets() { document.getElementById('advanced-sheet').classList.remove('active'); document.getElementById('settings-sheet').classList.remove('active'); document.getElementById('error-sheet').classList.remove('active'); const overlay = document.getElementById('overlay'); overlay.classList.remove('active'); setTimeout(() => { overlay.style.zIndex = "90"; }, 300); }
