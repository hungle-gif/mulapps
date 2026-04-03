/**
 * Instagram Platform Adapter — CDP Browser Automation
 *
 * Scrapes instagram.com via Chrome DevTools Protocol.
 * Instagram uses data-testid attributes, aria-labels, and React-generated class names.
 * All scrape scripts target the web app (instagram.com), not the mobile API.
 *
 * Key DOM patterns (2026):
 * - Posts in feed: article elements with role="presentation"
 * - Post actions: section inside article (like/comment/share/save buttons)
 * - User links: a[href^="/"] with nested spans for display name
 * - Stories: div[role="menu"] in header area
 * - DMs: instagram.com/direct/inbox with thread list
 * - Compose: instagram.com/create/style/ for photo/reel upload
 *
 * NOTE: Instagram aggressively changes selectors. All selectors marked
 * with "TODO: verify selector live" need periodic validation.
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface InstagramPost {
  post_url: string;
  author: string;
  username: string;
  text: string;
  likes: number;
  comments: number;
  posted_at: string;
  image_urls: string[];
  is_video: boolean;
  is_carousel: boolean;
}

export interface InstagramProfile {
  name: string;
  username: string;
  bio: string;
  followers: number;
  following: number;
  posts_count: number;
  is_verified: boolean;
  profile_pic_url: string;
  external_url: string;
  profile_url: string;
}

export interface InstagramStory {
  username: string;
  story_url: string;
  is_video: boolean;
  timestamp: string;
}

export interface InstagramDM {
  thread_id: string;
  contact_name: string;
  contact_username: string;
  last_message: string;
  unread: boolean;
  timestamp: string;
}

export interface InstagramComment {
  author: string;
  username: string;
  text: string;
  likes: number;
  posted_at: string;
  reply_count: number;
}

// =============================================
// URLS
// =============================================

export const INSTAGRAM_URLS = {
  home: 'https://www.instagram.com/',
  explore: 'https://www.instagram.com/explore/',
  exploreSearch: (query: string) =>
    `https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace('#', ''))}/`,
  search: (query: string) =>
    `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`,
  post: (shortcode: string) => `https://www.instagram.com/p/${shortcode}/`,
  reel: (id: string) => `https://www.instagram.com/reel/${id}/`,
  profile: (username: string) =>
    `https://www.instagram.com/${username.replace('@', '')}/`,
  create: 'https://www.instagram.com/create/style/',
  directInbox: 'https://www.instagram.com/direct/inbox/',
  directThread: (threadId: string) =>
    `https://www.instagram.com/direct/t/${threadId}/`,
  stories: (username: string) =>
    `https://www.instagram.com/stories/${username.replace('@', '')}/`,
  hashtag: (tag: string) =>
    `https://www.instagram.com/explore/tags/${tag.replace('#', '')}/`,
};

// =============================================
// SCRAPE SCRIPTS
// =============================================

/**
 * Scrape Instagram feed posts from home or explore page.
 * Instagram renders posts inside <article> elements.
 * Each article has: header (user info), media, action buttons (like/comment/share/save), caption.
 */
