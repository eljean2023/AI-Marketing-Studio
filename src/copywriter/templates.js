// Plain data: no Node/Electron APIs, safe to import directly into the
// renderer (same category as src/shared/resolve-duration.js). Placeholders
// {business}, {topic}, and {cta} are filled in by generate.js.

export const HOOK_TEMPLATES = {
  professional: [
    "Discover how {business} can transform your approach to {topic}.",
    "Introducing a smarter way to handle {topic} — brought to you by {business}.",
    "{business}: the trusted choice for {topic}.",
  ],
  casual: [
    "Hey! Have you tried {topic} yet? {business} makes it easy.",
    "We think you're going to love this: {topic}, by {business}.",
    "{business} just made {topic} way more fun.",
  ],
  exciting: [
    "This just in: {topic} is here, and it's a total game-changer from {business}!",
    "Get ready — {business} is redefining {topic}!",
    "Huge news: {business}'s take on {topic} will blow your mind!",
  ],
};

export const TITLE_TEMPLATES = {
  professional: [
    "{business} — Your Partner for {topic}",
    "Elevate Your {topic} with {business}",
    "{topic}, Done Right by {business}",
  ],
  casual: [
    "{topic}? {business}'s Got You Covered",
    "The Easy Way to Enjoy {topic}",
    "{business} Loves {topic} — You Will Too",
  ],
  exciting: [
    "{topic} Just Got a Major Upgrade!",
    "{business} Brings the Hype to {topic}!",
    "Don't Sleep on This: {topic} from {business}",
  ],
};

export const DESCRIPTION_TEMPLATES = {
  professional: [
    "At {business}, we take {topic} seriously, delivering consistent quality you can rely on every time.",
    "{business} combines expertise and care to make {topic} simple, reliable, and worth your trust.",
  ],
  casual: [
    "{business} is all about making {topic} easy and enjoyable — no stress, just good results.",
    "Whether you're new to {topic} or a longtime fan, {business} has something for you.",
  ],
  exciting: [
    "{business} is shaking things up with {topic} — bigger, bolder, and better than ever!",
    "Everyone's talking about {topic} at {business}, and once you try it, you'll see why!",
  ],
};

// Wraps whatever CTA text the caller provided (from Brand Kit or typed in).
export const CTA_WRAPPER_TEMPLATES = {
  professional: [
    "{cta}.",
    "Ready to get started? {cta}.",
    "{cta} — we're here to help.",
  ],
  casual: [
    "{cta}!",
    "Go ahead, {cta}.",
    "{cta} — you'll be glad you did.",
  ],
  exciting: [
    "{cta} now!",
    "{cta} before it's gone!",
    "{cta} — don't wait!",
  ],
};

// Used only when no CTA was provided at all.
export const CTA_FALLBACKS = {
  professional: ["Learn More", "Get Started Today", "Contact Us"],
  casual: ["Check It Out", "Give It a Try", "Come Say Hi"],
  exciting: ["Grab Yours Now", "Join the Fun", "Don't Miss Out"],
};

export const EVERGREEN_HASHTAGS = [
  "#SmallBusiness",
  "#ShopLocal",
  "#NewLaunch",
  "#MustTry",
  "#Trending",
  "#SupportLocal",
  "#QualityFirst",
  "#CustomerFirst",
];
