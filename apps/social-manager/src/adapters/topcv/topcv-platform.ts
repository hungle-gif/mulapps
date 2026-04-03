/**
 * TopCV Employer Platform Adapter — CDP Browser Automation
 *
 * Recruitment platform adapter for TopCV Vietnam (tuyendung.topcv.vn).
 * This is NOT a social media platform — it is a recruitment tool.
 * The adapter focuses on recruitment automation tasks that Hub can orchestrate:
 * - Job posting management
 * - CV search and screening
 * - Candidate pipeline management
 * - Recruitment analytics
 *
 * Account: logged in as employer "operis.vn - He thong tu dong hoa doanh nghiep"
 * Platform: Vietnamese-language employer dashboard (SPA, React-based)
 *
 * Key DOM patterns (2026):
 * - Dashboard: stats cards with CV counts (unread, unrated, etc.)
 * - CV search: form-based filters + result list with candidate cards
 * - Job management: table/list of job postings with CRUD actions
 * - Sidebar navigation: left-side menu with icons + Vietnamese labels
 *
 * NOTE: TopCV uses Vietnamese labels extensively. All selectors assume vi locale.
 * All selectors marked with "TODO: verify selector live" need validation.
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface TopCVDashboardStats {
  total_cvs: number;
  unread_cvs: number;
  unrated_cvs: number;
  shortlisted_cvs: number;
  new_cvs_today: number;
  active_jobs: number;
  expiring_jobs: number;
  notifications_count: number;
  scraped_at: string;
}

export interface TopCVCandidate {
  cv_id: string;
  name: string;
  title: string;
  current_company: string;
  experience_years: number;
  education: string;
  location: string;
  salary_expected: string;
  skills: string[];
  last_active: string;
  cv_url: string;
  avatar_url: string;
  match_score: number;
}

export interface TopCVCVDetail {
  cv_id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  current_company: string;
  experience: {
    company: string;
    role: string;
    duration: string;
    description: string;
  }[];
  education: {
    school: string;
    degree: string;
    field: string;
    year: string;
  }[];
  skills: string[];
  certifications: string[];
  languages: string[];
  location: string;
  salary_expected: string;
  career_objective: string;
  cv_url: string;
  applied_date: string;
  status: string;
}

export interface TopCVJobPosting {
  job_id: string;
  title: string;
  status: 'active' | 'expired' | 'draft' | 'pending';
  applications_count: number;
  views_count: number;
  created_at: string;
  expires_at: string;
  location: string;
  salary_range: string;
  job_url: string;
}

export interface TopCVJobData {
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  location: string;
  job_type: 'full-time' | 'part-time' | 'contract' | 'intern' | 'remote';
  experience_level: string;
  industry: string;
  category: string;
  quantity: number;
  deadline: string;
  skills: string[];
  contact_name: string;
  contact_email: string;
}

export interface TopCVCampaign {
  campaign_id: string;
  name: string;
  status: string;
  jobs_count: number;
  cvs_count: number;
  created_at: string;
  campaign_url: string;
}

export interface TopCVRecruitmentReport {
  period: string;
  total_applications: number;
  total_views: number;
  conversion_rate: number;
  top_sources: { source: string; count: number }[];
  applications_by_job: { job_title: string; count: number }[];
  cvs_by_status: { status: string; count: number }[];
  scraped_at: string;
}

export interface TopCVNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  link: string;
}

export interface TopCVSearchFilters {
  keyword?: string;
  location?: string;
  experience?: string;
  salary_range?: string;
  education?: string;
  industry?: string;
  job_type?: string;
  gender?: string;
  age_range?: string;
}

// =============================================
// URLS
// =============================================

export const TOPCV_URLS = {
  base: 'https://tuyendung.topcv.vn',
  dashboard: 'https://tuyendung.topcv.vn/app/dashboard',
  postJob: 'https://tuyendung.topcv.vn/app/jobs',
  searchCV: (query?: string) => {
    const base = 'https://tuyendung.topcv.vn/app/search-cv';
    return query ? `${base}?keyword=${encodeURIComponent(query)}` : base;
  },
  cvsManagement: 'https://tuyendung.topcv.vn/app/cvs-management',
  cvDetail: (cvId: string) => `https://tuyendung.topcv.vn/app/cvs-management/${cvId}`,
  suggestions: 'https://tuyendung.topcv.vn/app/suggestions',
  recommendedCVs: 'https://tuyendung.topcv.vn/app/recommendation-cvs',
  campaigns: 'https://tuyendung.topcv.vn/app/recruitment-campaigns',
  reports: 'https://tuyendung.topcv.vn/app/recruitment-reports',
  cvLabels: 'https://tuyendung.topcv.vn/app/cv-label',
  buyServices: 'https://tuyendung.topcv.vn/app/buy-services',
  accountSettings: 'https://tuyendung.topcv.vn/app/account/settings',
  notifications: 'https://tuyendung.topcv.vn/app/notifications',
  jobDetail: (jobId: string) => `https://tuyendung.topcv.vn/app/jobs/${jobId}`,
  jobApplications: (jobId: string) => `https://tuyendung.topcv.vn/app/jobs/${jobId}/applications`,
};

// =============================================
// SCRAPE SCRIPTS
// =============================================

/**
 * Scrape TopCV employer dashboard stats.
 * Dashboard shows stat cards with CV pipeline counts and job metrics.
 */
export const SCRAPE_DASHBOARD_SCRIPT = `() => {
  const stats = {
    total_cvs: 0,
    unread_cvs: 0,
    unrated_cvs: 0,
    shortlisted_cvs: 0,
    new_cvs_today: 0,
    active_jobs: 0,
    expiring_jobs: 0,
    notifications_count: 0,
  };

  // TODO: verify selector live — dashboard stat cards
  const statCards = document.querySelectorAll(
    '.dashboard-stat-card, ' +
    '.stat-card, ' +
    '.box-statistic, ' +
    '[class*="stat-item"], ' +
    '[class*="dashboard-summary"] .item'
  );

  statCards.forEach(card => {
    const label = (card.querySelector('.label, .title, .stat-label, h4, h5, span:first-child')?.textContent || '').trim().toLowerCase();
    const valueEl = card.querySelector('.value, .number, .stat-value, h3, .count, strong');
    const value = parseInt((valueEl?.textContent || '0').replace(/[^\\d]/g, '')) || 0;

    // Match Vietnamese labels to stat fields
    if (label.includes('chua doc') || label.includes('chưa đọc') || label.includes('unread')) {
      stats.unread_cvs = value;
    } else if (label.includes('chua danh gia') || label.includes('chưa đánh giá') || label.includes('unrated')) {
      stats.unrated_cvs = value;
    } else if (label.includes('phu hop') || label.includes('phù hợp') || label.includes('shortlist')) {
      stats.shortlisted_cvs = value;
    } else if (label.includes('tong') || label.includes('tổng') || label.includes('total cv')) {
      stats.total_cvs = value;
    } else if (label.includes('hom nay') || label.includes('hôm nay') || label.includes('today')) {
      stats.new_cvs_today = value;
    } else if (label.includes('tin dang') || label.includes('tin đăng') || label.includes('active job')) {
      stats.active_jobs = value;
    } else if (label.includes('het han') || label.includes('hết hạn') || label.includes('expir')) {
      stats.expiring_jobs = value;
    }
  });

  // TODO: verify selector live — notification badge
  const notifBadge = document.querySelector(
    '.notification-badge, ' +
    '.badge-notification, ' +
    '[class*="noti"] .badge, ' +
    '[class*="notification"] .count'
  );
  if (notifBadge) {
    stats.notifications_count = parseInt(notifBadge.textContent?.replace(/[^\\d]/g, '') || '0') || 0;
  }

  return stats;
}`;

