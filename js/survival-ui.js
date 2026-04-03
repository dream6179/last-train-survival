// ==========================================
// 🟢 輸入槽專屬大腦 (survival-ui.js) - 公車專精版
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
    // 1. 處理主站點 (北捷/台鐵/高鐵/客運主路線)
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
        
        document.addEventListener('click', (e) => {
            const list = document.getElementById(point + '-autocomplete-list');
            if (list && !inputField.contains(e.target)) list.style.display = 'none';
        });
    });

    // 🌟 2. 處理公車站牌的專屬 × 清除按鈕
    ['start', 'end'].forEach(point => {
        const busInput = document.getElementById(point + '-bus-stop-input');
        const busClearBtn = document.getElementById(point + '-bus-clear-btn');
        if(busInput && busClearBtn) {
            busInput.addEventListener('input', () => {
                busClearBtn.style.display = busInput.value ? 'flex' : 'none';
            });
            busClearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                busInput.value = '';
                busClearBtn.style.display = 'none';
                busInput.focus();
            });
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
    const filterText = inputField.value.trim().replace(/臺/g, '台').toLowerCase();
    
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
        item.innerHTML = `<span>${station.name}</span><span class="star-btn" style="color:${isFav?'#ffca28':'#666'}">${isFav?'★':'☆'}</span>`;
        
        item.querySelector('.star-btn').addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (favoriteStations.includes(station.name)) {
                favoriteStations = favoriteStations.filter(fav => fav !== station.name);
            } else {
                favoriteStations.push(station.name);
            }
            localStorage.setItem('lastTrainFavs', JSON.stringify(favoriteStations));
            renderCustomDropdown(point);
        });

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            inputField.value = station.name;
            listContainer.style.display = 'none';
            const clearBtn = document.getElementById(point + '-clear-btn');
            if(clearBtn) clearBtn.style.display = 'flex';
        });
        return item;
    };

    favItems.forEach(s => listContainer.appendChild(createItem(s, true)));
    if(favItems.length > 0 && otherItems.length > 0) {
        const divider = document.createElement('div');
        divider.style.height = "1px"; divider.style.background = "#444"; divider.style.margin = "4px 10px";
        listContainer.appendChild(divider);
    }
    otherItems.forEach(s => listContainer.appendChild(createItem(s, false)));

    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

window.updateStationOptions = function(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById(point + '-bus-stop-block');
    
    // 切換 Placeholder 與顯示站牌區塊
    if(busBlock) {
        if (type === 'bus') {
            busBlock.style.display = 'flex';
            input.placeholder = '選擇路線';
        } else {
            busBlock.style.display = 'none';
            input.placeholder = '選擇車站';
        }
    }

    // 🌟 出發地的轉乘站邏輯 (動態讀取 JSON)
    if (point === 'start') {
        const transBlock = document.getElementById('transfer-block');
        const transSelect = document.getElementById('transfer-station-input');
        if(transBlock) {
            transBlock.style.display = (type === 'tra' || type === 'thsr') ? 'flex' : 'none';
            
            if (type === 'tra' || type === 'thsr') {
                // 從 globalStationData 抓取 transferStations 陣列
                const tStations = globalStationData?.[type]?.transferStations || [];
                
                if (tStations.length > 0) {
                    // 動態生成 option
                    transSelect.innerHTML = tStations.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
                } else {
                    // 如果 JSON 剛好沒載入到的防呆保底
                    transSelect.innerHTML = '<option value="台北車站">台北車站</option><option value="板橋">板橋</option><option value="南港">南港</option>';
                }
            }
        }
    }
    
    input.value = defaultStations[type] || '';
    const clearBtn = document.getElementById(point + '-clear-btn');
    if(clearBtn) clearBtn.style.display = input.value ? 'flex' : 'none';
};
