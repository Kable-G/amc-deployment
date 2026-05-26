const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const BrandIntelligenceDoc = require('../models/BrandIntelligenceDoc');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Storage for brand intel docs
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'brand_intel');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, Date.now() + '_' + safe);
    }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Prompts per doc type
const PROMPTS = {
    profile: (brand) => `Extract company profile information from this official ${brand} document.
Return ONLY valid JSON, no markdown. For the description field write a neutral, factual 2-sentence summary in the style of a financial data terminal — no marketing language, no slogans, no adjectives like "bold" or "innovative". State facts: what the company makes, where it operates, key financial metrics.
{"founded":"year","headquarters":"city, country","group":"parent company or Independent","employees":"approximate headcount","markets":"3-5 key global markets","brands":"other brands in portfolio if any","description":"neutral factual 2-sentence description — financial terminal style, no marketing language. State what the company makes, scale of operations, key financial metrics. No slogans, no adjectives.","annualSales":"most recent annual vehicle sales or revenue with year if stated"}`,

    personnel: (brand) => `Extract ONLY current board-level executives from this official ${brand} document.
Do NOT include: drivers, spokespeople, engineers, project managers, historical figures, deceased persons.
Only include: Chairman, CEO, CFO, CTO, COO, board members, Executive Board members.
Return ONLY valid JSON array, no markdown:
[{"name":"full name","role":"exact board title as stated in document","appointedDate":"date if stated or null"}]
Maximum 10 people.`,

    financials: (brand) => `Extract financial and sales data from this official ${brand} press release or financial document.
Return ONLY valid JSON, no markdown:
{"period":"exact reporting period e.g. Q1 2026 or Full Year 2025","revenue":"exact figure with currency e.g. €14.2 billion","units":"exact vehicle deliveries e.g. 360,106 worldwide","profit":"operating profit with margin e.g. €588 million, 4.2% margin","change":"YoY change for deliveries and/or revenue","financialHighlight":"most significant statement — direct quote from document","ceoName":"CEO full name and exact title as stated","ceoQuote":"most quotable CEO statement max 150 chars","topMarket":"strongest or most notable market mentioned","keyPersonnel":["CEO Name - Title","CFO Name - Title"]}`
};

// ── POST /upload — upload and extract intelligence ──
router.post('/upload', auth, upload.single('document'), async (req, res) => {
    try {
        const { brand, docType } = req.body;
        if (!brand || !docType) return res.status(400).json({ success: false, error: 'Brand and docType required' });
        if (!['profile', 'personnel', 'financials'].includes(docType)) {
            return res.status(400).json({ success: false, error: 'Invalid docType' });
        }
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        // Create doc record immediately
        const doc = await BrandIntelligenceDoc.findOneAndUpdate(
            { brand, docType },
            {
                brand, docType,
                filePath: `/uploads/brand_intel/${req.file.filename}`,
                originalName: req.file.originalname,
                status: 'processing',
                uploadedAt: new Date(),
                uploadedBy: req.user?.id
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: 'Processing...', docId: doc._id });

        // Extract in background
        setImmediate(async () => {
            try {
                // Extract PDF text
                const pdf = require('pdf-parse');
                const buf = fs.readFileSync(req.file.path);
                const pdfData = await pdf(buf);
                const text = pdfData.text.replace(/\s+/g, ' ').trim();

                const prompt = PROMPTS[docType](brand) + '\n\nDOCUMENT:\n' + text.substring(0, 8000);

                const message = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: prompt }]
                });

                const responseText = message.content?.find(c => c.type === 'text')?.text || '';
                const clean = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const match = clean.match(/[\[\{][\s\S]*[\]\}]/);
                if (!match) throw new Error('No JSON in response');
                const intel = JSON.parse(match[0]);

                // Normalise personnel arrays
                if (docType === 'personnel' && Array.isArray(intel)) {
                    const personnel = intel.map(p =>
                        typeof p === 'object' ? `${p.name} - ${p.role}${p.appointedDate ? ' (from ' + p.appointedDate + ')' : ''}` : String(p)
                    );
                    await BrandIntelligenceDoc.findByIdAndUpdate(doc._id, {
                        intelligence: { personnel },
                        status: 'active'
                    });
                } else {
                    await BrandIntelligenceDoc.findByIdAndUpdate(doc._id, {
                        intelligence: intel,
                        status: 'active'
                    });
                }

                // Also clear BrandIntelligenceCache for this brand so it regenerates
                const BrandIntelligenceCache = require('../models/BrandIntelligenceCache');
                await BrandIntelligenceCache.deleteMany({ brand, type: docType });

                console.log(`✅ Brand Intel: ${docType} extracted for ${brand}`);
            } catch(err) {
                console.error(`❌ Brand Intel extraction failed for ${brand}/${docType}:`, err.message);
                await BrandIntelligenceDoc.findByIdAndUpdate(doc._id, {
                    status: 'error', errorMessage: err.message
                });
            }
        });

    } catch(err) {
        console.error('Brand intel upload error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /ticker — save stock ticker for a brand ──
router.post('/ticker', auth, async (req, res) => {
    try {
        const { brand, symbol, name, exchange } = req.body;
        if (!brand || !symbol) return res.status(400).json({ success: false, error: 'Brand and symbol required' });

        await BrandIntelligenceDoc.findOneAndUpdate(
            { brand, docType: 'stock' },
            { brand, docType: 'stock', intelligence: { symbol, name, exchange }, status: 'active', uploadedAt: new Date() },
            { upsert: true, new: true }
        );

        // Clear BrandIntelligenceCache
        const BrandIntelligenceCache = require('../models/BrandIntelligenceCache');
        await BrandIntelligenceCache.deleteMany({ brand, type: 'stock' });

        res.json({ success: true, message: `Ticker ${symbol} saved for ${brand}` });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /status/:brand — get upload status for all four panels ──
router.get('/status/:brand', auth, async (req, res) => {
    try {
        const brand = req.params.brand;
        const docs = await BrandIntelligenceDoc.find({ brand: { $regex: new RegExp('^' + brand + '$', 'i') } }).lean();
        const statusMap = {};
        docs.forEach(d => {
            statusMap[d.docType] = {
                status: d.status,
                uploadedAt: d.uploadedAt,
                originalName: d.originalName,
                intelligence: d.status === 'active' ? d.intelligence : null
            };
        });
        res.json({ success: true, data: statusMap });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /ticker/:brand — get saved ticker
router.get('/ticker/:brand', async (req, res) => {
    try {
        const doc = await BrandIntelligenceDoc.findOne({
            brand: { $regex: new RegExp(req.params.brand, 'i') },
            docType: 'stock',
            status: 'active'
        }).lean();
        if (doc && doc.intelligence) {
            return res.json({ success: true, data: doc.intelligence });
        }
        res.json({ success: true, data: null });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
