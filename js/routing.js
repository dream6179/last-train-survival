// ==========================================
// 末班車生存戰 核心路由與 API 引擎 (v2.2 連環車禍修復版)
// ==========================================

/**
 * 取得今天日期的字串 (YYYY-MM-DD)
 * 考量到深夜通勤，凌晨 0 點 ~ 4 點的查詢，我們會把它算在「前一天」的營運日內
 */
function getOperatingDateString() {
    const now = new Date();
    if (now.getHours() < 4) {
        now.setDate(now.getDate() - 1);
    }
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * 取得現在時間的字串 (HH:mm)
 */
function getNowTimeString() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * 將時間字串 (HH:mm) 轉換為分鐘數，專門解決跨夜比對問題 (凌晨 0~3 點視為 24~27 點)
 */
function timeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    let [h, m] = timeStr.split(':').map(Number);
    if (h < 4) h += 24; 
    return h * 60 + m;
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

    let url = "";

    // 依照運具組合對應的 TDX API
    if (type === 'trtc') {
        // 🚨 修正：北捷改用「中文站名」查詢，避免英文 ID 與官方代碼不符的問題
        url = `https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/TRTC?$filter=StationName/Zh_tw eq '${stationName}'&$format=JSON`;
    } else if (type === 'tra') {
        url = `https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyStationTimetable/Today/Station/${stationId}?$format=JSON`;
    } else if (type === 'thsr') {
        url = `https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/Station/${stationId}/${today}?$format=JSON`;
    } else {
        return { status: "not_found", data: [] };
    }

    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

        if (response.status === 401) return { status: "TOKEN_EXPIRED", data: [] };
        if (!response.ok) throw new Error(`TDX API Error: ${response.status}`);

        const data = await response.json();
        let results = [];

        // 整理各家不同格式的 JSON 資料
        if (type === 'trtc') {
            data.forEach(route => {
                route.Timetables.forEach(t => {
                    results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" });
                });
            });
        } else if (type === 'tra') {
            if (data.StationTimetables && data.StationTimetables.length > 0) {
                data.StationTimetables.forEach(dir => {
                    dir.TimeTables.forEach(t => {
                        results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" });
                    });
                });
            }
        } else if (type === 'thsr') {
            data.forEach(t => {
                let dest = t.Direction === 0 ? "左營(南下)" : "南港(北上)";
                results.push({ destination: dest, time: t.DepartureTime, source: "即時連線" });
            });
        }

        // 過濾掉已經開走的車
        results = results.filter(r => r.time >= nowTime).sort((a, b) => a.time.localeCompare(b.time));

        // 🚨 關鍵防禦：如果 TDX 回傳空陣列，強制丟出錯誤，啟動離線防空洞
        if (results.length === 0) {
             throw new Error("TDX 查無資料，強制轉入離線備援");
        }

        return { status: "success", data: results.slice(0, 10) };

    } catch (err) {
        console.warn("API 異常或無資料，已進入離線防空洞:", err.message);
        
        // 🚨 雙重保險：同時支援 中文站名("板新") 或 英文ID("Banxin") 作為離線字典的 Key
        let offlineKey = null;
        if (offlineData && offlineData[type]) {
            if (offlineData[type][stationName]) offlineKey = stationName;
            else if (offlineData[type][stationId]) offlineKey = stationId;
        }

        if (offlineKey) {
            let offlineResults = offlineData[type][offlineKey].map(item => ({
                destination: item.dest || item.destination || "末班車",
                time: item.time,
                source: "離線備援"
            }));
            
            offlineResults.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
            return { status: "success", data: offlineResults.slice(0, 10) };
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

    if (type === 'tra') {
        url = `https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyTrainTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    } else if (type === 'thsr') {
        url = `https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    } else if (type === 'trtc') {
        // 北捷沒有直接的 OD API，拋回 Null 進入離線防空洞
        return null; 
    }

    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401) return "TOKEN_EXPIRED";
        if (!response.ok) return null;

        const data = await response.json();
        let timetables = [];

        if (type === 'tra' && data.TrainTimetables) {
            timetables = data.TrainTimetables.map(t => t.OriginStopTime.DepartureTime);
        } else if (type === 'thsr') {
            timetables = data.map(t => t.OriginStopTime.DepartureTime);
        }

        if (timetables.length === 0) return null;

        // 利用數值排序找出真正的「最晚一班車」
        timetables.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        return timetables[timetables.length - 1]; 

    } catch (err) {
        console.warn("TDX O-D 查詢失敗，降級使用離線演算法", err);
        return null;
    }
}

/**
 * 官方中繼轉乘死線
 */
function getOfficialTransferTime(transferData, offlineData, start, end, type) {
    if (!transferData) return null;
    const key = `${start}-${end}`;
    if (transferData[type] && transferData[type][key]) {
        return transferData[type][key];
    }
    return null;
}

/**
 * 斷網防空洞 (純離線演算法)
 */
function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type]) return null;
    
    // 試著去抓全域變數裡的英文 ID (萬一字典是用英文當 Key)
    let stationId = null;
    if (typeof globalStationData !== 'undefined' && globalStationData[type]) {
        let sObj = globalStationData[type].options.find(s => s.name === start);
        if (sObj) stationId = sObj.id;
    }

    let offlineKey = null;
    if (offlineData[type][start]) offlineKey = start;
    else if (stationId && offlineData[type][stationId]) offlineKey = stationId;

    if (!offlineKey) return null;
    
    const stationTimes = offlineData[type][offlineKey];
    let maxMins = -1;
    let latestTimeStr = null;

    stationTimes.forEach(item => {
        let mins = timeToMinutes(item.time);
        if (mins > maxMins) {
            maxMins = mins;
            latestTimeStr = item.time;
        }
    });

    return latestTimeStr;
}
