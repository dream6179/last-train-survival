// ==========================================
// 🚀 核心業務、時鐘與車站選單 (main.js) - 終極穩定版
// ==========================================
let isCountingDown = false; 
let timeLeft = 0;           
let globalStationData = null;
let offlineTimetableData = null;

// 讀取最愛與紀錄
let favoriteStations = JSON.parse(localStorage.getItem('lastTrainFavs')) || []; 
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

// 隱藏 iOS 下拉箭頭
const style = document.createElement('style');
style.innerHTML = `select { -webkit-appearance: none; appearance: none; }`;
document.head.appendChild(style);

window.addEventListener('load', async () => {
    try { 
        const res = await fetch('/data/stations.json'); 
        if(res.ok) { 
            globalStationData = await res.json(); 
            // 初始化所有輸入框的選單功能
            initCustomAutocomplete();
            // 恢復上次紀錄
            document.getElementById('start-station-input').value = localStorage.getItem('lastTrainStart') || '台北車站'; 
            document.getElementById('end-station-input').value = localStorage.getItem('lastTrainEnd') || '台北車站'; 
            if(window.checkTransferLock) window.checkTransferLock();
        } 
    } catch(e){ console.error("車站載入失敗", e); }
    
    try { 
        const timeRes = await fetch('/data/offline-timetable.json'); 
        if(timeRes.ok) offlineTimetableData = await timeRes.json(); 
    } catch(e){}
});

// ==========================================
// 🌟 核心選單渲染引擎
// ==========================================
function renderCustomDropdown(point) {
    const typeSelect = document.getElementById(point + '-type') || { value: 'trtc' };
    if (typeSelect.value === 'bus') return; 

    const inputField = document.getElementById(point + '-station-input');
    const listContainer = document.getElementById(point + '-autocomplete-list');
    if(!inputField || !listContainer) return;

    const selectedType = typeSelect.value;
    let options = globalStationData?.[selectedType]?.options || [];
    
    listContainer.innerHTML = ''; 
    const filterText = inputField.value.trim().replace(/臺/g, '台').toLowerCase();
    let favList = []; let otherList = [];
    
    options.forEach(station => {
        const normName = station.name.replace(/臺/g, '台').toLowerCase();
        if (normName.includes(filterText) || filterText === '') {
            if (favoriteStations.includes(station.name)) favList.push(station); else otherList.push(station);
        }
    });

    const createItem = (station, isFav) => {
        const item = document.createElement('div'); item.className = 'dropdown-item';
        item.innerHTML = `<span>${station.name}</span><span class="star-icon" style="color:${isFav?'#ffca28':'#666'}">${isFav?'★':'☆'}</span>`;
        
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
        
        item.addEventListener('click', (e) => { 
            e.stopPropagation();
            inputField.value = station.name; 
            listContainer.style.display = 'none'; 
            if (point === 'start') localStorage.setItem('lastTrainStart', station.name);
            if (point === 'end') localStorage.setItem('lastTrainEnd', station.name);
            if (window.checkTransferLock) window.checkTransferLock();
        });
        return item;
    };
    
    favList.forEach(s => listContainer.appendChild(createItem(s, true)));
    if (favList.length > 0 && otherList.length > 0) listContainer.appendChild(document.createElement('div')).className = 'dropdown-divider';
    otherList.forEach(s => listContainer.appendChild(createItem(s, false)));
    
    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

function initCustomAutocomplete() {
    // 🌟 包含轉乘站 (transfer) 一起初始化
    ['start', 'end', 'search', 'transfer'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        const listContainer = document.getElementById(point + '-autocomplete-list');
        if(!inputField) return;

        // 監聽輸入框
        inputField.addEventListener('input', () => renderCustomDropdown(point));
        
        // 🌟 修正點：點擊與獲得焦點時強制顯示，並阻止冒泡
        const showMenu = (e) => {
            e.stopPropagation(); // 阻止事件傳給 document，避免被關閉
            const typeSelect = document.getElementById(point + '-type') || { value: 'trtc' };
            if(typeSelect.value !== 'bus') {
                renderCustomDropdown(point);
            }
        };

        inputField.addEventListener('focus', showMenu);
        inputField.addEventListener('click', showMenu);

        // 全域點擊關閉選單 (保全)
        document.addEventListener('click', (e) => {
            if (listContainer && !inputField.contains(e.target) && !listContainer.contains(e.target)) {
                listContainer.style.display = 'none';
            }
        });
    });
}

