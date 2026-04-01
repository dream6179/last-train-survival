export default async function handler(req, res) {
    // 🛡️ 加上 CORS 標頭，避免一些不必要的跨域阻擋
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 處理預檢請求 (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 🌟 從前端接收「你想查詢的 TDX API 路徑」 (例如: /v2/Rail/Metro/LiveBoard/TRTC)
    const targetPath = req.query.path;

    if (!targetPath) {
        return res.status(400).json({ error: 'Missing target path. 請告訴我要去 TDX 的哪個端點抓資料。' });
    }

    // 從 Vercel 環境變數讀取你的 TDX 雙金鑰 (絕對安全，不會外流)
    const clientId = process.env.TDX_CLIENT_ID;
    const clientSecret = process.env.TDX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
         return res.status(500).json({ error: 'Server configuration error: Missing TDX credentials.' });
    }

    try {
        // ==========================================
        // 🔑 步驟一：向 TDX 警衛室索取 Token (通行證)
        // ==========================================
        const tokenUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'client_credentials');
        tokenParams.append('client_id', clientId);
        tokenParams.append('client_secret', clientSecret);

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        if (!tokenResponse.ok) throw new Error('TDX Token 取得失敗');
        
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // ==========================================
        // 🚄 步驟二：拿著 Token 去抓真正的時刻表資料
        // ==========================================
        const baseUrl = 'https://tdx.transportdata.tw/api/basic';
        
        // 把前端傳過來的其他參數 (例如 OData 的 $format=JSON 或 $filter) 重新打包
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(req.query)) {
            // 排除我們自訂的 'path' 參數，剩下的都原封不動交給 TDX
            if (key !== 'path') {
                queryParams.append(key, value);
            }
        }
        
        const queryString = queryParams.toString();
        // 拼湊出最終要打的 TDX 網址
        const finalUrl = `${baseUrl}${targetPath}${queryString ? '?' + queryString : ''}`;

        // 發送帶有 Authorization 標頭的請求
        const dataResponse = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!dataResponse.ok) throw new Error(`TDX 資料抓取失敗: 狀態碼 ${dataResponse.status}`);

        const targetData = await dataResponse.json();

        // ==========================================
        // 📦 步驟三：把熱騰騰的純淨資料直送前端網頁！
        // ==========================================
        res.status(200).json(targetData);

    } catch (error) {
        console.error('🚇 後端代理發生錯誤:', error);
        res.status(500).json({ error: '代理伺服器連線失敗', details: error.message });
    }
}
