// ==========================================
// 🎵 音樂播放器核心 (audio.js) - 終極縫合版
// ==========================================

// 🌟 預設靜音防護：沒紀錄就預設為 true (靜音)
let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = (savedVol !== null && !isNaN(parseFloat(savedVol))) ? parseFloat(savedVol) : 0.3; 
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true; 

let bgmPlaylist = ["/audio/platform_at_midnight.mp3", "/audio/Midnight_at_Platform_Four.mp3", "/audio/Waiting_at_the_Edge.mp3", "/audio/The_Three_AM_Wait.mp3"];
let savedIndex = localStorage.getItem('bgmIndex');
let currentBgmIndex = (savedIndex !== null && !isNaN(parseInt(savedIndex))) ? parseInt(savedIndex) : Math.floor(Math.random() * bgmPlaylist.length);
let audioInitialized = false;

// 每秒記憶播放進度 (你原本的神級功能，保留！)
setInterval(() => {
    const bgm = document.getElementById('bgm-audio');
    if (bgm && !bgm.paused && bgm.currentTime > 0) {
        localStorage.setItem('bgmTime', bgm.currentTime); 
        localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 1000);

window.initAndPlayAudio = function() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return;
    if (!audioInitialized) {
        bgm.removeAttribute('loop'); 
        bgm.src = bgmPlaylist[currentBgmIndex];
        bgm.addEventListener('loadedmetadata', () => {
            let savedTime = localStorage.getItem('bgmTime');
            if (savedTime && parseFloat(savedTime) > 0 && parseFloat(savedTime) < bgm.duration) bgm.currentTime = parseFloat(savedTime);
        }, { once: true });
        bgm.load();
        bgm.addEventListener('ended', () => {
            currentBgmIndex = Math.floor(Math.random() * bgmPlaylist.length);
            bgm.src = bgmPlaylist[currentBgmIndex]; 
            localStorage.setItem('bgmTime', 0);
            bgm.load(); 
            bgm.play().catch(e => console.log(e));
        });
        audioInitialized = true;
    }
    bgm.volume = bgmVolume; 
    bgm.play().catch(e => console.log(e));
};

window.setupAudioUI = function() {
    const icon = isBgmMuted ? '🔇' : '🔊'; 
    if (document.getElementById('mute-btn')) document.getElementById('mute-btn').innerText = icon; 
    if (document.getElementById('header-mute-btn')) document.getElementById('header-mute-btn').innerText = icon; 
    if (document.getElementById('volume-slider')) document.getElementById('volume-slider').value = isBgmMuted ? 0 : bgmVolume;
};

window.toggleMute = function() {
    isBgmMuted = !isBgmMuted; 
    if (!isBgmMuted && bgmVolume === 0) bgmVolume = 0.3; 
    localStorage.setItem('isBgmMuted', isBgmMuted); 
    localStorage.setItem('bgmVolume', bgmVolume);
    window.setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { 
        if (isBgmMuted) bgm.pause(); 
        else window.initAndPlayAudio(); 
    }
};

window.updateVolume = function(val) {
    bgmVolume = parseFloat(val); isBgmMuted = (bgmVolume === 0);
    localStorage.setItem('isBgmMuted', isBgmMuted); 
    localStorage.setItem('bgmVolume', bgmVolume);
    window.setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { 
        if (isBgmMuted) bgm.pause(); 
        else window.initAndPlayAudio(); 
    }
};

// 🌟 核心修改區：iPhone 喚醒機制大升級
window.addEventListener('load', () => {
    window.setupAudioUI();
    
    // 全域喚醒器 (偷偷上膛版)
    const globalWakeUp = () => {
        if (!isBgmMuted) {
            // 如果原本就開著聲音，直接播
            window.initAndPlayAudio(); 
        } else {
            // 🌟 即使靜音，也利用這次點擊把音檔塞進記憶體
            const bgm = document.getElementById('bgm-audio');
            if (bgm && !audioInitialized) {
                bgm.src = bgmPlaylist[currentBgmIndex];
                // 順便把時間也恢復好，這樣解鎖靜音時就是無縫接軌
                bgm.addEventListener('loadedmetadata', () => {
                    let savedTime = localStorage.getItem('bgmTime');
                    if (savedTime && parseFloat(savedTime) > 0 && parseFloat(savedTime) < bgm.duration) bgm.currentTime = parseFloat(savedTime);
                }, { once: true });
                bgm.load();
                audioInitialized = true;
            }
        }
        // 解鎖成功後立刻移除監聽，保持效能乾淨
        ['touchstart', 'click'].forEach(e => window.removeEventListener(e, globalWakeUp));
    };
    
    // 無論是否靜音，都掛上喚醒器！
    ['touchstart', 'click'].forEach(e => window.addEventListener(e, globalWakeUp, { once: true }));
});
