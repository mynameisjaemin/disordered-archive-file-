"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Orbitron } from "next/font/google";
import type { Session } from "@supabase/supabase-js";
import { CategoryMenu } from "@/app/components/CategoryMenu";
import {
  archiveFiles,
  categories,
  issueItems,
  journalPosts,
  portfolioItems,
  referenceItemsSeed,
  referenceMainTags,
  tagDescriptions,
} from "@/lib/archive/data";
import type {
  ArchiveFileItem,
  ArchiveSection,
  ArchiveSectionKey,
  CategoryId,
  FreeboardPost,
  IssueItem,
  JournalPost,
  MainReferenceTag,
  PortfolioItem,
  ReferenceItem,
} from "@/lib/archive/types";
import { parseTags } from "@/lib/archive/utils";
import { supabase } from "@/lib/supabaseClient";

const orbitron = Orbitron({ subsets: ["latin"], weight: ["400", "700"] });

function isAdminSession(session: Session | null) {
  return session?.user.app_metadata?.role === "admin";
}

const issueCategoryFilters = ["ALL", "FASHION", "DESIGN", "RETAIL", "SPACE", "CULTURE"] as const;
type IssueCategoryFilter = (typeof issueCategoryFilters)[number];

const archiveIssueFallbackDescription =
  "A DAF editorial record selected from fashion, design, retail, space, and culture.";

function getIssueCategory(issue: IssueItem) {
  const directCategory = issue.category?.trim().toUpperCase();
  if (directCategory && issueCategoryFilters.includes(directCategory as IssueCategoryFilter)) {
    return directCategory;
  }

  const matchedTag = issue.tags
    .map((tag) => tag.trim().toUpperCase())
    .find((tag) => issueCategoryFilters.includes(tag as IssueCategoryFilter) && tag !== "ALL");

  return matchedTag || "CULTURE";
}

function getIssueNumber(issue: IssueItem, index: number, total: number) {
  if (issue.issueNumber !== undefined && issue.issueNumber !== null) {
    const value = String(issue.issueNumber).replace(/^ISSUE\s*/i, "").trim();
    return value.padStart(2, "0");
  }

  const titleMatch = issue.title.match(/issue\s*([0-9]+)/i);
  if (titleMatch?.[1]) return titleMatch[1].padStart(2, "0");

  return String(Math.max(total - index, 1)).padStart(2, "0");
}

function getIssueDate(issue: IssueItem) {
  const rawDate = issue.publishedAt || issue.createdAt;
  if (!rawDate) return "DATE UNLISTED";

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return rawDate;

  return parsedDate
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
    .toUpperCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getJournalSlug(post: JournalPost) {
  return post.slug || slugify(post.title) || post.id;
}

function getJournalContent(post: JournalPost) {
  return post.content || post.excerpt || "";
}

function getJournalDate(value?: string) {
  if (!value) return "DATE UNLISTED";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
    .toUpperCase();
}

function getDateInputValue(value?: string) {
  if (!value) return "";

  const directMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directMatch) return directMatch[0];

  const looseMatch = value.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (looseMatch) {
    return `${looseMatch[1]}-${looseMatch[2].padStart(2, "0")}-${looseMatch[3].padStart(2, "0")}`;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "";
  return parsedDate.toISOString().slice(0, 10);
}

function getReadingTime(post: JournalPost) {
  const text = `${post.title} ${post.subtitle || ""} ${getJournalContent(post)}`;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} MIN READ`;
}

function getJournalExcerpt(post: JournalPost) {
  const source = post.excerpt || getJournalContent(post);
  return source
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function getJournalHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (!match) return null;
      const text = match[2].trim();
      return {
        id: slugify(text),
        text,
        level: match[1].length,
      };
    })
    .filter(Boolean) as { id: string; text: string; level: number }[];
}

function getPortfolioSlug(item: PortfolioItem) {
  return item.slug || slugify(item.title) || item.id;
}

function getPortfolioNumber(item: PortfolioItem, index: number, total: number) {
  if (item.portfolioNumber !== undefined && item.portfolioNumber !== null) {
    const value = String(item.portfolioNumber).replace(/^PORTFOLIO\s*/i, "").trim();
    return value.padStart(3, "0");
  }

  return String(Math.max(total - index, 1)).padStart(3, "0");
}

function getPortfolioStatus(item: PortfolioItem) {
  return (item.status || "archived").replace(/_/g, " ").toUpperCase();
}

function getPortfolioContribution(item: PortfolioItem) {
  if (Array.isArray(item.contribution)) return item.contribution;
  if (!item.contribution) return [];
  return item.contribution
    .split(/\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${size}B`;
}

function getPortfolioFileCount(item: PortfolioItem) {
  if (item.attachments?.length) return item.attachments.length;

  const galleryCount = item.gallery?.length || 0;
  const attachmentCount = item.attachment?.url ? 1 : 0;
  const coverCount = item.coverImage ? 1 : 0;
  return galleryCount + attachmentCount + coverCount;
}

function parseListInput(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePortfolioGallery(value: string) {
  return value
    .split("\n")
    .map((line) => {
      const [src, caption, alt] = line.split("|").map((item) => item.trim());
      if (!src) return null;
      return {
        src,
        caption: caption || undefined,
        alt: alt || undefined,
      };
    })
    .filter(Boolean) as NonNullable<PortfolioItem["gallery"]>;
}

function getEmptyPortfolioDraft(): PortfolioItem {
  return {
    id: `local-${Date.now()}`,
    title: "",
    description: "",
    tags: [],
    status: "draft",
    projectType: "individual",
    visibility: "draft",
    contribution: [],
    skills: [],
    gallery: [],
  };
}

function getEmptyJournalDraft(): JournalPost {
  return {
    id: `local-${Date.now()}`,
    title: "",
    subtitle: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "",
    publishedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    visibility: "draft",
    tags: [],
  };
}

function hashString(value: string) {
  return value.split("").reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 2166136261);
}

