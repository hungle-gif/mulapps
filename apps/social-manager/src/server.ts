/**
 * Social Manager — Plugin Server v0.2
 *
 * KIẾN TRÚC:
 *   App con = TAY CHÂN (chỉ thao tác browser, trả data thô)
 *   Hub     = BỘ NÃO  (AI, quyết định, lên lịch)
 *
 * Luồng:
 *   Hub gọi POST /execute → app con thao tác browser → trả data thô về Hub
 *   Hub dùng AI phân tích → Hub gọi lại app con để thực hiện action
 *   Hub quản lý scheduler → Hub gọi app con định kỳ
 *
 * Endpoints (Plugin Protocol v1.0):
 *   GET  /health          — Health check
 *   GET  /manifest        — Trả manifest.json
 *   POST /execute         — Chạy capability
 *   GET  /jobs/:id        — Poll async job status
 *   DELETE /jobs/:id/cancel
 *   GET  /settings        — App settings
 *   PUT  /settings        — Update settings
 *   POST /webhooks/events — Nhận events từ Hub
 */

import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import manifest from '../manifest.json';
import { CDPConnector } from './core/cdp-connector';
import { XPlatformAdapter } from './adapters/x-platform';
import { GitHubPlatformAdapter } from './adapters/github/github-platform';
import { HuggingFacePlatformAdapter } from './adapters/huggingface/hf-platform';
import { TikTokPlatformAdapter } from './adapters/tiktok/tiktok-platform';
import { YouTubePlatformAdapter } from './adapters/youtube/youtube-platform';
import { InstagramPlatformAdapter } from './adapters/instagram/instagram-platform';
import { LinkedInPlatformAdapter } from './adapters/linkedin/linkedin-platform';
import { ThreadsPlatformAdapter } from './adapters/threads/threads-platform';
import { TopCVPlatformAdapter } from './adapters/topcv/topcv-platform';
import { GmailPlatformAdapter } from './adapters/gmail/gmail-platform';

// =============================================
// STATE
// =============================================

const jobs = new Map<string, Job>();
const startTime = Date.now();

let currentSettings: AppSettings = {
  hub_url: process.env.HUB_URL || 'http://localhost:3000',
  hub_token: '',
  platforms: {
    'x.com': { enabled: true, username: 'lehung30101995', session_status: 'active' },
  },
};

// =============================================
// BROWSER & ADAPTERS
// =============================================

const cdp = new CDPConnector();
let xAdapter: XPlatformAdapter | null = null;
let ghAdapter: GitHubPlatformAdapter | null = null;
let hfAdapter: HuggingFacePlatformAdapter | null = null;
let ttAdapter: TikTokPlatformAdapter | null = null;
let ytAdapter: YouTubePlatformAdapter | null = null;
let igAdapter: InstagramPlatformAdapter | null = null;
let liAdapter: LinkedInPlatformAdapter | null = null;
let thAdapter: ThreadsPlatformAdapter | null = null;
let tcvAdapter: TopCVPlatformAdapter | null = null;
let gmAdapter: GmailPlatformAdapter | null = null;

async function ensureCDP(): Promise<void> {
  if (!cdp.isConnected()) await cdp.connect();
}

async function getXAdapter(): Promise<XPlatformAdapter> {
  await ensureCDP();
  if (!xAdapter) xAdapter = new XPlatformAdapter(cdp, currentSettings.platforms['x.com']?.username || '');
  return xAdapter;
}

async function getGitHubAdapter(): Promise<GitHubPlatformAdapter> {
  await ensureCDP();
  if (!ghAdapter) ghAdapter = new GitHubPlatformAdapter(cdp);
  return ghAdapter;
}

async function getHuggingFaceAdapter(): Promise<HuggingFacePlatformAdapter> {
  await ensureCDP();
  if (!hfAdapter) hfAdapter = new HuggingFacePlatformAdapter(cdp);
  return hfAdapter;
}

async function getTikTokAdapter(): Promise<TikTokPlatformAdapter> {
  await ensureCDP();
  if (!ttAdapter) ttAdapter = new TikTokPlatformAdapter(cdp);
  return ttAdapter;
}

