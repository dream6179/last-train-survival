// ==========================================
// 🔍 獨立查詢系統 (search.js) - 滿血復活版
// ==========================================
let globalStationData = null;
let searchOfflineData = null;

window.addEventListener('load', async () => {
    try { 
        const res = await fetch('/data/stations.json'); 
        if(res.ok) { globalStationData = await res.json(); initSearchAutocomplete(); } 
    } catch(e){}
    try { 
        const timeRes = await fetch('/data/offline-timetable.json'); 
        if(timeRes.ok) searchOfflineData = await timeRes.json(); 
    } catch(e){}
});

function initSearchAutocomplete() {
    const inputField = document.getElementById('search-station-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if(!inputField) return;
    
    inputField.addEventListener('input', () => {
        if(clearBtn) clearBtn.style.display = inputField.value ? 'flex' : 'none';
        renderSearchDropdown();
    });

    if(clearBtn) {
        clearBtn.addEventListener('click', () => { 
            inputField.value = ''; 
            clearBtn.style.display = 'none'; 
            renderSearchDropdown(); 
            inputField.focus(); // 清除後保持焦點
        });
    }

    inputField.addEventListener('focus', renderSearchDropdown);
    inputField.addEventListener('click', renderSearchDropdown);
    
    // 🌟 新增：離開焦點時的鄉民防禦 (北車自動翻譯)
    inputField.addEventListener('blur', () => {
        let val = inputField.value.trim().replace(/臺/g, '台');
        if (val === '北車') inputField.value = '台北車站';
    });
    
    document.addEventListener('click', (e) => {
        const list = document.getElementById('search-autocomplete-list');
        if (list && !inputField.contains(e.target)) list.style.display = 'none';
    });
}

function renderSearchDropdown() {
    const type = document.getElementById('search-type').value;
    const inputField = document.getElementById('search-station-input');
    const listContainer = document.getElementById('search-autocomplete-list');
    if(!inputField || !listContainer) return;

    const options = globalStationData?.[type]?.options || [];
    listContainer.innerHTML = '';
    
    // 🌟 搜尋時也能防禦「北車」
    let rawFilterText = inputField.value.trim().replace(/臺/g, '台');
    if (rawFilterText === '北車') rawFilterText = '台北車站';
    const filterText = rawFilterText.toLowerCase();

    options.forEach(station => {
        const normName = station.name.replace(/臺/g, '台').toLowerCase();
        if (normName.includes(filterText) || filterText === '') {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            
            if (station.name === '如月車站') {
                item.innerHTML = `<span style="color:#ff5252; font-weight:bold; letter-spacing:2px;">${station.name}</span>`;
            } else {
                item.innerHTML = `<span>${station.name}</span>`;
            }
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                inputField.value = station.name;
                listContainer.style.display = 'none';
                document.getElementById('search-clear-btn').style.display = 'flex';
            });
            listContainer.appendChild(item);
        }
    });
    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

// 🌟 修復重點 1：補上台鐵懶載入邏輯！
window.updateSearchOptions = async function() {
    const type = document.getElementById('search-type').value;
    const inputField = document.getElementById('search-station-input');
    
    inputField.value = '';
    document.getElementById('search-clear-btn').style.display = 'none';
    
    if (type === 'tra' && globalStationData && !globalStationData.tra.isFullLoaded) {
        inputField.placeholder = "⏳ 載入台鐵站點中...";
        try {
            const res = await fetch('/data/tra-stations.json');
            if (res.ok) {
                const fullTraData = await res.json();
                globalStationData.tra.options = Array.isArray(fullTraData) ? fullTraData : (fullTraData.options || fullTraData.tra?.options || []);
                globalStationData.tra.isFullLoaded = true;
                renderSearchDropdown(); // 資料載好後立刻渲染選單
            }
        } catch (e) { console.error("台鐵載入失敗", e); }
        inputField.placeholder = "輸入車站名稱";
    }
};

window.executeFullSearch = async function() {
    const type = document.getElementById('search-type').value;
    const station = document.getElementById('search-station-input').value.trim();
    const box = document.getElementById('search-result-box');
    
    if (station === '如月車站' || station.toUpperCase() === 'KISARAGI') {
        if(window.parent && window.parent.triggerKisaragiEvent) {
            window.parent.triggerKisaragiEvent();
        } else {
            alert("⚠️ 警告：無法讀取該車站坐標。");
        }
        return;
    }
    
    if(!station) { box.innerHTML = "<div style='color: var(--danger); text-align: center; padding: 20px;'>⚠️ 請輸入車站名稱</div>"; return; }
    box.innerHTML = "<div style='text-align: center; padding: 20px;'>⏳ 正在為您檢索...</div>";

    try {
        if (typeof window.fetchSingleStationTime === 'function') {
            // 🌟 升級：多傳一個 globalStationData 過去，讓演算法能查 ID
            const res = await window.fetchSingleStationTime(station, type, searchOfflineData, globalStationData);

            if (res && res.status === "success" && res.data.length > 0) {
                let html = `<div style="color: var(--success); font-weight: bold; margin-bottom: 15px; font-size: 15px; border-bottom: 1px solid #444; padding-bottom: 10px;">✅ [${station}] 末班發車時刻</div>`;
                
                res.data.forEach(item => {
                    // 🌟 判斷資料來源給予不同顏色的標籤
                    let badgeColor = item.source === "即時連線" ? "var(--success)" : "var(--warning)";
                    let badgeBg = item.source === "即時連線" ? "rgba(76, 175, 80, 0.1)" : "rgba(255, 152, 0, 0.1)";

                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="display:flex; flex-direction:column;">
                                <span style="color: #eee; font-size:14px;">往 ${item.destination}</span>
                                <span style="font-size: 10px; margin-top:4px; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor}; width: fit-content;">${item.source}</span>
                            </div>
                            <span style="color: var(--warning); font-size: 20px; font-weight: bold;">${item.time}</span>
                        </div>
                    `;
                });
                box.innerHTML = html;
            } else {
                box.innerHTML = `<div style='color: var(--text-sub); text-align: center; padding: 20px;'>❌ 目前查無 [${station}] 的時刻資料。</div>`;
            }
        } else {
            throw new Error("找不到演算法引擎 (routing.js 未載入)");
        }
    } catch(e) {
        box.innerHTML = `<div style='color: var(--danger); text-align: center; padding: 20px;'>❌ 檢索發生錯誤：${e.message}</div>`;
    }
