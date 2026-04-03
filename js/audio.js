// ==========================================
// 🎵 音樂播放器核心 (audio.js) - 終極 iOS 破壁版
// ==========================================

let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = (savedVol !== null && !isNaN(parseFloat(savedVol))) ? parseFloat(savedVol) : 0.3; 
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true; 

let bgmPlaylist = ["/audio/platform_at_midnight.mp3", "/audio/Midnight_at_Platform_Four.mp3", "/audio/Waiting_at_the_Edge.mp3", "/audio/The_Three_AM_Wait.mp3"];
let savedIndex = localStorage.getItem('bgmIndex');
let currentBgmIndex = (savedIndex !== null && !isNaN(parseInt(savedIndex))) ? parseInt(savedIndex) : Math.floor(Math.random() * bgmPlaylist.length);
let audioInitialized = false;

// 每秒記憶播放進度
setInterval(() => {
    const bgm = document.getElementById('bgm-audio');
    if (bgm && !bgm.paused && bgm.currentTime > 0) {
        localStorage.setItem('bgmTime', bgm.currentTime); 
        localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 1000);

// 🌟 升級：加入 silentWakeup (靜音喚醒) 參數，專門用來騙過蘋果
window.initAndPlayAudio = function(silentWakeup = false) {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return Promise.resolve();

    if (!audioInitialized) {
        bgm.removeAttribute('loop'); 
        bgm.src = bgmPlaylist[currentBgmIndex];
        
        // 恢復秒數邏輯
        bgm.addEventListener('loadedmetadata', () => {
            let savedTime = localStorage.getItem('bgmTime');
            if (savedTime && parseFloat(savedTime) > 0 && parseFloat(savedTime) < bgm.duration) {
                bgm.currentTime = parseFloat(savedTime);
            }
        }, { once: true });

        // 切歌邏輯
        bgm.addEventListener('ended', () => {
            currentBgmIndex = Math.floor(Math.random() * bgmPlaylist.length);
            bgm.src = bgmPlaylist[currentBgmIndex]; 
            localStorage.setItem('bgmTime', 0);
            bgm.load(); 
            bgm.play().catch(e => console.log(e));
        });
        
        bgm.load();
        audioInitialized = true;
    }
    
    // 如果是為了騙許可證的靜音喚醒，音量設為 0；否則給正常音量
    bgm.volume = silentWakeup ? 0 : bgmVolume; 
    
    // 回傳 Promise 讓外面可以接續動作
    let playPromise = bgm.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => console.warn("播放狀態:", e));
    }
    return playPromise;
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
        if (isBgmMuted) {
            bgm.pause(); 
        } else {
            window.initAndPlayAudio(false); // 正常播放
        }
    }
};

window.updateVolume = function(val) {
    bgmVolume = parseFloat(val); isBgmMuted = (bgmVolume === 0);
    localStorage.setItem('isBgmMuted', isBgmMuted); 
    localStorage.setItem('bgmVolume', bgmVolume);
    window.setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); 
    if (bgm) { 
        if (isBgmMuted) {
            bgm.pause(); 
        } else {
            window.initAndPlayAudio(false); // 正常播放
        }
    }
};

window.addEventListener('load', () => {
    window.setupAudioUI();
    
    // 🌟 核心：偷天換日的全域喚醒器
    const globalWakeUp = () => {
        if (!isBgmMuted) {
            // 老客人原本就有開聲音，直接正常播
            window.initAndPlayAudio(false); 
        } else {
            // 🍏 專治 iPhone 16e：以音量 0% 強制播放，騙取 iOS 播放許可
            let p = window.initAndPlayAudio(true);
            if (p !== undefined) {
                p.then(() => {
                    // 拿到許可證了！立刻暫停，並把音量推桿還原，等使用者自己按喇叭
                    const bgm = document.getElementById('bgm-audio');
                    if (bgm && isBgmMuted) {
                        bgm.pause();
                        bgm.volume = bgmVolume; 
                    }
                }).catch(e => console.log("喚醒遭攔截:", e));
            }
        }
        
        // 解鎖完成，解除監聽
        ['touchend', 'click'].forEach(e => window.removeEventListener(e, globalWakeUp));
    };
    
    // ⚠️ 蘋果 Safari 對 touchstart 很感冒，改用 touchend 判定更精準
    ['touchend', 'click'].forEach(e => window.addEventListener(e, globalWakeUp, { once: true }));
});
