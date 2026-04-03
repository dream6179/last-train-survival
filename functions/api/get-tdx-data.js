// 🌟 宣告在全域，讓 Cloudflare 節點暫存這把鑰匙 (同一節點有效)
let cachedToken = null;
let tokenExpiry = 0;

// 🔄 改用 Cloudflare 的標準起手式 onRequest
export async function onRequest(context) {
    // 從 context 拿出 request (請求資訊) 和 env (環境變數)
    const { request, env } = context;
    const url = new URL(request.url);

    // 準備好 CORS 標頭，Cloudflare 需要在回傳時帶上
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 處理 OPTIONS 預檢請求
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // 🔍 差異 1：Cloudflare 從 URL 抓取 query 參數
    const targetPath = url.searchParams.get('path');
    if (!targetPath) {
        return Response.json({ error: 'Missing target path.' }, { status: 400, headers: corsHeaders });
    }

    // 🔑 差異 2：Cloudflare 的金鑰藏在 env 裡，而不是 process.env
    const clientId = env.TDX_CLIENT_ID;
    const clientSecret = env.TDX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return Response.json({ error: 'Missing TDX credentials.' }, { status: 500, headers: corsHeaders });
    }

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
        
        // 🔍 差異 3：複製所有的 query 參數，然後移除 'path'，剩下的串給 TDX
        const queryParams = new URLSearchParams(url.searchParams);
        queryParams.delete('path');
        
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

        // 📦 差異 4：Cloudflare 使用 Response.json() 來回傳資料
        return Response.json(targetData, { status: 200, headers: corsHeaders });

    } catch (error) {
        console.error('🚇 後端代理發生錯誤:', error);
        return Response.json({ error: '代理伺服器連線失敗', details: error.message }, { status: 500, headers: corsHeaders });
    }
}