async function getYouTubeAdapter(): Promise<YouTubePlatformAdapter> {
  await ensureCDP();
  if (!ytAdapter) ytAdapter = new YouTubePlatformAdapter(cdp);
  return ytAdapter;
}

async function getInstagramAdapter(): Promise<InstagramPlatformAdapter> {
  await ensureCDP();
  if (!igAdapter) igAdapter = new InstagramPlatformAdapter(cdp);
  return igAdapter;
}

async function getLinkedInAdapter(): Promise<LinkedInPlatformAdapter> {
  await ensureCDP();
  if (!liAdapter) liAdapter = new LinkedInPlatformAdapter(cdp);
  return liAdapter;
}

async function getThreadsAdapter(): Promise<ThreadsPlatformAdapter> {
  await ensureCDP();
  if (!thAdapter) thAdapter = new ThreadsPlatformAdapter(cdp);
  return thAdapter;
}

async function getTopCVAdapter(): Promise<TopCVPlatformAdapter> {
  await ensureCDP();
  if (!tcvAdapter) tcvAdapter = new TopCVPlatformAdapter(cdp);
  return tcvAdapter;
}

async function getGmailAdapter(): Promise<GmailPlatformAdapter> {
  await ensureCDP();
  if (!gmAdapter) gmAdapter = new GmailPlatformAdapter(cdp);
  return gmAdapter;
}

function getAdapter(platform: string) {
  switch (platform) {
    case 'x.com': return getXAdapter();
    case 'github': return getGitHubAdapter();
    case 'huggingface': return getHuggingFaceAdapter();
    case 'tiktok': return getTikTokAdapter();
    case 'youtube': return getYouTubeAdapter();
    case 'instagram': return getInstagramAdapter();
    case 'linkedin': return getLinkedInAdapter();
    case 'threads': return getThreadsAdapter();
    case 'topcv': return getTopCVAdapter();
    case 'gmail': return getGmailAdapter();
    default: throw new Error(`Platform "${platform}" not yet supported`);
  }
}

// =============================================
// HUB EVENT EMITTER
// =============================================

async function emitToHub(eventType: string, data: any): Promise<void> {
  if (!currentSettings.hub_url || !currentSettings.hub_token) return;

  try {
    const response = await fetch(`${currentSettings.hub_url}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSettings.hub_token}`,
        'X-App-ID': manifest.id,
        'X-Request-ID': randomUUID(),
      },
      body: JSON.stringify({
        event_type: eventType,
        source_app: manifest.id,
        timestamp: new Date().toISOString(),
        data,
      }),
    });
    if (!response.ok) {
      console.error(`[Event] Failed to emit ${eventType}: ${response.status}`);
    }
  } catch (error: any) {
    console.error(`[Event] Failed to emit ${eventType}: ${error.message}`);
  }
}

// =============================================
// SERVER
// =============================================

const app = Fastify({ logger: true });

// Auth middleware
app.addHook('preHandler', async (request, reply) => {
  if (['/health', '/manifest'].includes(request.url)) return;

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' },
    });
  }
  // TODO: Verify token signature with webhook_secret
});

// =============================================
// ENDPOINTS
// =============================================

// GET /health
app.get('/health', async () => ({
  status: cdp.isConnected() ? 'healthy' : 'degraded',
  version: manifest.version,
  uptime: Math.floor((Date.now() - startTime) / 1000),
  checks: {
    browser: cdp.isConnected() ? 'healthy' : 'unhealthy',
    platforms: Object.fromEntries(
      Object.entries(currentSettings.platforms).map(([k, v]) => [k, v.session_status])
    ),
  },
}));

// GET /manifest
app.get('/manifest', async () => manifest);