export const SCRAPE_FEED_SCRIPT = `() => {
  const posts = [];
  // TODO: verify selector live — Instagram wraps each post in an <article> tag
  const articles = document.querySelectorAll('article[role="presentation"], article');

  articles.forEach(article => {
    try {
      // Author info from header
      // TODO: verify selector live — username link is in the article header
      const headerLink = article.querySelector('header a[href^="/"]');
      const username = headerLink?.getAttribute('href')?.replace(/\\//g, '') || '';
      const displayName = headerLink?.querySelector('span')?.textContent?.trim() || username;

      // Post URL — from the timestamp link which contains /p/ or /reel/
      // TODO: verify selector live — time element wraps a link to the post
      const timeLink = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      const postHref = timeLink?.getAttribute('href') || '';
      const postUrl = postHref ? 'https://www.instagram.com' + postHref : '';

      // Timestamp
      const timeEl = article.querySelector('time');
      const postedAt = timeEl?.getAttribute('datetime') || timeEl?.getAttribute('title') || '';

      // Caption text
      // TODO: verify selector live — caption is usually in a span within the first comment-like area
      const captionContainer = article.querySelector('div[role="button"] span, ul li:first-child span');
      let text = '';
      if (captionContainer) {
        // Get text but skip "more" button text
        const cloned = captionContainer.cloneNode(true);
        const moreBtn = cloned.querySelector('[role="button"]');
        if (moreBtn) moreBtn.remove();
        text = cloned.textContent?.trim() || '';
      }

      // Like count — Instagram shows "Liked by X and N others" or just a count
      // TODO: verify selector live — like section is below the media
      const likeSection = article.querySelector('section:last-of-type a[href*="/liked_by/"], section button span');
      let likes = 0;
      const likeText = likeSection?.textContent?.trim() || '';
      const likeMatch = likeText.match(/([\\ \\d,.]+)/);
      if (likeMatch) {
        likes = parseInt(likeMatch[1].replace(/[,.\\ ]/g, '')) || 0;
      }

      // Comment count — from "View all N comments" link
      // TODO: verify selector live
      const commentLink = article.querySelector('a[href*="/comments/"], a[href*="/p/"] span');
      let comments = 0;
      const commentText = commentLink?.textContent?.trim() || '';
      const commentMatch = commentText.match(/([\\ \\d,.]+)\\s*comment/i);
      if (commentMatch) {
        comments = parseInt(commentMatch[1].replace(/[,.\\ ]/g, '')) || 0;
      }

      // Media — check for images and videos
      // TODO: verify selector live
      const images = Array.from(article.querySelectorAll('img[srcset], img[src*="instagram"]'))
        .map(img => img.getAttribute('src') || '')
        .filter(src => src && !src.includes('profile') && src.includes('instagram'));
      const hasVideo = !!article.querySelector('video');
      const isCarousel = !!article.querySelector('[aria-label*="Carousel"], [aria-label*="Go"]');

      if (username && postUrl) {
        posts.push({
          post_url: postUrl,
          author: displayName,
          username: '@' + username,
          text: text.substring(0, 500),
          likes,
          comments,
          posted_at: postedAt,
          image_urls: images.slice(0, 5),
          is_video: hasVideo,
          is_carousel: isCarousel,
        });
      }
    } catch (e) {
      // Skip malformed articles
    }
  });

  return posts;
}`;

/**
 * Scrape explore/trending grid — thumbnails with links.
 * The explore page is a grid of post thumbnails.
 */
export const SCRAPE_EXPLORE_SCRIPT = `() => {
  const items = [];
  // TODO: verify selector live — explore grid items are links containing images
  const gridLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
  const seen = new Set();

  gridLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    if (seen.has(href)) return;
    seen.add(href);

    const img = link.querySelector('img');
    const video = link.querySelector('video');
    const thumbnail = img?.getAttribute('src') || '';
    const alt = img?.getAttribute('alt') || '';

    // Try to parse likes/comments from overlay on hover
    // TODO: verify selector live — hover overlay shows like and comment counts
    const overlaySpans = link.querySelectorAll('span');
    let likes = 0, comments = 0;
    overlaySpans.forEach(span => {
      const text = span.textContent?.trim() || '';
      const num = parseInt(text.replace(/[,.\\ ]/g, '')) || 0;
      // First number is usually likes, second is comments
      if (num > 0 && likes === 0) likes = num;
      else if (num > 0 && comments === 0) comments = num;
    });

    items.push({
      post_url: 'https://www.instagram.com' + href,
      thumbnail,
      alt_text: alt.substring(0, 200),
      is_video: !!video,
      likes,
      comments,
    });
  });

  return items;
}`;

/**
 * Scrape a single post's details (when navigated to /p/{shortcode}/).
 */