/**
 * Scrape CV search results from TopCV search page.
 * Each candidate card shows basic info, skills, experience, salary.
 */
export const SCRAPE_CV_SEARCH_RESULTS_SCRIPT = `() => {
  const candidates = [];

  // TODO: verify selector live — CV search result cards
  const cards = document.querySelectorAll(
    '.cv-search-result, ' +
    '.candidate-card, ' +
    '.cv-item, ' +
    '[class*="search-result-item"], ' +
    '[class*="cv-card"]'
  );

  cards.forEach((card, idx) => {
    // TODO: verify selector live — candidate name
    const nameEl = card.querySelector(
      '.candidate-name, .cv-name, h3 a, h4 a, [class*="name"] a, .title a'
    );
    const name = nameEl?.textContent?.trim() || '';

    // TODO: verify selector live — candidate job title
    const titleEl = card.querySelector(
      '.candidate-title, .cv-title, .position, [class*="job-title"], .sub-title'
    );
    const title = titleEl?.textContent?.trim() || '';

    // TODO: verify selector live — candidate current company
    const companyEl = card.querySelector(
      '.company-name, .current-company, [class*="company"]'
    );
    const currentCompany = companyEl?.textContent?.trim() || '';

    // TODO: verify selector live — experience years
    const expEl = card.querySelector(
      '.experience, [class*="experience"], [class*="exp-year"]'
    );
    const expText = expEl?.textContent?.trim() || '';
    const expYears = parseInt(expText.replace(/[^\\d]/g, '')) || 0;

    // TODO: verify selector live — education
    const eduEl = card.querySelector(
      '.education, [class*="education"], [class*="degree"]'
    );
    const education = eduEl?.textContent?.trim() || '';

    // TODO: verify selector live — location
    const locEl = card.querySelector(
      '.location, [class*="location"], [class*="address"]'
    );
    const location = locEl?.textContent?.trim() || '';

    // TODO: verify selector live — expected salary
    const salaryEl = card.querySelector(
      '.salary, [class*="salary"], [class*="wage"]'
    );
    const salaryExpected = salaryEl?.textContent?.trim() || '';

    // TODO: verify selector live — skills tags
    const skillEls = card.querySelectorAll(
      '.skill-tag, .tag, [class*="skill"] .badge, [class*="tag"]'
    );
    const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

    // TODO: verify selector live — last active
    const activeEl = card.querySelector(
      '.last-active, [class*="active-time"], [class*="last-update"]'
    );
    const lastActive = activeEl?.textContent?.trim() || '';

    // TODO: verify selector live — CV link
    const linkEl = card.querySelector('a[href*="cv"], a[href*="profile"]') || nameEl;
    const cvUrl = linkEl?.getAttribute('href') || '';

    // TODO: verify selector live — avatar
    const avatarEl = card.querySelector('img.avatar, img[class*="avatar"], .candidate-avatar img');
    const avatarUrl = avatarEl?.getAttribute('src') || '';

    // TODO: verify selector live — match score (TopCV shows matching percentage)
    const scoreEl = card.querySelector(
      '.match-score, [class*="match"], [class*="score"], .percent'
    );
    const scoreText = scoreEl?.textContent?.trim() || '0';
    const matchScore = parseInt(scoreText.replace(/[^\\d]/g, '')) || 0;

    if (name) {
      candidates.push({
        cv_id: cvUrl.split('/').pop() || 'cv_' + idx,
        name,
        title,
        current_company: currentCompany,
        experience_years: expYears,
        education,
        location,
        salary_expected: salaryExpected,
        skills,
        last_active: lastActive,
        cv_url: cvUrl.startsWith('http') ? cvUrl : 'https://tuyendung.topcv.vn' + cvUrl,
        avatar_url: avatarUrl,
        match_score: matchScore,
      });
    }
  });

  return candidates;
}`;

/**
 * Scrape detailed CV/candidate profile page.
 */
