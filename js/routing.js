// ==========================================
// 🚀 核心路由引擎 (routing.js) - v3.0 防彈縫合版
// ==========================================

window.getSystemTime = function() {
    if (localStorage.getItem('dev_mode_active') === 'true') {
        const devTime = new Date(); devTime.setHours(23, 30, 0); return devTime;
    }
    return new Date(); 
};

// 🌟 獲取今天日期的 TDX 格式 (YYYY-MM-DD)
function getOperatingDateString() {
    const now = window.getSystemTime();
    // 凌晨 00:00~03:59 視為「前一個營業日」
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options; // 縮短至 8 秒，超時果斷切離線
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id); return response;
    } catch (err) {
        clearTimeout(id); throw err;
    }
}

function normalize(name) { return name ? name.replace(/臺/g, '台').replace(/站$/g, '').trim() : ""; }

function timeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    let [h, m] = timeStr.split(':').map(Number);
    if (h < 4) h += 24; // 凌晨 0~3 點算作 24~27 點，方便比對先後
    return h * 60 + m;
}

function minutesToTime(mins) {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    if (h >= 24) h -= 24;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 🌟 我們剛剛寫好的：精準制導離線演算法 (防呆上下行與跨線)
function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type]) return null;
    let startNorm = normalize(start);
    let endNorm = normalize(end);
    let stations = offlineData[type];

    let startNodes = [];
    let endNodes = [];
    for (let code in stations) {
        if (normalize(stations[code].name) === startNorm) startNodes.push({ code, data: stations[code] });
        if (normalize(stations[code].name) === endNorm) endNodes.push({ code, data: stations[code] });
    }
    if (startNodes.length === 0) return null;

    let selectedTimeStr = null;
    if (endNodes.length > 0) {
        for (let sNode of startNodes) {
            for (let eNode of endNodes) {
                let sMatch = sNode.code.match(/^([A-Z]+)(\d+)/);
                let eMatch = eNode.code.match(/^([A-Z]+)(\d+)/);
                if (sMatch && eMatch && sMatch[1] === eMatch[1]) {
                    if (typeof sNode.data.up === 'object' && sNode.data.up[eNode.code]) {
                        selectedTimeStr = sNode.data.up[eNode.code];
                    } else if (typeof sNode.data.down === 'object' && sNode.data.down[eNode.code]) {
                        selectedTimeStr = sNode.data.down[eNode.code];
                    } else {
                        let direction = parseInt(sMatch[2]) < parseInt(eMatch[2]) ? 'up' : 'down';
                        let timeData = sNode.data[direction];
                        if (typeof timeData === 'string') {
                            selectedTimeStr = timeData;
                        } else if (typeof timeData === 'object') {
                            let maxMins = -1;
                            for (let k in timeData) {
                                let mins = timeToMinutes(timeData[k]);
                                if (mins > maxMins) { maxMins = mins; selectedTimeStr = timeData[k]; }
                            }
                        }
                    }
                    if (selectedTimeStr) break;
                }
            }
            if (selectedTimeStr) break;
        }
    }
    if (selectedTimeStr) return selectedTimeStr;

    // 跨線或無明確終點的保底防禦
    let minMins = Infinity;
    let safeTimeStr = null;
    const checkSafeTime = (timeData) => {
        if (!timeData) return;
        if (typeof timeData === 'string') {
            let mins = timeToMinutes(timeData);
            if (mins < minMins) { minMins = mins; safeTimeStr = timeData; }
        } else if (typeof timeData === 'object') {
            for(let k in timeData) {
                let mins = timeToMinutes(timeData[k]);
                if (mins < minMins) { minMins = mins; safeTimeStr = timeData[k]; }
            }
        }
    };
    for (let sNode of startNodes) {
        checkSafeTime(sNode.data.up);
        checkSafeTime(sNode.data.down);
    }
    return safeTimeStr;
}

