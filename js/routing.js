// ==========================================
// 🚀 核心路由引擎 (routing.js) - v3.1 終極字首查表版
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

// 🌟 修改點 1：參數加上 transferData，並安插字首查表邏輯
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

    // 抽出英文字首判斷是否跨線
    const startPrefixes = startNodes.map(n => n.code.match(/^([A-Z]+)/)[1]);
    const endPrefixes = endNodes.map(n => n.code.match(/^([A-Z]+)/)[1]);
    const isCrossLine = !startPrefixes.some(p => endPrefixes.includes(p));

    // ==========================================
    // 🚀 v1.4 遺產：跨線轉乘優先查閱保命手冊 (增強相容版)
    // ==========================================
    if (isCrossLine && type === 'trtc') {
        if (!transferData) {
            console.warn("🚨 警告：系統判定需要跨線轉乘，但沒有收到 transfer-timetable 轉乘手冊！");
        } else {
            // 🌟 智慧相容：不管你的 JSON 是扁平的，還是包在 trtc 裡面，都抓得到！
            const routes = transferData[startNorm] || (transferData[type] && transferData[type][startNorm]);
            
            if (!routes) {
                console.warn(`🚨 警告：轉乘手冊內找不到起點站【${startNorm}】的資料！`);
            } else {
                // 1. 點名道姓的特例站點直接命中 (新北投、小碧潭)
                if (routes[endNorm]) {
                    console.log(`🎯 命中專屬站點轉乘死線：${startNorm} -> ${endNorm} = ${routes[endNorm]}`);
                    return routes[endNorm];
                }
                
                // 2. 去找終點站的路線字首（例如找 "BR", "O", "BL"）
                for (let p of endPrefixes) {
                    if (routes[p]) {
                        console.log(`🎯 命中字首轉乘死線：${startNorm} -> 路線 ${p} = ${routes[p]}`);
                        return routes[p]; 
                    }
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

// 🌟 修改點 2：引擎主函數增加 transferData 參數，並同步修改所有呼叫點
window.fetchTwoStageSurvivalTime = async function(startType, endType, startId, startName, transferName, endName, offlineData, transferData) {
    const today = getOperatingDateString(); 
    let currentMins = timeToMinutes(`${window.getSystemTime().getHours()}:${window.getSystemTime().getMinutes()}`);

    // ==========================================
    // 🚨 終極挑戰：捷運 ➡️ 公車 (10分鐘狂奔法)
    // ==========================================
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
        
        // 🌟 修改點 3-1：補上 transferData 參數
        let mrtLastTime = calculateOfflineTime(offlineData, transferData, startName, mrtTransferName, 'trtc');
        
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
    
    // 🌟 修改點 3-2：補上 transferData 參數
    let trtcLastTime = calculateOfflineTime(offlineData, transferData, trtcTransferName, endName, 'trtc');
    
    if (startType === 'trtc') {
        if (trtcLastTime) return { time: trtcLastTime, status: "北捷離線時刻表" };
        return { time: null, status: "查無捷運站資料" };
    }

    if (!trtcLastTime) {
        // 🌟 修改點 3-3：補上 transferData 參數
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
        // 🌟 修改點 3-4：補上 transferData 參數
        let offlineStartLastTime = calculateOfflineTime(offlineData, transferData, startName, transferName, startType);
        return { time: offlineStartLastTime || trtcLastTime, status: "網路無回應，啟用離線保險" }; 
    }
};
