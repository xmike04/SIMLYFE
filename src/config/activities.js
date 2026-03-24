// ─── Activity categories ─────────────────────────────────────────────────────
// isSpecial values: 'doctor' | 'lottery' | 'casino'
// These categories bypass the sub-menu and call engine functions directly in MainGame.jsx.
// All other categories must have a matching key in ACTIVITY_MENUS.

export const ACTIVITY_CATEGORIES = [
  { id: 'mind_body',        name: 'Mind & Body',     icon: '🧘',  minAge: 4,  color: 'rgba(255,255,255,0.05)' },
  { id: 'pets',             name: 'Pets',             icon: '🐾',  minAge: 4,  color: 'rgba(255,255,255,0.05)' },
  { id: 'doctor',           name: 'Doctor',           icon: '🩺',  minAge: 4,  color: 'rgba(59,130,246,0.1)',   isSpecial: 'doctor' },
  { id: 'movies',           name: 'Movies',           icon: '🍿',  minAge: 4,  color: 'rgba(255,255,255,0.05)' },
  { id: 'shopping',         name: 'Shopping',         icon: '🛍️', minAge: 4,  color: 'rgba(255,255,255,0.05)' },
  { id: 'accessories',      name: 'Accessories',      icon: '👓',  minAge: 4,  color: 'rgba(255,255,255,0.05)' },
  { id: 'salon',            name: 'Salon & Spa',      icon: '💅',  minAge: 12, color: 'rgba(236,72,153,0.08)' },
  { id: 'social',           name: 'Social Media',     icon: '📱',  minAge: 13, color: 'rgba(255,255,255,0.05)' },
  { id: 'love',             name: 'Love',             icon: '💖',  minAge: 14, color: 'rgba(236,72,153,0.1)' },
  { id: 'lottery',          name: 'Lottery',          icon: '🎫',  minAge: 18, color: 'rgba(16,185,129,0.1)',   isSpecial: 'lottery' },
  { id: 'casino',           name: 'Casino',           icon: '🎰',  minAge: 18, color: 'rgba(16,185,129,0.1)',   isSpecial: 'casino' },
  { id: 'networking_mixer', name: 'Networking',       icon: '🤝',  minAge: 18, color: 'rgba(139,92,246,0.1)', minBank: 200 },
  { id: 'nightclub',        name: 'Nightclub',        icon: '🪩',  minAge: 18, color: 'rgba(139,92,246,0.1)' },
  { id: 'vacation',         name: 'Vacation',         icon: '🏖️', minAge: 18, color: 'rgba(59,130,246,0.1)',  minBank: 500 },
  { id: 'fertility',        name: 'Fertility',        icon: '🍼',  minAge: 18, color: 'rgba(236,72,153,0.1)' },
  { id: 'plastic_surgery',  name: 'Plastic Surgery',  icon: '💉',  minAge: 18, color: 'rgba(236,72,153,0.1)', minBank: 500 },
  { id: 'emigrate',         name: 'Emigrate',         icon: '✈️', minAge: 18, color: 'rgba(59,130,246,0.1)' },
  { id: 'rehab',            name: 'Rehab',            icon: '🏥',  minAge: 18, color: 'rgba(255,255,255,0.1)', minBank: 2000 },
  { id: 'adoption',         name: 'Adoption',         icon: '👨‍👧‍👦', minAge: 18, color: 'rgba(255,255,255,0.1)' },
  { id: 'lawsuit',          name: 'Lawsuit',          icon: '⚖️', minAge: 18, color: 'rgba(255,255,255,0.02)', minBank: 500 },
  { id: 'licenses',         name: 'Licenses',         icon: '🪪',  minAge: 16, color: 'rgba(255,255,255,0.02)', minBank: 100 },
  { id: 'wills',            name: 'Wills',            icon: '📜',  minAge: 18, color: 'rgba(255,255,255,0.02)', minBank: 200 },
  { id: 'crime',            name: 'Crime',            icon: '🦹',  minAge: 18, color: 'rgba(239,68,68,0.1)' },
];