export const SCRAPE_POST_DETAIL_SCRIPT = `() => {
  const article = document.querySelector('article[role="presentation"], article');
  if (!article) return null;

  // Author
  // TODO: verify selector live
  const headerLink = article.querySelector('header a[href^="/"]');
  const username = headerLink?.getAttribute('href')?.replace(/\\//g, '') || '';
  const displayName = headerLink?.querySelector('span')?.textContent?.trim() || username;

  // Caption
  const captionEl = article.querySelector('h1, ul li:first-child span, div[role="button"] span');
  const caption = captionEl?.textContent?.trim()?.substring(0, 1000) || '';

  // Like count
  // TODO: verify selector live — likes section text
  const likesEl = article.querySelector('a[href*="/liked_by/"] span, section span');
  let likes = 0;
  const likeText = likesEl?.textContent?.trim() || '';
  const likeNum = likeText.match(/([\\ \\d,.]+)/);
  if (likeNum) likes = parseInt(likeNum[1].replace(/[,.\\ ]/g, '')) || 0;

  // Timestamp
  const timeEl = article.querySelector('time');
  const postedAt = timeEl?.getAttribute('datetime') || '';

  // Comments
  const commentElements = article.querySelectorAll('ul > li, ul > div > li');
  const commentsList = [];
  commentElements.forEach((li, idx) => {
    if (idx === 0) return; // First li is usually the caption
    const commentAuthor = li.querySelector('a[href^="/"]')?.getAttribute('href')?.replace(/\\//g, '') || '';
    const commentText = li.querySelector('span')?.textContent?.trim() || '';
    if (commentAuthor && commentText) {
      commentsList.push({
        author: commentAuthor,
        text: commentText.substring(0, 300),
      });
    }
  });

  // Media
  const images = Array.from(article.querySelectorAll('img[srcset], img[src*="cdninstagram"]'))
    .map(img => img.getAttribute('src') || '')
    .filter(Boolean);
  const hasVideo = !!article.querySelector('video');

  return {
    author: displayName,
    username: '@' + username,
    caption,
    likes,
    posted_at: postedAt,
    comments: commentsList.slice(0, 20),
    comment_count: commentsList.length,
    image_urls: images.slice(0, 10),
    is_video: hasVideo,
    post_url: window.location.href,
  };
}`;

/**
 * Scrape profile page data.
 * Instagram profile pages have a structured header with stats.
 */
export const SCRAPE_PROFILE_SCRIPT = `() => {
  // TODO: verify selector live — profile header section
  const header = document.querySelector('header section, header');
  if (!header) return null;

  const name = header.querySelector('span[class*="x1lliihq"], h1, h2')?.textContent?.trim() || '';

  // Stats: posts, followers, following — in a <ul> with 3 <li> items
  // TODO: verify selector live — stat items structure
  const statItems = header.querySelectorAll('ul li, a[href*="/followers"] span, a[href*="/following"] span');
  let postsCount = 0, followers = 0, following = 0;

  const parseCount = (text) => {
    if (!text) return 0;
    text = text.replace(/,/g, '').trim();
    if (text.endsWith('K') || text.endsWith('k')) return Math.round(parseFloat(text) * 1000);
    if (text.endsWith('M') || text.endsWith('m')) return Math.round(parseFloat(text) * 1000000);
    if (text.endsWith('B') || text.endsWith('b')) return Math.round(parseFloat(text) * 1000000000);
    return parseInt(text) || 0;
  };

  // Try structured stat reading: "N posts", "N followers", "N following"
  const allText = header.textContent || '';
  const postsMatch = allText.match(/([\\ \\d,.]+[KMBkmb]?)\\s*posts?/i);
  const followersMatch = allText.match(/([\\ \\d,.]+[KMBkmb]?)\\s*followers?/i);
  const followingMatch = allText.match(/([\\ \\d,.]+[KMBkmb]?)\\s*following/i);

  if (postsMatch) postsCount = parseCount(postsMatch[1]);
  if (followersMatch) followers = parseCount(followersMatch[1]);
  if (followingMatch) following = parseCount(followingMatch[1]);

  // If text-based parsing failed, try structured <li> approach
  if (followers === 0) {
    const lis = header.querySelectorAll('ul li');
    if (lis.length >= 3) {
      const nums = [];
      lis.forEach(li => {
        const num = li.querySelector('span span, span')?.textContent?.trim() || '';
        nums.push(parseCount(num));
      });
      postsCount = nums[0] || 0;
      followers = nums[1] || 0;
      following = nums[2] || 0;
    }
  }

  // Bio
  // TODO: verify selector live — bio is below the stats
  const bioEl = document.querySelector('header section > div:last-child span, div[class*="-vDXhz"] span, header span[dir="auto"]');
  const bio = bioEl?.textContent?.trim() || '';

  // Verified badge
  // TODO: verify selector live
  const isVerified = !!header.querySelector('[aria-label="Verified"], [title="Verified"]');

  // Profile picture
  const profilePic = header.querySelector('img[alt*="profile"], img[data-testid="user-avatar"]')?.getAttribute('src') || '';

  // External link
  const externalLink = header.querySelector('a[href*="l.instagram.com"], a[rel="me nofollow noopener"]')?.getAttribute('href') || '';

  return {
    name,
    username: window.location.pathname.replace(/\\//g, ''),
    bio: bio.substring(0, 500),
    followers,
    following,
    posts_count: postsCount,
    is_verified: isVerified,
    profile_pic_url: profilePic,
    external_url: externalLink,
    profile_url: window.location.href,
  };
}`;

