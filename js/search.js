// ==========================================
// 🔍 獨立查詢系統 (search.js)
// ==========================================
let globalStationData = null;

window.addEventListener('load', async () => {
    try { 
        const res = await fetch('/data/stations.json'); 
        if(res.ok) { 
            globalStationData = await res.json(); 
            initSearchAutocomplete();
        } 
    } catch(e){ console.error("車站載入失敗", e); }
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
        });
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
            item.innerHTML = `<span>${station.name}</span>`;
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

// 🌟 你的檢索核心邏輯寫在這裡
window.executeFullSearch = async function() {
    const type = document.getElementById('search-type').value;
    const station = document.getElementById('search-station-input').value.trim();
    const box = document.getElementById('search-result-box');
    
    if(!station) { box.innerHTML = "⚠️ 請輸入車站名稱"; return; }
    box.innerHTML = "⏳ 檢索中...";

    try {
        // 這裡可以呼叫你原本寫好的檢索 API (例如 fetchSingleStationTime)
        // 目前先放一個佔位提示
        box.innerHTML = `
            <div style="color: white; font-weight: bold; margin-bottom: 10px;">✅ 成功連結 [${station}]</div>
            <div>系統已獨立！你可以在 search.js 中將 API 查詢結果渲染到這個區塊。</div>
        `;
    } catch(e) {
        box.innerHTML = "❌ 檢索發生錯誤：" + e.message;
    }
};