// POST /execute
app.post<{ Body: ExecuteRequest }>('/execute', async (request, reply) => {
  const { capability_id, input, options } = request.body;
  const requestId = (request.headers['x-request-id'] as string) || randomUUID();

  const capability = manifest.capabilities.find((c: any) => c.id === capability_id);
  if (!capability) {
    return reply.status(400).send({
      success: false,
      error: { code: 'INVALID_CAPABILITY', message: `"${capability_id}" not found` },
    });
  }

  // Async capabilities → return job_id
  if (capability.is_async) {
    const jobId = `job_${randomUUID().substring(0, 8)}`;
    const job: Job = {
      job_id: jobId, capability_id, status: 'queued',
      progress: 0, input, created_at: new Date().toISOString(),
    };
    jobs.set(jobId, job);
    executeAsync(job);

    return reply.status(202).send({
      success: true, request_id: requestId, job_id: jobId,
      status: 'queued', poll_url: `/jobs/${jobId}`, cancel_url: `/jobs/${jobId}/cancel`,
    });
  }

  // Sync → execute and return
  const startMs = Date.now();
  try {
    const result = await executeCapability(capability_id, input);
    return {
      success: true, request_id: requestId, capability_id,
      data: result,
      meta: { duration_ms: Date.now() - startMs, credits_used: 1 },
    };
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

// GET /jobs/:job_id
app.get<{ Params: { job_id: string } }>('/jobs/:job_id', async (request, reply) => {
  const job = jobs.get(request.params.job_id);
  if (!job) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
  return {
    job_id: job.job_id, status: job.status, progress: job.progress,
    started_at: job.started_at, completed_at: job.completed_at,
    ...(job.status === 'completed' ? { result: job.result } : {}),
    ...(job.status === 'failed' ? { error: job.error } : {}),
  };
});

// DELETE /jobs/:job_id/cancel
app.delete<{ Params: { job_id: string } }>('/jobs/:job_id/cancel', async (request, reply) => {
  const job = jobs.get(request.params.job_id);
  if (!job) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
  if (job.status === 'completed' || job.status === 'failed') {
    return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: `Job already ${job.status}` } });
  }
  job.status = 'cancelled';
  job.completed_at = new Date().toISOString();
  return { job_id: job.job_id, status: 'cancelled' };
});

// GET /settings
app.get('/settings', async () => ({ success: true, settings: currentSettings }));

// PUT /settings
app.put<{ Body: Partial<AppSettings> }>('/settings', async (request) => {
  currentSettings = { ...currentSettings, ...request.body };
  return { success: true, settings: currentSettings };
});

// POST /webhooks/events — Hub gửi events xuống
app.post('/webhooks/events', async (request) => {
  const event = request.body as any;
  console.log(`[Webhook] Received: ${event.event_type}`);

  switch (event.event_type) {
    case 'hub:ai-reply-ready':
      // Hub đã dùng AI soạn reply → app con đăng lên MXH
      await executeCapability('reply-comment', {
        platform: event.data.platform,
        comment_url: event.data.comment_url,
        reply_text: event.data.reply_text, // Hub đã soạn bằng AI
      });
      break;

    case 'hub:ai-content-ready':
      // Hub đã dùng AI soạn bài → app con đăng lên MXH
      await executeCapability('post-content', {
        platform: event.data.platform,
        content: event.data.content, // Hub đã soạn bằng AI
      });
      break;

    case 'hub:schedule-scrape':
      // Hub ra lệnh scrape → app con thực hiện → emit kết quả về Hub
      const scrapeResult = await executeCapability(event.data.capability_id, event.data.input);
      await emitToHub(`social:${event.data.capability_id.replace('scrape-', '')}-scraped`, scrapeResult);
      break;
  }

  return { received: true };
});

// =============================================
// CAPABILITY ROUTER
// =============================================

