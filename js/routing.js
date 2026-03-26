// ==========================================
// 末班車生存戰 - 核心路徑分揀與運算引擎 (v1.2)
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
    let resultsMap = new Map(); // 🌟 用 Map 來幫助我們去重跟找最晚的車
    let isOnline = false;
    const operatorCode = operatorMap[type];
    const table = offlineTimetableData[type];
    
    if (!table) return { status: "error", data: [] };

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
                        // 用路線和終點當作唯一的 Key，例如: "G-往新店"
                        const routeLine = sKey.match(/[A-Z]+/)[0];
                        const uniqueKey = `${routeLine}-${destName}`;

                        if (route.Timetables && route.Timetables.length > 0) {
                            route.Timetables.forEach(t => {
                                const timeStr = t.DepartureTime;
                                const [h, m] = timeStr.split(':').map(Number);
                                
                                // 🌟 核心跨日邏輯：把凌晨 0~3 點加上 24 小時
                                let adjustedH = h < 4 ? h + 24 : h;
                                let totalMins = adjustedH * 60 + m;

                                // 篩選條件：這班車必須還沒開走！
                                if (totalMins >= absoluteCurrentMins) {
                                    // 如果 Map 裡面還沒有這個終點，或者這班車比 Map 裡面存的車「還要晚」，就更新它
                                    if (!resultsMap.has(uniqueKey)) {
                                        resultsMap.set(uniqueKey, { time: timeStr, totalMins: totalMins });
                                    } else {
                                        // 注意：我們要找的是「剩餘班次裡面，最晚的那一班」
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
            isOnline = false; // 強制切換離線
        }
    }

    // 若斷網、查無資料、或是「即時連線發現所有車都開走了」，自動切換離線顯示「表定末班車」
    if (!isOnline || resultsMap.size === 0) {
        // 清空可能殘留的即時垃圾
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
    
    // 把 Map 轉回陣列輸出
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

    // 如果即時連線發現末班車真的都開走了，給一個特殊的 status
    let finalStatus = isOnline ? "online" : "offline";
    if (isOnline && finalResults.length === 0) {
        finalStatus = "all_departed"; 
    }
    
    return { status: finalStatus, data: finalResults };
}