// 🌟 核心：雙段生存時間計算 (整合了前後端代理與兩種緩衝邏輯)
window.fetchTwoStageSurvivalTime = async function(startType, endType, startId, startName, transferName, endName, offlineData) {
    const today = getOperatingDateString(); 
    let currentMins = timeToMinutes(`${window.getSystemTime().getHours()}:${window.getSystemTime().getMinutes()}`);

    // ==========================================
    // 🚨 終極挑戰：捷運 ➡️ 公車 (10分鐘狂奔法)
    // ==========================================
    if (endType === 'bus' && startType === 'trtc') {
        let routeName = endName.split('|')[0];
        let stopName = endName.split('|')[1] || "";
        let maxBusMins = -1;

        // 1. 透過 Vercel 代理去 TDX 撈公車 ETA
        const paths = [`/v2/Bus/EstimatedTimeOfArrival/City/Taipei/${encodeURIComponent(routeName)}`, `/v2/Bus/EstimatedTimeOfArrival/City/NewTaipei/${encodeURIComponent(routeName)}`];
        for (let p of paths) {
            try {
                const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(p)}&$format=JSON`);
                if (res.ok) {
                    let d = await res.json();
                    if (stopName) d = d.filter(b => b.StopName.Zh_tw.includes(stopName));
                    d.forEach(b => { if (b.EstimateTime > 0) maxBusMins = Math.max(maxBusMins, Math.floor(b.EstimateTime / 60)); });
                    if (maxBusMins > -1) break;
                }
            } catch(e) {} // 網路超時就略過
        }

        if (maxBusMins === -1) return { time: null, status: "公車已無動態或收班" };

        // 2. 倒推 10 分鐘狂奔緩衝
        let availableMrtMins = maxBusMins - 10;
        if (availableMrtMins <= 0) return { time: null, status: "公車快到了，轉乘已來不及" };

        let targetTimeMins = currentMins + availableMrtMins;
        let targetTimeStr = minutesToTime(targetTimeMins);

        // 3. 雙重保險：檢查捷運本身的末班車，兩者取「最嚴格(最早)」的死線
        let mrtTransferName = stopName.replace(/捷運/g, '').replace(/站/g, ''); // 從站牌粗略擷取轉乘站
        let mrtLastTime = calculateOfflineTime(offlineData, startName, mrtTransferName, 'trtc');
        
        if (!mrtLastTime) return { time: targetTimeStr, status: `公車動態回推 (需於 ${targetTimeStr} 前上捷運)` };

        if (timeToMinutes(targetTimeStr) < timeToMinutes(mrtLastTime)) {
            return { time: targetTimeStr, status: `公車較早收班，請提早於 ${targetTimeStr} 上車` };
        } else {
            return { time: mrtLastTime, status: `北捷末班 (${mrtLastTime}) 較公車更早收班` };
        }
    }

    // ==========================================
    // 🚨 經典回歸：台鐵/高鐵 ➡️ 捷運 (30分鐘緩衝法)
    // ==========================================
    let trtcTransferName = (transferName === '萬華') ? '龍山寺' : transferName;
    let trtcLastTime = calculateOfflineTime(offlineData, trtcTransferName, endName, 'trtc');
    
    if (startType === 'trtc') {
        if (trtcLastTime) return { time: trtcLastTime, status: "北捷離線時刻表" };
        return { time: null, status: "查無捷運站資料" };
    }

    // 如果沒有北捷轉乘資料，只能退回查第一段
    if (!trtcLastTime) {
        let fallback = calculateOfflineTime(offlineData, startName, transferName, startType);
        return { time: fallback, status: fallback ? "僅提供第一段時刻" : "計算失敗" };
    }

    // 將捷運末班車扣除 30 分鐘，作為高鐵/台鐵抵達的死線
    let targetArrivalMins = timeToMinutes(trtcLastTime) - 30;
    
    // 如果起點就是轉乘站，直接回傳死線
    if (startId === transferName) return { time: minutesToTime(targetArrivalMins), status: "同站跨系統需 -30分緩衝" };

    let path = "";
    if (startType === 'tra') {
        path = `/v3/Rail/TRA/DailyTrainTimetable/OD/${encodeURIComponent(startName)}/to/${encodeURIComponent(transferName)}/${today}`;
    } else if (startType === 'thsr') {
        path = `/v2/Rail/THSR/DailyTimetable/OD/${encodeURIComponent(startName)}/to/${encodeURIComponent(transferName)}/${today}`;
    }

    try {
        const url = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error("代理異常");

        const data = await response.json(); 
        let validTrains = [];
        
        // 篩選能在死線前抵達的班次
        if (startType === 'tra' && data.TrainTimetables) {
            data.TrainTimetables.forEach(t => { 
                if (timeToMinutes(t.DestinationStopTime.ArrivalTime) <= targetArrivalMins) validTrains.push(t.OriginStopTime.DepartureTime); 
            });
        } else if (startType === 'thsr') {
            data.forEach(t => { 
                if (timeToMinutes(t.DestinationStopTime.ArrivalTime) <= targetArrivalMins) validTrains.push(t.OriginStopTime.DepartureTime); 
            });
        }

        if (validTrains.length === 0) return { time: null, status: "錯過台鐵/高鐵轉乘極限" };
        
        validTrains.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        return { time: validTrains[validTrains.length - 1], status: "雙段精準計算 (-30分緩衝)" };
        
    } catch (err) { 
        // 網路斷線時，啟動離線防空洞
        let offlineStartLastTime = calculateOfflineTime(offlineData, startName, transferName, startType);
        return { time: offlineStartLastTime || trtcLastTime, status: "網路無回應，啟用離線保險" }; 
    }
};
