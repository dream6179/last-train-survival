// ==========================================
// 🚀 末班車生存戰 核心路由與 API 引擎 (Vercel 全代理版)
// ==========================================

// ... (前半部的 getSystemTime, fetchWithTimeout, timeToMinutes, parseOfflineData 等純邏輯函數保持不變) ...

/**
 * 查詢單一車站時刻表
 * ✂️ 移除了 token 參數與過期重試邏輯，全面改接 /api/get-tdx-data
 */
async function fetchSingleStationTime(stationName, type, offlineData, searchMode = 'now') {
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
            // 北捷查詢：轉換為跳板 API 路徑
            const path = '/v2/Rail/Metro/StationTimeTable/TRTC';
            const filter = `StationName/Zh_tw eq '${stationName}'`;
            const urlTrtc = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$filter=${encodeURIComponent(filter)}&$format=JSON`;
            
            let resTrtc = await fetchWithTimeout(urlTrtc);
            if (!resTrtc.ok) throw new Error("代理伺服器或 TDX 拒絕連線");
            
            let data = await resTrtc.json();

            // 如果北捷沒資料，嘗試查新北捷運 (環狀線等)
            if (data.length === 0) {
                const pathNtmc = '/v2/Rail/Metro/StationTimeTable/NTMC';
                const urlNtmc = `/api/get-tdx-data?path=${encodeURIComponent(pathNtmc)}&$filter=${encodeURIComponent(filter)}&$format=JSON`;
                let resNtmc = await fetchWithTimeout(urlNtmc);
                if (resNtmc.ok) data = await resNtmc.json();
            }
            data.forEach(route => { route.Timetables.forEach(t => { results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" }); }); });
        } 
        else if (type === 'tra') {
            // 台鐵查詢
            const path = `/v3/Rail/TRA/DailyStationTimetable/Today/Station/${stationId}`;
            const urlTra = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`;
            
            let resTra = await fetchWithTimeout(urlTra);
            if (!resTra.ok) throw new Error("代理伺服器或 TDX 拒絕連線");
            
            let data = await resTra.json(); 
            if (data.StationTimetables) { data.StationTimetables.forEach(dir => dir.TimeTables.forEach(t => results.push({ destination: t.DestinationStationName.Zh_tw, time: t.DepartureTime, source: "即時連線" }))); }
        } 
        else if (type === 'thsr') {
            // 高鐵查詢
            const path = `/v2/Rail/THSR/DailyTimetable/Station/${stationId}/${today}`;
            const urlThsr = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`;
            
            let resThsr = await fetchWithTimeout(urlThsr);
            if (!resThsr.ok) throw new Error("代理伺服器或 TDX 拒絕連線");

            let data = await resThsr.json(); 
            data.forEach(t => results.push({ destination: t.Direction === 0 ? "左營(南下)" : "南港(北上)", time: t.DepartureTime, source: "即時連線" }));
        }

        if (results.length === 0) throw new Error("代理回傳查無班次，轉入離線防空洞");

        // 整理與過濾時間的邏輯 (保持不變)
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
        // ... (離線備援的邏輯保持完全不變，此處為簡化省略，請保留你原本的離線備援區塊) ...
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

// ... (calculateOfflineTime 保持不變) ...

/**
 * 跨系統雙段生存計算
 * ✂️ 同樣拔除 token，直連代理伺服器
 */
async function fetchTwoStageSurvivalTime(startType, startId, transferId, transferName, endName, offlineData) {
    let trtcLastTime = calculateOfflineTime(offlineData, transferName, endName, 'trtc');
    if (!trtcLastTime) return { time: null, status: "查無北捷轉乘班次" };
    
    let targetArrivalMins = timeToMinutes(trtcLastTime) - 30;

    if (startId === transferId) return { time: minutesToTime(targetArrivalMins), status: "同站跨系統 (-30分)" };

    const today = getOperatingDateString(); 
    let path = "";

    if (startType === 'tra') {
        path = `/v3/Rail/TRA/DailyTrainTimetable/OD/${startId}/to/${transferId}/${today}`;
    } else if (startType === 'thsr') {
        path = `/v2/Rail/THSR/DailyTimetable/OD/${startId}/to/${transferId}/${today}`;
    }

    const url = `/api/get-tdx-data?path=${encodeURIComponent(path)}&$format=JSON`;

    try {
        const response = await fetchWithTimeout(url, { timeout: 4000 });
        if (!response.ok) return { time: null, status: "已無高鐵/台鐵班次 (代理伺服器無回應)" };

        const data = await response.json(); 
        let validTrains = [];
        
        if (startType === 'tra' && data.TrainTimetables) {
            data.TrainTimetables.forEach(t => { if (timeToMinutes(t.DestinationStopTime.ArrivalTime) <= targetArrivalMins) validTrains.push(t.OriginStopTime.DepartureTime); });
        } else if (startType === 'thsr') {
            data.forEach(t => { if (timeToMinutes(t.DestinationStopTime.ArrivalTime) <= targetArrivalMins) validTrains.push(t.OriginStopTime.DepartureTime); });
        }

        if (validTrains.length === 0) return { time: null, status: "錯過轉乘末班車" };
        
        validTrains.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        return { time: validTrains[validTrains.length - 1], status: "雙段精準計算" };
    } catch (err) { 
        return { time: null, status: "轉乘計算失敗 (網路無回應)" }; 
    }
}
