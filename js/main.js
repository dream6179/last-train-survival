/**
 * 🌟 超時防護搬運工 (fetchWithTimeout)
 * 作用：發送請求，如果超時就直接中斷，避免頁面卡死。
 */
async function fetchWithTimeout(resource, options = {}) {
    // 預設超時時間設為 3500 毫秒 (3.5秒)
    const { timeout = 3500 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id); // 如果準時回來，就清除計時器
        return response;
    } catch (error) {
        clearTimeout(id); // 發生錯誤（包含超時）也要清除
        throw error;      // 丟出錯誤讓後面的 try-catch 接住
    }
}

let isCountingDown = false; let timeLeft = 0; let globalStationData = null; let offlineTimetableData = null;
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; 
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

window.addEventListener('load', async () => {
    // 🌟 升級版：給 stations.json 3.5秒限時
    try { 
        const res = await fetchWithTimeout('/data/stations.json', { timeout: 3500 }); 
        if(res.ok) { globalStationData = await res.json(); initCustomAutocomplete(); } 
    } catch(e) { console.error("車站資料載入超時或失敗"); }

    // 🌟 升級版：給離線資料庫 3.5秒限時
    try { 
        const timeRes = await fetchWithTimeout('/data/offline-timetable.json', { timeout: 3500 }); 
        if(timeRes.ok) offlineTimetableData = await timeRes.json(); 
    } catch(e) { console.error("離線資料庫載入超時"); }
});

function initCustomAutocomplete() {
    // 🌟 移除 transfer，只留起迄站
    ['start', 'end'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        const clearBtn = document.getElementById(point + '-clear-btn');

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

window.updateStationOptions = function(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById('start-bus-stop-block');
    const transBlock = document.getElementById('transfer-block');
    const transSelect = document.getElementById('transfer-station-input');

    if (point === 'start') {
        if(busBlock) busBlock.style.display = (type === 'bus') ? 'flex' : 'none';
        if(transBlock) {
            transBlock.style.display = (type === 'tra' || type === 'thsr') ? 'flex' : 'none';
            
            // 🌟 依照交通工具鎖定轉乘站選項
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

window.handleAction = async function() {
    const startType = document.getElementById('start-type').value;
    let startName = document.getElementById('start-station-input').value.trim();
    const endName = document.getElementById('end-station-input').value.trim();
    if(startType === 'bus') { let stop = document.getElementById('start-bus-stop-input').value.trim(); if(stop) startName += `|${stop}`; }
    
    const btn = document.getElementById('action-btn'); 
    btn.innerHTML = "⏳ 計算中..."; 
    btn.disabled = true;

    try {
        let transferName = (startType === 'tra' || startType === 'thsr') ? document.getElementById('transfer-station-input').value : startName;
        
        // 🌟 關鍵改動：這裡我們可以給 API 呼叫一個時限 (例如 5 秒)
        // 注意：這裡假設 fetchTwoStageSurvivalTime 內部會用到 fetch
        // 如果該函式是你寫在 routing.js 的，建議去裡面把 fetch 改成 fetchWithTimeout
        
        let res = await fetchTwoStageSurvivalTime(startType, startName, startName, transferName, endName, offlineTimetableData);
        
        if (res && res.time) {
            // ... 原本的 UI 更新邏輯 ...
            document.getElementById('speed-mode').innerText = res.time;
            document.getElementById('cancel-btn').style.display = 'flex';
            btn.style.display = 'none';
            document.querySelector('.time-area .status').innerText = "剩餘時間";
            isCountingDown = true;
            
            const now = new Date(); let target = new Date();
            const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
            if (now > target) target.setDate(target.getDate() + 1);
            timeLeft = Math.floor((target - now) / 1000);
            if (timeLeft > 43200) timeLeft = 0; 
        } else {
            alert(res.status || "找不到合適的班次");
        }
    } catch (e) { 
        // 🌟 如果超時，就會跑到這裡
        if (e.name === 'AbortError') {
            alert("⚠️ 網路連線過慢，建議切換至全查詢模式或稍後再試。");
        } else {
            alert("計算失敗，請檢查站名輸入是否正確。");
        }
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = "開始計算轉乘"; 
    }
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
