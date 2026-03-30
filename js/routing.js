// ==========================================
// 末班車生存戰 核心路由與 API 引擎 (v2.6 智慧方向翻譯機版)
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

/**
 * 解析高級 offline-timetable.json 結構
 * 自動將 up/down 轉換為對應路線的真實終點站名
 */
function parseOfflineData(stationCode, stationNode, lineData) {
    let results = [];
    
    // 從代碼提取路線字首 (如 R11 -> R, BL12 -> BL)
    let prefixMatch = stationCode.match(/^[A-Z]+/);
    let prefix = prefixMatch ? prefixMatch[0] : "";

    let upDest = "上行方向";
    let downDest = "下行方向";

    // 根據路線代碼判斷真正的端點站
    // 規則：大號碼方向(up)、小號碼方向(down)
    switch(prefix) {
        case 'R': upDest = "淡水 / 北投"; downDest = "象山 / 大安"; break;
        case 'G': upDest = "松山"; downDest = "新店 / 小碧潭"; break;
        case 'BL': upDest = "南港展覽館 / 昆陽"; downDest = "頂埔 / 亞東"; break;
        case 'O': upDest = "迴龍 / 蘆洲"; downDest = "南勢角"; break;
        case 'BR': upDest = "南港展覽館"; downDest = "動物園"; break;
        case 'Y': upDest = "新北產業園區"; downDest = "大坪林"; break;
    }

    // 處理 up (往大號碼方向)
    if (typeof stationNode.up === 'string') {
        // 如果當前車站就是終點站，就不顯示往自己方向的末班車
        if (!upDest.includes(stationNode.name)) {
            results.push({ destination: upDest, time: stationNode.up, source: "離線備援" });
        }
    } else if (typeof stationNode.up === 'object') {
        // 處理有分支路線的狀況 (如新北投、小碧潭)
        for (let destCode in stationNode.up) {
            let destName = lineData[destCode] ? lineData[destCode].name : destCode;
            if(destName !== stationNode.name) {
                 results.push({ destination: destName, time: stationNode.up[destCode], source: "離線備援" });
            }
        }
    }

    // 處理 down (往小號碼方向)
    if (typeof stationNode.down === 'string') {
        if (!downDest.includes(stationNode.name)) {
            results.push({ destination: downDest, time: stationNode.down, source: "離線備援" });
        }
    } else if (typeof stationNode.down === 'object') {
        for (let destCode in stationNode.down) {
            let destName = lineData[destCode] ? lineData[destCode].name : destCode;
            if(destName !== stationNode.name) {
                results.push({ destination: destName, time: stationNode.down[destCode], source: "離線備援" });
            }
        }
    }

    return results;
}

/**
 * 🌟 模式 1：全查詢模式
 */
async function fetchSingleStationTime(stationName, type, offlineData, token) {
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

            data.forEach(route => {
                route.Timetables.forEach(t => {
                    results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" });
                });
            });
            
        } else if (type === 'tra') {
            let resTra = await fetch(`https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyStationTimetable/Today/Station/${stationId}?$format=JSON`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resTra.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
            if (resTra.ok) {
                let data = await resTra.json();
                if (data.StationTimetables) {
                    data.StationTimetables.forEach(dir => dir.TimeTables.forEach(t => results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" })));
                }
            }
        } else if (type === 'thsr') {
            let resThsr = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/Station/${stationId}/${today}?$format=JSON`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resThsr.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
            if (resThsr.ok) {
                let data = await resThsr.json();
                data.forEach(t => results.push({ destination: t.Direction === 0 ? "左營(南下)" : "南港(北上)", time: t.DepartureTime, source: "即時連線" }));
            }
        }

        results = results.filter(r => timeToMinutes(r.time) >= currentMins)
                         .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

        if (results.length === 0) throw new Error("TDX 查無接下來的班次，強制轉入離線備援");
        return { status: "success", data: results.slice(0, 10) };

    } catch (err) {
        console.warn("API 異常或無資料，已進入離線防空洞:", err.message);
        
        if (offlineData && offlineData[type]) {
            let targetNode = null;
            let targetCode = null;
            for (let code in offlineData[type]) {
                if (offlineData[type][code].name === stationName) {
                    targetNode = offlineData[type][code];
                    targetCode = code;
                    break;
                }
            }

            if (targetNode) {
                let offlineResults = parseOfflineData(targetCode, targetNode, offlineData[type]);
                
                offlineResults = offlineResults.filter(r => timeToMinutes(r.time) >= currentMins)
                                               .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                
                if(offlineResults.length === 0) {
                     return { status: "success", data: [{ destination: "本日已無班次", time: "--:--", source: "系統判定" }] };
                }
                return { status: "success", data: offlineResults.slice(0, 10) };
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

        const data = await response.json();
        let timetables = [];

        if (type === 'tra' && data.TrainTimetables) timetables = data.TrainTimetables.map(t => t.OriginStopTime.DepartureTime);
        else if (type === 'thsr') timetables = data.map(t => t.OriginStopTime.DepartureTime);

        if (timetables.length === 0) return null;

        timetables.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        return timetables[timetables.length - 1]; 

    } catch (err) {
        console.warn("TDX O-D 查詢失敗，降級使用離線演算法", err);
        return null;
    }
}

function getOfficialTransferTime(transferData, offlineData, start, end, type) {
    if (!transferData) return null;
    const key = `${start}-${end}`;
    return (transferData[type] && transferData[type][key]) ? transferData[type][key] : null;
}

function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type]) return null;
    
    let targetNode = null;
    let targetCode = null;
    for (let code in offlineData[type]) {
        if (offlineData[type][code].name === start) {
            targetNode = offlineData[type][code];
            targetCode = code;
            break;
        }
    }

    if (!targetNode) return null;
    
    const parsedResults = parseOfflineData(targetCode, targetNode, offlineData[type]);
    let maxMins = -1; 
    let latestTimeStr = null;

    parsedResults.forEach(item => {
        let mins = timeToMinutes(item.time);
        if (mins > maxMins) { maxMins = mins; latestTimeStr = item.time; }
    });

    return latestTimeStr;
}
