// 🌟 宣告在全域，讓 Vercel 暫存這把鑰匙 (Cold Start 期間有效)
let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetPath = req.query.path;
    if (!targetPath) return res.status(400).json({ error: 'Missing target path.' });

    const clientId = process.env.TDX_CLIENT_ID;
    const clientSecret = process.env.TDX_CLIENT_SECRET;

    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Missing TDX credentials.' });

    try {
        // ==========================================
        // 🔑 步驟一：檢查暫存，沒過期就直接用，省下 2 秒！
        // ==========================================
        if (!cachedToken || Date.now() > tokenExpiry) {
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
            cachedToken = tokenData.access_token;
            // 提早 60 秒判定過期，確保安全
            tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;
        }

        // ==========================================
        // 🚄 步驟二：拿著熱騰騰的 Token 去抓資料
        // ==========================================
        const baseUrl = 'https://tdx.transportdata.tw/api/basic';
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== 'path') queryParams.append(key, value);
        }
        
        const finalUrl = `${baseUrl}${targetPath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

        const dataResponse = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cachedToken}`,
                'Accept': 'application/json'
            }
        });

        if (!dataResponse.ok) throw new Error(`TDX 狀態碼 ${dataResponse.status}`);
        const targetData = await dataResponse.json();

        res.status(200).json(targetData);

    } catch (error) {
        console.error('🚇 後端代理發生錯誤:', error);
        res.status(500).json({ error: '代理伺服器連線失敗', details: error.message });
    }
}