function seededUnit(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFreeboardSeed(post: FreeboardPost) {
  return hashString(`${post.id}-${post.content}-${post.date}`);
}

function getFreeboardSafeBounds(size: FreeboardPost["size"]) {
  if (size === "small") {
    return { minX: 15, maxX: 85, minY: 12, maxY: 88 };
  }

  if (size === "large") {
    return { minX: 22, maxX: 78, minY: 17, maxY: 83 };
  }

  return { minX: 18, maxX: 82, minY: 14, maxY: 86 };
}

function getFreeboardLayout(post: FreeboardPost) {
  const seed = getFreeboardSeed(post);
  const sizes = ["small", "medium", "large"] as const;
  const size = post.size || sizes[Math.floor(seededUnit(seed, 4) * sizes.length)] || "medium";
  const bounds = getFreeboardSafeBounds(size);
  const rawX = typeof post.x === "number" ? post.x : bounds.minX + seededUnit(seed, 1) * (bounds.maxX - bounds.minX);
  const rawY = typeof post.y === "number" ? post.y : bounds.minY + seededUnit(seed, 2) * (bounds.maxY - bounds.minY);

  return {
    x: clamp(rawX, bounds.minX, bounds.maxX),
    y: clamp(rawY, bounds.minY, bounds.maxY),
    rotation: typeof post.rotation === "number" ? post.rotation : -4 + seededUnit(seed, 3) * 8,
    size,
  };
}

function createFreeboardLayoutSeed(base: string) {
  const seed = hashString(base);
  const sizes = ["small", "medium", "large"] as const;
  const size = sizes[Math.floor(seededUnit(seed, 14) * sizes.length)] || "medium";
  const bounds = getFreeboardSafeBounds(size);
  return {
    x: Math.round((bounds.minX + seededUnit(seed, 11) * (bounds.maxX - bounds.minX)) * 100) / 100,
    y: Math.round((bounds.minY + seededUnit(seed, 12) * (bounds.maxY - bounds.minY)) * 100) / 100,
    rotation: Math.round((-4 + seededUnit(seed, 13) * 8) * 100) / 100,
    size,
  };
}

const portfolioSectionKeys = [
  "overview",
  "background",
  "problem",
  "goal",
  "research",
  "insight",
  "strategy",
  "planning",
  "process",
  "execution",
  "outcome",
  "reflection",
] as const;

const portfolioSectionLabels: Record<(typeof portfolioSectionKeys)[number], string> = {
  overview: "Overview",
  background: "Background",
  problem: "Problem",
  goal: "Goal",
  research: "Research",
  insight: "Insight",
  strategy: "Strategy",
  planning: "Planning",
  process: "Process",
  execution: "Execution",
  outcome: "Outcome",
  reflection: "Reflection",
};

const archiveTypeFilters = ["ALL", "GARMENT", "PATTERN", "PROCESS", "MATERIAL", "FITTING", "REFERENCE"] as const;
const archiveCategoryFilters = ["ALL", "JACKET", "SHIRT", "PANTS", "DENIM", "OUTER", "DETAIL"] as const;
const archiveSortOptions = ["DATE", "TYPE", "STATUS"] as const;
type ArchiveSortOption = (typeof archiveSortOptions)[number];

const archiveSectionKeys: ArchiveSectionKey[] = [
  "finalGarment",
  "pattern",
  "reference",
  "material",
  "process",
  "fitting",
  "notes",
];

const archiveSectionLabels: Record<ArchiveSectionKey, string> = {
  finalGarment: "FINAL GARMENT",
  pattern: "PATTERN FILES",
  reference: "REFERENCE FILES",
  material: "MATERIAL NOTES",
  process: "PROCESS LOG",
  fitting: "FITTING LOG",
  notes: "TECHNICAL NOTES",
};

const archiveSectionCountLabels: Record<ArchiveSectionKey, string> = {
  finalGarment: "GARMENT FILES",
  pattern: "PATTERN FILES",
  reference: "REFERENCES",
  material: "MATERIAL NOTES",
  process: "PROCESS LOGS",
  fitting: "FITTING LOGS",
  notes: "NOTES",
};

function getArchiveSlug(item: ArchiveFileItem) {
  return item.slug || slugify(item.title) || item.id;
}

function getArchiveNumber(item: ArchiveFileItem, index: number, total: number) {
  if (item.archiveNumber !== undefined && item.archiveNumber !== null) {
    const value = String(item.archiveNumber).replace(/^ARCHIVE\s*/i, "").trim();
    return value.padStart(3, "0");
  }

  return String(Math.max(total - index, 1)).padStart(3, "0");
}

function getArchiveType(item: ArchiveFileItem) {
  return (item.type || "garment").replace(/_/g, " ").toUpperCase();
}

function getArchiveCategory(item: ArchiveFileItem) {
  return (item.category || "UNCLASSIFIED").replace(/_/g, " ").toUpperCase();
}

function getArchiveStatus(item: ArchiveFileItem) {
  return (item.status || "draft").replace(/_/g, " ").toUpperCase();
}

function archiveSectionHasContent(section?: ArchiveSection) {
  if (!section) return false;
  return Boolean(
    section.summary ||
      section.content ||
      section.media?.length ||
      section.steps?.length ||
      Object.entries(section).some(([key, value]) => key !== "media" && key !== "steps" && Boolean(value))
  );
}

function getArchiveFileName(item: ArchiveFileItem) {
  const slug = getArchiveSlug(item).replace(/-/g, "_").toUpperCase();
  return `${slug || "UNTITLED_FILE"}.archive`;
}

function getArchiveSectionCount(section?: ArchiveSection) {
  if (!section) return 0;

  const mediaCount = section.media?.length || 0;
  const stepCount = section.steps?.length || 0;
  const fieldCount = Object.entries(section).filter(([key, value]) => {
    if (key === "media" || key === "steps") return false;
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  }).length;

  return Math.max(mediaCount + stepCount, fieldCount > 0 ? 1 : 0);
}

function getArchiveTotalFileCount(item: ArchiveFileItem) {
  const sectionCount = archiveSectionKeys.reduce(
    (sum, key) => sum + getArchiveSectionCount(item.sections?.[key]),
    0
  );

  return sectionCount + (item.coverImage ? 1 : 0);
}

function getArchiveSearchText(item: ArchiveFileItem) {
  const sectionText = archiveSectionKeys
    .map((key) => {
      const section = item.sections?.[key];
      if (!section) return "";
      return [
        section.summary,
        section.content,
        section.source,
        section.reasonSaved,
        section.learned,
        section.application,
        section.patternType,
        section.baseSize,
        section.version,
        section.measurements,
        section.modificationNotes,
        section.issue,
        section.correction,
        section.finalPattern,
        section.fabricName,
        section.composition,
        section.color,
        section.weight,
        section.texture,
        section.surface,
        section.behavior,
        section.notes,
        section.problem,
        section.result,
        (section.steps || []).map((step) => `${step.title} ${step.note || ""}`).join(" "),
      ].join(" ");
    })
    .join(" ");

  return [
    item.archiveNumber || "",
    item.title,
    item.type,
    item.category || "",
    item.status || "",
    item.date || "",
    item.garmentType || "",
    item.material || "",
    item.color || "",
    item.technique || "",
    item.seasonYear || "",
    item.sizeMeasurement || "",
    item.patternVersion || "",
    item.tags.join(" "),
    sectionText,
  ]
    .join(" ")
    .toLowerCase();
}

export default function HomePage() {
  const [entered, setEntered] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");

  const [freeboardPosts, setFreeboardPosts] = useState<FreeboardPost[]>([]);
  const [freeboardName, setFreeboardName] = useState("");
  const [freeboardContent, setFreeboardContent] = useState("");
  const [freeboardTags, setFreeboardTags] = useState("");
  const [freeboardAnonymous, setFreeboardAnonymous] = useState(false);
  const [freeboardStatus, setFreeboardStatus] = useState("");
  const [isSubmittingFreeboard, setIsSubmittingFreeboard] = useState(false);
  const [freeboardWriteOpen, setFreeboardWriteOpen] = useState(false);
  const [selectedFreeboardId, setSelectedFreeboardId] = useState<string | null>(null);
  const [freeboardSearchQuery, setFreeboardSearchQuery] = useState("");
  const [freeboardTagFilter, setFreeboardTagFilter] = useState("");
  const [freeboardViewMode, setFreeboardViewMode] = useState<"canvas" | "recent" | "random">("canvas");
  const [freeboardViewSeed, setFreeboardViewSeed] = useState(1);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminInput, setAdminInput] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [journals, setJournals] = useState<JournalPost[]>(journalPosts);
  const [journalSearchQuery, setJournalSearchQuery] = useState("");
  const [journalCategoryFilter, setJournalCategoryFilter] = useState("ALL");
  const [journalTagFilter, setJournalTagFilter] = useState("");
  const [selectedJournalSlug, setSelectedJournalSlug] = useState<string | null>(null);
  const [journalStatus, setJournalStatus] = useState(
    supabase ? "CONNECTING TO JOURNAL..." : "LOCAL JOURNAL MODE / SUPABASE NOT CONFIGURED"
  );
  const [readingProgress, setReadingProgress] = useState(0);
  const [journalFormOpen, setJournalFormOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journalDraft, setJournalDraft] = useState<JournalPost>(getEmptyJournalDraft);

  const [portfolios, setPortfolios] = useState<PortfolioItem[]>(portfolioItems);
  const [portfolioSearchQuery, setPortfolioSearchQuery] = useState("");
  const [portfolioCategoryFilter, setPortfolioCategoryFilter] = useState("ALL");
  const [portfolioStatusFilter, setPortfolioStatusFilter] = useState("ALL");
  const [portfolioTypeFilter, setPortfolioTypeFilter] = useState("ALL");
  const [portfolioSkillFilter, setPortfolioSkillFilter] = useState("");
  const [portfolioTagFilter, setPortfolioTagFilter] = useState("");
  const [selectedPortfolioSlug, setSelectedPortfolioSlug] = useState<string | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState(
    supabase ? "CONNECTING TO PORTFOLIO..." : "LOCAL PORTFOLIO MODE / SUPABASE NOT CONFIGURED"
  );
  const [portfolioFormOpen, setPortfolioFormOpen] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [portfolioDraft, setPortfolioDraft] = useState<PortfolioItem>(getEmptyPortfolioDraft);
  const [portfolioUploadFiles, setPortfolioUploadFiles] = useState<File[]>([]);

  const [archiveRecords, setArchiveRecords] = useState<ArchiveFileItem[]>(archiveFiles);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [archiveTypeFilter, setArchiveTypeFilter] = useState("ALL");
  const [archiveCategoryFilter, setArchiveCategoryFilter] = useState("ALL");
  const [archiveSortBy, setArchiveSortBy] = useState<ArchiveSortOption>("DATE");
  const [selectedArchiveSlug, setSelectedArchiveSlug] = useState<string | null>(null);
  const [expandedArchiveSection, setExpandedArchiveSection] = useState<ArchiveSectionKey | null>(null);
  const [archiveStatus, setArchiveStatus] = useState(
    supabase ? "CONNECTING TO GARMENT FILES..." : "LOCAL GARMENT FILE MODE / SUPABASE NOT CONFIGURED"
  );

  const [issues, setIssues] = useState<IssueItem[]>(issueItems);
  const [issueFormOpen, setIssueFormOpen] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueLink, setNewIssueLink] = useState("");
  const [newIssueHandle, setNewIssueHandle] = useState("@daf.tmp");
  const [newIssueTags, setNewIssueTags] = useState("");
  const [newIssueFile, setNewIssueFile] = useState<File | null>(null);
  const [newIssuePreview, setNewIssuePreview] = useState("");
  const [issueStatus, setIssueStatus] = useState(
    supabase ? "CONNECTING TO ISSUES..." : "LOCAL ISSUE MODE / SUPABASE NOT CONFIGURED"
  );
  const [isSavingIssue, setIsSavingIssue] = useState(false);
  const [issueCategoryFilter, setIssueCategoryFilter] = useState<IssueCategoryFilter>("ALL");

  const [references, setReferences] = useState<ReferenceItem[]>(referenceItemsSeed);
  const [activeMainTag, setActiveMainTag] = useState<MainReferenceTag | null>(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [addReferenceOpen, setAddReferenceOpen] = useState(false);
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [referenceSort, setReferenceSort] = useState<"latest" | "oldest" | "title" | "random">("latest");
  const [randomSeed, setRandomSeed] = useState(1);

  const [newRefTitle, setNewRefTitle] = useState("");
  const [newRefMainTag, setNewRefMainTag] = useState<MainReferenceTag>("DAF_life");
  const [newRefType, setNewRefType] = useState<"image" | "video">("image");
  const [newRefSrc, setNewRefSrc] = useState("");
  const [newRefTags, setNewRefTags] = useState("");
  const [newRefLocation, setNewRefLocation] = useState("");
  const [newRefDate, setNewRefDate] = useState("");
  const [newRefMemo, setNewRefMemo] = useState("");
  const [newRefNoticed, setNewRefNoticed] = useState("");
  const [newRefPossibleUse, setNewRefPossibleUse] = useState("");
  const [newRefFile, setNewRefFile] = useState<File | null>(null);
  const [newRefFiles, setNewRefFiles] = useState<File[]>([]);
  const [referenceStatus, setReferenceStatus] = useState("");
  const [referenceLoadStatus, setReferenceLoadStatus] = useState(
    supabase ? "CONNECTING TO ARCHIVE..." : "LOCAL SEED MODE / SUPABASE NOT CONFIGURED"
  );
  const [isSavingReference, setIsSavingReference] = useState(false);

  const filemasterActive = tagQuery.trim().toLowerCase() === "filemaster";

  useEffect(() => {
    if (!supabase) {
      setAdminStatus("SUPABASE AUTH IS NOT CONFIGURED.");
      return;
    }

    const syncAdminSession = (session: Session | null) => {
      setAdminMode(isAdminSession(session));
    };

    supabase.auth.getSession().then(({ data }) => {
      syncAdminSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncAdminSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (newRefSrc.startsWith("blob:")) {
        URL.revokeObjectURL(newRefSrc);
      }
    };
  }, [newRefSrc]);

  useEffect(() => {
    return () => {
      if (newIssuePreview.startsWith("blob:")) {
        URL.revokeObjectURL(newIssuePreview);
      }
    };
  }, [newIssuePreview]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pathMatch = window.location.pathname.match(/^\/journal\/([^/]+)\/?$/);
    if (pathMatch?.[1]) {
      setSelectedCategory("journal");
      setSelectedJournalSlug(decodeURIComponent(pathMatch[1]));
    }

    const portfolioPathMatch = window.location.pathname.match(/^\/portfolio\/([^/]+)\/?$/);
    if (portfolioPathMatch?.[1]) {
      setSelectedCategory("portfolio");
      setSelectedPortfolioSlug(decodeURIComponent(portfolioPathMatch[1]));
    }

    const archivePathMatch = window.location.pathname.match(/^\/archive\/([^/]+)\/?$/);
    if (archivePathMatch?.[1]) {
      setSelectedCategory("archive");
      setSelectedArchiveSlug(decodeURIComponent(archivePathMatch[1]));
    }

    window.history.replaceState(
      { selectedCategory: null, activeMainTag: null },
      "",
      window.location.pathname
    );

    const handlePopState = () => {
      if (selectedJournalSlug) {
        setSelectedJournalSlug(null);
        window.history.replaceState({ selectedCategory: "journal" }, "", "/");
        return;
      }

      if (selectedPortfolioSlug) {
        setSelectedPortfolioSlug(null);
        window.history.replaceState({ selectedCategory: "portfolio" }, "", "/");
        return;
      }

      if (selectedArchiveSlug) {
        setSelectedArchiveSlug(null);
        setExpandedArchiveSection(null);
        window.history.replaceState({ selectedCategory: "archive" }, "", "/");
        return;
      }

      if (activeMainTag) {
        setActiveMainTag(null);
        setSelectedReferenceId(null);
        setSelectMode(false);
        setSelectedReferenceIds([]);
        return;
      }

      if (selectedCategory) {
        setSelectedCategory(null);
        setTagQuery("");
        setSearchOpen(false);
        setSelectedReferenceId(null);
        return;
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeMainTag, selectedArchiveSlug, selectedCategory, selectedJournalSlug, selectedPortfolioSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedCategory) return;

    window.history.pushState(
      { selectedCategory, activeMainTag },
      "",
      selectedJournalSlug
        ? `/journal/${selectedJournalSlug}`
        : selectedPortfolioSlug
          ? `/portfolio/${selectedPortfolioSlug}`
          : selectedArchiveSlug
            ? `/archive/${selectedArchiveSlug}`
            : window.location.pathname
    );
  }, [selectedCategory, activeMainTag, selectedArchiveSlug, selectedJournalSlug, selectedPortfolioSlug]);

  const selectedReference = useMemo(
    () => references.find((item) => item.id === selectedReferenceId) ?? null,
    [references, selectedReferenceId]
  );

  const activeReferences = useMemo(() => {
    if (!activeMainTag) return [];

    const filtered = references.filter((item) => item.mainTag === activeMainTag);

    if (referenceSort === "oldest") {
      return [...filtered].reverse();
    }

    if (referenceSort === "title") {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    if (referenceSort === "random") {
      return [...filtered].sort((a, b) => {
        const aValue = `${a.id}-${randomSeed}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const bValue = `${b.id}-${randomSeed}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return aValue - bValue;
      });
    }

    return filtered;
  }, [activeMainTag, references, referenceSort, randomSeed]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadReferences = async () => {
      const { data, error } = await client
        .from("references")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setReferenceLoadStatus(`ARCHIVE LOAD ERROR / SHOWING LOCAL SEED: ${error.message}`);
        return;
      }

      if (!data) return;

      const loaded: ReferenceItem[] = data.map((row) => ({
        id: row.id,
        title: row.title,
        mainTag: row.main_tag as MainReferenceTag,
        tags: row.tags || [],
        type: row.type as "image" | "video",
        src: row.src,
        memo: row.memo || "",
        location: row.location || undefined,
        date: row.date || undefined,
        noticed: row.noticed || undefined,
        possibleUse: row.possible_use || undefined,
        storagePath: row.storage_path || undefined,
      }));

      setReferences(loaded);
      setReferenceLoadStatus("LIVE ARCHIVE CONNECTED");
    };

    loadReferences();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadPortfolios = async () => {
      const { data, error } = await client
        .from("portfolios")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) {
        setPortfolioStatus(`PORTFOLIO LOAD ERROR / SHOWING LOCAL DATA: ${error.message}`);
        return;
      }

      if (!data) return;

      setPortfolios(
        data.map((row) => ({
          id: row.id,
          portfolioNumber: row.portfolio_number || row.number || undefined,
          title: row.title,
          subtitle: row.subtitle || undefined,
          description: row.description || row.overview || "",
          coverImage: row.cover_image || row.cover_image_url || row.cover_src || undefined,
          coverAlt: row.cover_alt || row.title || undefined,
          category: row.category || undefined,
          tags: row.tags || [],
          status: row.status || "archived",
          projectType: row.project_type || undefined,
          client: row.client || row.company || undefined,
          projectPeriod: row.project_period || undefined,
          archivedDate: row.archived_date || row.created_at || undefined,
          slug: row.slug || slugify(row.title || row.id),
          isFeatured: Boolean(row.is_featured || row.featured),
          displayOrder: row.display_order || undefined,
          role: row.role || undefined,
          contribution: row.contribution || row.my_contribution || [],
          skills: row.skills || row.skills_used || [],
          overview: row.overview || undefined,
          background: row.background || undefined,
          problem: row.problem || undefined,
          goal: row.goal || undefined,
          research: row.research || undefined,
          insight: row.insight || undefined,
          strategy: row.strategy || undefined,
          planning: row.planning || undefined,
          process: row.process || undefined,
          execution: row.execution || undefined,
          outcome: row.outcome || undefined,
          reflection: row.reflection || undefined,
          gallery: row.gallery || row.gallery_images || [],
          attachment: row.attachment || undefined,
          attachments: row.attachments || [],
          relatedJournalId: row.related_journal_id || undefined,
          relatedJournalSlug: row.related_journal_slug || undefined,
          relatedIssueId: row.related_issue_id || undefined,
          relatedIssueNumber: row.related_issue_number || undefined,
          relatedArchiveIds: row.related_archive_ids || [],
          visibility: row.visibility || "published",
          createdAt: row.created_at || undefined,
          updatedAt: row.updated_at || undefined,
        }))
      );
      setPortfolioStatus("LIVE PORTFOLIO CONNECTED");
    };

    loadPortfolios();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadArchiveFiles = async () => {
      const { data, error } = await client
        .from("archive_files")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) {
        setArchiveStatus(`GARMENT FILE LOAD ERROR / SHOWING LOCAL DATA: ${error.message}`);
        return;
      }

      if (!data) return;

      setArchiveRecords(
        data.map((row) => ({
          id: row.id,
          archiveNumber: row.archive_number || row.number || undefined,
          title: row.title,
          slug: row.slug || slugify(row.title || row.id),
          type: row.type || "garment",
          category: row.category || undefined,
          status: row.status || "draft",
          date: row.date || row.documented_date || row.created_at || undefined,
          coverImage: row.cover_image || row.cover_image_url || row.cover_src || undefined,
          coverAlt: row.cover_alt || row.title || undefined,
          tags: row.tags || [],
          isFeatured: Boolean(row.is_featured || row.featured),
          displayOrder: row.display_order || undefined,
          garmentType: row.garment_type || undefined,
          material: row.material || undefined,
          color: row.color || undefined,
          technique: row.technique || undefined,
          seasonYear: row.season_year || undefined,
          sizeMeasurement: row.size_measurement || undefined,
          patternVersion: row.pattern_version || undefined,
          sections: row.sections || {},
          relatedJournalSlug: row.related_journal_slug || undefined,
          relatedPortfolioSlug: row.related_portfolio_slug || undefined,
          relatedIssueNumber: row.related_issue_number || undefined,
          visibility: row.visibility || "published",
          createdAt: row.created_at || undefined,
          updatedAt: row.updated_at || undefined,
        }))
      );
      setArchiveStatus("LIVE GARMENT FILES CONNECTED");
    };

    loadArchiveFiles();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadJournals = async () => {
      const { data, error } = await client
        .from("journals")
        .select("*")
        .order("published_at", { ascending: false });

      if (error) {
        setJournalStatus(`JOURNAL LOAD ERROR / SHOWING LOCAL DATA: ${error.message}`);
        return;
      }

      if (!data) return;

      setJournals(
        data.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.subtitle || undefined,
          slug: row.slug || slugify(row.title || row.id),
          excerpt: row.excerpt || row.description || "",
          content: row.content || "",
          coverImage: row.cover_image || row.cover_image_url || row.cover_src || undefined,
          coverAlt: row.cover_alt || row.title || undefined,
          coverCaption: row.cover_caption || undefined,
          tags: row.tags || [],
          category: row.category || undefined,
          publishedAt: row.published_at || row.created_at || undefined,
          updatedAt: row.updated_at || row.published_at || row.created_at || undefined,
          visibility: row.visibility || "published",
          relatedIssueId: row.related_issue_id || undefined,
          relatedIssueNumber: row.related_issue_number || undefined,
          relatedIssueSlug: row.related_issue_slug || undefined,
        }))
      );
      setJournalStatus("LIVE JOURNAL CONNECTED");
    };

    loadJournals();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadIssues = async () => {
      const { data, error } = await client
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setIssueStatus(`ISSUE LOAD ERROR / SHOWING LOCAL DATA: ${error.message}`);
        return;
      }

      if (!data) return;

      setIssues(
        data.map((row) => ({
          id: row.id,
          title: row.title,
          link: row.link,
          instagramUrl: row.instagram_url || row.link,
          description: row.description || undefined,
          category: row.category || undefined,
          publishedAt: row.published_at || row.created_at || undefined,
          issueNumber: row.issue_number || undefined,
          thumbnailSrc: row.thumbnail_src || undefined,
          thumbnailUrl: row.thumbnail_url || row.thumbnail_src || undefined,
          instagramHandle: row.instagram_handle || "@daf.tmp",
          tags: row.tags || [],
          isFeatured: Boolean(row.is_featured),
          createdAt: row.created_at || undefined,
          storagePath: row.storage_path || undefined,
        }))
      );
      setIssueStatus("LIVE ISSUES CONNECTED");
    };

    loadIssues();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadFreeboardPosts = async () => {
      const { data, error } = await client
        .from("freeboard_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setFreeboardStatus(`LOAD ERROR: ${error.message}`);
        return;
      }

      if (!data) return;

      const loadedPosts: FreeboardPost[] = data.map((row) => ({
        id: row.id,
        name: row.name || "Unknown",
        content: row.content || "",
        isAnonymous: Boolean(row.is_anonymous),
        date: row.created_at
          ? new Date(row.created_at).toLocaleString()
          : "",
        tags: row.tags || [],
        x: typeof row.x === "number" ? row.x : undefined,
        y: typeof row.y === "number" ? row.y : undefined,
        rotation: typeof row.rotation === "number" ? row.rotation : undefined,
        size: row.size || undefined,
        visibility: row.visibility || "published",
        createdAt: row.created_at || undefined,
      }));

      setFreeboardPosts(loadedPosts);
    };

    loadFreeboardPosts();
  }, []);

  useEffect(() => {
    if (!selectedJournalSlug) return;

    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setReadingProgress(scrollable > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollable) * 100)) : 0);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, [selectedJournalSlug]);

  useEffect(() => {
    if (!selectedFreeboardId) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedFreeboardId(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedFreeboardId]);

  const tagResults = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q || q === "filemaster") return null;

    return {
      references: references.filter(
        (item) =>
          item.mainTag.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.title.toLowerCase().includes(q) ||
          item.memo.toLowerCase().includes(q)
      ),
      issues: issues.filter(
        (item) =>
          item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.title.toLowerCase().includes(q)
      ),
      journal: journals.filter(
        (item) =>
          item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.title.toLowerCase().includes(q) ||
          getJournalContent(item).toLowerCase().includes(q) ||
          (item.category || "").toLowerCase().includes(q)
      ),
      portfolio: portfolios.filter((item) =>
        [
          item.portfolioNumber || "",
          item.title,
          item.subtitle || "",
          item.description,
          item.category || "",
          item.client || "",
          item.role || "",
          item.tags.join(" "),
          (item.skills || []).join(" "),
          portfolioSectionKeys.map((key) => item[key] || "").join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ),
      archive: archiveRecords.filter((item) => getArchiveSearchText(item).includes(q)),
      freeboard: freeboardPosts.filter(
        (item) =>
          item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.content.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
      ),
      contact: "contact instagram portfolio email jaemin6648@gmail.com j.xn_mn".includes(q)
        ? ["jaemin6648@gmail.com", "@j.xn_mn"]
        : [],
    };
  }, [archiveRecords, tagQuery, freeboardPosts, issues, journals, portfolios, references]);

  const visibleFreeboardPosts = useMemo(
    () =>
      freeboardPosts.filter((post) => {
        const visibility = (post.visibility || "published").toLowerCase();
        return adminMode || visibility === "published";
      }),
    [adminMode, freeboardPosts]
  );

  const freeboardTagsList = useMemo(
    () => Array.from(new Set(visibleFreeboardPosts.flatMap((post) => post.tags))).sort((a, b) => a.localeCompare(b)),
    [visibleFreeboardPosts]
  );

  const filteredFreeboardPosts = useMemo(() => {
    const q = freeboardSearchQuery.trim().toLowerCase();
    const filtered = visibleFreeboardPosts.filter((post) => {
      const tagMatch = !freeboardTagFilter || post.tags.includes(freeboardTagFilter);
      const searchTarget = [post.name, post.content, post.tags.join(" "), post.date].join(" ").toLowerCase();
      return tagMatch && (!q || searchTarget.includes(q));
    });

    if (freeboardViewMode === "recent") {
      return [...filtered].sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
    }

    if (freeboardViewMode === "random") {
      return [...filtered].sort((a, b) => {
        const aValue = hashString(`${a.id}-${freeboardViewSeed}`);
        const bValue = hashString(`${b.id}-${freeboardViewSeed}`);
        return aValue - bValue;
      });
    }

    return filtered;
  }, [freeboardSearchQuery, freeboardTagFilter, freeboardViewMode, freeboardViewSeed, visibleFreeboardPosts]);

  const selectedFreeboardPost = useMemo(
    () => visibleFreeboardPosts.find((post) => post.id === selectedFreeboardId) ?? null,
    [selectedFreeboardId, visibleFreeboardPosts]
  );

  const publicPortfolios = useMemo(
    () =>
      portfolios
        .filter((item) => {
          const visibility = (item.visibility || "published").toLowerCase();
          return adminMode || visibility === "published";
        })
        .sort((a, b) => (a.displayOrder || 9999) - (b.displayOrder || 9999)),
    [adminMode, portfolios]
  );

  const portfolioCategories = useMemo(
    () => ["ALL", ...Array.from(new Set(publicPortfolios.map((item) => item.category).filter(Boolean) as string[]))],
    [publicPortfolios]
  );

  const portfolioStatuses = useMemo(
    () => ["ALL", ...Array.from(new Set(publicPortfolios.map((item) => getPortfolioStatus(item))))],
    [publicPortfolios]
  );

  const portfolioTypes = useMemo(
    () => ["ALL", ...Array.from(new Set(publicPortfolios.map((item) => item.projectType).filter(Boolean) as string[]))],
    [publicPortfolios]
  );

  const portfolioSkills = useMemo(
    () => Array.from(new Set(publicPortfolios.flatMap((item) => item.skills || []))).sort((a, b) => a.localeCompare(b)),
    [publicPortfolios]
  );

  const portfolioTags = useMemo(
    () => Array.from(new Set(publicPortfolios.flatMap((item) => item.tags))).sort((a, b) => a.localeCompare(b)),
    [publicPortfolios]
  );

  const filteredPortfolios = useMemo(() => {
    const q = portfolioSearchQuery.trim().toLowerCase();

    return publicPortfolios.filter((item) => {
      const categoryMatch = portfolioCategoryFilter === "ALL" || item.category === portfolioCategoryFilter;
      const statusMatch = portfolioStatusFilter === "ALL" || getPortfolioStatus(item) === portfolioStatusFilter;
      const typeMatch = portfolioTypeFilter === "ALL" || item.projectType === portfolioTypeFilter;
      const skillMatch = !portfolioSkillFilter || (item.skills || []).includes(portfolioSkillFilter);
      const tagMatch = !portfolioTagFilter || item.tags.includes(portfolioTagFilter);
      const searchTarget = [
        item.portfolioNumber || "",
        item.title,
        item.subtitle || "",
        item.description,
        item.category || "",
        item.client || "",
        item.role || "",
        item.projectPeriod || "",
        item.tags.join(" "),
        (item.skills || []).join(" "),
        portfolioSectionKeys.map((key) => item[key] || "").join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return (
        categoryMatch &&
        statusMatch &&
        typeMatch &&
        skillMatch &&
        tagMatch &&
        (!q || searchTarget.includes(q))
      );
    });
  }, [
    portfolioCategoryFilter,
    portfolioSearchQuery,
    portfolioSkillFilter,
    portfolioStatusFilter,
    portfolioTagFilter,
    portfolioTypeFilter,
    publicPortfolios,
  ]);

  const selectedPortfolio = useMemo(
    () => publicPortfolios.find((item) => getPortfolioSlug(item) === selectedPortfolioSlug) ?? null,
    [publicPortfolios, selectedPortfolioSlug]
  );

  const selectedPortfolioIndex = useMemo(
    () => publicPortfolios.findIndex((item) => item.id === selectedPortfolio?.id),
    [publicPortfolios, selectedPortfolio]
  );

  const publicArchiveRecords = useMemo(
    () =>
      archiveRecords
        .filter((item) => {
          const visibility = (item.visibility || "published").toLowerCase();
          return adminMode || visibility === "published";
        })
        .sort((a, b) => (a.displayOrder || 9999) - (b.displayOrder || 9999)),
    [adminMode, archiveRecords]
  );

  const filteredArchiveRecords = useMemo(() => {
    const q = archiveSearchQuery.trim().toLowerCase();

    return publicArchiveRecords
      .filter((item) => {
        const typeMatch = archiveTypeFilter === "ALL" || getArchiveType(item) === archiveTypeFilter;
        const categoryMatch = archiveCategoryFilter === "ALL" || getArchiveCategory(item) === archiveCategoryFilter;
        const searchMatch = !q || getArchiveSearchText(item).includes(q);

        return typeMatch && categoryMatch && searchMatch;
      })
      .sort((a, b) => {
        if (archiveSortBy === "TYPE") return getArchiveType(a).localeCompare(getArchiveType(b));
        if (archiveSortBy === "STATUS") return getArchiveStatus(a).localeCompare(getArchiveStatus(b));
        return String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || ""));
      });
  }, [archiveCategoryFilter, archiveSearchQuery, archiveSortBy, archiveTypeFilter, publicArchiveRecords]);

  const selectedArchiveRecord = useMemo(
    () => publicArchiveRecords.find((item) => getArchiveSlug(item) === selectedArchiveSlug) ?? null,
    [publicArchiveRecords, selectedArchiveSlug]
  );

  const selectedArchiveIndex = useMemo(
    () => publicArchiveRecords.findIndex((item) => item.id === selectedArchiveRecord?.id),
    [publicArchiveRecords, selectedArchiveRecord]
  );

  const publicJournals = useMemo(
    () =>
      journals.filter((post) => {
        const visibility = (post.visibility || "published").toLowerCase();
        return adminMode || visibility === "published";
      }),
    [adminMode, journals]
  );

  const journalCategories = useMemo(() => {
    const categories = publicJournals
      .map((post) => post.category?.trim())
      .filter(Boolean) as string[];
    return ["ALL", ...Array.from(new Set(categories))];
  }, [publicJournals]);

  const journalTags = useMemo(() => {
    return Array.from(new Set(publicJournals.flatMap((post) => post.tags))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [publicJournals]);

  const filteredJournals = useMemo(() => {
    const q = journalSearchQuery.trim().toLowerCase();

    return publicJournals.filter((post) => {
      const categoryMatch =
        journalCategoryFilter === "ALL" || post.category === journalCategoryFilter;
      const tagMatch = !journalTagFilter || post.tags.includes(journalTagFilter);
      const searchTarget = [
        post.title,
        post.subtitle || "",
        post.category || "",
        post.tags.join(" "),
        getJournalContent(post),
      ]
        .join(" ")
        .toLowerCase();
      const searchMatch = !q || searchTarget.includes(q);

      return categoryMatch && tagMatch && searchMatch;
    });
  }, [journalCategoryFilter, journalSearchQuery, journalTagFilter, publicJournals]);

  const selectedJournal = useMemo(
    () => publicJournals.find((post) => getJournalSlug(post) === selectedJournalSlug) ?? null,
    [publicJournals, selectedJournalSlug]
  );

  const selectedJournalIndex = useMemo(
    () => publicJournals.findIndex((post) => post.id === selectedJournal?.id),
    [publicJournals, selectedJournal]
  );

  const filteredIssues = useMemo(() => {
    if (issueCategoryFilter === "ALL") return issues;
    return issues.filter((issue) => getIssueCategory(issue) === issueCategoryFilter);
  }, [issueCategoryFilter, issues]);

  const featuredIssue = useMemo(
    () => filteredIssues.find((issue) => issue.isFeatured) ?? filteredIssues[0] ?? null,
    [filteredIssues]
  );

  const findRelatedIssue = (post: JournalPost) => {
    return issues.find((issue, index) => {
      const issueNumber = getIssueNumber(issue, index, issues.length);
      return (
        issue.id === post.relatedIssueId ||
        getIssueNumber(issue, index, issues.length) === String(post.relatedIssueNumber || "").padStart(2, "0") ||
        issueNumber === String(post.relatedIssueNumber || "") ||
        slugify(issue.title) === post.relatedIssueSlug
      );
    });
  };

  const getRelatedJournals = (post: JournalPost) => {
    return publicJournals
      .filter((candidate) => candidate.id !== post.id)
      .map((candidate) => {
        const tagScore = candidate.tags.filter((tag) => post.tags.includes(tag)).length * 3;
        const categoryScore = candidate.category && candidate.category === post.category ? 2 : 0;
        const latestScore = candidate.publishedAt ? new Date(candidate.publishedAt).getTime() / 10000000000000 : 0;
        return { post: candidate, score: tagScore + categoryScore + latestScore };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.post);
  };

  const openJournal = (post: JournalPost) => {
    const slug = getJournalSlug(post);
    setSelectedCategory("journal");
    setSelectedJournalSlug(slug);
    setReadingProgress(0);
    if (typeof window !== "undefined") {
      window.history.pushState({ selectedCategory: "journal", selectedJournalSlug: slug }, "", `/journal/${slug}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeJournalDetail = () => {
    setSelectedJournalSlug(null);
    setReadingProgress(0);
    if (typeof window !== "undefined") {
      window.history.pushState({ selectedCategory: "journal" }, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const updateJournalDraft = <K extends keyof JournalPost>(key: K, value: JournalPost[K]) => {
    setJournalDraft((prev) => ({ ...prev, [key]: value }));
  };

  const resetJournalForm = () => {
    setJournalDraft(getEmptyJournalDraft());
    setEditingJournalId(null);
    setJournalStatus(supabase ? "LIVE JOURNAL READY" : "LOCAL JOURNAL MODE / SUPABASE NOT CONFIGURED");
  };

  const beginEditJournal = (post: JournalPost) => {
    if (!adminMode) return;
    setJournalDraft({
      ...getEmptyJournalDraft(),
      ...post,
      tags: post.tags || [],
      content: post.content || getJournalContent(post),
      excerpt: post.excerpt || getJournalExcerpt(post),
      slug: getJournalSlug(post),
    });
    setEditingJournalId(post.id);
    setJournalFormOpen(true);
    setSelectedJournalSlug(null);
    setReadingProgress(0);
    setJournalStatus(`EDITING ${post.title}`);
    if (typeof window !== "undefined") {
      window.history.pushState({ selectedCategory: "journal" }, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const journalToDbRow = (post: JournalPost) => ({
    title: post.title,
    subtitle: post.subtitle || null,
    slug: getJournalSlug(post),
    excerpt: post.excerpt || getJournalExcerpt(post),
    content: getJournalContent(post),
    cover_image: post.coverImage || null,
    cover_alt: post.coverAlt || null,
    cover_caption: post.coverCaption || null,
    tags: post.tags || [],
    category: post.category || null,
    published_at: post.publishedAt || null,
    updated_at: post.updatedAt || new Date().toISOString(),
    visibility: post.visibility || "draft",
    related_issue_id: post.relatedIssueId || null,
    related_issue_number: post.relatedIssueNumber ? String(post.relatedIssueNumber) : null,
    related_issue_slug: post.relatedIssueSlug || null,
  });

  const handleSaveJournal = async () => {
    if (!adminMode || isSavingJournal) return;
    if (!journalDraft.title.trim()) {
      setJournalStatus("TITLE IS REQUIRED.");
      return;
    }
    if (!getJournalContent(journalDraft).trim()) {
      setJournalStatus("CONTENT IS REQUIRED.");
      return;
    }

    const cleanDraft: JournalPost = {
      ...journalDraft,
      id: editingJournalId || journalDraft.id || `local-${Date.now()}`,
      title: journalDraft.title.trim(),
      subtitle: journalDraft.subtitle?.trim() || undefined,
      slug: journalDraft.slug?.trim() || slugify(journalDraft.title),
      excerpt: journalDraft.excerpt?.trim() || getJournalExcerpt(journalDraft),
      content: getJournalContent(journalDraft).trim(),
      category: journalDraft.category?.trim() || undefined,
      coverImage: journalDraft.coverImage?.trim() || undefined,
      coverAlt: journalDraft.coverAlt?.trim() || undefined,
      coverCaption: journalDraft.coverCaption?.trim() || undefined,
      tags: journalDraft.tags || [],
      publishedAt: journalDraft.publishedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visibility: journalDraft.visibility || "draft",
      relatedIssueNumber: journalDraft.relatedIssueNumber || undefined,
      relatedIssueSlug: journalDraft.relatedIssueSlug?.trim() || undefined,
    };

    setIsSavingJournal(true);
    setJournalStatus(editingJournalId ? "UPDATING JOURNAL..." : "STORING JOURNAL...");

    try {
      const storedRecord =
        editingJournalId && !editingJournalId.startsWith("local-") && !/^j\d+$/i.test(editingJournalId);

      if (supabase) {
        if (storedRecord) {
          const { error } = await supabase
            .from("journals")
            .update(journalToDbRow(cleanDraft))
            .eq("id", editingJournalId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("journals")
            .insert(journalToDbRow(cleanDraft))
            .select("*")
            .single();
          if (error || !data) throw new Error(error?.message || "NO DATA RETURNED");
          cleanDraft.id = data.id;
          cleanDraft.updatedAt = data.updated_at || cleanDraft.updatedAt;
        }
      }

      setJournals((prev) => {
        if (editingJournalId) {
          return prev.map((post) => (post.id === editingJournalId ? cleanDraft : post));
        }
        return [cleanDraft, ...prev];
      });
      resetJournalForm();
      setJournalFormOpen(false);
      setJournalStatus(editingJournalId ? "JOURNAL UPDATED" : "JOURNAL STORED");
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN ERROR";
      setJournalStatus(`JOURNAL SAVE ERROR: ${message}`);
    } finally {
      setIsSavingJournal(false);
    }
  };

  const handleDeleteJournal = async (post: JournalPost) => {
    if (!adminMode) return;
    if (!window.confirm(`DELETE ${post.title}?`)) return;

    try {
      if (supabase && !post.id.startsWith("local-") && !/^j\d+$/i.test(post.id)) {
        const { error } = await supabase.from("journals").delete().eq("id", post.id);
        if (error) throw error;
      }

      setJournals((prev) => prev.filter((item) => item.id !== post.id));
      if (selectedJournal?.id === post.id) closeJournalDetail();
      if (editingJournalId === post.id) resetJournalForm();
      setJournalStatus("JOURNAL DELETED");
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN ERROR";
      setJournalStatus(`JOURNAL DELETE ERROR: ${message}`);
    }
  };

  const findPortfolioRelatedJournal = (item: PortfolioItem) => {
    return publicJournals.find(
      (post) =>
        post.id === item.relatedJournalId ||
        getJournalSlug(post) === item.relatedJournalSlug ||
        post.tags.some((tag) => item.tags.includes(tag))
    );
  };

  const findPortfolioRelatedIssue = (item: PortfolioItem) => {
    return issues.find((issue, index) => {
      const issueNumber = getIssueNumber(issue, index, issues.length);
      return (
        issue.id === item.relatedIssueId ||
        issueNumber === String(item.relatedIssueNumber || "").padStart(2, "0") ||
        issueNumber === String(item.relatedIssueNumber || "") ||
        item.tags.some((tag) => issue.tags.includes(tag))
      );
    });
  };

  const getPortfolioRelatedArchives = (item: PortfolioItem) => {
    const explicitIds = item.relatedArchiveIds || [];
    return references
      .filter(
        (reference) =>
          explicitIds.includes(reference.id) ||
          reference.tags.some((tag) => item.tags.includes(tag)) ||
          (item.skills || []).some((skill) => reference.tags.includes(skill.toLowerCase()))
      )
      .slice(0, 3);
  };

  const openPortfolio = (item: PortfolioItem) => {
    const slug = getPortfolioSlug(item);
    setSelectedCategory("portfolio");
    setSelectedPortfolioSlug(slug);
    if (typeof window !== "undefined") {
      window.history.pushState({ selectedCategory: "portfolio", selectedPortfolioSlug: slug }, "", `/portfolio/${slug}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closePortfolioDetail = () => {
    setSelectedPortfolioSlug(null);
    if (typeof window !== "undefined") {
      window.history.pushState({ selectedCategory: "portfolio" }, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const openArchiveFile = (item: ArchiveFileItem) => {
    const slug = getArchiveSlug(item);
    setSelectedCategory("archive");
    setSelectedArchiveSlug(slug);
    setExpandedArchiveSection(null);
    if (typeof window !== "undefined") {
      window.history.pushState({ selectedCategory: "archive", selectedArchiveSlug: slug }, "", `/archive/${slug}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeArchiveFile = () => {
    setSelectedArchiveSlug(null);
    setExpandedArchiveSection(null);
    if (typeof window !== "undefined") {
      window.history.pushState({ selectedCategory: "archive" }, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const updatePortfolioDraft = <K extends keyof PortfolioItem>(key: K, value: PortfolioItem[K]) => {
    setPortfolioDraft((prev) => ({ ...prev, [key]: value }));
  };

  const resetPortfolioForm = () => {
    setPortfolioDraft(getEmptyPortfolioDraft());
    setPortfolioUploadFiles([]);
    setEditingPortfolioId(null);
    setPortfolioStatus(supabase ? "LIVE PORTFOLIO READY" : "LOCAL PORTFOLIO MODE / SUPABASE NOT CONFIGURED");
  };

  const beginEditPortfolio = (item: PortfolioItem) => {
    if (!adminMode) return;
    setPortfolioDraft({
      ...getEmptyPortfolioDraft(),
      ...item,
      tags: item.tags || [],
      skills: item.skills || [],
      contribution: getPortfolioContribution(item),
      gallery: item.gallery || [],
      attachments: item.attachments || [],
    });
    setPortfolioUploadFiles([]);
    setEditingPortfolioId(item.id);
    setPortfolioFormOpen(true);
    setSelectedPortfolioSlug(null);
    setPortfolioStatus(`EDITING ${item.title}`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const portfolioToDbRow = (item: PortfolioItem) => ({
    portfolio_number: item.portfolioNumber ? String(item.portfolioNumber) : null,
    title: item.title,
    subtitle: item.subtitle || null,
    description: item.description || null,
    cover_image: item.coverImage || null,
    cover_alt: item.coverAlt || null,
    category: item.category || null,
    tags: item.tags || [],
    status: item.status || "archived",
    project_type: item.projectType || null,
    client: item.client || null,
    project_period: item.projectPeriod || null,
    archived_date: item.archivedDate || null,
    slug: getPortfolioSlug(item),
    is_featured: Boolean(item.isFeatured),
    display_order: item.displayOrder || null,
    role: item.role || null,
    contribution: getPortfolioContribution(item),
    skills: item.skills || [],
    overview: item.overview || null,
    background: item.background || null,
    problem: item.problem || null,
    goal: item.goal || null,
    research: item.research || null,
    insight: item.insight || null,
    strategy: item.strategy || null,
    planning: item.planning || null,
    process: item.process || null,
    execution: item.execution || null,
    outcome: item.outcome || null,
    reflection: item.reflection || null,
    gallery: item.gallery || [],
    attachment: item.attachment || null,
    attachments: item.attachments || [],
    related_journal_id: item.relatedJournalId || null,
    related_journal_slug: item.relatedJournalSlug || null,
    related_issue_id: item.relatedIssueId || null,
    related_issue_number: item.relatedIssueNumber ? String(item.relatedIssueNumber) : null,
    related_archive_ids: item.relatedArchiveIds || [],
    visibility: item.visibility || "draft",
  });

  const uploadPortfolioFiles = async (files: File[], slug: string) => {
    if (!supabase || files.length === 0) return [];

    const uploadedFiles: NonNullable<PortfolioItem["attachments"]> = [];

    for (const [index, file] of files.entries()) {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `portfolios/${slug}/${Date.now()}-${index}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("reference-media")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("reference-media")
        .getPublicUrl(storagePath);

      uploadedFiles.push({
        url: publicUrlData.publicUrl,
        label: file.name,
        type: file.type || "FILE",
        size: formatFileSize(file.size),
        storagePath,
      });
    }

    return uploadedFiles;
  };

  const handleSavePortfolio = async () => {
    if (!adminMode || isSavingPortfolio) return;
    if (!portfolioDraft.title.trim()) {
      setPortfolioStatus("TITLE IS REQUIRED.");
      return;
    }

    const cleanDraft: PortfolioItem = {
      ...portfolioDraft,
      id: editingPortfolioId || portfolioDraft.id || `local-${Date.now()}`,
      title: portfolioDraft.title.trim(),
      description: portfolioDraft.description?.trim() || portfolioDraft.overview?.trim() || "",
      slug: portfolioDraft.slug?.trim() || slugify(portfolioDraft.title),
      updatedAt: new Date().toISOString(),
    };

    setIsSavingPortfolio(true);
    setPortfolioStatus(editingPortfolioId ? "UPDATING PORTFOLIO..." : "STORING PORTFOLIO...");

    try {
      if (portfolioUploadFiles.length > 0 && !supabase) {
        throw new Error("SUPABASE STORAGE IS REQUIRED FOR FILE UPLOAD.");
      }

      const uploadedFiles = await uploadPortfolioFiles(portfolioUploadFiles, cleanDraft.slug || cleanDraft.id);
      const uploadedImages = uploadedFiles.filter((file) => (file.type || "").startsWith("image/"));

      if (uploadedFiles.length > 0) {
        cleanDraft.attachments = [...(cleanDraft.attachments || []), ...uploadedFiles];
        cleanDraft.gallery = [
          ...(cleanDraft.gallery || []),
          ...uploadedImages.map((file) => ({
            src: file.url,
            alt: file.label || cleanDraft.title,
            caption: file.label,
          })),
        ];
        cleanDraft.attachment = cleanDraft.attachment?.url
          ? cleanDraft.attachment
          : uploadedFiles.find((file) => !(file.type || "").startsWith("image/")) || uploadedFiles[0];
        if (!cleanDraft.coverImage && uploadedImages[0]) {
          cleanDraft.coverImage = uploadedImages[0].url;
          cleanDraft.coverAlt = uploadedImages[0].label || `${cleanDraft.title} cover image`;
        }
      }

      const storedRecord =
        editingPortfolioId && !editingPortfolioId.startsWith("local-") && !/^p\d+$/i.test(editingPortfolioId);

      if (supabase) {
        if (storedRecord) {
          const { error } = await supabase
            .from("portfolios")
            .update(portfolioToDbRow(cleanDraft))
            .eq("id", editingPortfolioId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("portfolios")
            .insert(portfolioToDbRow(cleanDraft))
            .select("*")
            .single();
          if (error || !data) throw new Error(error?.message || "NO DATA RETURNED");
          cleanDraft.id = data.id;
          cleanDraft.createdAt = data.created_at || cleanDraft.createdAt;
          cleanDraft.updatedAt = data.updated_at || cleanDraft.updatedAt;
        }
      }

      setPortfolios((prev) => {
        if (editingPortfolioId) {
          return prev.map((item) => (item.id === editingPortfolioId ? cleanDraft : item));
        }
        return [cleanDraft, ...prev];
      });
      resetPortfolioForm();
      setPortfolioFormOpen(false);
      setPortfolioStatus(editingPortfolioId ? "PORTFOLIO UPDATED" : "PORTFOLIO STORED");
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN ERROR";
      setPortfolioStatus(`PORTFOLIO SAVE ERROR: ${message}`);
    } finally {
      setIsSavingPortfolio(false);
    }
  };

  const handleDeletePortfolio = async (item: PortfolioItem) => {
    if (!adminMode) return;
    if (!window.confirm(`DELETE ${item.title}?`)) return;

    try {
      if (supabase && !item.id.startsWith("local-") && !/^p\d+$/i.test(item.id)) {
        const { error } = await supabase.from("portfolios").delete().eq("id", item.id);
        if (error) throw error;
      }

      setPortfolios((prev) => prev.filter((portfolio) => portfolio.id !== item.id));
      if (selectedPortfolio?.id === item.id) closePortfolioDetail();
      if (editingPortfolioId === item.id) resetPortfolioForm();
      setPortfolioStatus("PORTFOLIO DELETED");
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN ERROR";
      setPortfolioStatus(`PORTFOLIO DELETE ERROR: ${message}`);
    }
  };

  const handleAdminLogin = async () => {
    if (!supabase) {
      setAdminStatus("SUPABASE AUTH IS NOT CONFIGURED.");
      return;
    }

    if (!adminEmail.trim() || !adminInput) {
      setAdminStatus("EMAIL AND PASSWORD ARE REQUIRED.");
      return;
    }

    setIsAuthenticating(true);
    setAdminStatus("VERIFYING ADMIN SESSION...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminInput,
    });

    if (error) {
      setAdminStatus(`LOGIN ERROR: ${error.message}`);
      setIsAuthenticating(false);
      return;
    }

    if (!isAdminSession(data.session)) {
      await supabase.auth.signOut();
      setAdminStatus("ACCESS DENIED: ADMIN ROLE REQUIRED.");
      setIsAuthenticating(false);
      return;
    }

    setAdminMode(true);
    setAdminEmail("");
    setAdminInput("");
    setAdminStatus("");
    setTagQuery("");
    setSearchOpen(false);
    setIsAuthenticating(false);
  };

  const handleAdminLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setAdminMode(false);
    setAddReferenceOpen(false);
    setIssueFormOpen(false);
    setJournalFormOpen(false);
    setPortfolioFormOpen(false);
    setEditingReferenceId(null);
    setEditingJournalId(null);
    setEditingPortfolioId(null);
    setSelectMode(false);
    setSelectedReferenceIds([]);
    setReferenceStatus("");
    setTagQuery("");
    setSearchOpen(false);
  };

  const resetIssueForm = () => {
    setNewIssueTitle("");
    setNewIssueLink("");
    setNewIssueHandle("@daf.tmp");
    setNewIssueTags("");
    setNewIssueFile(null);
    setNewIssuePreview("");
    setIssueStatus("");
  };

  const handleIssueFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setIssueStatus("COVER MUST BE AN IMAGE FILE.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setIssueStatus("COVER MUST BE 10MB OR SMALLER.");
      return;
    }

    setNewIssueFile(file);
    setNewIssuePreview(URL.createObjectURL(file));
    setIssueStatus("COVER READY");
  };

  const handleAddIssue = async () => {
    if (!adminMode || isSavingIssue) return;
    if (!supabase) {
      setIssueStatus("SUPABASE IS NOT CONFIGURED.");
      return;
    }
    if (!newIssueTitle.trim() || !newIssueLink.trim() || !newIssueFile) {
      setIssueStatus("TITLE, INSTAGRAM POST URL, AND COVER ARE REQUIRED.");
      return;
    }

    try {
      const parsedUrl = new URL(newIssueLink.trim());
      const isInstagramUrl =
        parsedUrl.hostname === "instagram.com" ||
        parsedUrl.hostname.endsWith(".instagram.com");
      if (!isInstagramUrl) {
        setIssueStatus("USE A VALID INSTAGRAM POST URL.");
        return;
      }
    } catch {
      setIssueStatus("USE A VALID INSTAGRAM POST URL.");
      return;
    }

    setIsSavingIssue(true);
    setIssueStatus("UPLOADING ISSUE...");

    const safeFileName = newIssueFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `issues/${Date.now()}-${safeFileName}`;
    let coverUploaded = false;

    try {
      const { error: uploadError } = await supabase.storage
        .from("reference-media")
        .upload(storagePath, newIssueFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: newIssueFile.type,
        });

      if (uploadError) throw uploadError;
      coverUploaded = true;

      const { data: publicUrlData } = supabase.storage
        .from("reference-media")
        .getPublicUrl(storagePath);

      const savedIssue: IssueItem = {
        id: `local-${Date.now()}`,
        title: newIssueTitle.trim(),
        link: newIssueLink.trim(),
        instagramUrl: newIssueLink.trim(),
        category: parseTags(newIssueTags).find((tag) =>
          issueCategoryFilters.includes(tag.trim().toUpperCase() as IssueCategoryFilter)
        ),
        publishedAt: new Date().toISOString(),
        thumbnailSrc: publicUrlData.publicUrl,
        thumbnailUrl: publicUrlData.publicUrl,
        instagramHandle: newIssueHandle.trim() || "@daf.tmp",
        tags: parseTags(newIssueTags),
        storagePath,
      };

      const { data, error } = await supabase
        .from("issues")
        .insert({
          title: savedIssue.title,
          link: savedIssue.link,
          instagram_url: savedIssue.instagramUrl,
          category: savedIssue.category || null,
          published_at: savedIssue.publishedAt,
          thumbnail_src: savedIssue.thumbnailSrc,
          thumbnail_url: savedIssue.thumbnailUrl,
          instagram_handle: savedIssue.instagramHandle,
          tags: savedIssue.tags,
          storage_path: storagePath,
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "NO DATA RETURNED");
      }

      savedIssue.id = data.id;
      setIssues((prev) => [savedIssue, ...prev]);
      resetIssueForm();
      setIssueFormOpen(false);
      setIssueStatus("ISSUE STORED");
    } catch (error) {
      if (coverUploaded) {
        await supabase.storage.from("reference-media").remove([storagePath]);
      }
      const message = error instanceof Error ? error.message : "UNKNOWN ERROR";
      setIssueStatus(`ISSUE SAVE ERROR: ${message}`);
    } finally {
      setIsSavingIssue(false);
    }
  };

  const handleDeleteIssue = async (issue: IssueItem) => {
    if (!adminMode || !window.confirm(`DELETE ${issue.title}?`)) return;
    let cleanupError = "";

    if (supabase && !issue.id.startsWith("i") && !issue.id.startsWith("local-")) {
      const { error } = await supabase.from("issues").delete().eq("id", issue.id);
      if (error) {
        setIssueStatus(`ISSUE DELETE ERROR: ${error.message}`);
        return;
      }

      if (issue.storagePath) {
        const { error: storageError } = await supabase.storage
          .from("reference-media")
          .remove([issue.storagePath]);
        if (storageError) {
          cleanupError = storageError.message;
        }
      }
    }

    setIssues((prev) => prev.filter((item) => item.id !== issue.id));
    setIssueStatus(
      cleanupError
        ? `ISSUE DELETED / COVER CLEANUP ERROR: ${cleanupError}`
        : "ISSUE DELETED"
    );
  };

  const handleFreeboardSubmit = async () => {
    if (!freeboardContent.trim() || isSubmittingFreeboard) return;
    if (freeboardContent.trim().length > 600) {
      setFreeboardStatus("MESSAGE MUST BE 600 CHARACTERS OR LESS.");
      return;
    }

    setIsSubmittingFreeboard(true);
    setFreeboardStatus("SUBMITTING...");
    const layout = createFreeboardLayoutSeed(`${Date.now()}-${freeboardContent.trim()}-${freeboardName.trim()}`);

    const newPost: FreeboardPost = {
      id: `local-${Date.now()}`,
      name: freeboardAnonymous ? "Anonymous" : freeboardName.trim() || "Unknown",
      content: freeboardContent.trim(),
      isAnonymous: freeboardAnonymous,
      date: new Date().toLocaleString(),
      tags: parseTags(freeboardTags),
      x: layout.x,
      y: layout.y,
      rotation: layout.rotation,
      size: layout.size,
      visibility: "published",
      createdAt: new Date().toISOString(),
    };

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("freeboard_posts")
          .insert({
            name: newPost.name,
            content: newPost.content,
            is_anonymous: newPost.isAnonymous,
            tags: newPost.tags,
            x: newPost.x,
            y: newPost.y,
            rotation: newPost.rotation,
            size: newPost.size,
            visibility: newPost.visibility,
          })
          .select("*")
          .single();

        if (error || !data) {
          throw new Error(error?.message || "NO DATA RETURNED");
        }

        newPost.id = data.id;
        newPost.date = data.created_at
          ? new Date(data.created_at).toLocaleString()
          : newPost.date;
      }

      setFreeboardPosts((prev) => [newPost, ...prev]);
      setFreeboardName("");
      setFreeboardContent("");
      setFreeboardTags("");
      setFreeboardAnonymous(false);
      setFreeboardWriteOpen(false);
      setFreeboardStatus("POST STORED");
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN ERROR";
      setFreeboardStatus(`SUBMIT ERROR: ${message}`);
    } finally {
      setIsSubmittingFreeboard(false);
    }
  };

  const handleFreeboardDelete = async (id: string) => {
    if (!adminMode) return;
    if (!window.confirm("DELETE THIS FREEBOARD POST?")) return;

    if (supabase && !id.startsWith("local-")) {
      const { error } = await supabase.from("freeboard_posts").delete().eq("id", id);
      if (error) {
        setFreeboardStatus(`DELETE ERROR: ${error.message}`);
        return;
      }
    }

    setFreeboardPosts((prev) => prev.filter((post) => post.id !== id));
    setFreeboardStatus("POST DELETED");
  };

  const handleFreeboardVisibility = async (post: FreeboardPost, visibility: "published" | "hidden") => {
    if (!adminMode) return;

    if (supabase && !post.id.startsWith("local-")) {
      const { error } = await supabase
        .from("freeboard_posts")
        .update({ visibility })
        .eq("id", post.id);
      if (error) {
        setFreeboardStatus(`VISIBILITY ERROR: ${error.message}`);
        return;
      }
    }

    setFreeboardPosts((prev) =>
      prev.map((item) => (item.id === post.id ? { ...item, visibility } : item))
    );
    setFreeboardStatus(visibility === "hidden" ? "TRACE HIDDEN" : "TRACE PUBLISHED");
  };

  const beginEditReference = (item: ReferenceItem) => {
    if (!adminMode) return;

    setEditingReferenceId(item.id);
    setNewRefTitle(item.title);
    setNewRefMainTag(item.mainTag);
    setNewRefType(item.type);
    setNewRefSrc(item.src);
    setNewRefTags(item.tags.join(", "));
    setNewRefLocation(item.location || "");
    setNewRefDate(item.date || "");
    setNewRefMemo(item.memo);
    setNewRefNoticed(item.noticed || "");
    setNewRefPossibleUse(item.possibleUse || "");
    setNewRefFile(null);
    setNewRefFiles([]);
    setAddReferenceOpen(true);
  };

  const resetReferenceForm = () => {
    setNewRefTitle("");
    setNewRefMainTag("DAF_life");
    setNewRefType("image");
    setNewRefSrc("");
    setNewRefTags("");
    setNewRefLocation("");
    setNewRefDate("");
    setNewRefMemo("");
    setNewRefNoticed("");
    setNewRefPossibleUse("");
    setNewRefFile(null);
    setNewRefFiles([]);
    setEditingReferenceId(null);
    setReferenceStatus("");
  };

  const applySelectedFiles = (files: File[]) => {
    if (files.length === 0) return;

    const firstFile = files[0];
    const previewUrl = URL.createObjectURL(firstFile);

    setNewRefFiles(files);
    setNewRefFile(firstFile);
    setNewRefSrc(previewUrl);

    if (firstFile.type.startsWith("video/")) {
      setNewRefType("video");
    } else {
      setNewRefType("image");
    }

    setReferenceStatus(
      files.length > 1
        ? `${files.length} FILES READY / MULTI UPLOAD`
        : "1 FILE READY"
    );
  };

  const handleMediaFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    applySelectedFiles(files);
  };

  const handleMediaDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []).filter((file) =>
      file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    applySelectedFiles(files);
  };

  const getAutoStoragePath = (file: File, index = 0) => {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeTitle = (newRefTitle.trim() || "untitled")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 48);
    return `${newRefMainTag}/${Date.now()}-${index}-${safeTitle}-${safeFileName}`;
  };

  const uploadReferenceFile = async (file?: File, index = 0) => {
    const targetFile = file || newRefFile;

    if (!targetFile) {
      return { publicUrl: newRefSrc.trim(), storagePath: undefined as string | undefined };
    }

    if (!supabase) {
      throw new Error("Supabase is not configured. Check .env.local.");
    }

    const storagePath = getAutoStoragePath(targetFile, index);

    const { error: uploadError } = await supabase.storage
      .from("reference-media")
      .upload(storagePath, targetFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: targetFile.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("reference-media").getPublicUrl(storagePath);

    return { publicUrl: data.publicUrl, storagePath };
  };

  const saveOneReference = async ({
    file,
    index,
    total,
  }: {
    file: File | undefined;
    index: number;
    total: number;
  }) => {
    const current = references.find((item) => item.id === editingReferenceId);
    const uploaded = await uploadReferenceFile(file, index);
    const inferredType: "image" | "video" =
      file?.type.startsWith("video/") || newRefType === "video" ? "video" : "image";

    const savedReference: ReferenceItem = {
      id: editingReferenceId || `local-${Date.now()}-${index}`,
      title:
        total > 1
          ? `${newRefTitle.trim()}_${String(index + 1).padStart(2, "0")}`
          : newRefTitle.trim(),
      mainTag: newRefMainTag,
      type: inferredType,
      src: uploaded.publicUrl,
      tags: parseTags(newRefTags),
      location: newRefLocation.trim() || undefined,
      date: newRefDate.trim() || undefined,
      memo: newRefMemo.trim() || "stored without note.",
      noticed: newRefNoticed.trim() || undefined,
      possibleUse: newRefPossibleUse.trim() || undefined,
      storagePath: uploaded.storagePath || current?.storagePath,
    };

    try {
      if (supabase) {
        if (editingReferenceId && !editingReferenceId.startsWith("r") && !editingReferenceId.startsWith("local-")) {
          const { error } = await supabase
            .from("references")
            .update({
              title: savedReference.title,
              main_tag: savedReference.mainTag,
              tags: savedReference.tags,
              type: savedReference.type,
              src: savedReference.src,
              memo: savedReference.memo,
              location: savedReference.location || null,
              date: savedReference.date || null,
              noticed: savedReference.noticed || null,
              possible_use: savedReference.possibleUse || null,
              storage_path: savedReference.storagePath || null,
            })
            .eq("id", editingReferenceId);

          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("references")
            .insert({
              title: savedReference.title,
              main_tag: savedReference.mainTag,
              tags: savedReference.tags,
              type: savedReference.type,
              src: savedReference.src,
              memo: savedReference.memo,
              location: savedReference.location || null,
              date: savedReference.date || null,
              noticed: savedReference.noticed || null,
              possible_use: savedReference.possibleUse || null,
              storage_path: savedReference.storagePath || null,
            })
            .select("*")
            .single();

          if (error) throw error;
          if (data) {
            savedReference.id = data.id;
          }
        }
      }
    } catch (error) {
      if (uploaded.storagePath && supabase) {
        await supabase.storage.from("reference-media").remove([uploaded.storagePath]);
      }
      throw error;
    }

    if (
      file &&
      current?.storagePath &&
      uploaded.storagePath &&
      current.storagePath !== uploaded.storagePath &&
      supabase
    ) {
      await supabase.storage.from("reference-media").remove([current.storagePath]);
    }

    return savedReference;
  };

  const rollbackCreatedReferences = async (entries: ReferenceItem[]) => {
    if (!supabase || entries.length === 0) return;

    const databaseIds = entries
      .map((item) => item.id)
      .filter((id) => !id.startsWith("local-") && !id.startsWith("r"));
    const storagePaths = entries
      .map((item) => item.storagePath)
      .filter((path): path is string => Boolean(path));

    if (databaseIds.length > 0) {
      const { error } = await supabase.from("references").delete().in("id", databaseIds);
      if (error) throw error;
    }

    if (storagePaths.length > 0) {
      const { error } = await supabase.storage.from("reference-media").remove(storagePaths);
      if (error) throw error;
    }
  };

  const handleAddReference = async () => {
    const hasFile = newRefFiles.length > 0 || Boolean(newRefFile);
    if (!adminMode || !newRefTitle.trim() || (!newRefSrc.trim() && !hasFile)) return;

    const filesToSave: File[] =
      editingReferenceId || newRefFiles.length === 0
        ? newRefFile
          ? [newRefFile]
          : []
        : newRefFiles;

    const saveTargets: Array<File | undefined> =
      filesToSave.length > 0 ? filesToSave : [undefined];

    setIsSavingReference(true);
    setReferenceStatus(
      editingReferenceId
        ? "UPDATING ENTRY..."
        : saveTargets.length > 1
          ? `UPLOADING ${saveTargets.length} ENTRIES...`
          : "UPLOADING ENTRY..."
    );

    const savedEntries: ReferenceItem[] = [];

    try {
      for (let index = 0; index < saveTargets.length; index += 1) {
        setReferenceStatus(
          saveTargets.length > 1
            ? `UPLOADING ${index + 1}/${saveTargets.length}...`
            : editingReferenceId
              ? "UPDATING ENTRY..."
              : "UPLOADING ENTRY..."
        );

        const saved = await saveOneReference({
          file: saveTargets[index],
          index,
          total: saveTargets.length,
        });

        savedEntries.push(saved);
      }

      if (editingReferenceId) {
        const savedReference = savedEntries[0];
        setReferences((prev) =>
          prev.map((item) => (item.id === editingReferenceId ? savedReference : item))
        );
        setActiveMainTag(savedReference.mainTag);
        setSelectedReferenceId(savedReference.id);
      } else {
        setReferences((prev) => [...savedEntries, ...prev]);
        setActiveMainTag(savedEntries[0].mainTag);
        setSelectedReferenceId(savedEntries[0].id);
      }

      resetReferenceForm();
      setAddReferenceOpen(false);
      setReferenceStatus(
        savedEntries.length > 1
          ? `${savedEntries.length} ENTRIES STORED`
          : "ENTRY STORED"
      );
    } catch (error) {
      if (!editingReferenceId) {
        try {
          await rollbackCreatedReferences(savedEntries);
        } catch {
          setReferenceStatus("SAVE ERROR / AUTOMATIC ROLLBACK INCOMPLETE");
          setIsSavingReference(false);
          return;
        }
      }
      const message = error instanceof Error ? error.message : "UNKNOWN ERROR";
      setReferenceStatus(`SAVE ERROR: ${message}`);
    } finally {
      setIsSavingReference(false);
    }
  };

  const toggleReferenceSelection = (id: string) => {
    setSelectedReferenceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleReferenceDelete = async (id: string) => {
    if (!adminMode) return;
    if (!window.confirm("DELETE THIS REFERENCE ENTRY?")) return;

    const target = references.find((item) => item.id === id);
    let cleanupError = "";

    if (supabase && target && !id.startsWith("r") && !id.startsWith("local-")) {
      const { error } = await supabase.from("references").delete().eq("id", id);
      if (error) {
        setReferenceStatus(`DELETE ERROR: ${error.message}`);
        return;
      }

      if (target.storagePath) {
        const { error: storageError } = await supabase.storage
          .from("reference-media")
          .remove([target.storagePath]);
        if (storageError) {
          cleanupError = storageError.message;
        }
      }
    }

    setReferences((prev) => prev.filter((item) => item.id !== id));
    if (selectedReferenceId === id) setSelectedReferenceId(null);
    setSelectedReferenceIds((prev) => prev.filter((item) => item !== id));
    setReferenceStatus(
      cleanupError
        ? `ENTRY DELETED / MEDIA CLEANUP ERROR: ${cleanupError}`
        : "ENTRY DELETED"
    );
  };

  const handleBulkDeleteReferences = async () => {
    if (!adminMode || selectedReferenceIds.length === 0) return;
    if (!window.confirm(`DELETE ${selectedReferenceIds.length} SELECTED ENTRIES?`)) return;

    const targets = references.filter((item) => selectedReferenceIds.includes(item.id));
    let cleanupError = "";
    const databaseIds = targets
      .map((item) => item.id)
      .filter((id) => !id.startsWith("r") && !id.startsWith("local-"));
    const storagePaths = targets
      .map((item) => item.storagePath)
      .filter((path): path is string => Boolean(path));

    if (supabase && databaseIds.length > 0) {
      const { error } = await supabase.from("references").delete().in("id", databaseIds);
      if (error) {
        setReferenceStatus(`DELETE ERROR: ${error.message}`);
        return;
      }

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("reference-media")
          .remove(storagePaths);
        if (storageError) {
          cleanupError = storageError.message;
        }
      }
    }

    setReferences((prev) =>
      prev.filter((item) => !selectedReferenceIds.includes(item.id))
    );

    if (selectedReferenceId && selectedReferenceIds.includes(selectedReferenceId)) {
      setSelectedReferenceId(null);
    }

    setSelectedReferenceIds([]);
    setSelectMode(false);
    setReferenceStatus(
      cleanupError
        ? `ENTRIES DELETED / MEDIA CLEANUP ERROR: ${cleanupError}`
        : "SELECTED ENTRIES DELETED"
    );
  };

  const renderAddReferenceForm = () => (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="border border-black bg-white p-4"
    >
      <div className={`mb-4 text-[12px] tracking-[0.24em] ${orbitron.className}`}>
        {editingReferenceId ? "EDIT ENTRY / ADMIN CONTROL" : "NEW ENTRY / ADMIN REGISTER"}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input value={newRefTitle} onChange={(e) => setNewRefTitle(e.target.value)} placeholder="ENTRY TITLE" className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none" />
        <div className="grid gap-2">
          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleMediaDrop}
            className="border border-black/20 px-3 py-3 text-[11px] tracking-[0.12em] text-neutral-500 transition hover:border-black"
          >
            <span className="block pb-1 text-[9px] tracking-[0.18em] text-neutral-400">
              UPLOAD FILE / DRAG DROP
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleMediaFileChange}
              className="block w-full text-[10px] tracking-[0.08em]"
            />
            {newRefFiles.length > 1 && (
              <span className="mt-2 block text-[9px] tracking-[0.14em] text-neutral-400">
                {newRefFiles.length} FILES SELECTED
              </span>
            )}
          </label>

          <input
            value={newRefSrc}
            onChange={(e) => setNewRefSrc(e.target.value)}
            placeholder="MEDIA URL OR /FILE-NAME"
            className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none"
          />
        </div>

        <select value={newRefMainTag} onChange={(e) => setNewRefMainTag(e.target.value as MainReferenceTag)} className="border border-black/20 bg-white px-3 py-2 text-[11px] tracking-[0.12em] outline-none">
          {referenceMainTags.map((tag) => (
            <option key={tag} value={tag}>#{tag}</option>
          ))}
        </select>

        <select value={newRefType} onChange={(e) => setNewRefType(e.target.value as "image" | "video")} className="border border-black/20 bg-white px-3 py-2 text-[11px] tracking-[0.12em] outline-none">
          <option value="image">IMAGE</option>
          <option value="video">VIDEO</option>
        </select>

        <input value={newRefTags} onChange={(e) => setNewRefTags(e.target.value)} placeholder="SECONDARY TAGS, COMMA SEPARATED" className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none" />
        <input value={newRefLocation} onChange={(e) => setNewRefLocation(e.target.value)} placeholder="SOURCE / LOCATION" className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none" />
        <input
          value={newRefDate}
          onChange={(e) => setNewRefDate(e.target.value)}
          type="date"
          className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none"
        />
        <input value={newRefNoticed} onChange={(e) => setNewRefNoticed(e.target.value)} placeholder="NOTICED" className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none" />
        <input value={newRefPossibleUse} onChange={(e) => setNewRefPossibleUse(e.target.value)} placeholder="POSSIBLE USE" className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none md:col-span-2" />
        <textarea value={newRefMemo} onChange={(e) => setNewRefMemo(e.target.value)} placeholder="NOTE / OBSERVATION LOG" className="min-h-[90px] border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none md:col-span-2" />
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={handleAddReference} className="border border-black bg-black px-4 py-2 text-[11px] tracking-[0.18em] text-white">{isSavingReference ? "SAVING" : editingReferenceId ? "SAVE" : "REGISTER"}</button>
        <button onClick={resetReferenceForm} className="border border-black/20 px-4 py-2 text-[11px] tracking-[0.18em]">RESET</button>
      </div>

      {referenceStatus && (
        <div className="mt-3 text-[10px] tracking-[0.14em] text-neutral-500">
          {referenceStatus}
        </div>
      )}
    </motion.div>
  );
  const renderReferenceFolderView = () => (
    <div className="relative space-y-8">      <div className="relative flex flex-col gap-4 border-b border-black/25 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className={`text-[15px] tracking-[0.34em] ${orbitron.className}`}>REFERENCES</h2>
          <p className="mt-3 max-w-2xl text-[11px] leading-6 tracking-[0.08em] text-neutral-600">
            VISUAL MEMORY DATABASE / SELECT MAIN FILE INDEX TO OPEN STORED ENTRIES.
          </p>
          <p className="mt-2 text-[9px] tracking-[0.12em] text-neutral-400">
            {referenceLoadStatus}
          </p>
        </div>

        {adminMode && (
          <button onClick={() => { if (addReferenceOpen) resetReferenceForm(); setAddReferenceOpen((prev) => !prev); }} className="border border-black px-4 py-2 text-[11px] tracking-[0.18em] transition hover:bg-black hover:text-white">
            {addReferenceOpen ? "CLOSE ENTRY" : "NEW ENTRY"}
          </button>
        )}
      </div>

      <AnimatePresence>{addReferenceOpen && renderAddReferenceForm()}</AnimatePresence>

      <div className="relative grid grid-cols-2 gap-px bg-black/30 md:grid-cols-4">
        {referenceMainTags.map((tag, index) => {
          const count = references.filter((item) => item.mainTag === tag).length;

          return (
            <motion.button
              key={tag}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.025 }}
              whileHover={{ y: -2 }}
              onClick={() => {
                setActiveMainTag(tag);
                setSelectedReferenceId(null);
                setSelectMode(false);
                setSelectedReferenceIds([]);
              }}
              className="group relative min-h-[150px] overflow-hidden bg-white p-4 text-left transition hover:bg-black hover:text-white"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-black/50 opacity-0 transition group-hover:translate-y-[120px] group-hover:opacity-100 group-hover:duration-700" />
              <div className="absolute right-3 top-3 text-[10px] tracking-[0.18em] text-neutral-400 group-hover:text-white/50">FILE_{String(index + 1).padStart(2, "0")}</div>
              <div className={`mt-9 text-[13px] tracking-[0.18em] ${orbitron.className}`}>#{tag}</div>
              <div className="mt-3 min-h-[34px] max-w-[92%] text-[9px] leading-4 tracking-[0.12em] text-neutral-500 group-hover:text-white/55">{tagDescriptions[tag]}</div>
              <div className="mt-5 text-[10px] tracking-[0.2em] text-neutral-500 group-hover:text-white/60">{String(count).padStart(3, "0")} ENTRIES</div>
              <div className="mt-2 text-[10px] tracking-[0.2em] text-neutral-400 group-hover:text-white/50">STATUS : INDEXED</div>
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-black transition-all group-hover:w-full group-hover:bg-white" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  const renderReferenceArchiveView = () => {
    if (!activeMainTag) return null;

    return (
      <div className="relative space-y-8">        <div className="relative flex flex-col gap-4 border-b border-black/25 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <button
              onClick={() => {
                setActiveMainTag(null);
                setSelectedReferenceId(null);
                setSelectMode(false);
                setSelectedReferenceIds([]);
              }}
              className="mb-3 text-[10px] tracking-[0.2em] text-neutral-500 transition hover:text-black"
            >
              REFERENCES / INDEX / BACK
            </button>

            <h2 className={`text-[15px] tracking-[0.34em] ${orbitron.className}`}>#{activeMainTag}</h2>
            <p className="mt-3 max-w-2xl text-[11px] leading-6 tracking-[0.12em] text-neutral-500">
              {String(activeReferences.length).padStart(3, "0")} ENTRIES / ACTIVE FILE / {tagDescriptions[activeMainTag]}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["latest", "oldest", "title", "random"] as const).map((sort) => (
              <button
                key={sort}
                onClick={() => {
                  setReferenceSort(sort);
                  if (sort === "random") setRandomSeed((prev) => prev + 1);
                }}
                className={`border px-3 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white ${
                  referenceSort === sort ? "border-black bg-black text-white" : "border-black/30"
                }`}
              >
                {sort.toUpperCase()}
              </button>
            ))}

            {adminMode && (
              <>
                <button onClick={() => { if (addReferenceOpen) resetReferenceForm(); setAddReferenceOpen((prev) => !prev); }} className="border border-black/30 px-3 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white">NEW ENTRY</button>
                <button
                  onClick={() => {
                    setSelectMode((prev) => !prev);
                    setSelectedReferenceIds([]);
                  }}
                  className="border border-black/30 px-3 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white"
                >
                  {selectMode ? "CANCEL SELECT" : "SELECT"}
                </button>
              </>
            )}
          </div>
        </div>

        <AnimatePresence>{addReferenceOpen && renderAddReferenceForm()}</AnimatePresence>

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {activeReferences.map((item, index) => {
                const isSelected = selectedReferenceIds.includes(item.id);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.035 }}
                    className={`group relative border border-black/25 bg-white ${isSelected ? "outline outline-2 outline-black" : ""}`}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-black/5">
                      {item.type === "video" ? (
                        <video
                          src={item.src}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onMouseEnter={(event) => event.currentTarget.play().catch(() => undefined)}
                          onMouseLeave={(event) => {
                            event.currentTarget.pause();
                            event.currentTarget.currentTime = 0;
                          }}
                          className="h-full w-full object-cover grayscale transition group-hover:grayscale-0"
                        />
                      ) : (
                        <img src={item.src} alt={item.title} className="h-full w-full object-cover grayscale transition duration-300 group-hover:scale-[1.02] group-hover:grayscale-0" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                      <div className="absolute left-3 top-3 border border-white/60 bg-black/40 px-2 py-1 text-[9px] tracking-[0.14em] text-white backdrop-blur-sm">
                        ENTRY_{String(index + 1).padStart(3, "0")}
                      </div>

                      <div className="absolute left-3 top-9 hidden border border-white/40 bg-black/40 px-2 py-1 text-[8px] tracking-[0.12em] text-white/80 backdrop-blur-sm group-hover:block">
                        SOURCE : {item.location || "UNKNOWN"} / TYPE : {item.type.toUpperCase()}
                      </div>

                      {selectMode && adminMode && (
                        <button onClick={() => toggleReferenceSelection(item.id)} className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center border border-white bg-black text-[10px] text-white">
                          {isSelected ? "X" : ""}
                        </button>
                      )}

                      {adminMode && !selectMode && (
                        <button
                          onClick={() => beginEditReference(item)}
                          className="absolute right-3 top-3 z-20 border border-white/60 bg-black/50 px-2 py-1 text-[9px] tracking-[0.12em] text-white backdrop-blur-sm"
                        >
                          EDIT
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (selectMode && adminMode) {
                            toggleReferenceSelection(item.id);
                            return;
                          }
                          setSelectedReferenceId(item.id);
                        }}
                        className="absolute inset-0 z-10"
                        aria-label={item.title}
                      />

                      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                        <div className={`text-[12px] tracking-[0.12em] ${orbitron.className}`}>{item.title}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="border border-white/40 bg-black/30 px-1.5 py-0.5 text-[8px] tracking-[0.12em]">#{item.mainTag}</span>
                          {item.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="border border-white/30 bg-black/20 px-1.5 py-0.5 text-[8px] tracking-[0.12em]">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {activeReferences.length === 0 && (
              <div className="border border-black/20 px-5 py-16 text-center text-[11px] tracking-[0.18em] text-neutral-500">
                NO ENTRY STORED IN THIS FILE.
              </div>
            )}

            {adminMode && selectMode && selectedReferenceIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-black px-4 py-4">
                <div className="text-[11px] tracking-[0.18em]">{selectedReferenceIds.length} SELECTED</div>
                <div className="flex gap-2">
                  <button onClick={handleBulkDeleteReferences} className="border border-red-500 px-3 py-2 text-[11px] tracking-[0.14em] text-red-500 transition hover:bg-red-500 hover:text-white">DELETE</button>
                  <button
                    onClick={() => {
                      setSelectMode(false);
                      setSelectedReferenceIds([]);
                    }}
                    className="border border-black px-3 py-2 text-[11px] tracking-[0.14em] transition hover:bg-black hover:text-white"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>

          <motion.div layout className="xl:sticky xl:top-10 xl:self-start">
            <div className="border border-black/25 bg-white">
              {selectedReference ? (
                <>
                  <div className="relative aspect-[4/3] bg-black/5">
                    {selectedReference.type === "video" ? (
                      <video src={selectedReference.src} controls muted loop playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={selectedReference.src} alt={selectedReference.title} className="h-full w-full object-cover" />
                    )}

                    <div className="absolute left-3 top-3 border border-white/60 bg-black/50 px-2 py-1 text-[9px] tracking-[0.14em] text-white">STATUS : STORED</div>

                    {adminMode && (
                      <div className="absolute right-3 top-3 flex gap-2">
                        <button onClick={() => beginEditReference(selectedReference)} className="border border-white bg-black px-2 py-1 text-[9px] tracking-[0.14em] text-white">EDIT</button>
                        <button onClick={() => handleReferenceDelete(selectedReference.id)} className="border border-red-500 bg-black px-2 py-1 text-[9px] tracking-[0.14em] text-red-300">DELETE</button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-5 p-4">
                    <div>
                      <div className="text-[10px] tracking-[0.2em] text-neutral-500">SELECTED FILE / DETAIL LOG</div>
                      <h3 className={`mt-2 text-[16px] tracking-[0.12em] ${orbitron.className}`}>{selectedReference.title}</h3>
                      <p className="mt-2 text-[10px] tracking-[0.14em] text-neutral-500">{selectedReference.location || "UNKNOWN"} / {selectedReference.date || "NO DATE"}</p>
                    </div>

                    <p className="whitespace-pre-line border-y border-black/10 py-4 text-[12px] leading-7 text-neutral-700">{selectedReference.memo}</p>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="border border-black px-2 py-1 text-[9px] tracking-[0.13em]">#{selectedReference.mainTag}</span>
                      {selectedReference.tags.map((tag) => (
                        <span key={tag} className="border border-black/20 px-2 py-1 text-[9px] tracking-[0.13em] text-neutral-600">#{tag}</span>
                      ))}
                    </div>

                    <div className="space-y-3 border-t border-black/10 pt-4 text-[10px] tracking-[0.12em] text-neutral-600">
                      <div className="flex items-start justify-between gap-4"><span>TYPE</span><span className="text-right text-black">{selectedReference.type.toUpperCase()}</span></div>
                      <div className="flex items-start justify-between gap-4"><span>NOTICED</span><span className="text-right text-black">{selectedReference.noticed || "-"}</span></div>
                      <div className="flex items-start justify-between gap-4"><span>POSSIBLE USE</span><span className="text-right text-black">{selectedReference.possibleUse || "-"}</span></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[480px] items-center justify-center px-8 text-center text-[10px] tracking-[0.18em] text-neutral-500">
                  SELECT ENTRY TO READ IMAGE / VIDEO / LOG
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  const renderJournalBody = (content: string) => {
    const lines = content.split("\n");
    const blocks: React.ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (trimmed.startsWith("```")) {
        const codeLines: string[] = [];
        index += 1;
        while (index < lines.length && !lines[index].trim().startsWith("```")) {
          codeLines.push(lines[index]);
          index += 1;
        }
        index += 1;
        blocks.push(
          <pre key={`code-${index}`} className="my-8 overflow-x-auto border border-black/20 bg-neutral-100 p-4 text-[12px] leading-6">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        continue;
      }

      const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/);
      if (imageMatch) {
        blocks.push(
          <figure key={`image-${index}`} className="my-10">
            <img
              src={imageMatch[2]}
              alt={imageMatch[1] || "Journal image"}
              loading="lazy"
              className="w-full object-cover"
            />
            {imageMatch[3] && (
              <figcaption className="mt-3 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                {imageMatch[3]}
              </figcaption>
            )}
          </figure>
        );
        index += 1;
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        blocks.push(<hr key={`hr-${index}`} className="my-10 border-black/20" />);
        index += 1;
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const id = slugify(text);
        const className =
          level === 1
            ? "mt-12 text-[28px] font-semibold leading-tight tracking-[0.04em]"
            : level === 2
              ? "mt-12 text-[22px] font-semibold leading-tight tracking-[0.04em]"
              : "mt-9 text-[16px] font-semibold uppercase tracking-[0.1em]";

        blocks.push(
          level === 1 ? (
            <h1 key={`heading-${index}`} id={id} className={className}>
              {text}
            </h1>
          ) : level === 2 ? (
            <h2 key={`heading-${index}`} id={id} className={className}>
              {text}
            </h2>
          ) : (
            <h3 key={`heading-${index}`} id={id} className={className}>
              {text}
            </h3>
          )
        );
        index += 1;
        continue;
      }

      if (trimmed.startsWith(">")) {
        const quoteLines: string[] = [];
        while (index < lines.length && lines[index].trim().startsWith(">")) {
          quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
          index += 1;
        }
        blocks.push(
          <blockquote key={`quote-${index}`} className="my-10 border-l border-black pl-6 text-[20px] leading-9 tracking-[0.02em] text-black md:text-[24px]">
            {quoteLines.join(" ")}
          </blockquote>
        );
        continue;
      }

      if (/^(\-|\*)\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const ordered = /^\d+\.\s+/.test(trimmed);
        const items: string[] = [];
        while (
          index < lines.length &&
          (ordered ? /^\d+\.\s+/.test(lines[index].trim()) : /^(\-|\*)\s+/.test(lines[index].trim()))
        ) {
          items.push(lines[index].trim().replace(/^(\d+\.|\-|\*)\s+/, ""));
          index += 1;
        }
        const ListTag = ordered ? "ol" : "ul";
        blocks.push(
          <ListTag key={`list-${index}`} className={`my-6 space-y-2 pl-6 text-[15px] leading-8 text-neutral-800 ${ordered ? "list-decimal" : "list-disc"}`}>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ListTag>
        );
        continue;
      }

      const paragraphs: string[] = [];
      while (index < lines.length && lines[index].trim()) {
        const next = lines[index].trim();
        if (
          next.startsWith("#") ||
          next.startsWith(">") ||
          next.startsWith("```") ||
          next.startsWith("![") ||
          /^---+$/.test(next) ||
          /^(\-|\*)\s+/.test(next) ||
          /^\d+\.\s+/.test(next)
        ) {
          break;
        }
        paragraphs.push(next);
        index += 1;
      }

      blocks.push(
        <p key={`p-${index}`} className="my-6 text-[16px] leading-9 tracking-[0.01em] text-neutral-800">
          {paragraphs.join(" ")}
        </p>
      );
    }

    return blocks;
  };

  const renderArchiveMediaStrip = (section?: ArchiveSection, title?: string) => {
    const media = section?.media?.slice(0, 3) || [];

    if (media.length === 0) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="aspect-[4/3] border border-black/10 bg-[repeating-linear-gradient(135deg,#f4f4f4_0,#f4f4f4_8px,#ffffff_8px,#ffffff_16px)]" />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        {media.map((item, index) => (
          <div key={`${item.src}-${index}`} className="aspect-[4/3] overflow-hidden border border-black/10 bg-black/5">
            <img src={item.src} alt={item.alt || item.caption || title || "Archive section image"} className="h-full w-full object-cover grayscale" />
          </div>
        ))}
      </div>
    );
  };

  const renderArchiveSectionDetail = (item: ArchiveFileItem, key: ArchiveSectionKey) => {
    const section = item.sections?.[key];
    if (!section) return null;

    const rows = [
      ["SOURCE", section.source],
      ["REASON SAVED", section.reasonSaved],
      ["WHAT LEARNED", section.learned],
      ["APPLICATION", section.application],
      ["PATTERN TYPE", section.patternType],
      ["BASE SIZE", section.baseSize],
      ["VERSION", section.version],
      ["MEASUREMENTS", section.measurements],
      ["MODIFICATION NOTES", section.modificationNotes],
      ["ISSUE", section.issue],
      ["CORRECTION", section.correction],
      ["FINAL PATTERN", section.finalPattern],
      ["FABRIC", section.fabricName],
      ["COMPOSITION", section.composition],
      ["COLOR", section.color],
      ["WEIGHT", section.weight],
      ["TEXTURE", section.texture],
      ["STRETCH", section.stretch],
      ["THICKNESS", section.thickness],
      ["SURFACE", section.surface],
      ["BEHAVIOR", section.behavior],
      ["PROBLEM", section.problem],
      ["RESULT", section.result],
      ["NOTES", section.notes || section.content],
    ].filter(([, value]) => value);

    return (
      <section className="border border-black p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black pb-4">
          <div>
            <p className="text-[10px] tracking-[0.24em] text-neutral-500">SECTION FILE</p>
            <h3 className={`mt-2 text-[18px] tracking-[0.18em] md:text-[24px] ${orbitron.className}`}>
              {archiveSectionLabels[key]}
            </h3>
          </div>
          <button
            onClick={() => setExpandedArchiveSection(null)}
            className="border border-black px-3 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white"
          >
            CLOSE SECTION
          </button>
        </div>

        {section.summary && (
          <p className="mt-5 max-w-3xl text-[13px] leading-7 text-neutral-700">{section.summary}</p>
        )}

        {section.media && section.media.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {section.media.map((media, index) => (
              <figure key={`${media.src}-${index}`} className="border border-black/15">
                <div className="aspect-[4/3] overflow-hidden bg-black/5">
                  <img src={media.src} alt={media.alt || media.caption || `${item.title} ${archiveSectionLabels[key]}`} className="h-full w-full object-cover grayscale" />
                </div>
                {(media.imageType || media.caption || media.description || media.date) && (
                  <figcaption className="space-y-1 border-t border-black/15 p-3 text-[10px] leading-5 tracking-[0.08em] text-neutral-600">
                    {media.imageType && <div className="text-black">{media.imageType.toUpperCase()}</div>}
                    {media.caption && <div>{media.caption}</div>}
                    {media.description && <div>{media.description}</div>}
                    {media.date && <div>{media.date}</div>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-6 divide-y divide-black/10 border-y border-black/15">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-2 py-3 text-[11px] leading-6 md:grid-cols-[180px_minmax(0,1fr)]">
                <div className="tracking-[0.2em] text-neutral-500">{label}</div>
                <div className="text-neutral-800">{value}</div>
              </div>
            ))}
          </div>
        )}

        {section.steps && section.steps.length > 0 && (
          <div className="mt-6 space-y-3">
            {section.steps.map((step, index) => (
              <div key={`${step.title}-${index}`} className="grid gap-4 border border-black/15 p-4 md:grid-cols-[120px_minmax(0,1fr)]">
                {step.image ? (
                  <img src={step.image} alt={step.caption || step.title} className="aspect-square w-full object-cover grayscale" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-black text-[10px] tracking-[0.16em] text-white">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap justify-between gap-3 text-[10px] tracking-[0.18em] text-neutral-500">
                    <span>PROCESS STEP</span>
                    <span>{step.date || item.date || "DATE UNLISTED"}</span>
                  </div>
                  <h4 className="mt-2 text-[14px] tracking-[0.14em]">{step.title}</h4>
                  {step.note && <p className="mt-2 text-[12px] leading-6 text-neutral-700">{step.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderArchiveDetail = (item: ArchiveFileItem) => {
    const archiveNumber = getArchiveNumber(item, selectedArchiveIndex, publicArchiveRecords.length);
    const sections = archiveSectionKeys.filter((key) => archiveSectionHasContent(item.sections?.[key]));
    const relatedJournal = publicJournals.find((post) => getJournalSlug(post) === item.relatedJournalSlug);
    const relatedPortfolio = publicPortfolios.find((portfolio) => getPortfolioSlug(portfolio) === item.relatedPortfolioSlug);
    const relatedIssue = issues.find((issue, index) => {
      const issueNumber = getIssueNumber(issue, index, issues.length);
      return issueNumber === String(item.relatedIssueNumber || "").padStart(2, "0") || issueNumber === String(item.relatedIssueNumber || "");
    });

    return (
      <div className="space-y-8">
        <button
          onClick={closeArchiveFile}
          className="text-[10px] tracking-[0.22em] text-neutral-500 underline-offset-4 transition hover:text-black hover:underline"
        >
          BACK TO ARCHIVE INDEX
        </button>

        <section className="border-y border-black py-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex flex-wrap gap-2 text-[10px] tracking-[0.18em] text-neutral-600">
                <span>ARCHIVE {archiveNumber}</span>
                <span>/</span>
                <span>{getArchiveType(item)}</span>
                <span>/</span>
                <span>{getArchiveCategory(item)}</span>
                <span>/</span>
                <span>{getArchiveStatus(item)}</span>
              </div>
              <h2 className={`mt-4 max-w-4xl text-[34px] leading-tight tracking-[0.08em] md:text-[56px] ${orbitron.className}`}>
                {item.title}
              </h2>
              <p className="mt-4 text-[11px] tracking-[0.2em] text-neutral-500">
                FILE OVERVIEW / DOCUMENTED DATE: {item.date || "DATE UNLISTED"}
              </p>
            </div>

            <div className="divide-y divide-black/15 border border-black/20 text-[10px] tracking-[0.12em]">
              {[
                ["TYPE", getArchiveType(item)],
                ["CATEGORY", getArchiveCategory(item)],
                ["STATUS", getArchiveStatus(item)],
                ["MATERIAL", item.material],
                ["TECHNIQUE", item.technique],
                ["PATTERN VERSION", item.patternVersion],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 p-3">
                  <span className="text-neutral-500">{label}</span>
                  <span>{value || "UNLISTED"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((key) => {
            const section = item.sections?.[key];
            return (
              <button
                key={key}
                onClick={() => setExpandedArchiveSection(expandedArchiveSection === key ? null : key)}
                className={`group border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-black ${
                  expandedArchiveSection === key ? "border-black bg-black text-white" : "border-black/20 hover:border-black"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] tracking-[0.22em]">{archiveSectionLabels[key]}</span>
                  <span className="text-[10px] tracking-[0.18em]">OPEN FILE</span>
                </div>
                <div className="mt-4">{renderArchiveMediaStrip(section, item.title)}</div>
                <p className={`mt-4 min-h-[72px] text-[12px] leading-6 ${expandedArchiveSection === key ? "text-white/80" : "text-neutral-700"}`}>
                  {section?.summary || "No summary stored."}
                </p>
              </button>
            );
          })}
        </section>

        {expandedArchiveSection && renderArchiveSectionDetail(item, expandedArchiveSection)}

        <section className="grid gap-4 border-t border-black pt-5 md:grid-cols-3">
          {relatedJournal && (
            <button onClick={() => openJournal(relatedJournal)} className="border border-black/20 p-4 text-left transition hover:border-black">
              <div className="text-[10px] tracking-[0.2em] text-neutral-500">RELATED JOURNAL</div>
              <div className="mt-3 text-[13px] tracking-[0.1em]">{relatedJournal.title}</div>
            </button>
          )}
          {relatedPortfolio && (
            <button onClick={() => openPortfolio(relatedPortfolio)} className="border border-black/20 p-4 text-left transition hover:border-black">
              <div className="text-[10px] tracking-[0.2em] text-neutral-500">RELATED PORTFOLIO</div>
              <div className="mt-3 text-[13px] tracking-[0.1em]">{relatedPortfolio.title}</div>
            </button>
          )}
          {relatedIssue && (
            <a href={relatedIssue.instagramUrl || relatedIssue.link} target="_blank" rel="noopener noreferrer" className="border border-black/20 p-4 text-left transition hover:border-black">
              <div className="text-[10px] tracking-[0.2em] text-neutral-500">RELATED ISSUE</div>
              <div className="mt-3 text-[13px] tracking-[0.1em]">{relatedIssue.title} - OPEN ISSUE</div>
              <span className="sr-only">opens in a new tab</span>
            </a>
          )}
        </section>
      </div>
    );
  };

  const renderArchiveIndex = () => (
    <div className="space-y-12">
      <div className="border-b border-black pb-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] tracking-[0.32em] text-neutral-500">
              DISORDERED ARCHIVE FILE
            </div>
            <h2 className="mt-4 text-[28px] font-semibold tracking-[0.08em] md:text-[48px]">
              ARCHIVE INDEX
            </h2>
            <p className="mt-4 max-w-2xl text-[12px] italic leading-6 tracking-[0.08em] text-neutral-600">
              A garment file index for patterns, materials, fittings, process logs, and technical notes.
            </p>
            <p className="mt-3 text-[9px] tracking-[0.16em] text-neutral-400">
              {archiveStatus}
            </p>
          </div>

          <div className="text-right text-[10px] tracking-[0.18em] text-neutral-500">
            <div>{String(filteredArchiveRecords.length).padStart(3, "0")} FILES</div>
            <div className="mt-2">VIEW / GRID</div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <span className="text-[10px] tracking-[0.18em] text-neutral-500">SEARCH ARCHIVE</span>
            <input
              value={archiveSearchQuery}
              onChange={(event) => setArchiveSearchQuery(event.target.value)}
              placeholder="TITLE / MATERIAL / TECHNIQUE / NOTES"
              className="mt-2 w-full border-b border-black/20 bg-transparent py-2 text-[11px] tracking-[0.12em] outline-none placeholder:text-neutral-400"
            />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Archive sort">
            {archiveSortOptions.map((option) => (
              <button
                key={option}
                onClick={() => setArchiveSortBy(option)}
                className={`border px-3 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white ${
                  archiveSortBy === option ? "border-black bg-black text-white" : "border-black/20 text-neutral-500 hover:border-black hover:text-black"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" aria-label="Archive type filter">
          {archiveTypeFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setArchiveTypeFilter(filter)}
              className={`border px-3 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white ${
                archiveTypeFilter === filter ? "border-black bg-black text-white" : "border-black/20 text-neutral-500 hover:border-black hover:text-black"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2" aria-label="Archive category filter">
          {archiveCategoryFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setArchiveCategoryFilter(filter)}
              className={`border px-3 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white ${
                archiveCategoryFilter === filter ? "border-black bg-black text-white" : "border-black/20 text-neutral-500 hover:border-black hover:text-black"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-5 flex items-end justify-between border-b border-black/20 pb-3">
          <h3 className="text-[12px] font-semibold tracking-[0.28em]">ARCHIVE GRID</h3>
          <div className="text-[10px] tracking-[0.18em] text-neutral-500">
            {String(filteredArchiveRecords.length).padStart(2, "0")} ENTRIES
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredArchiveRecords.map((item, index) => {
            const archiveNumber = getArchiveNumber(item, index, filteredArchiveRecords.length);
            const sectionCounts = archiveSectionKeys
              .map((key) => ({ key, count: getArchiveSectionCount(item.sections?.[key]) }))
              .filter((entry) => entry.count > 0);
            const totalFileCount = getArchiveTotalFileCount(item);

            return (
              <button
                key={item.id}
                onClick={() => openArchiveFile(item)}
                className="group relative min-h-[340px] border border-black/20 bg-white p-4 text-left transition hover:border-black hover:bg-black hover:text-white focus:outline-none focus:ring-2 focus:ring-black"
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/15 pb-4 transition group-hover:border-white/35">
                  <div>
                    <div className="text-[10px] tracking-[0.18em] text-neutral-500 transition group-hover:text-white/60">
                      ARCHIVE {archiveNumber}
                    </div>
                    <h3 className="mt-3 break-words text-[18px] font-semibold uppercase leading-6 tracking-[0.06em]">
                      {item.title}
                    </h3>
                  </div>
                  <div className="border border-black/25 px-2 py-1 text-[9px] tracking-[0.16em] transition group-hover:border-white/40">
                    {getArchiveStatus(item)}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_84px] gap-4">
                  <div className="divide-y divide-black/10 border-y border-black/15 text-[10px] tracking-[0.14em] transition group-hover:divide-white/20 group-hover:border-white/35">
                    {[
                      ["TYPE", getArchiveType(item)],
                      ["CATEGORY", getArchiveCategory(item)],
                      ["YEAR", item.date || item.seasonYear || "UNLISTED"],
                      ["ITEMS", `${String(totalFileCount).padStart(2, "0")} FILES`],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[78px_minmax(0,1fr)] gap-3 py-2">
                        <span className="text-neutral-500 transition group-hover:text-white/55">{label}</span>
                        <span className="truncate">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="relative aspect-[3/4] overflow-hidden border border-black/20 bg-black/5 transition group-hover:border-white/40 group-hover:bg-white/10">
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt={item.coverAlt || `${item.title} file preview`}
                        className="h-full w-full object-cover grayscale transition duration-300 group-hover:brightness-75"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[8px] tracking-[0.12em] text-neutral-500 transition group-hover:text-white/60">
                        FILE
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-1.5 border-t border-black/15 pt-3 text-[10px] leading-5 tracking-[0.12em] transition group-hover:border-white/35">
                  {sectionCounts.slice(0, 4).map(({ key, count }) => (
                    <div key={key} className="flex justify-between gap-4">
                      <span className="text-neutral-500 transition group-hover:text-white/55">
                        {archiveSectionCountLabels[key]}
                      </span>
                      <span>{String(count).padStart(2, "0")}</span>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between border-t border-black/15 pt-3 text-[10px] tracking-[0.16em] transition group-hover:border-white/35">
                  <span className="text-neutral-500 transition group-hover:text-white/55">
                    {item.tags.slice(0, 2).map((tag) => `#${tag}`).join(" ") || "NO TAGS"}
                  </span>
                  <span className="opacity-0 transition group-hover:opacity-100">OPEN FILE -&gt;</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {filteredArchiveRecords.length === 0 && (
        <div className="border border-black/15 px-5 py-16 text-center text-[10px] tracking-[0.16em] text-neutral-500">
          NO ARCHIVE FILE MATCHES THIS QUERY.
        </div>
      )}
    </div>
  );

  const renderJournalForm = () => {
    const inputClass = "border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.08em] outline-none focus:border-black";
    const textareaClass = "min-h-[130px] border border-black/20 bg-transparent px-3 py-2 text-[12px] leading-6 outline-none focus:border-black";

    return (
      <AnimatePresence>
        {journalFormOpen && adminMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border border-black bg-white p-4"
          >
            <div className="mb-4 flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[12px] tracking-[0.22em]">
                  {editingJournalId ? "EDIT JOURNAL RECORD" : "NEW JOURNAL RECORD"}
                </div>
                <p className="mt-2 text-[10px] tracking-[0.12em] text-neutral-500">
                  Markdown-style content is supported. Draft and private posts are hidden from public view.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetJournalForm();
                  setJournalFormOpen(false);
                }}
                className="w-fit border border-black/25 px-3 py-2 text-[10px] tracking-[0.16em] hover:border-black"
              >
                CLOSE FORM
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <input value={journalDraft.title} onChange={(event) => updateJournalDraft("title", event.target.value)} placeholder="TITLE" className={inputClass} />
              <input value={journalDraft.slug || ""} onChange={(event) => updateJournalDraft("slug", event.target.value)} placeholder="SLUG" className={inputClass} />
              <input value={journalDraft.category || ""} onChange={(event) => updateJournalDraft("category", event.target.value)} placeholder="CATEGORY" className={inputClass} />
              <input value={journalDraft.subtitle || ""} onChange={(event) => updateJournalDraft("subtitle", event.target.value)} placeholder="SUBTITLE / OPTIONAL" className={`${inputClass} md:col-span-2`} />
              <select value={journalDraft.visibility || "draft"} onChange={(event) => updateJournalDraft("visibility", event.target.value)} className={inputClass} aria-label="Journal visibility">
                <option value="draft">DRAFT</option>
                <option value="published">PUBLISHED</option>
                <option value="private">PRIVATE</option>
              </select>
              <input
                value={getDateInputValue(journalDraft.publishedAt)}
                onChange={(event) => updateJournalDraft("publishedAt", event.target.value)}
                type="date"
                className={inputClass}
                aria-label="Journal published date"
              />
              <input value={journalDraft.coverImage || ""} onChange={(event) => updateJournalDraft("coverImage", event.target.value)} placeholder="COVER IMAGE URL / OPTIONAL" className={`${inputClass} md:col-span-2`} />
              <input value={journalDraft.coverAlt || ""} onChange={(event) => updateJournalDraft("coverAlt", event.target.value)} placeholder="COVER ALT TEXT" className={inputClass} />
              <input value={journalDraft.coverCaption || ""} onChange={(event) => updateJournalDraft("coverCaption", event.target.value)} placeholder="COVER CAPTION" className={inputClass} />
              <input value={journalDraft.tags.join(", ")} onChange={(event) => updateJournalDraft("tags", parseListInput(event.target.value))} placeholder="TAGS, COMMA SEPARATED" className={`${inputClass} md:col-span-2`} />
              <select
                value={String(journalDraft.relatedIssueNumber || "")}
                onChange={(event) => updateJournalDraft("relatedIssueNumber", event.target.value || undefined)}
                className={inputClass}
                aria-label="Related issue"
              >
                <option value="">RELATED ISSUE / NONE</option>
                {issues.map((issue, index) => {
                  const issueNumber = getIssueNumber(issue, index, issues.length);
                  return (
                    <option key={issue.id} value={issueNumber}>
                      ISSUE {issueNumber} / {issue.title}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mt-3 grid gap-3">
              <textarea
                value={journalDraft.excerpt || ""}
                onChange={(event) => updateJournalDraft("excerpt", event.target.value)}
                placeholder="PREVIEW EXCERPT / OPTIONAL"
                className="min-h-[90px] border border-black/20 bg-transparent px-3 py-2 text-[12px] leading-6 outline-none focus:border-black"
              />
              <textarea
                value={getJournalContent(journalDraft)}
                onChange={(event) => updateJournalDraft("content", event.target.value)}
                placeholder={"CONTENT / MARKDOWN SUPPORTED\n\n## Heading\nParagraph\n\n> Quote\n\n- List item"}
                className={`${textareaClass} min-h-[360px]`}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-black/15 pt-4">
              <button
                type="button"
                onClick={handleSaveJournal}
                disabled={isSavingJournal}
                className="border border-black bg-black px-4 py-2 text-[10px] tracking-[0.18em] text-white disabled:cursor-wait disabled:opacity-50"
              >
                {isSavingJournal ? "SAVING" : editingJournalId ? "UPDATE RECORD" : "REGISTER RECORD"}
              </button>
              <button
                type="button"
                onClick={resetJournalForm}
                disabled={isSavingJournal}
                className="border border-black/25 px-4 py-2 text-[10px] tracking-[0.18em] hover:border-black"
              >
                RESET
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderJournalIndex = () => (
    <div className="space-y-10">
      <div className="border-b border-black pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] tracking-[0.32em] text-neutral-500">PROCESS ARCHIVE</div>
            <h2 className="mt-4 text-[30px] font-semibold tracking-[0.08em] md:text-[48px]">JOURNAL</h2>
            <p className="mt-4 max-w-2xl text-[12px] italic leading-6 tracking-[0.08em] text-neutral-600">
              A collection of thoughts, essays, research notes and everyday observations.
            </p>
            <p className="mt-3 text-[9px] tracking-[0.16em] text-neutral-400">{journalStatus}</p>
          </div>

          {adminMode && (
            <button
              onClick={() => {
                if (journalFormOpen) resetJournalForm();
                setJournalFormOpen((prev) => !prev);
              }}
              className="w-fit border border-black px-4 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white"
            >
              {journalFormOpen ? "CLOSE JOURNAL" : "NEW JOURNAL"}
            </button>
          )}
        </div>
      </div>

      {renderJournalForm()}

      <div className="grid gap-3 border-b border-black/15 pb-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={journalSearchQuery}
          onChange={(event) => setJournalSearchQuery(event.target.value)}
          placeholder="SEARCH TITLE, CONTENT, CATEGORY, TAGS"
          className="border border-black/25 bg-transparent px-4 py-3 text-[11px] tracking-[0.14em] outline-none focus:border-black"
        />
        <select
          value={journalCategoryFilter}
          onChange={(event) => setJournalCategoryFilter(event.target.value)}
          className="border border-black/25 bg-transparent px-4 py-3 text-[11px] tracking-[0.14em] outline-none focus:border-black"
          aria-label="Journal category filter"
        >
          {journalCategories.map((category) => (
            <option key={category} value={category}>
              {category.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {journalTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setJournalTagFilter("")}
            className={`border px-3 py-2 text-[10px] tracking-[0.16em] ${!journalTagFilter ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"}`}
          >
            ALL TAGS
          </button>
          {journalTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setJournalTagFilter(tag)}
              className={`border px-3 py-2 text-[10px] tracking-[0.16em] transition hover:border-black hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                journalTagFilter === tag ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {filteredJournals.map((post) => (
          <article key={post.id} className="group border-t border-black pt-6">
            <button
              type="button"
              onClick={() => openJournal(post)}
              className="grid w-full gap-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black md:grid-cols-[180px_minmax(0,1fr)]"
            >
              <div className="aspect-[4/3] overflow-hidden bg-neutral-100">
                {post.coverImage ? (
                  <img
                    src={post.coverImage}
                    alt={post.coverAlt || `${post.title} cover image`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] group-hover:brightness-90"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] tracking-[0.2em] text-neutral-400">
                    NOTE
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                  <span>{post.category || "Uncategorized"}</span>
                  <span>{getJournalDate(post.publishedAt)}</span>
                  <span>{getReadingTime(post)}</span>
                  {adminMode && post.visibility && <span>{post.visibility}</span>}
                </div>
                <h3 className="mt-3 text-[22px] font-semibold leading-tight tracking-[0.03em]">
                  {post.title}
                </h3>
                {post.subtitle && (
                  <p className="mt-2 text-[13px] leading-6 text-neutral-600">{post.subtitle}</p>
                )}
                <p className="mt-4 line-clamp-3 max-w-3xl text-[13px] leading-7 text-neutral-700">
                  {getJournalExcerpt(post)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="text-[10px] tracking-[0.14em] text-neutral-500">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>

            {adminMode && (
              <div className="mt-4 flex flex-wrap gap-2 md:ml-[200px]">
                <button
                  type="button"
                  onClick={() => beginEditJournal(post)}
                  className="border border-black/25 px-3 py-2 text-[10px] tracking-[0.16em] transition hover:border-black hover:bg-black hover:text-white"
                >
                  EDIT
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteJournal(post)}
                  className="border border-red-400 px-3 py-2 text-[10px] tracking-[0.16em] text-red-500 transition hover:bg-red-500 hover:text-white"
                >
                  DELETE
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {filteredJournals.length === 0 && (
        <div className="border border-black/15 px-5 py-16 text-center text-[10px] tracking-[0.16em] text-neutral-500">
          NO JOURNAL FOUND.
        </div>
      )}
    </div>
  );

  const renderJournalDetail = (post: JournalPost) => {
    const content = getJournalContent(post);
    const headings = getJournalHeadings(content);
    const relatedIssue = findRelatedIssue(post);
    const relatedJournals = getRelatedJournals(post);
    const previousPost = selectedJournalIndex > 0 ? publicJournals[selectedJournalIndex - 1] : null;
    const nextPost =
      selectedJournalIndex >= 0 && selectedJournalIndex < publicJournals.length - 1
        ? publicJournals[selectedJournalIndex + 1]
        : null;

    return (
      <div>
        <div className="fixed left-0 top-0 z-50 h-[2px] bg-black transition-[width]" style={{ width: `${readingProgress}%` }} />
        <button
          type="button"
          onClick={closeJournalDetail}
          className="mb-8 text-[10px] tracking-[0.18em] text-neutral-500 transition hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          &lt;- JOURNAL INDEX
        </button>

        {adminMode && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => beginEditJournal(post)}
              className="border border-black/25 px-3 py-2 text-[10px] tracking-[0.16em] transition hover:border-black hover:bg-black hover:text-white"
            >
              EDIT JOURNAL
            </button>
            <button
              type="button"
              onClick={() => handleDeleteJournal(post)}
              className="border border-red-400 px-3 py-2 text-[10px] tracking-[0.16em] text-red-500 transition hover:bg-red-500 hover:text-white"
            >
              DELETE JOURNAL
            </button>
          </div>
        )}

        <article className="mx-auto max-w-[760px]">
          <header className="border-b border-black pb-8">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              <span>{post.category || "Uncategorized"}</span>
              <span>{getJournalDate(post.publishedAt)}</span>
              <span>UPDATED {getJournalDate(post.updatedAt || post.publishedAt)}</span>
              <span>{getReadingTime(post)}</span>
            </div>
            <h1 className="mt-6 text-[36px] font-semibold leading-tight tracking-[0.02em] md:text-[56px]">
              {post.title}
            </h1>
            {post.subtitle && (
              <p className="mt-5 text-[18px] leading-8 text-neutral-600 md:text-[22px]">{post.subtitle}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setJournalTagFilter(tag);
                    closeJournalDetail();
                  }}
                  className="border border-black/20 px-2 py-1 text-[10px] tracking-[0.14em] text-neutral-600 transition hover:border-black hover:text-black"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </header>

          {post.coverImage && (
            <figure className="my-10">
              <img
                src={post.coverImage}
                alt={post.coverAlt || `${post.title} cover image`}
                loading="eager"
                className="w-full object-cover"
              />
              {post.coverCaption && (
                <figcaption className="mt-3 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                  {post.coverCaption}
                </figcaption>
              )}
            </figure>
          )}

          {headings.length > 0 && (
            <nav className="my-10 border-y border-black/15 py-4" aria-label="Table of contents">
              <div className="mb-3 text-[10px] tracking-[0.2em] text-neutral-500">CONTENTS</div>
              <div className="grid gap-2">
                {headings.map((heading) => (
                  <a
                    key={`${heading.id}-${heading.text}`}
                    href={`#${heading.id}`}
                    className={`text-[12px] tracking-[0.08em] text-neutral-600 transition hover:text-black ${heading.level === 3 ? "pl-4" : ""}`}
                  >
                    {heading.text}
                  </a>
                ))}
              </div>
            </nav>
          )}

          <div className="journal-body">{renderJournalBody(content)}</div>

          <footer className="mt-14 border-t border-black pt-8">
            {relatedIssue && (
              <section className="border-b border-black/15 pb-8">
                <div className="text-[10px] tracking-[0.2em] text-neutral-500">RELATED ISSUE</div>
                <a
                  href={relatedIssue.instagramUrl || relatedIssue.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block border border-black p-4 transition hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                >
                  <div className="text-[12px] uppercase tracking-[0.16em]">{relatedIssue.title}</div>
                  <div className="mt-2 text-[10px] tracking-[0.18em]">OPEN ISSUE -&gt;</div>
                  <span className="sr-only"> Opens Instagram in a new tab.</span>
                </a>
              </section>
            )}

            {relatedJournals.length > 0 && (
              <section className="border-b border-black/15 py-8">
                <div className="text-[10px] tracking-[0.2em] text-neutral-500">RELATED JOURNAL</div>
                <div className="mt-4 grid gap-3">
                  {relatedJournals.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openJournal(item)}
                      className="border-t border-black/15 pt-3 text-left transition hover:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                    >
                      <div className="text-[13px] uppercase tracking-[0.08em]">{item.title}</div>
                      <div className="mt-1 text-[10px] tracking-[0.14em] text-neutral-500">
                        {item.category || "Uncategorized"} / {getReadingTime(item)}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-3 pt-8 md:grid-cols-2">
              {previousPost ? (
                <button onClick={() => openJournal(previousPost)} className="border border-black/20 p-4 text-left text-[11px] tracking-[0.16em] transition hover:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">
                  &lt;- PREVIOUS
                  <span className="mt-2 block text-[13px] normal-case tracking-[0.04em]">{previousPost.title}</span>
                </button>
              ) : <div />}
              {nextPost && (
                <button onClick={() => openJournal(nextPost)} className="border border-black/20 p-4 text-right text-[11px] tracking-[0.16em] transition hover:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">
                  NEXT -&gt;
                  <span className="mt-2 block text-[13px] normal-case tracking-[0.04em]">{nextPost.title}</span>
                </button>
              )}
            </div>
          </footer>
        </article>
      </div>
    );
  };

  const renderPortfolioForm = () => {
    const galleryValue = (portfolioDraft.gallery || [])
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : [entry.src, entry.caption || "", entry.alt || ""].filter(Boolean).join(" | ")
      )
      .join("\n");

    const inputClass = "border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.08em] outline-none focus:border-black";
    const textareaClass = "min-h-[110px] border border-black/20 bg-transparent px-3 py-2 text-[12px] leading-6 outline-none focus:border-black";

    return (
      <AnimatePresence>
        {portfolioFormOpen && adminMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border border-black bg-white p-4"
          >
            <div className="mb-4 flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className={`text-[12px] tracking-[0.22em] ${orbitron.className}`}>
                  {editingPortfolioId ? "EDIT PORTFOLIO RECORD" : "NEW PORTFOLIO RECORD"}
                </div>
                <p className="mt-2 text-[10px] tracking-[0.12em] text-neutral-500">
                  Optional sections left blank will not be displayed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetPortfolioForm();
                  setPortfolioFormOpen(false);
                }}
                className="w-fit border border-black/25 px-3 py-2 text-[10px] tracking-[0.16em] hover:border-black"
              >
                CLOSE FORM
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <input value={String(portfolioDraft.portfolioNumber || "")} onChange={(event) => updatePortfolioDraft("portfolioNumber", event.target.value)} placeholder="PORTFOLIO NUMBER" className={inputClass} />
              <input value={portfolioDraft.title} onChange={(event) => updatePortfolioDraft("title", event.target.value)} placeholder="TITLE" className={inputClass} />
              <input value={portfolioDraft.slug || ""} onChange={(event) => updatePortfolioDraft("slug", event.target.value)} placeholder="SLUG" className={inputClass} />
              <input value={portfolioDraft.subtitle || ""} onChange={(event) => updatePortfolioDraft("subtitle", event.target.value)} placeholder="SUBTITLE" className={inputClass} />
              <input value={portfolioDraft.category || ""} onChange={(event) => updatePortfolioDraft("category", event.target.value)} placeholder="CATEGORY" className={inputClass} />
              <select value={portfolioDraft.visibility || "draft"} onChange={(event) => updatePortfolioDraft("visibility", event.target.value)} className={inputClass} aria-label="Portfolio visibility">
                <option value="draft">DRAFT</option>
                <option value="published">PUBLISHED</option>
                <option value="private">PRIVATE</option>
              </select>
              <select value={portfolioDraft.status || "archived"} onChange={(event) => updatePortfolioDraft("status", event.target.value)} className={inputClass} aria-label="Portfolio status">
                <option value="completed">COMPLETED</option>
                <option value="in_progress">IN PROGRESS</option>
                <option value="archived">ARCHIVED</option>
              </select>
              <select value={portfolioDraft.projectType || "individual"} onChange={(event) => updatePortfolioDraft("projectType", event.target.value)} className={inputClass} aria-label="Portfolio project type">
                <option value="individual">INDIVIDUAL</option>
                <option value="team">TEAM</option>
              </select>
              <input value={String(portfolioDraft.displayOrder || "")} onChange={(event) => updatePortfolioDraft("displayOrder", Number(event.target.value) || undefined)} placeholder="DISPLAY ORDER" className={inputClass} />
              <input value={portfolioDraft.client || ""} onChange={(event) => updatePortfolioDraft("client", event.target.value)} placeholder="CLIENT / COMPANY" className={inputClass} />
              <input value={portfolioDraft.projectPeriod || ""} onChange={(event) => updatePortfolioDraft("projectPeriod", event.target.value)} placeholder="PROJECT PERIOD" className={inputClass} />
              <input value={portfolioDraft.archivedDate || ""} onChange={(event) => updatePortfolioDraft("archivedDate", event.target.value)} placeholder="ARCHIVED DATE" className={inputClass} />
              <input value={portfolioDraft.role || ""} onChange={(event) => updatePortfolioDraft("role", event.target.value)} placeholder="ROLE" className={inputClass} />
              <input value={(portfolioDraft.skills || []).join(", ")} onChange={(event) => updatePortfolioDraft("skills", parseListInput(event.target.value))} placeholder="SKILLS, COMMA SEPARATED" className={inputClass} />
              <input value={portfolioDraft.tags.join(", ")} onChange={(event) => updatePortfolioDraft("tags", parseListInput(event.target.value))} placeholder="TAGS, COMMA SEPARATED" className={inputClass} />
              <input value={portfolioDraft.coverImage || ""} onChange={(event) => updatePortfolioDraft("coverImage", event.target.value)} placeholder="COVER IMAGE URL" className={`${inputClass} md:col-span-2`} />
              <input value={portfolioDraft.coverAlt || ""} onChange={(event) => updatePortfolioDraft("coverAlt", event.target.value)} placeholder="COVER ALT TEXT" className={inputClass} />
              <label className="flex items-center gap-2 border border-black/20 px-3 py-2 text-[10px] tracking-[0.14em] text-neutral-600">
                <input
                  type="checkbox"
                  checked={Boolean(portfolioDraft.isFeatured)}
                  onChange={(event) => updatePortfolioDraft("isFeatured", event.target.checked)}
                />
                FEATURED
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <textarea value={portfolioDraft.description || ""} onChange={(event) => updatePortfolioDraft("description", event.target.value)} placeholder="SHORT DESCRIPTION" className={textareaClass} />
              <textarea value={getPortfolioContribution(portfolioDraft).join("\n")} onChange={(event) => updatePortfolioDraft("contribution", parseListInput(event.target.value))} placeholder="MY CONTRIBUTION / ONE PER LINE" className={textareaClass} />
            </div>

            <div className="mt-5 border-t border-black/15 pt-4">
              <div className="mb-3 text-[10px] tracking-[0.2em] text-neutral-500">CASE STUDY SECTIONS</div>
              <div className="grid gap-3 md:grid-cols-2">
                {portfolioSectionKeys.map((key) => (
                  <label key={key} className="grid gap-2">
                    <span className="text-[9px] uppercase tracking-[0.16em] text-neutral-500">{portfolioSectionLabels[key]}</span>
                    <textarea
                      value={portfolioDraft[key] || ""}
                      onChange={(event) => updatePortfolioDraft(key, event.target.value)}
                      placeholder={`${portfolioSectionLabels[key]} content`}
                      className={textareaClass}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-black/15 pt-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[9px] uppercase tracking-[0.16em] text-neutral-500">Gallery Images / URL | Caption | Alt</span>
                <textarea value={galleryValue} onChange={(event) => updatePortfolioDraft("gallery", parsePortfolioGallery(event.target.value))} className={textareaClass} />
              </label>
              <div className="grid gap-3">
                <label className="border border-black/20 px-3 py-3 text-[10px] tracking-[0.12em] text-neutral-500">
                  <span className="mb-2 block text-[9px] tracking-[0.16em] text-neutral-400">
                    UPLOAD PORTFOLIO FILES / IMAGES, PDF, PPT, DOC
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.ppt,.pptx,.doc,.docx"
                    onChange={(event) => setPortfolioUploadFiles(Array.from(event.target.files || []))}
                    className="block w-full text-[10px]"
                  />
                  {portfolioUploadFiles.length > 0 && (
                    <div className="mt-3 space-y-1 text-[9px] tracking-[0.1em] text-black">
                      {portfolioUploadFiles.map((file) => (
                        <div key={`${file.name}-${file.size}`}>{file.name} / {formatFileSize(file.size)}</div>
                      ))}
                    </div>
                  )}
                </label>
                <input value={portfolioDraft.attachment?.url || ""} onChange={(event) => updatePortfolioDraft("attachment", { ...(portfolioDraft.attachment || { url: "" }), url: event.target.value })} placeholder="ATTACHMENT URL" className={inputClass} />
                <input value={portfolioDraft.attachment?.label || ""} onChange={(event) => updatePortfolioDraft("attachment", { ...(portfolioDraft.attachment || { url: "" }), label: event.target.value })} placeholder="ATTACHMENT LABEL" className={inputClass} />
                <input value={portfolioDraft.attachment?.type || ""} onChange={(event) => updatePortfolioDraft("attachment", { ...(portfolioDraft.attachment || { url: "" }), type: event.target.value })} placeholder="ATTACHMENT TYPE / PDF, PPTX, DOCX" className={inputClass} />
                <input value={portfolioDraft.relatedJournalSlug || ""} onChange={(event) => updatePortfolioDraft("relatedJournalSlug", event.target.value)} placeholder="RELATED JOURNAL SLUG" className={inputClass} />
                <input value={String(portfolioDraft.relatedIssueNumber || "")} onChange={(event) => updatePortfolioDraft("relatedIssueNumber", event.target.value)} placeholder="RELATED ISSUE NUMBER" className={inputClass} />
              </div>
            </div>

            {(portfolioDraft.attachments || []).length > 0 && (
              <div className="mt-4 border-t border-black/15 pt-4">
                <div className="text-[10px] tracking-[0.2em] text-neutral-500">CONNECTED FILES</div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {(portfolioDraft.attachments || []).map((file) => (
                    <a
                      key={file.url}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-black/15 px-3 py-2 text-[10px] tracking-[0.12em] text-neutral-600 hover:border-black"
                    >
                      {file.label || "PORTFOLIO FILE"} {file.size ? `/ ${file.size}` : ""}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-black/15 pt-4">
              <button
                type="button"
                onClick={handleSavePortfolio}
                disabled={isSavingPortfolio}
                className="border border-black bg-black px-4 py-2 text-[10px] tracking-[0.18em] text-white disabled:cursor-wait disabled:opacity-50"
              >
                {isSavingPortfolio ? "SAVING" : editingPortfolioId ? "UPDATE RECORD" : "REGISTER RECORD"}
              </button>
              <button
                type="button"
                onClick={resetPortfolioForm}
                disabled={isSavingPortfolio}
                className="border border-black/25 px-4 py-2 text-[10px] tracking-[0.18em] hover:border-black"
              >
                RESET
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderPortfolioCoverStack = (
    item: PortfolioItem,
    options: { loading?: "eager" | "lazy"; large?: boolean } = {}
  ) => {
    const fileCount = getPortfolioFileCount(item);
    const paperCount = Math.min(Math.max(fileCount - 1, 0), 4);

    return (
      <div className="relative pr-4 pt-4">
        {Array.from({ length: paperCount }).map((_, index) => (
          <div
            key={`${item.id}-paper-${index}`}
            className="absolute border border-black/25 bg-white"
            style={{
              inset: `${10 - index * 2}px ${6 + index * 4}px ${-6 - index * 3}px ${12 + index * 4}px`,
              transform: `rotate(${(index + 1) * 1.2}deg)`,
              zIndex: index,
            }}
            aria-hidden="true"
          />
        ))}
        <div className={`relative z-10 aspect-[4/3] overflow-hidden border border-black/20 bg-neutral-100 ${options.large ? "md:aspect-[16/9]" : ""}`}>
          {item.coverImage ? (
            <img
              src={item.coverImage}
              alt={item.coverAlt || `${item.title} cover image`}
              loading={options.loading || "lazy"}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] group-hover:brightness-90"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] tracking-[0.2em] text-neutral-400">
              DOCUMENTED WORK
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/25 group-hover:opacity-100">
            <span className="border border-white px-4 py-2 text-[10px] tracking-[0.2em] text-white">OPEN RECORD</span>
          </div>
          {fileCount > 0 && (
            <div className="absolute bottom-3 right-3 border border-black bg-white px-2 py-1 text-[9px] tracking-[0.14em]">
              {fileCount} FILE{fileCount > 1 ? "S" : ""}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPortfolioIndex = () => {
    const totalPortfolioCount = filteredPortfolios.length;
    const featuredPortfolio = filteredPortfolios.find((item) => item.isFeatured) ?? filteredPortfolios[0] ?? null;
    const featuredIndex = featuredPortfolio
      ? filteredPortfolios.findIndex((item) => item.id === featuredPortfolio.id)
      : -1;

    return (
      <div className="space-y-12">
        <div className="border-b border-black pb-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] tracking-[0.32em] text-neutral-500">BRAND ARCHIVE</div>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[0.08em] md:text-[48px]">PORTFOLIO</h2>
              <p className="mt-4 max-w-2xl text-[12px] italic leading-6 tracking-[0.08em] text-neutral-600">
                A curated archive of selected works, research, planning and strategy.
              </p>
              <p className="mt-2 max-w-3xl text-[12px] leading-6 tracking-[0.06em] text-neutral-600">
                Each record documents not only the final outcome, but also the thinking, process and decisions behind it.
              </p>
              <p className="mt-3 text-[9px] tracking-[0.16em] text-neutral-400">{portfolioStatus}</p>
            </div>

            {adminMode && (
              <button
                type="button"
                onClick={() => {
                  if (!portfolioFormOpen) resetPortfolioForm();
                  setPortfolioFormOpen((prev) => !prev);
                }}
                className="w-fit border border-black px-4 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                {portfolioFormOpen ? "CLOSE RECORD" : "NEW RECORD"}
              </button>
            )}
          </div>
        </div>

        {renderPortfolioForm()}

        <div className="grid gap-3 border-b border-black/15 pb-6 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <input
            value={portfolioSearchQuery}
            onChange={(event) => setPortfolioSearchQuery(event.target.value)}
            placeholder="SEARCH TITLE, SKILLS, CLIENT, CONTENT"
            className="border border-black/25 bg-transparent px-4 py-3 text-[11px] tracking-[0.14em] outline-none focus:border-black"
          />
          <select
            value={portfolioCategoryFilter}
            onChange={(event) => setPortfolioCategoryFilter(event.target.value)}
            aria-label="Portfolio category filter"
            className="border border-black/25 bg-transparent px-4 py-3 text-[11px] tracking-[0.14em] outline-none focus:border-black"
          >
            {portfolioCategories.map((category) => (
              <option key={category} value={category}>{category.toUpperCase()}</option>
            ))}
          </select>
          <select
            value={portfolioStatusFilter}
            onChange={(event) => setPortfolioStatusFilter(event.target.value)}
            aria-label="Portfolio status filter"
            className="border border-black/25 bg-transparent px-4 py-3 text-[11px] tracking-[0.14em] outline-none focus:border-black"
          >
            {portfolioStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={portfolioTypeFilter}
            onChange={(event) => setPortfolioTypeFilter(event.target.value)}
            aria-label="Portfolio project type filter"
            className="border border-black/20 bg-transparent px-3 py-2 text-[10px] tracking-[0.16em]"
          >
            {portfolioTypes.map((type) => (
              <option key={type} value={type}>{type.toUpperCase()}</option>
            ))}
          </select>
          <button
            onClick={() => setPortfolioSkillFilter("")}
            className={`border px-3 py-2 text-[10px] tracking-[0.16em] ${!portfolioSkillFilter ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"}`}
          >
            ALL SKILLS
          </button>
          {portfolioSkills.slice(0, 10).map((skill) => (
            <button
              key={skill}
              onClick={() => setPortfolioSkillFilter(skill)}
              className={`border px-3 py-2 text-[10px] tracking-[0.16em] transition hover:border-black hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                portfolioSkillFilter === skill ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"
              }`}
            >
              {skill}
            </button>
          ))}
        </div>

        {portfolioTags.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-black/15 pb-6">
            <button
              onClick={() => setPortfolioTagFilter("")}
              className={`border px-3 py-2 text-[10px] tracking-[0.16em] ${!portfolioTagFilter ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"}`}
            >
              ALL TAGS
            </button>
            {portfolioTags.slice(0, 14).map((tag) => (
              <button
                key={tag}
                onClick={() => setPortfolioTagFilter(tag)}
                className={`border px-3 py-2 text-[10px] tracking-[0.16em] transition hover:border-black hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                  portfolioTagFilter === tag ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {featuredPortfolio && (
          <section className="border-b border-black pb-12" aria-labelledby="featured-portfolio-title">
            <div className="mb-4 grid grid-cols-[1fr_auto] gap-4 border-b border-black/20 pb-3 text-[10px] tracking-[0.18em] text-neutral-500">
              <span>FEATURED RECORD</span>
              <span>{getPortfolioStatus(featuredPortfolio)}</span>
            </div>
            <button
              type="button"
              onClick={() => openPortfolio(featuredPortfolio)}
              className="group grid w-full gap-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
            >
              {renderPortfolioCoverStack(featuredPortfolio, { loading: "eager" })}

              <div className="flex flex-col justify-between border-t border-black pt-5 lg:border-t-0 lg:pt-0">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/15 pb-4 text-[10px] tracking-[0.18em] text-neutral-500">
                    <span>PORTFOLIO {getPortfolioNumber(featuredPortfolio, featuredIndex, totalPortfolioCount)}</span>
                    <span>{featuredPortfolio.category || "Archive Record"}</span>
                  </div>
                  <h3 id="featured-portfolio-title" className="mt-6 text-[30px] font-semibold uppercase leading-tight tracking-[0.04em] md:text-[48px]">
                    {featuredPortfolio.title}
                  </h3>
                  {featuredPortfolio.subtitle && (
                    <p className="mt-4 text-[15px] leading-7 text-neutral-600">{featuredPortfolio.subtitle}</p>
                  )}
                  <p className="mt-5 max-w-xl text-[13px] leading-7 tracking-[0.04em] text-neutral-700">
                    {featuredPortfolio.description}
                  </p>
                </div>

                <div className="mt-8 grid gap-3 border-t border-black pt-4 text-[10px] uppercase tracking-[0.16em] text-neutral-600">
                  <div>Period / {featuredPortfolio.projectPeriod || "Unlisted"}</div>
                  <div>Role / {featuredPortfolio.role || "Unlisted"}</div>
                  <div>Skills / {(featuredPortfolio.skills || []).slice(0, 3).join(" / ") || "Unlisted"}</div>
                  <div className="text-black">OPEN RECORD -&gt;</div>
                </div>
              </div>
            </button>
          </section>
        )}

        <section aria-labelledby="portfolio-grid-title">
          <div className="mb-5 flex items-end justify-between border-b border-black/20 pb-3">
            <h3 id="portfolio-grid-title" className="text-[12px] tracking-[0.24em]">ARCHIVE GRID</h3>
            <div className="text-[10px] tracking-[0.18em] text-neutral-500">{filteredPortfolios.length} RECORDS</div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-9 md:grid-cols-2 xl:grid-cols-3">
            {filteredPortfolios.map((item, index) => (
              <article key={item.id} className="group relative">
                <button
                  type="button"
                  onClick={() => openPortfolio(item)}
                  className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                >
                  {renderPortfolioCoverStack(item)}

                  <div className="mt-4 border-t border-black pt-3">
                    <div className="flex items-center justify-between gap-4 text-[10px] tracking-[0.18em] text-neutral-500">
                      <span>PORTFOLIO {getPortfolioNumber(item, index, totalPortfolioCount)}</span>
                      <span>{getPortfolioStatus(item)}</span>
                    </div>
                    <div className={`mt-3 text-[13px] uppercase tracking-[0.08em] ${orbitron.className}`}>{item.title}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                      {item.category || "Uncategorized"} / {item.projectType || "Project"} / {item.projectPeriod || "No period"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(item.skills || []).slice(0, 3).map((skill) => (
                        <span key={skill} className="border border-black/15 px-2 py-1 text-[9px] tracking-[0.12em] text-neutral-500">{skill}</span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[9px] tracking-[0.14em] text-neutral-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                </button>
                {adminMode && (
                  <div className="absolute right-3 top-3 z-10 flex gap-1">
                    <button
                      type="button"
                      onClick={() => beginEditPortfolio(item)}
                      className="border border-white bg-black/75 px-2 py-1 text-[8px] tracking-[0.12em] text-white"
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePortfolio(item)}
                      className="border border-red-400 bg-black/75 px-2 py-1 text-[8px] tracking-[0.12em] text-red-200"
                    >
                      DELETE
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {filteredPortfolios.length === 0 && (
          <div className="border border-black/15 px-5 py-16 text-center text-[10px] tracking-[0.16em] text-neutral-500">
            NO PORTFOLIO RECORD FOUND.
          </div>
        )}
      </div>
    );
  };

  const renderPortfolioDetail = (item: PortfolioItem) => {
    const relatedJournal = findPortfolioRelatedJournal(item);
    const relatedIssue = findPortfolioRelatedIssue(item);
    const relatedArchives = getPortfolioRelatedArchives(item);
    const previousItem = selectedPortfolioIndex > 0 ? publicPortfolios[selectedPortfolioIndex - 1] : null;
    const nextItem =
      selectedPortfolioIndex >= 0 && selectedPortfolioIndex < publicPortfolios.length - 1
        ? publicPortfolios[selectedPortfolioIndex + 1]
        : null;
    const contribution = getPortfolioContribution(item);
    const gallery = (item.gallery || []).map((entry) =>
      typeof entry === "string" ? { src: entry, alt: item.title } : entry
    );
    const attachments = item.attachments?.length
      ? item.attachments
      : item.attachment?.url
        ? [item.attachment]
        : [];

    return (
      <div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={closePortfolioDetail}
            className="text-[10px] tracking-[0.18em] text-neutral-500 transition hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            &lt;- PORTFOLIO INDEX
          </button>

          {adminMode && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => beginEditPortfolio(item)}
                className="border border-black px-3 py-2 text-[10px] tracking-[0.16em] transition hover:bg-black hover:text-white"
              >
                EDIT RECORD
              </button>
              <button
                type="button"
                onClick={() => handleDeletePortfolio(item)}
                className="border border-red-500 px-3 py-2 text-[10px] tracking-[0.16em] text-red-500 transition hover:bg-red-500 hover:text-white"
              >
                DELETE
              </button>
            </div>
          )}
        </div>

        <article className="space-y-12">
          <header className="border-b border-black pb-8">
            <div className="group mb-8">
              {renderPortfolioCoverStack(item, { loading: "eager", large: true })}
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              PORTFOLIO {getPortfolioNumber(item, selectedPortfolioIndex, publicPortfolios.length)}
            </div>
            <h1 className="mt-5 max-w-4xl text-[36px] font-semibold uppercase leading-tight tracking-[0.02em] md:text-[56px]">
              {item.title}
            </h1>
            {item.subtitle && <p className="mt-5 max-w-3xl text-[18px] leading-8 text-neutral-600">{item.subtitle}</p>}
          </header>

          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-8">
              <div className="border-y border-black py-5">
                <div className="text-[10px] tracking-[0.2em] text-neutral-500">MY CONTRIBUTION</div>
                {contribution.length > 0 ? (
                  <ul className="mt-4 grid gap-2 text-[14px] leading-7 text-neutral-800 md:grid-cols-2">
                    {contribution.map((entry) => (
                      <li key={entry} className="border-t border-black/10 pt-2">{entry}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-[13px] leading-7 text-neutral-600">{item.role || "Contribution not listed."}</p>
                )}
              </div>

              {portfolioSectionKeys.map((key) => {
                const value = item[key];
                if (!value) return null;
                return (
                  <section key={key} className="border-t border-black/15 pt-6">
                    <h2 className="text-[15px] font-semibold uppercase tracking-[0.14em]">{portfolioSectionLabels[key]}</h2>
                    <div className="mt-4">{renderJournalBody(value)}</div>
                  </section>
                );
              })}
            </div>

            <aside className="h-fit border border-black p-5 lg:sticky lg:top-8">
              <div className="text-[10px] tracking-[0.2em] text-neutral-500">ARCHIVE METADATA</div>
              <dl className="mt-5 space-y-4 text-[11px] uppercase tracking-[0.12em]">
                {[
                  ["Category", item.category || "Uncategorized"],
                  ["Status", getPortfolioStatus(item)],
                  ["Type", item.projectType || "Unlisted"],
                  ["Client", item.client || "Unlisted"],
                  ["Period", item.projectPeriod || "Unlisted"],
                  ["Archived", item.archivedDate || "Unlisted"],
                  ["Role", item.role || "Unlisted"],
                ].map(([label, value]) => (
                  <div key={label} className="border-t border-black/10 pt-3">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="mt-1 text-black">{value}</dd>
                  </div>
                ))}
              </dl>

              {(item.skills || []).length > 0 && (
                <div className="mt-5 border-t border-black/10 pt-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Skills</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(item.skills || []).map((skill) => (
                      <button
                        key={skill}
                        onClick={() => {
                          setPortfolioSkillFilter(skill);
                          closePortfolioDetail();
                        }}
                        className="border border-black/20 px-2 py-1 text-[9px] tracking-[0.12em] text-neutral-600 hover:border-black"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-black/10 pt-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Tags</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setPortfolioTagFilter(tag);
                        closePortfolioDetail();
                      }}
                      className="text-[9px] tracking-[0.14em] text-neutral-500 hover:text-black"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          {gallery.length > 0 && (
            <section className="border-t border-black pt-8">
              <h2 className="text-[12px] tracking-[0.24em]">GALLERY</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {gallery.map((image, index) => (
                  <figure key={`${image.src}-${index}`}>
                    <img
                      src={image.src}
                      alt={image.alt || `${item.title} gallery image ${index + 1}`}
                      loading="lazy"
                      className="w-full border border-black/15 object-cover"
                    />
                    {image.caption && (
                      <figcaption className="mt-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        {image.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {attachments.length > 0 && (
            <section className="border-t border-black pt-8">
              <div className="text-[12px] tracking-[0.24em]">ATTACHMENT</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {attachments.map((file) => (
                  <a
                    key={file.url}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-black px-4 py-3 text-[10px] uppercase tracking-[0.18em] transition hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                  >
                    {file.label || "PREVIEW FILE"} {file.type ? `/ ${file.type}` : ""}
                    {file.size ? ` / ${file.size}` : ""}
                  </a>
                ))}
              </div>
            </section>
          )}

          <footer className="border-t border-black pt-8">
            <div className="grid gap-4 md:grid-cols-3">
              {relatedJournal && (
                <button onClick={() => openJournal(relatedJournal)} className="border border-black/20 p-4 text-left transition hover:border-black">
                  <div className="text-[10px] tracking-[0.18em] text-neutral-500">RELATED JOURNAL</div>
                  <div className="mt-3 text-[13px] uppercase tracking-[0.08em]">{relatedJournal.title}</div>
                </button>
              )}
              {relatedIssue && (
                <a href={relatedIssue.instagramUrl || relatedIssue.link} target="_blank" rel="noopener noreferrer" className="border border-black/20 p-4 text-left transition hover:border-black">
                  <div className="text-[10px] tracking-[0.18em] text-neutral-500">RELATED ISSUE</div>
                  <div className="mt-3 text-[13px] uppercase tracking-[0.08em]">{relatedIssue.title}</div>
                  <span className="sr-only"> Opens Instagram in a new tab.</span>
                </a>
              )}
              {relatedArchives.length > 0 && (
                <div className="border border-black/20 p-4">
                  <div className="text-[10px] tracking-[0.18em] text-neutral-500">RELATED ARCHIVE</div>
                  <div className="mt-3 space-y-2">
                    {relatedArchives.map((reference) => (
                      <button
                        key={reference.id}
                        onClick={() => {
                          setSelectedCategory("references");
                          setActiveMainTag(reference.mainTag);
                          setSelectedReferenceId(reference.id);
                        }}
                        className="block text-left text-[12px] uppercase tracking-[0.08em] hover:text-neutral-500"
                      >
                        {reference.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {previousItem ? (
                <button onClick={() => openPortfolio(previousItem)} className="border border-black/20 p-4 text-left text-[11px] tracking-[0.16em] transition hover:border-black">
                  &lt;- PREVIOUS RECORD
                  <span className="mt-2 block text-[13px] normal-case tracking-[0.04em]">{previousItem.title}</span>
                </button>
              ) : <div />}
              {nextItem && (
                <button onClick={() => openPortfolio(nextItem)} className="border border-black/20 p-4 text-right text-[11px] tracking-[0.16em] transition hover:border-black">
                  NEXT RECORD -&gt;
                  <span className="mt-2 block text-[13px] normal-case tracking-[0.04em]">{nextItem.title}</span>
                </button>
              )}
            </div>
          </footer>
        </article>
      </div>
    );
  };

  const renderIssueIndex = () => {
    const totalIssueCount = filteredIssues.length;
    const featuredIssueIndex = featuredIssue
      ? filteredIssues.findIndex((issue) => issue.id === featuredIssue.id)
      : -1;
    const behindFeaturedIssue = featuredIssue
      ? publicJournals.filter((post) => findRelatedIssue(post)?.id === featuredIssue.id).slice(0, 3)
      : [];

    return (
      <div className="space-y-12">
        <div className="border-b border-black pb-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] tracking-[0.32em] text-neutral-500">
                DISORDERED ARCHIVE FILE
              </div>
              <h2 className="mt-4 text-[28px] font-semibold tracking-[0.08em] md:text-[48px]">
                ISSUE INDEX
              </h2>
              <p className="mt-4 max-w-2xl text-[12px] italic leading-6 tracking-[0.08em] text-neutral-600">
                A curated archive of visual editorials on fashion, design, retail, space, and culture.
              </p>
              <p className="mt-3 text-[9px] tracking-[0.16em] text-neutral-400">
                {issueStatus}
              </p>
            </div>

            {adminMode && (
              <button
                onClick={() => {
                  if (issueFormOpen) resetIssueForm();
                  setIssueFormOpen((prev) => !prev);
                }}
                className="w-fit border border-black px-4 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                {issueFormOpen ? "CLOSE ISSUE" : "NEW ISSUE"}
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-2" aria-label="Issue category filter">
            {issueCategoryFilters.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setIssueCategoryFilter(category)}
                aria-pressed={issueCategoryFilter === category}
                className={`border px-3 py-2 text-[10px] tracking-[0.18em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                  issueCategoryFilter === category
                    ? "border-black bg-black text-white"
                    : "border-black/20 text-neutral-500 hover:border-black hover:text-black"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {issueFormOpen && adminMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-black bg-white p-4"
            >
              <div className={`mb-4 text-[12px] tracking-[0.22em] ${orbitron.className}`}>
                NEW ISSUE / INSTAGRAM REGISTER
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={newIssueTitle}
                  onChange={(event) => setNewIssueTitle(event.target.value)}
                  placeholder="ISSUE TITLE"
                  className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none focus:border-black"
                />
                <input
                  value={newIssueLink}
                  onChange={(event) => setNewIssueLink(event.target.value)}
                  placeholder="INSTAGRAM POST URL"
                  type="url"
                  className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none focus:border-black"
                />
                <input
                  value={newIssueHandle}
                  onChange={(event) => setNewIssueHandle(event.target.value)}
                  placeholder="@INSTAGRAM"
                  className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none focus:border-black"
                />
                <input
                  value={newIssueTags}
                  onChange={(event) => setNewIssueTags(event.target.value)}
                  placeholder="TAGS, COMMA SEPARATED"
                  className="border border-black/20 bg-transparent px-3 py-2 text-[11px] tracking-[0.12em] outline-none focus:border-black"
                />

                <label className="border border-black/20 px-3 py-3 text-[10px] tracking-[0.12em] text-neutral-500 md:col-span-2">
                  <span className="mb-2 block text-[9px] tracking-[0.16em] text-neutral-400">
                    FIRST IMAGE / COVER
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIssueFileChange}
                    className="block w-full text-[10px]"
                  />
                </label>
              </div>

              {newIssuePreview && (
                <div
                  role="img"
                  aria-label="Issue cover preview"
                  className="mt-4 aspect-square max-w-[240px] bg-cover bg-center"
                  style={{ backgroundImage: `url("${newIssuePreview}")` }}
                />
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleAddIssue}
                  disabled={isSavingIssue}
                  className="border border-black bg-black px-4 py-2 text-[10px] tracking-[0.18em] text-white disabled:cursor-wait disabled:opacity-50"
                >
                  {isSavingIssue ? "SAVING" : "REGISTER"}
                </button>
                <button
                  onClick={resetIssueForm}
                  disabled={isSavingIssue}
                  className="border border-black/25 px-4 py-2 text-[10px] tracking-[0.18em]"
                >
                  RESET
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {featuredIssue && (
          <section className="border-b border-black pb-12" aria-labelledby="featured-issue-title">
            <div className="mb-4 grid grid-cols-[1fr_auto] gap-4 border-b border-black/20 pb-3 text-[10px] tracking-[0.18em] text-neutral-500">
              <span>FEATURED ISSUE</span>
              <span>{getIssueDate(featuredIssue)}</span>
            </div>
            <a
              href={featuredIssue.instagramUrl || featuredIssue.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid gap-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"
              aria-label={`Open ${featuredIssue.title} on Instagram in a new tab`}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100 md:aspect-[16/10] lg:aspect-[4/5]">
                {featuredIssue.thumbnailUrl || featuredIssue.thumbnailSrc ? (
                  <img
                    src={featuredIssue.thumbnailUrl || featuredIssue.thumbnailSrc}
                    alt={`${featuredIssue.title} cover image`}
                    loading="eager"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] group-hover:brightness-75"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] tracking-[0.22em] text-neutral-400">
                    COVER PENDING
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between border-t border-black pt-5 lg:border-t-0 lg:pt-0">
                <div>
                  <div className="flex items-center justify-between gap-4 border-b border-black/15 pb-4 text-[10px] tracking-[0.2em] text-neutral-500">
                    <span>ISSUE {getIssueNumber(featuredIssue, featuredIssueIndex, totalIssueCount)}</span>
                    <span>{getIssueCategory(featuredIssue)}</span>
                  </div>
                  <h3
                    id="featured-issue-title"
                    className="mt-6 text-[30px] font-semibold uppercase leading-tight tracking-[0.04em] md:text-[52px]"
                  >
                    {featuredIssue.title}
                  </h3>
                  <p className="mt-6 max-w-xl text-[13px] leading-7 tracking-[0.04em] text-neutral-600">
                    {featuredIssue.description || archiveIssueFallbackDescription}
                  </p>
                </div>

                <div className="mt-10 flex items-center justify-between border-t border-black pt-4 text-[10px] tracking-[0.2em]">
                  <span>{getIssueDate(featuredIssue)}</span>
                  <span>
                    OPEN ISSUE -&gt;
                    <span className="sr-only"> Opens Instagram in a new tab.</span>
                  </span>
                </div>
              </div>
            </a>
          </section>
        )}

        {behindFeaturedIssue.length > 0 && (
          <section className="border-b border-black pb-10" aria-labelledby="behind-issue-title">
            <div className="mb-5 flex items-end justify-between border-b border-black/20 pb-3">
              <h3 id="behind-issue-title" className="text-[12px] tracking-[0.24em]">
                BEHIND THIS ISSUE
              </h3>
              <div className="text-[10px] tracking-[0.18em] text-neutral-500">JOURNAL</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {behindFeaturedIssue.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => openJournal(post)}
                  className="border border-black/20 p-4 text-left transition hover:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    {post.category || "Journal"} / {getReadingTime(post)}
                  </div>
                  <div className="mt-3 text-[14px] uppercase tracking-[0.08em]">{post.title}</div>
                  <div className="mt-4 text-[10px] tracking-[0.18em] text-neutral-500">VIEW JOURNAL -&gt;</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="issue-grid-title">
          <div className="mb-5 flex items-end justify-between border-b border-black/20 pb-3">
            <h3 id="issue-grid-title" className="text-[12px] tracking-[0.24em]">
              ARCHIVE GRID
            </h3>
            <div className="text-[10px] tracking-[0.18em] text-neutral-500">
              {filteredIssues.length} ENTRIES
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-9 md:grid-cols-2 xl:grid-cols-3">
            {filteredIssues.map((item, index) => {
              const issueNumber = getIssueNumber(item, index, totalIssueCount);
              const thumbnail = item.thumbnailUrl || item.thumbnailSrc;

              return (
                <article key={item.id} className="group relative">
                  <a
                    href={item.instagramUrl || item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${item.title} on Instagram in a new tab`}
                    className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden border border-black/20 bg-neutral-100">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={`${item.title} cover image`}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] group-hover:brightness-75"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] tracking-[0.2em] text-neutral-400">
                          COVER PENDING
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/25 group-hover:opacity-100">
                        <span className="border border-white px-4 py-2 text-[10px] tracking-[0.2em] text-white">
                          OPEN ISSUE -&gt;
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-black pt-3">
                      <div className="flex items-center justify-between gap-4 text-[10px] tracking-[0.18em] text-neutral-500">
                        <span>ISSUE {issueNumber}</span>
                        <span>{getIssueCategory(item)}</span>
                      </div>
                      <div className={`mt-3 text-[13px] uppercase tracking-[0.08em] ${orbitron.className}`}>
                        {item.title}
                      </div>
                      <div className="mt-2 text-[10px] tracking-[0.14em] text-neutral-500">
                        {getIssueDate(item)}
                      </div>
                      <span className="sr-only"> Opens Instagram in a new tab.</span>
                    </div>
                  </a>

                  {adminMode && (
                    <button
                      onClick={() => handleDeleteIssue(item)}
                      className="absolute right-3 top-3 z-10 border border-red-400 bg-black/70 px-2 py-1 text-[8px] tracking-[0.12em] text-red-200"
                    >
                      DELETE
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {filteredIssues.length === 0 && (
          <div className="border border-black/15 px-5 py-16 text-center text-[10px] tracking-[0.16em] text-neutral-500">
            NO ISSUE STORED IN THIS CATEGORY.
          </div>
        )}
      </div>
    );
  };

  const renderFreeboardCanvas = () => {
    const sizeClass = (post: FreeboardPost) => {
      const { size } = getFreeboardLayout(post);
      if (size === "small") return "w-[190px] min-h-[138px]";
      if (size === "large") return "w-[270px] min-h-[190px]";
      return "w-[230px] min-h-[160px]";
    };

    return (
      <div className="space-y-6">
        <section className="border-b border-black pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] tracking-[0.32em] text-neutral-500">DISORDERED CANVAS</div>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[0.08em] md:text-[48px]">FREEBOARD</h2>
              <p className="mt-4 max-w-2xl text-[12px] italic leading-6 tracking-[0.08em] text-neutral-600">
                A public canvas of fragments, notes and visitor traces.
              </p>
              {freeboardStatus && (
                <p className="mt-3 text-[9px] tracking-[0.16em] text-neutral-400">{freeboardStatus}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFreeboardWriteOpen((prev) => !prev)}
              className="w-fit border border-black px-4 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white"
            >
              {freeboardWriteOpen ? "CLOSE NOTE" : "LEAVE A TRACE"}
            </button>
          </div>
        </section>

        <AnimatePresence>
          {freeboardWriteOpen && (
            <motion.section
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-black bg-white p-4"
            >
              <div className="mb-4 text-[12px] tracking-[0.22em]">WRITE NOTE / VISITOR TRACE</div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="grid gap-2">
                  <span className="text-[9px] tracking-[0.16em] text-neutral-500">NAME / OPTIONAL</span>
                  <input
                    value={freeboardName}
                    onChange={(event) => setFreeboardName(event.target.value)}
                    placeholder="Anonymous if empty"
                    className="border border-black/20 bg-transparent px-3 py-2 text-[12px] outline-none focus:border-black"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[9px] tracking-[0.16em] text-neutral-500">TAG / OPTIONAL</span>
                  <input
                    value={freeboardTags}
                    onChange={(event) => setFreeboardTags(event.target.value)}
                    placeholder="fragment, note"
                    className="border border-black/20 bg-transparent px-3 py-2 text-[12px] outline-none focus:border-black"
                  />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-[11px] tracking-[0.12em]">
                <input type="checkbox" checked={freeboardAnonymous} onChange={() => setFreeboardAnonymous(!freeboardAnonymous)} />
                ANONYMOUS
              </label>
              <label className="mt-3 grid gap-2">
                <span className="text-[9px] tracking-[0.16em] text-neutral-500">MESSAGE / MAX 600</span>
                <textarea
                  value={freeboardContent}
                  onChange={(event) => setFreeboardContent(event.target.value.slice(0, 600))}
                  placeholder="Leave a trace inside the disordered archive."
                  className="min-h-[130px] border border-black/20 bg-transparent px-3 py-2 text-[13px] leading-6 outline-none focus:border-black"
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleFreeboardSubmit}
                  disabled={isSubmittingFreeboard || !freeboardContent.trim()}
                  className="border border-black bg-black px-4 py-2 text-[10px] tracking-[0.18em] text-white disabled:cursor-wait disabled:opacity-40"
                >
                  {isSubmittingFreeboard ? "SUBMITTING" : "SUBMIT TRACE"}
                </button>
                <span className="text-[10px] tracking-[0.12em] text-neutral-400">
                  {freeboardContent.length}/600
                </span>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className="grid gap-3 border border-black md:grid-cols-[minmax(0,1fr)_340px]">
          <label className="border-b border-black px-4 py-3 md:border-b-0 md:border-r">
            <span className="text-[10px] tracking-[0.18em] text-neutral-500">SEARCH TRACE</span>
            <input
              value={freeboardSearchQuery}
              onChange={(event) => setFreeboardSearchQuery(event.target.value)}
              placeholder="message / name / tag"
              className="mt-2 w-full bg-transparent text-[12px] tracking-[0.08em] outline-none placeholder:text-neutral-400"
            />
          </label>
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {(["canvas", "recent", "random"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setFreeboardViewMode(mode);
                    if (mode === "random") setFreeboardViewSeed((prev) => prev + 1);
                  }}
                  className={`border px-3 py-2 text-[10px] tracking-[0.16em] transition hover:bg-black hover:text-white ${
                    freeboardViewMode === mode ? "border-black bg-black text-white" : "border-black/25"
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setFreeboardSearchQuery("");
                  setFreeboardTagFilter("");
                  setFreeboardViewMode("canvas");
                }}
                className="border border-black/25 px-3 py-2 text-[10px] tracking-[0.16em] transition hover:bg-black hover:text-white"
              >
                RESET VIEW
              </button>
            </div>
          </div>
        </section>

        {freeboardTagsList.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFreeboardTagFilter("")}
              className={`border px-3 py-2 text-[10px] tracking-[0.16em] ${!freeboardTagFilter ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"}`}
            >
              ALL TAGS
            </button>
            {freeboardTagsList.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFreeboardTagFilter(tag)}
                className={`border px-3 py-2 text-[10px] tracking-[0.16em] transition hover:border-black hover:text-black ${
                  freeboardTagFilter === tag ? "border-black bg-black text-white" : "border-black/20 text-neutral-500"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        <section className="relative -mx-4 overflow-auto [mask-image:linear-gradient(to_bottom,transparent_0,#000_28px,#000_calc(100%-28px),transparent_100%)]">
          <div className="relative min-h-[780px] min-w-[760px] px-4 py-8 md:min-h-[920px]">
            {filteredFreeboardPosts.length === 0 ? (
              <div className="absolute left-1/2 top-1/2 w-[280px] -translate-x-1/2 -translate-y-1/2 border border-black bg-white p-5 text-center">
                <div className="text-[12px] tracking-[0.22em]">NO TRACES YET.</div>
                <p className="mt-3 text-[12px] leading-6 text-neutral-600">
                  Be the first to leave a note inside the archive.
                </p>
                <button
                  type="button"
                  onClick={() => setFreeboardWriteOpen(true)}
                  className="mt-4 border border-black px-4 py-2 text-[10px] tracking-[0.18em] transition hover:bg-black hover:text-white"
                >
                  LEAVE A TRACE
                </button>
              </div>
            ) : (
              filteredFreeboardPosts.map((post, index) => {
                const layout = getFreeboardLayout(post);
                const noteNumber = String(index + 1).padStart(3, "0");
                const visibleName = post.isAnonymous ? "Anonymous" : post.name || "Anonymous";

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedFreeboardId(post.id)}
                    className={`group absolute border border-black/25 bg-white p-4 text-left shadow-[4px_4px_0_rgba(0,0,0,0.08)] transition duration-200 hover:z-20 hover:border-black hover:bg-black hover:text-white focus:z-20 focus:outline-none focus:ring-2 focus:ring-black ${sizeClass(post)}`}
                    style={{
                      left: `${layout.x}%`,
                      top: `${layout.y}%`,
                      transform: `translate(-50%, -50%) rotate(${freeboardViewMode === "recent" ? 0 : layout.rotation}deg)`,
                    }}
                    aria-label={`Read trace by ${visibleName}`}
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-black/15 pb-3 transition group-hover:border-white/30">
                      <div>
                        <div className="text-[10px] tracking-[0.18em] text-neutral-500 transition group-hover:text-white/60">
                          FILE NOTE {noteNumber}
                        </div>
                        <div className="mt-2 text-[11px] tracking-[0.12em]">{visibleName}</div>
                      </div>
                      {adminMode && post.visibility === "hidden" && (
                        <span className="border border-red-400 px-2 py-1 text-[8px] tracking-[0.12em] text-red-500">
                          HIDDEN
                        </span>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-5 text-[12px] leading-6 text-neutral-700 transition group-hover:text-white/80">
                      {post.content}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-between gap-2 text-[9px] tracking-[0.12em] text-neutral-500 transition group-hover:text-white/55">
                      <span>{post.date || "DATE UNLISTED"}</span>
                      <span>READ TRACE</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <AnimatePresence>
          {selectedFreeboardPost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 px-5 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Read visitor trace"
              onClick={() => setSelectedFreeboardId(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 16, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="max-h-[82vh] w-full max-w-xl overflow-auto border border-black bg-white p-5 shadow-[8px_8px_0_rgba(0,0,0,0.12)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black pb-4">
                  <div>
                    <div className="text-[10px] tracking-[0.22em] text-neutral-500">OPEN NOTE</div>
                    <h3 className="mt-2 text-[18px] tracking-[0.12em]">VISITOR TRACE</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFreeboardId(null)}
                    className="border border-black/25 px-3 py-2 text-[10px] tracking-[0.16em] transition hover:bg-black hover:text-white"
                  >
                    CLOSE NOTE
                  </button>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[10px] tracking-[0.16em] text-neutral-500">
                  <span>{selectedFreeboardPost.isAnonymous ? "ANONYMOUS" : selectedFreeboardPost.name}</span>
                  <span>{selectedFreeboardPost.date}</span>
                  {selectedFreeboardPost.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <p className="mt-6 whitespace-pre-wrap text-[15px] leading-8 text-neutral-800">
                  {selectedFreeboardPost.content}
                </p>
                {adminMode && (
                  <div className="mt-6 flex flex-wrap gap-2 border-t border-black/15 pt-4">
                    <button
                      type="button"
                      onClick={() =>
                        handleFreeboardVisibility(
                          selectedFreeboardPost,
                          selectedFreeboardPost.visibility === "hidden" ? "published" : "hidden"
                        )
                      }
                      className="border border-black/25 px-3 py-2 text-[10px] tracking-[0.16em] transition hover:bg-black hover:text-white"
                    >
                      {selectedFreeboardPost.visibility === "hidden" ? "PUBLISH TRACE" : "HIDE TRACE"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleFreeboardDelete(selectedFreeboardPost.id);
                        setSelectedFreeboardId(null);
                      }}
                      className="border border-red-400 px-3 py-2 text-[10px] tracking-[0.16em] text-red-500 transition hover:bg-red-500 hover:text-white"
                    >
                      DELETE TRACE
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderCategoryContent = () => {
    switch (selectedCategory) {
      case "references":
        return activeMainTag ? renderReferenceArchiveView() : renderReferenceFolderView();

      case "issues":
        return renderIssueIndex();

      case "journal":
        return selectedJournal ? renderJournalDetail(selectedJournal) : renderJournalIndex();

      case "portfolio":
        return selectedPortfolio ? renderPortfolioDetail(selectedPortfolio) : renderPortfolioIndex();

      case "archive":
        return selectedArchiveRecord ? renderArchiveDetail(selectedArchiveRecord) : renderArchiveIndex();

      case "freeboard":
        return renderFreeboardCanvas();

      case "contact":
        return (
          <div className="space-y-10">
            <h2 className="text-[14px] tracking-[0.2em]">CONTACT</h2>
            <div className="space-y-4 border-t border-black/10 pt-4 text-[12px] tracking-[0.12em]">
              <div>jaemin6648@gmail.com</div>
              <a href="https://www.instagram.com/j.xn_mn/" target="_blank" rel="noreferrer" className="block underline-offset-4 hover:underline">@j.xn_mn</a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!entered) {
    return (
      <div className="daf-root min-h-screen overflow-hidden bg-white text-black">
        <div className="relative h-[68vh] w-full overflow-hidden bg-white">
          <video src="/hero-video.mp4" autoPlay loop muted playsInline className="h-full w-full object-cover" />
          <div
            className="absolute inset-x-0 bottom-0 h-32"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.82) 70%, rgba(255,255,255,1) 100%)",
            }}
          />
        </div>

        <div className="-mt-2 flex flex-col items-center px-6 pb-16 pt-6 text-center md:pt-10">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className={`mt-6 flex flex-col items-center gap-2 ${orbitron.className}`}>
            <div className="text-[20px] tracking-[0.12em] md:text-[26px]">DISORDERED ARCHIVE FILE</div>
            <button onClick={() => setEntered(true)} className="blink cursor-pointer text-[11px] tracking-[0.28em]">CLICK TO ENTER</button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="daf-root min-h-screen bg-white px-6 py-10 text-black md:px-10 md:py-14">
      {adminMode && (
        <button
          onClick={handleAdminLogout}
          className="fixed right-4 top-4 z-40 border border-black bg-white px-3 py-2 text-[9px] tracking-[0.16em] transition hover:bg-black hover:text-white md:right-6 md:top-6"
        >
          ADMIN / LOGOUT
        </button>
      )}

      <section className="mx-auto max-w-7xl">
        <div className="relative min-h-[72vh]">
          {!selectedCategory ? (
            <>
              <motion.button
                animate={{
                  x: ["-42vw", "38vw", "34vw", "-36vw", "-28vw", "41vw", "-42vw"],
                  y: ["-26vh", "18vh", "-14vh", "24vh", "-8vh", "-22vh", "-26vh"],
                  rotate: [0, 12, -9, 7, -11, 6, 0],
                }}
                transition={{ duration: 37, ease: "linear", repeat: Infinity }}
                onClick={() => {
                  const all = categories.map((c) => c.id);
                  const random = all[Math.floor(Math.random() * all.length)];
                  setSelectedCategory(random);
                }}
                className="pointer-events-auto fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer bg-transparent text-[11px] tracking-[0.25em] text-neutral-500 hover:text-black"
              >
                RANDOM
              </motion.button>

              <div className="relative min-h-[72vh]">
                <div className="absolute left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2">
                  <CategoryMenu
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    tagQuery={tagQuery}
                    setTagQuery={setTagQuery}
                    searchOpen={searchOpen}
                    setSearchOpen={setSearchOpen}
                    tagResults={tagResults}
                    fontClassName={orbitron.className}
                    align="center"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
              <motion.section initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="min-h-[70vh]">
                {renderCategoryContent()}
              </motion.section>

              <aside className="relative hidden h-[72vh] self-start lg:block">
                <motion.div initial={{ opacity: 0, x: -240 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }} className="absolute left-0 top-1/2 flex h-[400px] w-full -translate-y-1/2 flex-col justify-center">
                  <CategoryMenu
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    tagQuery={tagQuery}
                    setTagQuery={setTagQuery}
                    searchOpen={searchOpen}
                    setSearchOpen={setSearchOpen}
                    tagResults={tagResults}
                    fontClassName={orbitron.className}
                    align="right"
                  />

                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setTagQuery("");
                      setSearchOpen(false);
                      setActiveMainTag(null);
                      setSelectedReferenceId(null);
                    }}
                    className="mt-6 block w-full text-right text-[11px] tracking-[0.18em] text-neutral-500 transition hover:text-black"
                  >
                    BACK TO CATEGORY LIST
                  </button>
                </motion.div>
              </aside>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {filemasterActive && !adminMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 px-6 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} className="w-full max-w-[420px] border border-black bg-white p-5">
              <div className={`text-[13px] tracking-[0.26em] ${orbitron.className}`}>FILEMASTER ACCESS</div>
              <p className="mt-3 text-[11px] leading-6 tracking-[0.1em] text-neutral-500">
                AUTHENTICATE WITH THE SUPABASE ADMIN ACCOUNT.
              </p>

              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="ADMIN EMAIL"
                type="email"
                autoComplete="username"
                className="mt-5 w-full border border-black/25 bg-transparent px-3 py-3 text-[12px] tracking-[0.12em] outline-none"
              />

              <input
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdminLogin();
                }}
                placeholder="PASSWORD"
                type="password"
                autoComplete="current-password"
                className="mt-2 w-full border border-black/25 bg-transparent px-3 py-3 text-[12px] tracking-[0.18em] outline-none"
              />

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleAdminLogin}
                  disabled={isAuthenticating}
                  className="border border-black bg-black px-4 py-2 text-[11px] tracking-[0.18em] text-white disabled:cursor-wait disabled:opacity-50"
                >
                  {isAuthenticating ? "VERIFYING" : "LOGIN"}
                </button>
                <button
                  onClick={() => {
                    setAdminEmail("");
                    setAdminInput("");
                    setAdminStatus("");
                    setTagQuery("");
                    setSearchOpen(false);
                  }}
                  disabled={isAuthenticating}
                  className="border border-black/25 px-4 py-2 text-[11px] tracking-[0.18em]"
                >
                  CANCEL
                </button>
              </div>

              {adminStatus && (
                <div className="mt-4 border-t border-black/10 pt-3 text-[10px] leading-5 tracking-[0.1em] text-neutral-500">
                  {adminStatus}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
