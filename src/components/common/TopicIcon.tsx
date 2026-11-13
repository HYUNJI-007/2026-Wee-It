import React from 'react';
import { icons, Tag } from 'lucide-react';

export interface CustomSavedIcon {
  id: string;
  value: string; // emoji string or 'lucide:IconName'
  label: string;
  createdAt: number;
}

export const CUSTOM_ICONS_STORAGE_KEY = 'wee_memo_custom_icons_v1';

export const PRESET_ICONS: string[] = [
  '📞', '🚨', '💡', '📋', '☕', '🏫', '👥', '🎯',
  '📑', '🩺', '💬', '🌟', '📝', '📅', '🔍', '🔔',
  '❤️', '⚡', '🚩', '🤝', '📚', '🎒', '🛡️', '✨'
];

export const ALL_LUCIDE_ICON_NAMES: string[] = Object.keys(icons);

// Popular counseling / productivity Lucide icons shown by default before search
export const FEATURED_LUCIDE_ICONS: string[] = [
  'Phone', 'PhoneCall', 'ShieldAlert', 'Lightbulb', 'ClipboardList', 'Coffee',
  'School', 'Users', 'UserCheck', 'Target', 'FileText', 'Stethoscope',
  'MessageCircle', 'MessageSquareHeart', 'Star', 'Calendar', 'Search', 'Bell',
  'Heart', 'HeartHandshake', 'Zap', 'Flag', 'Handshake', 'BookOpen',
  'Backpack', 'ShieldCheck', 'Sparkles', 'Bookmark', 'Folder', 'Clock',
  'CheckCircle2', 'AlertTriangle', 'Home', 'GraduationCap', 'Smile', 'Brain'
];

// Korean -> English Lucide keyword mapping for intuitive Korean icon search
const KOREAN_ICON_KEYWORDS: Record<string, string[]> = {
  '상담': ['message', 'heart', 'user', 'smile', 'handshake', 'ear', 'chat'],
  '대화': ['message', 'chat', 'speech', 'mic', 'quote'],
  '전화': ['phone', 'call', 'smartphone'],
  '통화': ['phone', 'call'],
  '위기': ['alert', 'shield', 'siren', 'flame', 'triangle', 'ban'],
  '안전': ['shield', 'lock', 'check', 'heart'],
  '점검': ['check', 'clipboard', 'search', 'eye', 'scan'],
  '학교': ['school', 'graduation', 'book', 'backpack', 'building'],
  '학생': ['user', 'users', 'graduation', 'smile', 'backpack'],
  '학부모': ['users', 'home', 'heart', 'phone'],
  '가족': ['home', 'users', 'heart'],
  '선생': ['graduation', 'book', 'user', 'award'],
  '담임': ['user', 'users', 'school'],
  '메모': ['sticky', 'note', 'file', 'pen', 'pencil', 'edit', 'notebook'],
  '기록': ['file', 'pen', 'notebook', 'book', 'clipboard', 'history'],
  '문서': ['file', 'folder', 'clipboard', 'scroll', 'newspaper'],
  '행정': ['briefcase', 'folder', 'file', 'clipboard', 'printer', 'inbox'],
  '공문': ['file', 'mail', 'send', 'stamp'],
  '일정': ['calendar', 'clock', 'alarm', 'timer'],
  '달력': ['calendar'],
  '시간': ['clock', 'watch', 'timer', 'hourglass'],
  '알림': ['bell', 'megaphone', 'radio'],
  '중요': ['star', 'pin', 'flag', 'bookmark', 'alert'],
  '고정': ['pin', 'bookmark', 'anchor'],
  '별': ['star', 'sparkles'],
  '하트': ['heart'],
  '마음': ['heart', 'brain', 'smile', 'sun'],
  '생각': ['brain', 'lightbulb', 'sparkles'],
  '아이디어': ['lightbulb', 'sparkles', 'zap', 'compass'],
  '목표': ['target', 'flag', 'trophy', 'award'],
  '책': ['book', 'library', 'notebook'],
  '공부': ['book', 'graduation', 'pen'],
  '검사': ['stethoscope', 'activity', 'clipboard', 'microscope', 'heart-pulse'],
  '병원': ['hospital', 'stethoscope', 'pill', 'cross', 'heart-pulse'],
  '치료': ['heart-pulse', 'stethoscope', 'pill', 'sparkles'],
  '잠금': ['lock', 'key', 'shield'],
  '비밀': ['lock', 'eye-off', 'key'],
  '검색': ['search', 'zoom', 'compass'],
  '설정': ['settings', 'sliders', 'wrench', 'cog'],
  '링크': ['link', 'external', 'globe', 'share'],
  '집': ['home', 'house'],
  '차': ['car', 'bus', 'navigation'],
  '이동': ['move', 'navigation', 'map', 'route'],
  '선물': ['gift', 'award', 'party'],
  '음악': ['music', 'headphones', 'mic'],
  '사진': ['image', 'camera'],
  '폴더': ['folder'],
  '휴지통': ['trash'],
  '삭제': ['trash', 'x'],
  '추가': ['plus', 'circle-plus'],
  '해': ['sun'],
  '달': ['moon'],
  '비': ['cloud', 'umbrella'],
  '꽃': ['flower', 'leaf', 'sprout', 'trees'],
  '커피': ['coffee', 'cup']
};

