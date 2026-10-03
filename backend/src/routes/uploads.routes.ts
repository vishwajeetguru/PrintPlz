import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env';
import { auth } from '../middleware/auth';

const router = Router();

const dir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|jpg|jpeg|png|docx)$/i.test(file.originalname);
    cb(null, ok);
  },
});

// POST /api/uploads (authed; returns fileUrl + meta for request creation)
router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file (pdf/jpg/png/docx)' });
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.status(201).json({
    fileUrl,
    documentName: req.file.originalname,
    fileSizeBytes: req.file.size,
  });
});

export default router;
