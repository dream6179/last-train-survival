// ==========================================
// 🚀 核心業務、時鐘與車站選單 (main.js)
// ==========================================
let isCountingDown = false; 
let timeLeft = 0;           
let globalStationData = null;
let offlineTimetableData = null;

// 🌟 補回：讀取鄉民的最愛與上次輸入
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; 
let savedStart = localStorage.getItem('lastTrainStart') || '台北車站'; 
let savedEnd = localStorage.getItem('lastTrainEnd') || '台北車站';
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

// 🌟 忍者修復：偷偷把 iOS 的下拉箭頭藏起來，不用改 HTML
const style = document.createElement('style');
style.innerHTML = `select { -webkit-appearance: none; appearance: none; }`;
document.head.appendChild(style);

window.addEventListener('load', async () => {
    try { 
        const res = await fetch('/data/stations.json'); 
        if(res.ok) { 
            globalStationData = await res.json(); 
            // 🌟 補回：啟動選單工人
            initCustomAutocomplete();
            document.getElementById('start-station-input').value = savedStart; 
            document.getElementById('end-station-input').value = savedEnd; 
            checkTransferLock();
        } 
    } catch(e){ console.log("車站資料載入失敗"); }
    
    try { 
        const timeRes = await fetch('/data/offline-timetable.json'); 
        if(timeRes.ok) offlineTimetableData = await timeRes.json(); 
    } catch(e){}
});

// ==========================================
// 🌟 補回：車站下拉選單與防呆系統
// ==========================================
function checkTransferLock() {
    const startType = document.getElementById('start-type').value;
    const transferBlock = document.getElementById('transfer-block');
    if (startType === 'tra' || startType === 'thsr') {
        if(transferBlock) transferBlock.style.display = 'flex'; 
    } else {
        if(transferBlock) transferBlock.style.display = 'none';
    }
}

function renderCustomDropdown(point) {
    const typeSelect = document.getElementById(point + '-type');
    if (typeSelect && typeSelect.value === 'bus') return; 

    const inputField = document.getElementById(point + '-station-input');
    const listContainer = document.getElementById(point + '-autocomplete-list');
    if(!listContainer) return;

    const selectedType = typeSelect.value;
    let options = globalStationData?.[selectedType]?.options || [];
    
    listContainer.innerHTML = ''; 
    const filterText = inputField.value.trim().replace(/臺/g, '台').toLowerCase();
    let favList = []; let otherList = [];
    
    options.forEach(station => {
        const normStationName = station.name.replace(/臺/g, '台').toLowerCase();
        if (normStationName.includes(filterText) || filterText === '') {
            if (favoriteStations.includes(station.name)) favList.push(station); else otherList.push(station);
        }
    });

    const createItem = (station, isFav) => {
        const item = document.createElement('div'); item.className = 'dropdown-item';
        item.innerHTML = `<span>${station.name}</span><span class="star-icon" style="color:${isFav?'#ffca28':'#666'}">${isFav?'★':'☆'}</span>`;
        
        // 點擊星星加入最愛
        item.querySelector('.star-icon').addEventListener('mousedown', (e) => { 
            e.preventDefault(); e.stopPropagation(); 
            if (favoriteStations.includes(station.name)) {
                favoriteStations = favoriteStations.filter(fav => fav !== station.name);
            } else {
                favoriteStations.push(station.name);
            }
            localStorage.setItem('lastTrainFavs', JSON.stringify(favoriteStations));
            renderCustomDropdown(point);
        });
        
        // 點擊車站選項
        item.addEventListener('click', () => { 
            inputField.value = station.name; 
            listContainer.style.display = 'none'; 
            if (point === 'start') {
                savedStart = station.name; localStorage.setItem('lastTrainStart', savedStart);
                checkTransferLock(); 
            }
            if (point === 'end') {
                savedEnd = station.name; localStorage.setItem('lastTrainEnd', savedEnd);
            }
        });
        return item;
    };
    
    favList.forEach(s => listContainer.appendChild(createItem(s, true)));
    if (favList.length > 0 && otherList.length > 0) listContainer.appendChild(document.createElement('div')).className = 'dropdown-divider';
    otherList.forEach(s => listContainer.appendChild(createItem(s, false)));
    
    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

function initCustomAutocomplete() {
    ['start', 'end', 'search'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        if(inputField) {
            inputField.addEventListener('input', () => renderCustomDropdown(point));
            inputField.addEventListener('focus', () => { 
                if(inputField.disabled) return; 
                const type = document.getElementById(point + '-type').value; 
                if(type !== 'bus') { inputField.value = ''; renderCustomDropdown(point); } 
            });
        }
        // 點擊外面時關閉選單
        document.addEventListener('click', (e) => {
            const listContainer = document.getElementById(point + '-autocomplete-list');
            const wrapper = inputField?.closest('.autocomplete-wrapper');
            if (listContainer && wrapper && !wrapper.contains(e.target)) {
                listContainer.style.display = 'none';
            }
        });
    });
}

