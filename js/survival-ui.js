// ==========================================
// 🟢 輸入槽專屬大腦 (survival-ui.js) - 全量對稱版
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
        
        document.addEventListener('click', (e) => {
            const list = document.getElementById(point + '-autocomplete-list');
            if (list && !inputField.contains(e.target)) list.style.display = 'none';
        });
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
    
    // 🌟 核心修正：根據傳入的 point (start/end) 尋找對應的站牌區塊
    const busBlock = document.getElementById(point + '-bus-stop-block');
    const transBlock = document.getElementById('transfer-block');
    const transSelect = document.getElementById('transfer-station-input');

    // 顯示/隱藏公車站牌區塊
    if(busBlock) busBlock.style.display = (type === 'bus') ? 'flex' : 'none';

    // 只有出發地需要處理轉乘站鎖定
    if (point === 'start') {
        if(transBlock) {
            transBlock.style.display = (type === 'tra' || type === 'thsr') ? 'flex' : 'none';
            if (type === 'tra') {
                transSelect.innerHTML = '<option value="台北車站">台北車站</option><option value="板橋">板橋</option><option value="龍山寺">龍山寺</option><option value="松山">松山</option><option value="南港">南港</option>';
            } else if (type === 'thsr') {
                transSelect.innerHTML = '<option value="台北車站">台北車站</option><option value="板橋">板橋</option><option value="松山">松山</option><option value="南港">南港</option>';
            }
        }
    }
    
    input.value = defaultStations[type] || '';
    const clearBtn = document.getElementById(point + '-clear-btn');
    if(clearBtn) clearBtn.style.display = input.value ? 'flex' : 'none';
};
