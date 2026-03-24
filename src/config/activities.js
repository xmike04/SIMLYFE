export const ACTIVITY_CATEGORIES = [
  { id: 'mind_body', name: 'Mind & Body', icon: '🧘', minAge: 4, color: 'rgba(255,255,255,0.05)' },
  { id: 'pets', name: 'Pets', icon: '🐾', minAge: 4, color: 'rgba(255,255,255,0.05)' },
  { id: 'doctor', name: 'Doctor', icon: '🩺', minAge: 4, color: 'rgba(255,255,255,0.05)', isSpecial: 'doctor' },
  { id: 'movies', name: 'Movies', icon: '🍿', minAge: 4, color: 'rgba(255,255,255,0.05)' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', minAge: 4, color: 'rgba(255,255,255,0.05)' },
  { id: 'accessories', name: 'Accessories', icon: '👓', minAge: 4, color: 'rgba(255,255,255,0.05)' },
  { id: 'salon', name: 'Salon & Spa', icon: '💅', minAge: 12, color: 'rgba(255,255,255,0.05)' },
  { id: 'social', name: 'Social Media', icon: '📱', minAge: 13, color: 'rgba(255,255,255,0.05)' },
  { id: 'love', name: 'Love', icon: '💖', minAge: 14, color: 'rgba(255,255,255,0.05)' },
  { id: 'lottery', name: 'Lottery', icon: '🎫', minAge: 18, color: 'rgba(16, 185, 129, 0.1)', isSpecial: 'lottery' },
  { id: 'casino', name: 'Casino', icon: '🎰', minAge: 18, color: 'rgba(16, 185, 129, 0.1)', isSpecial: 'casino' },
  { id: 'networking_mixer', name: 'Networking', icon: '🤝', minAge: 18, minBank: 200, color: 'rgba(139, 92, 246, 0.1)' },
  { id: 'nightclub', name: 'Nightclub', icon: '🪩', minAge: 18, color: 'rgba(139, 92, 246, 0.1)' },
  { id: 'fertility', name: 'Fertility', icon: '🍼', minAge: 18, color: 'rgba(236, 72, 153, 0.1)' },
  { id: 'plastic_surgery', name: 'Plastic Surgery', icon: '💉', minAge: 18, color: 'rgba(236, 72, 153, 0.1)' },
  { id: 'emigrate', name: 'Emigrate', icon: '✈️', minAge: 18, color: 'rgba(59, 130, 246, 0.1)' },
  { id: 'vacation', name: 'Vacation', icon: '🏖️', minAge: 18, color: 'rgba(59, 130, 246, 0.1)' },
  { id: 'rehab', name: 'Rehab', icon: '🏥', minAge: 18, color: 'rgba(255, 255, 255, 0.1)' },
  { id: 'adoption', name: 'Adoption', icon: '👨‍👧‍👦', minAge: 18, color: 'rgba(255, 255, 255, 0.1)' },
  { id: 'lawsuit', name: 'Lawsuit', icon: '⚖️', minAge: 18, minBank: 500, color: 'rgba(255, 255, 255, 0.02)' },
  { id: 'licenses', name: 'Licenses', icon: '🪪', minAge: 16, minBank: 100, color: 'rgba(255, 255, 255, 0.02)' },
  { id: 'wills', name: 'Wills', icon: '📜', minAge: 18, minBank: 200, color: 'rgba(255, 255, 255, 0.02)' },
  { id: 'crime', name: 'Crime', icon: '🦹', minAge: 18, color: 'rgba(239, 68, 68, 0.1)' }
];

export const ACTIVITY_MENUS = {
  'mind_body': [
    { text: 'Go to the Gym', context: 'Went to the gym for an intense workout session', specialAction: 'gym' },
    { text: 'Go for a Run', context: 'Went for a long, exhausting run outside', specialAction: 'run' },
    { text: 'Acting Lessons ($50)', context: 'Paid $50 for professional acting lessons', specialAction: 'act_lesson' },
    { text: 'Voice Lessons ($50)', context: 'Paid $50 for professional vocal coaching', specialAction: 'voice_lesson' },
    { text: 'Modeling Classes ($50)', context: 'Paid $50 for professional modeling and posture classes', specialAction: 'model_lesson' }
  ],
  'pets': [
    { text: 'Adopt a Dog', context: 'Went to the shelter and adopted a dog' },
    { text: 'Adopt a Cat', context: 'Went to the shelter and adopted a cat' },
    { text: 'Buy an Exotic Pet', context: 'Bought a highly unusual exotic pet' },
    { text: 'Volunteer at Shelter', context: 'Volunteered to help animals at the local shelter' }
  ],
  'movies': [
    { text: 'Blockbuster Hit', context: 'Went to see the latest blockbuster movie' },
    { text: 'Indie Film Festival', context: 'Attended a local indie film festival' },
    { text: 'Horror Movie', context: 'Watched a terrifying horror movie late at night' },
    { text: 'Romantic Comedy', context: 'Watched a cheesy romantic comedy' }
  ],
  'shopping': [
    { text: 'Designer Clothes', context: 'Went on a massive designer clothing shopping spree' },
    { text: 'Thrift Store', context: 'Hunted for vintage clothes at a local thrift store' },
    { text: 'Electronics', context: 'Bought the latest piece of expensive consumer technology' },
    { text: 'Flea Market', context: 'Browsed strange trinkets at a busy flea market' }
  ],
  'accessories': [
    { text: 'Luxury Watch', context: 'Bought a ridiculously expensive luxury watch' },
    { text: 'Designer Sunglasses', context: 'Bought new designer sunglasses' },
    { text: 'Fine Jewelry', context: 'Purchased a piece of fine jewelry' },
    { text: 'Cheap Trinket', context: 'Bought a cheap plastic accessory from a street vendor' }
  ],
  'salon': [
    { text: 'Haircut & Styling', context: 'Got a premium haircut and styling session' },
    { text: 'Deep Tissue Massage', context: 'Got a relaxing deep tissue massage at the spa' },
    { text: 'Manicure & Pedicure', context: 'Got a full manicure and pedicure' },
    { text: 'Mud Bath', context: 'Relaxed in an expensive therapeutic mud bath' }
  ],
  'social': [
    { text: 'Post a Selfie', context: 'Posted an attractive selfie on social media' },
    { text: 'Start Internet Drama', context: 'Started petty drama with an influencer online' },
    { text: 'Viral Dance Video', context: 'Attempted to make a viral dance video' },
    { text: 'Political Rant', context: 'Went on a massive political rant causing heavy backlash' },
    { text: 'Delete Account', context: 'Deleted all social media accounts completely' }
  ],
  'love': [
    { text: 'Celebrity Dating App', context: 'Used a celebrity dating app to hook up with someone famous', bg: 'rgba(236, 72, 153, 0.1)' },
    { text: 'Date', context: 'Went on a traditional romantic date' },
    { text: 'Dating App', specialAction: 'open_dating_ui' },
    { text: 'Gay Dating App', context: 'Used a gay dating app to find love or hookups' },
    { text: 'Hook Up', context: 'Arranged a casual hook up for the night', bg: 'rgba(239, 68, 68, 0.1)' },
    { text: 'Mail Order Bride', context: 'Paid a large sum of money to meet a mail order bride', bg: 'rgba(59, 130, 246, 0.1)' },
    { text: 'Threesome', context: 'Arranged a wild threesome for the night', bg: 'rgba(139, 92, 246, 0.1)' }
  ],
  'networking_mixer': [
    { text: 'Industry Mixer (-$200)', context: 'Attended a professional industry networking mixer to meet contacts', specialAction: 'networking_mixer' },
    { text: 'Industry Conference (-$200)', context: 'Attended a major industry conference and networked aggressively', specialAction: 'networking_mixer' },
    { text: 'LinkedIn Networking', context: 'Spent the afternoon building professional connections online' },
    { text: 'Cold Outreach Campaign', context: 'Sent cold emails to industry professionals seeking mentorship and job leads' }
  ],
  'nightclub': [
    { text: 'VIP Table', context: 'Bought a VIP table and expensive bottles at a high-end nightclub' },
    { text: 'Dance All Night', context: 'Danced wildly all night in the middle of the dancefloor' },
    { text: 'Underground Rave', context: 'Sneaked into a shady underground rave' },
    { text: 'Bar Fight', context: 'Started a violent fight at a local bar' }
  ],
  'fertility': [
    { text: 'IVF Treatment', context: 'Paid for incredibly expensive IVF treatment' },
    { text: 'Sperm/Egg Donor', context: 'Used a sperm or egg donor to attempt pregnancy' },
    { text: 'Surrogacy', context: 'Hired a surrogate mother to have a child' },
    { text: 'Fertility Testing', context: 'Went to the clinic for standard fertility testing' }
  ],
  'plastic_surgery': [
    { text: 'Facelift', context: 'Got a massive facial reconstruction surgery' },
    { text: 'Liposuction', context: 'Paid for liposuction to remove fat' },
    { text: 'Botox', context: 'Got cheap botox injections' },
    { text: 'Shady Surgery', context: 'Went to a foreign country for cheap, unregulated plastic surgery' }
  ],
  'emigrate': [
    { text: 'Move to Europe', context: 'Attempted to legally emigrate to a European country' },
    { text: 'Move to Asia', context: 'Attempted to legally emigrate to an Asian country' },
    { text: 'Move to America', context: 'Attempted to legally emigrate to North America' },
    { text: 'Flee Illegally', context: 'Paid a smuggler to illegally cross into a new country' }
  ],
  'vacation': [
    { text: 'Tropical Resort', context: 'Went to a luxury 5-star tropical beach resort' },
    { text: 'Backpacking', context: 'Went backpacking across rough terrain' },
    { text: 'Cruise Ship', context: 'Went on a massive, expensive ocean cruise' },
    { text: 'Staycation', context: 'Took time off but just stayed home and relaxed' }
  ],
  'rehab': [
    { text: 'Luxury Rehab', context: 'Checked into a wildly expensive celebrity rehab center' },
    { text: 'Standard Rehab', context: 'Checked into a sterile, state-funded rehab facility' },
    { text: 'Intervention', context: 'Had an intervention forced upon by family members' }
  ],
  'adoption': [
    { text: 'Adopt Baby', context: 'Attempted to adopt a newborn baby through an agency' },
    { text: 'Adopt Teenager', context: 'Attempted to adopt a troubled teenager' },
    { text: 'Foster Care', context: 'Signed up to become a foster parent' }
  ],
  'lawsuit': [
    { text: 'Sue Employer', context: 'Started a massive lawsuit against a former employer' },
    { text: 'Sue Celebrity', context: 'Started a frivolous lawsuit against a famous celebrity' },
    { text: 'Class Action', context: 'Joined a massive class action lawsuit against a corporation' },
    { text: 'Sue Family', context: 'Sued a family member over a petty dispute' }
  ],
  'licenses': [
    { text: 'Driver\'s License', context: 'Took a driving test to get a standard driver\'s license' },
    { text: 'Boating License', context: 'Studied for and took a boating license exam' },
    { text: 'Pilot\'s License', context: 'Paid for expensive flight school to get a pilot\'s license' },
    { text: 'Firearm Permit', context: 'Applied for a concealed carry firearm permit' }
  ],
  'wills': [
    { text: 'Custom Will Distribution', specialAction: 'open_wills_ui', bg: 'rgba(59, 130, 246, 0.2)' },
    { text: 'Leave to Family', context: 'Drafted a will leaving all assets to direct family' },
    { text: 'Leave to Charity', context: 'Drafted a will leaving everything to a charitable cause' },
    { text: 'Leave to Pets', context: 'Drafted a bizarre will leaving everything to household pets' },
    { text: 'Disinherit Everyone', context: 'Drafted a spiteful will explicitly disinheriting everyone' }
  ],
  'crime': [
    { text: 'Mug Someone', context: 'Mugged a random stranger on the street', bg: 'rgba(239, 68, 68, 0.1)' },
    { text: 'Grand Theft Auto', context: 'Committed grand theft auto and stole a vehicle', bg: 'rgba(239, 68, 68, 0.1)' },
    { text: 'Bank Heist', context: 'Attempted to rob a highly secured bank', bg: 'rgba(239, 68, 68, 0.1)' },
    { text: 'Murder', context: 'Attempted to brutally murder someone', bg: 'rgba(239, 68, 68, 0.2)' }
  ]
};
