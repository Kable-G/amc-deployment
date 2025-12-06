// SMART UNIFIED SEARCH - handles cities and countries correctly
function performSmartSearch(query) {
    const lowerQuery = query.toLowerCase().trim();
    console.log('Smart search for:', lowerQuery);
    
    // Alpha-3 country code mappings (EXACT matches only)
    const alpha3Countries = {
        'usa': 'United States',
        'gbr': 'United Kingdom', 
        'aus': 'Australia',
        'ger': 'Germany',
        'deu': 'Germany',
        'fra': 'France',
        'can': 'Canada',
        'jpn': 'Japan',
        'chn': 'China',
        'ind': 'India',
        'bra': 'Brazil',
        'rus': 'Russia',
        'ita': 'Italy',
        'esp': 'Spain',
        'nld': 'Netherlands',
        'che': 'Switzerland',
        'swe': 'Sweden',
        'nor': 'Norway',
        'dnk': 'Denmark',
        'fin': 'Finland',
        'bel': 'Belgium',
        'aut': 'Austria',
        'pol': 'Poland',
        'cze': 'Czech Republic',
        'hun': 'Hungary',
        'prt': 'Portugal',
        'grc': 'Greece',
        'tur': 'Turkey',
        'kor': 'South Korea',
        'mex': 'Mexico',
        'arg': 'Argentina',
        'zaf': 'South Africa',
        'nzl': 'New Zealand',
        'sgp': 'Singapore',
        'hkg': 'Hong Kong',
        'isr': 'Israel',
        'are': 'United Arab Emirates',
        'sau': 'Saudi Arabia',
        'egy': 'Egypt',
        'tha': 'Thailand',
        'mys': 'Malaysia',
        'idn': 'Indonesia',
        'phl': 'Philippines',
        'vnm': 'Vietnam',
        'chl': 'Chile',
        'col': 'Colombia'
    };
    
    let results = [];
    
    // 1. EXACT Alpha-3 country code match (highest priority)
    // This is the key fix: USA → United States → show ONLY US cities
    if (alpha3Countries[lowerQuery]) {
        const countryName = alpha3Countries[lowerQuery];
        console.log('Alpha-3 match found:', lowerQuery, '→', countryName);
        
        // Find ONLY cities in this specific country
        const citiesInCountry = globalTimezoneDatabase.filter(city => 
            city.country === countryName  // EXACT country match only
        );
        
        if (citiesInCountry.length > 0) {
            return [{  // Return ONLY this country's cities
                type: 'country',
                country: countryName,
                flag: citiesInCountry[0].flag,
                cities: citiesInCountry.slice(0, 8) // Show up to 8 cities
            }];
        }
    }
    
    // 2. City name prefix matches (only if not an Alpha-3 code)
    const cityMatches = globalTimezoneDatabase.filter(city =>
        city.name.toLowerCase().startsWith(lowerQuery)
    ).slice(0, 8);
    
    // 3. Country name prefix matches (for partial country names like "United")
    const countryNameMatches = [];
    for (const [code, countryName] of Object.entries(alpha3Countries)) {
        if (countryName.toLowerCase().includes(lowerQuery)) {
            const citiesInCountry = globalTimezoneDatabase.filter(city => 
                city.country === countryName
            );
            if (citiesInCountry.length > 0) {
                countryNameMatches.push({
                    type: 'country',
                    country: countryName,
                    flag: citiesInCountry[0].flag,
                    cities: citiesInCountry.slice(0, 8)
                });
            }
        }
    }
    
    // Combine results: cities first, then country matches
    results = cityMatches.concat(countryNameMatches.slice(0, 3));
    
    console.log('Smart search returning:', results.length, 'results');
    return results;
}

/* 
KEY FIX EXPLAINED:

1. When you type "USA": 
   - It matches alpha3Countries['usa'] → 'United States'
   - It filters globalTimezoneDatabase for cities where city.country === 'United States'
   - It returns ONLY US cities (New York, Los Angeles, Chicago, etc.)
   - It will NEVER return Russian cities or any other countries

2. When you type "AUS":
   - It matches alpha3Countries['aus'] → 'Australia' 
   - It returns ONLY Australian cities (Sydney, Melbourne, Perth, etc.)

3. When you type "Austin":
   - No Alpha-3 match, so it does city name search
   - Returns Austin, Texas as a city match

This completely eliminates the substring search problem that was showing Russian cities when you typed "USA".
*/