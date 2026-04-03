// ==========================================
// 🎵 音樂播放器核心 (audio.js) - 最終白金整合版
// ==========================================

// 1. 讀取記憶與預設狀態
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

// 2. 🌟 恢復高級功能：每秒記憶播放進度
setInterval(() => {
    const bgm = document.getElementById('bgm-audio');
    if (bgm && !bgm.paused && bgm.currentTime > 0) {
        localStorage.setItem('bgmTime', bgm.currentTime);
        localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 1000);

// 3. 🌟 把「裝填音檔」獨立出來，避免 iOS 覺得我們在拖延時間
window.setupAudioSource = function() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm || audioInitialized) return;

    bgm.removeAttribute('loop');
    bgm.src = bgmPlaylist[currentBgmIndex];

    // 恢復上次聽到的秒數
    bgm.addEventListener('loadedmetadata', () => {
        let savedTime = localStorage.getItem('bgmTime');
        if (savedTime && parseFloat(savedTime) > 0 && parseFloat(savedTime) < bgm.duration) {
            bgm.currentTime = parseFloat(savedTime);
        }
    }, { once: true });

    // 自動換歌
    bgm.addEventListener('ended', () => {
        currentBgmIndex = Math.floor(Math.random() * bgmPlaylist.length);
        bgm.src = bgmPlaylist[currentBgmIndex];
        localStorage.setItem('bgmTime', 0);
        let p = bgm.play();
        if(p) p.catch(e => console.log("切歌失敗:", e));
    });

    bgm.load(); // 提早讓瀏覽器去抓檔案
    audioInitialized = true;
};

// 4. 純粹的播放執行器
window.initAndPlayAudio = function() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return;
    
    if (!audioInitialized) window.setupAudioSource();
    
    bgm.volume = bgmVolume;
    let p = bgm.play();
    if (p !== undefined) p.catch(e => console.warn("播放遭攔截:", e));
};

// 5. UI 與按鈕控制
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
            window.initAndPlayAudio(); 
        }
    }
};

window.updateVolume = function(val) {
    bgmVolume = parseFloat(val);
    isBgmMuted = (bgmVolume === 0);
    localStorage.setItem('isBgmMuted', isBgmMuted);
    localStorage.setItem('bgmVolume', bgmVolume);
    window.setupAudioUI();

    const bgm = document.getElementById('bgm-audio');
    if (bgm) {
        if (isBgmMuted) {
            bgm.pause();
        } else {
            bgm.volume = bgmVolume;
            if (bgm.paused) window.initAndPlayAudio();
        }
    }
};

// 6. 🌟 終極全域喚醒器 (解決 Flip7 自動播與 16e 沉默問題)
window.addEventListener('load', () => {
    window.setupAudioUI();
    window.setupAudioSource(); // 一進網頁，立刻裝填子彈！

    const globalWakeUp = () => {
        const bgm = document.getElementById('bgm-audio');
        if (!bgm) return;

        // 不管三七二十一，使用者一摸螢幕，立刻觸發 play() 搶蘋果許可證！
        let p = bgm.play();
        if (p !== undefined) {
            p.then(() => {
                // 🍎 拿到許可證了！
                if (isBgmMuted) {
                    // 如果使用者設定是靜音，秒暫停 (防嚇人)
                    bgm.pause();
                } else {
                    // 🤖 如果原本就有開聲音 (Flip 7老客人)，直接給音量繼續播！
                    bgm.volume = bgmVolume;
                }
            }).catch(e => console.log("喚醒失敗:", e));
        }

        // 解鎖成功，功成身退
        ['touchstart', 'touchend', 'click'].forEach(e => document.body.removeEventListener(e, globalWakeUp));
    };

    // 綁定所有可能的觸控事件
    ['touchstart', 'touchend', 'click'].forEach(e => document.body.addEventListener(e, globalWakeUp, { once: true }));
});
