/**
 * storeCatalog.js
 *
 * Organizes purchasable assets into named stores per category.
 * Each store has branded listings — specific make/model names, type labels,
 * and per-listing prices that override the catalog base cost.
 *
 * Stores use `catalogId` to reference the underlying asset catalog entry
 * for stats, upkeep, appreciation rate, and type.
 *
 * Structure:
 *   STORE_CATALOG[category] = [ ...stores ]
 *   store.listings = [ { catalogId, displayName, typeLabel, price } ]
 */

export const STORE_CATALOG = {

  // ── Real Estate ──────────────────────────────────────────────────────────
  realEstate: [
    {
      id: 'prestige_realty',
      name: 'Prestige Realty',
      icon: '🏢',
      tagline: 'Your first step onto the property ladder',
      minTier: 'struggling',
      listings: [
        { catalogId: 'studio_apt', displayName: 'Studio Loft (412 Maple Ave)', typeLabel: 'Studio · 450 sqft', price: 48_500 },
        { catalogId: 'studio_apt', displayName: 'Urban Studio (88 Creek Rd)', typeLabel: 'Studio · 520 sqft', price: 53_000 },
        { catalogId: 'studio_apt', displayName: 'Downtown Micro-Unit (9 Harbor St)', typeLabel: 'Studio · 380 sqft', price: 44_900 },
      ],
    },
    {
      id: 'cornerstone_properties',
      name: 'Cornerstone Properties',
      icon: '🏡',
      tagline: 'Mid-range homes for working families',
      minTier: 'working',
      listings: [
        { catalogId: 'city_condo',    displayName: 'The Meridian (2201 West Blvd #4B)', typeLabel: 'Condo · 2BR · 1,100 sqft', price: 118_500 },
        { catalogId: 'city_condo',    displayName: 'Park View Condo (55 Elgin Ave #12)', typeLabel: 'Condo · 2BR · 975 sqft', price: 124_000 },
        { catalogId: 'suburban_home', displayName: 'Colonial House (1847 Birch Lane)', typeLabel: 'House · 3BR · 1,800 sqft', price: 245_000 },
        { catalogId: 'suburban_home', displayName: 'Ranch Home (4102 Sycamore Dr)', typeLabel: 'House · 4BR · 2,100 sqft', price: 258_900 },
        { catalogId: 'suburban_home', displayName: 'Split-Level Home (730 Oak Hollow)', typeLabel: 'House · 3BR · 1,950 sqft', price: 251_500 },
      ],
    },
    {
      id: 'allure_real_estate',
      name: 'Allure Real Estate',
      icon: '🏘️',
      tagline: 'Premium properties for discerning buyers',
      minTier: 'middle',
      listings: [
        { catalogId: 'townhouse',       displayName: 'Heritage Townhouse (301 Rosewood Ct)', typeLabel: 'Townhouse · 4BR · 2,800 sqft', price: 395_000 },
        { catalogId: 'townhouse',       displayName: 'Lakeview Townhome (18 Marina Terrace)', typeLabel: 'Townhouse · 3BR · 2,500 sqft', price: 410_000 },
        { catalogId: 'beachfront_villa', displayName: 'Ocean Breeze Villa (7 Shoreline Dr)', typeLabel: 'Villa · 5BR · 4,200 sqft', price: 795_000 },
        { catalogId: 'beachfront_villa', displayName: 'Coral Crest Estate (221 Pacific Rim)', typeLabel: 'Villa · 4BR · 3,900 sqft', price: 820_000 },
      ],
    },
    {
      id: 'pinnacle_luxury_estates',
      name: 'Pinnacle Luxury Estates',
      icon: '🌆',
      tagline: 'Exclusive residences for the ultra-successful',
      minTier: 'wealthy',
      listings: [
        { catalogId: 'penthouse', displayName: 'Sky Penthouse (1 Apex Tower, PH1)', typeLabel: 'Penthouse · 6BR · 6,500 sqft', price: 1_190_000 },
        { catalogId: 'penthouse', displayName: 'Cloud Nine Penthouse (88 Zenith Blvd)', typeLabel: 'Penthouse · 5BR · 5,800 sqft', price: 1_240_000 },
        { catalogId: 'mega_mansion', displayName: 'Stratford Estate (4200 Grand Oak Ln)', typeLabel: 'Mansion · 9BR · 14,000 sqft', price: 4_900_000 },
        { catalogId: 'mega_mansion', displayName: 'Ridgeline Manor (900 Summit Ridge)', typeLabel: 'Mansion · 8BR · 12,500 sqft', price: 5_200_000 },
      ],
    },
    {
      id: 'elite_global_properties',
      name: 'Elite Global Properties',
      icon: '🏝️',
      tagline: 'One-of-a-kind properties for the world\'s elite',
      minTier: 'rich',
      listings: [
        { catalogId: 'mega_mansion', displayName: 'Futuristic Home (3905 Beacon Place)', typeLabel: 'Mega Estate · 10BR · 18,000 sqft', price: 5_850_000 },
        { catalogId: 'mega_mansion', displayName: 'Vampire Estate (103 Sighisoara)', typeLabel: 'Gothic Estate · 12BR · 22,000 sqft', price: 5_100_000 },
        { catalogId: 'private_island', displayName: 'Azura Island (Caribbean Sea)', typeLabel: 'Private Island · 80 acres', price: 48_500_000 },
        { catalogId: 'private_island', displayName: 'Selene Atoll (South Pacific)', typeLabel: 'Private Island · 120 acres', price: 52_000_000 },
      ],
    },
  ],

  // ── Vehicles ─────────────────────────────────────────────────────────────
  vehicles: [
    {
      id: 'budget_auto_sales',
      name: 'Budget Auto Sales',
      icon: '🚗',
      tagline: 'Affordable rides, no BS',
      minTier: 'broke',
      listings: [
        { catalogId: 'used_clunker', displayName: 'Ford Fiesta (Used Hatchback)', typeLabel: '2009 · 148k miles', price: 2_800 },
        { catalogId: 'used_clunker', displayName: 'Chevy Spark (Used City Car)', typeLabel: '2011 · 132k miles', price: 3_200 },
        { catalogId: 'used_clunker', displayName: 'Dodge Neon (Used Sedan)', typeLabel: '2007 · 189k miles', price: 2_400 },
        { catalogId: 'economy_car',  displayName: 'Toyota Corolla (Economy Sedan)', typeLabel: '2019 · 28k miles', price: 14_800 },
        { catalogId: 'economy_car',  displayName: 'Honda Fit (Economy Hatchback)', typeLabel: '2020 · 22k miles', price: 15_500 },
      ],
    },
    {
      id: 'metro_motors',
      name: 'Metro Motors',
      icon: '🚘',
      tagline: 'New and certified pre-owned',
      minTier: 'working',
      listings: [
        { catalogId: 'economy_car', displayName: 'Hyundai Elantra (New Compact)', typeLabel: '2024 · New', price: 16_200 },
        { catalogId: 'sedan',       displayName: 'BMW 3-Series (New Sedan)', typeLabel: '2024 · New', price: 42_000 },
        { catalogId: 'sedan',       displayName: 'Mercedes C-Class (New Sedan)', typeLabel: '2024 · New', price: 44_500 },
        { catalogId: 'sedan',       displayName: 'Audi A4 (New Sedan)', typeLabel: '2024 · New', price: 41_200 },
        { catalogId: 'sedan',       displayName: 'Tesla Model 3 (Electric Sedan)', typeLabel: '2024 · New', price: 43_990 },
      ],
    },
    {
      id: 'premium_auto_group',
      name: 'Premium Auto Group',
      icon: '🛻',
      tagline: 'Luxury vehicles for elevated living',
      minTier: 'middle',
      listings: [
        { catalogId: 'suv',        displayName: 'BMW X5 (Luxury SUV)', typeLabel: '2024 · New', price: 72_000 },
        { catalogId: 'suv',        displayName: 'Mercedes GLE (Luxury SUV)', typeLabel: '2024 · New', price: 78_500 },
        { catalogId: 'suv',        displayName: 'Cadillac Escalade (Full-Size SUV)', typeLabel: '2024 · New', price: 82_000 },
        { catalogId: 'sedan',      displayName: 'BMW 5-Series (Used Sedan)', typeLabel: '2022 · 18k miles', price: 48_836 },
        { catalogId: 'sports_car', displayName: 'Porsche 718 Cayman (Sports Coupé)', typeLabel: '2024 · New', price: 118_000 },
      ],
    },
    {
      id: 'apex_motorsports',
      name: 'Apex Motorsports',
      icon: '🏎️',
      tagline: 'Performance machines for true enthusiasts',
      minTier: 'upper_middle',
      listings: [
        { catalogId: 'sports_car', displayName: 'Porsche 911 GT3 (Sports Coupé)', typeLabel: '2024 · New', price: 122_000 },
        { catalogId: 'sports_car', displayName: 'Ferrari Roma (Grand Tourer)', typeLabel: '2024 · New', price: 125_000 },
        { catalogId: 'sports_car', displayName: 'Lamborghini Urus (Super SUV)', typeLabel: '2024 · New', price: 128_000 },
        { catalogId: 'supercar',   displayName: 'Ferrari 488 Pista (Supercar)', typeLabel: '2024 · New', price: 295_000 },
        { catalogId: 'supercar',   displayName: 'McLaren 720S (Supercar)', typeLabel: '2024 · New', price: 308_000 },
        { catalogId: 'supercar',   displayName: 'Lamborghini Huracán EVO (Supercar)', typeLabel: '2024 · New', price: 285_000 },
      ],
    },
    {
      id: 'anderson_race_world',
      name: 'Anderson Race World',
      icon: '⚡',
      tagline: 'The fastest machines on earth',
      minTier: 'wealthy',
      listings: [
        { catalogId: 'supercar',  displayName: 'Bugatti Veyron (Hypercar)', typeLabel: '2020 · 8k miles', price: 1_600_000 },
        { catalogId: 'hypercar',  displayName: 'Bugatti Chiron (Hypercar)', typeLabel: '2024 · New', price: 2_500_000 },
        { catalogId: 'hypercar',  displayName: 'Koenigsegg Jesko (Hypercar)', typeLabel: '2024 · New', price: 2_800_000 },
        { catalogId: 'hypercar',  displayName: 'McLaren Speedtail (Hypercar)', typeLabel: '2024 · New', price: 2_200_000 },
        { catalogId: 'hypercar',  displayName: 'Rimac Nevera (Electric Hypercar)', typeLabel: '2024 · New', price: 2_400_000 },
      ],
    },
    {
      id: 'san_diego_aircraft_brokers',
      name: 'San Diego Aircraft Brokers',
      icon: '✈️',
      tagline: 'Private aviation for the discerning traveller',
      minTier: 'rich',
      listings: [
        { catalogId: 'private_jet', displayName: 'Beechcraft Baron G58 (Propeller)', typeLabel: '6-seat turboprop', price: 1_482_200 },
        { catalogId: 'private_jet', displayName: 'Cessna Citation XLS (Light Jet)', typeLabel: '8-seat · Range 2,100 nm', price: 8_900_000 },
        { catalogId: 'private_jet', displayName: 'Gulfstream G650 (Large Cabin Jet)', typeLabel: '14-seat · Range 7,000 nm', price: 38_500_000 },
        { catalogId: 'private_jet', displayName: 'Airbus A320 Prestige (Airliner Jet)', typeLabel: '30-seat VIP conversion', price: 98_010_304 },
        { catalogId: 'private_jet', displayName: 'Boeing 737 BBJ (Ultra-Long Range)', typeLabel: '40-seat VIP · Range 6,500 nm', price: 84_000_000 },
      ],
    },
  ],

  // ── Luxury Goods ─────────────────────────────────────────────────────────
  luxury: [
    {
      id: 'meridian_jewelers',
      name: 'Meridian Jewelers',
      icon: '⌚',
      tagline: 'Swiss timepieces and fine jewelry',
      minTier: 'working',
      listings: [
        { catalogId: 'designer_watch', displayName: 'Rolex Submariner (Diver\'s Watch)', typeLabel: 'Stainless Steel · 40mm', price: 8_500 },
        { catalogId: 'designer_watch', displayName: 'Omega Speedmaster (Chronograph)', typeLabel: 'Steel on Bracelet · 42mm', price: 7_200 },
        { catalogId: 'designer_watch', displayName: 'TAG Heuer Monaco (Racing Watch)', typeLabel: 'Square Case · 39mm', price: 6_800 },
      ],
    },
    {
      id: 'doolittle_brothers_jewelry',
      name: 'Doolittle Brothers Jewelry',
      icon: '💍',
      tagline: 'Bespoke fine jewelry and rare gems',
      minTier: 'wealthy',
      listings: [
        { catalogId: 'custom_jewelry', displayName: 'Diamond Tennis Bracelet (18K Gold)', typeLabel: '12 carats · Vs1 Clarity', price: 95_000 },
        { catalogId: 'custom_jewelry', displayName: 'Sapphire & Diamond Set (Platinum)', typeLabel: '15 carats · Ceylon Sapphire', price: 108_000 },
        { catalogId: 'custom_jewelry', displayName: 'Emerald Parure (Custom Commission)', typeLabel: '22 carats · Colombian Emeralds', price: 125_000 },
        { catalogId: 'designer_watch', displayName: 'Patek Philippe Nautilus (Watch)', typeLabel: 'Rose Gold · 40mm', price: 85_000 },
        { catalogId: 'designer_watch', displayName: 'Audemars Piguet Royal Oak (Watch)', typeLabel: 'Titanium · 41mm · Skeletonised', price: 72_000 },
      ],
    },
    {
      id: 'prestige_galleries',
      name: 'Prestige Galleries',
      icon: '🖼️',
      tagline: 'Investment-grade contemporary art',
      minTier: 'middle',
      listings: [
        { catalogId: 'fine_art', displayName: 'Urban Nocturne (Oil on Canvas)', typeLabel: 'Rising artist · 36×48 in', price: 22_000 },
        { catalogId: 'fine_art', displayName: 'Abstract Triptych (Mixed Media)', typeLabel: 'Certified original · 3 panels', price: 28_500 },
        { catalogId: 'fine_art', displayName: 'Coastal Series No.7 (Watercolour)', typeLabel: 'Limited edition print · Signed', price: 18_000 },
        { catalogId: 'rare_masterpiece', displayName: 'Baroque Interior Study (Old Master)', typeLabel: 'Attributed 17th C. · Authenticated', price: 7_500_000 },
        { catalogId: 'rare_masterpiece', displayName: 'Post-War Abstract (Warhol School)', typeLabel: 'Museum provenance · Catalogued', price: 8_800_000 },
      ],
    },
    {
      id: 'grand_cellar',
      name: 'Grand Cellar',
      icon: '🍷',
      tagline: 'Rare wines and fine spirits for the connoisseur',
      minTier: 'upper_middle',
      listings: [
        { catalogId: 'rare_wine', displayName: 'Burgundy Grand Cru Collection', typeLabel: '120 bottles · 2009–2015 vintages', price: 48_000 },
        { catalogId: 'rare_wine', displayName: 'Bordeaux First Growth Cellar', typeLabel: '96 bottles · Château Pétrus & Lafite', price: 55_000 },
        { catalogId: 'rare_wine', displayName: 'Pappy Van Winkle Bourbon Collection', typeLabel: '48 bottles · 20–23yr reserve', price: 52_000 },
      ],
    },
    {
      id: 'giuliani_marine',
      name: 'Giuliani Marine',
      icon: '🛥️',
      tagline: 'World-class superyachts and motor vessels',
      minTier: 'rich',
      listings: [
        { catalogId: 'superyacht', displayName: 'M/Y Poseidon Dream (Motor Yacht)', typeLabel: '45m · 8 guests · Crew of 8', price: 12_500_000 },
        { catalogId: 'superyacht', displayName: 'M/Y Azure Legend (Superyacht)', typeLabel: '62m · 12 guests · Crew of 14', price: 16_000_000 },
        { catalogId: 'superyacht', displayName: 'S/Y Solaris (Sailing Superyacht)', typeLabel: '58m · 10 guests · Eco hybrid', price: 14_200_000 },
      ],
    },
    {
      id: 'apex_collections',
      name: 'Apex Collections',
      icon: '🎨',
      tagline: 'Trophy assets for the ultra-wealthy',
      minTier: 'ultra',
      listings: [
        { catalogId: 'rare_masterpiece', displayName: 'Private Monet (Water Lilies Study)', typeLabel: 'Impressionist · 1906 · Authenticated', price: 9_200_000 },
        { catalogId: 'rare_masterpiece', displayName: 'Basquiat Original (Neo-Expressionist)', typeLabel: 'SAMO era · 1983 · Museum provenance', price: 11_500_000 },
        { catalogId: 'superyacht', displayName: 'M/Y Titan One (Explorer Yacht)', typeLabel: '75m · 14 guests · Expedition class', price: 18_900_000 },
      ],
    },
  ],

  // ── Investments ──────────────────────────────────────────────────────────
  investments: [
    {
      id: 'horizon_wealth_mgmt',
      name: 'Horizon Wealth Management',
      icon: '📊',
      tagline: 'Diversified portfolios for long-term wealth',
      minTier: 'working',
      listings: [
        { catalogId: 'index_fund', displayName: 'Horizon S&P 500 Index Fund', typeLabel: 'Diversified · 0.03% expense ratio', price: 10_000 },
        { catalogId: 'index_fund', displayName: 'Total World Market ETF', typeLabel: 'Global diversification · Low fee', price: 10_000 },
        { catalogId: 'bonds',      displayName: 'U.S. Treasury Bond Portfolio', typeLabel: '10-yr yield · Government backed', price: 25_000 },
        { catalogId: 'bonds',      displayName: 'Municipal Bond Bundle', typeLabel: 'Tax-advantaged · Investment grade', price: 25_000 },
      ],
    },
    {
      id: 'sterling_capital',
      name: 'Sterling Capital Partners',
      icon: '🏦',
      tagline: 'Institutional-grade alternative investments',
      minTier: 'upper_middle',
      listings: [
        { catalogId: 'hedge_fund', displayName: 'Sterling Macro Opportunities Fund', typeLabel: 'Global macro · Min $500k', price: 500_000 },
        { catalogId: 'hedge_fund', displayName: 'Quant Alpha Strategy Fund', typeLabel: 'Algorithmic trading · 2+20', price: 500_000 },
        { catalogId: 'vc_fund',    displayName: 'Sterling Ventures Series B Fund', typeLabel: 'Late-stage tech · Min $1M', price: 1_000_000 },
      ],
    },
    {
      id: 'venture_partners',
      name: 'Venture Partners Group',
      icon: '🚀',
      tagline: 'High-risk, high-reward venture & PE',
      minTier: 'wealthy',
      listings: [
        { catalogId: 'vc_fund',        displayName: 'Unicorn Accelerator Fund IV', typeLabel: 'Early-stage AI/tech · 5yr lockup', price: 1_000_000 },
        { catalogId: 'vc_fund',        displayName: 'Biotech Breakthrough Fund', typeLabel: 'Life sciences · High variance', price: 1_000_000 },
        { catalogId: 'private_equity', displayName: 'Summit Buyout Fund VII', typeLabel: 'Mid-market LBOs · 10yr horizon', price: 5_000_000 },
        { catalogId: 'private_equity', displayName: 'Infrastructure Growth Fund', typeLabel: 'Toll roads, airports · Stable yield', price: 5_000_000 },
      ],
    },
  ],
};

