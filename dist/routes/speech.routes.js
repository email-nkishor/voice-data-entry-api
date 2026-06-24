"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const speech_service_1 = require("../services/speech.service");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.post('/gemini-extract', async (req, res) => {
    const { transcript, apiKey, columns } = req.body;
    if (!transcript?.trim()) {
        res.status(400).json({ error: 'transcript is required' });
        return;
    }
    if (!apiKey?.trim()) {
        res.status(400).json({ error: 'Gemini API key is required' });
        return;
    }
    try {
        const fields = await (0, speech_service_1.extractWithGemini)(transcript, columns ?? [], apiKey);
        res.json({ fields });
    }
    catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : 'Gemini extraction failed',
        });
    }
});
router.post('/whisper', upload.single('audio'), async (req, res) => {
    const apiKey = req.body.apiKey;
    const file = req.file;
    if (!apiKey?.trim()) {
        res.status(400).json({ error: 'OpenAI API key is required' });
        return;
    }
    if (!file) {
        res.status(400).json({ error: 'audio file is required' });
        return;
    }
    try {
        const transcript = await (0, speech_service_1.transcribeWithWhisper)(file.buffer, file.originalname, apiKey);
        res.json({ transcript });
    }
    catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : 'Whisper transcription failed',
        });
    }
});
exports.default = router;
