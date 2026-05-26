require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL).then(async () => {
  const CenterRelease = require('./models/CenterRelease');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const release = await CenterRelease.findOne({ title: /porsche delivers 279/i });
  console.log('Running MRIS on:', release.title);
  const pdfText = release.extractedPdfText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('PDF text length:', pdfText.length);

  const prompt = 'You are the AMC Intelligence Extraction Agent. Analyse this press release.\n\nBrand: ' + release.brand + '\nTitle: ' + release.title + '\n\nDOCUMENT:\n' + pdfText.substring(0, 6000) + '\n\nReturn ONLY valid JSON with these exact string fields (keyPersonnel as strings like "Name - Role"):\n{"mrisScore":75,"mrisTier":"Good","releaseType":"sales","period":"Full Year 2025","units":"279,449 worldwide","revenue":null,"profit":null,"change":"-10%","financialHighlight":"quote here","ceoName":"name","ceoQuote":"quote","keyPersonnel":["Name - Role"],"topMarket":"North America","technologySignals":["signal"],"riskFlags":["flag"],"storyAngles":["angle1","angle2","angle3"],"headlineSuggestions":["h1","h2","h3"]}';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = message.content?.find(c => c.type === 'text')?.text || '';
  console.log('Response length:', text.length);
  const clean = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  
  let intel;
  try { intel = JSON.parse(clean); }
  catch(e) { console.error('JSON parse failed:', e.message); console.log('Raw:', text.substring(0,500)); process.exit(1); }

  const toStr = arr => (arr||[]).map(x => typeof x === 'object' ? ((x.name||x.signal||x.angle||'') + (x.title||x.role ? ' - '+(x.title||x.role) : '')) : String(x)).filter(Boolean);
  intel.keyPersonnel = toStr(intel.keyPersonnel);
  intel.technologySignals = toStr(intel.technologySignals);
  intel.riskFlags = toStr(intel.riskFlags);
  intel.storyAngles = toStr(intel.storyAngles);
  intel.headlineSuggestions = toStr(intel.headlineSuggestions);

  await CenterRelease.findByIdAndUpdate(release._id, {
    intelligence: { ...intel, extractedAt: new Date(), extractionMethod: 'manual-trigger' },
    intelligenceExtracted: true
  });

  console.log("\n✅ MRIS COMPLETE");
  console.log("Score:", intel.mrisScore, "|", intel.mrisTier);
  console.log("Units:", intel.units);
  console.log("Change:", intel.change);
  console.log("Highlight:", (intel.financialHighlight||'').substring(0,100));
  console.log("Personnel:", intel.keyPersonnel);
  console.log("Angles:", intel.storyAngles);
  console.log("Headlines:", intel.headlineSuggestions);
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });
