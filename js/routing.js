// ==========================================
// 末班車生存戰 核心路由與 API 引擎 (v2.9 終極末班車雙模式版)
// ==========================================

function getOperatingDateString() {
    const now = new Date();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getNowTimeString() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

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

function parseOfflineData(stationCode, stationNode, lineData) {
    let results = [];
    let prefixMatch = stationCode.match(/^[A-Z]+/);
    let prefix = prefixMatch ? prefixMatch[0] : "";

    let upDest = "上行方向"; let downDest = "下行方向";
    switch(prefix) {
        case 'R': upDest = "淡水 / 北投"; downDest = "象山 / 大安"; break;
        case 'G': upDest = "松山"; downDest = "新店 / 小碧潭"; break;
        case 'BL': upDest = "南港展覽館 / 昆陽"; downDest = "頂埔 / 亞東"; break;
        case 'O': upDest = "迴龍 / 蘆洲"; downDest = "南勢角"; break;
        case 'BR': upDest = "南港展覽館"; downDest = "動物園"; break;
        case 'Y': upDest = "新北產業園區"; downDest = "大坪林"; break;
    }

    if (typeof stationNode.up === 'string') {
        if (!upDest.includes(stationNode.name)) results.push({ destination: upDest, time: stationNode.up, source: "離線備援" });
    } else if (typeof stationNode.up === 'object') {
        for (let destCode in stationNode.up) {
            let destName = lineData[destCode] ? lineData[destCode].name : destCode;
            if(destName !== stationNode.name) results.push({ destination: destName, time: stationNode.up[destCode], source: "離線備援" });
        }
    }

    if (typeof stationNode.down === 'string') {
        if (!downDest.includes(stationNode.name)) results.push({ destination: downDest, time: stationNode.down, source: "離線備援" });
    } else if (typeof stationNode.down === 'object') {
        for (let destCode in stationNode.down) {
            let destName = lineData[destCode] ? lineData[destCode].name : destCode;
            if(destName !== stationNode.name) results.push({ destination: destName, time: stationNode.down[destCode], source: "離線備援" });
        }
    }
    return results;
}

/**
 * 🌟 模式 1：全查詢模式 (新增 searchMode 參數：'now' 或 'last')
 */
async function fetchSingleStationTime(stationName, type, offlineData, token, searchMode = 'now') {
    if (!globalStationData || !globalStationData[type]) return { status: "not_found", data: [] };
    const stationObj = globalStationData[type].options.find(s => s.name === stationName);
    if (!stationObj) return { status: "not_found", data: [] };

    const stationId = stationObj.id;
    const today = getOperatingDateString();
    const nowTime = getNowTimeString();
    const currentMins = timeToMinutes(nowTime); 
    
    let results = [];

    try {
        if (type === 'trtc') {
            let resTrtc = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/TRTC?$filter=StationName/Zh_tw eq '${stationName}'&$format=JSON`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resTrtc.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
            let data = [];
            if (resTrtc.ok) data = await resTrtc.json();

            if (data.length === 0) {
                let resNtmc = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/NTMC?$filter=StationName/Zh_tw eq '${stationName}'&$format=JSON`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (resNtmc.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
                if (resNtmc.ok) data = await resNtmc.json();
            }

            data.forEach(route => { route.Timetables.forEach(t => { results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" }); }); });
        } else if (type === 'tra') {
            let resTra = await fetch(`https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyStationTimetable/Today/Station/${stationId}?$format=JSON`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resTra.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
            if (resTra.ok) { let data = await resTra.json(); if (data.StationTimetables) { data.StationTimetables.forEach(dir => dir.TimeTables.forEach(t => results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" }))); } }
        } else if (type === 'thsr') {
            let resThsr = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/Station/${stationId}/${today}?$format=JSON`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resThsr.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
            if (resThsr.ok) { let data = await resThsr.json(); data.forEach(t => results.push({ destination: t.Direction === 0 ? "左營(南下)" : "南港(北上)", time: t.DepartureTime, source: "即時連線" })); }
        }

        if (results.length === 0) throw new Error("TDX 查無接下來的班次，強制轉入離線備援");

        // 🌟 核心過濾器：依照模式切換
        if (searchMode === 'last') {
            // 找出每個目的地的最晚一班車
            let lastTrainsMap = {};
            results.forEach(r => {
                if (!lastTrainsMap[r.destination] || timeToMinutes(r.time) > timeToMinutes(lastTrainsMap[r.destination].time)) {
                    lastTrainsMap[r.destination] = r;
                }
            });
            results = Object.values(lastTrainsMap).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
            return { status: "success", data: results };
        } else {
            // 即時班次 (原本的邏輯)
            results = results.filter(r => timeToMinutes(r.time) >= currentMins).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
            if (results.length === 0) throw new Error("今日已無班次，轉入離線驗證");
            return { status: "success", data: results.slice(0, 10) };
        }

    } catch (err) {
        console.warn("API 異常或無資料，已進入離線防空洞:", err.message);
        
        if (offlineData && offlineData[type]) {
            let targetNode = null; let targetCode = null;
            for (let code in offlineData[type]) {
                if (offlineData[type][code].name === stationName) { targetNode = offlineData[type][code]; targetCode = code; break; }
            }

            if (targetNode) {
                let offlineResults = parseOfflineData(targetCode, targetNode, offlineData[type]);
                
                if (searchMode === 'last') {
                    // 離線字典本身就是末班車，直接全部吐出來
                    offlineResults.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                    return { status: "success", data: offlineResults };
                } else {
                    // 即時查詢，過濾掉已開走的
                    offlineResults = offlineResults.filter(r => timeToMinutes(r.time) >= currentMins).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                    if(offlineResults.length === 0) return { status: "success", data: [{ destination: "本日已無班次", time: "--:--", source: "系統判定" }] };
                    return { status: "success", data: offlineResults.slice(0, 10) };
                }
            }
        }
        return { status: "not_found", data: [] };
    }
}

/**
 * 🌟 模式 2：求生模式
 */
async function fetchRealLastTrainTime(globalData, token, startId, endId, type) {
    const today = getOperatingDateString();
    let url = "";

    if (type === 'tra') url = `https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyTrainTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    else if (type === 'thsr') url = `https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    else if (type === 'trtc') return null; 

    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401) return "TOKEN_EXPIRED";
        if (!response.ok) return null;
        const data = await response.json(); let timetables = [];
        if (type === 'tra' && data.TrainTimetables) timetables = data.TrainTimetables.map(t => t.OriginStopTime.DepartureTime);
        else if (type === 'thsr') timetables = data.map(t => t.OriginStopTime.DepartureTime);
        if (timetables.length === 0) return null;
        timetables.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        return timetables[timetables.length - 1]; 
    } catch (err) { return null; }
}

function getOfficialTransferTime(transferData, offlineData, start, end, type) {
    if (!transferData) return null;
    const key = `${start}-${end}`;
    return (transferData[type] && transferData[type][key]) ? transferData[type][key] : null;
}

function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type]) return null;
    let targetNode = null; let targetCode = null;
    for (let code in offlineData[type]) {
        if (offlineData[type][code].name === start) { targetNode = offlineData[type][code]; targetCode = code; break; }
    }
    if (!targetNode) return null;
    
    const parsedResults = parseOfflineData(targetCode, targetNode, offlineData[type]);
    let maxMins = -1; let latestTimeStr = null;
    parsedResults.forEach(item => { let mins = timeToMinutes(item.time); if (mins > maxMins) { maxMins = mins; latestTimeStr = item.time; } });
    return latestTimeStr;
}

/**
 * 🌟 模式 3：雙段求生模式 (台鐵/高鐵 -> 轉乘站 -> 北捷)
 */
async function fetchTwoStageSurvivalTime(startType, startId, transferId, transferName, endName, offlineData, token) {
    let trtcLastTime = calculateOfflineTime(offlineData, transferName, endName, 'trtc');
    if (!trtcLastTime) return { time: null, status: "查無北捷轉乘班次" };
    let targetArrivalMins = timeToMinutes(trtcLastTime) - 30;

    if (startId === transferId) return { time: minutesToTime(targetArrivalMins), status: "同站跨系統 (-30分)" };

    const today = getOperatingDateString(); let url = "";
    if (startType === 'tra') url = `https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyTrainTimetable/OD/${startId}/to/${transferId}/${today}?$format=JSON`;
    else if (startType === 'thsr') url = `https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/OD/${startId}/to/${transferId}/${today}?$format=JSON`;

    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401) return { time: "TOKEN_EXPIRED" };
        if (!response.ok) return { time: null, status: "TDX 連線失敗" };

        const data = await response.json(); let validTrains = [];
        if (startType === 'tra' && data.TrainTimetables) {
            data.TrainTimetables.forEach(t => { if (timeToMinutes(t.DestinationStopTime.ArrivalTime) <= targetArrivalMins) validTrains.push(t.OriginStopTime.DepartureTime); });
        } else if (startType === 'thsr') {
            data.forEach(t => { if (timeToMinutes(t.DestinationStopTime.ArrivalTime) <= targetArrivalMins) validTrains.push(t.OriginStopTime.DepartureTime); });
        }

        if (validTrains.length === 0) return { time: null, status: "接不上北捷末班車" };
        validTrains.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        return { time: validTrains[validTrains.length - 1], status: "雙段精準計算" };
    } catch (err) { return { time: null, status: "轉乘計算失敗" }; }
}
