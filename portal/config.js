// Known Good Media parent portal: settings.
// Leave SUPABASE_URL empty to run in DEMO MODE (everything is saved only in this browser).
// See portal/SETUP.md for how to fill these in.
window.KGM_CONFIG = {
  SUPABASE_URL: "https://cvqqibakjptnmutdwnni.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cXFpYmFranB0bm11dGR3bm5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjAxMTYsImV4cCI6MjEwNjA5NjExNn0.OQQOaS6yN9D4Kxx0XE1O3TAgLoZfQe7-TSSGRpQIrlA", // public "anon" key; row-level security protects the data

  CONTACT_EMAIL: "joe@knowngoodmedia.com",

  // Packages shown to parents. Paste each package's Stripe Payment Link into `pay`,
  // and the link for "package + Rush delivery" into `pay_rush` (used when the parent picks rush).
  // The portal adds ?client_reference_id=<order id> so you can match payments to orders in Stripe.
  PACKAGES: [
    // Retired Oct 2026 (no orders). Kept, hidden, so any old orders and links still show its name.
    { id: "unknown", name: "Unknown", price: 75, plays: "Up to 8 plays", hidden: true,
      includes: ["Player card with photo", "Music", "Delivered in 5 days"], pay: "https://buy.stripe.com/dRm28kb537Wh5xQgQe5AQ07", pay_rush: "https://buy.stripe.com/14A00cddb1xT2lE1Vk5AQ0b" },
    { id: "known", name: "Known", price: 150, plays: "Up to 15 plays",
      includes: ["Player card, player ID on every play, music", "Wide cut for coaches + vertical cut for social", "Slow-mo replays, play labels, team colors", "1 round of changes"], pay: "https://buy.stripe.com/eVq28k0qp0tPaSa9nM5AQ06", pay_rush: "https://buy.stripe.com/5kQ9AMehfdgB5xQbvU5AQ0a" },
    { id: "well-known", name: "Well-Known", price: 250, plays: "Up to 25 plays", featured: true,
      includes: ["Everything in Known", "Recruiting profile graphic", "2 rounds of changes"], pay: "https://buy.stripe.com/7sY6oA7SR6Sd7FYfMa5AQ05", pay_rush: "https://buy.stripe.com/9B69AM2yx7Wh3pIdE25AQ09" },
    { id: "household-name", name: "Household Name", price: 500, plays: "Full season", no_rush: true,
      includes: ["Everything in Well-Known", "We film 4 of your games", "Mid-season and end-of-season reels", "Commitment and offer graphics", "3 rounds of changes per reel"], pay: "https://buy.stripe.com/28E00c3CBa4paSa6bA5AQ04", pay_rush: "https://buy.stripe.com/eVq8wIgpn3G19O68jI5AQ08" },
    // Youth line (younger athletes): a keepsake, not a recruiting tool. Paste its Stripe links when you make them.
    { id: "rookie", line: "youth", name: "Rookie", price: 100, plays: "Season highlight reel",
      includes: ["Fun player card with photo and number", "Trading card graphic", "Music, wide and vertical cuts", "No stats or contact info shown"], pay: "https://buy.stripe.com/dRmcMYflj0tPd0i7fE5AQ0c", pay_rush: "https://buy.stripe.com/bJe6oAb53b8t6BU1Vk5AQ0d" },
  ],
  RUSH: { price: 35, label: "Rush delivery (48 hours)" },

  // Film uploads larger than this go by link instead (Supabase free plan caps files at 50 MB;
  // raise this after upgrading to the Pro plan).
  MAX_UPLOAD_MB: 50,
};
