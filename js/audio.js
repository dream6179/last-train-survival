// ==========================================
// 🎵 音樂播放器核心 (audio.js) - 經典無損還原版
// ==========================================
let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = (savedVol !== null && !isNaN(parseFloat(savedVol))) ? parseFloat(savedVol) : 0.3;
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true;

let bgmPlaylist = ["/audio/platform_at_midnight.mp3", "/audio/Midnight_at_Platform_Four.mp3", "/audio/Waiting_at_the_Edge.mp3", "/audio/The_Three_AM_Wait.mp3"];
let savedIndex = localStorage.getItem('bgmIndex');
let currentBgmIndex = (savedIndex !== null && !isNaN(parseInt(savedIndex))) ? parseInt(savedIndex) : Math.floor(Math.random() * bgmPlaylist.length);

setInterval(() => {
    const bgm = document.getElementById('bgm-audio');
    if (bgm && !bgm.paused && bgm.currentTime > 0) {
        localStorage.setItem('bgmTime', bgm.currentTime);
        localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 1000);

// 🌟 拼圖一：預先裝填系統 (不要等點擊才去載入檔案)
function preloadAudioCore() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm || bgm.src) return; // 如果已經裝填過就跳過

    bgm.removeAttribute('loop');
    bgm.src = bgmPlaylist[currentBgmIndex];

    bgm.addEventListener('loadedmetadata', () => {
        let savedTime = localStorage.getItem('bgmTime');
        if (savedTime && parseFloat(savedTime) > 0 && parseFloat(savedTime) < bgm.duration) {
            bgm.currentTime = parseFloat(savedTime);
        }
    }, { once: true });

    bgm.addEventListener('ended', () => {
        currentBgmIndex = Math.floor(Math.random() * bgmPlaylist.length);
        bgm.src = bgmPlaylist[currentBgmIndex];
        localStorage.setItem('bgmTime', 0);
        bgm.load();
        let p = bgm.play();
        if(p) p.catch(e => console.log(e));
    });

    bgm.load(); // 先讓瀏覽器去抓音軌
}

// 負責真正播歌的函式
window.initAndPlayAudio = function() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return;
    preloadAudioCore(); // 確保已裝填
    bgm.volume = bgmVolume;
    let p = bgm.play();
    if(p) p.catch(e => console.log("播放被阻擋:", e));
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

window.addEventListener('load', () => {
    window.setupAudioUI();
    preloadAudioCore(); // 一進網頁就先去撈音檔，這是破除 16e 魔咒的關鍵

    // 🌟 拼圖二：經典的「秒播秒停解鎖法」
    const unlockAudio = () => {
        const bgm = document.getElementById('bgm-audio');
        if (bgm) {
            let p = bgm.play();
            if (p) {
                p.then(() => {
                    // 拿到 iOS 的許可證後，如果現在是靜音狀態，立刻暫停！
                    if (isBgmMuted) {
                        bgm.pause();
                    }
                }).catch(e => console.log("解鎖失敗:", e));
            }
        }
        // 解鎖完就功成身退，拔除監聽器
        ['touchstart', 'click'].forEach(e => document.body.removeEventListener(e, unlockAudio));
    };

    ['touchstart', 'click'].forEach(e => document.body.addEventListener(e, unlockAudio, { once: true }));
});