/**
 * Scrape comments on a post page.
 */
export const SCRAPE_COMMENTS_SCRIPT = `() => {
  const comments = [];
  // TODO: verify selector live — comments are in a list within the article
  const commentItems = document.querySelectorAll('ul > div > li, ul[class] > li');

  commentItems.forEach((item, idx) => {
    if (idx === 0) return; // First item is usually the original caption
    try {
      const authorLink = item.querySelector('a[href^="/"]');
      const username = authorLink?.getAttribute('href')?.replace(/\\//g, '') || '';
      const authorName = authorLink?.textContent?.trim() || username;

      // Comment text — usually in a span after the username link
      const textSpan = item.querySelector('span > span, div > span');
      const text = textSpan?.textContent?.trim() || '';

      // Like count on comment
      // TODO: verify selector live
      const likeBtn = item.querySelector('button[aria-label*="like"], span[class*="like"]');
      const likeText = likeBtn?.textContent?.trim() || '0';
      const likes = parseInt(likeText.replace(/[^\\d]/g, '')) || 0;

      // Timestamp
      const timeEl = item.querySelector('time');
      const postedAt = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

      // Reply count — "View replies (N)"
      const replyLink = item.querySelector('button[class*="reply"], span[class*="reply"]');
      const replyText = replyLink?.textContent?.trim() || '';
      const replyMatch = replyText.match(/(\\d+)/);
      const replyCount = replyMatch ? parseInt(replyMatch[1]) : 0;

      if (username && text) {
        comments.push({
          author: authorName,
          username: '@' + username,
          text: text.substring(0, 500),
          likes,
          posted_at: postedAt,
          reply_count: replyCount,
        });
      }
    } catch (e) {
      // Skip malformed comment items
    }
  });

  return comments;
}`;

/**
 * Scrape DM inbox — list of conversations.
 */
export const SCRAPE_DM_INBOX_SCRIPT = `() => {
  const threads = [];
  // TODO: verify selector live — DM threads are list items in the inbox
  const threadItems = document.querySelectorAll(
    'div[role="listbox"] div[role="option"], ' +
    'div[class*="x9f619"] a[href*="/direct/t/"], ' +
    'div[role="list"] > div'
  );

  threadItems.forEach(item => {
    try {
      // Contact name and username
      const nameEl = item.querySelector('span[dir="auto"], span[class*="x1lliihq"]');
      const contactName = nameEl?.textContent?.trim() || '';

      // Last message preview
      const msgEl = item.querySelectorAll('span[dir="auto"], span');
      let lastMessage = '';
      msgEl.forEach(span => {
        const t = span.textContent?.trim() || '';
        if (t.length > lastMessage.length && t !== contactName) {
          lastMessage = t;
        }
      });

      // Unread indicator
      // TODO: verify selector live
      const unread = !!item.querySelector('[aria-label*="unread"], div[class*="unread"]');

      // Timestamp
      const timeEl = item.querySelector('time');
      const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

      // Thread ID from href
      const threadLink = item.querySelector('a[href*="/direct/t/"]') || item.closest('a[href*="/direct/t/"]');
      const threadHref = threadLink?.getAttribute('href') || '';
      const threadIdMatch = threadHref.match(/\\/direct\\/t\\/([^\\/]+)/);
      const threadId = threadIdMatch ? threadIdMatch[1] : '';

      if (contactName) {
        threads.push({
          thread_id: threadId,
          contact_name: contactName,
          contact_username: '',
          last_message: lastMessage.substring(0, 200),
          unread,
          timestamp,
        });
      }
    } catch (e) {
      // Skip malformed thread items
    }
  });

  return threads;
}`;

/**
 * Scrape story viewers / story content.
 * When viewing a story, the page shows full-screen media.
 */
