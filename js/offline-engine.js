/**
 * 🌟 屍體撿回：離線時間計算器
 * @param {Object} data - 你提供的 trtc JSON 資料
 * @param {string} stationId - 車站編號 (如 "R10")
 * @param {string} direction - "up" 或 "down"
 * @param {string} targetTerminal - (可選) 目標終點站編號，用於處理分支路線
 */
function getOfflineTime(data, stationId, direction, targetTerminal = null) {
    try {
        const station = data.trtc[stationId];
        if (!station) return "23:59";

        let timeVal = station[direction];

        // 處理分支車站 (例如北投 R22 的 up 有兩條路)
        if (typeof timeVal === 'object' && timeVal !== null) {
            if (targetTerminal && timeVal[targetTerminal]) {
                return timeVal[targetTerminal];
            }
            // 如果沒指定終點，預設抓該方向的第一個時間 (防呆)
            return Object.values(timeVal)[0];
        }

        return timeVal || "23:59";
    } catch (e) {
        console.error("離線資料讀取失敗:", e);
        return "23:59";
    }
}
