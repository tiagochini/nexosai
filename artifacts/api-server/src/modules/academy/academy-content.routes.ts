import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, academyPurchasesTable } from '@workspace/db';
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
  res.setHeader('Vary', 'Authorization, X-Academy-Access-Code');
  if (req.headers.authorization) {
    const allowed = await checkAcademyAdmin(req, res);
    if (allowed) res.locals.academyLicense = { name: 'Administrador NexOS', email: req.auth?.userId ?? '' };
    return allowed;
  }
  const code = req.headers['x-academy-access-code'];
  if (typeof code !== 'string' || !/^[A-Z0-9-]{8,64}$/.test(code)) {
    res.status(401).json({ error: 'Active Academy access required' }); return false;
  }
  const [purchase] = await db.select({ status: academyPurchasesTable.status, productId: academyPurchasesTable.productId,
    revokedAt: academyPurchasesTable.revokedAt, financialHold: academyPurchasesTable.financialHold,
    name: academyPurchasesTable.customerName, email: academyPurchasesTable.customerEmail })
    .from(academyPurchasesTable).where(eq(academyPurchasesTable.accessToken, code)).limit(1);
  if (!purchase || purchase.status !== 'confirmed' || purchase.revokedAt || purchase.financialHold ||
      !(purchase.productId === 'complete-bundle' || (product === 'mini-guide' && purchase.productId === 'mini-guide'))) {
    res.status(403).json({ error: 'Active product access required' }); return false;
  }
  res.locals.academyLicense = { name: purchase.name, email: purchase.email };
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
