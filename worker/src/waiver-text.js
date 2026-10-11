// Single source of truth for the participant waiver. The waiver page renders
// this via GET /api/waiver, and every signed record stores WAIVER_VERSION plus
// a SHA-256 of this object, so a record always proves which text was signed.
// Changing any wording? Bump WAIVER_VERSION.
// **double asterisks** mark text that is bold on the paper form.

export const WAIVER_VERSION = '2026-10-v1';

export const WAIVER = {
  title: 'WFTX Events Zombie Maze',
  subtitle: 'Participant Waiver, Release of Liability & Assumption of Risk',
  intro:
    'By signing this Waiver and Release ("Waiver"), I acknowledge that I am voluntarily participating in WFTX Events Zombie Maze (the "Activity"). I understand that the Activity may involve darkness, uneven terrain, loud noises, sudden movements, special effects, actors, props, obstacles, outdoor conditions, and other potentially unpredictable circumstances.',
  sections: [
    {
      heading: '1. Assumption of Risk',
      text: 'I understand that participation in WFTX Events Zombie Maze involves inherent and other risks, including but not limited to slips, trips, falls, collisions, minor or serious injuries, emotional distress, exposure to darkness or confined areas, loud sounds, smoke or fog effects, strobe or flashing lights, uneven ground, mud, vegetation, weather conditions, and interactions with other participants. I voluntarily assume all risks associated with my participation, whether known or unknown, foreseeable or unforeseeable, to the fullest extent permitted by law.',
    },
    {
      heading: '2. Paint, Powders, Liquids & Special Effects',
      text: 'I understand that as part of the WFTX Events Zombie Maze, **I may be sprayed, splashed, marked, painted, or otherwise exposed to paint, colored substances, powders, water, fog, smoke, or other special effects**. These substances may come into contact with my clothing, shoes, skin, hair, eyes, or personal belongings. WFTX Events Zombie Maze does not guarantee that paint or other substances will wash completely out of clothing or other personal property. I voluntarily accept these conditions and assume responsibility for damage, staining, discoloration, or loss to clothing or personal property resulting from participation.',
    },
    {
      heading: '3. Wildlife & Outdoor Conditions',
      text: 'I understand that portions of the WFTX Events Zombie Maze may take place outdoors or in a field, wooded area, or other natural environment where **wildlife, insects, reptiles, animals, plants, and other naturally occurring hazards may be present**. Wildlife may include, but is not limited to, snakes, spiders, insects, rodents, birds, coyotes, raccoons, or other animals. Wildlife encounters are unpredictable and WFTX Events Zombie Maze does not control or guarantee the absence of wildlife. To the fullest extent permitted by law, I agree that WFTX Events Zombie Maze, its owners, organizers, employees, contractors, volunteers, agents, and property owners are not responsible for injuries, bites, stings, allergic reactions, or other harm resulting from wildlife or naturally occurring outdoor conditions, except to the extent caused by negligence or as otherwise prohibited by law.',
    },
    {
      heading: '4. Personal Property',
      text: 'I understand that WFTX Events Zombie Maze is not responsible for lost, stolen, damaged, stained, or destroyed personal property, including clothing, shoes, phones, jewelry, bags, or other belongings, except where such responsibility cannot legally be waived.',
    },
    {
      heading: '5. Release of Liability',
      text: 'To the fullest extent permitted by applicable law, I release and hold harmless WFTX Events Zombie Maze, its owners, organizers, employees, contractors, volunteers, actors, agents, and property owners from claims arising from my voluntary participation in the Activity, including claims relating to the risks specifically described in this Waiver. This release does not apply to liability that cannot legally be waived or released under applicable law.',
    },
    {
      heading: '6. Medical Conditions',
      text: 'I understand that the Activity may involve physical exertion, darkness, loud noises, flashing lights, smoke/fog effects, uneven terrain, and other conditions that may affect individuals with certain medical conditions. I certify that I am voluntarily participating and will notify event personnel if I have a condition that may make participation unsafe.',
    },
    {
      heading: '7. Following Instructions',
      text: 'I agree to follow all posted rules and instructions provided by WFTX Events Zombie Maze personnel. Failure to follow safety instructions may result in removal from the Activity without a refund.',
    },
    {
      heading: '8. Emergency Medical Treatment',
      text: 'In the event of an emergency, I authorize WFTX Events Zombie Maze personnel to seek appropriate emergency medical assistance on my behalf if reasonably necessary. I understand that I am responsible for any medical expenses incurred.',
    },
    {
      heading: '9. Minors',
      text: 'If the participant is under 18 years of age, a parent or legal guardian must sign below and agrees to the applicable terms of this Waiver on behalf of the minor, to the extent permitted by law.',
    },
  ],
  acknowledgment: {
    heading: 'Acknowledgment',
    text: 'By signing below, I confirm that I have read and understand this Waiver; participation is voluntary; I may be exposed to paint, powders, water, smoke, fog, special effects, and outdoor conditions; wildlife may be encountered; I voluntarily assume the risks associated with participation; I agree to comply with all WFTX Events Zombie Maze rules and safety instructions; and I understand that I am giving up certain legal rights to the extent permitted by law.',
  },
  // Not on the paper form: required consent for signing electronically (US E-SIGN Act / Texas UETA).
  esignConsent:
    'I agree to sign this Waiver electronically. My electronic signature is the legal equivalent of my handwritten signature.',
};
