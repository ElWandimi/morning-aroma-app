export const DEMO_ADMIN = { email: "elwandimi@gmail.com", password: "Kenya1234", role: "super_admin", name: "Elwandi" };

export const MOCK_GOOGLE_ACCOUNTS = [
  { email: DEMO_ADMIN.email, name: DEMO_ADMIN.name },
  { email: "maria.roast@gmail.com", name: "Maria Santos" },
  { email: "kofi.brew@gmail.com", name: "Kofi Mensah" },
];

export const KENYA_LIVE_MESSAGES_SEED = [
  "Nyeri lot #204 crossed the floor at $6.80/kg — the week's top price.",
  "Kirinyaga's Thursday auction opens 9:00am EAT.",
  "This week's standout: AA Nyeri, cupping score 87.5.",
  "Auction volume up 12% versus last week's floor.",
];

export const PRODUCTS = [
  {
    id: "geisha-panama", name: "Geisha", country: "Panama", tier: "premium", priceCents: 4200, stock: 6,
    note: "Jasmine, bergamot, a whisper of honey",
    tags: { aroma: ["floral", "citrus"], body: "light", acidity: "high", roast: "light", moment: "First Light", brew: ["Pour-Over", "Aeropress"] },
    profile: { aroma: 9, body: 4, acidity: 8, sweetness: 6, finish: 7 },
    growing: "Grown at 1,650–1,900m on volcanic soil in Boquete. Shade-grown under native trees, hand-picked, washed process.",
    brewGuide: "Pour-Over", momentMatch: "First Light", course: "Sensory & Cupping",
  },
  {
    id: "laurina-brazil", name: "Laurina", country: "Brazil", tier: "premium", priceCents: 2900, stock: 34,
    note: "Low caffeine, delicate citrus florals",
    tags: { aroma: ["floral", "citrus"], body: "light", acidity: "medium", roast: "light", moment: "The Reset", brew: ["Pour-Over"] },
    profile: { aroma: 7, body: 3, acidity: 5, sweetness: 6, finish: 5 },
    growing: "Grown at 1,100–1,300m in Minas Gerais. Naturally low in caffeine, sun-dried on raised beds.",
    brewGuide: "Pour-Over", momentMatch: "The Reset", course: "Sensory & Cupping",
  },
  {
    id: "sl28-kenya", name: "SL28", country: "Kenya", tier: "premium", priceCents: 3400, stock: 3,
    note: "Blackcurrant, tomato acidity, syrupy body",
    tags: { aroma: ["fruity", "winey"], body: "full", acidity: "high", roast: "medium", moment: "The Hustle", brew: ["French Press", "Moka Pot"] },
    profile: { aroma: 8, body: 8, acidity: 9, sweetness: 7, finish: 8 },
    growing: "Grown at 1,700–2,000m on red volcanic soil in Nyeri. Double-fermented washed process.",
    brewGuide: "French Press", momentMatch: "The Hustle", course: "Espresso",
  },
  {
    id: "pacamara-elsalvador", name: "Pacamara", country: "El Salvador", tier: "premium", priceCents: 2700, stock: 0,
    note: "Chocolate, dried fig, round finish",
    tags: { aroma: ["chocolate", "fruity"], body: "full", acidity: "medium", roast: "medium", moment: "Comfort", brew: ["French Press"] },
    profile: { aroma: 7, body: 8, acidity: 5, sweetness: 8, finish: 7 },
    growing: "Grown at 1,300–1,500m in Ahuachapán. Large-bean hybrid, honey processed.",
    brewGuide: "French Press", momentMatch: "Comfort", course: "Home Brewing",
  },
  {
    id: "bourbon-rwanda", name: "Bourbon", country: "Rwanda", tier: "everyday", priceCents: 1800, stock: 120,
    note: "Caramel, red apple, gentle body",
    tags: { aroma: ["sweet", "fruity"], body: "medium", acidity: "medium", roast: "medium", moment: "First Light", brew: ["Pour-Over", "Drip"] },
    profile: { aroma: 6, body: 5, acidity: 5, sweetness: 7, finish: 6 },
    growing: "Grown at 1,700m near Lake Kivu. Fully washed, sun-dried on raised beds.",
    brewGuide: "Pour-Over", momentMatch: "First Light", course: "Home Brewing",
  },
  {
    id: "typica-guatemala", name: "Typica", country: "Guatemala", tier: "everyday", priceCents: 1700, stock: 85,
    note: "Cocoa, walnut, clean finish",
    tags: { aroma: ["nutty", "chocolate"], body: "medium", acidity: "low", roast: "medium-dark", moment: "Comfort", brew: ["Moka Pot", "Drip"] },
    profile: { aroma: 5, body: 6, acidity: 3, sweetness: 6, finish: 5 },
    growing: "Grown at 1,400–1,600m in Antigua. Volcanic soil, washed process.",
    brewGuide: "Moka Pot", momentMatch: "Comfort", course: "Home Brewing",
  },
  {
    id: "caturra-colombia", name: "Caturra", country: "Colombia", tier: "everyday", priceCents: 1900, stock: 60,
    note: "Brown sugar, orange, bright",
    tags: { aroma: ["fruity", "sweet"], body: "medium", acidity: "high", roast: "medium", moment: "The Hustle", brew: ["Pour-Over", "Aeropress"] },
    profile: { aroma: 6, body: 5, acidity: 7, sweetness: 7, finish: 6 },
    growing: "Grown at 1,500–1,800m in Huila. Washed process, dried on patios.",
    brewGuide: "Aeropress", momentMatch: "The Hustle", course: "Home Brewing",
  },
  {
    id: "catuai-honduras", name: "Catuai", country: "Honduras", tier: "everyday", priceCents: 1600, stock: 45,
    note: "Milk chocolate, soft acidity",
    tags: { aroma: ["chocolate", "sweet"], body: "medium", acidity: "low", roast: "medium-dark", moment: "The Reset", brew: ["French Press", "Drip"] },
    profile: { aroma: 5, body: 5, acidity: 3, sweetness: 6, finish: 5 },
    growing: "Grown at 1,200–1,500m in Copán. Washed process, shade-grown.",
    brewGuide: "French Press", momentMatch: "The Reset", course: "Home Brewing",
  },
  {
    id: "yirgacheffe-ethiopia", name: "Yirgacheffe", country: "Ethiopia", tier: "premium", priceCents: 3300, stock: 22,
    note: "Blueberry, jasmine, bergamot",
    tags: { aroma: ["floral", "fruity"], body: "light", acidity: "high", roast: "light", moment: "First Light", brew: ["Pour-Over", "Aeropress"] },
    profile: { aroma: 9, body: 3, acidity: 8, sweetness: 7, finish: 7 },
    growing: "Grown at 1,700–2,200m in the Gedeo Zone near Yirgacheffe town. Many farms are shaded under native forest canopy, hand-picked, fully washed process.",
    brewGuide: "Pour-Over", momentMatch: "First Light", course: "Sensory & Cupping",
  },
];

