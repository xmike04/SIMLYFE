export const SPECIAL_CAREERS = [
  {
    id: "sc_actor",
    name: "Actor",
    icon: "🎭",
    description: "Navigate Hollywood and build your fame on the silver screen.",
    actions: [
      { text: "Take Acting Lessons (-$500)", context: "Paid for professional acting classes to improve dramatic skills.", cost: 500 },
      { text: "Audition for Commercial", context: "Went to a casting call for a local television commercial." },
      { text: "Audition for TV Show Role", context: "Auditioned for a recurring role on a hit TV series." },
      { text: "Audition for Movie Lead", context: "Audited for the starring lead role in a major Hollywood blockbuster movie." }
    ]
  },
  {
    id: "sc_musician",
    name: "Musician",
    icon: "🎸",
    description: "Write hits, form bands, and tour the world.",
    actions: [
      { text: "Take Vocal Lessons (-$200)", context: "Paid for vocal coaching to improve singing range.", cost: 200 },
      { text: "Busking on the Street", context: "Played music on the street for tips and exposure." },
      { text: "Release a Single", context: "Recorded and released a new debut single independently." },
      { text: "Pitch to Record Label", context: "Pitched demo tapes to major record label executives." }
    ]
  },
  {
    id: "sc_model",
    name: "Model",
    icon: "📸",
    description: "Rely on stunning looks to dominate the fashion industry.",
    actions: [
      { text: "Hire Portfolio Photographer (-$1000)", context: "Hired a professional photographer to build a high-end modeling portfolio.", cost: 1000 },
      { text: "Apply for Catalog Shoot", context: "Applied to model for a seasonal clothing catalog." },
      { text: "Audition for Runway", context: "Auditioned to walk the runway at a major Fashion Week." },
      { text: "Pitch to Modeling Agency", context: "Attended an open casting call at a premier modeling agency." }
    ]
  },
  {
    id: "sc_pro_athlete",
    name: "Pro Athlete",
    icon: "⚽",
    description: "Train hard and get drafted into major leagues.",
    actions: [
      { text: "Intense Training Regime (-$100)", context: "Underwent grueling physical training to reach peak athletic performance.", cost: 100 },
      { text: "Hire Sports Agent (-$2000)", context: "Hired a high-profile sports agent to secure tryouts.", cost: 2000 },
      { text: "Attend Open Tryouts", context: "Attended open tryouts for a professional sports team." },
      { text: "Declare for Draft", context: "Officially declared eligibility for the professional sports league draft." }
    ]
  },
  {
    id: "sc_astronaut",
    name: "Astronaut",
    icon: "🚀",
    description: "Requires peak intelligence and health to reach the stars.",
    actions: [
      { text: "Attend Space Camp (-$5000)", context: "Attended adult Space Camp to learn zero-gravity physics and flight simulation.", cost: 5000 },
      { text: "Apply for Flight School", context: "Applied for intense military pilot flight training." },
      { text: "Apply to Space Agency", context: "Submitted an application to the national Space Agency's astronaut candidate program." },
      { text: "Volunteer for Mars Mission", context: "Volunteered for a highly dangerous, one-way colonial mission to Mars." }
    ]
  },
  {
    id: "sc_politician",
    name: "Politician",
    icon: "🏛️",
    description: "Campaign for votes and climb the political ladder.",
    actions: [
      { text: "Fund Campaign Rally (-$10,000)", context: "Funded a massive public campaign rally to boost approval ratings.", cost: 10000 },
      { text: "Run for School Board", context: "Started a campaign to be elected to the local School Board." },
      { text: "Run for Mayor", context: "Started a massive political campaign to be elected Mayor of the city." },
      { text: "Run for President", context: "Launched a billion-dollar political campaign to become the President." }
    ]
  },
  {
    id: "sc_business",
    name: "Business Startup",
    icon: "📈",
    description: "Launch companies, secure venture capital, and build equity.",
    actions: [
      { text: "Launch Tech Startup (-$500)", context: "Invested $500 and officially launched a brand new technology startup company.", specialAction: "startStartup", cost: 500 },
      { text: "Pitch to Angel Investors", context: "Pitched a tech startup idea to Angel Investors for seed funding." },
      { text: "Expand Business Operations (-$50,000)", context: "Invested heavy capital to aggressively expand startup operations globally.", cost: 50000 },
      { text: "Attempt IPO", context: "Attempted to take the startup public with an Initial Public Offering (IPO) on the stock market." }
    ]
  },
  {
    id: "sc_mafia",
    name: "Mafia / Syndicate",
    icon: "🕴️",
    description: "Join organized crime. High risk, high reward.",
    actions: [
      { text: "Shoplift", context: "Attempted to shoplift expensive electronics from a local store." },
      { text: "Extort Local Business", context: "Attempted to extort a local family-owned business for protection money." },
      { text: "Grand Theft Auto", context: "Attempted to steal a highly valuable luxury sports car off the street." },
      { text: "Whack a Rival Boss", context: "Attempted an incredibly dangerous hit on a rival mafia family boss." }
    ]
  },
  {
    id: "sc_drug_dealer",
    name: "Street Hustler",
    icon: "💊",
    description: "Control the streets and evade the authorities.",
    actions: [
      { text: "Sell on the Corner", context: "Attempted to sell illicit substances on a dangerous street corner." },
      { text: "Recruit Runners", context: "Attempted to recruit local kids to act as runners for your operation." },
      { text: "Rob a Rival Cartel", context: "Attempted a highly dangerous armed robbery against a rival drug cartel." },
      { text: "Bribe the Police (-$25,000)", context: "Attempted to bribe the local police chief to look the other way.", cost: 25000 }
    ]
  },
  {
    id: "sc_hacker",
    name: "Cybercriminal",
    icon: "💻",
    description: "Operate in the dark web manipulating data.",
    actions: [
      { text: "Take Advanced Coding Bootcamps (-$1500)", context: "Enrolled in underground advanced coding and penetration testing bootcamps.", cost: 1500 },
      { text: "Deploy Ransomware", context: "Attempted to deploy malicious ransomware against a corporate network." },
      { text: "Hack a Bank Server", context: "Attempted an ultra-high risk hack on a secure international banking server." },
      { text: "Launder Crypto", context: "Attempted to clean illicit cryptocurrency through overseas tumblers." }
    ]
  },
  {
    id: "sc_secret_agent",
    name: "Secret Agent",
    icon: "🕵️",
    description: "Work in the shadows for national security.",
    actions: [
      { text: "Train in Martial Arts (-$800)", context: "Paid for extensive close-quarters combat and martial arts training.", cost: 800 },
      { text: "Apply to Intelligence Agency", context: "Submitted application for recruitment into a top-secret Intelligence Agency." },
      { text: "Infiltrate Terrorist Cell", context: "Attempted to go undercover and infiltrate a dangerous international terrorist cell." },
      { text: "Assassinate Rogue Target", context: "Attempted to assassinate a deeply dangerous rogue operative." }
    ]
  }
];
