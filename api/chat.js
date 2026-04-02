export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        return res.status(200).json({ reply: '⚠️ 系統警告：找不到 API Key！請確認 Vercel 有設定 GEMINI_API_KEY 並已重新部署。' });
    }

    const { prompt } = req.body;
    
    // 🌟 核心引擎升級：換上 Gemini 3.0 Flash 晶片
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: `你現在是《末班車生存》Web App 的官方導遊，你說話語氣溫暖、幽默且帶點神祕感。你會協助夜歸的社畜處理焦慮。請簡短回答以下問題：${prompt}` }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.error) {
            return res.status(200).json({ reply: `⚠️ API 拒絕連線：${data.error.message}` });
        }

        const reply = data.candidates[0].content.parts[0].text;
        res.status(200).json({ reply });
    } catch (error) {
        res.status(200).json({ reply: '⚠️ 導遊似乎在隧道裡迷路了 (後端發生例外錯誤)' });
    }
}
