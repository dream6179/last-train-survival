// ==========================================
// 🟢 輸入槽專屬大腦 (survival-ui.js) - 鄉民防禦版
// ==========================================

let globalStationData = null;
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; 
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

window.addEventListener('load', async () => {
    try { 
        const res = await fetch('/data/stations.json'); 
        if(res.ok) { globalStationData = await res.json(); initCustomAutocomplete(); } 
    } catch(e){}
});

function initCustomAutocomplete() {
    ['start', 'end'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        const clearBtn = document.getElementById(point + '-clear-btn');
        if(!inputField) return;

        inputField.addEventListener('input', () => {
            if(clearBtn) clearBtn.style.display = inputField.value ? 'flex' : 'none';
            renderCustomDropdown(point);
        });

        if(clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                inputField.value = '';
                clearBtn.style.display = 'none';
                renderCustomDropdown(point);
                inputField.focus();
            });
        }

        inputField.addEventListener('focus', (e) => { e.stopPropagation(); renderCustomDropdown(point); });
        inputField.addEventListener('click', (e) => { e.stopPropagation(); renderCustomDropdown(point); });
        
        // 🌟 離開焦點時的黃金防禦：自動校正鄉民用語
        inputField.addEventListener('blur', () => {
            let val = inputField.value.trim().replace(/臺/g, '台');
            if (val === '北車') inputField.value = '台北車站'; // 瞬間洗白
            
            if (point === 'start') setTimeout(() => window.updateStationOptions('start'), 150);
        });
        
        document.addEventListener('click', (e) => {
            const list = document.getElementById(point + '-autocomplete-list');
            if (list && !inputField.contains(e.target)) list.style.display = 'none';
        });
    });

    ['start', 'end'].forEach(point => {
        const busInput = document.getElementById(point + '-bus-stop-input');
        const busClearBtn = document.getElementById(point + '-bus-clear-btn');
        if(busInput && busClearBtn) {
            busInput.addEventListener('input', () => { busClearBtn.style.display = busInput.value ? 'flex' : 'none'; });
            busClearBtn.addEventListener('click', (e) => { e.stopPropagation(); busInput.value = ''; busClearBtn.style.display = 'none'; busInput.focus(); });
        }
    });
}

function renderCustomDropdown(point) {
    const typeSelect = document.getElementById(point + '-type') || { value: 'trtc' };
    const inputField = document.getElementById(point + '-station-input');
    const listContainer = document.getElementById(point + '-autocomplete-list');
    if(!inputField || !listContainer || typeSelect.value === 'bus') return;

    const options = globalStationData?.[typeSelect.value]?.options || [];
    listContainer.innerHTML = '';
    
    // 🌟 搜尋時的黃金防禦：打「北車」直接幫他找「台北車站」
    let rawFilterText = inputField.value.trim().replace(/臺/g, '台');
    if (rawFilterText === '北車') rawFilterText = '台北車站';
    const filterText = rawFilterText.toLowerCase();
    
    let favItems = [];
    let otherItems = [];

    options.forEach(station => {
        const normName = station.name.replace(/臺/g, '台').toLowerCase();
        if (normName.includes(filterText) || filterText === '') {
            if (favoriteStations.includes(station.name)) favItems.push(station);
            else otherItems.push(station);
        }
    });

    const createItem = (station, isFav) => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        
        // 🌟 復活：如月車站專屬紅字渲染
        if (station.name === '如月車站') {
            item.innerHTML = `<span style="color:#ff5252; font-weight:bold; letter-spacing:2px;">${station.name}</span>`;
        } else {
            item.innerHTML = `<span>${station.name}</span><span class="star-btn" style="color:${isFav?'#ffca28':'#666'}">${isFav?'★':'☆'}</span>`;
            item.querySelector('.star-btn').addEventListener('mousedown', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (favoriteStations.includes(station.name)) favoriteStations = favoriteStations.filter(fav => fav !== station.name);
                else favoriteStations.push(station.name);
                localStorage.setItem('lastTrainFavs', JSON.stringify(favoriteStations));
                renderCustomDropdown(point);
            });
        }

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            inputField.value = station.name;
            listContainer.style.display = 'none';
            const clearBtn = document.getElementById(point + '-clear-btn');
            if(clearBtn) clearBtn.style.display = 'flex';
            if(point === 'start') window.updateStationOptions('start'); 
        });
        return item;
    };

    favItems.forEach(s => listContainer.appendChild(createItem(s, true)));
    if(favItems.length > 0 && otherItems.length > 0) {
        const divider = document.createElement('div'); divider.style.height = "1px"; divider.style.background = "#444"; divider.style.margin = "4px 10px"; listContainer.appendChild(divider);
    }
    otherItems.forEach(s => listContainer.appendChild(createItem(s, false)));

    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

window.updateStationOptions = function(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById(point + '-bus-stop-block');
    
    if(busBlock) {
        if (type === 'bus') { busBlock.style.display = 'flex'; input.placeholder = '選擇路線'; } 
        else { busBlock.style.display = 'none'; input.placeholder = '選擇車站'; }
    }

    if (point === 'start') {
        const transBlock = document.getElementById('transfer-block');
        const transSelect = document.getElementById('transfer-station-input');
        if(transBlock) {
            transBlock.style.display = (type === 'tra' || type === 'thsr') ? 'flex' : 'none';
            
            if (type === 'tra' || type === 'thsr') {
                const tStations = globalStationData?.[type]?.transferStations || [];
                if (tStations.length > 0) {
                    // 🌟 萬華 -> 龍山寺 UI 提示
                    transSelect.innerHTML = tStations.map(s => `<option value="${s.name}">${s.name === '萬華' ? '萬華 (轉乘龍山寺)' : s.name}</option>`).join('');
                    
                    // 🌟 轉乘站智慧鎖定邏輯
                    const startInputVal = input.value.trim();
                    const isOriginTransferStation = tStations.some(s => s.name === startInputVal);
                    if (isOriginTransferStation) {
                        transSelect.value = startInputVal;
                        transSelect.disabled = true;
                        transSelect.style.opacity = '0.5';
                    } else {
                        transSelect.disabled = false;
                        transSelect.style.opacity = '1';
                    }
                }
            }
        }
    }
};
