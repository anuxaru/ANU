/* Shared icon helper for the website and the admin panel.
   Brand logos come from the open "Simple Icons" set (CC0) on jsDelivr and are painted with
   the current text colour, so they always match the theme (light and dark). */
window.ANU_ICONS = (() => {
  const CDN = "https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/";
  const svg = body => "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" + body + "</svg>");
  const OWN = {
    email: svg("<rect x='3' y='5' width='18' height='14' rx='2'/><path d='m3 7 9 6 9-6'/>"),
    link:  svg("<path d='M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.7 1.7'/><path d='M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.7-1.7'/>"),
    up:    svg("<path d='M12 19V5'/><path d='m5 12 7-7 7 7'/>"),
    chat:  svg("<path d='M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z'/>")
  };
  // [key, name, brand file, example link]
  const PRESETS = [
    ["instagram", "Instagram", "instagram", "https://instagram.com/yourname"],
    ["facebook",  "Facebook",  "facebook",  "https://facebook.com/yourname"],
    ["whatsapp",  "WhatsApp",  "whatsapp",  "https://wa.me/8801XXXXXXXXX"],
    ["tiktok",    "TikTok",    "tiktok",    "https://tiktok.com/@yourname"],
    ["youtube",   "YouTube",   "youtube",   "https://youtube.com/@yourname"],
    ["x",         "X (Twitter)", "x",       "https://x.com/yourname"],
    ["snapchat",  "Snapchat",  "snapchat",  "https://snapchat.com/add/yourname"],
    ["telegram",  "Telegram",  "telegram",  "https://t.me/yourname"],
    ["pinterest", "Pinterest", "pinterest", "https://pinterest.com/yourname"],
    ["linkedin",  "LinkedIn",  "linkedin",  "https://linkedin.com/in/yourname"],
    ["spotify",   "Spotify",   "spotify",   "https://open.spotify.com/user/..."],
    ["email",     "Email",     null,        "you@example.com"]
  ];
  // extra choices for "More links"
  const EXTRA = PRESETS.map(p => [p[0], p[1]]).concat([
    ["discord", "Discord"], ["threads", "Threads"], ["github", "GitHub"], ["twitch", "Twitch"],
    ["reddit", "Reddit"], ["medium", "Medium"], ["link", "Website / other"]
  ]);
  const NAME = Object.fromEntries(EXTRA);

  function url(key) { return OWN[key] || CDN + encodeURIComponent(key) + ".svg"; }
  function el(key) {
    const k = (OWN[key] || NAME[key]) ? key : "link";
    const s = document.createElement("span");
    s.className = "ico"; s.setAttribute("aria-hidden", "true");
    s.style.setProperty("--i", 'url("' + url(k) + '")');
    return s;
  }
  return { PRESETS, EXTRA, NAME, url, el };
})();