// ─── Activity menus ──────────────────────────────────────────────────────────
// Item fields:
//   text         — button label (required)
//   context      — LLM prompt string (required unless specialAction)
//   specialAction— bypasses LLM, routed in MainGame.jsx
//   cost         — bank deducted before activity fires (positive number)
//   yearlyLimit  — max times player can do this per year (integer)
//   statGuard    — { stat, op:'gte'|'lte', value } — client-side lock
//   baseEffects  — guaranteed stat/bank delta applied before LLM event
//   bg           — optional background tint for button

export const ACTIVITY_MENUS = {
  // ── Mind & Body ─────────────────────────────────────────────────────────────
  'mind_body': [
    { text: 'Go to the Gym',          context: 'Went to the gym for an intense workout session',        specialAction: 'gym',         yearlyLimit: 1 },
    { text: 'Go for a Run',           context: 'Went for a long exhausting run outside',                specialAction: 'run',         yearlyLimit: 1 },
    { text: 'Meditate',               context: 'Spent an hour in deep meditation and mindfulness',       baseEffects: { happiness: 5, health: 2 } },
    { text: 'Acting Lessons ($50)',   context: 'Paid $50 for professional acting lessons',               specialAction: 'act_lesson',  cost: 50 },
    { text: 'Voice Lessons ($50)',    context: 'Paid $50 for professional vocal coaching',               specialAction: 'voice_lesson', cost: 50 },
    { text: 'Modeling Classes ($50)', context: 'Paid $50 for professional modeling and posture classes', specialAction: 'model_lesson', cost: 50,
      statGuard: { stat: 'looks', op: 'gte', value: 30 } },
  ],

  // ── Pets ─────────────────────────────────────────────────────────────────────
  'pets': [
    { text: 'Adopt a Dog',       context: 'Went to the shelter and adopted a dog',              baseEffects: { happiness: 8 } },
    { text: 'Adopt a Cat',       context: 'Went to the shelter and adopted a cat',              baseEffects: { happiness: 5 } },
    { text: 'Buy an Exotic Pet', context: 'Bought a highly unusual exotic pet',    cost: 2000,  baseEffects: { happiness: 10 } },
    { text: 'Volunteer at Shelter', context: 'Volunteered to help animals at the shelter',     baseEffects: { happiness: 6, karma: 3 } },
  ],

  // ── Movies ───────────────────────────────────────────────────────────────────
  'movies': [
    { text: 'Blockbuster Hit',      context: 'Went to see the latest blockbuster movie at the cinema',  cost: 20,  baseEffects: { happiness: 4 } },
    { text: 'Indie Film Festival',  context: 'Attended a local indie film festival',                    cost: 40,  baseEffects: { happiness: 5, smarts: 2 } },
    { text: 'Horror Movie',         context: 'Watched a terrifying horror movie late at night',         cost: 15,  baseEffects: { happiness: -2 } },
    { text: 'Romantic Comedy',      context: 'Watched a cheesy romantic comedy',                        cost: 15,  baseEffects: { happiness: 5 } },
  ],

  // ── Shopping ─────────────────────────────────────────────────────────────────
  'shopping': [
    { text: 'Designer Clothes',  context: 'Went on a massive designer clothing shopping spree', cost: 800,  baseEffects: { happiness: 8,  looks: 3 } },
    { text: 'Thrift Store',      context: 'Hunted for vintage clothes at a local thrift store', cost: 30,   baseEffects: { happiness: 4 } },
    { text: 'Electronics',       context: 'Bought the latest piece of expensive consumer tech', cost: 500,  baseEffects: { happiness: 6, smarts: 1 } },
    { text: 'Flea Market',       context: 'Browsed strange trinkets at a busy flea market',    cost: 20,   baseEffects: { happiness: 3 } },
  ],

  // ── Accessories ──────────────────────────────────────────────────────────────
  'accessories': [
    { text: 'Luxury Watch',        context: 'Bought a ridiculously expensive luxury watch',        cost: 5000,  baseEffects: { happiness: 10, looks: 2 } },
    { text: 'Designer Sunglasses', context: 'Bought new designer sunglasses',                      cost: 400,   baseEffects: { happiness: 5,  looks: 2 } },
    { text: 'Fine Jewelry',        context: 'Purchased a piece of fine jewelry',                   cost: 2000,  baseEffects: { happiness: 7,  looks: 3 } },
    { text: 'Cheap Trinket',       context: 'Bought a cheap plastic accessory from a street vendor', cost: 5,   baseEffects: { happiness: 2 } },
  ],

  // ── Salon & Spa ──────────────────────────────────────────────────────────────
  'salon': [
    { text: 'Haircut & Styling',     context: 'Got a premium haircut and styling session',          cost: 150,  baseEffects: { looks: 4,  happiness: 4 } },
    { text: 'Deep Tissue Massage',   context: 'Got a relaxing deep tissue massage at the spa',      cost: 200,  baseEffects: { health: 5, happiness: 8 } },
    { text: 'Manicure & Pedicure',   context: 'Got a full manicure and pedicure',                  cost: 80,   baseEffects: { looks: 2,  happiness: 4 } },
    { text: 'Mud Bath & Facial',     context: 'Relaxed in an expensive therapeutic mud bath',       cost: 350,  baseEffects: { health: 4, happiness: 6, looks: 3 } },
    { text: 'Full Makeover ($500)',   context: 'Got a complete professional makeover at a luxury salon', cost: 500, baseEffects: { looks: 8, happiness: 10 } },
  ],

  // ── Social Media ─────────────────────────────────────────────────────────────
  'social': [
    { text: 'Post a Selfie',       context: 'Posted an attractive selfie on social media' },
    { text: 'Start Internet Drama', context: 'Started petty drama with an influencer online',
      baseEffects: { happiness: -3, karma: -5 } },
    { text: 'Viral Dance Video',   context: 'Attempted to make a viral dance video' },
    { text: 'Political Rant',      context: 'Went on a massive political rant causing heavy backlash',
      baseEffects: { happiness: -5, karma: -8 } },
    { text: 'Delete Account',      context: 'Deleted all social media accounts for peace of mind',
      baseEffects: { happiness: 5, karma: 3 } },
  ],

  // ── Love ─────────────────────────────────────────────────────────────────────
  'love': [
    { text: 'Celebrity Dating App', context: 'Used a celebrity dating app to hook up with someone famous', cost: 50, bg: 'rgba(236,72,153,0.1)' },
    { text: 'Traditional Date',     context: 'Went on a thoughtful romantic date',                          cost: 100, baseEffects: { happiness: 6 } },
    { text: 'Dating App',           specialAction: 'open_dating_ui' },
    { text: 'Gay Dating App',       context: 'Used a gay dating app to find love or hookups',               cost: 20 },
    { text: 'Hook Up',              context: 'Arranged a casual hook up for the night',                     bg: 'rgba(239,68,68,0.1)' },
    { text: 'Mail Order Bride',     context: 'Paid a large sum to meet a mail order bride',    cost: 5000,  bg: 'rgba(59,130,246,0.1)' },
    { text: 'Threesome',            context: 'Arranged a wild threesome for the night',                     bg: 'rgba(139,92,246,0.1)' },
  ],

  // ── Networking ───────────────────────────────────────────────────────────────
  'networking_mixer': [
    { text: 'Industry Mixer (-$200)',      context: 'Attended a professional industry networking mixer', specialAction: 'networking_mixer' },
    { text: 'Industry Conference (-$200)', context: 'Attended a major industry conference and networked aggressively', specialAction: 'networking_mixer' },
    { text: 'LinkedIn Networking',         context: 'Spent the afternoon building professional connections online' },
    { text: 'Cold Outreach Campaign',      context: 'Sent cold emails to industry professionals seeking mentorship' },
  ],

  // ── Nightclub ────────────────────────────────────────────────────────────────
  'nightclub': [
    { text: 'VIP Table',          context: 'Bought a VIP table and expensive bottles at a high-end nightclub', cost: 2000, baseEffects: { happiness: 12 } },
    { text: 'Dance All Night',    context: 'Danced wildly all night in the middle of the dancefloor',          cost: 50,   baseEffects: { happiness: 8, health: -2 } },
    { text: 'Underground Rave',   context: 'Sneaked into a shady underground rave',                            cost: 30,   baseEffects: { happiness: 10, health: -5 } },
    { text: 'Bar Fight',          context: 'Started a violent fight at a local bar',
      baseEffects: { health: -10, happiness: -5, karma: -8 },
      statGuard: { stat: 'karma', op: 'lte', value: 60 } },
  ],

  // ── Vacation ─────────────────────────────────────────────────────────────────
  'vacation': [
    { text: 'Tropical Resort',  context: 'Went to a luxury 5-star tropical beach resort',  cost: 5000,  yearlyLimit: 1, baseEffects: { happiness: 20, health: 5 } },
    { text: 'Backpacking',      context: 'Went backpacking across rough terrain',           cost: 800,   yearlyLimit: 1, baseEffects: { happiness: 12, health: 3, smarts: 2 } },
    { text: 'Cruise Ship',      context: 'Went on a massive expensive ocean cruise',        cost: 3000,  yearlyLimit: 1, baseEffects: { happiness: 15, health: 2 } },
    { text: 'Staycation',       context: 'Took time off but just stayed home and relaxed', cost: 0,     yearlyLimit: 1, baseEffects: { happiness: 8,  health: 4 } },
  ],

  // ── Fertility ────────────────────────────────────────────────────────────────
  'fertility': [
    { text: 'IVF Treatment',      context: 'Paid for incredibly expensive IVF treatment',               cost: 15000, baseEffects: { health: -5, happiness: -5 } },
    { text: 'Sperm/Egg Donor',    context: 'Used a sperm or egg donor to attempt pregnancy',             cost: 5000 },
    { text: 'Surrogacy',          context: 'Hired a surrogate mother to have a child',                  cost: 50000 },
    { text: 'Fertility Testing',  context: 'Went to the clinic for standard fertility testing',         cost: 500,   baseEffects: { health: 2 } },
  ],

  // ── Plastic Surgery ──────────────────────────────────────────────────────────
  'plastic_surgery': [
    { text: 'Facelift',        context: 'Got a full facial reconstruction surgery',                cost: 15000, baseEffects: { looks: 12, health: -8, happiness: 5 } },
    { text: 'Liposuction',     context: 'Paid for liposuction to reshape my body',                 cost: 8000,  baseEffects: { looks: 6,  health: -5, happiness: 3 } },
    { text: 'Botox',           context: 'Got botox injections to smooth out wrinkles',             cost: 1000,  baseEffects: { looks: 4,  health: -1 } },
    { text: 'Shady Surgery',   context: 'Flew to a foreign country for cheap unregulated surgery', cost: 2000,  baseEffects: { looks: 8,  health: -15 } },
  ],

  // ── Emigrate ─────────────────────────────────────────────────────────────────
  'emigrate': [
    { text: 'Move to Europe',   context: 'Attempted to legally emigrate to a European country',     cost: 3000 },
    { text: 'Move to Asia',     context: 'Attempted to legally emigrate to an Asian country',       cost: 2000 },
    { text: 'Move to America',  context: 'Attempted to legally emigrate to North America',          cost: 3000 },
    { text: 'Flee Illegally',   context: 'Paid a smuggler to illegally cross into a new country',   cost: 1000,
      statGuard: { stat: 'karma', op: 'lte', value: 50 } },
  ],

  // ── Rehab ────────────────────────────────────────────────────────────────────
  'rehab': [
    { text: 'Luxury Rehab',    context: 'Checked into a wildly expensive celebrity rehab center', cost: 30000, baseEffects: { health: 20, happiness: 10 } },
    { text: 'Standard Rehab',  context: 'Checked into a state-funded rehab facility',             cost: 2000,  baseEffects: { health: 15, happiness: 5 } },
    { text: 'Intervention',    context: 'Had an intervention forced upon by family members',       cost: 0,     baseEffects: { health: 8, happiness: -5 } },
  ],

  // ── Adoption ─────────────────────────────────────────────────────────────────
  'adoption': [
    { text: 'Adopt Baby',      context: 'Attempted to adopt a newborn baby through an agency',    cost: 20000, baseEffects: { happiness: 15 } },
    { text: 'Adopt Teenager',  context: 'Attempted to adopt a troubled teenager',                 cost: 5000,  baseEffects: { happiness: 8 } },
    { text: 'Foster Care',     context: 'Signed up to become a foster parent',                    cost: 0,     baseEffects: { happiness: 6, karma: 10 } },
  ],

  // ── Lawsuit ──────────────────────────────────────────────────────────────────
  'lawsuit': [
    { text: 'Sue Employer',   context: 'Started a massive lawsuit against a former employer',       cost: 5000 },
    { text: 'Sue Celebrity',  context: 'Started a frivolous lawsuit against a famous celebrity',    cost: 2000 },
    { text: 'Class Action',   context: 'Joined a massive class action lawsuit against a corporation', cost: 500 },
    { text: 'Sue Family',     context: 'Sued a family member over a petty dispute',                cost: 1000, baseEffects: { karma: -10 } },
  ],

  // ── Licenses ─────────────────────────────────────────────────────────────────
  'licenses': [
    { text: "Driver's License", context: "Took a driving test to get a standard driver's license",   cost: 150 },
    { text: 'Boating License',  context: 'Studied for and took a boating license exam',              cost: 300 },
    { text: "Pilot's License",  context: 'Paid for flight school to get a private pilot license',    cost: 8000,
      statGuard: { stat: 'smarts', op: 'gte', value: 50 } },
    { text: 'Firearm Permit',   context: 'Applied for a concealed carry firearm permit',             cost: 200 },
  ],

  // ── Wills ────────────────────────────────────────────────────────────────────
  'wills': [
    { text: 'Custom Will Distribution', specialAction: 'open_wills_ui',                                     bg: 'rgba(59,130,246,0.2)' },
    { text: 'Leave to Family',          context: 'Drafted a will leaving all assets to direct family',      cost: 500 },
    { text: 'Leave to Charity',         context: 'Drafted a will leaving everything to a charitable cause', cost: 300, baseEffects: { karma: 5 } },
    { text: 'Leave to Pets',            context: 'Drafted a bizarre will leaving everything to my pets',    cost: 300 },
    { text: 'Disinherit Everyone',      context: 'Drafted a spiteful will explicitly disinheriting everyone', cost: 300, baseEffects: { karma: -5 } },
  ],

  // ── Crime ────────────────────────────────────────────────────────────────────
  'crime': [
    { text: 'Mug Someone',      context: 'Mugged a random stranger on the street',         bg: 'rgba(239,68,68,0.1)',
      statGuard: { stat: 'karma', op: 'lte', value: 40 },  baseEffects: { karma: -10 } },
    { text: 'Grand Theft Auto', context: 'Committed grand theft auto and stole a vehicle', bg: 'rgba(239,68,68,0.1)',
      statGuard: { stat: 'karma', op: 'lte', value: 35 },  baseEffects: { karma: -15 } },
    { text: 'Bank Heist',       context: 'Attempted to rob a highly secured bank',         bg: 'rgba(239,68,68,0.1)',
      statGuard: { stat: 'karma', op: 'lte', value: 25 },  baseEffects: { karma: -20 } },
    { text: 'Murder',           context: 'Attempted to brutally murder someone',           bg: 'rgba(239,68,68,0.2)',
      statGuard: { stat: 'karma', op: 'lte', value: 15 },  baseEffects: { karma: -30, health: -5 } },
  ],
};
