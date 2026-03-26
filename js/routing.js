// ==========================================
// 末班車生存戰 - 核心路徑分揀與運算引擎 (v1.0)
// ==========================================

const operatorMap = {
    'trtc': 'TRTC', 
    'tymetro': 'TYMC', 
    'krtc': 'KRTC', 
    'tmrt': 'TMRT'      
};

// 1. 智慧代碼導航器：負責查出起迄點的車站代號
function getSmartStationInfo(globalStationData, origin, dest, type) {
    if (!globalStationData || !globalStationData[type] || !globalStationData[type].routes) return null;
    const routeKey = `${origin}-${dest}`;
    return globalStationData[type].routes[routeKey] || null;
}

// 2. 離線神級演算法：支援 Y 型分岔路線的極限推演
function calculateOfflineTime(offlineTimetableData, startName, endName, type) {
    if (!offlineTimetableData || !offlineTimetableData[type]) return null;
    const table = offlineTimetableData[type];

    const startKeys = Object.keys(table).filter(k => table[k].name === startName);
    const endKeys = Object.keys(table).filter(k => table[k].name === endName);

    for (let sKey of startKeys) {
        for (let eKey of endKeys) {
            const sLine = sKey.match(/[A-Z]+/)[0];
            const eLine = eKey.match(/[A-Z]+/)[0];

            if (sLine === eLine) {
                const sNum = parseInt(sKey.match(/\d+/)[0]);
                const eNum = parseInt(eKey.match(/\d+/)[0]);
                
                const direction = sNum < eNum ? 'up' : 'down';
                const timeData = table[sKey][direction];
                
                if (!timeData || timeData === "00:00") continue;

                if (typeof timeData === 'string') {
                    return timeData;
                } 
                else if (typeof timeData === 'object') {
                    // 橘線 (O) 專屬智慧分流邏輯
                    if (sLine === 'O') {
                        if (eNum >= 50) return timeData["O54"] || null;
                        if (eNum >= 13 && eNum <= 21) return timeData["O21"] || null;
                        if (eNum <= 12) {
                            const times = Object.values(timeData);
                            times.sort().reverse(); 
                            return times[0];
                        }
                    }
                }
            }
        }
    }
    return null; 
}

// 3. 連線交通部 API 的主要大門
async function fetchRealLastTrainTime(globalStationData, cachedTdxToken, origin, destination, type) {
    try {
        const operatorCode = operatorMap[type];
        if (!operatorCode) return null;

        const info = getSmartStationInfo(globalStationData, origin, destination, type);
        if (!info) return null;
        
        const originCode = info.originCode;
        const terminuses = info.terminuses;
        
        const apiUrl = `https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/${operatorCode}?$filter=StationID eq '${originCode}'&$format=JSON`;

        const res = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${cachedTdxToken}` }
        });
        const data = await res.json();

        // 若 Token 失效，回傳特定狀態讓外部重新拿 Token
        if (data.message === 'Unauthorized' || res.status === 401) {
            return "TOKEN_EXPIRED";
        }

        if (data && data.length > 0) {
            let maxMinutes = -1;
            let lastTrainTimeStr = "";

            data.forEach(route => {
                const tdxDestId = route.DestinationStaionID || route.DestinationStationID;
                if (terminuses.includes(tdxDestId)) {
                    if (route.Timetables && route.Timetables.length > 0) {
                        route.Timetables.forEach(t => {
                            const timeStr = t.DepartureTime; 
                            const [h, m] = timeStr.split(':').map(Number);
                            let adjustedH = h < 4 ? h + 24 : h;
                            let totalMins = adjustedH * 60 + m;

                            if (totalMins > maxMinutes) {
                                maxMinutes = totalMins;
                                lastTrainTimeStr = timeStr;
                            }
                        });
                    }
                }
            });
            if (lastTrainTimeStr !== "") return lastTrainTimeStr;
        } 
        return null;
    } catch (error) {
        return null;
    }
}
