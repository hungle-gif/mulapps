/**
 * X.com (Twitter) DOM Selectors
 * Mapped from live DOM snapshot 2026-03-31
 * These selectors are used by the X adapter to interact with the platform
 */

export const X_SELECTORS = {
  // === NAVIGATION ===
  nav: {
    home: 'a[href="/home"]',
    explore: 'a[href="/explore"]',
    notifications: 'a[href="/notifications"]',
    messages: 'a[href="/i/chat"]',
    bookmarks: 'a[href="/i/bookmarks"]',
    profile: 'a[href$="lehung30101995"]', // dynamic per user
    postButton: 'a[href="/compose/post"]',
    searchInput: 'input[placeholder="Search query"]',
  },

  // === POST (COMPOSE) ===
  compose: {
    textbox: 'div[data-testid="tweetTextarea_0"]',
    textboxAlt: 'textbox[description="What\'s happening?"]',
    postButton: 'button[data-testid="tweetButton"]',
    postButtonDisabled: 'button[data-testid="tweetButton"][disabled]',
    addPhoto: 'button[aria-label="Add photos or video"]',
    addGif: 'button[aria-label="Add a GIF"]',
    addPoll: 'button[aria-label="Add poll"]',
    addEmoji: 'button[aria-label="Add emoji"]',
    schedulePost: 'button[aria-label="Schedule post"]',
    fileInput: 'input[type="file"]',
  },

  // === TIMELINE ===
  timeline: {
    container: 'div[aria-label="Home timeline"]',
    forYouTab: 'tab[aria-selected="true"]', // "For you"
    followingTab: 'tab:not([aria-selected="true"])', // "Following"
    articles: 'article',
    tweetText: '[data-testid="tweetText"]',
  },

  // === TWEET ACTIONS ===
  tweet: {
    replyButton: 'button[data-testid="reply"]',
    retweetButton: 'button[data-testid="retweet"]',
    likeButton: 'button[data-testid="like"]',
    unlikeButton: 'button[data-testid="unlike"]',
    bookmarkButton: 'button[aria-label="Bookmark"]',
    shareButton: 'button[aria-label*="Share post"]',
    moreButton: 'button[aria-label="More"]',
    analyticsLink: 'a[href*="/analytics"]',
  },

  // === TWEET METRICS (from aria-label) ===
  metrics: {
    // Pattern: "N Replies. Reply" / "N reposts. Repost" / "N Likes. Like" / "N views"
    replies: 'button[aria-label*="Replies"]',
    reposts: 'button[aria-label*="reposts"]',
    likes: 'button[aria-label*="Likes"]',
    views: 'a[aria-label*="views"]',
  },

  // === SEARCH & EXPLORE ===
  search: {
    input: 'input[aria-label="Search query"]',
    trending: 'div[aria-label="Trending now"]',
    trendingItems: 'div[aria-label="Trending now"] a',
  },

  // === PROFILE ===
  profile: {
    name: 'div[data-testid="UserName"]',
    bio: 'div[data-testid="UserDescription"]',
    followers: 'a[href*="/followers"]',
    following: 'a[href*="/following"]',
    editProfile: 'button[data-testid="editProfileButton"]',
  },

  // === DIRECT MESSAGES ===
  dm: {
    chatList: 'div[aria-label="Direct Messages"]',
    messageInput: 'div[data-testid="dmComposerTextInput"]',
    sendButton: 'button[data-testid="dmComposerSendButton"]',
    conversations: 'div[data-testid="conversation"]',
  },

  // === NOTIFICATIONS ===
  notifications: {
    container: 'div[aria-label="Notifications"]',
    tabs: {
      all: 'a[href="/notifications"]',
      mentions: 'a[href="/notifications/mentions"]',
    },
  },
} as const;

/**
 * X.com URL patterns
 */
export const X_URLS = {
  home: 'https://x.com/home',
  explore: 'https://x.com/explore',
  notifications: 'https://x.com/notifications',
  messages: 'https://x.com/i/chat',
  compose: 'https://x.com/compose/post',
  search: (query: string) => `https://x.com/search?q=${encodeURIComponent(query)}`,
  profile: (username: string) => `https://x.com/${username}`,
  tweet: (username: string, tweetId: string) => `https://x.com/${username}/status/${tweetId}`,
  tweetAnalytics: (username: string, tweetId: string) => `https://x.com/${username}/status/${tweetId}/analytics`,
  trending: 'https://x.com/explore/tabs/trending',
  settings: 'https://x.com/settings',
} as const;
