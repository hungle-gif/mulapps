import { getZaloClient } from "./client.js";
import { prisma } from "../db.js";
import { broadcast } from "../ws.js";

interface DiscoveredGroup {
  link: string;
  name?: string;
  description?: string;
  totalMembers?: number;
  avatar?: string;
  source: string; // google, website, cache
  valid: boolean;
  error?: string;
}

interface DiscoverResult {
  keyword: string;
  links_found: number;
  groups_validated: number;
  groups_valid: number;
  groups: DiscoveredGroup[];
}

// ============================================
// NGUỒN 1: Google Search — tìm "zalo.me/g/" + keyword
// ============================================
async function searchGoogle(keyword: string, maxResults = 20): Promise<string[]> {
  const links: string[] = [];
  const regex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;

  // Thử nhiều search engines để tránh bị chặn
  const queries = [
    // Google
    `https://www.google.com/search?q=${encodeURIComponent(`"zalo.me/g/" ${keyword}`)}&num=30&hl=vi`,
    `https://www.google.com/search?q=${encodeURIComponent(`nhóm zalo ${keyword} link tham gia`)}&num=30&hl=vi`,
    // Bing
    `https://www.bing.com/search?q=${encodeURIComponent(`"zalo.me/g/" ${keyword}`)}&count=30`,
    // DuckDuckGo (HTML version)
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"zalo.me/g/" ${keyword}`)}`,
  ];

  for (const url of queries) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      const html = await response.text();

      // Extract zalo.me/g/ links
      let match;
      while ((match = regex.exec(html)) !== null) {
        const fullLink = `https://zalo.me/g/${match[1]}`;
        if (!links.includes(fullLink)) {
          links.push(fullLink);
        }
      }

      // Also extract page URLs from results → crawl those pages for zalo links
      const pageUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
      const pageUrls: string[] = [];
      let pageMatch;
      while ((pageMatch = pageUrlRegex.exec(html)) !== null) {
        const pageUrl = pageMatch[0];
        if (
          pageUrl.includes(keyword.split(" ")[0].toLowerCase()) &&
          !pageUrl.includes("google.") &&
          !pageUrl.includes("bing.") &&
          !pageUrl.includes("duckduckgo.") &&
          pageUrls.length < 5
        ) {
          pageUrls.push(pageUrl);
        }
      }

      // Deep crawl: fetch top result pages for zalo links
      for (const pageUrl of pageUrls.slice(0, 3)) {
        try {
          const pageRes = await fetch(pageUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(8000),
          });
          const pageHtml = await pageRes.text();
          let m;
          regex.lastIndex = 0;
          while ((m = regex.exec(pageHtml)) !== null) {
            const fullLink = `https://zalo.me/g/${m[1]}`;
            if (!links.includes(fullLink)) links.push(fullLink);
          }
          console.log(`[Discover/Google/Deep] ${pageUrl} → +${links.length} total links`);
        } catch {}
      }

      console.log(`[Discover/Search] ${new URL(url).hostname} → ${links.length} links`);
    } catch (error) {
      console.error(`[Discover/Search] Failed:`, (error as Error).message);
    }
  }

  return links;
}

