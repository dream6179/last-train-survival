// ==========================================
// 🚀 核心路由引擎 (routing.js) - 最終防彈版
// ==========================================
window.getSystemTime = function() {
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

// 🌟 雙段轉乘演算法 - 邏輯全面修復
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
    // 先找轉乘站(北捷)的末班保險底線
    let trtcLastTime = calculateOfflineTime(offlineData, transferName, endName, 'trtc');
    
    // 如果是純捷運轉捷運
    if (startType === 'trtc') {
        if (trtcLastTime) return { time: trtcLastTime, status: "北捷離線時刻表" };
        return { time: null, status: "查無捷運站點資料" };
    }

    // 🌟 核心修正：台鐵/高鐵轉捷運
    // 抓取台鐵或高鐵起點站的最晚發車時間
    let startLastTime = calculateOfflineTime(offlineData, startName, transferName, startType);
    
    if (startLastTime) {
        return { time: startLastTime, status: `${startType === 'tra' ? '台鐵' : '高鐵'}離線時刻表` };
    }

    // 如果連起點站資料都抓不到，才退而求其次給捷運時間防呆
    return { time: trtcLastTime || null, status: trtcLastTime ? "僅提供捷運轉乘保險建議" : "計算失敗，請檢查站名" };
};

// 單站檢索 (為了全查詢模式)
window.fetchSingleStationTime = async function(stationName, type, offlineData) {
    let results = [];
    let lastTime = calculateOfflineTime(offlineData, stationName, "", type);
    if (lastTime) results.push({ destination: "末班往終點", time: lastTime });
    return { status: "success", data: results };
};
