// ==========================================
// 🎵 音樂播放器核心 (audio.js) - 經典無損還原版
// ==========================================

let savedVol = localStorage.getItem('bgmVolume');
let bgmVolume = savedVol !== null ? parseFloat(savedVol) : 0.3; // 預設 30%
let savedMuted = localStorage.getItem('isBgmMuted');
let isBgmMuted = savedMuted !== null ? savedMuted === 'true' : true; // 預設靜音

let bgmPlaylist = [
    "/audio/platform_at_midnight.mp3", 
    "/audio/Midnight_at_Platform_Four.mp3",
    "/audio/Waiting_at_the_Edge.mp3",
    "/audio/The_Three_AM_Wait.mp3"
];

let currentBgmIndex = Math.floor(Math.random() * bgmPlaylist.length);
let audioInitialized = false;

// 最純淨的播放啟動器 (不加任何多餘的非同步等待，專治 iOS)
window.initAndPlayAudio = function() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return;
    
    if (!audioInitialized) {
        bgm.removeAttribute('loop'); 
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
            let p = bgm.play();
            if(p !== undefined) p.catch(e => console.log("切歌失敗:", e));
        });
        audioInitialized = true;
    }

    bgm.volume = bgmVolume;
    let p = bgm.play();
    if (p !== undefined) {
        p.catch(e => console.log("等待使用者互動才能播放:", e));
    }
};

window.setupAudioUI = function() {
    const icon = isBgmMuted ? '🔇' : '🔊'; 
    if (document.getElementById('mute-btn')) document.getElementById('mute-btn').innerText = icon; 
    if (document.getElementById('header-mute-btn')) document.getElementById('header-mute-btn').innerText = icon; 
    if (document.getElementById('volume-slider')) document.getElementById('volume-slider').value = isBgmMuted ? 0 : bgmVolume;
};

// 點擊喇叭按鈕
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
            window.initAndPlayAudio(); 
        }
    }
};

window.addEventListener('DOMContentLoaded', () => { 
    window.setupAudioUI();

    // 經典全域喚醒器 (只有原本沒靜音的人，才偷偷喚醒)
    const globalWakeUp = () => {
        if (!isBgmMuted) {
            window.initAndPlayAudio();
        }
        document.body.removeEventListener('touchstart', globalWakeUp);
        document.body.removeEventListener('click', globalWakeUp);
    };
    
    document.body.addEventListener('touchstart', globalWakeUp, { once: true });
    document.body.addEventListener('click', globalWakeUp, { once: true });
});
