// Read-only DOM extractor. This exact function was exercised against Airbnb's visible page.
// No private APIs, hidden application state, cookies, or host personal data are read.
function extractAirbnbPage() {
  const source = new URL(location.href);
  const safe = new URL(source.origin + source.pathname);
  for (const key of ['checkin','checkout','adults','min_bedrooms','currency','room_types[]']) {
    if (source.searchParams.has(key)) safe.searchParams.set(key, source.searchParams.get(key));
  }
  const cards = [...document.querySelectorAll('[data-testid="card-container"]')].map(card => {
    const link = card.querySelector('a[href*="/rooms/"]');
    if (!link) return null;
    const u = new URL(link.href);
    const text = card.innerText;
    const b = text.match(/\b(\d+)\s+bedrooms?\b/i);
    const rating = text.match(/([0-5](?:\.\d+)?) out of 5 average rating, ([\d,]+) reviews?/i);
    return {
      listing_id: u.pathname.match(/\/rooms\/(\d+)/)?.[1] || null,
      url: u.origin + u.pathname,
      name: card.querySelector('[data-testid="listing-card-name"]')?.innerText?.trim() || null,
      title: card.querySelector('[data-testid="listing-card-title"]')?.innerText?.trim() || null,
      bedrooms: b ? Number(b[1]) : null,
      price_text: card.querySelector('[data-testid="price-availability-row"]')?.innerText?.trim() || null,
      checkin: u.searchParams.get('check_in'), checkout: u.searchParams.get('check_out'),
      adults: u.searchParams.get('adults'),
      rating: rating ? Number(rating[1]) : null,
      review_count: rating ? Number(rating[2].replaceAll(',', '')) : null
    };
  }).filter(Boolean);
  return {schema_version:1, provider:'airbnb', source_url:safe.href,
    observed_at:new Date().toISOString(), locale:'en-US', currency:'EUR',
    search_heading:document.querySelector('main h1')?.innerText?.trim() || null,
    query:{checkin:source.searchParams.get('checkin'),checkout:source.searchParams.get('checkout'),
      adults:Number(source.searchParams.get('adults')),bedrooms:Number(source.searchParams.get('min_bedrooms'))},
    coverage:'visible_page_only', location_precision:'area_search_not_radius', cards};
}
