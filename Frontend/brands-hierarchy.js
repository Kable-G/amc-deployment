/**
 * Brand Hierarchy Configuration
 * Provides TWO formats for compatibility:
 * 1. BRAND_HIERARCHY (object) - for content-settings.html
 * 2. BRAND_HIERARCHY_ARRAY (array) - for content-filtering-system.js
 */

// OBJECT FORMAT (for content-settings.html)
window.BRAND_HIERARCHY = {
    "BMW Group": {
        brands: ["BMW", "BMW M", "MINI", "Rolls-Royce", "BMW Motorrad"],
        displayOrder: 1
    },
    "Volkswagen Group": {
        brands: ["Volkswagen", "Audi", "Porsche", "Lamborghini", "Bentley", "SEAT", "ŠKODA", "Ducati", "Bugatti", "Cupra"],
        displayOrder: 2
    },
    "Mercedes-Benz Group": {
        brands: ["Mercedes-Benz", "Mercedes-AMG", "Maybach", "smart"],
        displayOrder: 3
    },
    "Stellantis": {
        brands: ["Peugeot", "Citroën", "DS Automobiles", "Opel", "Vauxhall", "Fiat", "Alfa Romeo", "Lancia", "Jeep", "Ram", "Dodge", "Chrysler", "Maserati", "Abarth"],
        displayOrder: 4
    },
    "Renault Group": {
        brands: ["Renault", "Dacia", "Alpine", "Nissan", "Infiniti", "Mitsubishi"],
        displayOrder: 5
    },
    "General Motors": {
        brands: ["Chevrolet", "GMC", "Cadillac", "Buick"],
        displayOrder: 6
    },
    "Ford Motor Company": {
        brands: ["Ford", "Lincoln"],
        displayOrder: 7
    },
    "Hyundai Motor Group": {
        brands: ["Hyundai", "Kia", "Genesis"],
        displayOrder: 8
    },
    "Toyota Motor Corporation": {
        brands: ["Toyota", "Lexus", "Daihatsu", "Hino"],
        displayOrder: 9
    },
    "Honda Motor Company": {
        brands: ["Honda", "Acura"],
        displayOrder: 10
    },
    "Nissan Motor Corporation": {
        brands: ["Nissan", "Infiniti", "Datsun"],
        displayOrder: 11
    },
    "Mazda Motor Corporation": {
        brands: ["Mazda"],
        displayOrder: 12
    },
    "Suzuki Motor Corporation": {
        brands: ["Suzuki"],
        displayOrder: 13
    },
    "Subaru Corporation": {
        brands: ["Subaru"],
        displayOrder: 14
    },
    "Mitsubishi Motors": {
        brands: ["Mitsubishi"],
        displayOrder: 15
    },
    "Jaguar Land Rover": {
        brands: ["Jaguar", "Land Rover", "Range Rover"],
        displayOrder: 16
    },
    "Volvo Car Corporation": {
        brands: ["Volvo", "Polestar"],
        displayOrder: 17
    },
    "Geely Auto Group": {
        brands: ["Geely", "Lynk & Co", "Zeekr", "LEVC", "Lotus", "Proton"],
        displayOrder: 18
    },
    "SAIC Motor": {
        brands: ["MG Motor", "Roewe", "Maxus"],
        displayOrder: 19
    },
    "BYD Auto": {
        brands: ["BYD"],
        displayOrder: 20
    },
    "Tesla Inc.": {
        brands: ["Tesla"],
        displayOrder: 21
    },
    "Ferrari S.p.A": {
        brands: ["Ferrari"],
        displayOrder: 22
    },
    "McLaren Automotive": {
        brands: ["McLaren"],
        displayOrder: 23
    },
    "Aston Martin Lagonda": {
        brands: ["Aston Martin"],
        displayOrder: 24
    },
    "Koenigsegg Automotive": {
        brands: ["Koenigsegg"],
        displayOrder: 25
    },
    "Pagani Automobili": {
        brands: ["Pagani"],
        displayOrder: 26
    },
    "Rimac Automobili": {
        brands: ["Rimac"],
        displayOrder: 27
    },
    "Lucid Motors": {
        brands: ["Lucid"],
        displayOrder: 28
    },
    "Rivian Automotive": {
        brands: ["Rivian"],
        displayOrder: 29
    },
    "Polestar Automotive": {
        brands: ["Polestar"],
        displayOrder: 30
    },
    "NIO Inc.": {
        brands: ["NIO"],
        displayOrder: 31
    },
    "XPeng Motors": {
        brands: ["XPeng"],
        displayOrder: 32
    },
    "Li Auto": {
        brands: ["Li Auto"],
        displayOrder: 33
    },
    "Great Wall Motors": {
        brands: ["Great Wall", "Haval", "WEY", "ORA", "Tank"],
        displayOrder: 34
    },
    "Chery Automobile": {
        brands: ["Chery", "Exeed"],
        displayOrder: 35
    },
    "Tata Motors": {
        brands: ["Tata"],
        displayOrder: 36
    },
    "Mahindra & Mahindra": {
        brands: ["Mahindra"],
        displayOrder: 37
    }
};

// ARRAY FORMAT (for content-filtering-system.js)
// Convert the object to array format
window.BRAND_HIERARCHY_ARRAY = Object.entries(window.BRAND_HIERARCHY).map(function(entry) {
    return {
        company: entry[0],
        brands: entry[1].brands
    };
});

console.log('✅ BRAND_HIERARCHY loaded with ' + Object.keys(window.BRAND_HIERARCHY).length + ' companies (object + array formats)');