// ============================================
// NGUỒN 1B: Facebook Search — tìm link zalo.me/g/ trên Facebook
// ============================================
async function searchFacebook(keyword: string): Promise<string[]> {
  const links: string[] = [];
  const regex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;

  const strategies = [
    // Strategy 1: Google tìm trên Facebook
    `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com "zalo.me/g/" ${keyword}`)}&num=30&hl=vi`,
    // Strategy 2: Google tìm thêm biến thể
    `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com "nhóm zalo" "${keyword}" link tham gia`)}&num=20&hl=vi`,
    // Strategy 3: Bing tìm trên Facebook
    `https://www.bing.com/search?q=${encodeURIComponent(`site:facebook.com "zalo.me/g/" ${keyword}`)}&count=30`,
    // Strategy 4: DuckDuckGo tìm trên Facebook
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:facebook.com "zalo.me/g/" ${keyword}`)}`,
    // Strategy 5: mbasic.facebook.com search (public, no login needed for some results)
    `https://mbasic.facebook.com/search/posts/?q=${encodeURIComponent(`zalo.me/g/ ${keyword}`)}&source=filter&isTrending=0`,
    // Strategy 6: Facebook public search
    `https://www.facebook.com/public/${encodeURIComponent(`nhóm zalo ${keyword}`)}`,
  ];

  for (const url of strategies) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });

      const html = await response.text();

      // Extract zalo.me/g/ links directly from page
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(html)) !== null) {
        const fullLink = `https://zalo.me/g/${match[1]}`;
        if (!links.includes(fullLink)) {
          links.push(fullLink);
        }
      }

      // For Google/Bing results: also extract Facebook page URLs and deep crawl them
      if (url.includes("google.com") || url.includes("bing.com")) {
        const fbUrlRegex = /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>&]+/gi;
        const fbUrls: string[] = [];
        let fbMatch;
        while ((fbMatch = fbUrlRegex.exec(html)) !== null) {
          const fbUrl = fbMatch[0].replace(/&amp;/g, "&");
          if (
            (fbUrl.includes("/groups/") || fbUrl.includes("/posts/") || fbUrl.includes("/permalink/")) &&
            fbUrls.length < 5
          ) {
            fbUrls.push(fbUrl);
          }
        }

        // Deep crawl Facebook pages found in search results
        for (const fbUrl of fbUrls.slice(0, 3)) {
          try {
            // Convert to mbasic for easier parsing
            const mbasicUrl = fbUrl.replace("www.facebook.com", "mbasic.facebook.com");
            const fbRes = await fetch(mbasicUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
              },
              signal: AbortSignal.timeout(8000),
              redirect: "follow",
            });
            const fbHtml = await fbRes.text();
            regex.lastIndex = 0;
            let m;
            while ((m = regex.exec(fbHtml)) !== null) {
              const fullLink = `https://zalo.me/g/${m[1]}`;
              if (!links.includes(fullLink)) links.push(fullLink);
            }
          } catch {}
        }
      }

      const host = new URL(url).hostname;
      if (links.length > 0) {
        console.log(`[Discover/Facebook] ${host} → ${links.length} links`);
      }
    } catch (error) {
      // Silent fail — many strategies won't work, that's expected
    }
  }

  console.log(`[Discover/Facebook] Total: ${links.length} links from Facebook`);
  return links;
}

// ============================================
// NGUỒN 2: Crawl websites tổng hợp link nhóm Zalo
// ============================================
const AGGREGATOR_URLS = [
  // === Tổng hợp lớn (500-10000+ links) ===
  "https://atpholdings.vn/link-nhom-zalo-ban-hang/",
  "https://atpsoftware.vn/link-nhom-zalo-ban-hang.html",
  "https://vinazalo.com/tang-10-000-danh-sach-nhom-zalo-tat-ca-linh-vuc/",
  "https://keomemzalo.com/1000-danh-sach-link-nhom-zalo-theo-linh-vuc-nganh-nghe-moi-nhat/",
  "https://phanmemmkt.vn/tong-hop-600-group-zalo",
  "https://phanmemmkt.vn/link-nhom-zalo-ban-hang-online",
  "https://lamhoang.edu.vn/nhom-zalo/",
  "https://kinhdoanhdukich.com/500nhomzalo/",

  // === Phân theo ngành (100-500 links) ===
  "https://phanmemzalo.vn/link-nhom-zalo-ban-hang/",
  "https://ship4p.com/nhom-zalo-ban-hang/",
  "https://www.phanmemninja.com/nhom-ban-hang-online-zalo",
  "https://www.phanmemninja.com/group-zalo-ban-hang-chat-luong-theo-tung-chu-de",
  "https://www.phanmemninja.com/link-nhom-zalo-kin-mien-phi",

  // === Tuyển dụng / Việc làm ===
  "https://www.phanmemninja.com/nhom-tuyen-dung-tren-zalo",
  "https://vinazalo.vn/danh-sach-100-nhom-zalo-viec-lam-tang-co-hoi-tim-kiem-cong-viec/",
  "https://vinazalo.com/danh-sach-50-link-nhom-zalo-tim-viec-tren-toan-quoc/",
  "https://wismizer.com/danh-sach-300-group-viec-lam/",

  // === Theo khu vực ===
  "https://vinazalo.vn/tong-hop-100-nhom-zalo-da-nang-dong-thanh-vien-nhat/",

  // === Nhóm kín / Đặc biệt ===
  "https://freetuts.net/thu-thuat/link-nhom-kin-zalo-1292t.html",
  "https://duockhong.com/link-zalo/",
  "https://gamehow.net/link-nhom-kin-zalo-362.html",
  "https://nhomkinzalo.com/",

  // === Forum / Cộng đồng ===
  "https://www.techrum.vn/threads/chia-se-kho-link-nhom-zalo-ban-hang-online-uy-tin-chat-luong-hieu-qua-nhat-hien-nay.517152/",
  "https://cnv.vn/cach-tim-nhom-kin-tren-zalo/",
  "https://shopthanhtung.com/tong-hop-link-nhom-kin-zalo",
];

