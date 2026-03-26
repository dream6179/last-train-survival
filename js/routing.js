// ==========================================
// 末班車生存戰 - 核心路徑分揀與運算引擎 (v1.1)
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

// 3. 連線交通部 API 的求生大門
async function fetchRealLastTrainTime(globalStationData, cachedTdxToken, origin, destination, type) {
    try {
        const operatorCode = operatorMap[type];
        if (!operatorCode) return null;

        const info = getSmartStationInfo(globalStationData, origin, destination, type);
        if (!info) return null;
        
        const originCode = info.originCode;
        const terminuses = info.terminuses;
        
        const apiUrl = `https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/${operatorCode}?$filter=StationID eq '${originCode}'&$format=JSON`;

        const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${cachedTdxToken}` } });
        const data = await res.json();

        if (data.message === 'Unauthorized' || res.status === 401) return "TOKEN_EXPIRED";

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

// ==========================================
// 🌟 模式 B：全站檢索系統專用邏輯
// ==========================================

// 輔助翻譯：當離線時，把 up/down 翻譯成人類看得懂的方向
function getDirectionName(line, dir) {
    const map = {
        'R': { up: '淡水/北投', down: '象山/大安' },
        'G': { up: '松山', down: '新店/台電大樓' },
        'BL': { up: '南港展覽館', down: '頂埔/亞東醫院' },
        'O': { up: '迴龍/蘆洲', down: '南勢角' },
        'BR': { up: '南港展覽館', down: '動物園' },
        'Y': { up: '新北產業園區', down: '大坪林' }
    };
    return map[line] ? map[line][dir] : (dir === 'up' ? '上行方向' : '下行方向');
}

// 核心檢索：撈出該車站所有路線、所有方向的末班車
async function fetchSingleStationTime(stationName, type, offlineTimetableData, cachedTdxToken) {
    let results = [];
    let isOnline = false;
    const operatorCode = operatorMap[type];
    const table = offlineTimetableData[type];
    
    if (!table) return { status: "error", data: [] };

    // 找出這個站名對應的所有代碼 (解決交會站問題)
    const stationKeys = Object.keys(table).filter(k => table[k].name === stationName);
    if (stationKeys.length === 0) return { status: "not_found", data: [] };

    // 嘗試呼叫 TDX API
    if (operatorCode && cachedTdxToken) {
        try {
            for (let sKey of stationKeys) {
                const apiUrl = `https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/StationTimeTable/${operatorCode}?$filter=StationID eq '${sKey}'&$format=JSON`;
                const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${cachedTdxToken}` } });
                const data = await res.json();

                if (data.message === 'Unauthorized' || res.status === 401) {
                    return { status: "TOKEN_EXPIRED", data: [] };
                }

                if (data && data.length > 0) {
                    isOnline = true;
                    data.forEach(route => {
                        const destName = route.DestinationStationName.Zh_tw;
                        if (route.Timetables && route.Timetables.length > 0) {
                            let maxMinutes = -1;
                            let lastTime = "";
                            route.Timetables.forEach(t => {
                                const timeStr = t.DepartureTime;
                                const [h, m] = timeStr.split(':').map(Number);
                                let adjustedH = h < 4 ? h + 24 : h;
                                let totalMins = adjustedH * 60 + m;
                                if (totalMins > maxMinutes) {
                                    maxMinutes = totalMins;
                                    lastTime = timeStr;
                                }
                            });
                            if (lastTime) {
                                results.push({
                                    line: sKey.match(/[A-Z]+/)[0],
                                    destination: destName,
                                    time: lastTime,
                                    source: "即時連線"
                                });
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.log("API 查詢失敗，降級使用離線資料");
        }
    }

    // 若斷網或查無資料，自動無縫切換到離線字典提取資料
    if (!isOnline) {
        stationKeys.forEach(sKey => {
            const sData = table[sKey];
            const sLine = sKey.match(/[A-Z]+/)[0];

            if (sData.up && sData.up !== "00:00") {
                if (typeof sData.up === 'object') {
                    for (let destKey in sData.up) {
                        if(sData.up[destKey] !== "00:00") {
                            results.push({ line: sLine, destination: table[destKey]? table[destKey].name : destKey, time: sData.up[destKey], source: "離線備用" });
                        }
                    }
                } else {
                    results.push({ line: sLine, destination: getDirectionName(sLine, 'up'), time: sData.up, source: "離線備用" });
                }
            }

            if (sData.down && sData.down !== "00:00") {
                if (typeof sData.down === 'object') {
                    for (let destKey in sData.down) {
                        if(sData.down[destKey] !== "00:00") {
                            results.push({ line: sLine, destination: table[destKey]? table[destKey].name : destKey, time: sData.down[destKey], source: "離線備用" });
                        }
                    }
                } else {
                    results.push({ line: sLine, destination: getDirectionName(sLine, 'down'), time: sData.down, source: "離線備用" });
                }
            }
        });
    }
    
    return { status: isOnline ? "online" : "offline", data: results };
}
