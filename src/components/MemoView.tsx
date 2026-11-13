import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Pin,
  Copy,
  Check,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  Settings,
  Settings2,
  LayoutGrid,
  List,
  Plus,
  X,
  Search,
  StickyNote,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { CounselingRecord } from '../types';
import {
  TopicIcon,
  CustomSavedIcon,
  loadCustomIcons,
  saveCustomIcons,
  isLucideIconValue
} from './common/TopicIcon';
import { IconPicker } from './common/IconPicker';

export interface MemoTopic {
  id: string;
  name: string;
  icon: string;
}

export interface CounselingMemo {
  id: string;
  title: string;
  content: string;
  category: string; // matches topic.id or topic.name
  studentName?: string;
  color: 'pink' | 'yellow' | 'purple' | 'blue' | 'green';
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

interface MemoViewProps {
  records: CounselingRecord[];
  onSelectStudent: (studentName: string) => void;
}

export const DEFAULT_MEMO_TOPICS: MemoTopic[] = [
  { id: 'topic-call', name: '학부모·담임 통화', icon: '📞' },
  { id: 'topic-crisis', name: '위기·안전 점검', icon: '🚨' },
  { id: 'topic-supervision', name: '상담·슈퍼비전', icon: '💡' },
  { id: 'topic-admin', name: '행정·공문 업무', icon: '📋' },
  { id: 'topic-free', name: '자유 메모', icon: '☕' },
];

const COLOR_MAP: Record<CounselingMemo['color'], { bg: string; border: string; accent: string; label: string }> = {
  pink: { bg: '#fff0f5', border: 'rgba(224, 101, 139, 0.35)', accent: '#E0658B', label: '로즈' },
  yellow: { bg: '#fffdeb', border: 'rgba(245, 158, 11, 0.35)', accent: '#d97706', label: '레몬' },
  purple: { bg: '#f7f4ff', border: 'rgba(130, 101, 189, 0.35)', accent: '#8265BD', label: '라벤더' },
  blue: { bg: '#f0f9ff', border: 'rgba(56, 189, 248, 0.35)', accent: '#0284c7', label: '스카이' },
  green: { bg: '#f0fdf4', border: 'rgba(74, 222, 128, 0.35)', accent: '#16a34a', label: '민트' },
};

export const MemoView: React.FC<MemoViewProps> = ({ records, onSelectStudent }) => {
  // Custom Topics State (User can add, edit, rename, delete)
  const [topics, setTopics] = useState<MemoTopic[]>(() => {
    try {
      const saved = localStorage.getItem('wee_memo_topics_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_MEMO_TOPICS;
  });

  useEffect(() => {
    localStorage.setItem('wee_memo_topics_v3', JSON.stringify(topics));
  }, [topics]);

  // Topic Helper: resolves any category (legacy or new id/name) to active topic meta
  const getTopicMeta = (cat: string): MemoTopic => {
    const byId = topics.find(t => t.id === cat);
    if (byId) return byId;
    const byName = topics.find(t => t.name === cat);
    if (byName) return byName;

    // Legacy fallback keys
    if (cat === '통화') return topics.find(t => t.name.includes('통화')) || { id: 'call', name: '학부모·담임 통화', icon: '📞' };
    if (cat === '위기') return topics.find(t => t.name.includes('위기')) || { id: 'crisis', name: '위기·안전 점검', icon: '🚨' };
    if (cat === '아이디어') return topics.find(t => t.name.includes('상담') || t.name.includes('슈퍼비전')) || { id: 'supervision', name: '상담·슈퍼비전', icon: '💡' };
    if (cat === '행정') return topics.find(t => t.name.includes('행정')) || { id: 'admin', name: '행정·공문 업무', icon: '📋' };
    if (cat === '자유') return topics.find(t => t.name.includes('자유')) || { id: 'free', name: '자유 메모', icon: '☕' };

    return { id: cat, name: cat, icon: '📌' };
  };

  // Memos State
  const [memos, setMemos] = useState<CounselingMemo[]>(() => {
    try {
      const saved = localStorage.getItem('wee_counseling_memos_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (!localStorage.getItem('wee_memo_custom_ordered_v1')) {
            return [...parsed].sort((a: CounselingMemo, b: CounselingMemo) => {
              if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
              return b.updatedAt - a.updatedAt;
            });
          }
          return parsed;
        }
      }
      const old = localStorage.getItem('oneul_quick_memos_v2');
      if (old) {
        const parsedOld = JSON.parse(old);
        if (Array.isArray(parsedOld)) {
          return parsedOld
            .filter((m: any) => m.id !== 'memo-1' && m.id !== 'memo-2')
            .map((m: any) => ({
              id: m.id || `memo-${Date.now()}-${Math.random()}`,
              title: m.title || '상담 메모',
              content: m.text || '',
              category: 'topic-free',
              color: (m.color as any) || 'pink',
              isPinned: !!m.isPinned,
              createdAt: m.createdAt || Date.now(),
              updatedAt: m.createdAt || Date.now(),
            }));
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('wee_counseling_memos_v2', JSON.stringify(memos));
  }, [memos]);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Form State
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<string>(() => topics[0]?.id || 'topic-call');
  const [studentNameInput, setStudentNameInput] = useState('');
  const [colorInput, setColorInput] = useState<CounselingMemo['color']>('pink');
  const [isPinnedInput, setIsPinnedInput] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Topic Manager Modal State & User-Defined Icons Library
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicIcon, setNewTopicIcon] = useState('📌');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicIcon, setEditTopicIcon] = useState('');
  const [customIcons, setCustomIcons] = useState<CustomSavedIcon[]>(() => loadCustomIcons());

  // Custom Category Dropdown State (supports both Emoji and Lucide SVG icons inside options)
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const topicDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveCustomIcons(customIcons);
  }, [customIcons]);

