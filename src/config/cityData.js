export const CITIES = [
  // United States
  { id: 'nyc',         name: 'New York City', country: 'US',           salaryMultiplier: 1.30, colMultiplier: 1.40, moveCost: 5000, description: 'High pay, high cost. The city that never sleeps.' },
  { id: 'sf',          name: 'San Francisco', country: 'US',           salaryMultiplier: 1.35, colMultiplier: 1.50, moveCost: 5000, description: 'Tech hub with sky-high rent.' },
  { id: 'austin',      name: 'Austin',        country: 'US',           salaryMultiplier: 1.10, colMultiplier: 1.05, moveCost: 2000, description: 'Growing tech scene, affordable living.' },
  { id: 'chicago',     name: 'Chicago',       country: 'US',           salaryMultiplier: 1.15, colMultiplier: 1.10, moveCost: 2500, description: 'Midwest powerhouse with four seasons.' },
  { id: 'miami',       name: 'Miami',         country: 'US',           salaryMultiplier: 1.05, colMultiplier: 1.15, moveCost: 2500, description: 'Sun, nightlife, and no state income tax.' },

  // United Kingdom
  { id: 'london',      name: 'London',        country: 'UK',           salaryMultiplier: 1.20, colMultiplier: 1.35, moveCost: 4000, description: 'Finance and culture, notoriously expensive.' },
  { id: 'manchester',  name: 'Manchester',    country: 'UK',           salaryMultiplier: 0.95, colMultiplier: 0.85, moveCost: 2000, description: 'Northern grit, lower costs.' },

  // Canada
  { id: 'toronto',     name: 'Toronto',       country: 'Canada',       salaryMultiplier: 1.10, colMultiplier: 1.20, moveCost: 3000, description: "Canada's financial capital." },
  { id: 'vancouver',   name: 'Vancouver',     country: 'Canada',       salaryMultiplier: 1.05, colMultiplier: 1.25, moveCost: 3000, description: 'Beautiful mountains, brutal housing costs.' },
  { id: 'montreal',    name: 'Montreal',      country: 'Canada',       salaryMultiplier: 0.95, colMultiplier: 0.85, moveCost: 1500, description: 'Culture, art, and affordable rent.' },

  // Australia
  { id: 'sydney',      name: 'Sydney',        country: 'Australia',    salaryMultiplier: 1.15, colMultiplier: 1.25, moveCost: 4000, description: 'Harbour views, premium prices.' },
  { id: 'melbourne',   name: 'Melbourne',     country: 'Australia',    salaryMultiplier: 1.10, colMultiplier: 1.15, moveCost: 3500, description: 'Coffee culture and liveability.' },

  // Japan
  { id: 'tokyo',       name: 'Tokyo',         country: 'Japan',        salaryMultiplier: 1.00, colMultiplier: 1.15, moveCost: 4500, description: 'Dense, efficient, and intensely competitive.' },
  { id: 'osaka',       name: 'Osaka',         country: 'Japan',        salaryMultiplier: 0.90, colMultiplier: 0.90, moveCost: 3000, description: 'Friendlier and more affordable than Tokyo.' },

  // Brazil
  { id: 'sao_paulo',   name: 'São Paulo',     country: 'Brazil',       salaryMultiplier: 0.75, colMultiplier: 0.60, moveCost: 2000, description: "Brazil's economic engine, always hustling." },
  { id: 'rio',         name: 'Rio de Janeiro',country: 'Brazil',       salaryMultiplier: 0.65, colMultiplier: 0.55, moveCost: 1500, description: 'Beaches and inequality in equal measure.' },

  // Germany
  { id: 'berlin',      name: 'Berlin',        country: 'Germany',      salaryMultiplier: 1.00, colMultiplier: 0.95, moveCost: 3000, description: 'Creative capital with strong worker protections.' },
  { id: 'munich',      name: 'Munich',        country: 'Germany',      salaryMultiplier: 1.15, colMultiplier: 1.20, moveCost: 3500, description: 'Engineering hub, high salaries, high rents.' },

  // France
  { id: 'paris',       name: 'Paris',         country: 'France',       salaryMultiplier: 1.05, colMultiplier: 1.20, moveCost: 3500, description: 'The city of light has a price tag to match.' },

  // India
  { id: 'mumbai',      name: 'Mumbai',        country: 'India',        salaryMultiplier: 0.55, colMultiplier: 0.35, moveCost: 1000, description: 'Financial capital of India, intense and vibrant.' },
  { id: 'bangalore',   name: 'Bangalore',     country: 'India',        salaryMultiplier: 0.60, colMultiplier: 0.30, moveCost:  800, description: "India's Silicon Valley." },

  // Nigeria
  { id: 'lagos',       name: 'Lagos',         country: 'Nigeria',      salaryMultiplier: 0.50, colMultiplier: 0.30, moveCost: 1000, description: "Africa's largest city, full of hustle." },

  // South Africa
  { id: 'cape_town',   name: 'Cape Town',     country: 'South Africa', salaryMultiplier: 0.55, colMultiplier: 0.40, moveCost: 1500, description: 'Stunning scenery, stark inequality.' },

  // Mexico
  { id: 'mexico_city', name: 'Mexico City',   country: 'Mexico',       salaryMultiplier: 0.60, colMultiplier: 0.40, moveCost: 1200, description: 'Massive metropolis with incredible food.' },

  // South Korea
  { id: 'seoul',       name: 'Seoul',         country: 'South Korea',  salaryMultiplier: 0.95, colMultiplier: 0.85, moveCost: 3500, description: 'K-culture global epicenter, brutally competitive.' },
];

// Country name used in CharacterCreation mapped to city country field
const COUNTRY_MAP = {
  'United States': 'US',
  'United Kingdom': 'UK',
  'Canada': 'Canada',
  'Australia': 'Australia',
  'Japan': 'Japan',
  'Brazil': 'Brazil',
  'Germany': 'Germany',
  'France': 'France',
  'India': 'India',
  'Mexico': 'Mexico',
  'South Korea': 'South Korea',
  'Nigeria': 'Nigeria',
  'South Africa': 'South Africa',
};

export function getCitiesForCountry(country) {
  // Accept either the display name (e.g. 'United States') or the city country field (e.g. 'US')
  const mapped = COUNTRY_MAP[country] ?? country;
  return CITIES.filter(c => c.country === mapped);
}

export function getCityById(id) {
  return CITIES.find(c => c.id === id) ?? null;
}
