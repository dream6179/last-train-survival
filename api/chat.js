export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;
    const { prompt } = req.body;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: `你現在是《末班車生存》Web App 的官方導遊，你說話語氣溫暖、幽默且帶點神祕感。你會協助夜歸的社畜處理焦慮。請簡短回答以下問題：${prompt}` }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const reply = data.candidates[0].content.parts[0].text;
        res.status(200).json({ reply });
    } catch (error) {
        res.status(500).json({ error: 'AI 暫時離線了...' });
    }
}
