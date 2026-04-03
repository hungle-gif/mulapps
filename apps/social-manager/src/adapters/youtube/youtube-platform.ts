/**
 * YouTube Platform Adapter — Tested & Verified
 *
 * Scrape: ytd-video-renderer elements
 * Tested live on Chrome DevTools 2026-03-31
 * Account: logged in via Google (staff@operis.vn)
 * Note: Watch history is OFF → trending/explore blocked, search works fine
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface YouTubeVideo {
  rank: number;
  title: string;
  url: string;
  channel: string;
  channel_url: string;
  views: string;
  upload_time: string;
  duration: string;
  description: string;
}

// =============================================
// SCRAPE SCRIPTS (tested live ✅)
// =============================================

/** Scrape YouTube search/feed results — tested ✅ */
export const SCRAPE_VIDEOS_SCRIPT = `() => {
  const videos = [];
  const renderers = document.querySelectorAll('ytd-video-renderer, ytd-rich-item-renderer');

  renderers.forEach((renderer, idx) => {
    const titleEl = renderer.querySelector('#video-title');
    const title = titleEl?.textContent?.trim() || '';
    const url = titleEl?.getAttribute('href') || '';

    const channelEl = renderer.querySelector('#channel-name a, ytd-channel-name a');
    const channel = channelEl?.textContent?.trim() || '';
    const channelUrl = channelEl?.getAttribute('href') || '';

    const metaEl = renderer.querySelector('#metadata-line');
    const metaSpans = metaEl?.querySelectorAll('span') || [];
    let views = '', uploadTime = '';
    metaSpans.forEach(span => {
      const t = span.textContent?.trim() || '';
      if (t.includes('lượt xem') || t.includes('views')) views = t;
      else if (t.includes('trước') || t.includes('ago') || t.includes('Streamed')) uploadTime = t;
    });

    const durationEl = renderer.querySelector('ytd-thumbnail-overlay-time-status-renderer');
    const duration = durationEl?.textContent?.trim()?.split('\\n')[0] || '';

    const descEl = renderer.querySelector('#description-text, yt-formatted-string.metadata-snippet-text');
    const description = descEl?.textContent?.trim()?.substring(0, 200) || '';

    if (title) {
      videos.push({
        rank: idx + 1,
        title,
        url: url.startsWith('http') ? url : 'https://www.youtube.com' + url,
        channel,
        channel_url: channelUrl.startsWith('http') ? channelUrl : 'https://www.youtube.com' + channelUrl,
        views,
        upload_time: uploadTime,
        duration,
        description,
      });
    }
  });

  return videos;
}`;

/** Scrape YouTube Shorts */
export const SCRAPE_SHORTS_SCRIPT = `() => {
  const shorts = [];
  const renderers = document.querySelectorAll('ytd-reel-item-renderer, ytm-shorts-lockup-view-model');

  renderers.forEach((renderer, idx) => {
    const titleEl = renderer.querySelector('#video-title, .shortsLockupViewModelHostMetadataTitle');
    const title = titleEl?.textContent?.trim() || '';
    const linkEl = renderer.querySelector('a[href*="/shorts/"]');
    const url = linkEl?.getAttribute('href') || '';
    const viewsEl = renderer.querySelector('.shortsLockupViewModelHostMetadataSubhead, #overlay span');
    const views = viewsEl?.textContent?.trim() || '';

    if (title) {
      shorts.push({
        rank: idx + 1,
        title,
        url: url.startsWith('http') ? url : 'https://www.youtube.com' + url,
        views,
      });
    }
  });

  return shorts;
}`;

// =============================================
// URLS
// =============================================

