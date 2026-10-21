import { authorizeStudentProduct } from "./academy-student-session.js";
import { Router, type Request, type Response } from 'express';
import { checkAcademyAdmin } from './academy-admin.security.js';
import { createAcademyVerificationLimiter } from './academy-verification.security.js';
import { CURRICULUM } from './content/curriculum.js';
import { MINI_GUIDE_HTML } from './content/mini-guide.js';
import { GLOSSARY } from './content/glossary.js';
import { BIBLIOGRAPHY } from './content/bibliography.js';
import { generateMiniGuidePDF } from './content/mini-guide-pdf.js';

const router = Router();
const limiter = createAcademyVerificationLimiter([], { scope: 'content' });
async function authorize(req: Request, res: Response, product: 'mini-guide' | 'complete-bundle') {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie, Authorization');
  if (req.headers.authorization) {
    const allowed = await checkAcademyAdmin(req, res);
    if (allowed) res.locals.academyLicense = { name: 'Administrador NexOS', email: req.auth?.userId ?? '' };
    return allowed;
  }
  const student = await authorizeStudentProduct(req, res, product);
  if (!student) return false;
  res.locals.academyLicense = { name: student.name, email: student.email };
  return true;
}
router.get('/course', limiter, async (req, res) => {
  if (!await authorize(req, res, 'complete-bundle')) return;
  res.json({ curriculum: CURRICULUM, glossary: GLOSSARY, bibliography: BIBLIOGRAPHY });
});
router.get('/mini-guide', limiter, async (req, res) => {
  if (!await authorize(req, res, 'mini-guide')) return;
  res.json({ html: MINI_GUIDE_HTML });
});
router.get('/mini-guide.pdf', limiter, async (req, res) => {
  if (!await authorize(req, res, 'mini-guide')) return;
  const { name, email } = res.locals.academyLicense;
  const pdf = await generateMiniGuidePDF(name, email);
  res.setHeader('Content-Disposition', 'attachment; filename="nexos-mini-guide.pdf"');
  res.type('application/pdf').send(pdf);
});
export default router;