export function isLucideIconValue(val: string | undefined | null): boolean {
  return typeof val === 'string' && val.startsWith('lucide:');
}

export function normalizeLucideName(raw: string): string | null {
  const cleaned = raw.trim().replace(/^lucide:/i, '');
  if (!cleaned) return null;

  if (cleaned in icons) return cleaned;

  // Convert kebab-case / snake_case / space-separated / lowercase to PascalCase
  const pascal = cleaned
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  if (pascal in icons) return pascal;

  const lowerTarget = cleaned.toLowerCase().replace(/[-_\s]/g, '');
  const matched = ALL_LUCIDE_ICON_NAMES.find(
    k => k.toLowerCase() === lowerTarget
  );
  return matched || null;
}

export function toLucideIconValue(rawName: string): string | null {
  const normalized = normalizeLucideName(rawName);
  return normalized ? `lucide:${normalized}` : null;
}

export function getLucideDisplayName(val: string): string {
  if (!isLucideIconValue(val)) return val;
  return val.slice(7);
}

export function searchLucideIcons(query: string, limit = 84): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return FEATURED_LUCIDE_ICONS.filter(name => name in icons);
  }

  // Expand Korean keywords if present
  const expandedTerms: string[] = [q];
  Object.entries(KOREAN_ICON_KEYWORDS).forEach(([kor, engList]) => {
    if (kor.includes(q) || q.includes(kor)) {
      expandedTerms.push(...engList);
    }
  });

  const normalizedQ = q.replace(/[-_\s]/g, '');
  const exactMatches: string[] = [];
  const prefixMatches: string[] = [];
  const partialMatches: string[] = [];

  for (const name of ALL_LUCIDE_ICON_NAMES) {
    const lowerName = name.toLowerCase();
    if (lowerName === normalizedQ) {
      exactMatches.push(name);
    } else if (lowerName.startsWith(normalizedQ)) {
      prefixMatches.push(name);
    } else if (expandedTerms.some(term => lowerName.includes(term.replace(/[-_\s]/g, '')))) {
      partialMatches.push(name);
    }
    if (exactMatches.length + prefixMatches.length + partialMatches.length >= limit * 2) {
      // keep scanning for exact/prefix only if needed, break when plenty
      if (partialMatches.length >= limit) break;
    }
  }

  return [...exactMatches, ...prefixMatches, ...partialMatches].slice(0, limit);
}

export function loadCustomIcons(): CustomSavedIcon[] {
  try {
    const saved = localStorage.getItem(CUSTOM_ICONS_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomIcons(list: CustomSavedIcon[]): void {
  try {
    localStorage.setItem(CUSTOM_ICONS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

interface TopicIconProps {
  icon: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const TopicIcon: React.FC<TopicIconProps> = ({
  icon,
  size = 15,
  strokeWidth = 2.1,
  className = '',
  style
}) => {
  if (!icon) {
    return (
      <span
        className={`topic-icon-inline ${className}`.trim()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, ...style }}
      >
        <Tag size={size} strokeWidth={strokeWidth} aria-hidden="true" />
      </span>
    );
  }

  if (isLucideIconValue(icon)) {
    const resolvedName = normalizeLucideName(icon);
    const LucideComp = resolvedName ? icons[resolvedName as keyof typeof icons] : null;
    if (LucideComp) {
      return (
        <span
          className={`topic-icon-inline ${className}`.trim()}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0, ...style }}
        >
          <LucideComp size={size} strokeWidth={strokeWidth} aria-hidden="true" />
        </span>
      );
    }
    // Safe fallback if icon name is unknown or corrupted
    return (
      <span
        className={`topic-icon-inline ${className}`.trim()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0, ...style }}
      >
        <Tag size={size} strokeWidth={strokeWidth} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className={`topic-icon-inline ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        fontSize: `${Math.max(13, size + 1)}px`,
        flexShrink: 0,
        ...style
      }}
    >
      {icon}
    </span>
  );
};