/**
 * Returns all stores for a given category, with each store's listings
 * enriched from the asset catalog.
 * Each listing gets: locked flag, canAfford, catalogEntry (for upkeep/type/stats).
 */
export const STORE_TIER_ORDER = ['broke', 'struggling', 'working', 'middle', 'upper_middle', 'wealthy', 'rich', 'ultra'];

export function getStoresByCategory(category, playerTierId, catalogLookup) {
  const stores = STORE_CATALOG[category] ?? [];
  const playerRank = STORE_TIER_ORDER.indexOf(playerTierId);

  return stores.map(store => {
    const storeLocked = STORE_TIER_ORDER.indexOf(store.minTier) > playerRank;
    const enrichedListings = store.listings.map(listing => {
      const catalogEntry = catalogLookup[listing.catalogId];
      const minTier = catalogEntry?.minTier ?? 'broke';
      const itemRank = STORE_TIER_ORDER.indexOf(minTier);
      return {
        ...listing,
        catalogEntry,
        locked: itemRank > playerRank,
        upkeep: catalogEntry?.upkeep ?? 0,
        type: catalogEntry?.type ?? 'luxury',
        icon: catalogEntry?.icon ?? '📦',
        statEffects: catalogEntry?.statEffects ?? {},
        appreciationRate: catalogEntry?.appreciationRate ?? 1.0,
        returnProfile: catalogEntry?.returnProfile,
        minTier,
      };
    });
    return { ...store, locked: storeLocked, listings: enrichedListings };
  });
}