// Green (unroasted) coffee — a genuinely separate, wholesale product line, sold by the kilogram
// to other roasters and serious home-roasters rather than as retail bags. Mirrors the same 9
// origins as the roasted catalog (same farms, same relationships), but every field here reflects
// how green coffee actually gets bought and sold: bulk pricing per kg, a minimum order quantity,
// an SCA-style cupping score, moisture content, and screen size/grade — none of which apply to a
// roasted retail bag. Kenya uses its real AA/AB grading convention rather than a screen size
// number, since that's how Kenyan green coffee is actually graded.
export const GREEN_BEANS = [
  {
    id: "green-panama", name: "Green Panama — Boquete", country: "Panama", roastedId: "geisha-panama",
    pricePerKgCents: 1400, stockKg: 180, minOrderKg: 5,
    cuppingScore: 89, moisture: "10.8%", grade: "17/18", process: "Washed",
    notes: "The same Geisha lot selection we roast ourselves, sold green for roasters who want to develop their own profile.",
  },
  {
    id: "green-brazil", name: "Green Brazil — Minas Gerais", country: "Brazil", roastedId: "laurina-brazil",
    pricePerKgCents: 550, stockKg: 620, minOrderKg: 10,
    cuppingScore: 83, moisture: "11.2%", grade: "17/18", process: "Natural",
    notes: "Naturally low-caffeine Laurina, sun-dried on raised beds. High-volume lot, competitively priced.",
  },
  {
    id: "green-kenya", name: "Green Kenya — Nyeri", country: "Kenya", roastedId: "sl28-kenya",
    pricePerKgCents: 950, stockKg: 240, minOrderKg: 5,
    cuppingScore: 87, moisture: "10.5%", grade: "AA", process: "Washed (double-fermented)",
    notes: "Same SL28 lot as our retail roast. Graded AA per Kenya's own convention, not screen size.",
  },
  {
    id: "green-elsalvador", name: "Green El Salvador — Ahuachapán", country: "El Salvador", roastedId: "pacamara-elsalvador",
    pricePerKgCents: 750, stockKg: 90, minOrderKg: 5,
    cuppingScore: 85, moisture: "11.0%", grade: "18", process: "Honey",
    notes: "Large-bean Pacamara hybrid, honey processed. Limited lot — same scarcity as the roasted version.",
  },
  {
    id: "green-rwanda", name: "Green Rwanda — Lake Kivu", country: "Rwanda", roastedId: "bourbon-rwanda",
    pricePerKgCents: 680, stockKg: 410, minOrderKg: 10,
    cuppingScore: 84, moisture: "10.9%", grade: "17", process: "Washed",
    notes: "Fully washed Bourbon, sun-dried on raised beds near Lake Kivu.",
  },
  {
    id: "green-guatemala", name: "Green Guatemala — Antigua", country: "Guatemala", roastedId: "typica-guatemala",
    pricePerKgCents: 640, stockKg: 350, minOrderKg: 10,
    cuppingScore: 84, moisture: "11.1%", grade: "17/18", process: "Washed",
    notes: "Classic Antigua Typica, volcanic soil. A dependable, well-balanced roasting base.",
  },
  {
    id: "green-colombia", name: "Green Colombia — Huila", country: "Colombia", roastedId: "caturra-colombia",
    pricePerKgCents: 620, stockKg: 480, minOrderKg: 10,
    cuppingScore: 83, moisture: "11.0%", grade: "17", process: "Washed",
    notes: "Patio-dried Caturra from Huila. Our highest-volume green offering.",
  },
  {
    id: "green-honduras", name: "Green Honduras — Copán", country: "Honduras", roastedId: "catuai-honduras",
    pricePerKgCents: 480, stockKg: 300, minOrderKg: 10,
    cuppingScore: 81, moisture: "11.3%", grade: "16/17", process: "Washed",
    notes: "Shade-grown Catuai from Copán. Our most affordable green offering, still fully traceable.",
  },
  {
    id: "green-ethiopia", name: "Green Ethiopia — Yirgacheffe", country: "Ethiopia", roastedId: "yirgacheffe-ethiopia",
    pricePerKgCents: 850, stockKg: 160, minOrderKg: 5,
    cuppingScore: 88, moisture: "10.6%", grade: "16", process: "Washed",
    notes: "Same forest-shaded Gedeo Zone lot as our Yirgacheffe roast. A favorite among light-roast specialists.",
  },
];

export const PREMIUM = PRODUCTS.filter((p) => p.tier === "premium");

export const EVERYDAY = PRODUCTS.filter((p) => p.tier === "everyday");

export const BREW_GUIDES = [
  {
    name: "Pour-Over", icon: "🫖",
    flavor: "Clean, bright, and layered — pour-over highlights acidity and florals.",
    steps: [
      "Rinse a paper filter, add 18g medium-fine grounds, bloom with 40ml water for 30s.",
      "Pour the remaining 250ml in slow circles over about 3 minutes.",
      "Let it fully drain, then serve immediately while it's still steaming.",
    ],
    course: "Home Brewing",
  },
  {
    name: "French Press", icon: "🥄",
    flavor: "Full-bodied and round — the metal filter lets natural oils through.",
    steps: [
      "Add 30g coarse grounds to the press, pour 500ml just-off-boil water, stir once.",
      "Place the lid on with the plunger up, steep for 4 minutes.",
      "Press down slowly and pour immediately to stop extraction.",
    ],
    course: "Home Brewing",
  },
  {
    name: "Espresso", icon: "☕",
    flavor: "Concentrated and syrupy — the base for every milk drink in the Academy.",
    steps: [
      "Dose 18g finely-ground coffee into the portafilter, level and tamp firmly.",
      "Lock in and pull for 25–30 seconds, targeting 36g of espresso.",
      "Taste the crema first — it should be reddish-brown, not pale or grey.",
    ],
    course: "Espresso",
  },
  {
    name: "Cold Brew", icon: "🧊",
    flavor: "Smooth, low-acid, naturally sweet — built to sit over ice.",
    steps: [
      "Combine 100g coarse grounds with 1L cold water in a jar, stir to saturate.",
      "Cover and steep in the fridge for 16–18 hours.",
      "Strain through a paper filter and dilute 1:1 with water or milk before drinking.",
    ],
    course: "Cold Brew",
  },
  {
    name: "Moka Pot", icon: "🫗",
    flavor: "Bold and slightly bitter-sweet — a stovetop espresso alternative.",
    steps: [
      "Fill the base with water to the valve line, don't force the grounds into the basket.",
      "Assemble and set over medium-low heat with the lid open.",
      "Remove from heat as soon as it starts gurgling, before it sputters dry.",
    ],
    course: "Moka Pot",
  },
  {
    name: "Aeropress", icon: "🔻",
    flavor: "Clean and versatile — can lean toward espresso or drip depending on method.",
    steps: [
      "Add 15g fine-medium grounds and 220ml hot water, stir for 10 seconds.",
      "Steep for 1 minute, then press gently over 30 seconds.",
      "Dilute with hot water to taste if it comes out concentrated.",
    ],
    course: "Home Brewing",
  },
];

export const COURSES = [
  { name: "Espresso", category: "Barista Skills", blurb: "Dial in grind, dose, and shot time to pull a balanced espresso every time.", instructor: "Amara Wanjiru", lessons: 6 },
  { name: "Cappuccino", category: "Barista Skills", blurb: "Steam milk to a glossy microfoam and layer it into a classic 1:1:1 cappuccino.", instructor: "Amara Wanjiru", lessons: 5 },
  { name: "Latte", category: "Barista Skills", blurb: "Stretch milk longer and practice your first heart, rosetta, and tulip pours.", instructor: "Amara Wanjiru", lessons: 5 },
  { name: "Flat White", category: "Barista Skills", blurb: "A tighter milk texture and higher ratio — the espresso-forward middle ground.", instructor: "Dinesh Rao", lessons: 4 },
  { name: "Mocha", category: "Barista Skills", blurb: "Balance chocolate, espresso, and steamed milk without losing the coffee.", instructor: "Dinesh Rao", lessons: 4 },
  { name: "Americano", category: "Barista Skills", blurb: "Understand how water ratio and pour order change body and crema.", instructor: "Dinesh Rao", lessons: 3 },
  { name: "Cold Brew", category: "Barista Skills", blurb: "Steep ratios, filtration, and how to build a cold brew concentrate menu.", instructor: "Amara Wanjiru", lessons: 4 },
  { name: "Turkish", category: "Barista Skills", blurb: "Fine-grind, unfiltered brewing in a cezve, with the traditional foam cap.", instructor: "Leyla Demir", lessons: 4 },
  { name: "Vietnamese", category: "Barista Skills", blurb: "Slow-drip phin filters over condensed milk, hot or over ice.", instructor: "Mai Tran", lessons: 3 },
  { name: "Moka Pot", category: "Barista Skills", blurb: "Get consistent stovetop extraction without the bitter, burnt-out cup.", instructor: "Dinesh Rao", lessons: 3 },
  { name: "Affogato", category: "Barista Skills", blurb: "One shot, one scoop — timing and glassware for the simplest dessert drink.", instructor: "Amara Wanjiru", lessons: 2 },
  { name: "Home Brewing", category: "Home Brewing", blurb: "Pour-over, French press, and Aeropress fundamentals for your own kitchen.", instructor: "Kofi Mensah", lessons: 7 },
  { name: "Sensory & Cupping", category: "Sensory", blurb: "Train your palate to name acidity, body, and aftertaste like a professional cupper.", instructor: "Elena Rossi", lessons: 6 },
  { name: "Roasting Fundamentals", category: "Professional", blurb: "First crack, development time, and how roast curves shape flavor.", instructor: "Kofi Mensah", lessons: 8 },
  { name: "Cafe Management", category: "Professional", blurb: "Costing, staffing, and menu design for running a specialty coffee bar.", instructor: "Elena Rossi", lessons: 9 },
];