export const SCRAPE_CV_DETAIL_SCRIPT = `() => {
  const detail = {
    cv_id: '',
    name: '',
    email: '',
    phone: '',
    title: '',
    current_company: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    location: '',
    salary_expected: '',
    career_objective: '',
    cv_url: window.location.href,
    applied_date: '',
    status: '',
  };

  // TODO: verify selector live — candidate name on detail page
  detail.name = (document.querySelector(
    '.cv-detail-name, .candidate-name, h1[class*="name"], .profile-name'
  )?.textContent || '').trim();

  // TODO: verify selector live — contact info (may be hidden/locked)
  detail.email = (document.querySelector(
    '[class*="email"] span, [data-field="email"], .contact-email'
  )?.textContent || '').trim();

  detail.phone = (document.querySelector(
    '[class*="phone"] span, [data-field="phone"], .contact-phone'
  )?.textContent || '').trim();

  // TODO: verify selector live — job title
  detail.title = (document.querySelector(
    '.cv-detail-title, .position-title, [class*="job-title"], .headline'
  )?.textContent || '').trim();

  // TODO: verify selector live — current company
  detail.current_company = (document.querySelector(
    '.current-company, [class*="company-name"]'
  )?.textContent || '').trim();

  // TODO: verify selector live — experience entries
  const expSections = document.querySelectorAll(
    '.experience-item, [class*="experience-section"] .item, [class*="work-exp"] .entry'
  );
  expSections.forEach(section => {
    const company = (section.querySelector('.company, [class*="company"]')?.textContent || '').trim();
    const role = (section.querySelector('.role, .position, [class*="title"]')?.textContent || '').trim();
    const duration = (section.querySelector('.duration, .time, [class*="time"]')?.textContent || '').trim();
    const desc = (section.querySelector('.description, .detail, p')?.textContent || '').trim();
    if (company || role) {
      detail.experience.push({ company, role, duration, description: desc.substring(0, 300) });
    }
  });

  // TODO: verify selector live — education entries
  const eduSections = document.querySelectorAll(
    '.education-item, [class*="education-section"] .item, [class*="edu"] .entry'
  );
  eduSections.forEach(section => {
    const school = (section.querySelector('.school, [class*="school"]')?.textContent || '').trim();
    const degree = (section.querySelector('.degree, [class*="degree"]')?.textContent || '').trim();
    const field = (section.querySelector('.field, .major, [class*="major"]')?.textContent || '').trim();
    const year = (section.querySelector('.year, .time, [class*="time"]')?.textContent || '').trim();
    if (school) {
      detail.education.push({ school, degree, field, year });
    }
  });

  // TODO: verify selector live — skills list
  const skillEls = document.querySelectorAll(
    '.skill-tag, [class*="skill"] .tag, [class*="skill-item"], .cv-skill-item'
  );
  detail.skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

  // TODO: verify selector live — certifications
  const certEls = document.querySelectorAll(
    '.certification-item, [class*="cert"] .item'
  );
  detail.certifications = Array.from(certEls).map(el => el.textContent?.trim()).filter(Boolean);

  // TODO: verify selector live — languages
  const langEls = document.querySelectorAll(
    '.language-item, [class*="language"] .item'
  );
  detail.languages = Array.from(langEls).map(el => el.textContent?.trim()).filter(Boolean);

  // TODO: verify selector live — location
  detail.location = (document.querySelector(
    '[class*="location"], [class*="address"]'
  )?.textContent || '').trim();

  // TODO: verify selector live — expected salary
  detail.salary_expected = (document.querySelector(
    '[class*="salary"], [class*="wage"]'
  )?.textContent || '').trim();

  // TODO: verify selector live — career objective
  detail.career_objective = (document.querySelector(
    '.career-objective, [class*="objective"], [class*="summary"]'
  )?.textContent || '').trim().substring(0, 500);

  // TODO: verify selector live — application date
  detail.applied_date = (document.querySelector(
    '.applied-date, [class*="apply-date"], [class*="received-date"]'
  )?.textContent || '').trim();

  // TODO: verify selector live — current status
  detail.status = (document.querySelector(
    '.cv-status, [class*="status"] .label, [class*="status-badge"]'
  )?.textContent || '').trim();

  detail.cv_id = window.location.pathname.split('/').pop() || '';

  return detail;
}`;

/**
 * Scrape job postings list from the jobs management page.
 */
export const SCRAPE_JOBS_LIST_SCRIPT = `() => {
  const jobs = [];

  // TODO: verify selector live — job posting rows/cards
  const rows = document.querySelectorAll(
    '.job-item, .job-row, [class*="job-list"] .item, ' +
    'tr[class*="job"], [class*="campaign-job-item"]'
  );

  rows.forEach((row, idx) => {
    // TODO: verify selector live — job title
    const titleEl = row.querySelector(
      '.job-title, .title a, h3 a, h4 a, [class*="job-name"]'
    );
    const title = titleEl?.textContent?.trim() || '';

    // TODO: verify selector live — job status badge
    const statusEl = row.querySelector(
      '.status-badge, .job-status, [class*="status"], .badge'
    );
    const statusText = (statusEl?.textContent?.trim() || '').toLowerCase();
    let status = 'active';
    if (statusText.includes('het han') || statusText.includes('hết hạn') || statusText.includes('expir')) {
      status = 'expired';
    } else if (statusText.includes('nhap') || statusText.includes('nháp') || statusText.includes('draft')) {
      status = 'draft';
    } else if (statusText.includes('cho duyet') || statusText.includes('chờ duyệt') || statusText.includes('pending')) {
      status = 'pending';
    }

    // TODO: verify selector live — applications count
    const appsEl = row.querySelector(
      '.applications-count, [class*="apply-count"], [class*="cv-count"]'
    );
    const applicationsCount = parseInt((appsEl?.textContent || '0').replace(/[^\\d]/g, '')) || 0;

    // TODO: verify selector live — views count
    const viewsEl = row.querySelector(
      '.views-count, [class*="view-count"], [class*="views"]'
    );
    const viewsCount = parseInt((viewsEl?.textContent || '0').replace(/[^\\d]/g, '')) || 0;

    // TODO: verify selector live — dates
    const createdEl = row.querySelector(
      '.created-date, [class*="created"], [class*="post-date"]'
    );
    const createdAt = createdEl?.textContent?.trim() || '';

    const expiresEl = row.querySelector(
      '.expires-date, [class*="expire"], [class*="deadline"]'
    );
    const expiresAt = expiresEl?.textContent?.trim() || '';

    // TODO: verify selector live — location
    const locEl = row.querySelector(
      '.job-location, [class*="location"]'
    );
    const location = locEl?.textContent?.trim() || '';

    // TODO: verify selector live — salary range
    const salaryEl = row.querySelector(
      '.salary-range, [class*="salary"]'
    );
    const salaryRange = salaryEl?.textContent?.trim() || '';

    // TODO: verify selector live — job link
    const linkEl = row.querySelector('a[href*="job"]') || titleEl;
    const jobUrl = linkEl?.getAttribute('href') || '';

    if (title) {
      jobs.push({
        job_id: jobUrl.split('/').pop() || 'job_' + idx,
        title,
        status,
        applications_count: applicationsCount,
        views_count: viewsCount,
        created_at: createdAt,
        expires_at: expiresAt,
        location,
        salary_range: salaryRange,
        job_url: jobUrl.startsWith('http') ? jobUrl : 'https://tuyendung.topcv.vn' + jobUrl,
      });
    }
  });

  return jobs;
}`;

/**
 * Scrape AI-recommended CVs from TopCV's recommendation engine (Toppy AI).
 */