async function crawlAggregators(keyword?: string): Promise<string[]> {
  const links: string[] = [];
  const regex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;

  for (const url of AGGREGATOR_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });

      const html = await response.text();
      let match;
      while ((match = regex.exec(html)) !== null) {
        const fullLink = `https://zalo.me/g/${match[1]}`;
        if (!links.includes(fullLink)) {
          links.push(fullLink);
        }
      }

      console.log(`[Discover/Crawl] ${url} → ${links.length} links`);
    } catch (error) {
      console.error(`[Discover/Crawl] ${url} failed:`, (error as Error).message);
    }
  }

  return links;
}

// ============================================
// NGUỒN 3: Cache — link đã tìm thấy trước đó
// ============================================
async function searchCache(keyword: string): Promise<string[]> {
  const groups = await prisma.group.findMany({
    where: {
      deleted_at: null,
      OR: [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ],
    },
    select: { link: true },
  });

  return groups.map((g) => g.link).filter(Boolean);
}

// ============================================
// VALIDATE: Kiểm tra link có hợp lệ + lấy thông tin nhóm
// ============================================
async function validateGroupLink(
  link: string,
  accountId?: string
): Promise<DiscoveredGroup> {
  try {
    const api = await getZaloClient(accountId);
    const result = await api.getGroupLinkInfo({ link, memberPage: 1 });

    return {
      link,
      name: result.name || undefined,
      description: result.desc || undefined,
      totalMembers: result.totalMember || 0,
      avatar: result.avt || undefined,
      source: "validated",
      valid: true,
    };
  } catch (error) {
    return {
      link,
      source: "validated",
      valid: false,
      error: (error as Error).message,
    };
  }
}

