// ==========================================
// 📱 介面與視窗控制 (ui.js) - 層級修正版
// ==========================================
let currentMode = 'survival';

window.openPage = function(url) { 
    const frame = document.getElementById('spa-frame');
    const overlay = document.getElementById('overlay');
    const sheet = document.getElementById('dynamic-sheet');
    
    if (frame && overlay && sheet) {
        frame.src = url; 
        overlay.classList.add('active'); 
        sheet.classList.add('active'); 
    }
};

window.closeDynamicSheet = function() { 
    const sheet = document.getElementById('dynamic-sheet');
    const overlay = document.getElementById('overlay');
    
    if (sheet) sheet.classList.remove('active'); 
    setTimeout(() => { 
        if (document.getElementById('spa-frame')) document.getElementById('spa-frame').src = 'about:blank'; 
        if (overlay) overlay.classList.remove('active'); 
    }, 300); 
};

window.closeAllSheets = function() { 
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); 
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('active'); 
};

window.toggleContact = function() {
    const l = document.getElementById('contact-links');
    if(l) l.style.display = (l.style.display === "flex") ? "none" : "flex";
};

window.openSettingsSheet = function() {
    const overlay = document.getElementById('overlay'); 
    const sheet = document.getElementById('settings-sheet');
    if(overlay && sheet) { 
        overlay.classList.add('active'); 
        sheet.classList.add('active'); 
    }
};

window.shareApp = function() {
    if (navigator.share) { 
        navigator.share({ title: '末班車生存', text: '開啟極限求生模式！', url: window.location.href }).catch(e=>e); 
    } else { 
        alert("請直接複製網址！"); 
    }
};

window.toggleAppMode = function() {
    const modeSurvival = document.getElementById('mode-survival'); 
    const modeSearch = document.getElementById('mode-search');
    const mainTitle = document.getElementById('main-title');
    
    if (currentMode === 'survival') { 
        modeSurvival.style.display = 'none'; 
        modeSearch.style.display = 'block'; 
        if (mainTitle) mainTitle.innerText = "時刻表檢索";
        currentMode = 'search'; 
    } else { 
        modeSearch.style.display = 'none'; 
        modeSurvival.style.display = 'block'; 
        if (mainTitle) mainTitle.innerText = "末班車生存";
        currentMode = 'survival'; 
    }
};
