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
    
    // 🌟 修正：把 globalStationData 的防呆也加進來，避免網路慢時點擊輸入框報錯
    if(!inputField || !listContainer || typeSelect.value === 'bus' || !globalStationData) return;

    const options = globalStationData[typeSelect.value]?.options || [];
    listContainer.innerHTML = '';

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
    const startName = document.getElementById('start-station-input').value.trim();
    const endName = document.getElementById('end-station-input').value.trim();
    
    const btn = document.getElementById('action-btn'); 
    btn.innerHTML = "⏳ 計算中..."; 
    btn.disabled = true;

    let finalTime = "23:59";
    let isOffline = false;

    try {
        let transferName = (startType === 'tra' || startType === 'thsr') ? 
                           document.getElementById('transfer-station-input').value : startName;

        let res = await fetchTwoStageSurvivalTime(startType, startName, startName, transferName, endName, offlineTimetableData);
        
        if (res && res.time) {
            finalTime = res.time;
        } else {
            throw new Error("API 無回傳時間");
        }

    } catch (e) {
        // 🌟 修正：更精準的報錯與紀錄
        const isTimeout = e.name === 'AbortController' || e.name === 'AbortError';
        console.warn(isTimeout ? "連線超時，啟動離線模式" : `API 異常 (${e.message})，啟動離線模式`);
        
        finalTime = calculateOfflineTime(offlineTimetableData, startName, endName, startType);
        isOffline = true;
    }

    // 更新介面
    if (finalTime) {
        document.getElementById('speed-mode').innerHTML = 
            `${finalTime} ${isOffline ? '<span style="color:var(--warning); font-size:10px;">(離線模式)</span>' : ''}`;
        
        // ... (計時器邏輯不變) ...
        document.getElementById('cancel-btn').style.display = 'flex';
        btn.style.display = 'none';
        document.querySelector('.time-area .status').innerText = "剩餘時間";
        isCountingDown = true;
        
        const now = new Date(); let target = new Date();
        const [hh, mm] = finalTime.split(':').map(Number); target.setHours(hh, mm, 0, 0);
        if (now > target) target.setDate(target.getDate() + 1);
        timeLeft = Math.floor((target - now) / 1000);
        if (timeLeft > 43200) timeLeft = 0;
    }

    btn.disabled = false;
    btn.innerHTML = "開始計算轉乘";
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
/**
 * 🌟 離線時間搜尋引擎
 * 作用：當 API 沒反應時，直接從 JSON 裡面抓時間
 */
function calculateOfflineTime(data, startName, endName, type) {
    if (!data || !data[type]) return "23:59";

    // 1. 先從 globalStationData 找出這兩個站的 ID (例如 R10)
    const options = globalStationData[type]?.options || [];
    const startStation = options.find(s => s.name === startName);
    const endStation = options.find(s => s.name === endName);

    if (!startStation || !endStation) return "23:59";

    const startId = startStation.id;
    const endId = endStation.id;

    // 2. 判斷方向 (up 還是 down)
    // 根據你的 JSON，編號小的往編號大的通常是 up (如 G01 -> G19)
    // 這裡我們用簡單的字串比對判斷索引位置
    const stationKeys = Object.keys(data[type]);
    // 在 calculateOfflineTime 函式內修改
const startIndex = stationKeys.indexOf(startId);
const endIndex = stationKeys.indexOf(endId);

// 🌟 修正：如果找不到站點 ID 或起訖站相同，回傳預設值
if (startIndex === -1 || endIndex === -1 || startIndex === endIndex) return "23:59";

const direction = (startIndex < endIndex) ? 'up' : 'down';

    // 3. 從 JSON 抓時間
    const timeInfo = data[type][startId];
    if (!timeInfo) return "23:59";

    let finalTime = timeInfo[direction];

    // 4. 處理特殊分支 (如北投 R22 的物件格式)
    if (typeof finalTime === 'object') {
        // 這裡簡單抓第一個，或是你可以根據 endId 判斷要走哪條分支
        finalTime = Object.values(finalTime)[0];
    }

    return finalTime || "23:59";
}
