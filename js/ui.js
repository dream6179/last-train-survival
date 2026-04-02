// ==========================================
// 📱 介面控制 (ui.js) - 電視遙控器修復版
// ==========================================

// 📺 打開電視頻道 (切換 iframe)
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

// 📺 關閉電視頻道
window.closeDynamicSheet = function() { 
    const sheet = document.getElementById('dynamic-sheet');
    const overlay = document.getElementById('overlay');
    
    if (sheet) sheet.classList.remove('active'); 
    setTimeout(() => { 
        if (document.getElementById('spa-frame')) document.getElementById('spa-frame').src = 'about:blank'; 
        if (overlay) overlay.classList.remove('active'); 
    }, 300); 
};

// 打開快速設定
window.openSettingsSheet = function() {
    const overlay = document.getElementById('overlay'); 
    const sheet = document.getElementById('settings-sheet');
    if(overlay && sheet) { 
        overlay.classList.add('active'); 
        sheet.classList.add('active'); 
    }
};

// 關閉所有面板 (包含設定與電視)
window.closeAllSheets = function() { 
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); 
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('active'); 
    
    // 順便清空電視畫面，節省效能
    setTimeout(() => {
        const frame = document.getElementById('spa-frame');
        if (frame) frame.src = 'about:blank';
    }, 300);
};

window.toggleContact = function() {
    const links = document.getElementById('contact-links');
    if(links) links.style.display = (links.style.display === 'flex') ? 'none' : 'flex';
};

window.shareApp = function() {
    if (navigator.share) { 
        navigator.share({ title: '末班車生存', url: window.location.origin }).catch(e=>e); 
    } else { 
        alert("請直接複製網址分享！"); 
    }
};
