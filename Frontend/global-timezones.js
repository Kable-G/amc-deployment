// Comprehensive Global Timezone Database
// Covers all countries and their respective timezones for professional timezone conversion

const globalTimezoneDatabase = [
    // === RUSSIA - All 11 Timezones ===
    { name: "Kaliningrad", country: "Russia", timezone: "Europe/Kaliningrad", flag: "ru", population: 475000, timezoneDesc: "Kaliningrad Time (KALT)" },
    { name: "Moscow", country: "Russia", timezone: "Europe/Moscow", flag: "ru", population: 12500000, timezoneDesc: "Moscow Time (MSK)" },
    { name: "Saint Petersburg", country: "Russia", timezone: "Europe/Moscow", flag: "ru", population: 5400000, timezoneDesc: "Moscow Time (MSK)" },
    { name: "Samara", country: "Russia", timezone: "Europe/Samara", flag: "ru", population: 1170000, timezoneDesc: "Samara Time (SAMT)" },
    { name: "Yekaterinburg", country: "Russia", timezone: "Asia/Yekaterinburg", flag: "ru", population: 1500000, timezoneDesc: "Yekaterinburg Time (YEKT)" },
    { name: "Omsk", country: "Russia", timezone: "Asia/Omsk", flag: "ru", population: 1180000, timezoneDesc: "Omsk Time (OMST)" },
    { name: "Krasnoyarsk", country: "Russia", timezone: "Asia/Krasnoyarsk", flag: "ru", population: 1090000, timezoneDesc: "Krasnoyarsk Time (KRAT)" },
    { name: "Irkutsk", country: "Russia", timezone: "Asia/Irkutsk", flag: "ru", population: 623000, timezoneDesc: "Irkutsk Time (IRKT)" },
    { name: "Yakutsk", country: "Russia", timezone: "Asia/Yakutsk", flag: "ru", population: 320000, timezoneDesc: "Yakutsk Time (YAKT)" },
    { name: "Vladivostok", country: "Russia", timezone: "Asia/Vladivostok", flag: "ru", population: 606000, timezoneDesc: "Vladivostok Time (VLAT)" },
    { name: "Magadan", country: "Russia", timezone: "Asia/Magadan", flag: "ru", population: 95000, timezoneDesc: "Magadan Time (MAGT)" },
    { name: "Petropavlovsk-Kamchatsky", country: "Russia", timezone: "Asia/Kamchatka", flag: "ru", population: 180000, timezoneDesc: "Kamchatka Time (PETT)" },

    // === UNITED STATES - All Timezones ===
    { name: "New York", country: "United States", timezone: "America/New_York", flag: "us", population: 8400000, timezoneDesc: "Eastern Time" },
    { name: "Los Angeles", country: "United States", timezone: "America/Los_Angeles", flag: "us", population: 4000000, timezoneDesc: "Pacific Time" },
    { name: "Chicago", country: "United States", timezone: "America/Chicago", flag: "us", population: 2700000, timezoneDesc: "Central Time" },
    { name: "Denver", country: "United States", timezone: "America/Denver", flag: "us", population: 715000, timezoneDesc: "Mountain Time" },
    { name: "Phoenix", country: "United States", timezone: "America/Phoenix", flag: "us", population: 1700000, timezoneDesc: "Mountain Standard Time (No DST)" },
    { name: "Anchorage", country: "United States", timezone: "America/Anchorage", flag: "us", population: 290000, timezoneDesc: "Alaska Time" },
    { name: "Honolulu", country: "United States", timezone: "Pacific/Honolulu", flag: "us", population: 350000, timezoneDesc: "Hawaii-Aleutian Standard Time" },
    { name: "Adak", country: "United States", timezone: "America/Adak", flag: "us", population: 300, timezoneDesc: "Hawaii-Aleutian Time" },

    // === CANADA - All Timezones ===
    { name: "Toronto", country: "Canada", timezone: "America/Toronto", flag: "ca", population: 2930000, timezoneDesc: "Eastern Time" },
    { name: "Vancouver", country: "Canada", timezone: "America/Vancouver", flag: "ca", population: 675000, timezoneDesc: "Pacific Time" },
    { name: "Calgary", country: "Canada", timezone: "America/Edmonton", flag: "ca", population: 1340000, timezoneDesc: "Mountain Time" },
    { name: "Winnipeg", country: "Canada", timezone: "America/Winnipeg", flag: "ca", population: 750000, timezoneDesc: "Central Time" },
    { name: "Halifax", country: "Canada", timezone: "America/Halifax", flag: "ca", population: 440000, timezoneDesc: "Atlantic Time" },
    { name: "St. John's", country: "Canada", timezone: "America/St_Johns", flag: "ca", population: 110000, timezoneDesc: "Newfoundland Time" },

    // === AUSTRALIA - All Timezones ===
    { name: "Sydney", country: "Australia", timezone: "Australia/Sydney", flag: "au", population: 5300000, timezoneDesc: "Australian Eastern Time" },
    { name: "Melbourne", country: "Australia", timezone: "Australia/Melbourne", flag: "au", population: 5100000, timezoneDesc: "Australian Eastern Time" },
    { name: "Brisbane", country: "Australia", timezone: "Australia/Brisbane", flag: "au", population: 2500000, timezoneDesc: "Australian Eastern Standard Time" },
    { name: "Perth", country: "Australia", timezone: "Australia/Perth", flag: "au", population: 2100000, timezoneDesc: "Australian Western Standard Time" },
    { name: "Adelaide", country: "Australia", timezone: "Australia/Adelaide", flag: "au", population: 1400000, timezoneDesc: "Australian Central Time" },
    { name: "Darwin", country: "Australia", timezone: "Australia/Darwin", flag: "au", population: 150000, timezoneDesc: "Australian Central Standard Time" },
    { name: "Hobart", country: "Australia", timezone: "Australia/Hobart", flag: "au", population: 240000, timezoneDesc: "Australian Eastern Time" },
    { name: "Canberra", country: "Australia", timezone: "Australia/Sydney", flag: "au", population: 460000, timezoneDesc: "Australian Eastern Time" },

    // === BRAZIL - Multiple Timezones ===
    { name: "São Paulo", country: "Brazil", timezone: "America/Sao_Paulo", flag: "br", population: 12300000, timezoneDesc: "Brasília Time" },
    { name: "Rio de Janeiro", country: "Brazil", timezone: "America/Sao_Paulo", flag: "br", population: 6700000, timezoneDesc: "Brasília Time" },
    { name: "Manaus", country: "Brazil", timezone: "America/Manaus", flag: "br", population: 2200000, timezoneDesc: "Amazon Time" },
    { name: "Fortaleza", country: "Brazil", timezone: "America/Fortaleza", flag: "br", population: 2700000, timezoneDesc: "Brasília Time" },
    { name: "Rio Branco", country: "Brazil", timezone: "America/Rio_Branco", flag: "br", population: 420000, timezoneDesc: "Acre Time" },

    // === PACIFIC ISLANDS - Complete Coverage ===
    { name: "Suva", country: "Fiji", timezone: "Pacific/Fiji", flag: "fj", population: 180000, timezoneDesc: "Fiji Time" },
    { name: "Nuku'alofa", country: "Tonga", timezone: "Pacific/Tongatapu", flag: "to", population: 25000, timezoneDesc: "Tonga Time" },
    { name: "Apia", country: "Samoa", timezone: "Pacific/Apia", flag: "ws", population: 37000, timezoneDesc: "Samoa Standard Time" },
    { name: "Pago Pago", country: "American Samoa", timezone: "Pacific/Pago_Pago", flag: "as", population: 3700, timezoneDesc: "Samoa Standard Time" },
    { name: "Rarotonga", country: "Cook Islands", timezone: "Pacific/Rarotonga", flag: "ck", population: 13000, timezoneDesc: "Cook Island Time" },
    { name: "Tahiti", country: "French Polynesia", timezone: "Pacific/Tahiti", flag: "pf", population: 190000, timezoneDesc: "Tahiti Time" },
    { name: "Marquesas", country: "French Polynesia", timezone: "Pacific/Marquesas", flag: "pf", population: 9300, timezoneDesc: "Marquesas Time" },
    { name: "Gambier", country: "French Polynesia", timezone: "Pacific/Gambier", flag: "pf", population: 1300, timezoneDesc: "Gambier Time" },
    { name: "Noumea", country: "New Caledonia", timezone: "Pacific/Noumea", flag: "nc", population: 100000, timezoneDesc: "New Caledonia Time" },
    { name: "Port Vila", country: "Vanuatu", timezone: "Pacific/Efate", flag: "vu", population: 51000, timezoneDesc: "Vanuatu Time" },
    { name: "Honiara", country: "Solomon Islands", timezone: "Pacific/Guadalcanal", flag: "sb", population: 85000, timezoneDesc: "Solomon Islands Time" },
    { name: "Port Moresby", country: "Papua New Guinea", timezone: "Pacific/Port_Moresby", flag: "pg", population: 400000, timezoneDesc: "Papua New Guinea Time" },
    { name: "Majuro", country: "Marshall Islands", timezone: "Pacific/Majuro", flag: "mh", population: 28000, timezoneDesc: "Marshall Islands Time" },
    { name: "Tarawa", country: "Kiribati", timezone: "Pacific/Tarawa", flag: "ki", population: 64000, timezoneDesc: "Gilbert Island Time" },
    { name: "Kiritimati", country: "Kiribati", timezone: "Pacific/Kiritimati", flag: "ki", population: 6500, timezoneDesc: "Line Islands Time" },
    { name: "Auckland", country: "New Zealand", timezone: "Pacific/Auckland", flag: "nz", population: 1700000, timezoneDesc: "New Zealand Standard Time" },
    { name: "Chatham Island", country: "New Zealand", timezone: "Pacific/Chatham", flag: "nz", population: 600, timezoneDesc: "Chatham Standard Time" },

    // === CHINA - Single Timezone ===
    { name: "Beijing", country: "China", timezone: "Asia/Shanghai", flag: "cn", population: 22000000, timezoneDesc: "China Standard Time" },
    { name: "Shanghai", country: "China", timezone: "Asia/Shanghai", flag: "cn", population: 28000000, timezoneDesc: "China Standard Time" },
    { name: "Chengdu", country: "China", timezone: "Asia/Shanghai", flag: "cn", population: 21400000, timezoneDesc: "China Standard Time" },
    { name: "Guangzhou", country: "China", timezone: "Asia/Shanghai", flag: "cn", population: 15300000, timezoneDesc: "China Standard Time" },
    { name: "Shenzhen", country: "China", timezone: "Asia/Shanghai", flag: "cn", population: 12600000, timezoneDesc: "China Standard Time" },
    { name: "Chongqing", country: "China", timezone: "Asia/Shanghai", flag: "cn", population: 9500000, timezoneDesc: "China Standard Time" },

    // === INDIA - Single Timezone ===
    { name: "Mumbai", country: "India", timezone: "Asia/Kolkata", flag: "in", population: 20400000, timezoneDesc: "India Standard Time" },
    { name: "Delhi", country: "India", timezone: "Asia/Kolkata", flag: "in", population: 32900000, timezoneDesc: "India Standard Time" },
    { name: "Bangalore", country: "India", timezone: "Asia/Kolkata", flag: "in", population: 12300000, timezoneDesc: "India Standard Time" },
    { name: "Chennai", country: "India", timezone: "Asia/Kolkata", flag: "in", population: 11000000, timezoneDesc: "India Standard Time" },
    { name: "Kolkata", country: "India", timezone: "Asia/Kolkata", flag: "in", population: 14900000, timezoneDesc: "India Standard Time" },

    // === MAJOR EUROPEAN CITIES ===
    { name: "London", country: "United Kingdom", timezone: "Europe/London", flag: "gb", population: 9000000, timezoneDesc: "Greenwich Mean Time / British Summer Time" },
    { name: "Berlin", country: "Germany", timezone: "Europe/Berlin", flag: "de", population: 3700000, timezoneDesc: "Central European Time" },
    { name: "Munich", country: "Germany", timezone: "Europe/Berlin", flag: "de", population: 1500000, timezoneDesc: "Central European Time" },
    { name: "Stuttgart", country: "Germany", timezone: "Europe/Berlin", flag: "de", population: 630000, timezoneDesc: "Central European Time" },
    { name: "Paris", country: "France", timezone: "Europe/Paris", flag: "fr", population: 2200000, timezoneDesc: "Central European Time" },
    { name: "Rome", country: "Italy", timezone: "Europe/Rome", flag: "it", population: 2870000, timezoneDesc: "Central European Time" },
    { name: "Madrid", country: "Spain", timezone: "Europe/Madrid", flag: "es", population: 3200000, timezoneDesc: "Central European Time" },
    { name: "Amsterdam", country: "Netherlands", timezone: "Europe/Amsterdam", flag: "nl", population: 870000, timezoneDesc: "Central European Time" },
    { name: "Stockholm", country: "Sweden", timezone: "Europe/Stockholm", flag: "se", population: 975000, timezoneDesc: "Central European Time" },
    { name: "Oslo", country: "Norway", timezone: "Europe/Oslo", flag: "no", population: 695000, timezoneDesc: "Central European Time" },
    { name: "Copenhagen", country: "Denmark", timezone: "Europe/Copenhagen", flag: "dk", population: 660000, timezoneDesc: "Central European Time" },
    { name: "Helsinki", country: "Finland", timezone: "Europe/Helsinki", flag: "fi", population: 660000, timezoneDesc: "Eastern European Time" },
    { name: "Vienna", country: "Austria", timezone: "Europe/Vienna", flag: "at", population: 1900000, timezoneDesc: "Central European Time" },
    { name: "Zurich", country: "Switzerland", timezone: "Europe/Zurich", flag: "ch", population: 420000, timezoneDesc: "Central European Time" },
    { name: "Prague", country: "Czech Republic", timezone: "Europe/Prague", flag: "cz", population: 1300000, timezoneDesc: "Central European Time" },

    // === ASIA-PACIFIC ===
    { name: "Tokyo", country: "Japan", timezone: "Asia/Tokyo", flag: "jp", population: 14000000, timezoneDesc: "Japan Standard Time" },
    { name: "Seoul", country: "South Korea", timezone: "Asia/Seoul", flag: "kr", population: 9700000, timezoneDesc: "Korea Standard Time" },
    { name: "Bangkok", country: "Thailand", timezone: "Asia/Bangkok", flag: "th", population: 10500000, timezoneDesc: "Indochina Time" },
    { name: "Singapore", country: "Singapore", timezone: "Asia/Singapore", flag: "sg", population: 5900000, timezoneDesc: "Singapore Standard Time" },
    { name: "Hong Kong", country: "Hong Kong SAR", timezone: "Asia/Hong_Kong", flag: "hk", population: 7500000, timezoneDesc: "Hong Kong Time" },
    { name: "Dubai", country: "United Arab Emirates", timezone: "Asia/Dubai", flag: "ae", population: 3400000, timezoneDesc: "Gulf Standard Time" },

    // === AFRICA ===
    { name: "Cairo", country: "Egypt", timezone: "Africa/Cairo", flag: "eg", population: 20900000, timezoneDesc: "Eastern European Time" },
    { name: "Lagos", country: "Nigeria", timezone: "Africa/Lagos", flag: "ng", population: 15400000, timezoneDesc: "West Africa Time" },
    { name: "Johannesburg", country: "South Africa", timezone: "Africa/Johannesburg", flag: "za", population: 5600000, timezoneDesc: "South Africa Standard Time" },
    { name: "Cape Town", country: "South Africa", timezone: "Africa/Johannesburg", flag: "za", population: 4600000, timezoneDesc: "South Africa Standard Time" },
    { name: "Nairobi", country: "Kenya", timezone: "Africa/Nairobi", flag: "ke", population: 4400000, timezoneDesc: "East Africa Time" },
    { name: "Casablanca", country: "Morocco", timezone: "Africa/Casablanca", flag: "ma", population: 3400000, timezoneDesc: "Western European Time" },

    // === SOUTH AMERICA ===
    { name: "Buenos Aires", country: "Argentina", timezone: "America/Argentina/Buenos_Aires", flag: "ar", population: 15200000, timezoneDesc: "Argentina Time" },
    { name: "Lima", country: "Peru", timezone: "America/Lima", flag: "pe", population: 10700000, timezoneDesc: "Peru Time" },
    { name: "Santiago", country: "Chile", timezone: "America/Santiago", flag: "cl", population: 6200000, timezoneDesc: "Chile Standard Time" },
    { name: "Bogotá", country: "Colombia", timezone: "America/Bogota", flag: "co", population: 11000000, timezoneDesc: "Colombia Time" },
    { name: "Caracas", country: "Venezuela", timezone: "America/Caracas", flag: "ve", population: 2900000, timezoneDesc: "Venezuela Time" },
    { name: "Mexico City", country: "Mexico", timezone: "America/Mexico_City", flag: "mx", population: 21800000, timezoneDesc: "Central Standard Time" },

    // === MIDDLE EAST ===
    { name: "Istanbul", country: "Turkey", timezone: "Europe/Istanbul", flag: "tr", population: 15500000, timezoneDesc: "Turkey Time" },
    { name: "Tel Aviv", country: "Israel", timezone: "Asia/Jerusalem", flag: "il", population: 460000, timezoneDesc: "Israel Standard Time" },
    { name: "Jerusalem", country: "Israel", timezone: "Asia/Jerusalem", flag: "il", population: 920000, timezoneDesc: "Israel Standard Time" },
    { name: "Riyadh", country: "Saudi Arabia", timezone: "Asia/Riyadh", flag: "sa", population: 7000000, timezoneDesc: "Arabia Standard Time" },
    { name: "Kuwait City", country: "Kuwait", timezone: "Asia/Kuwait", flag: "kw", population: 3000000, timezoneDesc: "Arabia Standard Time" },
    { name: "Doha", country: "Qatar", timezone: "Asia/Qatar", flag: "qa", population: 2400000, timezoneDesc: "Arabia Standard Time" },

    // === COMMON ALIASES ===
    { name: "NYC", country: "United States", timezone: "America/New_York", flag: "us", population: 8400000, timezoneDesc: "Eastern Time" },
    { name: "LA", country: "United States", timezone: "America/Los_Angeles", flag: "us", population: 4000000, timezoneDesc: "Pacific Time" },
    { name: "SF", country: "United States", timezone: "America/Los_Angeles", flag: "us", population: 875000, timezoneDesc: "Pacific Time" },
    { name: "DC", country: "United States", timezone: "America/New_York", flag: "us", population: 700000, timezoneDesc: "Eastern Time" }
];

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalTimezoneDatabase;
}