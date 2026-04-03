// 處理 OPTIONS 預檢請求 (跨網域呼叫 POST 時必須)
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}

// 針對 POST 請求的處理邏輯
export async function onRequestPost(context) {
    const { request, env } = context;

    // 準備好 CORS 標頭，確保前端不會被瀏覽器擋下來
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 🔑 差異 1：從 env 抓取金鑰
    const apiKey = env.GEMINI_API_KEY;
    
    if (!apiKey) {
        // 幫你把錯誤訊息裡的 Vercel 字眼改成 Cloudflare 囉
        return Response.json(
            { reply: '⚠️ 系統警告：找不到 API Key！請確認 Cloudflare 有設定 GEMINI_API_KEY 並已重新部署。' },
            { status: 200, headers: corsHeaders }
        );
    }

    try {
        // 📦 差異 2：解析前端 POST 過來的 JSON Body
        const body = await request.json();
        const prompt = body.prompt;
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [{ text: `你是一個聰明、幽默且有禮貌的 AI 夥伴。請務必使用「繁體中文」來回答，語氣要自然、溫暖、像個可靠的好朋友。以下是我的話：\n\n${prompt}` }]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.error) {
            // 📦 差異 3：回傳時都要用 Response.json() 並帶上 CORS 標頭
            return Response.json(
                { reply: `⚠️ API 拒絕連線：${data.error.message}` },
                { status: 200, headers: corsHeaders }
            );
        }

        const reply = data.candidates[0].content.parts[0].text;
        
        return Response.json(
            { reply },
            { status: 200, headers: corsHeaders }
        );
        
    } catch (error) {
        console.error('聊天後端例外錯誤:', error);
        return Response.json(
            { reply: '⚠️ 導遊似乎在隧道裡迷路了 (後端發生例外錯誤)' },
            { status: 200, headers: corsHeaders }
        );
    }
}
