// Display names follow familiar English usage; the set covers the 68 Malta and Gozo local councils.
export const LOCALITIES = [
  "Attard", "Balzan", "Birgu", "Birkirkara", "Birżebbuġa", "Bormla", "Dingli", "Fgura",
  "Floriana", "Fontana (Gozo)", "Għajnsielem (Gozo)", "Għarb (Gozo)", "Għargħur", "Għasri (Gozo)",
  "Għaxaq", "Gudja", "Gżira", "Ħamrun", "Iklin", "Isla", "Kalkara", "Kerċem (Gozo)", "Kirkop",
  "Lija", "Luqa", "Marsa", "Marsaskala", "Marsaxlokk", "Mdina", "Mellieħa", "Mgarr",
  "Mosta", "Mqabba", "Msida", "Mtarfa", "Munxar (Gozo)", "Nadur (Gozo)", "Naxxar",
  "Paola", "Pembroke", "Pietà", "Qala (Gozo)", "Qormi", "Qrendi", "Rabat (Gozo)",
  "Rabat (Malta)", "Safi", "San Ġwann", "San Lawrenz (Gozo)", "Sannat (Gozo)", "Santa Luċija", "Santa Venera",
  "Siġġiewi", "Sliema", "St. Julian's", "St. Paul's Bay", "Swieqi", "Tarxien", "Ta' Xbiex",
  "Valletta", "Xagħra (Gozo)", "Xewkija (Gozo)", "Xgħajra", "Żabbar", "Żebbuġ (Gozo)",
  "Żebbuġ (Malta)", "Żejtun", "Żurrieq"
] as const;

// San Pawl and San Ġiljan are also used in older listings and imported files.
const ALIASES:Record<string,string> = {
  sanpawlilbahar:"St. Paul's Bay", saintpaulsbay:"St. Paul's Bay", stpaulsbay:"St. Paul's Bay",
  qawra:"St. Paul's Bay", bugibba:"St. Paul's Bay", sanġiljan:"St. Julian's",
  sangiljan:"St. Julian's", saintjulians:"St. Julian's", stjulians:"St. Julian's",
  tassliema:"Sliema", illbeltvalletta:"Valletta", beltvalletta:"Valletta",
  mosta:"Mosta", ilmellieha:"Mellieħa", gzira:"Gżira", ilgzira:"Gżira"
};

function key(value:string){return value.toLocaleLowerCase('en').replaceAll('ħ','h').replaceAll('ġ','g').replaceAll('ż','z').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
const lookup=new Map<string,string>(LOCALITIES.map(name=>[key(name),name]));
for(const [alias,name] of Object.entries(ALIASES))lookup.set(key(alias),name);
lookup.set(key('Rabat'), 'Rabat (Malta)');
lookup.set(key('Victoria, Gozo'), 'Rabat (Gozo)');
lookup.set(key('Żebbuġ'), 'Żebbuġ (Malta)');
lookup.set(key('Mgarr, Malta'), 'Mgarr');

export function canonicalLocality(value:string):string|null {
  const input=value.trim();
  return lookup.get(key(input))??lookup.get(key(input.split(',')[0]))??null;
}