// ============================================
// MAIN: Discover groups by keyword
// ============================================
export async function discoverGroups(
  keyword: string,
  options: {
    accountId?: string;
    sources?: ("google" | "facebook" | "websites" | "cache")[];
    maxResults?: number;
    validateLinks?: boolean;
  } = {}
): Promise<DiscoverResult> {
  const {
    accountId,
    sources = ["google", "facebook", "websites", "cache"],
    maxResults = 30,
    validateLinks = true,
  } = options;

  console.log(`[Discover] Searching for "${keyword}" from sources: ${sources.join(", ")}`);

  // Collect links from all sources
  const allLinks = new Map<string, string>(); // link → source

  // Source 1: Cache (instant)
  if (sources.includes("cache")) {
    const cacheLinks = await searchCache(keyword);
    for (const link of cacheLinks) {
      allLinks.set(link, "cache");
    }
    console.log(`[Discover] Cache: ${cacheLinks.length} links`);

    broadcast({
      type: "discover:progress",
      payload: { keyword, source: "cache", links_found: cacheLinks.length },
      timestamp: new Date().toISOString(),
    });
  }

  // Source 2: Facebook
  if (sources.includes("facebook")) {
    const fbLinks = await searchFacebook(keyword);
    for (const link of fbLinks) {
      if (!allLinks.has(link)) allLinks.set(link, "facebook");
    }
    console.log(`[Discover] Facebook: ${fbLinks.length} links`);

    broadcast({
      type: "discover:progress",
      payload: { keyword, source: "facebook", links_found: fbLinks.length },
      timestamp: new Date().toISOString(),
    });
  }

  // Source 3: Google/Bing/DuckDuckGo
  if (sources.includes("google")) {
    const googleLinks = await searchGoogle(keyword, maxResults);
    for (const link of googleLinks) {
      if (!allLinks.has(link)) allLinks.set(link, "google");
    }
    console.log(`[Discover] Google: ${googleLinks.length} links`);

    broadcast({
      type: "discover:progress",
      payload: { keyword, source: "google", links_found: googleLinks.length },
      timestamp: new Date().toISOString(),
    });
  }

  // Source 3: Aggregator websites
  if (sources.includes("websites")) {
    const webLinks = await crawlAggregators(keyword);
    for (const link of webLinks) {
      if (!allLinks.has(link)) allLinks.set(link, "website");
    }
    console.log(`[Discover] Websites: ${webLinks.length} links`);

    broadcast({
      type: "discover:progress",
      payload: { keyword, source: "websites", links_found: webLinks.length },
      timestamp: new Date().toISOString(),
    });
  }

  console.log(`[Discover] Total unique links: ${allLinks.size}`);

  // Build keyword matching strategy:
  // "chung cu bac ninh" → phrases: ["chung cu bac ninh", "chung cu", "bac ninh"] + words: ["chung", "bac", "ninh"]
  const keywordLower = keyword.toLowerCase();
  const keywordWords = keywordLower
    .split(/[\s,]+/)
    .filter((w) => w.length >= 2);

  // Build compound phrases (2-word, 3-word combinations in order)
  const keywordPhrases: string[] = [keywordLower]; // Full phrase = highest priority
  for (let size = 2; size < keywordWords.length; size++) {
    for (let start = 0; start <= keywordWords.length - size; start++) {
      keywordPhrases.push(keywordWords.slice(start, start + size).join(" "));
    }
  }

  console.log(`[Discover] Match phrases: [${keywordPhrases.join(" | ")}]`);
  console.log(`[Discover] Match words: [${keywordWords.join(", ")}]`);

  // Prioritize: google links first (more relevant), then website links
  const sortedLinks = [...allLinks.entries()].sort((a, b) => {
    const priority: Record<string, number> = { cache: 0, google: 1, website: 2 };
    return (priority[a[1]] || 3) - (priority[b[1]] || 3);
  });

  // Validate links via Zalo API + filter by keyword relevance
  const groups: DiscoveredGroup[] = [];
  const matchedGroups: DiscoveredGroup[] = [];
  let validCount = 0;
  let checkedCount = 0;
  const maxChecks = Math.min(allLinks.size, maxResults * 5); // Check more, return filtered

  if (validateLinks && allLinks.size > 0) {
    for (let i = 0; i < sortedLinks.length && i < maxChecks; i++) {
      const [link, source] = sortedLinks[i];

      // Stop early if we found enough matching groups
      if (matchedGroups.length >= maxResults) break;

      // Rate limit: delay between API calls
      if (checkedCount > 0) await sleep(400 + Math.random() * 600);
      checkedCount++;

      const result = await validateGroupLink(link, accountId);
      result.source = source;

      if (result.valid) {
        validCount++;

        // Check relevance using phrases + words
        const nameL = (result.name || "").toLowerCase();
        const descL = (result.description || "").toLowerCase();

        let matchScore = 0;

        // Phrase matching (highest value — "bac ninh" as unit, not "bac" + "ninh" separately)
        for (let p = 0; p < keywordPhrases.length; p++) {
          const phrase = keywordPhrases[p];
          const phraseWeight = keywordPhrases.length - p; // Full phrase = highest weight
          if (nameL.includes(phrase)) matchScore += phraseWeight * 3;
          else if (descL.includes(phrase)) matchScore += phraseWeight * 2;
        }

        // Single word matching (lower value — only if no phrase matched)
        if (matchScore === 0) {
          matchScore = keywordWords.reduce((score, word) => {
            if (nameL.includes(word)) return score + 2;
            if (descL.includes(word)) return score + 1;
            return score;
          }, 0);
          // Require at least 2 word matches to avoid false positives like "ninh hiệp"
          if (matchScore < 4 && keywordWords.length >= 2) {
            matchScore = 0; // Too weak — single word matches not enough for multi-word keyword
          }
        }

        (result as any).matchScore = matchScore;

        if (matchScore > 0) {
          result.source = source + ` (match: ${matchScore})`;
          matchedGroups.push(result);
          console.log(
            `[Discover] ✅ MATCH: "${result.name}" (score: ${matchScore}, ${result.totalMembers} members)`
          );
        } else {
          // Not matching but still valid — add to general pool
          result.source = source + " (no keyword match)";
        }

        // Cache valid group in DB
        try {
          await prisma.group.upsert({
            where: { zalo_group_id: link }, // Temp: use link as unique key
            update: {
              name: result.name || "Unknown",
              description: result.description || null,
              total_members: result.totalMembers || 0,
              avatar: result.avatar || null,
              status: "discovered",
              last_scanned_at: new Date(),
            },
            create: {
              zalo_group_id: `discovered_${Date.now()}_${i}`,
              name: result.name || "Unknown",
              description: result.description || null,
              link,
              total_members: result.totalMembers || 0,
              avatar: result.avatar || null,
              status: "discovered",
              last_scanned_at: new Date(),
            },
          });
        } catch {
          // Ignore duplicate errors
        }
      }

      groups.push(result);

      broadcast({
        type: "discover:validated",
        payload: {
          keyword,
          checked: checkedCount,
          matched: matchedGroups.length,
          link,
          valid: result.valid,
          name: result.name,
          totalMembers: result.totalMembers,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    // Return unvalidated links
    for (const [link, source] of allLinks) {
      groups.push({ link, source, valid: false });
    }
  }

  // Sort matched groups by matchScore (descending), then by members
  matchedGroups.sort((a, b) => {
    const scoreA = (a as any).matchScore || 0;
    const scoreB = (b as any).matchScore || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.totalMembers || 0) - (a.totalMembers || 0);
  });

  console.log(
    `[Discover] Done: ${checkedCount} checked, ${validCount} valid, ${matchedGroups.length} matched keyword`
  );

  const result: DiscoverResult = {
    keyword,
    links_found: allLinks.size,
    groups_validated: checkedCount,
    groups_valid: validCount,
    groups: matchedGroups.length > 0 ? matchedGroups : groups.filter((g) => g.valid).slice(0, maxResults),
  };

  broadcast({
    type: "discover:complete",
    payload: result,
    timestamp: new Date().toISOString(),
  });

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