export const GROWING_PROFILES = {
  "geisha-panama": { altitude: "1,650–1,900m", temp: "18–21°C", rainfall: "2,300mm/yr", soilType: "Volcanic loam", pH: 5.8, shade: "80% canopy", pests: "Coffee leaf rust, monitored monthly", nutrients: { n: 7, p: 5, k: 6 } },
  "laurina-brazil": { altitude: "1,100–1,300m", temp: "20–23°C", rainfall: "1,500mm/yr", soilType: "Red latosol", pH: 5.5, shade: "20% canopy", pests: "Coffee berry borer, pheromone trapped", nutrients: { n: 6, p: 4, k: 5 } },
  "sl28-kenya": { altitude: "1,700–2,000m", temp: "16–20°C", rainfall: "1,100mm/yr", soilType: "Red volcanic soil", pH: 5.2, shade: "10% canopy", pests: "Coffee berry disease, resistant rootstock", nutrients: { n: 8, p: 6, k: 7 } },
  "pacamara-elsalvador": { altitude: "1,300–1,500m", temp: "19–23°C", rainfall: "1,800mm/yr", soilType: "Andisol (ash-derived)", pH: 6.0, shade: "60% canopy", pests: "Coffee leaf miner, hand-monitored", nutrients: { n: 6, p: 5, k: 6 } },
  "bourbon-rwanda": { altitude: "1,700m", temp: "18–21°C", rainfall: "1,200mm/yr", soilType: "Volcanic clay loam", pH: 6.1, shade: "30% canopy", pests: "Antestia bug, biological control", nutrients: { n: 6, p: 5, k: 5 } },
  "typica-guatemala": { altitude: "1,400–1,600m", temp: "18–22°C", rainfall: "2,000mm/yr", soilType: "Volcanic loam", pH: 5.9, shade: "50% canopy", pests: "Coffee berry borer, trap-monitored", nutrients: { n: 5, p: 5, k: 6 } },
  "caturra-colombia": { altitude: "1,500–1,800m", temp: "17–21°C", rainfall: "1,900mm/yr", soilType: "Andisol", pH: 5.4, shade: "40% canopy", pests: "Coffee leaf rust, resistant variety mix", nutrients: { n: 7, p: 6, k: 6 } },
  "catuai-honduras": { altitude: "1,200–1,500m", temp: "19–23°C", rainfall: "1,700mm/yr", soilType: "Clay loam", pH: 5.7, shade: "45% canopy", pests: "Coffee berry borer, cultural control", nutrients: { n: 5, p: 4, k: 5 } },
  "yirgacheffe-ethiopia": { altitude: "1,700–2,200m", temp: "15–20°C", rainfall: "1,800mm/yr", soilType: "Nitisol (volcanic)", pH: 5.8, shade: "85% canopy", pests: "Coffee berry disease, closely monitored", nutrients: { n: 7, p: 5, k: 6 } },
};

export const COUNTRIES = [
  {
    name: "Panama", flag: "🇵🇦", climate: "Cool, cloud-forest highlands with consistent rainfall year-round.",
    soil: "Volcanic loam rich in minerals from Volcán Barú.",
    regions: [{ name: "Boquete", note: "Home to most Geisha lots" }, { name: "Volcán", note: "Higher altitude, slower ripening" }],
    harvestStart: 11, harvestEnd: 2, auction: "Sold through the Best of Panama competition and private treaty — no open weekly auction.",
    liveMessages: null,
  },
  {
    name: "Brazil", flag: "🇧🇷", climate: "Warm, flat terrain with a defined dry season for natural-process drying.",
    soil: "Red latosol, deep and well-drained.",
    regions: [{ name: "Minas Gerais", note: "Largest producing state" }, { name: "Cerrado", note: "Mechanized, high-volume farms" }],
    harvestStart: 4, harvestEnd: 8, auction: "Priced against the C-market; large estates sell via forward contracts.",
    liveMessages: null,
  },
  {
    name: "Kenya", flag: "🇰🇪", climate: "Equatorial highlands with two rainy seasons producing a main and a fly crop.",
    soil: "Deep red volcanic soil, naturally high in phosphorus.",
    regions: [{ name: "Nyeri", note: "High-acidity, blackcurrant notes" }, { name: "Kirinyaga", note: "Bright, citrus-forward lots" }],
    harvestStart: 9, harvestEnd: 11, auction: "Sold weekly through the Nairobi Coffee Exchange auction floor.",
    liveMessages: [
      "Nyeri lot #204 crossed the floor at $6.80/kg — the week's top price.",
      "Kirinyaga's Thursday auction opens 9:00am EAT.",
      "This week's standout: AA Nyeri, cupping score 87.5.",
      "Auction volume up 12% versus last week's floor.",
    ],
  },
  {
    name: "El Salvador", flag: "🇸🇻", climate: "Volcanic highlands with a long, gentle dry season.",
    soil: "Andisol — young, ash-derived, and mineral-rich.",
    regions: [{ name: "Ahuachapán", note: "Home to Pacamara hybrids" }, { name: "Santa Ana", note: "Volcán de Santa Ana slopes" }],
    harvestStart: 10, harvestEnd: 1, auction: "Sold via the Cup of Excellence program and direct relationships.",
    liveMessages: null,
  },
  {
    name: "Rwanda", flag: "🇷🇼", climate: "Mild highland climate moderated by Lake Kivu.",
    soil: "Volcanic clay loam from the Virunga range.",
    regions: [{ name: "Lake Kivu", note: "Washing stations along the shoreline" }, { name: "Huye", note: "Southern highland smallholders" }],
    harvestStart: 2, harvestEnd: 5, auction: "Sold through the Rwanda Trading Company and Cup of Excellence.",
    liveMessages: null,
  },
  {
    name: "Guatemala", flag: "🇬🇹", climate: "Volcanic highlands with distinct wet and dry seasons.",
    soil: "Deep volcanic loam around Antigua's three volcanoes.",
    regions: [{ name: "Antigua", note: "Classic chocolate-forward profile" }, { name: "Huehuetenango", note: "Higher altitude, brighter acidity" }],
    harvestStart: 11, harvestEnd: 2, auction: "Sold via the Cup of Excellence and direct-trade contracts.",
    liveMessages: null,
  },
  {
    name: "Colombia", flag: "🇨🇴", climate: "Equatorial Andes with two harvest windows thanks to bimodal rainfall.",
    soil: "Andisol, volcanic ash over ancient bedrock.",
    regions: [{ name: "Huila", note: "Fruit-forward, high-acidity lots" }, { name: "Nariño", note: "Extreme altitude, slow maturation" }],
    harvestStart: 8, harvestEnd: 11, auction: "Sold through the Federación Nacional de Cafeteros and private mills.",
    liveMessages: null,
  },
  {
    name: "Honduras", flag: "🇭🇳", climate: "Mountainous, humid, with a long rainy season feeding steady growth.",
    soil: "Clay loam over volcanic bedrock.",
    regions: [{ name: "Copán", note: "Bordering Guatemala's highlands" }, { name: "Marcala", note: "Protected-origin denomination" }],
    harvestStart: 10, harvestEnd: 2, auction: "Sold through IHCAFE-registered exporters and direct trade.",
    liveMessages: null,
  },
  {
    name: "Ethiopia", flag: "🇪🇹", climate: "High-altitude equatorial highlands with a long rainy season feeding lush, often forest-shaded farms.",
    soil: "Nitisol — deep, well-drained volcanic soil common across the highlands.",
    regions: [{ name: "Yirgacheffe", note: "Washed, intensely floral lots" }, { name: "Sidamo", note: "Broader region, fruit-forward naturals" }],
    harvestStart: 10, harvestEnd: 12, auction: "Sold through the Ethiopia Commodity Exchange (ECX), which traces lots back to the washing station that processed them.",
    liveMessages: null,
  },
];