async function executeCapability(capabilityId: string, input: Record<string, any>): Promise<any> {
  const { platform } = input;

  switch (capabilityId) {
    case 'post-content': {
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        if (input.video_path) {
          // Upload video
          const result = await adapter.uploadVideo(input.video_path, {
            title: input.content?.text || input.title || '',
            description: input.content?.description || input.description || '',
            tags: input.content?.hashtags || input.tags,
            visibility: input.visibility,
          });
          await emitToHub(result.success ? 'social:post-published' : 'social:post-failed', { platform, ...result });
          return { ...result, platform, status: result.success ? 'published' : 'failed' };
        } else {
          // Community post
          const result = await adapter.createCommunityPost(input.content?.text || '');
          await emitToHub(result.success ? 'social:post-published' : 'social:post-failed', { platform, ...result });
          return { ...result, platform, status: result.success ? 'published' : 'failed' };
        }
      }
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        const result = await adapter.postContent(input);
        await emitToHub(result.status === 'published' ? 'social:post-published' : 'social:post-failed', result);
        return result;
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        const result = await adapter.postContent({
          media_path: input.content?.media_paths?.[0] || input.media_path || '',
          caption: input.content?.text || input.text || '',
          hashtags: input.content?.hashtags || input.hashtags,
        });
        await emitToHub(result.success ? 'social:post-published' : 'social:post-failed', { platform, ...result });
        return { ...result, platform, status: result.success ? 'published' : 'failed' };
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        const result = await adapter.postContent({
          text: input.content?.text || input.text || '',
          hashtags: input.content?.hashtags || input.hashtags,
          media_path: input.content?.media_paths?.[0] || input.media_path,
          article_url: input.article_url,
        });
        await emitToHub(result.success ? 'social:post-published' : 'social:post-failed', { platform, ...result });
        return { ...result, platform, status: result.success ? 'published' : 'failed' };
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        const result = await adapter.postContent({
          text: input.content?.text || input.text || '',
          media_path: input.content?.media_paths?.[0] || input.media_path,
        });
        await emitToHub(result.success ? 'social:post-published' : 'social:post-failed', { platform, ...result });
        return { ...result, platform, status: result.success ? 'published' : 'failed' };
      }
      if (platform === 'topcv') {
        // TopCV "post content" = post a job listing
        const adapter = await getTopCVAdapter();
        const result = await adapter.postJob(input.job_data || input);
        await emitToHub(result.success ? 'social:post-published' : 'social:post-failed', { platform, ...result });
        return { ...result, platform, status: result.success ? 'published' : 'failed' };
      }
      if (platform === 'tiktok') {
        const adapter = await getTikTokAdapter();
        const result = await adapter.postVideo(
          input.content?.media_paths?.[0] || input.video_path || '',
          input.content?.text || input.text || '',
        );
        await emitToHub(result.success ? 'social:post-published' : 'social:post-failed', { platform, ...result });
        return { ...result, platform, status: result.success ? 'published' : 'failed' };
      }
      // GitHub and HuggingFace don't support post-content via browser automation
      throw new Error(`post-content not supported for "${platform}"`);
    }

    case 'scrape-timeline': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        const result = await adapter.getPostMetrics({ username: input.username, limit: input.limit });
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { ...result, scraped_at: new Date().toISOString() };
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        const result = await adapter.scrapeFeed(input.limit);
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        const result = await adapter.scrapeFeed(input.limit);
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        const result = await adapter.scrapeFeed(input.limit);
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'github') {
        // GitHub doesn't have a "feed" — use trending repos as timeline
        const adapter = await getGitHubAdapter();
        const result = await adapter.getTrending({ limit: input.limit });
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'tiktok') {
        const adapter = await getTikTokAdapter();
        if (input.username) {
          const result = await adapter.getUserVideos(input.username, input.limit);
          await emitToHub('social:metrics-scraped', { platform, ...result });
          return { platform, ...result };
        }
        // No username = trending as timeline
        const result = await adapter.getTrending(input.limit);
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        const result = await adapter.getChannelInfo(input.username || '');
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { platform, ...result, scraped_at: new Date().toISOString() };
      }
      if (platform === 'topcv') {
        // TopCV "timeline" = jobs listing
        const adapter = await getTopCVAdapter();
        const result = await adapter.getJobs();
        await emitToHub('social:metrics-scraped', { platform, ...result });
        return { platform, ...result };
      }
      throw new Error(`scrape-timeline not supported for "${platform}"`);
    }

    case 'scrape-trending': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        const result = await adapter.getTrending(input.limit);
        await emitToHub('social:trending-scraped', result);
        return result;
      }
      if (platform === 'github') {
        const adapter = await getGitHubAdapter();
        const result = await adapter.getTrending({ language: input.language, since: input.since, limit: input.limit });
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'huggingface') {
        const adapter = await getHuggingFaceAdapter();
        const result = await adapter.getTrendingModels({ task: input.task, limit: input.limit });
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'tiktok') {
        const adapter = await getTikTokAdapter();
        const result = await adapter.getTrending(input.limit);
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        const result = await adapter.getTrending(input.limit);
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        const result = await adapter.getTrending(input.limit);
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        const result = await adapter.getTrending(input.limit);
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        const result = await adapter.getTrending(input.limit);
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'topcv') {
        // TopCV "trending" = dashboard stats (CV pipeline, active jobs)
        const adapter = await getTopCVAdapter();
        const result = await adapter.getDashboardStats();
        await emitToHub('social:trending-scraped', { platform, ...result });
        return { platform, ...result };
      }
      throw new Error(`scrape-trending not supported for "${platform}"`);
    }

    case 'scrape-comments': {
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        if (input.post_url) {
          // Comments on specific video
          const comments = await adapter.getVideoComments(input.post_url, input.limit);
          const result = { post_url: input.post_url, comments, scraped_at: new Date().toISOString() };
          await emitToHub('social:new-comments-found', result);
          return result;
        } else {
          // Unreplied comments from Studio
          const comments = await adapter.getUnrepliedComments(input.limit);
          const result = { comments, scraped_at: new Date().toISOString() };
          await emitToHub('social:new-comments-found', result);
          return result;
        }
      }
      if (platform === 'x.com') {
        await cdp.navigate(input.post_url, 3000);
        const comments = await cdp.evaluateFunction(
          (await import('./adapters/x-adapter-tested')).SCRAPE_REPLIES_SCRIPT
        );
        const result = { post_url: input.post_url, comments: comments || [], scraped_at: new Date().toISOString() };
        await emitToHub('social:new-comments-found', result);
        return result;
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        const comments = await adapter.getPostComments(input.post_url, input.limit);
        const result = { platform, post_url: input.post_url, comments, scraped_at: new Date().toISOString() };
        await emitToHub('social:new-comments-found', result);
        return result;
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        const result = await adapter.getPostReplies(input.post_url, input.limit);
        await emitToHub('social:new-comments-found', { platform, post_url: input.post_url, comments: result.replies, scraped_at: result.scraped_at });
        return { platform, post_url: input.post_url, comments: result.replies, scraped_at: result.scraped_at };
      }
      if (platform === 'topcv') {
        // TopCV: scrape job applications as "comments" on a job posting
        const adapter = await getTopCVAdapter();
        const result = await adapter.getJobApplications(input.post_url || input.job_id);
        await emitToHub('social:new-comments-found', { platform, ...result });
        return { platform, ...result, scraped_at: new Date().toISOString() };
      }
      throw new Error(`scrape-comments not supported for "${platform}"`);
    }

    case 'scrape-messages': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        const conversations = await adapter.getMessages();
        const result = { platform, conversations };
        await emitToHub('social:new-messages-found', result);
        return result;
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        const conversations = await adapter.getMessages();
        const result = { platform, conversations };
        await emitToHub('social:new-messages-found', result);
        return result;
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        const conversations = await adapter.getMessages();
        const result = { platform, conversations };
        await emitToHub('social:new-messages-found', result);
        return result;
      }
      if (platform === 'gmail') {
        const adapter = await getGmailAdapter();
        const result = await adapter.getInbox(input.limit);
        await emitToHub('social:new-messages-found', { platform, ...result });
        return { platform, ...result };
      }
      if (platform === 'topcv') {
        const adapter = await getTopCVAdapter();
        const result = await adapter.getNotifications();
        await emitToHub('social:new-messages-found', { platform, ...result });
        return { platform, ...result };
      }
      throw new Error(`scrape-messages not supported for "${platform}"`);
    }

    case 'reply-comment': {
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        if (input.video_url && input.comment_author) {
          // Reply on video page
          return adapter.replyToVideoComment(input.video_url, input.comment_author, input.reply_text);
        } else {
          // Reply via Studio
          return adapter.replyToComment(input.comment_text || '', input.reply_text);
        }
      }
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        return adapter.replyToComment(input.comment_url, input.reply_text);
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        return adapter.replyToComment(input.comment_url || input.post_url, input.comment_author || '', input.reply_text);
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        return adapter.replyToComment(input.comment_url || input.post_url, input.comment_author || '', input.reply_text);
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        return adapter.replyToPost(input.comment_url || input.post_url, input.reply_text);
      }
      if (platform === 'gmail') {
        // Gmail: "reply-comment" = reply to an email
        const adapter = await getGmailAdapter();
        // First open the email if index provided
        if (input.email_index !== undefined) {
          await adapter.readEmail(input.email_index);
        }
        return adapter.replyEmail(input.reply_text);
      }
      if (platform === 'topcv') {
        // TopCV: update CV status (shortlist, reject, etc.)
        const adapter = await getTopCVAdapter();
        return adapter.updateCVStatus(input.cv_id, input.status || 'shortlisted', input.note || input.reply_text);
      }
      throw new Error(`reply-comment not supported for "${platform}"`);
    }

    case 'send-message': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        return adapter.replyMessage(input.conversation_id, input.text);
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        return adapter.sendMessage(input.conversation_id, input.text);
      }
      if (platform === 'linkedin') {
        if (input.profile_url) {
          // New message to a profile
          const adapter = await getLinkedInAdapter();
          return adapter.sendNewMessage(input.profile_url, input.text);
        }
        const adapter = await getLinkedInAdapter();
        return adapter.sendMessage(input.conversation_id, input.text);
      }
      if (platform === 'gmail') {
        const adapter = await getGmailAdapter();
        return adapter.sendEmail({
          to: input.to || input.conversation_id,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject || '',
          body: input.text || input.body || '',
          attachments: input.attachments,
        });
      }
      throw new Error(`send-message not supported for "${platform}"`);
    }

    case 'update-profile': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        return adapter.updateProfile(input);
      }
      // Other adapters don't expose updateProfile via CDP reliably
      throw new Error(`update-profile not supported for "${platform}"`);
    }

    case 'scrape-profile': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        return adapter.getProfileAnalytics(input.username);
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        return adapter.getProfile(input.username);
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        return adapter.getProfile(input.username);
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        return adapter.getProfile(input.username);
      }
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        return adapter.getChannelInfo(input.username || '');
      }
      if (platform === 'github') {
        // GitHub adapter doesn't have profile scraping — use repo details as proxy
        const adapter = await getGitHubAdapter();
        if (input.username) {
          return adapter.getRepoDetails(input.username);
        }
        throw new Error('GitHub scrape-profile requires a username (repo path)');
      }
      if (platform === 'tiktok') {
        const adapter = await getTikTokAdapter();
        return adapter.getProfile(input.username);
      }
      if (platform === 'topcv') {
        // TopCV: get recruitment report as "profile analytics"
        const adapter = await getTopCVAdapter();
        return adapter.getRecruitmentReport();
      }
      throw new Error(`scrape-profile not supported for "${platform}"`);
    }

    case 'search-content': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        return adapter.searchContent(input.query, input.type, input.limit);
      }
      if (platform === 'github') {
        const adapter = await getGitHubAdapter();
        return adapter.searchRepos(input.query, input.limit);
      }
      if (platform === 'huggingface') {
        const adapter = await getHuggingFaceAdapter();
        return adapter.searchModels(input.query, input.limit);
      }
      if (platform === 'tiktok') {
        const adapter = await getTikTokAdapter();
        return adapter.searchVideos(input.query, input.limit);
      }
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        return adapter.searchVideos(input.query, { sort: input.sort, limit: input.limit });
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        return adapter.searchContent(input.query, input.type === 'hashtag' ? 'hashtag' : 'keyword', input.limit);
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        return adapter.searchContent(input.query, input.type || 'posts', input.limit);
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        return adapter.searchContent(input.query, input.type === 'people' ? 'users' : 'posts', input.limit);
      }
      if (platform === 'topcv') {
        // TopCV: search CVs
        const adapter = await getTopCVAdapter();
        return adapter.searchCV(input.query, input.filters);
      }
      if (platform === 'gmail') {
        const adapter = await getGmailAdapter();
        return adapter.searchEmails(input.query, input.limit);
      }
      throw new Error(`search-content not supported for "${platform}"`);
    }

    case 'do-engagement': {
      let success = false;
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        switch (input.action) {
          case 'like': success = await adapter.likeTweet(input.target_url); break;
          case 'repost': success = await adapter.repostTweet(input.target_url); break;
          case 'bookmark': success = await adapter.bookmarkTweet(input.target_url); break;
          case 'follow': {
            const username = input.target_url.split('/').pop();
            success = await adapter.followUser(username);
            break;
          }
        }
        return { success, action: input.action, target_url: input.target_url };
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        switch (input.action) {
          case 'like': success = await adapter.likePost(input.target_url); break;
          case 'bookmark': success = await adapter.savePost(input.target_url); break;
          case 'follow': {
            const username = input.target_url.split('/').filter(Boolean).pop() || '';
            success = await adapter.followUser(username);
            break;
          }
        }
        return { success, action: input.action, target_url: input.target_url };
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        switch (input.action) {
          case 'like': success = await adapter.likePost(input.target_url); break;
          case 'follow': success = await adapter.followUser(input.target_url); break;
        }
        return { success, action: input.action, target_url: input.target_url };
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        switch (input.action) {
          case 'like': success = await adapter.likePost(input.target_url); break;
          case 'repost': success = await adapter.repost(input.target_url); break;
          case 'follow': {
            const username = input.target_url.split('@').pop()?.split('/')[0] || '';
            success = await adapter.followUser(username);
            break;
          }
        }
        return { success, action: input.action, target_url: input.target_url };
      }
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        switch (input.action) {
          case 'like': success = await adapter.likeVideo(input.target_url); break;
          case 'follow': success = await adapter.subscribeChannel(input.target_url); break;
        }
        return { success, action: input.action, target_url: input.target_url };
      }
      // GitHub and HuggingFace don't have engagement actions via CDP adapter
      throw new Error(`do-engagement not supported for "${platform}"`);
    }

    case 'check-session': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        const result = await adapter.checkSession();
        if (!result.loggedIn) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.loggedIn, username: result.username, session_status: result.loggedIn ? 'active' : 'expired' };
      }
      if (platform === 'instagram') {
        const adapter = await getInstagramAdapter();
        const result = await adapter.checkSession();
        if (!result.loggedIn) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.loggedIn, username: result.username, session_status: result.loggedIn ? 'active' : 'expired' };
      }
      if (platform === 'linkedin') {
        const adapter = await getLinkedInAdapter();
        const result = await adapter.checkSession();
        if (!result.loggedIn) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.loggedIn, username: result.username, session_status: result.loggedIn ? 'active' : 'expired' };
      }
      if (platform === 'threads') {
        const adapter = await getThreadsAdapter();
        const result = await adapter.checkSession();
        if (!result.loggedIn) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.loggedIn, username: result.username, session_status: result.loggedIn ? 'active' : 'expired' };
      }
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        const result = await adapter.checkSession();
        if (!result.loggedIn) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.loggedIn, session_status: result.loggedIn ? 'active' : 'expired' };
      }
      if (platform === 'tiktok') {
        const adapter = await getTikTokAdapter();
        const result = await adapter.checkSession();
        if (!result.loggedIn) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.loggedIn, username: result.username, session_status: result.loggedIn ? 'active' : 'expired' };
      }
      if (platform === 'topcv') {
        const adapter = await getTopCVAdapter();
        const result = await adapter.checkSession();
        if (!result.logged_in) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.logged_in, username: result.employer_name, session_status: result.logged_in ? 'active' : 'expired' };
      }
      if (platform === 'gmail') {
        const adapter = await getGmailAdapter();
        const result = await adapter.checkSession();
        if (!result.loggedIn) await emitToHub('social:session-expired', { platform });
        return { logged_in: result.loggedIn, username: result.email, session_status: result.loggedIn ? 'active' : 'expired' };
      }
      throw new Error(`check-session not supported for "${platform}"`);
    }

    // =========================================
    // YouTube-specific capabilities
    // =========================================

    case 'get-transcript': {
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        return adapter.getTranscript(input.video_url || input.target_url);
      }
      throw new Error(`get-transcript only supported for "youtube"`);
    }

    case 'get-video-details': {
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        return adapter.getVideoDetails(input.video_url || input.target_url);
      }
      throw new Error(`get-video-details only supported for "youtube"`);
    }

    case 'get-channel-analytics': {
      if (platform === 'youtube') {
        const adapter = await getYouTubeAdapter();
        return adapter.getChannelAnalytics();
      }
      throw new Error(`get-channel-analytics only supported for "youtube"`);
    }

    // =========================================
    // TopCV-specific capabilities
    // =========================================

    case 'get-recommended-cvs': {
      if (platform === 'topcv') {
        const adapter = await getTopCVAdapter();
        return adapter.getRecommendedCVs(input.limit);
      }
      throw new Error(`get-recommended-cvs only supported for "topcv"`);
    }

    case 'get-cv-details': {
      if (platform === 'topcv') {
        const adapter = await getTopCVAdapter();
        return adapter.getCVDetails(input.cv_id);
      }
      throw new Error(`get-cv-details only supported for "topcv"`);
    }

    case 'get-recruitment-report': {
      if (platform === 'topcv') {
        const adapter = await getTopCVAdapter();
        return adapter.getRecruitmentReport();
      }
      throw new Error(`get-recruitment-report only supported for "topcv"`);
    }

    // =========================================
    // Gmail-specific capabilities
    // =========================================

    case 'read-email': {
      if (platform === 'gmail') {
        const adapter = await getGmailAdapter();
        return adapter.readEmail(input.index || 0);
      }
      throw new Error(`read-email only supported for "gmail"`);
    }

    case 'health-check-selectors': {
      if (platform === 'x.com') {
        const adapter = await getXAdapter();
        const result = await adapter.healthCheckSelectors(input.auto_heal);
        if (result.broken > 0) {
          await emitToHub('social:selector-broken', { platform, broken: result.broken, details: result.details });
        }
        if (result.healed > 0) {
          await emitToHub('social:selector-healed', { platform, healed: result.healed });
        }
        return result;
      }
      // Other platforms don't have healthCheckSelectors yet — return basic status
      throw new Error(`health-check-selectors not yet implemented for "${platform}"`);
    }

    default:
      throw new Error(`Unknown capability: ${capabilityId}`);
  }
}