  useEffect(() => {
    if (!isTopicDropdownOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target as Node)) {
        setIsTopicDropdownOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTopicDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isTopicDropdownOpen]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggedMemoId, setDraggedMemoId] = useState<string | null>(null);
  const [dragOverMemoId, setDragOverMemoId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAddCustomIcon = (iconValue: string, label?: string) => {
    const trimmed = iconValue.trim();
    if (!trimmed) return;
    setCustomIcons(prev => {
      if (prev.some(item => item.value === trimmed)) return prev;
      const nextItem: CustomSavedIcon = {
        id: `cicon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        value: trimmed,
        label: label || trimmed,
        createdAt: Date.now()
      };
      return [nextItem, ...prev];
    });
  };

  const handleDeleteCustomIcon = (id: string) => {
    setCustomIcons(prev => prev.filter(item => item.id !== id));
    showToast('사용자 정의 아이콘이 목록에서 삭제되었습니다.');
  };

  // Student names for autocomplete
  const studentNames = useMemo(() => {
    return Array.from(new Set(records.map(r => r.name?.trim()).filter(Boolean)));
  }, [records]);

  // Handle Edit Memo
  const handleStartEdit = (memo: CounselingMemo) => {
    const meta = getTopicMeta(memo.category);
    setEditingMemoId(memo.id);
    setTitleInput(memo.title);
    setContentInput(memo.content);
    setCategoryInput(meta.id);
    setStudentNameInput(memo.studentName || '');
    setColorInput(memo.color);
    setIsPinnedInput(memo.isPinned);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setEditingMemoId(null);
    setTitleInput('');
    setContentInput('');
    setCategoryInput(topics[0]?.id || 'topic-call');
    setStudentNameInput('');
    setColorInput('pink');
    setIsPinnedInput(false);
    setIsFormOpen(false);
  };

  // Submit Memo Form
  const handleSaveMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentInput.trim() && !titleInput.trim()) {
      showToast('메모 제목 또는 내용을 입력해 주세요.');
      return;
    }

    const now = Date.now();

    if (editingMemoId) {
      setMemos(prev =>
        prev.map(m =>
          m.id === editingMemoId
            ? {
                ...m,
                title: titleInput.trim() || '상담 메모',
                content: contentInput.trim(),
                category: categoryInput,
                studentName: studentNameInput.trim() || undefined,
                color: colorInput,
                isPinned: isPinnedInput,
                updatedAt: now,
              }
            : m
        )
      );
      showToast('메모가 수정되었습니다 ✨');
    } else {
      const newMemo: CounselingMemo = {
        id: `memo-${now}`,
        title: titleInput.trim() || '상담 메모',
        content: contentInput.trim(),
        category: categoryInput,
        studentName: studentNameInput.trim() || undefined,
        color: colorInput,
        isPinned: isPinnedInput,
        createdAt: now,
        updatedAt: now,
      };
      setMemos(prev => {
        if (newMemo.isPinned) {
          return [newMemo, ...prev];
        }
        const firstUnpinnedIdx = prev.findIndex(m => !m.isPinned);
        if (firstUnpinnedIdx === -1) return [...prev, newMemo];
        const next = [...prev];
        next.splice(firstUnpinnedIdx, 0, newMemo);
        return next;
      });
      showToast('새 메모가 등록되었습니다 📌');
    }

    handleCancelForm();
  };

  const handleDeleteMemo = (id: string) => {
    setConfirmDialog({
      title: '메모 삭제',
      message: '이 메모를 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: () => {
        setMemos(prev => prev.filter(m => m.id !== id));
        showToast('메모가 삭제되었습니다.');
        if (editingMemoId === id) handleCancelForm();
      }
    });
  };

  const handleTogglePin = (id: string) => {
    setMemos(prev => {
      const target = prev.find(m => m.id === id);
      if (!target) return prev;
      const updated = { ...target, isPinned: !target.isPinned };
      const rest = prev.filter(m => m.id !== id);
      if (updated.isPinned) {
        return [updated, ...rest];
      }
      const firstUnpinnedIdx = rest.findIndex(m => !m.isPinned);
      if (firstUnpinnedIdx === -1) return [...rest, updated];
      const next = [...rest];
      next.splice(firstUnpinnedIdx, 0, updated);
      return next;
    });
  };

  const handleDropMemo = (targetMemoId: string) => {
    if (!draggedMemoId || draggedMemoId === targetMemoId) {
      setDraggedMemoId(null);
      setDragOverMemoId(null);
      return;
    }
    setMemos(prev => {
      const fromIdx = prev.findIndex(m => m.id === draggedMemoId);
      const toIdx = prev.findIndex(m => m.id === targetMemoId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    localStorage.setItem('wee_memo_custom_ordered_v1', '1');
    setDraggedMemoId(null);
    setDragOverMemoId(null);
  };

  const handleCopyMemo = (memo: CounselingMemo) => {
    const meta = getTopicMeta(memo.category);
    const studentTag = memo.studentName ? `[내담자: ${memo.studentName}]\n` : '';
    const iconPrefix = isLucideIconValue(meta.icon) ? '' : `${meta.icon} `;
    const categoryTag = `[${iconPrefix}${meta.name}]\n`;
    const fullText = `${categoryTag}${studentTag}${memo.title ? `${memo.title}\n` : ''}${memo.content}`;

    navigator.clipboard.writeText(fullText);
    setCopiedId(memo.id);
    showToast('메모가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Topic Manager Actions ---
  const handleAddNewTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTopicName.trim();
    if (!name) {
      showToast('카테고리 명칭을 입력해 주세요.');
      return;
    }
    if (topics.some(t => t.name === name)) {
      showToast('이미 동일한 이름의 카테고리가 있습니다.');
      return;
    }

    const newTopic: MemoTopic = {
      id: `topic-${Date.now()}`,
      name,
      icon: newTopicIcon || '📌'
    };

    setTopics(prev => [...prev, newTopic]);
    setNewTopicName('');
    showToast(`새 카테고리 "${name}"이(가) 추가되었습니다 ✨`);
  };

  const handleStartEditTopic = (topic: MemoTopic) => {
    setEditingTopicId(topic.id);
    setEditTopicName(topic.name);
    setEditTopicIcon(topic.icon);
  };

  const handleSaveEditTopic = (id: string) => {
    const name = editTopicName.trim();
    if (!name) {
      showToast('카테고리 명칭을 입력해 주세요.');
      return;
    }

    setTopics(prev =>
      prev.map(t => (t.id === id ? { ...t, name, icon: editTopicIcon || t.icon } : t))
    );
    setEditingTopicId(null);
    showToast('카테고리 내용이 수정되었습니다.');
  };

  const handleDeleteTopic = (id: string, name: string) => {
    if (topics.length <= 1) {
      showToast('최소 1개 이상의 카테고리가 유지되어야 합니다.');
      return;
    }

    const relatedCount = memos.filter(m => {
      const meta = getTopicMeta(m.category);
      return meta.id === id;
    }).length;

    const confirmMsg = relatedCount > 0
      ? `"${name}" 카테고리를 삭제하시겠습니까?\n이 카테고리를 사용하는 메모 ${relatedCount}개는 다른 카테고리로 자동 변경됩니다.`
      : `"${name}" 카테고리를 삭제하시겠습니까?`;

    setConfirmDialog({
      title: '카테고리 삭제',
      message: confirmMsg,
      confirmLabel: '삭제',
      onConfirm: () => {
        setTopics(prev => prev.filter(t => t.id !== id));
        const fallbackTopicId = topics.find(t => t.id !== id)?.id || 'topic-free';
        setMemos(prev =>
          prev.map(m => {
            const meta = getTopicMeta(m.category);
            return meta.id === id ? { ...m, category: fallbackTopicId } : m;
          })
        );
        if (activeCategoryFilter === id) {
          setActiveCategoryFilter('all');
        }
        showToast('카테고리가 삭제되었습니다.');
      }
    });
  };

  const handleResetDefaultTopics = () => {
    setConfirmDialog({
      title: '카테고리 목록 초기화',
      message: '모든 카테고리를 초기 기본 상태(5가지 항목)로 되돌리시겠습니까?',
      confirmLabel: '초기화',
      onConfirm: () => {
        setTopics(DEFAULT_MEMO_TOPICS);
        showToast('기본 카테고리 목록으로 초기화되었습니다.');
      }
    });
  };

  // Filtered & Sorted Memos
  const filteredMemos = useMemo(() => {
    let result = memos;

    if (activeCategoryFilter !== 'all') {
      result = result.filter(m => {
        const meta = getTopicMeta(m.category);
        return meta.id === activeCategoryFilter || meta.name === activeCategoryFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        m =>
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          (m.studentName && m.studentName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [memos, activeCategoryFilter, searchQuery, topics]);

  return (
    <div id="memoPage" style={{ position: 'relative' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(51, 49, 62, 0.94)',
            color: '#ffffff',
            padding: '10px 24px',
            borderRadius: '30px',
            fontSize: '0.88rem',
            fontWeight: 800,
            zIndex: 99999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header Banner Card */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="card-title" style={{ margin: 0, paddingBottom: 0, border: 'none' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="menu-emoji menu-emoji--lg" aria-hidden="true">📨</span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
                메모기록
              </h2>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--accent)',
                  background: 'var(--accent-light)',
                  padding: '2px 10px',
                  borderRadius: '12px'
                }}
              >
                총 {memos.length}개
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
              중요한 내용들을 편리하게 기록하고 주제를 자유롭게 관리하세요.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
            {/* Topic Management Button */}
            <button
              type="button"
              className="app-btn app-btn--md app-btn--subtle app-btn--pill"
              onClick={() => setIsTopicModalOpen(true)}
              style={{ borderColor: '#cbd5e1', color: '#334155' }}
              title="메모의 카테고리 편집"
            >
              <Settings size={14} strokeWidth={2} />
              <span>카테고리 편집</span>
            </button>

            {/* Create Memo Button */}
            <button
              type="button"
              className={`app-btn app-btn--md app-btn--pill ${isFormOpen && !editingMemoId ? 'app-btn--subtle' : 'app-btn--primary'}`}
              onClick={() => {
                if (isFormOpen && !editingMemoId) {
                  setIsFormOpen(false);
                } else {
                  handleCancelForm();
                  setIsFormOpen(true);
                }
              }}
            >
              {isFormOpen && !editingMemoId ? (
                <>
                  <X size={14} strokeWidth={2.2} />
                  <span>닫기</span>
                </>
              ) : (
                <>
                  <Plus size={15} strokeWidth={2.2} />
                  <span>새 메모 작성</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Memo Creation / Edit Drawer Card */}
      {isFormOpen && (
        <div
          className="card"
          style={{
            marginBottom: '18px',
            border: '2px solid var(--accent)',
            background: 'linear-gradient(145deg, #ffffff 0%, #fffcfd 100%)',
            boxShadow: '0 4px 16px rgba(224, 101, 139, 0.1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #fce7f3', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center' }}>
                {editingMemoId ? <Pencil size={17} strokeWidth={2} /> : <Plus size={18} strokeWidth={2.2} />}
              </span>
              <span style={{ fontWeight: 900, fontSize: '0.96rem', color: 'var(--text-main)' }}>
                {editingMemoId ? '메모 수정하기' : '새 상담 메모 등록'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelForm}
              className="app-icon-btn app-icon-btn--circle"
              title="닫기"
              aria-label="메모 입력 창 닫기"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <form onSubmit={handleSaveMemo}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '12px' }}>
              <div className="input-group" ref={topicDropdownRef} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>메모 주제 (분류)</label>
                  <button
                    type="button"
                    onClick={() => setIsTopicModalOpen(true)}
                    className="app-btn app-btn--xs"
                    style={{ background: 'transparent', color: '#8265BD', padding: '0 4px', height: '22px' }}
                  >
                    <Settings2 size={12} strokeWidth={2} />
                    <span>카테고리 편집</span>
                  </button>
                </div>
                {(() => {
                  const selectedTopic = getTopicMeta(categoryInput);
                  return (
                    <>
                      <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={isTopicDropdownOpen}
                        onClick={() => setIsTopicDropdownOpen(prev => !prev)}
                        className="app-select"
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 38px 0 14px',
                          border: isTopicDropdownOpen ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                          borderRadius: '10px',
                          background: '#ffffff',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          textAlign: 'left',
                          position: 'relative',
                          cursor: 'pointer',
                          boxShadow: isTopicDropdownOpen ? '0 0 0 3px rgba(224, 101, 139, 0.14)' : 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s'
                        }}
                      >
                        <TopicIcon icon={selectedTopic.icon} size={15} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedTopic.name}
                        </span>
                        <ChevronDown
                          size={15}
                          strokeWidth={2.2}
                          className="app-select-chevron"
                          style={{
                            color: '#64748b',
                            transform: isTopicDropdownOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
                            transition: 'transform 0.18s ease'
                          }}
                        />
                      </button>

                      {isTopicDropdownOpen && (
                        <div
                          role="listbox"
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '12px',
                            boxShadow: '0 14px 32px rgba(15, 23, 42, 0.14)',
                            padding: '5px',
                            zIndex: 60,
                            maxHeight: '240px',
                            overflowY: 'auto'
                          }}
                        >
                          {topics.map(t => {
                            const isSelected = t.id === selectedTopic.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setCategoryInput(t.id);
                                  setIsTopicDropdownOpen(false);
                                }}
                                style={{
                                  width: '100%',
                                  border: 'none',
                                  background: isSelected ? '#EFEAF8' : 'transparent',
                                  color: isSelected ? '#6B4FA8' : 'var(--text-main)',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  fontSize: '0.85rem',
                                  fontWeight: isSelected ? 800 : 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  textAlign: 'left',
                                  cursor: 'pointer'
                                }}
                              >
                                <TopicIcon icon={t.icon} size={15} />
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.name}
                                </span>
                                {isSelected && <Check size={14} strokeWidth={2.5} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="input-group">
                <label>연계 내담자 (선택사항)</label>
                <input
                  type="text"
                  placeholder="내담자 학생 성명 (사례관리 연동)"
                  list="memoStudentList"
                  value={studentNameInput}
                  onChange={e => setStudentNameInput(e.target.value)}
                  style={{ height: '38px' }}
                />
                <datalist id="memoStudentList">
                  {studentNames.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label>스티커 색상</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '38px' }}>
                  {Object.entries(COLOR_MAP).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setColorInput(key as any)}
                      title={val.label}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: val.bg,
                        border: colorInput === key ? `2.5px solid ${val.accent}` : '1.5px solid rgba(0,0,0,0.12)',
                        cursor: 'pointer',
                        transform: colorInput === key ? 'scale(1.2)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '12px' }}>
              <label>메모 제목</label>
              <input
                type="text"
                placeholder="제목을 입력하세요."
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                style={{ height: '38px', fontWeight: 700 }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '14px' }}>
              <label>메모 상세 내용</label>
              <textarea
                placeholder="상세 내용을 자유롭게 작성하세요..."
                value={contentInput}
                onChange={e => setContentInput(e.target.value)}
                style={{ height: '140px', padding: '12px', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={isPinnedInput}
                  onChange={e => setIsPinnedInput(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                />
                <Pin size={14} strokeWidth={2} />
                <span>상단 고정</span>
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="app-btn app-btn--md app-btn--subtle app-btn--pill"
                >
                  <X size={14} strokeWidth={2} />
                  <span>취소</span>
                </button>
                <button
                  type="submit"
                  className="app-btn app-btn--md app-btn--primary app-btn--pill"
                >
                  {editingMemoId ? <Check size={14} strokeWidth={2.3} /> : <Plus size={14} strokeWidth={2.3} />}
                  <span>{editingMemoId ? '수정 완료' : '메모 등록'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '18px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Dynamic Category Chips from Editable Topics */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('all')}
              style={{
                border: '1.5px solid',
                borderColor: activeCategoryFilter === 'all' ? 'var(--accent)' : 'var(--border)',
                background: activeCategoryFilter === 'all' ? 'var(--accent)' : '#ffffff',
                color: activeCategoryFilter === 'all' ? '#ffffff' : 'var(--text-sub)',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <LayoutGrid size={13} strokeWidth={2} />
              <span>전체 ({memos.length})</span>
            </button>

            {topics.map(t => {
              const count = memos.filter(m => {
                const meta = getTopicMeta(m.category);
                return meta.id === t.id;
              }).length;
              const isSelected = activeCategoryFilter === t.id;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveCategoryFilter(t.id)}
                  style={{
                    border: '1.5px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isSelected ? 'var(--accent-light)' : '#ffffff',
                    color: isSelected ? 'var(--accent)' : 'var(--text-main)',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 900 : 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <TopicIcon icon={t.icon} size={14} />
                  <span>{t.name}</span>
                  <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>({count})</span>
                </button>
              );
            })}

            {/* Quick Manage Topic Button */}
            <button
              type="button"
              onClick={() => setIsTopicModalOpen(true)}
              className="app-btn app-btn--sm app-btn--subtle app-btn--pill"
              style={{ borderStyle: 'dashed', borderColor: '#cbd5e1', color: '#64748b' }}
              title="새로운 주제 추가 또는 기존 주제 수정"
            >
              <Settings size={13} strokeWidth={2} />
              <span>카테고리 편집</span>
            </button>
          </div>

          {/* Search Input & View Mode */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 240px', maxWidth: '360px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search
                size={14}
                strokeWidth={2}
                style={{
                  position: 'absolute',
                  left: '13px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: searchQuery ? 'var(--accent)' : '#94a3b8',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                placeholder="메모 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  height: '38px',
                  fontSize: '0.84rem',
                  borderRadius: '9999px',
                  padding: searchQuery ? '0 34px 0 34px' : '0 14px 0 34px',
                  border: searchQuery ? '1.5px solid var(--accent)' : '1.5px solid var(--border)'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="검색어 초기화"
                  aria-label="검색어 초기화"
                  className="app-icon-btn app-icon-btn--xs app-icon-btn--circle"
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '9px', padding: '3px', gap: '2px', flexShrink: 0 }} className="no-print">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="카드 그리드 보기"
                aria-label="카드 그리드 보기"
                className="app-icon-btn app-icon-btn--xs"
                style={{
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--text-main)' : '#64748b',
                  boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <LayoutGrid size={15} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="리스트 목록 보기"
                aria-label="리스트 목록 보기"
                className="app-icon-btn app-icon-btn--xs"
                style={{
                  background: viewMode === 'list' ? '#ffffff' : 'transparent',
                  color: viewMode === 'list' ? 'var(--text-main)' : '#64748b',
                  boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <List size={15} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Memos Display Board */}
      {filteredMemos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-sub)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', background: 'var(--accent-light)', color: 'var(--accent)', marginBottom: '12px' }}>
            <StickyNote size={26} strokeWidth={1.8} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {searchQuery ? `"${searchQuery}"에 일치하는 메모가 없습니다.` : '작성된 상담 메모가 없습니다.'}
          </h3>
          <p style={{ margin: '6px 0 16px', fontSize: '0.84rem' }}>
            중요한 내용을 상단의 <strong>새 메모 작성</strong> 버튼을 눌러 등록해보세요.
          </p>
          <button
            type="button"
            className="app-btn app-btn--md app-btn--primary app-btn--pill"
            onClick={() => {
              setSearchQuery('');
              setActiveCategoryFilter('all');
              handleCancelForm();
              setIsFormOpen(true);
            }}
          >
            <Plus size={15} strokeWidth={2.2} />
            <span>첫 번째 메모 작성하기</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Board View */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredMemos.map(memo => {
            const theme = COLOR_MAP[memo.color || 'pink'] || COLOR_MAP.pink;
            const categoryMeta = getTopicMeta(memo.category);
            const dateObj = new Date(memo.createdAt);
            const dateLabel = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

            const isDragging = draggedMemoId === memo.id;
            const isDragOver = dragOverMemoId === memo.id && draggedMemoId !== memo.id;

            return (
              <div
                key={memo.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', memo.id);
                  setDraggedMemoId(memo.id);
                }}
                onDragOver={(e) => {
                  if (!draggedMemoId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverMemoId !== memo.id) setDragOverMemoId(memo.id);
                }}
                onDragLeave={() => {
                  if (dragOverMemoId === memo.id) setDragOverMemoId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropMemo(memo.id);
                }}
                onDragEnd={() => {
                  setDraggedMemoId(null);
                  setDragOverMemoId(null);
                }}
                style={{
                  background: theme.bg,
                  border: `1.5px solid ${isDragOver ? '#8265BD' : theme.border}`,
                  borderRadius: '16px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: isDragOver
                    ? '0 0 0 3px rgba(130, 101, 189, 0.22)'
                    : memo.isPinned
                      ? '0 4px 14px rgba(0,0,0,0.08)'
                      : '0 2px 6px rgba(0,0,0,0.02)',
                  opacity: isDragging ? 0.45 : 1,
                  transform: isDragging ? 'scale(0.98)' : isDragOver ? 'translateY(-2px)' : 'none',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transition: 'all 0.18s ease'
                }}
              >
                {/* Header Row: Drag Handle + Category Badge + Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span
                      title="드래그하여 메모 위치 이동"
                      style={{
                        color: '#94a3b8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        userSelect: 'none',
                        flexShrink: 0
                      }}
                    >
                      <GripVertical size={14} strokeWidth={2} />
                    </span>
                    <span
                      onClick={() => setActiveCategoryFilter(categoryMeta.id)}
                      title={`"${categoryMeta.name}" 주제로 필터`}
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: '7px',
                        background: '#ffffff',
                        border: `1px solid ${theme.border}`,
                        color: theme.accent,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        minWidth: 0
                      }}
                    >
                      <TopicIcon icon={categoryMeta.icon} size={13} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {categoryMeta.name}
                      </span>
                    </span>
                  </div>

                  {/* Unified Action Buttons */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(memo.id)}
                      title={memo.isPinned ? '상단 고정 해제' : '상단 고정'}
                      aria-label={memo.isPinned ? '상단 고정 해제' : '상단 고정'}
                      className={`app-icon-btn has-mobile-label ${memo.isPinned ? 'app-icon-btn--active' : ''}`}
                    >
                      <Pin size={15} strokeWidth={2} fill={memo.isPinned ? 'currentColor' : 'none'} />
                      <span className="app-icon-btn-label">고정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyMemo(memo)}
                      title="메모 전체 텍스트 복사"
                      aria-label="메모 전체 텍스트 복사"
                      className={`app-icon-btn has-mobile-label ${copiedId === memo.id ? 'app-icon-btn--success' : ''}`}
                    >
                      {copiedId === memo.id ? <Check size={15} strokeWidth={2.3} /> : <Copy size={15} strokeWidth={2} />}
                      <span className="app-icon-btn-label">{copiedId === memo.id ? '복사됨' : '복사'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(memo)}
                      title="메모 수정"
                      aria-label="메모 수정"
                      className="app-icon-btn has-mobile-label"
                    >
                      <Pencil size={15} strokeWidth={2} />
                      <span className="app-icon-btn-label">수정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMemo(memo.id)}
                      title="메모 삭제"
                      aria-label="메모 삭제"
                      className="app-icon-btn app-icon-btn--danger has-mobile-label"
                    >
                      <Trash2 size={15} strokeWidth={2} />
                      <span className="app-icon-btn-label">삭제</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.4 }}>
                  {memo.title}
                </h4>

                {/* Content */}
                <div
                  style={{
                    fontSize: '0.84rem',
                    color: '#334155',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    flex: 1,
                    marginBottom: '12px'
                  }}
                >
                  {memo.content}
                </div>

                {/* Footer: Student Link + Date */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: `1px dashed ${theme.border}`,
                    paddingTop: '8px',
                    marginTop: 'auto'
                  }}
                >
                  {memo.studentName ? (
                    <button
                      type="button"
                      onClick={() => onSelectStudent(memo.studentName!)}
                      title={`${memo.studentName} 내담자의 사례관리 페이지로 바로가기`}
                      style={{
                        border: `1px solid ${theme.border}`,
                        background: '#ffffff',
                        color: theme.accent,
                        padding: '3px 9px',
                        borderRadius: '9999px',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span className="menu-emoji menu-emoji--sm" aria-hidden="true">🧸</span>
                      <span>{memo.studentName}</span>
                      <ArrowRight size={11} strokeWidth={2.2} style={{ opacity: 0.75 }} />
                      <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>사례관리</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <span style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>
                    {dateLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List Table View */
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="stat-table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '14%', padding: '10px' }}>주제</th>
                <th style={{ width: '22%', padding: '10px' }}>제목</th>
                <th style={{ width: '36%', padding: '10px' }}>내용</th>
                <th style={{ width: '12%', padding: '10px' }}>내담자</th>
                <th style={{ width: '16%', padding: '10px' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredMemos.map(memo => {
                const categoryMeta = getTopicMeta(memo.category);
                const d = new Date(memo.createdAt);
                const dateLabel = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

                const isDragging = draggedMemoId === memo.id;
                const isDragOver = dragOverMemoId === memo.id && draggedMemoId !== memo.id;

                return (
                  <tr
                    key={memo.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', memo.id);
                      setDraggedMemoId(memo.id);
                    }}
                    onDragOver={(e) => {
                      if (!draggedMemoId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverMemoId !== memo.id) setDragOverMemoId(memo.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverMemoId === memo.id) setDragOverMemoId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropMemo(memo.id);
                    }}
                    onDragEnd={() => {
                      setDraggedMemoId(null);
                      setDragOverMemoId(null);
                    }}
                    style={{
                      background: isDragOver ? '#f5f0ff' : memo.isPinned ? '#fff9fb' : '#ffffff',
                      opacity: isDragging ? 0.45 : 1,
                      outline: isDragOver ? '2px solid #8265BD' : 'none',
                      cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                  >
                    <td style={{ fontWeight: 800, color: 'var(--accent)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', userSelect: 'none' }}
                          title="드래그하여 순서 변경"
                        >
                          <GripVertical size={14} strokeWidth={2} />
                        </span>
                        <TopicIcon icon={categoryMeta.icon} size={14} />
                        <span>{categoryMeta.name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'left', fontWeight: 800 }}>{memo.title}</td>
                    <td style={{ textAlign: 'left', color: '#475569', fontSize: '0.82rem' }}>
                      <div style={{ maxHeight: '42px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {memo.content}
                      </div>
                    </td>
                    <td>
                      {memo.studentName ? (
                        <button
                          type="button"
                          onClick={() => onSelectStudent(memo.studentName!)}
                          style={{
                            border: '1px solid var(--accent)',
                            background: 'var(--accent-light)',
                            color: 'var(--accent)',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {memo.studentName}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePin(memo.id)}
                          title={memo.isPinned ? '상단 고정 해제' : '상단 고정'}
                          aria-label={memo.isPinned ? '상단 고정 해제' : '상단 고정'}
                          className={`app-icon-btn has-mobile-label ${memo.isPinned ? 'app-icon-btn--active' : ''}`}
                        >
                          <Pin size={15} strokeWidth={2} fill={memo.isPinned ? 'currentColor' : 'none'} />
                          <span className="app-icon-btn-label">고정</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyMemo(memo)}
                          title="메모 전체 텍스트 복사"
                          aria-label="메모 전체 텍스트 복사"
                          className={`app-icon-btn has-mobile-label ${copiedId === memo.id ? 'app-icon-btn--success' : ''}`}
                        >
                          {copiedId === memo.id ? <Check size={15} strokeWidth={2.3} /> : <Copy size={15} strokeWidth={2} />}
                          <span className="app-icon-btn-label">{copiedId === memo.id ? '복사됨' : '복사'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(memo)}
                          title="메모 수정"
                          aria-label="메모 수정"
                          className="app-icon-btn has-mobile-label"
                        >
                          <Pencil size={15} strokeWidth={2} />
                          <span className="app-icon-btn-label">수정</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMemo(memo.id)}
                          title="메모 삭제"
                          aria-label="메모 삭제"
                          className="app-icon-btn app-icon-btn--danger has-mobile-label"
                        >
                          <Trash2 size={15} strokeWidth={2} />
                          <span className="app-icon-btn-label">삭제</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Topic Manager Modal (Viewport Popup) */}
      {isTopicModalOpen && createPortal(
        <div
          className="modal"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => {
            setIsTopicModalOpen(false);
            setEditingTopicId(null);
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '540px',
              width: '92%',
              maxHeight: '88vh',
              overflowY: 'auto',
              borderRadius: '20px',
              padding: '24px'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#8265BD', display: 'inline-flex', alignItems: 'center' }}>
                  <Settings size={19} strokeWidth={2} />
                </span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>
                  메모 카테고리 추가 및 편집
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTopicModalOpen(false);
                  setEditingTopicId(null);
                }}
                className="app-icon-btn app-icon-btn--circle"
                title="닫기"
                aria-label="카테고리 편집 창 닫기"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: '16px' }}>
              상담 업무에 맞게 원하는 카테고리를 새로 추가하거나, 기존에 등록된 카테고리의 명칭과 아이콘을 자유롭게 수정·삭제할 수 있습니다.
            </p>

            {/* Add New Topic Form */}
            <form
              onSubmit={handleAddNewTopic}
              style={{
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '14px',
                padding: '14px',
                marginBottom: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={15} strokeWidth={2.2} style={{ color: '#8265BD' }} />
                <span>새 카테고리 추가하기</span>
              </div>

              <IconPicker
                value={newTopicIcon}
                onChange={setNewTopicIcon}
                customIcons={customIcons}
                onAddCustomIcon={handleAddCustomIcon}
                onDeleteCustomIcon={handleDeleteCustomIcon}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="예: 집단상담, 학업중단숙려제, 외부연계..."
                  value={newTopicName}
                  onChange={e => setNewTopicName(e.target.value)}
                  style={{
                    flex: 1,
                    height: '38px',
                    fontSize: '0.84rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '0 12px'
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{
                    background: '#8265BD',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    padding: '0 16px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <TopicIcon icon={newTopicIcon} size={15} />
                  <span>카테고리 추가</span>
                </button>
              </div>
            </form>

            {/* List of Existing Topics */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                현재 등록된 카테고리 목록 ({topics.length}개)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {topics.map(topic => {
                  const isEditing = editingTopicId === topic.id;
                  const memoCount = memos.filter(m => {
                    const meta = getTopicMeta(m.category);
                    return meta.id === topic.id;
                  }).length;

                  if (isEditing) {
                    return (
                      <div
                        key={topic.id}
                        style={{
                          background: '#EFEAF8',
                          border: '1.5px solid #8265BD',
                          borderRadius: '12px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              background: '#ffffff',
                              border: '1px solid #C6B6E8',
                              color: '#6B4FA8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            title="선택된 아이콘"
                          >
                            <TopicIcon icon={editTopicIcon || topic.icon} size={18} />
                          </div>
                          <input
                            type="text"
                            value={editTopicName}
                            onChange={e => setEditTopicName(e.target.value)}
                            style={{ flex: 1, height: '38px', fontSize: '0.85rem', fontWeight: 800, borderRadius: '8px', border: '1px solid #C6B6E8', padding: '0 10px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditTopic(topic.id)}
                            className="app-btn app-btn--md app-btn--purple"
                            style={{ height: '38px' }}
                          >
                            <Check size={14} strokeWidth={2.2} />
                            <span>저장</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTopicId(null)}
                            className="app-btn app-btn--md app-btn--subtle"
                            style={{ height: '38px' }}
                          >
                            <X size={14} strokeWidth={2} />
                            <span>취소</span>
                          </button>
                        </div>

                        <IconPicker
                          value={editTopicIcon}
                          onChange={setEditTopicIcon}
                          customIcons={customIcons}
                          onAddCustomIcon={handleAddCustomIcon}
                          onDeleteCustomIcon={handleDeleteCustomIcon}
                          compact
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={topic.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#6B4FA8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <TopicIcon icon={topic.icon} size={15} />
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          {topic.name}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '8px' }}>
                          {memoCount}건
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditTopic(topic)}
                          className="app-icon-btn"
                          title="카테고리 제목 및 아이콘 편집"
                          aria-label="카테고리 편집"
                          style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
                        >
                          <Pencil size={14} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopic(topic.id, topic.name)}
                          className="app-icon-btn app-icon-btn--danger"
                          title="카테고리 삭제"
                          aria-label="카테고리 삭제"
                          style={{ borderColor: '#fecaca', background: '#fef2f2' }}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={handleResetDefaultTopics}
                className="app-btn app-btn--sm app-btn--subtle"
                style={{ background: 'transparent', borderColor: 'transparent', color: '#64748b' }}
              >
                <RotateCcw size={13} strokeWidth={2} />
                <span>기본 카테고리 목록으로 초기화</span>
              </button>

              <button
                type="button"
                className="app-btn app-btn--md app-btn--primary app-btn--pill"
                onClick={() => {
                  setIsTopicModalOpen(false);
                  setEditingTopicId(null);
                }}
                style={{ padding: '0 22px' }}
              >
                <Check size={14} strokeWidth={2.2} />
                <span>완료</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom In-App Confirmation Modal (Works reliably inside iframe without window.confirm) */}
      {confirmDialog && createPortal(
        <div
          className="modal"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000
          }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '380px',
              width: '90%',
              borderRadius: '20px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.22)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '14px', background: '#fef2f2', color: '#dc2626', marginBottom: '12px' }}>
              <Trash2 size={22} strokeWidth={2} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)' }}>
              {confirmDialog.title}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.86rem', color: 'var(--text-sub)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                type="button"
                className="app-btn app-btn--md app-btn--subtle app-btn--pill"
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1 }}
              >
                <X size={14} strokeWidth={2} />
                <span>취소</span>
              </button>
              <button
                type="button"
                className="app-btn app-btn--md app-btn--danger app-btn--pill"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                style={{ flex: 1 }}
              >
                <Trash2 size={14} strokeWidth={2} />
                <span>{confirmDialog.confirmLabel || '확인'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
