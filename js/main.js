// ==========================================
// 🧠 全域基底大腦 (main.js) - v3.0 純淨客廳版
// ==========================================

// ==========================================
// 🚨 1. 全域錯誤攔截器 (Red Screen of Death 防護網)
// ==========================================
window.addEventListener('error', function(event) { 
    showErrorSheet(`Error: ${event.message}\nFile: ${event.filename}\nLine: ${event.lineno}`); 
});
window.addEventListener('unhandledrejection', function(event) { 
    showErrorSheet(`Unhandled Promise Rejection:\nReason: ${event.reason}`); 
});

window.showErrorSheet = function(errorMsg) {
    const overlay = document.getElementById('overlay'); 
    const errorSheet = document.getElementById('error-sheet'); 
    const logOutput = document.getElementById('error-log-output');
    if(logOutput) logOutput.value = `[${new Date().toLocaleTimeString()}]\n${errorMsg}\n\n-------------------\n\n` + logOutput.value;
    if(overlay && errorSheet) { 
        overlay.style.zIndex = "9998"; 
        errorSheet.style.zIndex = "9999"; 
        overlay.classList.add('active'); 
        errorSheet.classList.add('active'); 
    }
};

window.closeErrorSheet = function() { 
    const errorSheet = document.getElementById('error-sheet');
    if(errorSheet) errorSheet.classList.remove('active'); 
    if (!document.querySelector('.bottom-sheet.active:not(#error-sheet)')) { 
        const overlay = document.getElementById('overlay');
        if(overlay) {
            overlay.classList.remove('active'); 
            setTimeout(() => { overlay.style.zIndex = "90"; }, 300); 
        }
    } 
};

window.copyErrorLog = function() { 
    const logOutput = document.getElementById('error-log-output'); 
    if(logOutput) {
        logOutput.select(); 
        document.execCommand('copy'); 
        alert("✅ 錯誤代碼已複製！將此代碼交給開發者可快速抓蟲。"); 
    }
};

// ==========================================
// 📺 2. 客廳電視機導航協議 (SPA 微服務控制)
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

// 專門為「從設定頁點進子頁面」設計的返回 (保留遮罩)
window.closePageOnly = function() {
    const sheet = document.getElementById('dynamic-sheet');
    if(sheet) sheet.classList.remove('active');
    setTimeout(() => {
        const frame = document.getElementById('spa-frame');
        if(frame) frame.src = 'about:blank'; 
    }, 300);
};

// 徹底關閉所有面板與遮罩，回到首頁
window.closeAllSheets = function() { 
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active'));
    const overlay = document.getElementById('overlay'); 
    if(overlay) overlay.classList.remove('active'); 
    setTimeout(() => { 
        if(overlay) overlay.style.zIndex = "90"; 
        const frame = document.getElementById('spa-frame');
        if(frame) frame.src = 'about:blank';
    }, 300); 
};

// ==========================================
// 🎵 3. BGM 音樂播放器核心 (無縫切歌)
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

// 定期備份播放進度
setInterval(() => {
    const bgm = document.getElementById('bgm-audio');
    if (bgm && !bgm.paused && bgm.currentTime > 0) {
        localStorage.setItem('bgmTime', bgm.currentTime);
        localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 500);

window.initAndPlayAudio = function() {
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
        
        // 播完自動無縫切換下一首
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
};

window.setupAudioUI = function() {
    const icon = isBgmMuted ? '🔇' : '🔊'; 
    const muteBtn = document.getElementById('mute-btn');
    const headerMuteBtn = document.getElementById('header-mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    if (muteBtn) muteBtn.innerText = icon; 
    if (headerMuteBtn) headerMuteBtn.innerText = icon; 
    if (volumeSlider) volumeSlider.value = isBgmMuted ? 0 : bgmVolume;
};

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

// 網頁載入時的初始設定
window.addEventListener('load', () => { 
    setupAudioUI();
    
    // 阻擋子頻道載入 BGM，避免音樂打架
    if (window.parent !== window) {
        const bgm = document.getElementById('bgm-audio');
        if (bgm) { bgm.pause(); bgm.remove(); }
        return;
    }
    
    // 使用者一互動就喚醒音樂
    const globalWakeUp = () => {
        if (!isBgmMuted) initAndPlayAudio();
        ['touchstart', 'click', 'scroll'].forEach(evt => window.removeEventListener(evt, globalWakeUp, true));
    };
    if (!isBgmMuted) ['touchstart', 'click', 'scroll'].forEach(evt => window.addEventListener(evt, globalWakeUp, true));
});