export const SCRAPE_STORY_SCRIPT = `() => {
  const stories = [];
  // TODO: verify selector live — story tray is in the header area
  const storyItems = document.querySelectorAll(
    'div[role="menu"] button, ' +
    'div[class*="x78zum5"] canvas, ' +
    'div[role="presentation"] div[style*="border-radius"]'
  );

  storyItems.forEach(item => {
    const link = item.closest('a') || item.querySelector('a');
    const href = link?.getAttribute('href') || '';
    const usernameMatch = href.match(/\\/stories\\/([^\\/]+)/);
    const username = usernameMatch ? usernameMatch[1] : '';

    // Alt text from the story ring image
    const img = item.querySelector('img');
    const alt = img?.getAttribute('alt') || '';

    if (username) {
      stories.push({
        username,
        story_url: 'https://www.instagram.com' + href,
        is_video: false,
        timestamp: '',
      });
    }
  });

  return stories;
}`;

// =============================================
// ADAPTER CLASS
// =============================================

export class InstagramPlatformAdapter {
  private cdp: CDPConnector;
  private username: string;

  constructor(cdp: CDPConnector, username?: string) {
    this.cdp = cdp;
    this.username = username || '';
  }

  // =============================================
  // 1. SCRAPE FEED
  // =============================================

  /**
   * Scrape posts from Instagram home feed.
   * Requires logged-in session.
   */
  async scrapeFeed(limit = 10): Promise<{ posts: InstagramPost[]; scraped_at: string }> {
    await this.cdp.navigate(INSTAGRAM_URLS.home, 4000);

    // Scroll to load more posts
    for (let i = 0; i < Math.ceil(limit / 3); i++) {
      await this.cdp.scrollDown(1000);
    }

    const posts = await this.cdp.evaluateFunction(SCRAPE_FEED_SCRIPT);
    return {
      posts: (posts || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  // =============================================
  // 2. SCRAPE EXPLORE / TRENDING
  // =============================================

  /**
   * Scrape explore page for trending content.
   */
  async scrapeExplore(limit = 20): Promise<{ items: any[]; scraped_at: string }> {
    await this.cdp.navigate(INSTAGRAM_URLS.explore, 4000);

    // Scroll to load more grid items
    for (let i = 0; i < 3; i++) {
      await this.cdp.scrollDown(800);
    }

    const items = await this.cdp.evaluateFunction(SCRAPE_EXPLORE_SCRIPT);
    return {
      items: (items || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Alias for scrapeExplore — matches pattern of other adapters.
   */
  async getTrending(limit = 20): Promise<{ items: any[]; scraped_at: string }> {
    return this.scrapeExplore(limit);
  }

  // =============================================
  // 3. SEARCH CONTENT
  // =============================================

  /**
   * Search Instagram by hashtag or keyword.
   * Instagram search on web navigates to explore/tags for hashtags,
   * or uses the top search bar for general queries.
   */
  async searchContent(query: string, type: 'hashtag' | 'keyword' = 'keyword', limit = 20): Promise<{ results: any[]; scraped_at: string }> {
    if (type === 'hashtag') {
      const tag = query.replace('#', '');
      await this.cdp.navigate(INSTAGRAM_URLS.hashtag(tag), 4000);
    } else {
      // Use the search functionality via navigation
      await this.cdp.navigate(INSTAGRAM_URLS.explore, 3000);

      // TODO: verify selector live — search input on explore page
      const searchInput = 'input[aria-label="Search input"], input[placeholder="Search"], input[type="text"]';
      const found = await this.cdp.waitForSelector(searchInput, 5000);
      if (found) {
        await this.cdp.click(searchInput);
        await this.cdp.wait(500);
        await this.cdp.typeIntoRichEditor(searchInput, query);
        await this.cdp.wait(2000); // Wait for search results dropdown
      }
    }

    // Scroll to load results
    for (let i = 0; i < 3; i++) {
      await this.cdp.scrollDown(800);
    }

    const results = await this.cdp.evaluateFunction(SCRAPE_EXPLORE_SCRIPT);
    return {
      results: (results || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  // =============================================
  // 4. POST CONTENT (PHOTO / REEL)
  // =============================================

  /**
   * Post a photo or reel via instagram.com/create/style/.
   * Steps: Navigate to create → upload file → add caption → share.
   */
  async postContent(input: {
    media_path: string;
    caption: string;
    hashtags?: string[];
  }): Promise<{ success: boolean; post_url?: string; error?: string }> {
    try {
      const fullCaption = input.hashtags
        ? `${input.caption}\n\n${input.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`
        : input.caption;

      await this.cdp.navigate(INSTAGRAM_URLS.create, 5000);

      // Step 1: Upload media file
      // TODO: verify selector live — file input on create page
      const fileInput = 'input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]';
      const found = await this.cdp.waitForSelector(fileInput, 8000);
      if (!found) {
        // Try clicking the "Select from computer" button first
        // TODO: verify selector live
        await this.cdp.evaluate(`
          (() => {
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
              if (btn.textContent?.includes('Select from computer') || btn.textContent?.includes('Select From Computer')) {
                btn.click(); return true;
              }
            }
            return false;
          })()
        `);
        await this.cdp.wait(1000);
      }

      await this.cdp.uploadFile(fileInput, input.media_path);
      await this.cdp.wait(3000); // Wait for media processing

      // Step 2: Click "Next" through crop/filter screens
      // TODO: verify selector live — Next button
      for (let step = 0; step < 2; step++) {
        const nextClicked = await this.cdp.evaluate(`
          (() => {
            const btns = document.querySelectorAll('button, div[role="button"]');
            for (const btn of btns) {
              if (btn.textContent?.trim() === 'Next') {
                btn.click(); return true;
              }
            }
            return false;
          })()
        `);
        if (nextClicked) await this.cdp.wait(1500);
      }

      // Step 3: Write caption
      // TODO: verify selector live — caption textarea on final create screen
      const captionInput = 'textarea[aria-label="Write a caption..."], div[aria-label="Write a caption..."], div[contenteditable="true"][role="textbox"]';
      const captionFound = await this.cdp.waitForSelector(captionInput, 5000);
      if (captionFound) {
        await this.cdp.click(captionInput);
        await this.cdp.wait(300);
        await this.cdp.typeIntoRichEditor(captionInput, fullCaption);
        await this.cdp.wait(500);
      }

      // Step 4: Click "Share"
      // TODO: verify selector live — Share button
      const shared = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button, div[role="button"]');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Share') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!shared) throw new Error('Share button not found');

      await this.cdp.wait(5000); // Wait for upload + processing

      // Try to capture the post URL from redirect
      const currentUrl = await this.cdp.getCurrentUrl();

      return {
        success: true,
        post_url: currentUrl.includes('/p/') || currentUrl.includes('/reel/') ? currentUrl : undefined,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // 5. REPLY TO COMMENTS
  // =============================================

  /**
   * Reply to a comment on a post.
   * Navigate to the post → find the comment → click reply → type → submit.
   */
  async replyToComment(
    postUrl: string,
    commentAuthor: string,
    replyText: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(postUrl, 4000);

      // Scroll to load comments
      await this.cdp.scrollDown(500);
      await this.cdp.wait(1000);

      // Find the comment by author and click "Reply"
      // TODO: verify selector live — reply button within comment item
      const clicked = await this.cdp.evaluate(`
        (() => {
          const items = document.querySelectorAll('ul > div > li, ul > li');
          for (const item of items) {
            const authorLink = item.querySelector('a[href^="/"]');
            const author = authorLink?.getAttribute('href')?.replace(/\\//g, '') || '';
            if (author.toLowerCase() === '${commentAuthor.toLowerCase().replace('@', '').replace(/'/g, "\\'")}') {
              // Click the "Reply" button within this comment
              const replyBtn = item.querySelector('button[class*="reply"], button');
              const btns = item.querySelectorAll('button');
              for (const btn of btns) {
                if (btn.textContent?.trim().toLowerCase() === 'reply') {
                  btn.click(); return true;
                }
              }
            }
          }
          return false;
        })()
      `);

      if (!clicked) throw new Error(`Comment by ${commentAuthor} not found or Reply button missing`);

      await this.cdp.wait(1000);

      // Type the reply in the comment input (which should now be focused/active)
      // TODO: verify selector live — comment input area at bottom of post
      const commentInput = 'textarea[aria-label="Add a comment…"], form textarea, textarea[placeholder="Add a comment…"]';
      const inputFound = await this.cdp.waitForSelector(commentInput, 3000);
      if (!inputFound) throw new Error('Comment input not found');

      await this.cdp.click(commentInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(commentInput, replyText);
      await this.cdp.wait(500);

      // Click "Post" button to submit comment
      // TODO: verify selector live
      const posted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button[type="submit"], div[role="button"]');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Post') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!posted) throw new Error('Post button not found for comment submission');

      await this.cdp.wait(2000);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // 6. DIRECT MESSAGES
  // =============================================

  /**
   * Get list of DM conversations from inbox.
   */
  async getMessages(): Promise<InstagramDM[]> {
    await this.cdp.navigate(INSTAGRAM_URLS.directInbox, 4000);

    const threads = await this.cdp.evaluateFunction(SCRAPE_DM_INBOX_SCRIPT);
    return threads || [];
  }

  /**
   * Send a direct message in a specific thread.
   */
  async sendMessage(threadId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(INSTAGRAM_URLS.directThread(threadId), 4000);

      // TODO: verify selector live — DM message input
      const msgInput = 'textarea[placeholder="Message..."], div[contenteditable="true"][role="textbox"], textarea[aria-label="Message"]';
      const found = await this.cdp.waitForSelector(msgInput, 5000);
      if (!found) throw new Error('Message input not found — is the thread valid?');

      await this.cdp.click(msgInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(msgInput, text);
      await this.cdp.wait(500);

      // Click Send button or press Enter
      // TODO: verify selector live — send button in DM thread
      const sendClicked = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Send') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!sendClicked) {
        // Fallback: press Enter to send
        await this.cdp.pressKey('Enter');
      }

      await this.cdp.wait(1000);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // 7. PROFILE SCRAPE
  // =============================================

  /**
   * Get profile information for a user.
   */
  async getProfile(username?: string): Promise<InstagramProfile | null> {
    const user = username || this.username;
    if (!user) throw new Error('Username required');

    await this.cdp.navigate(INSTAGRAM_URLS.profile(user), 4000);

    const profile = await this.cdp.evaluateFunction(SCRAPE_PROFILE_SCRIPT);
    if (!profile) return null;

    return {
      name: profile.name || '',
      username: profile.username || user,
      bio: profile.bio || '',
      followers: profile.followers || 0,
      following: profile.following || 0,
      posts_count: profile.posts_count || 0,
      is_verified: profile.is_verified || false,
      profile_pic_url: profile.profile_pic_url || '',
      external_url: profile.external_url || '',
      profile_url: profile.profile_url || `https://www.instagram.com/${user}/`,
    };
  }

  // =============================================
  // 8. ENGAGEMENT ACTIONS
  // =============================================

  /**
   * Like a post by URL.
   */
  async likePost(postUrl: string): Promise<boolean> {
    await this.cdp.navigate(postUrl, 3000);

    // TODO: verify selector live — like button (heart icon)
    return this.cdp.evaluate(`
      (() => {
        const article = document.querySelector('article');
        if (!article) return false;
        // Find the like button — usually an SVG heart within a button
        const btns = article.querySelectorAll('button[type="button"]');
        for (const btn of btns) {
          const svg = btn.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"]');
          if (svg && svg.getAttribute('aria-label') === 'Like') {
            btn.click(); return true;
          }
        }
        return false;
      })()
    `);
  }

  /**
   * Comment on a post.
   */
  async commentOnPost(postUrl: string, text: string): Promise<boolean> {
    try {
      await this.cdp.navigate(postUrl, 3000);

      // TODO: verify selector live — comment input area
      const commentInput = 'textarea[aria-label="Add a comment…"], form textarea, textarea[placeholder="Add a comment…"]';
      const found = await this.cdp.waitForSelector(commentInput, 5000);
      if (!found) return false;

      await this.cdp.click(commentInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(commentInput, text);
      await this.cdp.wait(500);

      // Click Post
      const posted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button[type="submit"], div[role="button"]');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Post') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      await this.cdp.wait(2000);
      return !!posted;
    } catch {
      return false;
    }
  }

  /**
   * Follow a user.
   */
  async followUser(username: string): Promise<boolean> {
    await this.cdp.navigate(INSTAGRAM_URLS.profile(username), 3000);

    // TODO: verify selector live — Follow button on profile page
    return this.cdp.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent?.trim() === 'Follow') {
            btn.click(); return true;
          }
        }
        return false;
      })()
    `);
  }

  /**
   * Save/bookmark a post.
   */
  async savePost(postUrl: string): Promise<boolean> {
    await this.cdp.navigate(postUrl, 3000);

    // TODO: verify selector live — save button (bookmark icon)
    return this.cdp.evaluate(`
      (() => {
        const article = document.querySelector('article');
        if (!article) return false;
        const btns = article.querySelectorAll('button[type="button"]');
        for (const btn of btns) {
          const svg = btn.querySelector('svg[aria-label="Save"], svg[aria-label="Remove"]');
          if (svg && svg.getAttribute('aria-label') === 'Save') {
            btn.click(); return true;
          }
        }
        return false;
      })()
    `);
  }

  // =============================================
  // 9. STORY VIEWING
  // =============================================

  /**
   * View stories from a specific user.
   * Returns story metadata after viewing.
   */
  async viewStories(username: string): Promise<{ stories: InstagramStory[]; viewed_count: number }> {
    await this.cdp.navigate(INSTAGRAM_URLS.stories(username), 4000);

    const stories: InstagramStory[] = [];
    let viewedCount = 0;

    // Navigate through stories
    // TODO: verify selector live — story navigation buttons
    for (let i = 0; i < 20; i++) {
      // Check if we're still in a story
      const isStoryActive = await this.cdp.evaluate(`
        window.location.pathname.includes('/stories/')
      `);
      if (!isStoryActive) break;

      // Capture current story info
      const storyInfo = await this.cdp.evaluateFunction(`() => {
        const video = document.querySelector('video source, video');
        const img = document.querySelector('img[decoding="auto"], img[style*="object-fit"]');
        const timeEl = document.querySelector('time');
        return {
          is_video: !!video,
          timestamp: timeEl?.getAttribute('datetime') || '',
          media_url: video?.getAttribute('src') || img?.getAttribute('src') || '',
        };
      }`);

      stories.push({
        username,
        story_url: await this.cdp.getCurrentUrl(),
        is_video: storyInfo?.is_video || false,
        timestamp: storyInfo?.timestamp || '',
      });
      viewedCount++;

      // Click "Next" to advance to next story
      // TODO: verify selector live — right side of screen or next button
      const hasNext = await this.cdp.evaluate(`
        (() => {
          const nextBtn = document.querySelector('button[aria-label="Next"]');
          if (nextBtn) { nextBtn.click(); return true; }
          // Fallback: click right side of screen
          return false;
        })()
      `);

      if (!hasNext) break;
      await this.cdp.wait(1500);
    }

    return { stories, viewed_count: viewedCount };
  }

  // =============================================
  // 10. GET POST COMMENTS
  // =============================================

  /**
   * Scrape comments from a specific post.
   */
  async getPostComments(postUrl: string, limit = 20): Promise<InstagramComment[]> {
    await this.cdp.navigate(postUrl, 4000);

    // Scroll to load more comments
    for (let i = 0; i < Math.ceil(limit / 10); i++) {
      // Click "Load more comments" if available
      await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button, span[role="button"]');
          for (const btn of btns) {
            if (btn.textContent?.includes('View all') || btn.textContent?.includes('Load more')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);
      await this.cdp.wait(1500);
    }

    const comments = await this.cdp.evaluateFunction(SCRAPE_COMMENTS_SCRIPT);
    return (comments || []).slice(0, limit);
  }

  // =============================================
  // 11. SESSION CHECK
  // =============================================

  /**
   * Check if the current browser session is logged into Instagram.
   */
  async checkSession(): Promise<{ loggedIn: boolean; username?: string }> {
    await this.cdp.navigate(INSTAGRAM_URLS.home, 4000);

    // Check for logged-in indicators
    // TODO: verify selector live — profile link in nav, or create button
    const profileData = await this.cdp.evaluate(`
      (() => {
        // Method 1: Check for nav profile link
        const profileLink = document.querySelector('a[href*="/"][role="link"] img[data-testid="user-avatar"], nav a[href^="/"] img[alt*="profile"]');
        if (profileLink) {
          const link = profileLink.closest('a');
          const href = link?.getAttribute('href') || '';
          return href.replace(/\\//g, '') || 'logged_in';
        }

        // Method 2: Check for "Create" or post compose button
        const createBtn = document.querySelector('a[href="/create/style/"], svg[aria-label="New post"]');
        if (createBtn) return 'logged_in';

        // Method 3: Check for login form (means NOT logged in)
        const loginForm = document.querySelector('input[name="username"], button[type="submit"]');
        if (loginForm) return '';

        return '';
      })()
    `);

    if (profileData) {
      return {
        loggedIn: true,
        username: profileData === 'logged_in' ? this.username : profileData,
      };
    }

    return { loggedIn: false };
  }
}

export default InstagramPlatformAdapter;
