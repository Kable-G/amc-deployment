require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL).then(async () => {
  const CenterRelease = require('./models/CenterRelease');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Get all Porsche releases with PDFs
  const releases = await CenterRelease.find({
    brand: /porsche/i,
    'releaseDocs.0': { $exists: true }
  }).lean();

  console.log(`Found ${releases.length} Porsche releases with docs`);

  const toStr = arr => (arr||[]).map(x => typeof x === 'object' ? ((x.name||'') + (x.title||x.role ? ' - '+(x.title||x.role) : '')) : String(x)).filter(Boolean);

  for (const release of releases) {
    try {
      const pdfDoc = release.releaseDocs.find(d => d.mimetype === 'application/pdf');
      if (!pdfDoc) { console.log('SKIP (no PDF):', release.title.substring(0,50)); continue; }

      const pdfPath = path.join(__dirname, 'public', pdfDoc.path);
      if (!fs.existsSync(pdfPath)) { console.log('SKIP (file missing):', release.title.substring(0,50)); continue; }

      // Extract text
      const pdf = require('pdf-parse');
      const buf = fs.readFileSync(pdfPath);
      const pdfData = await pdf(buf);
      const text = pdfData.text.replace(/\s+/g, ' ').trim();

      const prompt = 'Analyse this Porsche press release and return structured JSON.\nTitle: ' + release.title + '\nDate: ' + new Date(release.releaseDate).toLocaleDateString('en-GB') + '\nDOCUMENT:\n' + text.substring(0, 6000) + '\n\nReturn ONLY valid JSON (keyPersonnel as "Name - Role" strings):\n{"mrisScore":0,"mrisTier":"","releaseType":"","period":null,"units":null,"revenue":null,"profit":null,"change":null,"financialHighlight":null,"ceoName":null,"ceoQuote":null,"keyPersonnel":[],"topMarket":null,"technologySignals":[],"riskFlags":[],"storyAngles":[],"headlineSuggestions":[]}';

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });

      const text2 = message.content?.find(c => c.type === 'text')?.text || '';
      const clean = text2.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      const intel = JSON.parse(clean);

      intel.keyPersonnel = toStr(intel.keyPersonnel);
      intel.technologySignals = toStr(intel.technologySignals);
      intel.riskFlags = toStr(intel.riskFlags);
      intel.storyAngles = toStr(intel.storyAngles);
      intel.headlineSuggestions = toStr(intel.headlineSuggestions);

      await CenterRelease.findByIdAndUpdate(release._id, {
        intelligence: { ...intel, extractedAt: new Date(), extractionMethod: 'batch' },
        intelligenceExtracted: true
      });

      console.log(`✅ ${intel.releaseType.padEnd(12)} | Score:${intel.mrisScore} | ${intel.keyPersonnel.join(', ').substring(0,40)} | ${release.title.substring(0,45)}`);

    } catch(e) {
      console.log(`❌ ${release.title.substring(0,50)}: ${e.message.substring(0,60)}`);
    }
  }

  console.log('\nBatch complete.');
  process.exit(0);
});