export const SCRAPE_RECOMMENDED_CVS_SCRIPT = `() => {
  const candidates = [];

  // TODO: verify selector live — recommended CV cards
  const cards = document.querySelectorAll(
    '.recommendation-item, .suggested-cv, [class*="recommend"] .cv-card, ' +
    '[class*="suggestion-item"], [class*="cv-recommend-item"]'
  );

  cards.forEach((card, idx) => {
    const nameEl = card.querySelector('.candidate-name, .cv-name, h3, h4, [class*="name"]');
    const name = nameEl?.textContent?.trim() || '';

    const titleEl = card.querySelector('.position, .title, [class*="title"]:not(h3):not(h4)');
    const title = titleEl?.textContent?.trim() || '';

    const companyEl = card.querySelector('.company, [class*="company"]');
    const currentCompany = companyEl?.textContent?.trim() || '';

    const expEl = card.querySelector('[class*="experience"], [class*="exp"]');
    const expText = expEl?.textContent?.trim() || '';
    const expYears = parseInt(expText.replace(/[^\\d]/g, '')) || 0;

    const locEl = card.querySelector('[class*="location"], [class*="address"]');
    const location = locEl?.textContent?.trim() || '';

    const salaryEl = card.querySelector('[class*="salary"]');
    const salaryExpected = salaryEl?.textContent?.trim() || '';

    const skillEls = card.querySelectorAll('.skill-tag, .tag, [class*="skill"]');
    const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean);

    const scoreEl = card.querySelector('[class*="match"], [class*="score"], .percent');
    const matchScore = parseInt((scoreEl?.textContent || '0').replace(/[^\\d]/g, '')) || 0;

    const linkEl = card.querySelector('a[href]');
    const cvUrl = linkEl?.getAttribute('href') || '';

    const avatarEl = card.querySelector('img');
    const avatarUrl = avatarEl?.getAttribute('src') || '';

    if (name) {
      candidates.push({
        cv_id: cvUrl.split('/').pop() || 'rec_' + idx,
        name,
        title,
        current_company: currentCompany,
        experience_years: expYears,
        education: '',
        location,
        salary_expected: salaryExpected,
        skills,
        last_active: '',
        cv_url: cvUrl.startsWith('http') ? cvUrl : 'https://tuyendung.topcv.vn' + cvUrl,
        avatar_url: avatarUrl,
        match_score: matchScore,
      });
    }
  });

  return candidates;
}`;

/**
 * Scrape recruitment campaigns list.
 */
export const SCRAPE_CAMPAIGNS_SCRIPT = `() => {
  const campaigns = [];

  // TODO: verify selector live — campaign list items
  const items = document.querySelectorAll(
    '.campaign-item, [class*="campaign-row"], [class*="campaign-card"], ' +
    'tr[class*="campaign"]'
  );

  items.forEach((item, idx) => {
    const nameEl = item.querySelector('.campaign-name, .name, h3, h4, [class*="title"] a');
    const name = nameEl?.textContent?.trim() || '';

    const statusEl = item.querySelector('.status, [class*="status"], .badge');
    const status = statusEl?.textContent?.trim() || '';

    const jobsEl = item.querySelector('[class*="job-count"], [class*="jobs"]');
    const jobsCount = parseInt((jobsEl?.textContent || '0').replace(/[^\\d]/g, '')) || 0;

    const cvsEl = item.querySelector('[class*="cv-count"], [class*="cvs"]');
    const cvsCount = parseInt((cvsEl?.textContent || '0').replace(/[^\\d]/g, '')) || 0;

    const dateEl = item.querySelector('.date, [class*="created"], [class*="time"]');
    const createdAt = dateEl?.textContent?.trim() || '';

    const linkEl = item.querySelector('a[href*="campaign"]') || nameEl;
    const campaignUrl = linkEl?.getAttribute('href') || '';

    if (name) {
      campaigns.push({
        campaign_id: campaignUrl.split('/').pop() || 'camp_' + idx,
        name,
        status,
        jobs_count: jobsCount,
        cvs_count: cvsCount,
        created_at: createdAt,
        campaign_url: campaignUrl.startsWith('http') ? campaignUrl : 'https://tuyendung.topcv.vn' + campaignUrl,
      });
    }
  });

  return campaigns;
}`;

/**
 * Scrape recruitment report / analytics data.
 */
export const SCRAPE_RECRUITMENT_REPORT_SCRIPT = `() => {
  const report = {
    period: '',
    total_applications: 0,
    total_views: 0,
    conversion_rate: 0,
    top_sources: [],
    applications_by_job: [],
    cvs_by_status: [],
  };

  // TODO: verify selector live — report period selector
  const periodEl = document.querySelector(
    '.report-period, [class*="date-range"], [class*="period"] .active, select[class*="period"]'
  );
  report.period = periodEl?.textContent?.trim() || '';

  // TODO: verify selector live — summary stats
  const summaryCards = document.querySelectorAll(
    '.report-stat, [class*="summary-card"], [class*="report-overview"] .item'
  );
  summaryCards.forEach(card => {
    const label = (card.querySelector('.label, .title, span')?.textContent || '').trim().toLowerCase();
    const value = parseInt((card.querySelector('.value, .number, strong, h3')?.textContent || '0').replace(/[^\\d]/g, '')) || 0;

    if (label.includes('ung tuyen') || label.includes('ứng tuyển') || label.includes('application')) {
      report.total_applications = value;
    } else if (label.includes('luot xem') || label.includes('lượt xem') || label.includes('view')) {
      report.total_views = value;
    } else if (label.includes('ty le') || label.includes('tỷ lệ') || label.includes('rate')) {
      report.conversion_rate = value;
    }
  });

  // TODO: verify selector live — source breakdown table/chart
  const sourceRows = document.querySelectorAll(
    '[class*="source-table"] tr, [class*="source-list"] .item'
  );
  sourceRows.forEach(row => {
    const source = (row.querySelector('td:first-child, .source-name')?.textContent || '').trim();
    const count = parseInt((row.querySelector('td:nth-child(2), .source-count')?.textContent || '0').replace(/[^\\d]/g, '')) || 0;
    if (source && source.toLowerCase() !== 'nguồn') {
      report.top_sources.push({ source, count });
    }
  });

  // TODO: verify selector live — applications by job table
  const jobRows = document.querySelectorAll(
    '[class*="job-report"] tr, [class*="job-stats"] .item'
  );
  jobRows.forEach(row => {
    const jobTitle = (row.querySelector('td:first-child, .job-name')?.textContent || '').trim();
    const count = parseInt((row.querySelector('td:nth-child(2), .apply-count')?.textContent || '0').replace(/[^\\d]/g, '')) || 0;
    if (jobTitle && !jobTitle.toLowerCase().includes('tin tuyển dụng')) {
      report.applications_by_job.push({ job_title: jobTitle, count });
    }
  });

  // TODO: verify selector live — CVs by status breakdown
  const statusItems = document.querySelectorAll(
    '[class*="status-breakdown"] .item, [class*="cv-status"] .stat'
  );
  statusItems.forEach(item => {
    const status = (item.querySelector('.label, .name, span:first-child')?.textContent || '').trim();
    const count = parseInt((item.querySelector('.count, .value, span:last-child')?.textContent || '0').replace(/[^\\d]/g, '')) || 0;
    if (status) {
      report.cvs_by_status.push({ status, count });
    }
  });

  return report;
}`;