// ==========================================
// 業務邏輯與時鐘
// ==========================================
window.checkTransferLock = function() {
    const startType = document.getElementById('start-type').value;
    const transferBlock = document.getElementById('transfer-block');
    if (transferBlock) {
        transferBlock.style.display = (startType === 'tra' || startType === 'thsr') ? 'flex' : 'none';
    }
};

window.updateStationOptions = async function(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById(point + '-bus-stop-block');
    if (type === 'bus') {
        input.value = ''; input.placeholder = "輸入路線 (如: 265)";
        if(busBlock) busBlock.style.display = 'flex';
    } else {
        if(busBlock) busBlock.style.display = 'none';
        input.value = defaultStations[type] || '';
        renderCustomDropdown(point);
    }
    if (point === 'start') window.checkTransferLock();
};

window.handleAction = async function() {
    const startType = document.getElementById('start-type').value;
    let startName = document.getElementById('start-station-input').value.trim();
    const endName = document.getElementById('end-station-input').value.trim();
    if(startType === 'bus') {
        let stop = document.getElementById('start-bus-stop-input').value.trim();
        if(stop) startName += `|${stop}`;
    }
    
    const btn = document.getElementById('action-btn'); btn.innerHTML = "⏳ 計算中..."; btn.disabled = true;
    try {
        let transferName = startName;
        if (startType === 'tra' || startType === 'thsr') {
            transferName = document.getElementById('transfer-station-input').value;
        }

        if (typeof fetchTwoStageSurvivalTime !== 'function') throw new Error("引擎未載入");
        let res = await fetchTwoStageSurvivalTime(startType, startName, startName, transferName, endName, offlineTimetableData);
        
        if (res.time) {
            document.getElementById('speed-mode').innerText = res.time;
            document.getElementById('cancel-btn').style.display='flex';
            btn.style.display='none';
            isCountingDown = true;
            const now = new Date(); let target = new Date();
            const [hh, mm] = res.time.split(':').map(Number); target.setHours(hh, mm, 0, 0);
            if (now > target) target.setDate(target.getDate() + 1);
            timeLeft = Math.floor((target - now) / 1000);
            if (timeLeft > 28800) timeLeft = 0; 
        } else alert(res.status);
    } catch (e) { alert("計算失敗: " + e.message); }
    finally { btn.disabled = false; btn.innerHTML = "開始計算轉乘"; }
};

window.resetPlan = function() { 
    isCountingDown = false; 
    // 隱藏取消按鈕
    document.getElementById('cancel-btn').style.display = 'none'; 
    // 顯示開始按鈕
    document.getElementById('action-btn').style.display = 'block'; 
    // 🌟 隱藏 Uber 備案
    document.getElementById('plan-b-container').style.display = 'none'; 
    document.getElementById('speed-mode').innerText = '待查驗...'; 
    const disp = document.getElementById('time-display');
    if(disp) disp.style.fontSize = '50px';
};

function updateClock() {
    const display = document.getElementById('time-display');
    if (!display) return;
    const now = new Date();
    if (!isCountingDown) { 
        display.style.fontSize = '50px';
        display.innerHTML = now.toTimeString().split(' ')[0]; 
    } else {
        if (timeLeft <= 0) { display.style.fontSize = '32px'; display.innerHTML = "來不及了 💸"; document.getElementById('plan-b-container').style.display = 'flex'; return; }
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h<10?'0':''}${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}
setInterval(updateClock, 1000);