export const COUNTRY_JOURNEY_PHOTO = {
  Panama: "https://images.unsplash.com/photo-1757688341742-ce7978cdb186?auto=format&fit=crop&w=1600&q=68",
  Brazil: "https://images.unsplash.com/photo-1652020079010-038498f4b852?auto=format&fit=crop&w=1600&q=68",
  Kenya: "https://images.unsplash.com/photo-1753652735948-47b47c1d5713?auto=format&fit=crop&w=1600&q=68",
  "El Salvador": "https://images.unsplash.com/photo-1753837787691-84a06d715d24?auto=format&fit=crop&w=1600&q=68",
  Rwanda: "https://images.unsplash.com/photo-1639527924446-3edc522ae4b0?auto=format&fit=crop&w=1600&q=68",
  Guatemala: "https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=1600&q=68",
  Colombia: "https://images.unsplash.com/photo-1457414254764-c87b209f5249?auto=format&fit=crop&w=1600&q=68",
  Honduras: "https://images.unsplash.com/photo-1761271046396-97d231b59dd7?auto=format&fit=crop&w=1600&q=68",
  Ethiopia: "https://images.unsplash.com/photo-1572888195250-3037a59d3578?auto=format&fit=crop&w=1600&q=68",
};

export const COUNTRY_HISTORY = {
  Panama:
    "Coffee arrived with European settlers in the 19th century, but it was the Boquete highlands that transformed Panama's reputation. The 2004 Best of Panama competition introduced the world to Geisha — a delicate varietal that went on to break global auction records and put this small country on the specialty map almost overnight.",
  Brazil:
    "Legend says a French Guianese official's wife smuggled the first seedlings across the border hidden in a bouquet in the 1720s. Within two centuries Brazil became the world's largest coffee producer — a title it still holds — with vast farms across Minas Gerais and São Paulo shaping both the global market and the nation's own economic story.",
  Kenya:
    "Coffee reached Kenya in the early 1900s with British colonial settlers, planted first near Nairobi and later across the fertile highlands of Nyeri and Kirinyaga. What set it apart was the auction system and rigorous grading built around it — bold, blackcurrant-bright cups still among the most prized in the specialty world.",
  "El Salvador":
    "Coffee became El Salvador's dominant export by the late 1800s, grown on the rich volcanic slopes around Santa Ana and Ahuachapán. Decades of civil conflict disrupted the industry, but its farms preserved rare heirloom varieties like Pacamara — now sought after by roasters far beyond Central America.",
  Rwanda:
    "German and Belgian colonizers introduced coffee in the early 20th century, but it was after 1994 that Rwanda rebuilt its industry around fully washed, cooperative-grown Bourbon — turning coffee into both an economic lifeline and a quiet symbol of national recovery.",
  Guatemala:
    "Guatemala's coffee industry took root in the 1860s, after a collapse in the cochineal dye trade pushed farmers toward a new crop. Volcanic soil around Antigua's three volcanoes produced a distinct, chocolate-forward profile that helped define Central American coffee for generations that followed.",
  Colombia:
    "Colombia's coffee tradition dates to the early 1800s, spread in part — as the story goes — by priests who assigned coffee planting as penance. By the 20th century, smallholder farms across the Andes had made Colombia synonymous with balanced, approachable coffee, organized around one of the most recognized cooperative systems on earth.",
  Honduras:
    "Long overshadowed by its neighbors, Honduras quietly became Central America's largest coffee producer in the 21st century. Family-run smallholder farms across Copán and Marcala have increasingly turned toward quality and traceability, earning recognition their coffee has deserved for decades.",
  Ethiopia:
    "Ethiopia is coffee's birthplace, and it shows — wild Arabica still grows in its highland forests, more genetically diverse here than anywhere else on earth. Most smallholders tend heirloom trees passed down through generations rather than a single named varietal, and the Ethiopia Commodity Exchange was built specifically to trace every lot back to the washing station that processed it.",
};

export const GROWING_FACTORS = [
  {
    name: "Altitude", icon: "⛰️",
    explain: "Higher altitude means cooler nights and slower cherry maturation, which concentrates sugars and acids — usually read as brighter, more complex cups.",
    lowId: "typica-guatemala", highId: "sl28-kenya",
  },
  {
    name: "Rainfall", icon: "🌧️",
    explain: "Rainfall timing shapes the harvest calendar and cherry size. Too little stresses the plant; too much risks disease and dilutes flavor development.",
    lowId: "sl28-kenya", highId: "geisha-panama",
  },
  {
    name: "Soil pH", icon: "🧪",
    explain: "Coffee prefers slightly acidic soil, roughly pH 5.5–6.5. Outside that range, roots struggle to access nitrogen and other key nutrients.",
    lowId: "sl28-kenya", highId: "bourbon-rwanda",
  },
  {
    name: "Shade Cover", icon: "🌳",
    explain: "Shade slows ripening and protects biodiversity, often at some cost to yield. Full-sun farms trade some complexity for higher volume.",
    lowId: "sl28-kenya", highId: "geisha-panama",
  },
];

export const HISTORY_SECTIONS = [
  {
    id: "ethiopian-legend", era: "c. 850 CE", title: "The Dancing Goats of Kaffa",
    story:
      "The story goes that a goat herder named Kaldi noticed his flock dancing after eating red cherries from a certain shrub. He tried them himself, and found the same restless energy. Local monks, skeptical at first, brewed the cherries into a drink to stay alert through nightly prayer — and coffee's first ritual was born in the highlands of what is now Ethiopia.",
    quote: "a legend, but the goats were onto something —",
    linkLabel: "Learn to taste it: Sensory & Cupping", linkPage: "course", linkId: "sensory-cupping",
    colors: ["#6B7B50", "#4a5a38"],
    photo: "https://images.unsplash.com/photo-1586095516671-d085ff58cdd4?auto=format&fit=crop&w=1600&q=68",
  },
  {
    id: "yemeni-monks", era: "15th century", title: "Sufi Monasteries of Yemen",
    story:
      "By the 1400s, Sufi monks in Yemen were cultivating coffee deliberately, brewing it to sustain long nights of devotion. The port city of Mocha became the word's first coffee-trading hub, sending beans north through the Red Sea and into the wider Islamic world — coffee's first true export economy.",
    quote: "brewed for devotion, then for everyone —",
    linkLabel: "A quieter cup: The Reset", linkPage: "moment", linkId: "the-reset",
    colors: ["#3E2C23", "#2a3a4a"],
    photo: "https://images.unsplash.com/photo-1606486544554-164d98da4889?auto=format&fit=crop&w=1600&q=68",
  },
  {
    id: "ottoman-coffeehouses", era: "16th century", title: "The Coffeehouses of Istanbul",
    story:
      "Coffee reached Ottoman Istanbul by the 1550s and never left. Kiva Han, often called the world's first coffeehouse, opened its doors, and the city filled with qahveh khaneh — places to talk politics, play chess, and argue late into the night. Coffee became a public, social ritual for the first time.",
    quote: "the original third place —",
    linkLabel: "Brew it the old way: Turkish course", linkPage: "course", linkId: "turkish",
    colors: ["#8B5A3A", "#5a2a20"],
    photo: "https://images.unsplash.com/photo-1579265898841-79c7890d69cf?auto=format&fit=crop&w=1600&q=68",
  },
  {
    id: "venice-vienna", era: "17th–18th century", title: "Venice and Vienna",
    story:
      "Venetian merchants brought coffee into Europe by the early 1600s, and it spread north fast. Vienna's coffeehouse culture flourished after the Battle of Vienna in 1683, when abandoned Ottoman sacks of green beans reportedly gave the city its first taste — spawning a café culture that shaped European intellectual life for centuries.",
    quote: "a continent, converted —",
    linkLabel: "Pull a shot: Espresso guide", linkPage: "brewguide", linkId: "espresso",
    colors: ["#C5A181", "#8B5A3A"],
    photo: "https://images.unsplash.com/photo-1563311977-d285756282dc?auto=format&fit=crop&w=1600&q=68",
  },
  {
    id: "colonial-plantations", era: "18th–19th century", title: "Plantations and Displacement",
    story:
      "As demand grew, European colonial powers established coffee plantations across Latin America, Africa, and Asia — often on land taken from indigenous communities and worked through forced and enslaved labor. This history is part of coffee's story too, and it's why we publish what we pay: transparency is our answer to an industry that has too often hidden its costs.",
    quote: "we don't skip this chapter —",
    linkLabel: "See our published prices: Kenya", linkPage: "country", linkId: "kenya",
    colors: ["#3E2C23", "#1f1510"],
    photo: "https://images.unsplash.com/photo-1457414254764-c87b209f5249?auto=format&fit=crop&w=1600&q=68",
  },
  {
    id: "specialty-movement", era: "1990s–today", title: "The Specialty Movement",
    story:
      "Starting in the 1990s, a third wave of roasters and farmers began treating coffee less like a commodity and more like wine — traceable to a single farm, cupped for quality, paid for on merit. Direct trade relationships, transparent pricing, and a renewed respect for the people who grow it define the movement Morning Aroma is proud to be part of.",
    quote: "and this is where we come in —",
    linkLabel: "Explore the full shop", linkPage: "shop", linkId: null,
    colors: ["#E8D5B5", "#8B5A3A"],
    photo: "https://images.unsplash.com/photo-1531441802565-2948024f1b22?auto=format&fit=crop&w=1600&q=68",
  },
];

