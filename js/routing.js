// ==========================================
// 🚀 核心路由引擎 (routing.js) - 最終防彈版 + TDX 全網檢索
// ==========================================
window.getSystemTime = function() {
    // 🌟 檢查開發者模式
    if (localStorage.getItem('dev_mode_active') === 'true') {
        const devTime = new Date();
        devTime.setHours(23, 30, 0); // 鎖定在 23:30
        return devTime;
    }
    return new Date(); 
};

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
}

// 站名標準化：統一 台/臺，去掉「站」字，確保比對成功
function normalize(name) {
    if (!name) return "";
    return name.replace(/臺/g, '台').replace(/站$/g, '').trim();
}

function timeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    let [h, m] = timeStr.split(':').map(Number);
    if (h < 4) h += 24; // 凌晨算作隔天
    return h * 60 + m;
}

// 離線時間搜尋：加入模糊比對
function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type]) return null;
    let startNorm = normalize(start);
    let targetNode = null;

    for (let code in offlineData[type]) {
        if (normalize(offlineData[type][code].name) === startNorm) {
            targetNode = offlineData[type][code];
            break;
        }
    }
    if (!targetNode) return null;

    // 抓取該站的最晚發車時間
    let maxMins = -1;
    let latestTimeStr = null;

    const checkTime = (timeData) => {
        if (!timeData) return;
        if (typeof timeData === 'string') {
            let mins = timeToMinutes(timeData);
            if (mins > maxMins) { maxMins = mins; latestTimeStr = timeData; }
        } else if (typeof timeData === 'object') {
            for (let k in timeData) checkTime(timeData[k]);
        }
    };

    checkTime(targetNode.up);
    checkTime(targetNode.down);
    return latestTimeStr;
}

// 🌟 雙段轉乘演算法
window.fetchTwoStageSurvivalTime = async function(startType, startId, startName, transferName, endName, offlineData) {
    // 1. 公車模式 (計算動態到達時間)
    if (startType === 'bus') {
        let routeName = startId.split('|')[0];
        let stopName = startId.split('|')[1] || "";
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
        return { time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`, status: "公車即時動態" };
    }

    // 2. 捷運/台鐵/高鐵模式
    let trtcLastTime = calculateOfflineTime(offlineData, transferName, endName, 'trtc');
    
    if (startType === 'trtc') {
        if (trtcLastTime) return { time: trtcLastTime, status: "北捷離線時刻表" };
        return { time: null, status: "查無捷運站點資料" };
    }

    let startLastTime = calculateOfflineTime(offlineData, startName, transferName, startType);
    if (startLastTime) {
        return { time: startLastTime, status: `${startType === 'tra' ? '台鐵' : '高鐵'}離線時刻表` };
    }

    return { time: trtcLastTime || null, status: trtcLastTime ? "僅提供捷運轉乘保險建議" : "計算失敗，請檢查站名" };
};

// 🌟 單站檢索 (全查詢系統專用：接回 TDX API)
window.fetchSingleStationTime = async function(stationName, type, offlineData) {
    let results = [];

    // 1. 北捷：直接查離線資料最快
    if (type === 'trtc') {
        let lastTime = calculateOfflineTime(offlineData, stationName, "", type);
        if (lastTime) results.push({ destination: "末班往終點", time: lastTime });
        return { status: "success", data: results };
    }

    // 2. 台鐵 / 高鐵：接回 TDX 即時連線
    if (type === 'tra' || type === 'thsr') {
        let railType = type === 'tra' ? 'TRA' : 'THSR';
        
        // 嘗試透過 TDX v3 API 用站名抓取今日時刻表
        let path = `/v3/Rail/${railType}/DailyStationTimetable/Today/StationName/${encodeURIComponent(stationName)}`;
        try {
            const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`);
            if (res.ok) {
                let data = await res.json();
                // 解析 TDX 回傳的時刻表
                if (data && data.StationTimetables && data.StationTimetables.length > 0) {
                    let timetables = data.StationTimetables[0].TimeTables || [];
                    if (timetables.length > 0) {
                        // 依照時間排序，並抓取當天最後發車的班次
                        timetables.sort((a, b) => (a.DepartureTime > b.DepartureTime ? 1 : -1));
                        let lastTrain = timetables[timetables.length - 1];
                        let dest = lastTrain.DestinationStationName ? lastTrain.DestinationStationName.Zh_tw : "終點";
                        
                        results.push({
                            destination: `末班往 ${dest}`,
                            // 取前5個字元，把 "23:59:00" 變成 "23:59"
                            time: lastTrain.DepartureTime.substring(0, 5) 
                        });
                    }
                }
            }
        } catch (e) {
            console.log("TDX 連線失敗，嘗試使用離線資料保底", e);
        }

        // 如果 API 剛好掛了，或者查無資料，退回離線檔案尋找保險時間
        if (results.length === 0) {
            let fallbackTime = calculateOfflineTime(offlineData, stationName, "", type);
            if (fallbackTime) {
                results.push({ destination: "末班往終點 (離線保險)", time: fallbackTime });
            }
        }
        return { status: "success", data: results };
    }

    return { status: "success", data: [] };
};
