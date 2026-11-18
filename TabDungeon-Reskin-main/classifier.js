// TabDungeon - Legacy content classifier
// Estimates whether a page resembles learning-oriented or non-learning content.

const DEFAULT_LEARNING_DOMAINS = [
  // Search & Knowledge
  'google.com', 'wikipedia.org', 'scholar.google.com',
  'answers.com', 'quartz.com', 'medium.com',
  
  // Academic & Research
  'arxiv.org', 'acm.org', 'ieee.org', 'springer.com',
  'sciencedirect.com', 'jstor.org', 'pubmed.ncbi.nlm.nih.gov',
  'researchgate.net', 'academia.edu',
  
  // Coding & Development
  'github.com', 'stackoverflow.com', 'gitlab.com',
  'codecademy.com', 'freecodecamp.org', 'w3schools.com',
  'developer.mozilla.org', 'dev.to', 'hashnode.com',
  'pluralsight.com', 'coursera.org', 'udemy.com',
  'kaggle.com', 'leetcode.com', 'hackerrank.com',
  
  // Documentation & Learning
  'chatgpt.com', 'claude.ai', 'bard.google.com',
  'notion.so', 'obsidian.md', 'evernote.com',
  'docs.google.com', 'drive.google.com',
  
  // Productivity Tools
  'trello.com', 'asana.com', 'notion.so',
  'calendar.google.com', 'outlook.live.com',
  
  // News & Reading (educational)
  'bbc.com', 'reuters.com', 'theguardian.com',
  'nationalgeographic.com', 'smithsonianmag.com',
  
  // Government & Educational Institutions
  'edu', 'gov',
  
  // CVSU (user's school)
  'cvsu.edu.ph',
];

const DEFAULT_NON_LEARNING_DOMAINS = [
  // Social Media
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'tiktok.com', 'snapchat.com', 'linkedin.com',
  'reddit.com', 'pinterest.com', 'tumblr.com',
  
  // Video Streaming
  'youtube.com', 'netflix.com', 'twitch.tv', 'dailymotion.com',
  'vimeo.com', 'primevideo.com', 'disneyplus.com',
  
  // Gaming
  'steamcommunity.com', 'roblox.com', 'minecraft.net',
  'epicgames.com', 'blizzard.com',
  
  // Shopping
  'amazon.com', 'shopify.com', 'ebay.com', 'etsy.com',
  'etsy.com', 'aliexpress.com',
  
  // Entertainment & Misc
  'tinder.com', 'bumble.com', 'pinterest.com',
  'imgur.com', '9gag.com', 'memegenerator.com',
  
  // Streaming Music
  'spotify.com', 'soundcloud.com', 'apple.music.com',
];

const LEARNING_PATTERNS = [
  /\/courses\/?/i,
  /\/lecture\/?/i,
  /\/tutorial\/?/i,
  /\/learn\/?/i,
  /\/education\/?/i,
  /\/academic\/?/i,
  /\/research\/?/i,
  /\/documentary\/?/i,
  /\/article\/?/i,
  /\/blog\/?/i,
  /\/documentation\/?/i,
  /\/api-docs\/?/i,
  /\/references\/?/i,
  /\/study\/?/i,
  /\/class\/?/i,
  /\/school\/?/i,
  /\/university\/?/i,
  /\/college\/?/i,
  /\/homework\/?/i,
  /\/assignment/i,
  /\/paper/i,
  /\/thesis/i,
  /\/project/i,
  /\/portfolio/i,
  /\/interview/i,
  /\/practice/i,
  /\/quiz/i,
  /\/exam/i,
  /\/test/i,
];

const NON_LEARNING_PATTERNS = [
  /\/feed\/?/i,
  /\/stories\/?/i,
  /\/explore\/?/i,
  /\/trending\/?/i,
  /\/viral\/?/i,
  /\/reels\/?/i,
  /\/shorts\/?/i,
  /\/entertainment\/?/i,
  /\/movies\/?/i,
  /\/shows\/?/i,
  /\/games\/?/i,
  /\/play\/?/i,
  /\/shop\/?/i,
  /\/store\/?/i,
  /\/product\/?/i,
  /\/cart/i,
  /\/checkout/i,
  /\/deal/i,
  /\/offer/i,
];

const LEARNING_KEYWORDS = [
  'tutorial', 'course', 'lecture', 'lesson', 'learn', 'educational',
  'education', 'how to', 'explained', 'documentation', 'programming',
  'coding', 'javascript', 'python', 'study', 'research', 'math',
  'science', 'university', 'exam', 'class', 'workshop', 'guide',
  'walkthrough', 'development', 'web development'
];

const NON_LEARNING_KEYWORDS = [
  'funny', 'meme', 'prank', 'reaction', 'celebrity', 'gossip',
  'compilation', 'music video', 'lyrics', 'trailer', 'gaming',
  'gameplay', 'stream', 'vlog', 'shorts', 'challenge'
];

function getMetadataText(metadata) {
  return [
    metadata?.title,
    metadata?.description,
    metadata?.keywords,
    ...(metadata?.headings || [])
  ].filter(Boolean).join(' ').toLowerCase();
}

export function classifyPage(url, metadata = {}) {
  const domainClassification = classifyDomain(url);
  const text = getMetadataText(metadata);
  if (!text) return domainClassification;

  const learningScore = LEARNING_KEYWORDS.reduce(
    (score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0
  );
  const nonLearningScore = NON_LEARNING_KEYWORDS.reduce(
    (score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0
  );

  if (learningScore > nonLearningScore && learningScore > 0) return 'learning';
  if (nonLearningScore > learningScore && nonLearningScore > 0) return 'non-learning';
  return domainClassification;
}

/**
 * Classify a domain based on default lists and patterns
 */
export function classifyDomain(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    
    // Check if it's an educational institution
    if (domain.endsWith('.edu') || domain.endsWith('.gov')) {
      return 'learning';
    }
    
    // Check against learning-oriented domains
    for (const learningDomain of DEFAULT_LEARNING_DOMAINS) {
      if (domain.includes(learningDomain) || domain === learningDomain) {
        // Check if the path indicates non-learning content on a learning domain
        for (const pattern of NON_LEARNING_PATTERNS) {
          if (pattern.test(pathname)) {
            return 'non-learning';
          }
        }
        return 'learning';
      }
    }
    
    // Check against non-learning domains
    for (const nonLearningDomain of DEFAULT_NON_LEARNING_DOMAINS) {
      if (domain.includes(nonLearningDomain) || domain === nonLearningDomain) {
        return 'non-learning';
      }
    }
    
    // Check URL patterns for learning-oriented content
    for (const pattern of LEARNING_PATTERNS) {
      if (pattern.test(pathname)) {
        return 'learning';
      }
    }
    
    // Check URL patterns for non-learning content
    for (const pattern of NON_LEARNING_PATTERNS) {
      if (pattern.test(pathname)) {
        return 'non-learning';
      }
    }
    
    // Default: neutral (unclassified)
    return 'neutral';
  } catch (e) {
    console.error('Error classifying domain:', e);
    return 'neutral';
  }
}
