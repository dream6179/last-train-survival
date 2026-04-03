// ==========================================
// 🚀 核心路由引擎 (routing.js) - v3.1 終極完整版 (含全查詢)
// ==========================================

window.getSystemTime = function() {
    if (localStorage.getItem('dev_mode_active') === 'true') {
        const devTime = new Date(); devTime.setHours(23, 30, 0); return devTime;
    }
    return new Date(); 
};

function getOperatingDateString() {
    const now = window.getSystemTime();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options; 
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
    if (h < 4) h += 24; 
    return h * 60 + m;
}

function minutesToTime(mins) {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    if (h >= 24) h -= 24;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 🌟 核心：離線時間算繪
function calculateOfflineTime(offlineData, transferData, start, end, type) {
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

    const startPrefixes = startNodes.map(n => n.code.match(/^([A-Z]+)/)[1]);
    const endPrefixes = endNodes.map(n => n.code.match(/^([A-Z]+)/)[1]);
    const isCrossLine = !startPrefixes.some(p => endPrefixes.includes(p));

    if (isCrossLine && type === 'trtc') {
        if (transferData) {
            const routes = transferData[startNorm] || (transferData[type] && transferData[type][startNorm]);
            if (routes) {
                if (routes[endNorm]) return routes[endNorm];
                for (let p of endPrefixes) {
                    if (routes[p]) return routes[p]; 
                }
            }
        }
    }

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

// 🌟 核心：雙段生存時間計算 (首頁使用)
window.fetchTwoStageSurvivalTime = async function(startType, endType, startId, startName, transferName, endName, offlineData, transferData) {
    const today = getOperatingDateString(); 
    let currentMins = timeToMinutes(`${window.getSystemTime().getHours()}:${window.getSystemTime().getMinutes()}`);

    if (endType === 'bus' && startType === 'trtc') {
        let routeName = endName.split('|')[0];
        let stopName = endName.split('|')[1] || "";
        let maxBusMins = -1;

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
            } catch(e) {} 
        }

        if (maxBusMins === -1) return { time: null, status: "公車已無動態或收班" };

        let availableMrtMins = maxBusMins - 10;
        if (availableMrtMins <= 0) return { time: null, status: "公車快到了，轉乘已來不及" };

        let targetTimeMins = currentMins + availableMrtMins;
        let targetTimeStr = minutesToTime(targetTimeMins);

        let mrtTransferName = stopName.replace(/捷運/g, '').replace(/站/g, ''); 
        let mrtLastTime = calculateOfflineTime(offlineData, transferData, startName, mrtTransferName, 'trtc');
        
        if (!mrtLastTime) return { time: targetTimeStr, status: `公車動態回推 (需於 ${targetTimeStr} 前上捷運)` };

        if (timeToMinutes(targetTimeStr) < timeToMinutes(mrtLastTime)) {
            return { time: targetTimeStr, status: `公車較早收班，請提早於 ${targetTimeStr} 上車` };
        } else {
            return { time: mrtLastTime, status: `北捷末班 (${mrtLastTime}) 較公車更早收班` };
        }
    }

    let trtcTransferName = (transferName === '萬華') ? '龍山寺' : transferName;
    let trtcLastTime = calculateOfflineTime(offlineData, transferData, trtcTransferName, endName, 'trtc');
    
    if (startType === 'trtc') {
        if (trtcLastTime) return { time: trtcLastTime, status: "北捷離線時刻表" };
        return { time: null, status: "查無捷運站資料" };
    }

    if (!trtcLastTime) {
        let fallback = calculateOfflineTime(offlineData, transferData, startName, transferName, startType);
        return { time: fallback, status: fallback ? "僅提供第一段時刻" : "計算失敗" };
    }

    let targetArrivalMins = timeToMinutes(trtcLastTime) - 30;
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
        let offlineStartLastTime = calculateOfflineTime(offlineData, transferData, startName, transferName, startType);
        return { time: offlineStartLastTime || trtcLastTime, status: "網路無回應，啟用離線保險" }; 
    }
};

// ==========================================
// 🔍 單站全時刻表檢索演算法 (供 search.html 專用)
// ==========================================
window.fetchSingleStationTime = async function(stationName, type, offlineData) {
    let results = [];
    
    if (offlineData && offlineData[type]) {
        const table = offlineData[type];
        const normSearchName = normalize(stationName);
        
        for (let code in table) {
            if (normalize(table[code].name) === normSearchName) {
                if (table[code].up) {
                    if (typeof table[code].up === 'string' && table[code].up !== "00:00") {
                        results.push({ destination: "上行 / 北上", time: table[code].up });
                    } else if (typeof table[code].up === 'object') {
                        for (let dest in table[code].up) {
                            if (table[code].up[dest] !== "00:00") results.push({ destination: `專屬月台 (${dest})`, time: table[code].up[dest] });
                        }
                    }
                }
                if (table[code].down) {
                    if (typeof table[code].down === 'string' && table[code].down !== "00:00") {
                        results.push({ destination: "下行 / 南下", time: table[code].down });
                    } else if (typeof table[code].down === 'object') {
                        for (let dest in table[code].down) {
                            if (table[code].down[dest] !== "00:00") results.push({ destination: `專屬月台 (${dest})`, time: table[code].down[dest] });
                        }
                    }
                }
            }
        }
    }
    
    let uniqueResults = [];
    let seen = new Set();
    results.forEach(r => {
        let k = r.destination + r.time;
        if(!seen.has(k)) { seen.add(k); uniqueResults.push(r); }
    });
    
    uniqueResults.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    return { status: uniqueResults.length > 0 ? "success" : "not_found", data: uniqueResults };
};