/**
 * Scrape notifications from TopCV employer panel.
 */
export const SCRAPE_NOTIFICATIONS_SCRIPT = `() => {
  const notifications = [];

  // TODO: verify selector live — notification items
  const items = document.querySelectorAll(
    '.notification-item, [class*="noti-item"], [class*="notification-list"] li, ' +
    '[class*="notify-item"]'
  );

  items.forEach((item, idx) => {
    const titleEl = item.querySelector('.noti-title, .title, h4, strong');
    const title = titleEl?.textContent?.trim() || '';

    const messageEl = item.querySelector('.noti-message, .message, .content, p');
    const message = messageEl?.textContent?.trim() || '';

    const typeEl = item.querySelector('[class*="type"], .noti-icon');
    const type = typeEl?.getAttribute('data-type') || typeEl?.className?.match(/noti--(\\w+)/)?.[1] || 'general';

    const isUnread = item.classList.contains('unread') ||
      item.classList.contains('is-unread') ||
      !!item.querySelector('.unread-dot, [class*="unread"]');

    const timeEl = item.querySelector('.time, .timestamp, [class*="time"], .date');
    const createdAt = timeEl?.textContent?.trim() || '';

    const linkEl = item.querySelector('a[href]');
    const link = linkEl?.getAttribute('href') || '';

    if (title || message) {
      notifications.push({
        id: 'notif_' + idx,
        title,
        message: message.substring(0, 300),
        type,
        read: !isUnread,
        created_at: createdAt,
        link: link.startsWith('http') ? link : (link ? 'https://tuyendung.topcv.vn' + link : ''),
      });
    }
  });

  return notifications;
}`;

/**
 * Scrape job applications (CVs submitted for a specific job).
 */
export const SCRAPE_JOB_APPLICATIONS_SCRIPT = `() => {
  const applications = [];

  // TODO: verify selector live — application/CV list for a job
  const cards = document.querySelectorAll(
    '.application-item, .cv-item, [class*="candidate-item"], ' +
    '[class*="cv-list"] .item, tr[class*="cv-row"]'
  );

  cards.forEach((card, idx) => {
    const nameEl = card.querySelector('.candidate-name, .name, h4, [class*="name"] a');
    const name = nameEl?.textContent?.trim() || '';

    const titleEl = card.querySelector('.position, .title, [class*="title"]');
    const title = titleEl?.textContent?.trim() || '';

    const statusEl = card.querySelector('.cv-status, [class*="status"], .badge');
    const status = statusEl?.textContent?.trim() || '';

    const dateEl = card.querySelector('.apply-date, [class*="date"], .time');
    const appliedDate = dateEl?.textContent?.trim() || '';

    const linkEl = card.querySelector('a[href]');
    const cvUrl = linkEl?.getAttribute('href') || '';

    if (name) {
      applications.push({
        cv_id: cvUrl.split('/').pop() || 'app_' + idx,
        name,
        title,
        status,
        applied_date: appliedDate,
        cv_url: cvUrl.startsWith('http') ? cvUrl : 'https://tuyendung.topcv.vn' + cvUrl,
      });
    }
  });

  return applications;
}`;

// =============================================
// ADAPTER CLASS
// =============================================

export class TopCVPlatformAdapter {
  private cdp: CDPConnector;

  constructor(cdp: CDPConnector) {
    this.cdp = cdp;
  }

  // ------------------------------------------
  // SESSION
  // ------------------------------------------

  /**
   * Verify that the browser is still logged in to TopCV employer dashboard.
   * Returns true if session is active, false if redirected to login.
   */
  async checkSession(): Promise<{ logged_in: boolean; employer_name: string; current_url: string }> {
    await this.cdp.navigate(TOPCV_URLS.dashboard, 3000);
    const currentUrl = await this.cdp.getCurrentUrl();

    // If redirected to login page, session is invalid
    const loggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/sign-in') && currentUrl.includes('/app/');

    // TODO: verify selector live — employer name in header/sidebar
    const employerName = await this.cdp.evaluate(`
      (document.querySelector(
        '.employer-name, .company-name, [class*="user-name"], ' +
        '[class*="sidebar"] .name, .header-user .name, [class*="profile-name"]'
      )?.textContent || '').trim()
    `);

    return {
      logged_in: loggedIn,
      employer_name: employerName,
      current_url: currentUrl,
    };
  }

  // ------------------------------------------
  // DASHBOARD
  // ------------------------------------------

  /**
   * Scrape dashboard overview stats: CV pipeline counts, active jobs, etc.
   */
  async getDashboardStats(): Promise<TopCVDashboardStats> {
    await this.cdp.navigate(TOPCV_URLS.dashboard, 3000);

    // Wait for dashboard stats to render
    await this.cdp.waitForSelector(
      '.dashboard-stat-card, .stat-card, .box-statistic, [class*="stat-item"], [class*="dashboard-summary"]',
      8000,
    );

    const stats = await this.cdp.evaluateFunction(SCRAPE_DASHBOARD_SCRIPT);
    return {
      ...stats,
      scraped_at: new Date().toISOString(),
    };
  }

  // ------------------------------------------
  // CV SEARCH
  // ------------------------------------------

