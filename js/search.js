// ==========================================
// 🔍 獨立查詢系統 (search.js)
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
        clearBtn.addEventListener('click', () => { inputField.value = ''; clearBtn.style.display = 'none'; renderSearchDropdown(); });
    }

    inputField.addEventListener('focus', renderSearchDropdown);
    inputField.addEventListener('click', renderSearchDropdown);
    
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
    const filterText = inputField.value.trim().replace(/臺/g, '台').toLowerCase();

    options.forEach(station => {
        const normName = station.name.replace(/臺/g, '台').toLowerCase();
        if (normName.includes(filterText) || filterText === '') {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            
            // 🌟 復活：查詢系統如月車站紅字渲染
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

window.updateSearchOptions = function() {
    document.getElementById('search-station-input').value = '';
    document.getElementById('search-clear-btn').style.display = 'none';
};

window.executeFullSearch = async function() {
    const type = document.getElementById('search-type').value;
    const station = document.getElementById('search-station-input').value.trim();
    const box = document.getElementById('search-result-box');
    
    // 🌟 復活：攔截如月車站查詢
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
        if (window.parent && window.parent.fetchSingleStationTime) {
            const res = await window.parent.fetchSingleStationTime(station, type, searchOfflineData);

            if (res && res.status === "success" && res.data.length > 0) {
                let html = `<div style="color: var(--success); font-weight: bold; margin-bottom: 15px; font-size: 15px; border-bottom: 1px solid #444; padding-bottom: 10px;">✅ [${station}] 發車時刻表</div>`;
                res.data.forEach(item => {
                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <span style="color: #ccc;">${item.destination}</span>
                            <span style="color: var(--warning); font-size: 18px; font-weight: bold;">${item.time}</span>
                        </div>
                    `;
                });
                box.innerHTML = html;
            } else {
                box.innerHTML = `<div style='color: var(--text-sub); text-align: center; padding: 20px;'>❌ 目前查無 [${station}] 的時刻資料。</div>`;
            }
        }
    } catch(e) {
        box.innerHTML = `<div style='color: var(--danger); text-align: center; padding: 20px;'>❌ 檢索發生錯誤：${e.message}</div>`;
    }
};
