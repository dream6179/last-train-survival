// ==========================================
// 🚀 末班車生存戰 核心路由與 API 引擎 (Vercel 全代理版)
// ==========================================

function getSystemTime() {
    if (localStorage.getItem('dev_mode_active') === 'true') {
        let d = new Date(); d.setHours(23, 30, 0, 0); return d;
    }
    return new Date();
}

async function fetchWithTimeout(resource, options = {}) {
    // 🌟 預設 15 秒耐心極限，確保 TDX 大數據有時間傳完
    const { timeout = 15000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
}

function getOperatingDateString() {
    const now = getSystemTime();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getNowTimeString() {
    const now = getSystemTime();
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

// ==========================================
// 🔍 單站/路線 時刻表查詢 (包含公車直球對決)
// ===========================================
async function fetchSingleStationTime(stationName, type, offlineData, searchMode = 'now') {
    // 🌟 公車客運專屬邏輯 (純連線，無字典)
    if (type === 'bus') {
        const routeName = encodeURIComponent(stationName.trim());
        // 依序掃描：公路客運 -> 台北市公車 -> 新北市公車
        const paths = [
            `/v2/Bus/EstimatedTimeOfArrival/InterCity/${routeName}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/Taipei/${routeName}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/NewTaipei/${routeName}`
        ];
        
        let foundData = [];
        for (let p of paths) {
            try {
                const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(p)}&$format=JSON`, { timeout: 4000 });
                if (res.ok) {
                    const d = await res.json();
                    if (d && d.length > 0) { foundData = d; break; }
                }
            } catch (e) {} // 如果這條線沒有，就默默繼續找下一個城市
        }

        if (foundData.length === 0) throw new Error("查無路線");

        let busResults = {};
        foundData.forEach(b => {
            if (b.EstimateTime !== undefined && b.EstimateTime > 0) {
                const dest = b.Direction === 0 ? "去程" : "回程";
                const mins = Math.floor(b.EstimateTime / 60);
                const timeStr = mins < 60 ? `約 ${mins} 分` : `約 ${Math.floor(mins/60)}時${mins%60}分`;
                if (!busResults[dest] || b.EstimateTime < busResults[dest].raw) {
                    busResults[dest] = { raw: b.EstimateTime, text: timeStr };
                }
            }
        });

        if (Object.keys(busResults).length === 0) throw new Error("無動態");
        
        let results = [];
        for (let k in busResults) results.push({ destination: k, time: busResults[k].text, source: "即時動態" });
        return { status: "success", data: results };
    }

    // --- 以下為原有的捷運/台鐵/高鐵查詢邏輯 ---
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
            const path = '/v2/Rail/Metro/StationTimeTable/TRTC';
            const filter = `StationName/Zh_tw eq '${stationName}'`;
            const urlTrtc = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$filter=${encodeURIComponent(filter)}&$format=JSON`;
            
            let resTrtc = await fetchWithTimeout(urlTrtc);
            if (!resTrtc.ok) throw new Error("代理伺服器或 TDX 拒絕連線");
            
            let data = await resTrtc.json();

            if (data.length === 0) {
                const pathNtmc = '/v2/Rail/Metro/StationTimeTable/NTMC';
                const urlNtmc = `/api/get-tdx-data?path=${encodeURIComponent(pathNtmc)}&$filter=${encodeURIComponent(filter)}&$format=JSON`;
                let resNtmc = await fetchWithTimeout(urlNtmc);
                if (resNtmc.ok) data = await resNtmc.json();
            }
            data.forEach(route => { route.Timetables.forEach(t => { results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" }); }); });
        }
        else if (type === 'tra') {
            const path = `/v3/Rail/TRA/DailyStationTimetable/Today/Station/${stationId}`;
            const urlTra = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`;
            
            let resTra = await fetchWithTimeout(urlTra);
            if (!resTra.ok) throw new Error("代理伺服器或 TDX 拒絕連線");
            
            let data = await resTra.json();
            if (data.StationTimetables) { data.StationTimetables.forEach(dir => dir.TimeTables.forEach(t => results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" }))); }
        }
        else if (type === 'thsr') {
            const path = `/v2/Rail/THSR/DailyTimetable/Station/${stationId}/${today}`;
            const urlThsr = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`;
            
            let resThsr = await fetchWithTimeout(urlThsr);
            if (!resThsr.ok) throw new Error("代理伺服器或 TDX 拒絕連線");

            let data = await resThsr.json();
            data.forEach(t => results.push({ destination: t.Direction === 0 ? "左營(南下)" : "南港(北上)", time: t.DepartureTime, source: "即時連線" }));
        }

        if (results.length === 0) throw new Error("代理回傳查無班次，轉入離線防空洞");

        if (searchMode === 'last') {
            let lastTrainsMap = {};
            results.forEach(r => {
                if (!lastTrainsMap[r.destination] || timeToMinutes(r.time) > timeToMinutes(lastTrainsMap[r.destination].time)) {
                    lastTrainsMap[r.destination] = r;
                }
            });
            results = Object.values(lastTrainsMap).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
            return { status: "success", data: results };
        } else {
            results = results.filter(r => timeToMinutes(r.time) >= currentMins).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
            if (results.length === 0) throw new Error("今日已無班次，轉入離線驗證");
            return { status: "success", data: results.slice(0, 10) };
        }

    } catch (err) {
        console.warn("網路異常或無資料，啟動離線防空洞:", err.message);
        
        if (offlineData && offlineData[type]) {
            let targetNode = null; let targetCode = null;
            for (let code in offlineData[type]) {
                if (offlineData[type][code].name === stationName) { targetNode = offlineData[type][code]; targetCode = code; break; }
            }

            if (targetNode) {
                let offlineResults = parseOfflineData(targetCode, targetNode, offlineData[type]);
                if (searchMode === 'last') {
                    offlineResults.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                    return { status: "success", data: offlineResults };
                } else {
                    offlineResults = offlineResults.filter(r => timeToMinutes(r.time) >= currentMins).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                    if(offlineResults.length === 0) return { status: "success", data: [{ destination: "本日已無班次", time: "--:--", source: "系統判定" }] };
                    return { status: "success", data: offlineResults.slice(0, 10) };
                }
            }
        }
        return { status: "not_found", data: [] };
    }
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

// ==========================================
// 🛡️ 雙段極限求生演算法 (包含公車處理)
// ===========================================
async function fetchTwoStageSurvivalTime(startType, startId, transferId, transferName, endName, offlineData) {
    // 🌟 公車/客運的求生計算邏輯
    if (startType === 'bus') {
        const routeName = encodeURIComponent(startId.trim());
        const paths = [
            `/v2/Bus/EstimatedTimeOfArrival/InterCity/${routeName}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/Taipei/${routeName}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/NewTaipei/${routeName}`
        ];
        
        let maxMins = -1;
        for (let p of paths) {
            try {
                const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(p)}&$format=JSON`, { timeout: 6000 });
                if (res.ok) {
                    const d = await res.json();
                    d.forEach(b => {
                        if (b.EstimateTime !== undefined && b.EstimateTime > 0) {
                            const m = Math.floor(b.EstimateTime / 60);
                            if (m > maxMins) maxMins = m; // 找出最晚到站的那班車
                        }
                    });
                    if (maxMins > -1) break; // 只要找到這條路線有車跑，就不找下個城市了
                }
            } catch(e) {}
        }
        
        if (maxMins === -1) return { time: null, status: "查無此路線或已收班" };
        
        // 用「現在時間 + 預估到站時間」換算成發車時間顯示給鄉民看
        const now = getSystemTime();
        now.setMinutes(now.getMinutes() + maxMins);
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        
        return { time: timeStr, status: "公車即時動態估算" };
    }

    // --- 以下為台鐵/高鐵轉乘北捷的計算邏輯 ---
    let trtcLastTime = calculateOfflineTime(offlineData, transferName, endName, 'trtc');
    if (!trtcLastTime) return { time: null, status: "查無北捷轉乘班次" };
    
    let targetArrivalMins = timeToMinutes(trtcLastTime) - 30;

    if (startId === transferId) return { time: minutesToTime(targetArrivalMins), status: "同站跨系統 (-30分)" };

    const today = getOperatingDateString();
    let path = (startType === 'tra') 
        ? `/v3/Rail/TRA/DailyTrainTimetable/OD/${startId}/to/${transferId}/${today}`
        : `/v2/Rail/THSR/DailyTimetable/OD/${startId}/to/${transferId}/${today}`;

    const url = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`;

    try {
        const response = await fetchWithTimeout(url, { timeout: 15000 });
        if (!response.ok) return { time: null, status: `代理異常 (HTTP ${response.status})` };

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { return { time: null, status: "TDX資料解析失敗" }; }

        let validTrains = [];
        const trains = startType === 'tra' ? (data.TrainTimetables || []) : (data || []);
        
        trains.forEach(t => {
            const arrival = startType === 'tra' ? t.DestinationStopTime.ArrivalTime : t.DestinationStopTime.ArrivalTime;
            const departure = startType === 'tra' ? t.OriginStopTime.DepartureTime : t.OriginStopTime.DepartureTime;
            if (timeToMinutes(arrival) <= targetArrivalMins) validTrains.push(departure);
        });

        if (validTrains.length === 0) {
            const nowHours = getSystemTime().getHours();
            if (nowHours > 6 && nowHours < 21) {
                return { time: null, status: "查無直達轉乘站的班次" };
            } else {
                return { time: null, status: "錯過轉乘末班車" };
            }
        }
        
        validTrains.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        return { time: validTrains[validTrains.length - 1], status: "雙段精準計算" };
        
    } catch (err) {
        console.warn("⚠️ 連線超時，啟動離線保險字典...");
    }

    if (startType === 'tra' && typeof traOfflineDict !== 'undefined' && traOfflineDict) {
        let safeTime = traOfflineDict[startId] || traOfflineDict["DEFAULT"];
        return { time: safeTime, status: "離線保險估算" };
    }

    return { time: "22:15", status: "系統保險預估" };
}
