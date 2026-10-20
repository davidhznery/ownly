import {LOCALITIES, canonicalLocality} from '../localities.ts';

export const areas = LOCALITIES;
export const priorityAreas = ["St. Paul's Bay", 'Sliema', "St. Julian's", 'Valletta', 'Mellieħa', 'Gżira', 'Msida', 'Swieqi', 'Marsaskala', 'Rabat (Gozo)'];

export function searchLocation(area) {
  if (!areas.includes(area)) throw Error('Unsupported area');
  const overrides = {"St. Paul's Bay":'St.-Paul’s-Bay--Malta', "St. Julian's":'Saint-Julian’s--Malta', 'Rabat (Gozo)':'Victoria--Gozo--Malta', 'Rabat (Malta)':'Rabat--Malta', 'Mgarr':'Mgarr--Malta'};
  return overrides[area] ?? area.replace(' (Gozo)', '--Gozo').replace(' (Malta)', '').replaceAll(' ', '-')+'--Malta';
}

export function listingLocality(value) {
  return canonicalLocality(value) ?? value.trim();
}
