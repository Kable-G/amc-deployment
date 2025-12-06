/**
 * Debug Tracking Systems - Find all places where AMCInteraction records are created
 */

const fs = require('fs');
const path = require('path');

function searchInFile(filePath, searchPattern) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const matches = [];
        
        lines.forEach((line, index) => {
            if (searchPattern.test(line)) {
                matches.push({
                    line: index + 1,
                    content: line.trim(),
                    file: filePath
                });
            }
        });
        
        return matches;
    } catch (error) {
        return [];
    }
}

function searchInDirectory(dirPath, pattern, fileExtension = '.js') {
    const results = [];
    
    function searchRecursive(currentPath) {
        const items = fs.readdirSync(currentPath);
        
        items.forEach(item => {
            const fullPath = path.join(currentPath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                searchRecursive(fullPath);
            } else if (stat.isFile() && item.endsWith(fileExtension)) {
                const matches = searchInFile(fullPath, pattern);
                results.push(...matches);
            }
        });
    }
    
    searchRecursive(dirPath);
    return results;
}

console.log('🔍 Searching for all AMCInteraction creation points...\n');

// Search for AMCInteraction creation patterns
const patterns = [
    /new AMCInteraction\(/,
    /AMCInteraction\.create\(/,
    /\.save\(\)/,
    /interactionType.*asset_download/
];

patterns.forEach((pattern, index) => {
    console.log(`\n📋 Pattern ${index + 1}: ${pattern.source}`);
    console.log('=' .repeat(50));
    
    const matches = searchInDirectory('.', pattern);
    
    if (matches.length === 0) {
        console.log('   No matches found');
    } else {
        matches.forEach(match => {
            console.log(`   ${match.file}:${match.line} - ${match.content}`);
        });
    }
});

console.log('\n🔍 Searching for download tracking middleware usage...\n');

const middlewarePatterns = [
    /universalDownloadTracker/,
    /app\.use.*universalDownloadTracker/,
    /router\.use.*universalDownloadTracker/
];

middlewarePatterns.forEach((pattern, index) => {
    console.log(`\n📋 Middleware Pattern ${index + 1}: ${pattern.source}`);
    console.log('=' .repeat(50));
    
    const matches = searchInDirectory('.', pattern);
    
    if (matches.length === 0) {
        console.log('   No matches found');
    } else {
        matches.forEach(match => {
            console.log(`   ${match.file}:${match.line} - ${match.content}`);
        });
    }
});

console.log('\n✅ Debug search complete!');
console.log('\n📋 Next steps:');
console.log('1. Check if middleware is applied multiple times');
console.log('2. Look for any other AMCInteraction creation points');
console.log('3. Verify no duplicate route handlers exist');