// 🌟 屍體撿回：究極報錯攔截器
window.addEventListener('error', function(event) {
    const msg = `【崩潰回報】\n訊息: ${event.message}\n檔案: ${event.filename}\n行列: ${event.lineno}:${event.colno}\n堆疊: ${event.error ? event.error.stack : 'N/A'}`;
    if(typeof showErrorSheet === 'function') showErrorSheet(msg);
});

window.addEventListener('unhandledrejection', function(event) {
    const msg = `【非同步崩潰】\n原因: ${event.reason}\n堆疊: ${event.reason && event.reason.stack ? event.reason.stack : 'N/A'}`;
    if(typeof showErrorSheet === 'function') showErrorSheet(msg);
});
