export default async function handler(req, res) {
    // 交通部的警衛室網址
    const tokenUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';

    // 🌟 這裡最關鍵：我們不把密碼寫死，而是讓程式去讀取 Vercel 的「環境變數」
    const clientId = process.env.TDX_CLIENT_ID;
    const clientSecret = process.env.TDX_CLIENT_SECRET;

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: params
        });
        
        const data = await response.json();
        
        // 黑衣人順利拿到通行證，轉交給我們的前端網頁
        res.status(200).json(data);
    } catch (error) {
        // 如果失敗了，回報錯誤
        res.status(500).json({ error: 'Failed to fetch TDX token' });
    }
}
