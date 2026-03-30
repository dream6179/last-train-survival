// ==========================================
// 末班車生存戰 核心路由與 API 引擎 (v2.4 高級防空洞解析版)
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
 * 將 { "name": "北投", "up": { "R28": "01:00", "R22A": "00:10" }, "down": "00:16" } 
 * 轉換成我們需要的陣列格式
 */
function parseOfflineData(stationNode) {
    let results = [];
    
    // 處理 up (上行)
    if (typeof stationNode.up === 'string') {
        results.push({ destination: "上行方向", time: stationNode.up, source: "離線備援" });
    } else if (typeof stationNode.up === 'object') {
        for (let destCode in stationNode.up) {
            results.push({ destination: `往 ${destCode} 方向`, time: stationNode.up[destCode], source: "離線備援" });
        }
    }

    // 處理 down (下行)
    if (typeof stationNode.down === 'string') {
        results.push({ destination: "下行方向", time: stationNode.down, source: "離線備援" });
    } else if (typeof stationNode.down === 'object') {
        for (let destCode in stationNode.down) {
            results.push({ destination: `往 ${destCode} 方向`, time: stationNode.down[destCode], source: "離線備援" });
        }
    }

    return results;
}

/**
 * 🌟 模式 1：全查詢模式 - 查詢單一車站的所有接下來班次
 */
async function fetchSingleStationTime(stationName, type, offlineData, token) {
    if (!globalStationData || !globalStationData[type]) return { status: "not_found", data: [] };
    
    const stationObj = globalStationData[type].options.find(s => s.name === stationName);
    if (!stationObj) return { status: "not_found", data: [] };

    const stationId = stationObj.id;
    const today = getOperatingDateString();
    const nowTime = getNowTimeString();
    
    let results = [];

    try {
        if (type === 'trtc') {
            // 雙引擎啟動：先查台北捷運 (TRTC)
            let resTrtc = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/TRTC?$filter=StationName/Zh_tw eq '${stationName}'&$format=JSON`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resTrtc.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
            let data = [];
            if (resTrtc.ok) data = await resTrtc.json();

            // 如果沒抓到資料，去撈新北捷運 (NTMC)
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

        // 過濾已開走班次並排序
        results = results.filter(r => r.time >= nowTime).sort((a, b) => a.time.localeCompare(b.time));

        if (results.length === 0) throw new Error("TDX 查無資料，強制轉入離線備援");
        return { status: "success", data: results.slice(0, 10) };

    } catch (err) {
        console.warn("API 異常或無資料，已進入離線防空洞:", err.message);
        
        // 🚨 重新設計的防空洞搜尋器
        if (offlineData && offlineData[type]) {
            let targetNode = null;

            // 遍歷所有 Key (R11, Y15, BL05...) 來尋找符合的 stationName
            for (let code in offlineData[type]) {
                if (offlineData[type][code].name === stationName) {
                    targetNode = offlineData[type][code];
                    break;
                }
            }

            if (targetNode) {
                let offlineResults = parseOfflineData(targetNode);
                // 離線備援也需要過濾掉已開走的車
                offlineResults = offlineResults.filter(r => r.time >= nowTime).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                
                // 如果過濾完還是空的，代表今天真的沒車了
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
 * 🌟 模式 2：求生模式 - 獲取「A站到B站」的最後一班車發車時間
 */
async function fetchRealLastTrainTime(globalData, token, startId, endId, type) {
    const today = getOperatingDateString();
    let url = "";

    if (type === 'tra') url = `https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyTrainTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    else if (type === 'thsr') url = `https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    else if (type === 'trtc') return null; // 北捷交給離線防空洞

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

/**
 * 斷網防空洞求生模式演算法 (支援高級字典)
 */
function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type]) return null;
    
    let targetNode = null;
    for (let code in offlineData[type]) {
        if (offlineData[type][code].name === start) {
            targetNode = offlineData[type][code];
            break;
        }
    }

    if (!targetNode) return null;
    
    const parsedResults = parseOfflineData(targetNode);
    let maxMins = -1; 
    let latestTimeStr = null;

    parsedResults.forEach(item => {
        let mins = timeToMinutes(item.time);
        if (mins > maxMins) { maxMins = mins; latestTimeStr = item.time; }
    });

    return latestTimeStr;
}
