// ==========================================
// 🚀 核心路由引擎 (routing.js)
// ==========================================
window.getSystemTime = function() {
    if (localStorage.getItem('dev_mode_active') === 'true') {
        const devTime = new Date(); devTime.setHours(23, 30, 0); return devTime;
    }
    return new Date(); 
};

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options; const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id); return response;
}

function normalize(name) { return name ? name.replace(/臺/g, '台').replace(/站$/g, '').trim() : ""; }
function timeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    let [h, m] = timeStr.split(':').map(Number);
    if (h < 4) h += 24; 
    return h * 60 + m;
}

function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type]) return null;
    let startNorm = normalize(start);
    let targetNode = null;
    for (let code in offlineData[type]) {
        if (normalize(offlineData[type][code].name) === startNorm) { targetNode = offlineData[type][code]; break; }
    }
    if (!targetNode) return null;

    let maxMins = -1; let latestTimeStr = null;
    const checkTime = (timeData) => {
        if (!timeData) return;
        if (typeof timeData === 'string') {
            let mins = timeToMinutes(timeData);
            if (mins > maxMins) { maxMins = mins; latestTimeStr = timeData; }
        } else if (typeof timeData === 'object') {
            for (let k in timeData) checkTime(timeData[k]);
        }
    };
    checkTime(targetNode.up); checkTime(targetNode.down);
    return latestTimeStr;
}

window.fetchTwoStageSurvivalTime = async function(startType, startId, startName, transferName, endName, offlineData) {
    if (startType === 'bus') {
        let routeName = startId.split('|')[0]; let stopName = startId.split('|')[1] || "";
        const paths = [`/v2/Bus/EstimatedTimeOfArrival/City/Taipei/${encodeURIComponent(routeName)}`, `/v2/Bus/EstimatedTimeOfArrival/City/NewTaipei/${encodeURIComponent(routeName)}` ];
        let maxMins = -1;
        for (let p of paths) {
            try {
                const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(p)}&$format=JSON`);
                if (res.ok) {
                    let d = await res.json();
                    if (stopName) d = d.filter(b => b.StopName.Zh_tw.includes(stopName));
                    d.forEach(b => { if (b.EstimateTime > 0) maxMins = Math.max(maxMins, Math.floor(b.EstimateTime / 60)); });
                    if (maxMins > -1) break;
                }
            } catch(e) {}
        }
        if (maxMins === -1) return { time: null, status: "查無公車動態或已打烊" };
        const now = window.getSystemTime(); now.setMinutes(now.getMinutes() + maxMins);
        return { time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`, status: "公車動態" };
    }

    // 🌟 復活：萬華 -> 龍山寺 核心層翻譯
    let trtcTransferName = (transferName === '萬華') ? '龍山寺' : transferName;
    
    // 用翻譯後的站名去查北捷
    let trtcLastTime = calculateOfflineTime(offlineData, trtcTransferName, endName, 'trtc');
    
    if (startType === 'trtc') {
        if (trtcLastTime) return { time: trtcLastTime, status: "北捷時刻表" };
        return { time: null, status: "查無捷運站資料" };
    }

    // 用原本的站名去查台鐵/高鐵
    let startLastTime = calculateOfflineTime(offlineData, startName, transferName, startType);
    if (startLastTime) {
        return { time: startLastTime, status: `${startType === 'tra' ? '台鐵' : '高鐵'}時刻表` };
    }

    return { time: trtcLastTime || null, status: trtcLastTime ? "僅提供捷運轉乘保險建議" : "計算失敗" };
};

window.fetchSingleStationTime = async function(stationName, type, offlineData) {
    let results = [];
    if (type === 'trtc') {
        let lastTime = calculateOfflineTime(offlineData, stationName, "", type);
        if (lastTime) results.push({ destination: "末班往終點", time: lastTime });
        return { status: "success", data: results };
    }
    if (type === 'tra' || type === 'thsr') {
        let railType = type === 'tra' ? 'TRA' : 'THSR';
        let path = `/v3/Rail/${railType}/DailyStationTimetable/Today/StationName/${encodeURIComponent(stationName)}`;
        try {
            const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`);
            if (res.ok) {
                let data = await res.json();
                if (data && data.StationTimetables && data.StationTimetables.length > 0) {
                    let timetables = data.StationTimetables[0].TimeTables || [];
                    if (timetables.length > 0) {
                        timetables.sort((a, b) => (a.DepartureTime > b.DepartureTime ? 1 : -1));
                        let lastTrain = timetables[timetables.length - 1];
                        let dest = lastTrain.DestinationStationName ? lastTrain.DestinationStationName.Zh_tw : "終點";
                        results.push({ destination: `末班往 ${dest}`, time: lastTrain.DepartureTime.substring(0, 5) });
                    }
                }
            }
        } catch (e) { console.log("TDX失敗", e); }

        if (results.length === 0) {
            let fallbackTime = calculateOfflineTime(offlineData, stationName, "", type);
            if (fallbackTime) results.push({ destination: "末班往終點 (離線保險)", time: fallbackTime });
        }
        return { status: "success", data: results };
    }
    return { status: "success", data: [] };
};
