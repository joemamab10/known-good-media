// Known Good Media parent portal: settings.
// Leave SUPABASE_URL empty to run in DEMO MODE (everything is saved only in this browser).
// See portal/SETUP.md for how to fill these in.
window.KGM_CONFIG = {
  SUPABASE_URL: "https://cvqqibakjptnmutdwnni.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cXFpYmFranB0bm11dGR3bm5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjAxMTYsImV4cCI6MjEwNjA5NjExNn0.OQQOaS6yN9D4Kxx0XE1O3TAgLoZfQe7-TSSGRpQIrlA", // public "anon" key; row-level security protects the data

  CONTACT_EMAIL: "jbejarno@gmail.com",

  // Packages shown to parents. Paste each package's Stripe Payment Link into `pay`.
  // The portal adds ?client_reference_id=<order id> so you can match payments to orders in Stripe.
  PACKAGES: [
    { id: "unknown", name: "Unknown", price: 89, plays: "Up to 8 plays",
      includes: ["Player card with photo", "Music", "Delivered in 5 days"], pay: "" },
    { id: "known", name: "Known", price: 159, plays: "Up to 15 plays",
      includes: ["Full hype edit + smart zoom", "Slow-mo replays", "Team-color branding", "1 revision"], pay: "" },
    { id: "well-known", name: "Well-Known", price: 249, plays: "Up to 25 plays", featured: true,
      includes: ["Everything in Known", "Vertical cut for Instagram/TikTok", "Recruiting graphic", "2 revisions"], pay: "" },
    { id: "household-name", name: "Household Name", price: 539, plays: "Full season",
      includes: ["We film 4 games", "Mid + end-of-season reels", "Social cuts all season"], pay: "" },
  ],
  RUSH: { price: 35, label: "Rush delivery (48 hours)" },

  // Film uploads larger than this go by link instead (Supabase free plan caps files at 50 MB;
  // raise this after upgrading to the Pro plan).
  MAX_UPLOAD_MB: 50,
};
