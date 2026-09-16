export type PersonContext = 'street' | 'park' | 'runner' | 'cyclist' | 'basketball' | 'pickleball' |
  'play-child' | 'play-guardian' | 'resting';
export type AgeGroup = 'child' | 'teen' | 'young-adult' | 'adult' | 'older-adult';
export type Occupation = 'lawyer' | 'software-engineer' | 'analyst' | 'office-worker' | 'firefighter' |
  'police-officer' | 'healthcare-worker' | 'construction-worker' | 'courier' | 'chef' | 'gardener' |
  'teacher' | 'artist' | 'student' | 'retired' | 'resident';
export type Outfit = 'suit' | 'office' | 'hoodie' | 'casual' | 'coat' | 'tunic' | 'overalls' |
  'scrubs' | 'apron' | 'fire-gear' | 'police-uniform' | 'hi-vis' | 'sport';
export type Hat = 'none' | 'cap' | 'beanie' | 'sun-hat' | 'brimmed' | 'hard-hat' | 'fire-helmet' |
  'police-cap' | 'cycle-helmet' | 'chef-hat';
export type Bag = 'none' | 'backpack' | 'satchel' | 'briefcase' | 'tote';

export interface PersonProfile {
  readonly id: string;
  readonly context: PersonContext;
  readonly age: number;
  readonly ageGroup: AgeGroup;
  readonly occupation: Occupation;
  readonly purpose: 'commute' | 'stroll' | 'tour' | 'exercise' | 'play' | 'rest';
  readonly outfit: Outfit;
  readonly hat: Hat;
  readonly bag: Bag;
  readonly hair: 'cropped' | 'bob' | 'curls' | 'ponytail' | 'bun' | 'bald';
  readonly glasses: boolean;
  readonly shorts: boolean;
  readonly stature: number;
  readonly build: number;
  readonly skin: string;
  readonly hairColor: string;
  readonly top: string;
  readonly bottom: string;
  readonly accent: string;
  readonly shoes: string;
  readonly pace: number;
}

export const SKIN_TONES = ['#593b30', '#79513c', '#9e6a49', '#bd8965', '#d5a380', '#ebc3a6', '#f3d7bf'] as const;
export const PERSON_SPACE = { width: 0.8, length: 1.2, headway: 1.9, clearance: 1.65 } as const;
const CLOTHES = ['#284957', '#416d78', '#64885c', '#a35248', '#e6b454', '#d6c6a8', '#727f9c',
  '#934f70', '#d57850', '#3d4d6b', '#a5b8aa', '#eee5d1'] as const;
const TROUSERS = ['#29394b', '#465976', '#655748', '#91866f', '#3f4b43', '#c5b49a'] as const;
const HAIR_COLORS = ['#292b29', '#503a30', '#85603e', '#b69256', '#a25c38', '#c5c1b4'] as const;
const JOBS: readonly Occupation[] = ['lawyer', 'software-engineer', 'analyst', 'office-worker', 'firefighter',
  'police-officer', 'healthcare-worker', 'construction-worker', 'courier', 'chef', 'gardener', 'teacher', 'artist'];
const CASUAL: readonly Outfit[] = ['casual', 'hoodie', 'coat', 'tunic', 'office', 'overalls'];
const HATS: readonly Hat[] = ['none', 'none', 'none', 'cap', 'beanie', 'sun-hat', 'brimmed'];
const HAIR: readonly PersonProfile['hair'][] = ['cropped', 'bob', 'curls', 'ponytail', 'bun', 'bald'];

