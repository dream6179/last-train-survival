// ==========================================
// 📱 介面控制 (ui.js) - 精準層級版
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

// 📺 🌟 新增：只關閉電視頁面，保留設定選單
window.closePageOnly = function() {
    const sheet = document.getElementById('dynamic-sheet');
    if (sheet) sheet.classList.remove('active');
    
    // 延遲清空內容，避免縮回動畫時看到白屏
    setTimeout(() => {
        const frame = document.getElementById('spa-frame');
        if (frame) frame.src = 'about:blank';
    }, 300);
};

// 📺 關閉所有面板 (回到首頁最乾淨狀態)
window.closeAllSheets = function() { 
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); 
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('active'); 
    
    setTimeout(() => {
        const frame = document.getElementById('spa-frame');
        if (frame) frame.src = 'about:blank';
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
