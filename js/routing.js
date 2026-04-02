function getSystemTime() { return new Date(); }
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options; const controller = new AbortController(); const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal }); clearTimeout(id); return response;
}

// 🌟 核心修改：公車單站檢索的過濾演算法
async function fetchSingleStationTime(stationName, type, offlineData, searchMode = 'now') {
    if (type === 'bus') {
        let routeName = stationName.trim(); let stopName = "";
        if (stationName.includes('|')) { [routeName, stopName] = stationName.split('|'); }
        
        const paths = [
            `/v2/Bus/EstimatedTimeOfArrival/InterCity/${encodeURIComponent(routeName)}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/Taipei/${encodeURIComponent(routeName)}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/NewTaipei/${encodeURIComponent(routeName)}`
        ];
        
        let foundData = [];
        for (let p of paths) {
            try {
                const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(p)}&$format=JSON`, { timeout: 4000 });
                if (res.ok) { const d = await res.json(); if (d && d.length > 0) { foundData = d; break; } }
            } catch (e) {} 
        }

        if (foundData.length === 0) throw new Error("查無路線");

        // 🌟 站牌過濾器：如果鄉民有填寫站牌，就把不相干的過濾掉
        if (stopName) {
            foundData = foundData.filter(b => b.StopName && b.StopName.Zh_tw && b.StopName.Zh_tw.includes(stopName));
        }

        let busResults = {};
        foundData.forEach(b => {
            if (b.EstimateTime !== undefined && b.EstimateTime > 0) {
                const dirStr = b.Direction === 0 ? "往 去程" : (b.Direction === 1 ? "往 回程" : "");
                const stopNameStr = b.StopName ? b.StopName.Zh_tw : "";
                const key = `${dirStr} - ${stopNameStr}`; // 將方向與站牌組合顯示
                const mins = Math.floor(b.EstimateTime / 60);
                const timeStr = mins < 60 ? `約 ${mins} 分` : `約 ${Math.floor(mins/60)}時${mins%60}分`;
                
                if (!busResults[key] || b.EstimateTime < busResults[key].raw) { busResults[key] = { raw: b.EstimateTime, text: timeStr }; }
            }
        });

        if (Object.keys(busResults).length === 0) throw new Error("無動態");
        let results = []; for (let k in busResults) results.push({ destination: k, time: busResults[k].text });
        return { status: "success", data: results };
    }
    return { status: "not_found", data: [] }; // 簡化展示，保留其他系統原有邏輯
}

// 🌟 核心修改：公車求生模式的過濾演算法
async function fetchTwoStageSurvivalTime(startType, startId, transferId, transferName, endName, offlineData) {
    if (startType === 'bus') {
        let routeName = startId.trim(); let stopName = "";
        if (startId.includes('|')) { [routeName, stopName] = startId.split('|'); }
        
        const paths = [
            `/v2/Bus/EstimatedTimeOfArrival/InterCity/${encodeURIComponent(routeName)}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/Taipei/${encodeURIComponent(routeName)}`,
            `/v2/Bus/EstimatedTimeOfArrival/City/NewTaipei/${encodeURIComponent(routeName)}`
        ];
        
        let maxMins = -1;
        for (let p of paths) {
            try {
                const res = await fetchWithTimeout(`/api/get-tdx-data?path=${encodeURIComponent(p)}&$format=JSON`, { timeout: 6000 });
                if (res.ok) {
                    let d = await res.json();
                    // 🌟 站牌過濾器
                    if (stopName) d = d.filter(b => b.StopName && b.StopName.Zh_tw && b.StopName.Zh_tw.includes(stopName));
                    
                    d.forEach(b => {
                        if (b.EstimateTime !== undefined && b.EstimateTime > 0) {
                            const m = Math.floor(b.EstimateTime / 60);
                            if (m > maxMins) maxMins = m; 
                        }
                    });
                    if (maxMins > -1) break; 
                }
            } catch(e) {}
        }
        
        if (maxMins === -1) return { time: null, status: "查無動態或無停靠此站" };
        const now = getSystemTime(); now.setMinutes(now.getMinutes() + maxMins);
        return { time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`, status: "估算" };
    }
    return { time: "22:15", status: "系統保險預估" };
}
