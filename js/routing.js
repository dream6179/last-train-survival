// ==========================================
// 末班車生存戰 核心路由與 API 引擎 (v2.0 全台擴張版)
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
        url = `https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/TRTC?$filter=StationID eq '${stationId}'&$format=JSON`;
    } else if (type === 'tra') {
        // 台鐵採用 v3 API
        url = `https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyStationTimetable/Today/Station/${stationId}?$format=JSON`;
    } else if (type === 'thsr') {
        // 高鐵採用 v2 API
        url = `https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/Station/${stationId}/${today}?$format=JSON`;
    } else {
        return { status: "not_found", data: [] };
    }

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

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
                // 高鐵的 Direction: 0 是南下(通常往左營), 1 是北上(通常往南港)
                let dest = t.Direction === 0 ? "左營(南下)" : "南港(北上)";
                results.push({ destination: dest, time: t.DepartureTime, source: "即時連線" });
            });
        }

        // 過濾掉已經開走的車，只保留接下來的班次並排序
        results = results.filter(r => r.time >= nowTime).sort((a, b) => a.time.localeCompare(b.time));

        // 如果是凌晨時段，可能會有跨夜車次，做個簡單防呆
        if (results.length === 0) {
             return { status: "success", data: [{ destination: "本日已無班次", time: "--:--", source: "系統判定" }] };
        }

        // 取前 10 筆顯示即可，免得畫面塞爆
        return { status: "success", data: results.slice(0, 10) };

    } catch (err) {
        console.warn("網路異常或 API 拒絕連線，啟動斷網防空洞 (離線檢索)", err);
        
        // 觸發斷網防空洞：從本地 offline-timetable.json 撈取
        if (offlineData && offlineData[type] && offlineData[type][stationName]) {
            let offlineResults = offlineData[type][stationName].map(item => ({
                destination: item.dest,
                time: item.time,
                source: "離線備援"
            }));
            offlineResults = offlineResults.filter(r => r.time >= nowTime).sort((a, b) => a.time.localeCompare(b.time));
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

    // 針對台鐵與高鐵，我們直接使用強大的 O-D (起迄站) API
    if (type === 'tra') {
        url = `https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyTrainTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    } else if (type === 'thsr') {
        url = `https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/OD/${startId}/to/${endId}/${today}?$format=JSON`;
    } else if (type === 'trtc') {
        // 北捷沒有直接的 OD API，我們拋回 Null 讓它進入我們的離線「最嚴格防禦」演算法
        return null; 
    }

    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401) return "TOKEN_EXPIRED";
        if (!response.ok) return null;

        const data = await response.json();
        let timetables = [];

        // 提取所有發車時間
        if (type === 'tra' && data.TrainTimetables) {
            timetables = data.TrainTimetables.map(t => t.OriginStopTime.DepartureTime);
        } else if (type === 'thsr') {
            timetables = data.map(t => t.OriginStopTime.DepartureTime);
        }

        if (timetables.length === 0) return null;

        // 排序後，抓取「今天最後一班車」的時間
        timetables.sort((a, b) => a.localeCompare(b));
        return timetables[timetables.length - 1]; 

    } catch (err) {
        console.warn("TDX O-D 查詢失敗，降級使用離線演算法", err);
        return null;
    }
}

/**
 * 官方中繼轉乘死線 (針對特定跨線換乘的保底機制)
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
 * 針對沒有 O-D API (如北捷) 或斷網時，抓取離線字典的最後一班車
 */
function calculateOfflineTime(offlineData, start, end, type) {
    if (!offlineData || !offlineData[type] || !offlineData[type][start]) return null;
    
    // 取得該站所有的發車時刻
    const stationTimes = offlineData[type][start];
    
    // 這裡實作最嚴格轉乘死線：我們直接抓取「最晚」發車的那個時間點作為底線
    let latestTime = "00:00";
    stationTimes.forEach(item => {
        // 過濾掉明顯不是當天深夜的班次 (例如早上 6 點)
        const hour = parseInt(item.time.split(':')[0]);
        if (hour >= 21 || hour < 3) { 
            if (item.time > latestTime) {
                latestTime = item.time;
            }
        }
    });

    return latestTime !== "00:00" ? latestTime : null;
}
