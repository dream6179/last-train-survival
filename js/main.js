// ==========================================
// 核心變數與設定
// ==========================================
let currentMode = 'survival'; 
let isCountingDown = false; 
let timeLeft = 0;           
let globalStationData = null;
let offlineTimetableData = null;
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

// ==========================================
// 🎵 音樂播放器核心 (防呆防當機穩固版)
// ==========================================
let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = (savedVol !== null && !isNaN(parseFloat(savedVol))) ? parseFloat(savedVol) : 0.3; 
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true; 

let bgmPlaylist = [
    "/audio/platform_at_midnight.mp3", 
    "/audio/Midnight_at_Platform_Four.mp3",
    "/audio/Waiting_at_the_Edge.mp3",
    "/audio/The_Three_AM_Wait.mp3"
];

let savedIndex = localStorage.getItem('bgmIndex');
let currentBgmIndex = (savedIndex !== null && !isNaN(parseInt(savedIndex))) ? parseInt(savedIndex) : Math.floor(Math.random() * bgmPlaylist.length);
let audioInitialized = false;

setInterval(() => {
    const bgm = document.getElementById('bgm-audio');
    if (bgm && !bgm.paused && bgm.currentTime > 0) {
        localStorage.setItem('bgmTime', bgm.currentTime);
        localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 1000);

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
        bgm.load(); // 🌟 這是手機瀏覽器的救命符，絕對不能省
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
    if (p !== undefined) p.catch(e => console.log("等待使用者互動:", e));
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

// 🌟 強制綁定在 window 上，確保 HTML 點擊絕對找得到它
window.toggleMute = function() {
    isBgmMuted = !isBgmMuted; 
    if (!isBgmMuted && bgmVolume === 0) bgmVolume = 0.3; 
    localStorage.setItem('isBgmMuted', isBgmMuted);
    localStorage.setItem('bgmVolume', bgmVolume);
    setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { if (isBgmMuted) bgm.pause(); else initAndPlayAudio(); }
};

window.updateVolume = function(val) {
    bgmVolume = parseFloat(val); 
    isBgmMuted = (bgmVolume === 0);
    localStorage.setItem('isBgmMuted', isBgmMuted);
    localStorage.setItem('bgmVolume', bgmVolume);
    setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { if (isBgmMuted) bgm.pause(); else initAndPlayAudio(); }
};

// ==========================================
// 視窗控制 (SPA & UI 選單)
// ==========================================
window.addEventListener('load', async () => {
    setupAudioUI();
    // 監聽第一次觸控來喚醒音樂 (防蘋果阻擋)
    if (!isBgmMuted) {
        const wakeUp = () => { initAndPlayAudio(); ['touchstart', 'click'].forEach(e => window.removeEventListener(e, wakeUp)); };
        ['touchstart', 'click'].forEach(e => window.addEventListener(e, wakeUp));
    }
    
    try { const res = await fetch('/data/stations.json'); if(res.ok) globalStationData = await res.json(); } catch(e){}
    try { const timeRes = await fetch('/data/offline-timetable.json'); if(timeRes.ok) offlineTimetableData = await timeRes.json(); } catch(e){}
});

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

window.closeAllSheets = function() { 
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); 
    document.getElementById('overlay').classList.remove('active'); 
};

window.toggleContact = function() {
    const l = document.getElementById('contact-links');
    if(l) l.style.display = (l.style.display === "flex") ? "none" : "flex";
};

window.openSettingsSheet = function() {
    const overlay = document.getElementById('overlay');
    const sheet = document.getElementById('settings-sheet');
    if(overlay && sheet) { overlay.classList.add('active'); sheet.classList.add('active'); }
};

window.shareApp = function() {
    if (navigator.share) {
        navigator.share({ title: '末班車生存', text: '趕不上末班車？開啟極限求生模式！', url: window.location.href }).catch(console.error);
    } else { alert("您的瀏覽器不支援分享功能，請直接複製網址！"); }
};

window.toggleAppMode = function() {
    const modeSurvival = document.getElementById('mode-survival'); const modeSearch = document.getElementById('mode-search');
    if (currentMode === 'survival') { modeSurvival.style.display = 'none'; modeSearch.style.display = 'block'; currentMode = 'search'; } 
    else { modeSearch.style.display = 'none'; modeSurvival.style.display = 'block'; currentMode = 'survival'; }
};

// ==========================================
// 核心演算法 (公車連動與倒數計時)
// ==========================================
window.updateStationOptions = async function(point) {
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
};

window.handleAction = async function() {
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
            
            if (typeof getSystemTime === 'function') {
                const now = getSystemTime(); let target = getSystemTime();
                const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
                if (now > target) target.setDate(target.getDate() + 1);
                timeLeft = Math.floor((target - now) / 1000);
                if (timeLeft > 28800) timeLeft = 0; // 🌟 防爆表系統
            }
        } else alert(res.status);
    } catch (e) { alert("計算失敗"); }
    finally { btn.disabled = false; btn.innerHTML = "開始計算轉乘"; }
};

window.resetPlan = function() { 
    isCountingDown = false; 
    document.getElementById('action-btn').style.display = 'block'; 
    document.getElementById('cancel-btn').style.display = 'none'; 
    document.getElementById('plan-b-container').style.display = 'none'; 
    document.getElementById('speed-mode').innerText = '待查驗...'; 
};

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
