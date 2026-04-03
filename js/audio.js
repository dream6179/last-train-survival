// ==========================================
// 🎵 音樂播放器核心 (audio.js) - 蘋果終極降伏版
// ==========================================

let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = (savedVol !== null && !isNaN(parseFloat(savedVol))) ? parseFloat(savedVol) : 0.3; 
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true; 

let bgmPlaylist = ["/audio/platform_at_midnight.mp3", "/audio/Midnight_at_Platform_Four.mp3", "/audio/Waiting_at_the_Edge.mp3", "/audio/The_Three_AM_Wait.mp3"];
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

// 🌟 升級：加入 isSilentUnlock 參數，專殺 iOS
window.initAndPlayAudio = function(isSilentUnlock = false) {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return Promise.resolve();

    if (!audioInitialized) {
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
            // 🚫 刪除 bgm.load()，讓 play() 自己負責載入，避免 iOS 打斷
            bgm.play().catch(e => console.log(e));
        });
        
        // 🚫 刪除原本在這裡的 bgm.load()，這就是害 16e 當機的元凶！
        audioInitialized = true;
    }
    
    // 🍏 iOS 騙術核心：用真正的 HTML5 muted 屬性靜音
    if (isSilentUnlock) {
        bgm.muted = true; 
    } else {
        bgm.muted = false;
        bgm.volume = bgmVolume;
    }
    
    let playPromise = bgm.play();
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
            window.initAndPlayAudio(false); // 正常解除靜音並播放
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
            window.initAndPlayAudio(false);
        }
    }
};

window.addEventListener('load', () => {
    window.setupAudioUI();
    
    const globalWakeUp = () => {
        if (!isBgmMuted) {
            window.initAndPlayAudio(false); 
        } else {
            // 🍏 以完全靜音 (muted=true) 屬性啟動，騙取 iOS 播放許可
            let p = window.initAndPlayAudio(true);
            if (p !== undefined) {
                p.then(() => {
                    const bgm = document.getElementById('bgm-audio');
                    if (bgm && isBgmMuted) {
                        bgm.pause(); // 拿到許可證後立刻暫停
                        bgm.muted = false; // 恢復正常狀態，等使用者手動按喇叭
                    }
                }).catch(e => console.log("iOS 喚醒失敗，只能等手動點擊喇叭:", e));
            }
        }
        
        // 拆除監聽器
        ['touchstart', 'touchend', 'click'].forEach(e => document.body.removeEventListener(e, globalWakeUp));
    };
    
    // 把所有可能的觸控事件都綁上去，確保 16e 絕對跑得掉
    ['touchstart', 'touchend', 'click'].forEach(e => document.body.addEventListener(e, globalWakeUp, { once: true }));
});
