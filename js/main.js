let isCountingDown = false; let timeLeft = 0; let globalStationData = null; let offlineTimetableData = null;
const defaultStations = { 'trtc': '台北車站', 'tra': '台北車站', 'thsr': '台北車站', 'bus': '' };

window.addEventListener('load', async () => {
    try { const res = await fetch('/data/stations.json'); if(res.ok) { globalStationData = await res.json(); initCustomAutocomplete(); } } catch(e){}
    try { const timeRes = await fetch('/data/offline-timetable.json'); if(timeRes.ok) offlineTimetableData = await timeRes.json(); } catch(e){}
});

function initCustomAutocomplete() {
    ['start', 'end', 'transfer'].forEach(point => {
        const inputField = document.getElementById(point + '-station-input');
        if(!inputField) return;
        inputField.addEventListener('focus', (e) => { e.stopPropagation(); renderCustomDropdown(point); });
        inputField.addEventListener('click', (e) => { e.stopPropagation(); renderCustomDropdown(point); });
        inputField.addEventListener('input', () => renderCustomDropdown(point));
    });
}

function renderCustomDropdown(point) {
    const typeSelect = document.getElementById(point + '-type') || { value: 'trtc' };
    const inputField = document.getElementById(point + '-station-input');
    const listContainer = document.getElementById(point + '-autocomplete-list');
    if(!inputField || !listContainer || typeSelect.value === 'bus') return;
    const options = globalStationData?.[typeSelect.value]?.options || [];
    listContainer.innerHTML = '';
    const filterText = inputField.value.trim().toLowerCase();
    options.forEach(station => {
        if (station.name.toLowerCase().includes(filterText) || filterText === '') {
            const item = document.createElement('div'); item.className = 'dropdown-item';
            item.innerHTML = `<span>${station.name}</span>`;
            item.addEventListener('click', (e) => { e.stopPropagation(); inputField.value = station.name; listContainer.style.display = 'none'; });
            listContainer.appendChild(item);
        }
    });
    listContainer.style.display = listContainer.children.length > 0 ? 'block' : 'none';
}

window.updateStationOptions = function(point) {
    const type = document.getElementById(point + '-type').value;
    const input = document.getElementById(point + '-station-input');
    const busBlock = document.getElementById('start-bus-stop-block');
    const transBlock = document.getElementById('transfer-block');
    if (point === 'start') {
        busBlock.style.display = (type === 'bus') ? 'flex' : 'none';
        transBlock.style.display = (type === 'tra' || type === 'thsr') ? 'flex' : 'none';
    }
    input.value = defaultStations[type] || '';
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
};

setInterval(() => {
    const display = document.getElementById('time-display');
    if (!display) return;
    if (!isCountingDown) { display.innerHTML = new Date().toTimeString().split(' ')[0]; } 
    else {
        if (timeLeft <= 0) { display.innerHTML = "來不及了 💸"; document.getElementById('plan-b-container').style.display = 'flex'; return; }
        timeLeft--;
        let h = Math.floor(timeLeft / 3600), m = Math.floor((timeLeft % 3600) / 60), s = timeLeft % 60;
        display.innerHTML = h > 0 ? `${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}` : `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
    }
}, 1000);