async function executeAsync(job: Job): Promise<void> {
  job.status = 'running';
  job.started_at = new Date().toISOString();
  try {
    job.result = await executeCapability(job.capability_id, job.input);
    job.status = 'completed';
    job.progress = 100;
  } catch (error: any) {
    job.status = 'failed';
    job.error = error.message;
  }
  job.completed_at = new Date().toISOString();
}

// =============================================
// TYPES
// =============================================

interface ExecuteRequest {
  capability_id: string;
  input: Record<string, any>;
  options?: { timeout?: number; priority?: string; callback_url?: string };
}

interface Job {
  job_id: string;
  capability_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number | null;
  input: Record<string, any>;
  result?: any;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface AppSettings {
  hub_url: string;
  hub_token: string;
  platforms: {
    [key: string]: { enabled: boolean; username: string; session_status: string };
  };
}

// =============================================
// START
// =============================================

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) { app.log.error(err); process.exit(1); }
  console.log(`\n🚀 Social Manager v${manifest.version} running at ${address}`);
  console.log(`   GET  ${address}/health`);
  console.log(`   GET  ${address}/manifest`);
  console.log(`   POST ${address}/execute`);
  console.log(`\n📡 Capabilities: ${manifest.capabilities.length}`);
  console.log(`   ${manifest.capabilities.map((c: any) => c.id).join(', ')}`);
  console.log(`\n🔗 Hub: ${currentSettings.hub_url || 'not configured'}\n`);
});

export default app;
