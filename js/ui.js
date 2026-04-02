// ==========================================
// 📱 介面與視窗控制 (ui.js)
// ==========================================
let currentMode = 'survival';

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
    const overlay = document.getElementById('overlay'); const sheet = document.getElementById('settings-sheet');
    if(overlay && sheet) { overlay.classList.add('active'); sheet.classList.add('active'); }
};

window.shareApp = function() {
    if (navigator.share) { navigator.share({ title: '末班車生存', text: '開啟極限求生模式！', url: window.location.href }).catch(e=>e); } 
    else { alert("請直接複製網址！"); }
};

window.toggleAppMode = function() {
    const modeSurvival = document.getElementById('mode-survival'); const modeSearch = document.getElementById('mode-search');
    if (currentMode === 'survival') { modeSurvival.style.display = 'none'; modeSearch.style.display = 'block'; currentMode = 'search'; } 
    else { modeSearch.style.display = 'none'; modeSurvival.style.display = 'block'; currentMode = 'survival'; }
};
