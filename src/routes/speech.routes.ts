import { Router } from 'express';
import multer from 'multer';
import { AuthRequest, authMiddleware } from '../middleware/auth.middleware';
import { extractWithGemini, transcribeWithWhisper } from '../services/speech.service';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();

router.use(authMiddleware);

router.post('/gemini-extract', async (req: AuthRequest, res) => {
  const { transcript, apiKey, columns } = req.body as {
    transcript?: string;
    apiKey?: string;
    columns?: { key: string; label: string }[];
  };

  if (!transcript?.trim()) {
    res.status(400).json({ error: 'transcript is required' });
    return;
  }
  if (!apiKey?.trim()) {
    res.status(400).json({ error: 'Gemini API key is required' });
    return;
  }

  try {
    const fields = await extractWithGemini(transcript, columns ?? [], apiKey);
    res.json({ fields });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gemini extraction failed',
    });
  }
});

router.post('/whisper', upload.single('audio'), async (req: AuthRequest, res) => {
  const apiKey = (req.body as { apiKey?: string }).apiKey;
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
    const transcript = await transcribeWithWhisper(file.buffer, file.originalname, apiKey);
    res.json({ transcript });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Whisper transcription failed',
    });
  }
});

export default router;
