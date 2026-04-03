import { getZaloClient } from "./client.js";
import { prisma } from "../db.js";
import type { ZaloGroupMember } from "../../types/index.js";

interface ScanResult {
  groupId: string;
  groupName: string;
  totalMembers: number;
  membersExtracted: number;
  newMembers: number;
  duplicateMembers: number;
}

/**
 * Scan members from a Zalo group link WITHOUT joining the group.
 * Uses zca-js getGroupLinkInfo with pagination (mpage).
 */
export async function scanGroupByLink(
  groupLink: string,
  accountId?: string,
  onProgress?: (progress: {
    page: number;
    membersFound: number;
    hasMore: boolean;
  }) => void
): Promise<ScanResult> {
  const api = await getZaloClient(accountId);

  // First page — get group info + initial members
  // zca-js expects payload object: { link, memberPage }
  const firstPage = await api.getGroupLinkInfo({ link: groupLink, memberPage: 1 });

  const groupId = firstPage.groupId;
  const groupName = firstPage.name || "Unknown Group";
  const totalMembers = firstPage.totalMember || 0;

  // Collect all members across pages
  let allMembers: ZaloGroupMember[] = [...firstPage.currentMems];
  let currentPage = 1;
  let hasMore = firstPage.hasMoreMember > 0;

  onProgress?.({
    page: currentPage,
    membersFound: allMembers.length,
    hasMore,
  });

  // Paginate through all pages
  while (hasMore) {
    currentPage++;

    // Delay between pages to avoid rate limiting
    await sleep(1000 + Math.random() * 2000);

    const pageData = await api.getGroupLinkInfo({ link: groupLink, memberPage: currentPage });
    const pageMembers = pageData.currentMems || [];

    if (pageMembers.length === 0) break;

    allMembers = [...allMembers, ...pageMembers];
    hasMore = pageData.hasMoreMember > 0;

    onProgress?.({
      page: currentPage,
      membersFound: allMembers.length,
      hasMore,
    });
  }

  // Upsert group in database
  const group = await prisma.group.upsert({
    where: { zalo_group_id: groupId },
    update: {
      name: groupName,
      description: firstPage.desc || null,
      avatar: firstPage.avt || null,
      total_members: totalMembers,
      extracted_members: allMembers.length,
      creator_zalo_id: firstPage.creatorId || null,
      admin_zalo_ids: firstPage.adminIds
        ? JSON.stringify(firstPage.adminIds)
        : null,
      last_scanned_at: new Date(),
      status: "active",
    },
    create: {
      zalo_group_id: groupId,
      name: groupName,
      description: firstPage.desc || null,
      avatar: firstPage.avt || null,
      link: groupLink,
      total_members: totalMembers,
      extracted_members: allMembers.length,
      creator_zalo_id: firstPage.creatorId || null,
      admin_zalo_ids: firstPage.adminIds
        ? JSON.stringify(firstPage.adminIds)
        : null,
      last_scanned_at: new Date(),
      status: "active",
    },
  });

  // Upsert contacts + link to group
  let newCount = 0;
  let dupCount = 0;
  const adminIds = new Set(firstPage.adminIds || []);

  for (const member of allMembers) {
    // Upsert contact
    const existing = await prisma.contact.findUnique({
      where: { zalo_id: member.id },
    });

    if (existing) {
      dupCount++;
      // Update info if needed
      await prisma.contact.update({
        where: { zalo_id: member.id },
        data: {
          display_name: member.dName || existing.display_name,
          zalo_name: member.zaloName || existing.zalo_name,
          avatar: member.avatar || existing.avatar,
          avatar_small: member.avatar_25 || existing.avatar_small,
          account_status: member.accountStatus,
        },
      });
    } else {
      newCount++;
      await prisma.contact.create({
        data: {
          zalo_id: member.id,
          display_name: member.dName || "Unknown",
          zalo_name: member.zaloName || null,
          avatar: member.avatar || null,
          avatar_small: member.avatar_25 || null,
          account_status: member.accountStatus,
          outreach_status: "new",
        },
      });
    }

    // Link contact to group
    const contact = await prisma.contact.findUnique({
      where: { zalo_id: member.id },
    });

    if (contact) {
      await prisma.contactGroup.upsert({
        where: {
          contact_id_group_id: {
            contact_id: contact.id,
            group_id: group.id,
          },
        },
        update: {
          scanned_at: new Date(),
          role: adminIds.has(member.id)
            ? member.id === firstPage.creatorId
              ? "creator"
              : "admin"
            : "member",
        },
        create: {
          contact_id: contact.id,
          group_id: group.id,
          role: adminIds.has(member.id)
            ? member.id === firstPage.creatorId
              ? "creator"
              : "admin"
            : "member",
        },
      });
    }
  }

  return {
    groupId: group.id,
    groupName,
    totalMembers,
    membersExtracted: allMembers.length,
    newMembers: newCount,
    duplicateMembers: dupCount,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