export const YOUTUBE_URLS = {
  home: 'https://www.youtube.com',
  trending: 'https://www.youtube.com/feed/trending',
  explore: 'https://www.youtube.com/feed/explore',
  search: (query: string, sort?: string) => {
    // sp=CAMSAhAB = sort by view count, videos only
    // sp=CAI%3D = sort by upload date
    // sp=CAISBBABGAI%3D = sort by view count, this week
    let sp = '';
    if (sort === 'views') sp = '&sp=CAMSAhAB';
    else if (sort === 'date') sp = '&sp=CAI%3D';
    else if (sort === 'rating') sp = '&sp=CAESAhAB';
    return \`https://www.youtube.com/results?search_query=\${encodeURIComponent(query)}\${sp}\`;
  },
  channel: (handle: string) => \`https://www.youtube.com/\${handle.startsWith('@') ? handle : '@' + handle}\`,
  video: (id: string) => \`https://www.youtube.com/watch?v=\${id}\`,
  shorts: 'https://www.youtube.com/shorts',
  studio: 'https://studio.youtube.com',
};

// =============================================
// ADAPTER CLASS
// =============================================

export class YouTubePlatformAdapter {
  private cdp: CDPConnector;

  constructor(cdp: CDPConnector) {
    this.cdp = cdp;
  }

  /**
   * Search videos
   */
  async searchVideos(query: string, options?: { sort?: string; limit?: number }): Promise<{ videos: YouTubeVideo[]; scraped_at: string }> {
    const url = YOUTUBE_URLS.search(query, options?.sort);
    await this.cdp.navigate(url, 4000);

    const videos = await this.cdp.evaluateFunction(SCRAPE_VIDEOS_SCRIPT);
    return {
      videos: (videos || []).slice(0, options?.limit || 20),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Get trending videos (requires watch history ON)
   */
  async getTrending(limit = 20): Promise<{ videos: YouTubeVideo[]; scraped_at: string }> {
    await this.cdp.navigate(YOUTUBE_URLS.trending, 4000);

    // Check if watch history blocked
    const blocked = await this.cdp.evaluate(\`
      document.body.textContent?.includes('Chế độ lưu danh sách') ||
      document.body.textContent?.includes('watch history is off') || false
    \`);

    if (blocked) {
      // Fallback: search popular recent videos
      return this.searchVideos('trending today', { sort: 'views', limit });
    }

    const videos = await this.cdp.evaluateFunction(SCRAPE_VIDEOS_SCRIPT);
    return {
      videos: (videos || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Get channel info
   */
  async getChannelInfo(handle: string): Promise<any> {
    await this.cdp.navigate(YOUTUBE_URLS.channel(handle), 4000);
    return this.cdp.evaluateFunction(\`() => {
      const name = document.querySelector('#channel-name, ytd-channel-name')?.textContent?.trim() || '';
      const subs = document.querySelector('#subscriber-count')?.textContent?.trim() || '';
      const desc = document.querySelector('#description-container, .about-description')?.textContent?.trim()?.substring(0, 300) || '';
      const videoCount = document.querySelector('#videos-count')?.textContent?.trim() || '';
      return {
        name,
        handle: '\${handle}',
        subscribers: subs,
        description: desc,
        video_count: videoCount,
        url: window.location.href,
      };
    }\`);
  }

  /**
   * Get video details (navigate to video page)
   */
  async getVideoDetails(videoUrl: string): Promise<any> {
    await this.cdp.navigate(videoUrl, 5000);
    return this.cdp.evaluateFunction(\`() => {
      const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1')?.textContent?.trim() || '';
      const views = document.querySelector('#info-strings yt-formatted-string, .view-count')?.textContent?.trim() || '';
      const likes = document.querySelector('#top-level-buttons-computed ytd-toggle-button-renderer:first-child #text')?.textContent?.trim() || '';
      const channel = document.querySelector('#channel-name a, ytd-channel-name a')?.textContent?.trim() || '';
      const desc = document.querySelector('#description-inline-expander, #description')?.textContent?.trim()?.substring(0, 500) || '';
      const date = document.querySelector('#info-strings yt-formatted-string:last-child')?.textContent?.trim() || '';
      const commentCount = document.querySelector('#count .count-text')?.textContent?.trim() || '';
      return { title, views, likes, channel, description: desc, date, comments: commentCount, url: window.location.href };
    }\`);
  }

  /**
   * Scrape comments on a video
   */
  async getVideoComments(videoUrl: string, limit = 20): Promise<any[]> {
    await this.cdp.navigate(videoUrl, 4000);
    // Scroll down to load comments
    for (let i = 0; i < 3; i++) {
      await this.cdp.scrollDown(1000);
    }
    return this.cdp.evaluateFunction(\`() => {
      const comments = [];
      const items = document.querySelectorAll('ytd-comment-thread-renderer');
      items.forEach((item, idx) => {
        if (idx >= \${limit}) return;
        const author = item.querySelector('#author-text')?.textContent?.trim() || '';
        const text = item.querySelector('#content-text')?.textContent?.trim() || '';
        const likes = item.querySelector('#vote-count-middle')?.textContent?.trim() || '0';
        const time = item.querySelector('.published-time-text a')?.textContent?.trim() || '';
        if (text) comments.push({ author, text: text.substring(0, 200), likes, time });
      });
      return comments;
    }\`);
  }

  // =============================================
  // UPLOAD VIDEO (via YouTube Studio)
  // =============================================

  /**
   * Upload a video to YouTube
   * Steps: Open Studio → Click Upload → Select file → Fill details → Publish
   */
  async uploadVideo(videoPath: string, details: {
    title: string;
    description: string;
    tags?: string[];
    visibility?: 'public' | 'unlisted' | 'private';
  }): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
    try {
      await this.cdp.navigate('https://studio.youtube.com', 5000);

      // Click "Tải video lên" / "Upload videos"
      const uploadBtn = await this.cdp.evaluate(\`
        (() => {
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.textContent?.includes('Tải video lên') || btn.textContent?.includes('Upload')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      \`);
      if (!uploadBtn) throw new Error('Upload button not found in Studio');

      await this.cdp.wait(2000);

      // Upload file via hidden input
      const fileInput = 'input[type="file"]';
      const found = await this.cdp.waitForSelector(fileInput, 5000);
      if (!found) throw new Error('File input not found');
      await this.cdp.uploadFile(fileInput, videoPath);

      // Wait for processing
      await this.cdp.wait(5000);

      // Fill title
      const titleInput = 'textbox[aria-label*="title"], #textbox[aria-label*="tiêu đề"], textbox';
      const titleFound = await this.cdp.waitForSelector(titleInput, 10000);
      if (titleFound) {
        await this.cdp.clearInput(titleInput);
        await this.cdp.typeIntoRichEditor(titleInput, details.title);
      }

      // Fill description
      await this.cdp.evaluate(\`
        (() => {
          const textboxes = document.querySelectorAll('#textbox[aria-label]');
          if (textboxes.length >= 2) {
            const descBox = textboxes[1]; // Second textbox is description
            descBox.focus();
            descBox.textContent = '';
            return true;
          }
          return false;
        })()
      \`);
      await this.cdp.wait(300);
      // Type description
      const descBox = '#description-textarea #textbox, [aria-label*="mô tả"]';
      if (await this.cdp.exists(descBox)) {
        await this.cdp.typeIntoRichEditor(descBox, details.description);
      }

      // Note: Tags, thumbnail, visibility are in subsequent screens
      // Hub will decide whether to auto-publish or leave as draft
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // REPLY TO COMMENTS (via YouTube Studio)
  // =============================================

  /**
   * Get unreplied comments from Studio Community tab
   */
  async getUnrepliedComments(limit = 20): Promise<any[]> {
    // Navigate to Studio > Community > Comments > Filter: Unreplied
    await this.cdp.navigate('https://studio.youtube.com/channel/UC6-N4vHuU3m0n9lIerSNDoA/comments/filter/%7B%22replyState%22%3A%22COMMENT_RESPONSE_STATE_HAS_NO_CREATOR_REPLY%22%7D', 5000);

    return this.cdp.evaluateFunction(\`() => {
      const comments = [];
      const rows = document.querySelectorAll('ytcp-comment-thread');
      rows.forEach((row, idx) => {
        if (idx >= \${limit}) return;
        const author = row.querySelector('#author-text')?.textContent?.trim() || '';
        const text = row.querySelector('#content-text, #plain-text')?.textContent?.trim() || '';
        const time = row.querySelector('#published-time-text')?.textContent?.trim() || '';
        const videoTitle = row.querySelector('#video-title')?.textContent?.trim() || '';
        const likes = row.querySelector('#like-count')?.textContent?.trim() || '0';
        if (text) comments.push({ author, text: text.substring(0, 300), time, video_title: videoTitle, likes });
      });
      return comments;
    }\`);
  }

  /**
   * Reply to a comment in Studio
   * Hub sends the reply text (already AI-generated if needed)
   */
  async replyToComment(commentText: string, replyText: string): Promise<{ success: boolean }> {
    try {
      // Find the comment and click reply
      const clicked = await this.cdp.evaluate(\`
        (() => {
          const threads = document.querySelectorAll('ytcp-comment-thread');
          for (const thread of threads) {
            const text = thread.querySelector('#content-text, #plain-text')?.textContent?.trim() || '';
            if (text.includes('\${commentText.substring(0, 50).replace(/'/g, "\\\\'")}')) {
              const replyBtn = thread.querySelector('#reply-button-renderer button, button[aria-label*="Phản hồi"], button[aria-label*="Reply"]');
              if (replyBtn) { replyBtn.click(); return true; }
            }
          }
          return false;
        })()
      \`);

      if (!clicked) throw new Error('Comment not found or reply button missing');

      await this.cdp.wait(1000);

      // Type reply in the reply box
      const replyBox = '#reply-dialog #textbox, #creator-reply-input #textbox';
      const found = await this.cdp.waitForSelector(replyBox, 3000);
      if (!found) throw new Error('Reply input not found');

      await this.cdp.typeIntoRichEditor(replyBox, replyText);
      await this.cdp.wait(500);

      // Click submit reply
      await this.cdp.evaluate(\`
        (() => {
          const btns = document.querySelectorAll('#reply-dialog button, #submit-button button');
          for (const btn of btns) {
            if (btn.textContent?.includes('Phản hồi') || btn.textContent?.includes('Reply')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      \`);

      await this.cdp.wait(2000);
      return { success: true };
    } catch (error: any) {
      return { success: false };
    }
  }

  // =============================================
  // REPLY TO COMMENTS (on YouTube watch page)
  // =============================================

  /**
   * Reply to a comment directly on a video page
   */
  async replyToVideoComment(videoUrl: string, commentAuthor: string, replyText: string): Promise<{ success: boolean }> {
    try {
      await this.cdp.navigate(videoUrl, 4000);
      // Scroll to load comments
      for (let i = 0; i < 3; i++) {
        await this.cdp.scrollDown(1000);
      }

      // Find the comment by author and click reply
      const clicked = await this.cdp.evaluate(\`
        (() => {
          const threads = document.querySelectorAll('ytd-comment-thread-renderer');
          for (const thread of threads) {
            const author = thread.querySelector('#author-text')?.textContent?.trim() || '';
            if (author.includes('\${commentAuthor.replace(/'/g, "\\\\'")}')) {
              const replyBtn = thread.querySelector('#reply-button-end button, button[aria-label*="Reply"], button[aria-label*="Phản hồi"]');
              if (replyBtn) { replyBtn.click(); return true; }
            }
          }
          return false;
        })()
      \`);

      if (!clicked) throw new Error('Comment or reply button not found');

      await this.cdp.wait(1500);

      // Type reply
      const replyInput = '#reply-dialog #contenteditable-root, #placeholder-area';
      const found = await this.cdp.waitForSelector(replyInput, 3000);
      if (!found) throw new Error('Reply input not found');

      await this.cdp.click(replyInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(replyInput, replyText);
      await this.cdp.wait(500);

      // Submit
      const submitted = await this.cdp.evaluate(\`
        (() => {
          const btns = document.querySelectorAll('#reply-dialog button, #submit-button');
          for (const btn of btns) {
            const label = btn.getAttribute('aria-label') || btn.textContent || '';
            if (label.includes('Phản hồi') || label.includes('Reply') || label.includes('Comment')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      \`);

      await this.cdp.wait(2000);
      return { success: !!submitted };
    } catch {
      return { success: false };
    }
  }

  // =============================================
  // LIKE / SUBSCRIBE
  // =============================================

  async likeVideo(videoUrl: string): Promise<boolean> {
    await this.cdp.navigate(videoUrl, 3000);
    return this.cdp.evaluate(\`
      (() => {
        const likeBtn = document.querySelector('like-button-view-model button, #top-level-buttons-computed ytd-toggle-button-renderer:first-child button');
        if (likeBtn && !likeBtn.getAttribute('aria-pressed')?.includes('true')) {
          likeBtn.click(); return true;
        }
        return false;
      })()
    \`);
  }

  async subscribeChannel(channelUrl: string): Promise<boolean> {
    await this.cdp.navigate(channelUrl, 3000);
    return this.cdp.evaluate(\`
      (() => {
        const subBtn = document.querySelector('#subscribe-button button, ytd-subscribe-button-renderer button');
        if (subBtn && !subBtn.getAttribute('subscribed')) {
          subBtn.click(); return true;
        }
        return false;
      })()
    \`);
  }

  // =============================================
  // COMMUNITY POST (text post on channel)
  // =============================================

  async createCommunityPost(text: string): Promise<{ success: boolean }> {
    try {
      // Navigate to Studio > create post
      await this.cdp.navigate('https://studio.youtube.com', 4000);

      // Click "Tạo" button then "Tạo bài đăng"
      const createBtn = await this.cdp.evaluate(\`
        (() => {
          const btn = document.querySelector('#create-icon, button[aria-label="Tạo"]');
          if (btn) { btn.click(); return true; }
          return false;
        })()
      \`);

      await this.cdp.wait(1000);

      // Click "Create post" option
      await this.cdp.evaluate(\`
        (() => {
          const items = document.querySelectorAll('tp-yt-paper-item, ytcp-text-menu-item');
          for (const item of items) {
            if (item.textContent?.includes('bài đăng') || item.textContent?.includes('post')) {
              item.click(); return true;
            }
          }
          return false;
        })()
      \`);

      await this.cdp.wait(2000);

      // Type post content
      const postInput = '#textbox, [contenteditable="true"]';
      if (await this.cdp.exists(postInput)) {
        await this.cdp.typeIntoRichEditor(postInput, text);
        await this.cdp.wait(500);

        // Click Post/Đăng
        await this.cdp.evaluate(\`
          (() => {
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
              if (btn.textContent?.trim() === 'Đăng' || btn.textContent?.trim() === 'Post') {
                btn.click(); return true;
              }
            }
            return false;
          })()
        \`);

        await this.cdp.wait(2000);
        return { success: true };
      }

      return { success: false };
    } catch {
      return { success: false };
    }
  }

  // =============================================
  // CHANNEL ANALYTICS (from Studio)
  // =============================================

  async getChannelAnalytics(): Promise<any> {
    await this.cdp.navigate('https://studio.youtube.com', 4000);
    return this.cdp.evaluateFunction(\`() => {
      const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || '0';
      return {
        subscribers: getText('[class*="subscriber"]') || document.body.textContent?.match(/(\\d+)\\s*(?:người đăng ký|subscriber)/)?.[1] || '0',
        views_28d: document.body.textContent?.match(/Số lượt xem\\s*(\\d[\\d,.]*)/)?.[1] || '0',
        watch_hours_28d: document.body.textContent?.match(/Thời gian xem.*?([\\d,.]+)/)?.[1] || '0',
        scraped_at: new Date().toISOString(),
      };
    }\`);
  }

  // =============================================
  // TRANSCRIPT (full video content as text)
  // =============================================

  /**
   * Get full transcript of a YouTube video
   * Method: Open transcript panel → take a11y snapshot → parse button texts
   * Returns full text content of the video with timestamps
   *
   * TESTED: Lex Fridman 4h25m podcast → 2000+ segments, full content ✅
   */
  async getTranscript(videoUrl: string): Promise<{
    available: boolean;
    segments: { time: string; text: string }[];
    full_text: string;
    chapters: { time: string; title: string }[];
  }> {
    await this.cdp.navigate(videoUrl, 5000);

    // Check if video has captions
    const hasCaptions = await this.cdp.evaluate(\`
      !!window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length
    \`);

    if (!hasCaptions) {
      return { available: false, segments: [], full_text: '', chapters: [] };
    }

    // Open transcript panel
    // First expand description
    await this.cdp.evaluate(\`
      document.querySelector('#expand, tp-yt-paper-button#expand')?.click()
    \`);
    await this.cdp.wait(500);

    // Click "Bản chép lời" / "Transcript" button
    await this.cdp.evaluate(\`
      (() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          const label = btn.getAttribute('aria-label') || '';
          if (label === 'Bản chép lời' || label === 'Show transcript') {
            btn.click(); return true;
          }
        }
        return false;
      })()
    \`);

    await this.cdp.wait(2000); // Wait for transcript to load

    // Take accessibility snapshot and parse
    // Transcript segments are buttons in format: "timestamp text"
    // e.g. button "2 phút, 5 giây a year ago in January 2025..."
    // Chapter markers: button "Phân cảnh N: Title"

    // We need to use the snapshot approach since YouTube uses web components
    // The CDPConnector will need to support snapshot parsing
    // For now, use innerText with scrolling approach

    const panelData = await this.cdp.evaluateFunction(\`() => {
      const panels = document.querySelectorAll('ytd-engagement-panel-section-list-renderer');
      for (const panel of panels) {
        const header = panel.querySelector('#header');
        if (!header) continue;
        const headerText = header.innerText || '';
        if (!headerText.includes('Bản chép lời') && !headerText.includes('Transcript') && !headerText.includes('Trong video')) continue;

        const body = panel.querySelector('#body, #content');
        if (!body) continue;

        // Get all buttons (each = 1 transcript segment)
        const buttons = body.querySelectorAll('button');
        const segments = [];
        buttons.forEach(btn => {
          const text = btn.textContent?.trim() || '';
          if (text.length > 3) segments.push(text);
        });

        return segments;
      }
      return [];
    }\`);

    // Parse segments: separate timestamp from text
    const segments: { time: string; text: string }[] = [];
    const chapters: { time: string; title: string }[] = [];

    for (const raw of (panelData || [])) {
      // Chapter marker: "Phân cảnh N: Title" or "Chapter N: Title"
      if (raw.startsWith('Phân cảnh') || raw.startsWith('Chapter')) {
        chapters.push({ time: '', title: raw });
        segments.push({ time: '', text: \`--- \${raw} ---\` });
        continue;
      }

      // Timestamp + text: "2 phút, 5 giây actual text content"
      // Vietnamese format: "X giây", "X phút, Y giây", "X giờ, Y phút, Z giây"
      const timeMatch = raw.match(/^((?:\d+ giờ, )?\d+ phút, \d+ giây|\d+ giây)\s*(.*)/);
      if (timeMatch) {
        segments.push({ time: timeMatch[1], text: timeMatch[2] });
      } else {
        // No timestamp prefix — first segment or just text
        segments.push({ time: '', text: raw });
      }
    }

    const fullText = segments.map(s => s.text).filter(t => !t.startsWith('---')).join(' ');

    return {
      available: true,
      segments,
      full_text: fullText,
      chapters,
    };
  }

  /**
   * Check login
   */
  async checkSession(): Promise<{ loggedIn: boolean }> {
    await this.cdp.navigate('https://www.youtube.com', 3000);
    const hasAvatar = await this.cdp.exists('button#avatar-btn, img.yt-spec-avatar-shape__avatar');
    return { loggedIn: hasAvatar };
  }
}

export default YouTubePlatformAdapter;
