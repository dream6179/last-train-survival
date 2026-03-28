// ==========================================
// 末班車生存戰 - 核心路徑分揀與運算引擎
// ==========================================

const operatorMap = {
    'trtc': 'TRTC', 
    'tymetro': 'TYMC', 
    'krtc': 'KRTC', 
    'tmrt': 'TMRT'      
};

function getSmartStationInfo(globalStationData, origin, dest, type) {
    if (!globalStationData || !globalStationData[type] || !globalStationData[type].routes) return null;
    const routeKey = `${origin}-${dest}`;
    return globalStationData[type].routes[routeKey] || null;
}

// 🌟 離線演算法 (加入直達車支線保命邏輯)
function calculateOfflineTime(offlineTimetableData, startName, endName, type) {
    if (!offlineTimetableData || !offlineTimetableData[type]) return null;
    const table = offlineTimetableData[type];

    const startKeys = Object.keys(table).filter(k => table[k].name === startName);
    const endKeys = Object.keys(table).filter(k => table[k].name === endName);

    for (let sKey of startKeys) {
        for (let eKey of endKeys) {
            const sLineMatch = sKey.match(/[A-Z]+/);
            const eLineMatch = eKey.match(/[A-Z]+/);
            if (!sLineMatch || !eLineMatch) continue;
            
            const sLine = sLineMatch[0];
            const eLine = eLineMatch[0];

            if (sLine === eLine) {
                const sData = table[sKey];

                if (sData.up && typeof sData.up === 'object' && sData.up[eKey] && sData.up[eKey] !== "00:00") return sData.up[eKey];
                if (sData.down && typeof sData.down === 'object' && sData.down[eKey] && sData.down[eKey] !== "00:00") return sData.down[eKey];

                const sNumMatch = sKey.match(/\d+/);
                const eNumMatch = eKey.match(/\d+/);
                if (!sNumMatch || !eNumMatch) continue;
                
                const sNum = parseInt(sNumMatch[0]);
                const eNum = parseInt(eNumMatch[0]);
                
                const direction = sNum < eNum ? 'up' : 'down';
                const timeData = sData[direction];
                
                if (!timeData || timeData === "00:00") continue;

                if (typeof timeData === 'string') {
                    return timeData;
                }
                else if (typeof timeData === 'object') {
                    if (timeData[eKey]) return timeData[eKey];
                    
                    // 橘線專屬分流
                    if (sLine === 'O') {
                        if (eNum >= 50) return timeData["O54"] || null;
                        if (eNum >= 13 && eNum <= 21) return timeData["O21"] || null;
                        if (eNum <= 12) {
                            const times = Object.values(timeData);
                            times.sort().reverse(); 
                            return times[0];
                        }
                    }
                    
                    // 🌟 修復 2：綠線/紅線直達車支線盲區！
                    // 如果找不到特定終點的時刻，一律取該方向「最早」的末班車保命！
                    const times = Object.values(timeData).filter(t => t !== "00:00");
                    if (times.length > 0) {
                        times.sort();
                        return times[0];
                    }
                }
            }
        }
    }
    return null; 
}

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

