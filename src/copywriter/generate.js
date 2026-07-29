import {
  HOOK_TEMPLATES,
  TITLE_TEMPLATES,
  DESCRIPTION_TEMPLATES,
  CTA_WRAPPER_TEMPLATES,
  CTA_FALLBACKS,
  EVERGREEN_HASHTAGS,
} from './templates.js';

function fillTemplate(template, vars) {
  const filled = template
    .replace(/\{business\}/g, vars.business)
    .replace(/\{topic\}/g, vars.topic)
    .replace(/\{cta\}/g, vars.cta || '');

  // Templates that open with {business} need its first letter capitalized
  // at the start of a sentence -- harmless no-op for a real business name
  // (already capitalized), but fixes the "your business" fallback reading
  // lowercase at a sentence start.
  if (template.startsWith('{business}')) {
    return filled.charAt(0).toUpperCase() + filled.slice(1);
  }

  return filled;
}

// Samples n distinct items from an array (order shuffled), without
// mutating the source array.
function sampleDistinct(array, n) {
  const pool = [...array];
  const picked = [];
  const count = Math.min(n, pool.length);

  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function titleCase(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Derives hashtags from significant words in the topic/business name
// (strips punctuation, drops very short words, dedupes), then tops up
// with a few evergreen tags so there's always a reasonable-sized set.
function deriveHashtags(topic, business) {
  const words = `${topic} ${business}`
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((word) => word.length > 2);

  const seen = new Set();
  const derived = [];
  words.forEach((word) => {
    const tag = `#${titleCase(word)}`;
    if (!seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      derived.push(tag);
    }
  });

  const evergreen = sampleDistinct(EVERGREEN_HASHTAGS, 4).filter(
    (tag) => !seen.has(tag.toLowerCase())
  );

  return [...derived, ...evergreen].slice(0, 10);
}

export function generateCopy({ businessName, topic, tone, cta }) {
  const business = (businessName || '').trim() || 'your business';
  const trimmedTopic = topic.trim();
  const effectiveCta = (cta || '').trim() || sampleDistinct(CTA_FALLBACKS[tone], 1)[0];

  const vars = { business, topic: trimmedTopic, cta: effectiveCta };

  const hooks = sampleDistinct(HOOK_TEMPLATES[tone], 3).map((t) => fillTemplate(t, vars));
  const titles = sampleDistinct(TITLE_TEMPLATES[tone], 3).map((t) => fillTemplate(t, vars));
  const descriptions = sampleDistinct(DESCRIPTION_TEMPLATES[tone], 2).map((t) => fillTemplate(t, vars));
  const ctas = sampleDistinct(CTA_WRAPPER_TEMPLATES[tone], 2).map((t) => fillTemplate(t, vars));
  const hashtags = deriveHashtags(trimmedTopic, business);

  const videoScript = [
    '[HOOK]',
    hooks[0],
    '',
    '[BODY]',
    descriptions[0],
    '',
    '[CALL TO ACTION]',
    ctas[0],
  ].join('\n');

  return { hooks, titles, descriptions, ctas, hashtags, videoScript };
}
