"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWithGemini = extractWithGemini;
exports.transcribeWithWhisper = transcribeWithWhisper;
async function extractWithGemini(transcript, columns, apiKey) {
    const fieldList = columns.map((c) => `${c.key} (${c.label})`).join(', ');
    const prompt = `Extract student form fields from this spoken transcript. Return ONLY valid JSON object with keys: ${columns.map((c) => c.key).join(', ')}. Use empty string for missing fields. Transcript: "${transcript}"`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errText.slice(0, 200)}`);
    }
    const data = (await response.json());
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text);
    const result = {};
    for (const column of columns) {
        const value = parsed[column.key];
        if (value != null && String(value).trim()) {
            result[column.key] = String(value).trim();
        }
    }
    if (Object.keys(result).length === 0 && fieldList) {
        throw new Error('Gemini returned no fields');
    }
    return result;
}
async function transcribeWithWhisper(buffer, filename, apiKey) {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)]);
    formData.append('file', blob, filename || 'audio.webm');
    formData.append('model', 'whisper-1');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Whisper API error: ${response.status} ${errText.slice(0, 200)}`);
    }
    const data = (await response.json());
    return data.text?.trim() ?? '';
}