async function fetchSingleStationTime(stationName, type, offlineTimetableData, cachedTdxToken) {
    let resultsMap = new Map(); 
    let isOnline = false;
    const operatorCode = operatorMap[type];
    
    if (!offlineTimetableData || !offlineTimetableData[type]) {
        return { status: "error", data: [] };
    }
    
    const table = offlineTimetableData[type];
    const stationKeys = Object.keys(table).filter(k => table[k].name === stationName);
    if (stationKeys.length === 0) return { status: "not_found", data: [] };

    const now = new Date();
    const currentHour = now.getHours();
    const currentMins = now.getMinutes();
    const absoluteCurrentMins = (currentHour < 4 ? currentHour + 24 : currentHour) * 60 + currentMins;

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
                        const routeLine = sKey.match(/[A-Z]+/)[0];
                        const uniqueKey = `${routeLine}-${destName}`;

                        if (route.Timetables && route.Timetables.length > 0) {
                            route.Timetables.forEach(t => {
                                const timeStr = t.DepartureTime;
                                const [h, m] = timeStr.split(':').map(Number);
                                
                                let adjustedH = h < 4 ? h + 24 : h;
                                let totalMins = adjustedH * 60 + m;

                                if (totalMins >= absoluteCurrentMins) {
                                    if (!resultsMap.has(uniqueKey)) {
                                        resultsMap.set(uniqueKey, { time: timeStr, totalMins: totalMins });
                                    } else {
                                        if (totalMins > resultsMap.get(uniqueKey).totalMins) {
                                            resultsMap.set(uniqueKey, { time: timeStr, totalMins: totalMins });
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.log("API 查詢失敗，降級使用離線資料");
            isOnline = false; 
        }
    }

    if (!isOnline || resultsMap.size === 0) {
        resultsMap.clear(); 
        
        stationKeys.forEach(sKey => {
            const sData = table[sKey];
            const sLine = sKey.match(/[A-Z]+/)[0];

            if (sData.up && sData.up !== "00:00") {
                if (typeof sData.up === 'object') {
                    for (let destKey in sData.up) {
                        if(sData.up[destKey] !== "00:00") {
                            const destName = table[destKey]? table[destKey].name : destKey;
                            resultsMap.set(`${sLine}-${destName}`, { time: sData.up[destKey], source: "離線備用" });
                        }
                    }
                } else {
                    const destName = getDirectionName(sLine, 'up');
                    resultsMap.set(`${sLine}-${destName}`, { time: sData.up, source: "離線備用" });
                }
            }

            if (sData.down && sData.down !== "00:00") {
                if (typeof sData.down === 'object') {
                    for (let destKey in sData.down) {
                        if(sData.down[destKey] !== "00:00") {
                            const destName = table[destKey]? table[destKey].name : destKey;
                            resultsMap.set(`${sLine}-${destName}`, { time: sData.down[destKey], source: "離線備用" });
                        }
                    }
                } else {
                    const destName = getDirectionName(sLine, 'down');
                    resultsMap.set(`${sLine}-${destName}`, { time: sData.down, source: "離線備用" });
                }
            }
        });
    }
    
    let finalResults = [];
    resultsMap.forEach((val, key) => {
        const [line, dest] = key.split('-');
        finalResults.push({
            line: line,
            destination: dest,
            time: val.time,
            source: val.source || "即時連線"
        });
    });

    let finalStatus = isOnline ? "online" : "offline";
    if (isOnline && finalResults.length === 0) {
        finalStatus = "all_departed"; 
    }
    
    return { status: finalStatus, data: finalResults };
}

// 4. 🌟 終極轉乘防線：自動辨識字首換線 (加入空值防呆)
function getOfficialTransferTime(transferData, offlineTimetableData, startName, endName, type) {
    if (!transferData || !transferData[startName]) return null;
    const routes = transferData[startName];
    
    if (routes[endName]) return routes[endName];

    // 🌟 修復 1：防呆檢查，如果離線字典根本沒載入成功，直接跳過，避免 null 崩潰
    if (!offlineTimetableData || !offlineTimetableData[type]) return null;
    
    const table = offlineTimetableData[type];
    
    const startKeys = Object.keys(table).filter(k => table[k].name === startName);
    const endKeys = Object.keys(table).filter(k => table[k].name === endName);
    
    if(startKeys.length === 0 || endKeys.length === 0) return null;

    const startPrefixes = startKeys.map(k => k.match(/[A-Z]+/)[0]);
    const endPrefixes = endKeys.map(k => k.match(/[A-Z]+/)[0]);

    const isCrossLine = !startPrefixes.some(p => endPrefixes.includes(p));
    
    if (isCrossLine) {
        for (let p of endPrefixes) {
            if (routes[p]) return routes[p];
        }
    }
    
    return null;
}
