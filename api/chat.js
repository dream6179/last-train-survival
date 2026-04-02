export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        return res.status(200).json({ reply: '⚠️ 系統警告：找不到 API Key！請確認 Vercel 有設定 GEMINI_API_KEY 並已重新部署。' });
    }

    const { prompt } = req.body;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;


            const payload = {
        contents: [{
            parts: [{ text: `你是一個聰明、幽默、懂台灣網路迷因的 AI 夥伴。請務必使用「繁體中文（台灣習慣用語）」來跟我聊天，就像老朋友一樣自然即可。以下是我的話：\n\n${prompt}` }]
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
