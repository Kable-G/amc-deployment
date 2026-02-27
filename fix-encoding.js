const fs = require('fs');
const path = require('path');

// Read the file as UTF-16 LE (which is what it currently is)
const filePath = path.join(__dirname, 'public', 'AssetDBmenu1.6.html');

try {
    console.log('Reading file as UTF-16 LE...');
    const content = fs.readFileSync(filePath, 'utf16le');
    
    console.log('File size:', content.length, 'characters');
    console.log('First 100 characters:', content.substring(0, 100));
    
    // Check for BENTO markers
    const hasBento = content.includes('bento-box') || content.includes('BENTO_V1');
    console.log('BENTO markers found:', hasBento);
    
    if (hasBento) {
        console.log('Converting to UTF-8...');
        // Write as UTF-8 without BOM
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('✅ File successfully converted to UTF-8');
        
        // Verify the conversion
        const verifyContent = fs.readFileSync(filePath, 'utf8');
        const stillHasBento = verifyContent.includes('bento-box') || verifyContent.includes('BENTO_V1');
        console.log('✅ BENTO markers still present after conversion:', stillHasBento);
        
        // Check first bytes
        const buffer = fs.readFileSync(filePath);
        console.log('First 10 bytes after conversion:', Array.from(buffer.slice(0, 10)).join(', '));
        
    } else {
        console.log('❌ No BENTO markers found in source file');
    }
    
} catch (error) {
    console.error('Error:', error.message);
}