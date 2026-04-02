let isCountingDown = false; let timeLeft = 0; let globalStationData = null; let offlineTimetableData = null;
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; 
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

window.addEventListener('load', async () => {
    try { 
        const res = await fetch('/data/stations.json'); 
        if(res.ok) { globalStationData = await res.json(); initCustomAutocomplete(); } 
    } catch(e){}
    try { const timeRes = await fetch('/data/offline-timetable.json'); if(timeRes.ok) offlineTimetableData = await timeRes.json(); } catch(e){}
});

function initCustomAutocomplete() {
    ['start', 'end', 'transfer'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        const clearBtn = document.getElementById(point + '-clear-btn');
        if(!inputField) return;

        // 監聽輸入：顯示/隱藏清除按鈕
        inputField.addEventListener('input', () => {
            if(clearBtn) clearBtn.style.display = inputField.value ? 'flex' : 'none';
            renderCustomDropdown(point);
        });

        // 清除按鈕點擊事件
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
    
    // 🌟 核心邏輯：將選項拆分為「最愛」與「其他」
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
        
        // 星星點擊
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

        // 選項點擊
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            inputField.value = station.name;
            listContainer.style.display = 'none';
            const clearBtn = document.getElementById(point + '-clear-btn');
            if(clearBtn) clearBtn.style.display = 'flex';
        });
        return item;
    };

    // 🌟 渲染：最愛優先置頂
    favItems.forEach(s => listContainer.appendChild(createItem(s, true)));
    if(favItems.length > 0 && otherItems.length > 0) {
        const divider = document.createElement('div');
        divider.style.height = "1px"; divider.style.background = "#444"; divider.style.margin = "4px 10px";
        listContainer.appendChild(divider);
    }
    otherItems.forEach(s => listContainer.appendChild(createItem(s, false)));

    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

// updateStationOptions, handleAction, resetPlan 邏輯保持之前穩定版不變...
window.updateStationOptions = function(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById('start-bus-stop-block');
    const transBlock = document.getElementById('transfer-block');
    if (point === 'start') {
        if(busBlock) busBlock.style.display = (type === 'bus') ? 'flex' : 'none';
        if(transBlock) transBlock.style.display = (type === 'tra' || type === 'thsr') ? 'flex' : 'none';
    }
    input.value = defaultStations[type] || '';
    const clearBtn = document.getElementById(point + '-clear-btn');
    if(clearBtn) clearBtn.style.display = input.value ? 'flex' : 'none';
};

window.handleAction = async function() {
    const startType = document.getElementById('start-type').value;
    let startName = document.getElementById('start-station-input').value.trim();
    const endName = document.getElementById('end-station-input').value.trim();
    if(startType === 'bus') { let stop = document.getElementById('start-bus-stop-input').value.trim(); if(stop) startName += `|${stop}`; }
    const btn = document.getElementById('action-btn'); btn.innerHTML = "⏳ 計算中..."; btn.disabled = true;
    try {
        let transferName = (startType === 'tra' || startType === 'thsr') ? document.getElementById('transfer-station-input').value : startName;
        let res = await fetchTwoStageSurvivalTime(startType, startName, startName, transferName, endName, offlineTimetableData);
        if (res.time) {
            document.getElementById('speed-mode').innerText = res.time;
            document.getElementById('cancel-btn').style.display = 'flex';
            btn.style.display = 'none';
            document.querySelector('.time-area .status').innerText = "剩餘時間";
            isCountingDown = true;
            const now = new Date(); let target = new Date();
            const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
            if (now > target) target.setDate(target.getDate() + 1);
            timeLeft = Math.floor((target - now) / 1000);
            if (timeLeft > 43200) timeLeft = 0; // 超過12小時判定為錯過
        } else alert(res.status);
    } catch (e) { alert("計算失敗"); }
    finally { btn.disabled = false; btn.innerHTML = "開始計算轉乘"; }
};

window.resetPlan = function() {
    isCountingDown = false;
    document.querySelector('.time-area .status').innerText = "現在時間";
    document.getElementById('action-btn').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'none';
    document.getElementById('plan-b-container').style.display = 'none';
    document.getElementById('speed-mode').innerText = '待查驗...';
    if(document.getElementById('time-display')) document.getElementById('time-display').style.fontSize = '55px';
};

setInterval(() => {
    const display = document.getElementById('time-display');
    if (!display) return;
    if (!isCountingDown) { display.innerHTML = new Date().toTimeString().split(' ')[0]; } 
    else {
        if (timeLeft <= 0) { display.style.fontSize = '35px'; display.innerHTML = "來不及了 💸"; document.getElementById('plan-b-container').style.display = 'flex'; return; }
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}, 1000);