export const LEGENDARY_MOMENTS = [
  {
    year: "c. 1555", title: "The World's First Coffeehouse Opens",
    story: "Two merchants, Hakem of Aleppo and Şems of Damascus, open Kiva Han in Istanbul. For the first time on record, coffee isn't just brewed at home — it becomes something people gather for.",
    photo: "https://images.unsplash.com/photo-1757688341742-ce7978cdb186?auto=format&fit=crop&w=900&q=65",
  },
  {
    year: "1616", title: "A Plant Smuggled Out of Yemen",
    story: "A Dutch trader slips a living coffee plant out of the port of Mocha, breaking a centuries-old Arabian monopoly and quietly seeding every plantation that follows.",
    photo: "https://images.unsplash.com/photo-1753652735948-47b47c1d5713?auto=format&fit=crop&w=900&q=65",
  },
  {
    year: "1675", title: "A King Tries to Ban Coffee — and Fails",
    story: "England's Charles II calls coffeehouses \"seminaries of sedition\" and shuts them down. The public backlash is so fierce the ban lasts eleven days.",
    photo: "https://images.unsplash.com/photo-1753837787691-84a06d715d24?auto=format&fit=crop&w=900&q=65",
  },
  {
    year: "1773", title: "A Boycott Changes a Nation's Drink",
    story: "Colonists turning away from British tea reach for coffee instead — and it never really lets go, becoming woven into a new country's daily ritual.",
    photo: "https://images.unsplash.com/photo-1639527924446-3edc522ae4b0?auto=format&fit=crop&w=900&q=65",
  },
  {
    year: "1901", title: "Espresso Roars to Life",
    story: "In Milan, Luigi Bezzera patents a machine that forces steam through grounds in under a minute — inventing an entirely new, urgent way to drink coffee.",
    photo: "https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=900&q=65",
  },
  {
    year: "1971", title: "One Small Shop in Seattle",
    story: "A single storefront opens at Pike Place Market. Nobody there knows it yet, but they've just planted the seed of a global coffee culture.",
    photo: "https://images.unsplash.com/photo-1761271046396-97d231b59dd7?auto=format&fit=crop&w=900&q=65",
  },
  {
    year: "2004", title: "A Record Shattered Overnight",
    story: "A tiny lot of Panamanian Geisha crosses the auction floor and shatters every price record anyone expected — and specialty coffee is never the same again.",
    photo: "https://images.unsplash.com/photo-1740593021483-a898ac0d4ab7?auto=format&fit=crop&w=900&q=65",
  },
  {
    year: "2015", title: "Coffee in Zero Gravity",
    story: "Aboard the International Space Station, astronauts sip the first true espresso ever brewed off Earth — proof this ritual really does go anywhere we do.",
    photo: "https://images.unsplash.com/photo-1757688341742-ce7978cdb186?auto=format&fit=crop&w=900&q=65",
  },
];

export const CORE_VALUES = [
  {
    title: "Radical Traceability",
    line: "Every bag names its farm, not just its country.",
    example: "Scan any bag and you'll find the farm name, altitude, and the exact price we paid — searchable in our Source Library, no exceptions.",
  },
  {
    title: "Fair, Published Pricing",
    line: "FOB prices are printed, not negotiated in private.",
    example: "We publish the FOB price for every lot on the product page, updated whenever a contract renews — the farmer's price and yours, both visible.",
  },
  {
    title: "Craft Over Speed",
    line: "We'd rather ship late than ship a lot we haven't cupped.",
    example: "Every lot is cupped at least three times before it's approved for roasting, even during the tightest weeks of harvest season.",
  },
  {
    title: "A Table for Everyone",
    line: "Coffee culture belongs to more than one language.",
    example: "Brew guides and course subtitles are being localized starting with Swahili, Spanish, and Vietnamese — because the rituals we sell come from everywhere.",
  },
  {
    title: "Give Back to the Land",
    line: "The soil that grows this isn't ours to exhaust.",
    example: "1% of every Premium Tier sale funds shade-tree replanting programs in the regions we source from, tracked and reported annually.",
  },
];

export const QUIZ_QUESTIONS = [
  {
    key: "feeling", prompt: "How do you want to feel?",
    options: [
      { label: "Energized", body: "full", acidity: "high" },
      { label: "Calm", body: "light", acidity: "low" },
      { label: "Comforted", body: "full", acidity: "low" },
      { label: "Curious", body: "medium", acidity: "medium" },
    ],
  },
  {
    key: "body", prompt: "How heavy do you like it in the cup?",
    options: [
      { label: "Light and tea-like", body: "light" },
      { label: "Somewhere in the middle", body: "medium" },
      { label: "Full and syrupy", body: "full" },
    ],
  },
  {
    key: "acidity", prompt: "Bright and tangy, or smooth and mellow?",
    options: [
      { label: "Bright — bring the acidity", acidity: "high" },
      { label: "Balanced", acidity: "medium" },
      { label: "Smooth and mellow", acidity: "low" },
    ],
  },
  {
    key: "moment", prompt: "When are you usually drinking this?",
    options: [
      { label: "First thing in the morning", moment: "First Light" },
      { label: "Mid-morning rush", moment: "The Hustle" },
      { label: "Afternoon pause", moment: "The Reset" },
      { label: "Evening wind-down", moment: "Comfort" },
    ],
  },
];

export const GLOBAL_RITUALS = [
  {
    name: "Ethiopian Bunna", flag: "🇪🇹",
    story: "A full coffee ceremony can take hours: green beans roasted by hand over coals, ground, and brewed in a clay jebena, poured in three rounds — abol, tona, baraka — each one a little weaker, each one still shared.",
    courseId: "sensory-cupping",
  },
  {
    name: "Turkish Kahve", flag: "🇹🇷",
    story: "Finely ground coffee is simmered unfiltered in a cezve, poured slowly so the foam settles on top, and sipped down to the thick grounds at the bottom — sometimes read for fortune once the cup is empty.",
    courseId: "turkish",
  },
  {
    name: "Italian Espresso Culture", flag: "🇮🇹",
    story: "Standing at the bar, not sitting — espresso in Italy is often a 30-second ritual between other things, ordered simply as 'un caffè' and gone before the crema fully settles.",
    courseId: "espresso",
  },
  {
    name: "Vietnamese Cà Phê Sữa Đá", flag: "🇻🇳",
    story: "Dark-roast robusta drips slowly through a metal phin filter directly over sweetened condensed milk, then gets poured over ice — a colonial-era workaround for scarce fresh milk that became its own beloved tradition.",
    courseId: "vietnamese",
  },
];