// ==========================================
// UI 連動與轉乘計算
// ==========================================
window.updateStationOptions = async function(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById(point + '-bus-stop-block');
    const listContainer = document.getElementById(point + '-autocomplete-list');

    if (type === 'bus') { 
        input.value = ''; input.placeholder = "輸入路線 (如: 265)"; 
        if(busBlock) busBlock.style.display = 'flex'; 
        if(listContainer) listContainer.style.display = 'none';
    } else { 
        if(busBlock) busBlock.style.display = 'none'; 
        input.value = defaultStations[type] || ''; 
        renderCustomDropdown(point);
    }
    if (point === 'start') checkTransferLock();
};

window.getRealStationObj = function(inputName, type) {
    if (type === 'bus') return { id: inputName, name: inputName }; 
    if (!inputName || !globalStationData?.[type]) return null;
    let found = globalStationData[type].options.find(s => s.name.replace(/臺/g, '台') === inputName.trim().replace(/臺/g, '台'));
    return found || null;
};

window.handleAction = async function() {
    const type = document.getElementById('start-type').value;
    let start = document.getElementById('start-station-input').value.trim();
    if(type === 'bus') { let stop = document.getElementById('start-bus-stop-input').value.trim(); if(stop) start += `|${stop}`; }
    const end = document.getElementById('end-station-input').value.trim();
    
    const btn = document.getElementById('action-btn'); btn.innerHTML = "⏳ 計算中..."; btn.disabled = true;
    try {
        let res = await fetchTwoStageSurvivalTime(type, start, '', '', end, offlineTimetableData);
        if (res.time) {
            document.getElementById('speed-mode').innerText = res.time;
            document.getElementById('cancel-btn').style.display='flex';
            btn.style.display='none';
            isCountingDown = true;
            
            if (typeof getSystemTime === 'function') {
                const now = getSystemTime(); let target = getSystemTime();
                const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
                if (now > target) target.setDate(target.getDate() + 1);
                timeLeft = Math.floor((target - now) / 1000);
                if (timeLeft > 28800) timeLeft = 0; 
            }
        } else alert(res.status);
    } catch (e) { alert("計算失敗"); }
    finally { btn.disabled = false; btn.innerHTML = "開始計算轉乘"; }
};

window.resetPlan = function() { 
    isCountingDown = false; 
    document.getElementById('action-btn').style.display = 'block'; 
    document.getElementById('cancel-btn').style.display = 'none'; 
    document.getElementById('plan-b-container').style.display = 'none'; 
    document.getElementById('speed-mode').innerText = '待查驗...'; 
    
    // 🌟 補回：解除求生模式時，要把大字體恢復
    const display = document.getElementById('time-display');
    if(display) {
        display.style.fontSize = '50px';
        if (typeof getSystemTime === 'function') display.innerHTML = getSystemTime().toTimeString().split(' ')[0];
    }
};

function updateClock() {
    const display = document.getElementById('time-display');
    if (!display || typeof getSystemTime !== 'function') return;
    const now = getSystemTime();
    if (!isCountingDown) { 
        display.style.fontSize = '50px';
        display.innerHTML = now.toTimeString().split(' ')[0]; 
    } else {
        if (timeLeft <= 0) { 
            display.style.fontSize = '40px'; // 🌟 防破版：把字體稍微縮小一點
            display.innerHTML = "來不及了💸"; 
            document.getElementById('plan-b-container').style.display = 'flex'; 
            return; 
        }
        display.style.fontSize = '50px';
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h<10?'0':''}${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}
setInterval(updateClock, 1000);
