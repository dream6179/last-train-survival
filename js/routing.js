// ==========================================
// 末班車生存戰 - 核心路徑分揀與運算引擎 (v1.3)
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
                const sData = table[sKey];

                // 🌟 終極防禦：不管方向，只要出發站的 up 或 down 裡面有「專屬目標代碼」，直接抓時間！
                if (sData.up && typeof sData.up === 'object' && sData.up[eKey] && sData.up[eKey] !== "00:00") return sData.up[eKey];
                if (sData.down && typeof sData.down === 'object' && sData.down[eKey] && sData.down[eKey] !== "00:00") return sData.down[eKey];

                // 如果不是專屬月台，再用傳統的數字比大小來算方向
                const sNum = parseInt(sKey.match(/\d+/)[0]);
                const eNum = parseInt(eKey.match(/\d+/)[0]);
                
                const direction = sNum < eNum ? 'up' : 'down';
                const timeData = sData[direction];
                
                if (!timeData || timeData === "00:00") continue;

                if (typeof timeData === 'string') {
                    return timeData;
                }
                else if (typeof timeData === 'object') {
                    // 🌟 支線精確制導：如果目的地代碼直接就在這個物件裡，直接拿時間！
                    if (timeData[eKey]) return timeData[eKey];
                    
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

// 核心檢索：撈出該車站所有路線、所有方向的末班車
async function fetchSingleStationTime(stationName, type, offlineTimetableData, cachedTdxToken) {
    let resultsMap = new Map(); 
    let isOnline = false;
    const operatorCode = operatorMap[type];
    
    // 🛡️ 防彈裝甲加回來：先嚴格檢查資料是不是壞的！
    if (!offlineTimetableData || !offlineTimetableData[type]) {
        return { status: "error", data: [] };
    }
    
    const table = offlineTimetableData[type];

    const stationKeys = Object.keys(table).filter(k => table[k].name === stationName);
    if (stationKeys.length === 0) return { status: "not_found", data: [] };

    // 🕒 幫大腦建立「現在幾點」的跨日判斷基準
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
// 4. 🌟 終極轉乘防線：官方轉乘死線字典
function getOfficialTransferTime(transferData, startName, endName) {
    // 檢查字典在不在，以及起點有沒有建檔
    if (!transferData || !transferData[startName]) return null;
    
    const routes = transferData[startName];
    let possibleTimes = [];

    for (let key in routes) {
        // 處理格式：如果是 "文湖線-南港展覽館"，切出 "南港展覽館"；如果是 "小碧潭"，就直接用
        const destPart = key.includes('-') ? key.split('-')[1] : key;
        
        // 絕對精準比對終點站名稱！
        if (destPart === endName) {
            possibleTimes.push(routes[key]);
        }
    }

    if (possibleTimes.length > 0) {
        // 如果有多條路線都能到（比如板南跟文湖都能去南港展覽館）
        // 為了求生安全，我們取最嚴格（最早）的時間！
        possibleTimes.sort();
        return possibleTimes[0];
    }
    return null;
}