// Independent keyed samples prevent a job or newly added accessory from determining skin/build.
function sample(id: string, feature: string): number {
  let hash = 2166136261;
  for (const char of `${id}:${feature}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}

/** Independent weather preferences; these authored choices are not demographic estimates. */
export function createWeatherTraits(id: string) {
  if (!id.trim()) throw new Error('Weather preferences need a stable nonempty person ID.');
  return Object.freeze({
    rainProtection: sample(id, 'weather:protection') < 0.58 ? 'umbrella' as const : 'raincoat' as const,
    reactionSeconds: 0.8 + sample(id, 'weather:reaction') * 3.2,
    returnSeconds: 5 + sample(id, 'weather:return') * 20,
    hurry: sample(id, 'weather:hurry'),
    coldThreshold: 3 + sample(id, 'weather:cold') * 4,
    winterHat: sample(id, 'weather:hat') < 0.65 ? 'beanie' as const : 'hood' as const,
  });
}

/** Original miniature casting, not demographic data or a real occupation dress-code model. */
export function createPersonProfile(id: string, context: PersonContext): PersonProfile {
  if (!id.trim()) throw new Error('A person needs a stable nonempty ID.');
  const pick = <T,>(feature: string, values: readonly T[]): T => values[Math.floor(sample(id, feature) * values.length)];
  const sport = context === 'runner' || context === 'basketball' || context === 'pickleball';
  const activeAdult = sport || context === 'cyclist' || context === 'play-guardian';
  const ageRoll = sample(id, 'age-group');
  const ageGroup: AgeGroup = context === 'play-child' ? 'child' : activeAdult
    ? ageRoll < 0.3 ? 'young-adult' : ageRoll < 0.8 ? 'adult' : 'older-adult'
    : ageRoll < 0.12 ? 'child' : ageRoll < 0.24 ? 'teen' : ageRoll < 0.43 ? 'young-adult' :
      ageRoll < 0.8 ? 'adult' : 'older-adult';
  const ages = { child: [7, 11], teen: [12, 17], 'young-adult': [18, 29], adult: [30, 59], 'older-adult': [60, 83] } as const;
  const [minAge, maxAge] = ages[ageGroup];
  const age = minAge + Math.floor(sample(id, 'age') * (maxAge - minAge + 1));
  const young = ageGroup === 'child' || ageGroup === 'teen';
  const occupation = young ? 'student' : age > 65 && sample(id, 'retired') < 0.6 ? 'retired' :
    sample(id, 'employed') < 0.84 ? pick('occupation', JOBS) : 'resident';
  const working = !young && occupation !== 'retired' && occupation !== 'resident';
  const purpose: PersonProfile['purpose'] = sport || context === 'cyclist' ? 'exercise' :
    context === 'play-child' ? 'play' : context === 'resting' || context === 'play-guardian' ? 'rest' :
      context === 'street' && working && sample(id, 'commuting') < 0.78 ? 'commute' :
        sample(id, 'touring') < 0.35 ? 'tour' : 'stroll';
  let outfit: Outfit = sport ? 'sport' : pick('casual-outfit', CASUAL);
  let hat = pick('hat', HATS);
  let bag: Bag = sport || context === 'play-child' ? 'none' :
    pick('bag', ['none', 'none', 'backpack', 'satchel', 'tote'] as const);
  let top: string = pick('top', CLOTHES);
  let bottom: string = pick('bottom', TROUSERS);
  let shoes = sport ? '#e9e7d9' : pick('shoes', ['#303735', '#76513c', '#e4dccc']);
  if (purpose === 'commute') {
    switch (occupation) {
      case 'lawyer': outfit = pick('workwear', ['suit', 'office']); bag = 'briefcase'; break;
      case 'software-engineer': outfit = pick('workwear', ['hoodie', 'office', 'suit']); bag = 'backpack'; break;
      case 'analyst':
      case 'office-worker': outfit = pick('workwear', ['suit', 'office', 'coat']); bag = 'satchel'; break;
      case 'firefighter': outfit = 'fire-gear'; hat = 'fire-helmet'; bag = 'none'; top = '#b3a078'; bottom = top; break;
      case 'police-officer': outfit = 'police-uniform'; hat = 'police-cap'; bag = 'none'; top = '#303f58'; bottom = top; break;
      case 'healthcare-worker': outfit = 'scrubs'; top = pick('scrubs', ['#548b8b', '#6286ac', '#638365']); bottom = top; break;
      case 'construction-worker': outfit = 'hi-vis'; hat = 'hard-hat'; top = '#e4ad46'; break;
      case 'courier': outfit = 'hi-vis'; bag = 'backpack'; top = '#cbaa4e'; break;
      case 'chef': outfit = 'apron'; hat = 'chef-hat'; top = '#e6dfcc'; break;
      case 'gardener': outfit = 'overalls'; hat = 'sun-hat'; break;
      case 'teacher': outfit = 'office'; bag = 'tote'; break;
      case 'artist': outfit = 'tunic'; bag = 'satchel'; break;
    }
    if (outfit === 'fire-gear' || outfit === 'hi-vis' || outfit === 'overalls') shoes = '#443d32';
  }
  if (context === 'cyclist') hat = 'cycle-helmet';
  if (sport) hat = sample(id, 'sport-cap') < 0.35 ? 'cap' : 'none';
  const stature = ageGroup === 'child' ? 1.12 + (age - 7) * 0.057 + sample(id, 'height') * 0.12 :
    ageGroup === 'teen' ? 1.44 + (age - 12) * 0.043 + sample(id, 'height') * 0.15 :
      1.53 + sample(id, 'height') * 0.4;
  // Purpose biases desired pace; overlapping ranges avoid making every worker/older person alike.
  const pace = context === 'runner' ? 2.4 + sample(id, 'pace') * 0.25 :
    purpose === 'commute' ? 1.22 + sample(id, 'pace') * 0.34 :
      purpose === 'tour' ? 0.86 + sample(id, 'pace') * 0.24 : 0.94 + sample(id, 'pace') * 0.35;
  return Object.freeze({
    id, context, age, ageGroup, occupation, purpose, outfit, hat, bag,
    hair: pick('hair', HAIR), glasses: sample(id, 'glasses') < 0.3,
    shorts: sport || (outfit === 'casual' && sample(id, 'shorts') < 0.45),
    stature, build: 0.84 + sample(id, 'build') * 0.24, skin: pick('skin', SKIN_TONES),
    hairColor: age > 59 && sample(id, 'gray') < 0.65 ? '#c5c1b4' : pick('hair-color', HAIR_COLORS),
    top, bottom, accent: pick('accent', CLOTHES), shoes, pace,
  });
}
