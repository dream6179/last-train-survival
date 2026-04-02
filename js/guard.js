// ==========================================
// 🛡️ 守門員腳本 (guard.js)
// 放在 index.html 的 <head> 裡，確保畫面還沒畫出來就先檢查
// ==========================================
(async function checkGate() {
    // 檢查是否有「通行證」
    const hasBypass = sessionStorage.getItem('dev_mode_bypass') === 'true';
    const hasAgreed = sessionStorage.getItem('soft_warning_agreed') === 'true';

    try {
        const res = await fetch('/data/config.json?t=' + new Date().getTime());
        const data = await res.json();
        
        // 判定是否需要攔截跳轉
        if (data.maintenance === 1 && !hasBypass) {
            window.location.replace('/gatekeeper.html?mode=1');
        } else if (data.maintenance === 2 && !hasAgreed && !hasBypass) {
            window.location.replace('/gatekeeper.html?mode=2');
        }
    } catch(e) {
        // 如果抓不到 config 就當作正常運作，不阻擋求生
        console.log('Guard bypass');
    }
})();
