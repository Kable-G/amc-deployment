const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'AssetDBmenu1.6.html');

console.log('Testing different encodings...');

const encodings = ['utf8', 'utf16le', 'ascii', 'latin1', 'ucs2'];

for (const encoding of encodings) {
    try {
        console.log(`\n--- Testing ${encoding} ---`);
        const content = fs.readFileSync(filePath, encoding);
        const first100 = content.substring(0, 100);
        console.log('First 100 chars:', first100);
        console.log('Looks like HTML?', first100.includes('<!DOCTYPE') || first100.includes('<html'));
        console.log('Has BENTO?', content.includes('bento-box'));
        
        if (first100.includes('<!DOCTYPE') || first100.includes('<html')) {
            console.log('✅ This encoding looks correct!');
            break;
        }
    } catch (error) {
        console.log('Error with', encoding, ':', error.message);
    }
}

// Also check raw bytes
console.log('\n--- Raw bytes (first 20) ---');
const buffer = fs.readFileSync(filePath);
console.log('Bytes:', Array.from(buffer.slice(0, 20)).join(', '));