export const FAQ_ITEMS = [
  { q: "How fresh is the coffee when it ships?", a: "Every bag ships within two weeks of its roast date, printed right on the label. We roast in small batches to keep it that way." },
  { q: "Do you ship internationally?", a: "Yes — rates and delivery windows are calculated at checkout based on your address." },
  { q: "What's the difference between Premium and Everyday tiers?", a: "Premium lots are limited, higher-altitude, and priced closer to specialty-auction rates. Everyday varieties are still fully traceable, just produced at higher volume and priced for daily drinking." },
  { q: "Can I cancel an order?", a: "Yes, while it's still 'Processing' — before roasting begins. Cancel it yourself from My Aroma Journey, or contact us if it's already moved further along." },
  { q: "Can I subscribe for recurring deliveries?", a: "Subscriptions are coming soon. For now, reordering from My Aroma Journey takes about two clicks." },
  { q: "How do I know what I'm paying the farmer?", a: "Every product page and country page publishes the FOB price we paid — see the Source Library for the full breakdown." },
  { q: "I'm a roaster — can I buy green, unroasted coffee?", a: "Yes — our Green Coffee page sells the same traceable origins unroasted, by the kilogram, to roasters and serious home-roasters. Each lot lists its own minimum order quantity." },
  { q: "I run a café — can I order wholesale?", a: "Yes — use the quotation form in the footer, or sign in if you already have a trade account and it'll route straight to your rep." },
];

export const PROCESSING_METHODS = [
  { name: "Washed", icon: "💧", note: "Cherries are pulped and fermented in water before drying — cleaner, brighter cups." },
  { name: "Natural", icon: "☀️", note: "Whole cherries dry in the sun before pulping — heavier body, fruitier sweetness." },
  { name: "Honey", icon: "🍯", note: "Some mucilage is left on the bean during drying — a middle ground in body and clarity." },
];

export const SERVICES = [
  {
    id: "remote-consulting",
    icon: "🎓",
    title: "Remote Roasting & Brewing Consulting",
    tagline: "Your team, trained by ours — without anyone getting on a plane.",
    description:
      "For roasters, cafés, and restaurant groups who want to raise the bar without flying us in. We run live video sessions covering roast profile development, brew method training for your bar staff, and menu or recipe consulting built around the coffee you actually serve.",
    bullets: [
      "Roast profile development & troubleshooting, reviewed over video with your roast logs",
      "Brew method training for your team — pour-over, espresso, batch brew, cold brew",
      "Menu and recipe consulting tailored to your existing equipment",
      "Follow-up notes and a written action plan after every session",
    ],
    fee: "Hourly sessions or a multi-session package — quoted after a short discovery call.",
  },
  {
    id: "auction-representation",
    icon: "🤝",
    title: "Kenyan Auction Representation",
    tagline: "We're on the ground at the Nairobi Coffee Exchange — you don't have to be.",
    description:
      "Kenya's weekly auction moves fast, and the best lots don't wait. We represent international buyers directly on the floor — sourcing and requesting samples on your behalf, cupping and reporting back before you commit, and bidding for lots you approve. If you're visiting Kenya yourself, we can also join you as an in-person guide for auction day, from cupping room to floor.",
    bullets: [
      "We request and cup samples from upcoming lots on your behalf, with tasting notes sent to you",
      "We bid at the Nairobi Coffee Exchange for lots you approve, within the budget you set",
      "In-person assistance if you're visiting Kenya — we accompany you through cupping and the auction floor",
      "Logistics support for sample shipping and export paperwork",
    ],
    fee: "Per-lot commission for remote representation, or a day rate for in-person assistance during your visit.",
  },
];

export const SERVICE_PROCESS = [
  { step: "1", title: "Tell us what you need", detail: "A short form or call — your goals, your timeline, your budget." },
  { step: "2", title: "We match you with the right person", detail: "A roaster-trainer for consulting, or our Nairobi-based team for auction weeks." },
  { step: "3", title: "The session or sourcing happens", detail: "Live video training, or sample cupping and bidding on your behalf." },
  { step: "4", title: "You get a written follow-up", detail: "Action notes, cupping scores, or a lot recommendation — always in writing." },
];

export const RECIPE_CARDS = {
  "Espresso": { ratio: "18g in : 36g out, 25–30s", ingredients: ["18g finely-ground espresso roast"], steps: ["Dose and level 18g into the portafilter.", "Tamp firmly and evenly, lock into the group head.", "Pull for 25–30 seconds, targeting 36g in the cup.", "Serve immediately while the crema is intact."] },
  "Cappuccino": { ratio: "1:1:1 espresso, steamed milk, foam", ingredients: ["1 shot espresso (18g in)", "120ml whole milk"], steps: ["Pull one shot of espresso into a warmed cup.", "Steam milk to 60–65°C with a thick, glossy microfoam.", "Pour in equal thirds: espresso, milk, foam.", "Finish with a light dust of cocoa if you like."] },
  "Latte": { ratio: "1 shot espresso : 180ml steamed milk", ingredients: ["1 shot espresso (18g in)", "180ml whole milk"], steps: ["Pull one shot of espresso into a wide cup.", "Steam milk longer for a silkier, thinner microfoam.", "Pour slowly from height, then drop close for latte art.", "Practice a heart before attempting a rosetta."] },
  "Flat White": { ratio: "double espresso : 150ml micro-steamed milk", ingredients: ["Double shot espresso (18g in)", "150ml whole milk"], steps: ["Pull a double espresso into a small cup.", "Steam milk to a tight, velvety microfoam — less air than a latte.", "Pour in one continuous motion, staying close to the surface.", "Serve at a higher coffee-to-milk ratio than a latte."] },
  "Mocha": { ratio: "1 shot espresso : 20g chocolate : 150ml milk", ingredients: ["1 shot espresso", "20g dark chocolate or cocoa syrup", "150ml steamed milk"], steps: ["Melt chocolate into the espresso shot while hot.", "Steam milk and pour in, stirring gently to combine.", "Top with a thin layer of foam.", "Optional: whipped cream and a chocolate dusting."] },
  "Americano": { ratio: "1 shot espresso : 90ml hot water", ingredients: ["1–2 shots espresso", "Hot water"], steps: ["Pull espresso directly into the cup.", "Add hot water afterward to preserve the crema.", "Adjust water ratio to taste — more water, lighter body.", "Serve black or with milk on the side."] },
  "Cold Brew": { ratio: "100g coarse grounds : 1L cold water", ingredients: ["100g coarse-ground coffee", "1L cold or room-temperature water"], steps: ["Combine grounds and water in a large jar, stir to saturate.", "Cover and steep in the fridge for 16–18 hours.", "Strain through a paper filter or fine mesh.", "Dilute the concentrate 1:1 with water or milk over ice."] },
  "Turkish": { ratio: "1 heaped tsp per 60ml water, unfiltered", ingredients: ["Extra-fine ground coffee", "Cold water", "Sugar to taste (optional)"], steps: ["Add water, coffee, and sugar to a cezve, stir once.", "Heat slowly over low heat — do not stir again.", "Remove just as foam rises, before it boils over.", "Pour gently, letting the grounds settle before drinking."] },
  "Vietnamese": { ratio: "2 tbsp grounds per phin, 2–3 tbsp condensed milk", ingredients: ["Coarse dark-roast robusta", "Sweetened condensed milk"], steps: ["Add condensed milk to the bottom of the glass.", "Pack grounds into the phin filter, set over the glass.", "Pour a little hot water to bloom, then fill and cover.", "Let it drip fully, then stir and serve hot or over ice."] },
  "Moka Pot": { ratio: "Fill basket level, water to valve line", ingredients: ["Medium-fine ground coffee", "Water"], steps: ["Fill the base with water up to the safety valve.", "Fill the basket level with grounds — don't tamp.", "Assemble and place over medium-low heat, lid open.", "Remove as soon as it gurgles, before it sputters."] },
  "Affogato": { ratio: "1 shot espresso over 1 scoop gelato", ingredients: ["1 shot hot espresso", "1 scoop vanilla gelato or ice cream"], steps: ["Scoop gelato into a small glass or cup.", "Pull one shot of espresso directly over the top.", "Serve immediately, before it fully melts.", "Optional: a few chocolate-covered coffee beans on top."] },
  "Home Brewing": { ratio: "1:16 coffee to water (adjust to taste)", ingredients: ["Medium-fine ground coffee", "Filtered water, just off the boil"], steps: ["Rinse a paper filter, add grounds, bloom with 2x water for 30s.", "Pour the rest of the water in slow circles over ~3 minutes.", "Let it fully drain before removing the filter.", "Serve immediately while still hot."] },
};

