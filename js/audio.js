// ==========================================
// 🎵 音樂播放器核心 (audio.js)
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
        localStorage.setItem('bgmTime', bgm.currentTime); localStorage.setItem('bgmIndex', currentBgmIndex);
    }
}, 1000);

window.initAndPlayAudio = function() {
    const bgm = document.getElementById('bgm-audio');
    if (!bgm) return;
    if (!audioInitialized) {
        bgm.removeAttribute('loop'); bgm.src = bgmPlaylist[currentBgmIndex];
        bgm.addEventListener('loadedmetadata', () => {
            let savedTime = localStorage.getItem('bgmTime');
            if (savedTime && parseFloat(savedTime) > 0 && parseFloat(savedTime) < bgm.duration) bgm.currentTime = parseFloat(savedTime);
        }, { once: true });
        bgm.load();
        bgm.addEventListener('ended', () => {
            currentBgmIndex = Math.floor(Math.random() * bgmPlaylist.length);
            bgm.src = bgmPlaylist[currentBgmIndex]; localStorage.setItem('bgmTime', 0);
            bgm.load(); bgm.play().catch(e => console.log(e));
        });
        audioInitialized = true;
    }
    bgm.volume = bgmVolume; bgm.play().catch(e => console.log(e));
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
    localStorage.setItem('isBgmMuted', isBgmMuted); localStorage.setItem('bgmVolume', bgmVolume);
    window.setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); if (bgm) { if (isBgmMuted) bgm.pause(); else window.initAndPlayAudio(); }
};

window.updateVolume = function(val) {
    bgmVolume = parseFloat(val); isBgmMuted = (bgmVolume === 0);
    localStorage.setItem('isBgmMuted', isBgmMuted); localStorage.setItem('bgmVolume', bgmVolume);
    window.setupAudioUI();
    const bgm = document.getElementById('bgm-audio'); if (bgm) { if (isBgmMuted) bgm.pause(); else window.initAndPlayAudio(); }
};

window.addEventListener('load', () => {
    window.setupAudioUI();
    if (!isBgmMuted) {
        const wakeUp = () => { window.initAndPlayAudio(); ['touchstart', 'click'].forEach(e => window.removeEventListener(e, wakeUp)); };
        ['touchstart', 'click'].forEach(e => window.addEventListener(e, wakeUp));
    }
});