  /**
   * Search for candidate CVs using keyword and filters.
   * Navigates to search page, fills filters, and scrapes results.
   */
  async searchCV(
    query: string,
    filters?: TopCVSearchFilters,
  ): Promise<{ candidates: TopCVCandidate[]; total_results: number; scraped_at: string }> {
    await this.cdp.navigate(TOPCV_URLS.searchCV(query), 3000);

    // Apply additional filters if provided
    if (filters) {
      await this.applySearchFilters(filters);
      await this.cdp.wait(2000);
    }

    // Wait for search results to load
    await this.cdp.waitForSelector(
      '.cv-search-result, .candidate-card, .cv-item, [class*="search-result-item"], [class*="cv-card"]',
      8000,
    );

    const candidates = await this.cdp.evaluateFunction(SCRAPE_CV_SEARCH_RESULTS_SCRIPT);

    // TODO: verify selector live — total results count
    const totalText = await this.cdp.evaluate(`
      (document.querySelector(
        '.total-results, [class*="result-count"], [class*="total"], .search-summary'
      )?.textContent || '0')
    `);
    const totalResults = parseInt(totalText.replace(/[^\d]/g, '')) || candidates.length;

    return {
      candidates: candidates || [],
      total_results: totalResults,
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Apply search filters on the CV search page.
   * Internal helper — fills filter form fields.
   */
  private async applySearchFilters(filters: TopCVSearchFilters): Promise<void> {
    // TODO: verify selector live — filter form selectors
    if (filters.location) {
      const locSelector = 'select[name="location"], [class*="filter-location"] select, #location-filter';
      const exists = await this.cdp.exists(locSelector);
      if (exists) {
        await this.cdp.evaluate(`
          (() => {
            const sel = document.querySelector('${locSelector}');
            if (sel) {
              sel.value = '${filters.location.replace(/'/g, "\\'")}';
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()
        `);
      }
    }

    if (filters.experience) {
      const expSelector = 'select[name="experience"], [class*="filter-experience"] select, #experience-filter';
      const exists = await this.cdp.exists(expSelector);
      if (exists) {
        await this.cdp.evaluate(`
          (() => {
            const sel = document.querySelector('${expSelector}');
            if (sel) {
              sel.value = '${filters.experience.replace(/'/g, "\\'")}';
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()
        `);
      }
    }

    if (filters.salary_range) {
      const salarySelector = 'select[name="salary"], [class*="filter-salary"] select, #salary-filter';
      const exists = await this.cdp.exists(salarySelector);
      if (exists) {
        await this.cdp.evaluate(`
          (() => {
            const sel = document.querySelector('${salarySelector}');
            if (sel) {
              sel.value = '${filters.salary_range.replace(/'/g, "\\'")}';
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()
        `);
      }
    }

    if (filters.education) {
      const eduSelector = 'select[name="education"], [class*="filter-education"] select, #education-filter';
      const exists = await this.cdp.exists(eduSelector);
      if (exists) {
        await this.cdp.evaluate(`
          (() => {
            const sel = document.querySelector('${eduSelector}');
            if (sel) {
              sel.value = '${filters.education.replace(/'/g, "\\'")}';
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()
        `);
      }
    }

    if (filters.industry) {
      const indSelector = 'select[name="industry"], [class*="filter-industry"] select, #industry-filter';
      const exists = await this.cdp.exists(indSelector);
      if (exists) {
        await this.cdp.evaluate(`
          (() => {
            const sel = document.querySelector('${indSelector}');
            if (sel) {
              sel.value = '${filters.industry.replace(/'/g, "\\'")}';
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()
        `);
      }
    }

    // Click search/apply button to apply filters
    // TODO: verify selector live — search/apply filter button
    const searchBtnSelector = 'button[type="submit"], .btn-search, [class*="btn-filter"], [class*="search-btn"]';
    const hasBtn = await this.cdp.exists(searchBtnSelector);
    if (hasBtn) {
      await this.cdp.click(searchBtnSelector);
    }
  }

  // ------------------------------------------
  // RECOMMENDED CVs (Toppy AI)
  // ------------------------------------------

  /**
   * Get AI-recommended CVs from TopCV's Toppy AI suggestion engine.
   */
  async getRecommendedCVs(limit = 20): Promise<{ candidates: TopCVCandidate[]; scraped_at: string }> {
    await this.cdp.navigate(TOPCV_URLS.recommendedCVs, 3000);

    // Wait for recommendation cards to load
    await this.cdp.waitForSelector(
      '.recommendation-item, .suggested-cv, [class*="recommend"], [class*="suggestion-item"]',
      8000,
    );

    const candidates = await this.cdp.evaluateFunction(SCRAPE_RECOMMENDED_CVS_SCRIPT);
    return {
      candidates: (candidates || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  // ------------------------------------------
  // CV DETAILS
  // ------------------------------------------

  /**
   * Get detailed information for a specific CV by navigating to its detail page.
   */
  async getCVDetails(cvId: string): Promise<TopCVCVDetail> {
    const url = TOPCV_URLS.cvDetail(cvId);
    await this.cdp.navigate(url, 3000);

    // Wait for CV detail content to load
    await this.cdp.waitForSelector(
      '.cv-detail-name, .candidate-name, [class*="cv-detail"], [class*="profile-name"]',
      8000,
    );

    const detail = await this.cdp.evaluateFunction(SCRAPE_CV_DETAIL_SCRIPT);
    return detail;
  }

  // ------------------------------------------
  // JOB POSTING
  // ------------------------------------------

  /**
   * Create a new job posting on TopCV.
   * Navigates to job creation form, fills all fields, and submits.
   *
   * IMPORTANT: This performs real actions — use with care.
   */
  async postJob(jobData: TopCVJobData): Promise<{ success: boolean; job_url: string; message: string }> {
    await this.cdp.navigate(TOPCV_URLS.postJob, 3000);

    // Click "create new job" button if on jobs list page
    // TODO: verify selector live — new job creation button
    const newJobBtnSelector = 'a[href*="create"], .btn-create-job, [class*="btn-new-job"], [class*="create-job"]';
    const hasNewJobBtn = await this.cdp.exists(newJobBtnSelector);
    if (hasNewJobBtn) {
      await this.cdp.click(newJobBtnSelector);
      await this.cdp.wait(2000);
    }

    // Fill job posting form fields
    // TODO: verify selector live — job title input
    await this.cdp.fillInput(
      'input[name="title"], input[name="job_title"], #job-title, [class*="job-title"] input',
      jobData.title,
    );
    await this.cdp.wait(300);

    // TODO: verify selector live — job description rich editor or textarea
    const descSelector = 'textarea[name="description"], [class*="job-description"] textarea, #job-description, [class*="description"] .ql-editor, [class*="description"] [contenteditable="true"]';
    const isRichEditor = await this.cdp.evaluate(`
      !!document.querySelector('[class*="description"] .ql-editor, [class*="description"] [contenteditable="true"]')
    `);
    if (isRichEditor) {
      await this.cdp.typeIntoRichEditor(
        '[class*="description"] .ql-editor, [class*="description"] [contenteditable="true"]',
        jobData.description,
      );
    } else {
      await this.cdp.fillInput(descSelector, jobData.description);
    }
    await this.cdp.wait(300);

    // TODO: verify selector live — requirements field
    const reqSelector = 'textarea[name="requirements"], [class*="requirements"] textarea, #job-requirements, [class*="requirements"] .ql-editor, [class*="requirements"] [contenteditable="true"]';
    const isReqRichEditor = await this.cdp.evaluate(`
      !!document.querySelector('[class*="requirements"] .ql-editor, [class*="requirements"] [contenteditable="true"]')
    `);
    if (isReqRichEditor) {
      await this.cdp.typeIntoRichEditor(
        '[class*="requirements"] .ql-editor, [class*="requirements"] [contenteditable="true"]',
        jobData.requirements,
      );
    } else {
      await this.cdp.fillInput(reqSelector, jobData.requirements);
    }
    await this.cdp.wait(300);

    // TODO: verify selector live — benefits field
    if (jobData.benefits) {
      const benefitsSelector = 'textarea[name="benefits"], [class*="benefits"] textarea, #job-benefits, [class*="benefits"] .ql-editor, [class*="benefits"] [contenteditable="true"]';
      const isBenRichEditor = await this.cdp.evaluate(`
        !!document.querySelector('[class*="benefits"] .ql-editor, [class*="benefits"] [contenteditable="true"]')
      `);
      if (isBenRichEditor) {
        await this.cdp.typeIntoRichEditor(
          '[class*="benefits"] .ql-editor, [class*="benefits"] [contenteditable="true"]',
          jobData.benefits,
        );
      } else {
        await this.cdp.fillInput(benefitsSelector, jobData.benefits);
      }
      await this.cdp.wait(300);
    }

    // TODO: verify selector live — salary min/max
    const salaryMinSelector = 'input[name="salary_min"], input[name="salary_from"], #salary-min, [class*="salary-min"] input';
    if (await this.cdp.exists(salaryMinSelector)) {
      await this.cdp.fillInput(salaryMinSelector, String(jobData.salary_min));
    }
    await this.cdp.wait(200);

    const salaryMaxSelector = 'input[name="salary_max"], input[name="salary_to"], #salary-max, [class*="salary-max"] input';
    if (await this.cdp.exists(salaryMaxSelector)) {
      await this.cdp.fillInput(salaryMaxSelector, String(jobData.salary_max));
    }
    await this.cdp.wait(200);

    // TODO: verify selector live — location select
    const locationSelector = 'select[name="location"], [class*="location"] select, #job-location';
    if (await this.cdp.exists(locationSelector)) {
      await this.cdp.evaluate(`
        (() => {
          const sel = document.querySelector('${locationSelector}');
          if (sel) {
            // Try to find option matching the location text
            const options = Array.from(sel.options || []);
            const match = options.find(o =>
              o.text.toLowerCase().includes('${jobData.location.toLowerCase().replace(/'/g, "\\'")}')
            );
            if (match) {
              sel.value = match.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        })()
      `);
    }
    await this.cdp.wait(200);

    // TODO: verify selector live — quantity/headcount
    const quantitySelector = 'input[name="quantity"], input[name="headcount"], #job-quantity, [class*="quantity"] input';
    if (jobData.quantity && await this.cdp.exists(quantitySelector)) {
      await this.cdp.fillInput(quantitySelector, String(jobData.quantity));
    }
    await this.cdp.wait(200);

    // TODO: verify selector live — deadline
    const deadlineSelector = 'input[name="deadline"], input[name="expired_date"], #job-deadline, [class*="deadline"] input';
    if (jobData.deadline && await this.cdp.exists(deadlineSelector)) {
      await this.cdp.fillInput(deadlineSelector, jobData.deadline);
    }
    await this.cdp.wait(200);

    // TODO: verify selector live — contact name
    const contactNameSelector = 'input[name="contact_name"], #contact-name, [class*="contact-name"] input';
    if (jobData.contact_name && await this.cdp.exists(contactNameSelector)) {
      await this.cdp.fillInput(contactNameSelector, jobData.contact_name);
    }

    // TODO: verify selector live — contact email
    const contactEmailSelector = 'input[name="contact_email"], #contact-email, [class*="contact-email"] input';
    if (jobData.contact_email && await this.cdp.exists(contactEmailSelector)) {
      await this.cdp.fillInput(contactEmailSelector, jobData.contact_email);
    }

    await this.cdp.wait(500);

    // Scroll to bottom to find submit button
    await this.cdp.scrollToBottom();
    await this.cdp.wait(500);

    // TODO: verify selector live — submit/publish job button
    const submitSelector = 'button[type="submit"], .btn-publish, .btn-submit, [class*="btn-post-job"], [class*="submit-job"]';
    const hasSubmit = await this.cdp.exists(submitSelector);
    if (!hasSubmit) {
      return {
        success: false,
        job_url: '',
        message: 'Submit button not found. Form may have changed — verify selectors.',
      };
    }

    await this.cdp.click(submitSelector);
    await this.cdp.wait(3000);

    // Check for success indicators
    const currentUrl = await this.cdp.getCurrentUrl();
    // TODO: verify selector live — success message or toast
    const successMsg = await this.cdp.evaluate(`
      (document.querySelector(
        '.toast-success, [class*="success"], .alert-success, [class*="notification-success"]'
      )?.textContent || '').trim()
    `);

    const hasError = await this.cdp.exists(
      '.toast-error, [class*="error"], .alert-danger, .form-error, [class*="validation-error"]',
    );

    if (hasError) {
      const errorMsg = await this.cdp.evaluate(`
        (document.querySelector(
          '.toast-error, [class*="error"], .alert-danger, .form-error'
        )?.textContent || 'Unknown error').trim()
      `);
      return {
        success: false,
        job_url: '',
        message: 'Job posting failed: ' + errorMsg,
      };
    }

    return {
      success: true,
      job_url: currentUrl,
      message: successMsg || 'Job posted successfully',
    };
  }

  // ------------------------------------------
  // JOB MANAGEMENT
  // ------------------------------------------

  /**
   * List all job postings with their status and metrics.
   */
  async getJobs(): Promise<{ jobs: TopCVJobPosting[]; scraped_at: string }> {
    await this.cdp.navigate(TOPCV_URLS.postJob, 3000);

    // Wait for job list to load
    await this.cdp.waitForSelector(
      '.job-item, .job-row, [class*="job-list"], tr[class*="job"], [class*="campaign-job-item"]',
      8000,
    );

    const jobs = await this.cdp.evaluateFunction(SCRAPE_JOBS_LIST_SCRIPT);
    return {
      jobs: jobs || [],
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Get applications (CVs) submitted for a specific job.
   */
  async getJobApplications(
    jobId: string,
  ): Promise<{ applications: any[]; total: number; scraped_at: string }> {
    const url = TOPCV_URLS.jobApplications(jobId);
    await this.cdp.navigate(url, 3000);

    // Wait for applications list to load
    await this.cdp.waitForSelector(
      '.application-item, .cv-item, [class*="candidate-item"], [class*="cv-list"]',
      8000,
    );

    const applications = await this.cdp.evaluateFunction(SCRAPE_JOB_APPLICATIONS_SCRIPT);

    // TODO: verify selector live — total count
    const totalText = await this.cdp.evaluate(`
      (document.querySelector(
        '.total-count, [class*="total"], [class*="result-count"]'
      )?.textContent || '0')
    `);
    const total = parseInt(totalText.replace(/[^\d]/g, '')) || applications.length;

    return {
      applications: applications || [],
      total,
      scraped_at: new Date().toISOString(),
    };
  }

  // ------------------------------------------
  // CV STATUS MANAGEMENT
  // ------------------------------------------

  /**
   * Update a CV's status (shortlisted, rejected, interview scheduled, etc.).
   * Navigates to CV detail page and clicks the appropriate status action.
   *
   * IMPORTANT: This performs real actions on actual CVs.
   */
  async updateCVStatus(
    cvId: string,
    status: 'shortlisted' | 'rejected' | 'interview' | 'hired' | 'not-suitable',
  ): Promise<{ success: boolean; message: string }> {
    const url = TOPCV_URLS.cvDetail(cvId);
    await this.cdp.navigate(url, 3000);

    // Wait for CV detail page to load
    await this.cdp.waitForSelector(
      '.cv-detail-name, .candidate-name, [class*="cv-detail"]',
      8000,
    );

    // Map status to Vietnamese labels used on TopCV
    const statusMap: Record<string, string[]> = {
      'shortlisted': ['phu hop', 'phù hợp', 'shortlist', 'đạt'],
      'rejected': ['khong phu hop', 'không phù hợp', 'reject', 'loại', 'từ chối'],
      'interview': ['phong van', 'phỏng vấn', 'interview', 'hen phong van', 'hẹn phỏng vấn'],
      'hired': ['tuyen', 'tuyển', 'hired', 'nhan viec', 'nhận việc'],
      'not-suitable': ['khong phu hop', 'không phù hợp', 'not suitable'],
    };

    const targetLabels = statusMap[status] || [status];

    // TODO: verify selector live — status action buttons or dropdown
    // TopCV typically has rating/status buttons on CV detail pages
    const clicked = await this.cdp.evaluate(`
      (() => {
        // Try dropdown approach first
        const dropdown = document.querySelector(
          '.status-dropdown, [class*="cv-action"], [class*="rating-action"], ' +
          'select[class*="status"], .cv-status-select'
        );
        if (dropdown && dropdown.tagName === 'SELECT') {
          const options = Array.from(dropdown.options || []);
          const targetLabels = ${JSON.stringify(targetLabels)};
          const match = options.find(o => {
            const text = o.text.toLowerCase();
            return targetLabels.some(label => text.includes(label));
          });
          if (match) {
            dropdown.value = match.value;
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));
            return 'dropdown';
          }
        }

        // Try button approach
        const buttons = document.querySelectorAll(
          '.cv-action-btn, [class*="status-btn"], [class*="rating-btn"], ' +
          '[class*="cv-action"] button, .action-buttons button'
        );
        const targetLabels2 = ${JSON.stringify(targetLabels)};
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim().toLowerCase();
          if (targetLabels2.some(label => text.includes(label))) {
            btn.click();
            return 'button';
          }
        }

        return null;
      })()
    `);

    if (!clicked) {
      return {
        success: false,
        message: `Could not find status action for "${status}". The CV detail page layout may have changed — verify selectors.`,
      };
    }

    await this.cdp.wait(2000);

    // Check for confirmation dialog and confirm if present
    // TODO: verify selector live — confirmation modal
    const hasConfirm = await this.cdp.exists(
      '.modal-confirm, [class*="confirm-dialog"], [class*="modal"] .btn-confirm',
    );
    if (hasConfirm) {
      await this.cdp.click(
        '.btn-confirm, [class*="confirm-dialog"] .btn-primary, [class*="modal"] .btn-confirm, [class*="modal"] button.btn-primary',
      );
      await this.cdp.wait(1500);
    }

    // Check success
    const successMsg = await this.cdp.evaluate(`
      (document.querySelector(
        '.toast-success, [class*="success"], .alert-success'
      )?.textContent || '').trim()
    `);

    return {
      success: true,
      message: successMsg || `CV ${cvId} status updated to "${status}" via ${clicked}`,
    };
  }

  // ------------------------------------------
  // CAMPAIGNS
  // ------------------------------------------

  /**
   * Get all recruitment campaigns.
   */
  async getCampaigns(): Promise<{ campaigns: TopCVCampaign[]; scraped_at: string }> {
    await this.cdp.navigate(TOPCV_URLS.campaigns, 3000);

    // Wait for campaigns to load
    await this.cdp.waitForSelector(
      '.campaign-item, [class*="campaign-row"], [class*="campaign-card"]',
      8000,
    );

    const campaigns = await this.cdp.evaluateFunction(SCRAPE_CAMPAIGNS_SCRIPT);
    return {
      campaigns: campaigns || [],
      scraped_at: new Date().toISOString(),
    };
  }

  // ------------------------------------------
  // RECRUITMENT REPORTS
  // ------------------------------------------

  /**
   * Get recruitment analytics and report data.
   */
  async getRecruitmentReport(): Promise<TopCVRecruitmentReport> {
    await this.cdp.navigate(TOPCV_URLS.reports, 3000);

    // Wait for report data to load
    await this.cdp.waitForSelector(
      '.report-stat, [class*="summary-card"], [class*="report-overview"], [class*="chart"]',
      8000,
    );

    // Allow charts and data to fully render
    await this.cdp.wait(2000);

    const report = await this.cdp.evaluateFunction(SCRAPE_RECRUITMENT_REPORT_SCRIPT);
    return {
      ...report,
      scraped_at: new Date().toISOString(),
    };
  }

  // ------------------------------------------
  // NOTIFICATIONS
  // ------------------------------------------

  /**
   * Get system notifications (new CVs, expiring jobs, service alerts).
   */
  async getNotifications(): Promise<{ notifications: TopCVNotification[]; unread_count: number; scraped_at: string }> {
    // First try the notification dropdown/panel
    // TODO: verify selector live — notification bell icon
    const bellSelector = '.notification-bell, [class*="noti-icon"], [class*="bell"], [class*="notification-trigger"]';
    const hasBell = await this.cdp.exists(bellSelector);

    if (hasBell) {
      await this.cdp.click(bellSelector);
      await this.cdp.wait(1500);
    } else {
      // Navigate to notifications page
      await this.cdp.navigate(TOPCV_URLS.notifications, 3000);
    }

    await this.cdp.waitForSelector(
      '.notification-item, [class*="noti-item"], [class*="notification-list"]',
      8000,
    );

    const notifications = await this.cdp.evaluateFunction(SCRAPE_NOTIFICATIONS_SCRIPT);

    const unreadCount = (notifications || []).filter((n: TopCVNotification) => !n.read).length;

    return {
      notifications: notifications || [],
      unread_count: unreadCount,
      scraped_at: new Date().toISOString(),
    };
  }
}

export default TopCVPlatformAdapter;