export const MOMENTS = [
  {
    id: "first-light", name: "First Light", icon: "🌅",
    benefit: "Gentle, bright, easing you in",
    description:
      "The first cup shouldn't shout. First Light is for the quiet minutes before the day asks anything of you — a lighter roast, softer acidity, something floral enough to notice. Brew it slow and let the kitchen wake up with you.",
    brewGuide: "Pour-Over", brewSteps: [
      "Rinse a paper filter with hot water and discard the rinse.",
      "Add 18g medium-fine grounds, bloom with 40ml water for 30 seconds.",
      "Pour the remaining 250ml in slow circles over 3 minutes.",
    ],
  },
  {
    id: "the-hustle", name: "The Hustle", icon: "⚡",
    benefit: "Bold, fast, built for momentum",
    description:
      "Some mornings move before you do. The Hustle is a fuller-bodied, higher-acidity pour that holds up in a to-go cup — bright enough to notice between meetings, strong enough to finish the job.",
    brewGuide: "French Press", brewSteps: [
      "Add 30g coarse grounds to the press, pour 500ml just-off-boil water.",
      "Stir once, place the lid on with the plunger up, steep 4 minutes.",
      "Press slowly and pour immediately to stop extraction.",
    ],
  },
  {
    id: "the-reset", name: "The Reset", icon: "🌿",
    benefit: "Calm, low-acid, a mid-afternoon pause",
    description:
      "For the 3pm lull that isn't quite a coffee craving. The Reset leans on low-acid, naturally sweeter varieties — something you can drink slowly without it fighting your evening. A short pause disguised as a cup of coffee.",
    brewGuide: "Aeropress", brewSteps: [
      "Add 15g fine-medium grounds and 220ml hot water, stir for 10 seconds.",
      "Steep for 1 minute, then press gently over 30 seconds.",
      "Dilute with hot water to taste if it comes out concentrated.",
    ],
  },
  {
    id: "comfort", name: "Comfort", icon: "🕯️",
    benefit: "Rich, chocolatey, unhurried",
    description:
      "The last cup of the day, or the one you make when you need it to feel like a hug. Comfort favors round, chocolatey, low-acid coffees best brewed slow and sipped slower — no deadline attached.",
    brewGuide: "Moka Pot", brewSteps: [
      "Fill the base with water to the valve line, don't force the grounds.",
      "Pack the basket level (don't tamp), assemble, and set over medium-low heat.",
      "Remove from heat as soon as it starts gurgling, before it sputters dry.",
    ],
  },
];

export const DESCRIPTOR_TAGS = ["fruity", "floral", "chocolatey", "nutty", "bright", "smooth", "bold", "balanced", "sweet", "winey"];

export const FILTER_DEFS = {
  aroma: ["floral", "citrus", "fruity", "chocolate", "nutty", "sweet", "winey"],
  body: ["light", "medium", "full"],
  acidity: ["low", "medium", "high"],
  roast: ["light", "medium", "medium-dark"],
  moment: ["First Light", "The Hustle", "The Reset", "Comfort"],
  brew: ["Pour-Over", "French Press", "Aeropress", "Moka Pot", "Drip"],
};

export const ACADEMY_CATEGORIES = ["All", "Barista Skills", "Home Brewing", "Sensory", "Professional"];

export const GROWING_PATHS = ["Variety", "Country", "Growing Factor"];

export const CHECKOUT_STEPS = ["Review", "Sign in", "Shipping", "Payment", "Done"];

export const ADMIN_SECTIONS = ["Overview", "Analytics", "Orders", "Invoices", "Customers", "Products", "Inventory", "Content", "Quotations", "Service Inquiries", "Green Orders", "Live Chat", "Feedback", "Live Messages", "Audit Log", "Settings"];

// Real path-based routing map (e.g. /shop or /shop/geisha-panama) -- requires a real server for
// every environment that serves this app (a real SPA-fallback server in production, and Vite's
// own dev/preview servers locally), unlike the hash-based scheme this replaced, which worked
// identically even opened directly via file:// with no server at all. That trade-off was made
// deliberately: real paths are what let a server (and therefore search engines and social link
// previews) see which page is actually being requested at all, which file:// compatibility can't.
export const PAGE_TO_SLUG = {
  home: "", shop: "shop", product: "product", moments: "moments", moment: "moment",
  brewguides: "brew-guides", brewguide: "brew-guide", academy: "academy", course: "course",
  growing: "growing", growingprofile: "growing-profile", country: "country",
  growingfactor: "growing-factor", soilexplorer: "soil-explorer", seasons: "seasons",
  history: "history", promise: "our-promise", journey: "journey", checkout: "checkout",
  quiz: "quiz", rituals: "rituals", faq: "faq", contact: "contact",
  sourcelibrary: "source-library", admin: "admin", worldjourney: "world-journey", services: "services",
  privacy: "privacy", terms: "terms", greenbeans: "green-beans", searchresults: "search-results",
};
export const SLUG_TO_PAGE = Object.fromEntries(Object.entries(PAGE_TO_SLUG).map(([page, slug]) => [slug, page]));

// Per-page SEO metadata (static pages only — pages with an :id, like product/moment/course,
// build their title dynamically from the item itself at render time; see useDocumentMeta).
export const PAGE_META = {
  home: { title: "Morning Aroma — Where quality meets its scent.", description: "Traceable, fairly-priced specialty coffee. Shop by variety, learn to brew, and explore where every bag comes from." },
  shop: { title: "Shop All Coffee — Morning Aroma", description: "Browse our full specialty coffee catalog, filterable by aroma, body, acidity, roast level, and brew method." },
  moments: { title: "Coffee Moments — Morning Aroma", description: "A coffee for every hour — First Light, The Hustle, The Reset, and Comfort, each with a matched variety and brew guide." },
  brewguides: { title: "Brew Guides — Morning Aroma", description: "Step-by-step guides for pour-over, French press, espresso, cold brew, moka pot, and Aeropress." },
  academy: { title: "Academy — Morning Aroma", description: "Learn to make espresso, cappuccino, latte, and more — courses taught by working baristas and roasters." },
  growing: { title: "Growing Library — Morning Aroma", description: "Explore coffee by variety, by country, or by the growing factors — altitude, rainfall, soil pH — that shape flavor." },
  seasons: { title: "Coffee Seasons & Auctions — Morning Aroma", description: "The global coffee harvest calendar, country by country, plus auction details for origins like Kenya." },
  history: { title: "The Bean's Journey — Morning Aroma", description: "A scroll through coffee's history, from a 6th-century legend to the specialty movement, plus eight legendary moments." },
  promise: { title: "Our Promise — Morning Aroma", description: "Our vision, mission, and the core values we hold ourselves to — traceability, fair pricing, and craft over speed." },
  journey: { title: "My Aroma Journey — Morning Aroma", description: "Your coffee journal, flavor fingerprint, personalized recommendations, and order history." },
  checkout: { title: "Checkout — Morning Aroma", description: "Complete your order." },
  quiz: { title: "Aroma Quiz — Morning Aroma", description: "Answer four quick questions and we'll match you to a variety." },
  rituals: { title: "Global Rituals — Morning Aroma", description: "Coffee ceremonies from around the world — Ethiopian Bunna, Turkish Kahve, Italian espresso culture, and more." },
  faq: { title: "FAQ — Morning Aroma", description: "Answers to common questions about freshness, shipping, subscriptions, and wholesale." },
  contact: { title: "Contact Us — Morning Aroma", description: "Get in touch with the Morning Aroma team." },
  sourcelibrary: { title: "Source Library — Morning Aroma", description: "Origin maps, processing methods, and published FOB pricing — full transparency on where your coffee comes from." },
  admin: { title: "Admin Dashboard — Morning Aroma", description: "Store management dashboard." },
  worldjourney: { title: "The World Journey — Morning Aroma", description: "All eight origin countries, their coffee history, and the varieties grown there." },
  services: { title: "Our Services — Morning Aroma", description: "Remote roasting and brewing consulting, plus Kenyan coffee auction representation, for businesses." },
  privacy: { title: "Privacy Policy — Morning Aroma", description: "How Morning Aroma handles your data." },
  terms: { title: "Terms of Service — Morning Aroma", description: "The terms governing use of the Morning Aroma site." },
  greenbeans: { title: "Green Coffee — Wholesale — Morning Aroma", description: "Unroasted green coffee, sold by the kilogram to roasters and serious home-roasters. Same traceable origins as our retail catalog." },
};

export const KNOWN_ROUTES = new Set([
  "home", "shop", "product", "moments", "moment", "brewguides", "brewguide", "academy", "course",
  "growing", "growingprofile", "country", "growingfactor", "soilexplorer", "seasons", "history",
  "promise", "journey", "checkout", "quiz", "rituals", "faq", "contact", "sourcelibrary", "admin",
  "worldjourney", "services", "privacy", "terms", "greenbeans", "searchresults",
]);

export const MARQUEE_IMAGES = [
  // original hero-adjacent set
  "https://images.unsplash.com/photo-1740593021483-a898ac0d4ab7?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1753837787691-84a06d715d24?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1753652735948-47b47c1d5713?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1761271046396-97d231b59dd7?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1757688341742-ce7978cdb186?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1639527924446-3edc522ae4b0?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=500&q=60",
  // coffee beans, close up
  "https://images.unsplash.com/photo-1675306408031-a9aad9f23308?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1606486544554-164d98da4889?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1580933073521-dc49ac0d4e6a?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1586095516671-d085ff58cdd4?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1612487458970-564127ec86f5?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1692296113053-76f240e5ce33?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1620820186187-fc32e79adb74?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1679065102501-aa6ae854f5e4?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1628236876894-dbde8ff5a944?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1740432612998-eb9609d8bbb5?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1442550528053-c431ecb55509?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1551610290-e153ec567dd8?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1692299108834-038511803008?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1515694590185-73647ba02c10?auto=format&fit=crop&w=500&q=60",
  // latte art, cafe cups, brewing in progress
  "https://images.unsplash.com/photo-1593443320739-77f74939d0da?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1529892485617-25f63cd7b1e9?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1497636577773-f1231844b336?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1670404161009-29548c027d06?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1579265898841-79c7890d69cf?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1563311977-d285756282dc?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1559001724-fbad036dbc9e?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1596018589878-217d8603c4c6?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1650097364104-eef0e54af0da?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1531441802565-2948024f1b22?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1503240778100-fd245e17a273?auto=format&fit=crop&w=500&q=60",
  "https://images.unsplash.com/photo-1681838853984-697bbb001257?auto=format&fit=crop&w=500&q=60",
];

// Keyword-matched canned replies for the live chat widget — first match wins, checked in order,
// falling back to a generic "we'll follow up" message when nothing matches.
export const CHAT_CANNED_RESPONSES = [
  { keywords: ["ship", "shipping", "deliver", "delivery"], reply: "We ship within two weeks of the roast date printed on your bag. Delivery windows and rates are calculated at checkout based on your address." },
  { keywords: ["price", "cost", "how much", "pricing"], reply: "Pricing varies by variety — Everyday coffees start around $16-19, Premium/Rare lots run higher given limited availability. Every product page shows the current price." },
  { keywords: ["wholesale", "cafe", "café", "restaurant", "b2b", "bulk"], reply: "For wholesale or café accounts, our Our Services page covers remote consulting and Kenyan auction representation — or use the quotation form in the footer and our trade team will follow up." },
  { keywords: ["return", "refund", "cancel", "cancel order"], reply: "If something's not right with an order, reply here with your order details and we'll sort it out — refunds and exchanges are handled case by case within 30 days." },
  { keywords: ["brew", "brewing", "grind", "ratio", "how do i make"], reply: "Our Brew Guides cover pour-over, French press, espresso, cold brew, moka pot, and Aeropress step by step — worth a look before your next cup." },
  { keywords: ["subscription", "subscribe", "recurring"], reply: "Subscriptions aren't live yet — for now, reordering from My Aroma Journey takes about two clicks once you've placed a first order." },
  { keywords: ["hour", "open", "location", "where are you"], reply: "We're an online-first specialty roaster — no physical storefront yet, but our roasting and sourcing team is reachable here, by WhatsApp, or by email any weekday." },
  { keywords: ["kenya", "auction", "nairobi"], reply: "We represent buyers directly at the Nairobi Coffee Exchange — sourcing samples on your behalf, or joining you in person if you're visiting. More on the Our Services page." },
];

// A curated set, not Google Translate's full ~130-language list — chosen to reflect the brand's
// "welcoming novices, connoisseurs, and coffee lovers from every culture" value from the original
// brief, prioritizing the languages of the countries this site's own coffee comes from (Swahili,
// Spanish, Portuguese) alongside other widely-spoken world languages. Codes are Google Translate's
// own language codes, used directly with the Website Translator widget.
export const TRANSLATE_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
];

// Best-effort country -> suggested language mapping, used only to phrase the auto-suggest banner
// ("Browsing from Kenya? View this in Swahili") — falls back to browser language alone if the
// geolocation lookup fails or the country isn't in this list.
export const COUNTRY_TO_LANGUAGE = {
  KE: "sw", TZ: "sw", UG: "sw",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es",
  BR: "pt", PT: "pt",
  FR: "fr", BE: "fr",
  DE: "de", AT: "de", CH: "de",
  SA: "ar", AE: "ar", EG: "ar",
  IN: "hi",
  CN: "zh-CN",
  JP: "ja",
  VN: "vi",
  TR: "tr",
};

// A curated set of currencies for the manual picker (real-time conversion covers any ISO 4217
// code the exchange-rate API returns — this list is just what's offered in the UI dropdown).
// Prioritizes USD (the store's ledger currency) and KES (Kenya, this brand's strongest origin
// tie) alongside other widely-used currencies.
export const CURRENCIES = [
  { code: "USD", label: "US Dollar", flag: "🇺🇸" },
  { code: "KES", label: "Kenyan Shilling", flag: "🇰🇪" },
  { code: "EUR", label: "Euro", flag: "🇪🇺" },
  { code: "GBP", label: "British Pound", flag: "🇬🇧" },
  { code: "JPY", label: "Japanese Yen", flag: "🇯🇵" },
  { code: "CNY", label: "Chinese Yuan", flag: "🇨🇳" },
  { code: "INR", label: "Indian Rupee", flag: "🇮🇳" },
  { code: "ZAR", label: "South African Rand", flag: "🇿🇦" },
  { code: "NGN", label: "Nigerian Naira", flag: "🇳🇬" },
  { code: "GHS", label: "Ghanaian Cedi", flag: "🇬🇭" },
  { code: "CAD", label: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", label: "Australian Dollar", flag: "🇦🇺" },
  { code: "BRL", label: "Brazilian Real", flag: "🇧🇷" },
];

