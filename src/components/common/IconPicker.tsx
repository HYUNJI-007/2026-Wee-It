import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Sparkles, Smile } from 'lucide-react';
import {
  PRESET_ICONS,
  CustomSavedIcon,
  TopicIcon,
  isLucideIconValue,
  getLucideDisplayName,
  searchLucideIcons,
  toLucideIconValue,
  normalizeLucideName
} from './TopicIcon';

interface IconPickerProps {
  value: string;
  onChange: (iconValue: string) => void;
  customIcons: CustomSavedIcon[];
  onAddCustomIcon: (iconValue: string, label?: string) => void;
  onDeleteCustomIcon: (id: string) => void;
  compact?: boolean;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  customIcons,
  onAddCustomIcon,
  onDeleteCustomIcon,
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [directEmoji, setDirectEmoji] = useState('');
  const [directLucideName, setDirectLucideName] = useState('');
  const [activeInputMode, setActiveInputMode] = useState<'search' | 'custom'>('search');

  const lucideResults = useMemo(() => {
    return searchLucideIcons(searchQuery, compact ? 48 : 84);
  }, [searchQuery, compact]);

  const directLucideResolved = useMemo(() => {
    return normalizeLucideName(directLucideName);
  }, [directLucideName]);

  const handleSelectLucide = (iconName: string, saveToCustom = false) => {
    const val = `lucide:${iconName}`;
    onChange(val);
    if (saveToCustom) {
      onAddCustomIcon(val, iconName);
    }
  };

  const handleAddDirectEmoji = () => {
    const trimmed = directEmoji.trim();
    if (!trimmed) return;
    onChange(trimmed);
    onAddCustomIcon(trimmed, trimmed);
    setDirectEmoji('');
  };

  const handleAddDirectLucide = () => {
    const val = toLucideIconValue(directLucideName);
    if (!val) return;
    const display = getLucideDisplayName(val);
    onChange(val);
    onAddCustomIcon(val, display);
    setDirectLucideName('');
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: compact ? '10px' : '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      {/* Top Row: Current Selected Icon Preview + Mode Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#EFEAF8',
              border: '1.5px solid #8265BD',
              color: '#6B4FA8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="현재 선택된 아이콘 미리보기"
          >
            <TopicIcon icon={value} size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>
              선택된 아이콘 미리보기
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              {isLucideIconValue(value) ? `Lucide: ${getLucideDisplayName(value)}` : `이모지: ${value || '없음'}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '8px', gap: '2px' }}>
          <button
            type="button"
            onClick={() => setActiveInputMode('search')}
            style={{
              border: 'none',
              background: activeInputMode === 'search' ? '#ffffff' : 'transparent',
              color: activeInputMode === 'search' ? '#6B4FA8' : '#64748b',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: activeInputMode === 'search' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Search size={12} />
            <span>아이콘 검색</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInputMode('custom')}
            style={{
              border: 'none',
              background: activeInputMode === 'custom' ? '#ffffff' : 'transparent',
              color: activeInputMode === 'custom' ? '#6B4FA8' : '#64748b',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: activeInputMode === 'custom' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Plus size={12} />
            <span>직접 추가</span>
          </button>
        </div>
      </div>

      {/* Existing Preset Recommended Icons (All 24 preserved!) */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '5px' }}>
          기본 추천 아이콘
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {PRESET_ICONS.map(icon => {
            const isSelected = value === icon;
            return (
              <button
                key={icon}
                type="button"
                onClick={() => onChange(icon)}
                title={`${icon} 선택`}
                style={{
                  border: isSelected ? '2px solid #8265BD' : '1px solid #e2e8f0',
                  background: isSelected ? '#EFEAF8' : '#ffffff',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Saved Custom Icons Library (Reusable & Deletable) */}
      {customIcons.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B4FA8', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={12} />
            <span>내 사용자 정의 아이콘 ({customIcons.length}개)</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {customIcons.map(item => {
              const isSelected = value === item.value;
              return (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onChange(item.value)}
                    title={`${item.label} 선택`}
                    style={{
                      border: isSelected ? '2px solid #8265BD' : '1px solid #d7ccf0',
                      background: isSelected ? '#EFEAF8' : '#faf9fd',
                      color: '#6B4FA8',
                      borderRadius: '8px',
                      height: '32px',
                      minWidth: '32px',
                      padding: '0 22px 0 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <TopicIcon icon={item.value} size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCustomIcon(item.id);
                    }}
                    title="사용자 아이콘 목록에서 삭제 (기존 카테고리는 유지됨)"
                    aria-label={`${item.label} 삭제`}
                    style={{
                      position: 'absolute',
                      right: '3px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(100, 116, 139, 0.14)',
                      color: '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 1: Full Lucide Icon Library Search */}
      {activeInputMode === 'search' ? (
        <div>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Lucide 아이콘 검색 (예: heart, 상담, 학교, calendar, 메모...)"
              style={{
                width: '100%',
                height: '36px',
                paddingLeft: '32px',
                paddingRight: searchQuery ? '30px' : '12px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="검색어 지우기"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: '2px'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
              gap: '5px',
              maxHeight: compact ? '130px' : '168px',
              overflowY: 'auto',
              padding: '4px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}
          >
            {lucideResults.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '16px 8px', fontSize: '0.78rem', color: '#64748b' }}>
                일치하는 Lucide 아이콘이 없습니다. 영문 아이콘명이나 다른 키워드로 검색해 보세요.
              </div>
            ) : (
              lucideResults.map(iconName => {
                const iconVal = `lucide:${iconName}`;
                const isSelected = value === iconVal;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => handleSelectLucide(iconName, true)}
                    title={`${iconName} (클릭 시 선택 및 저장)`}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #8265BD' : '1px solid #e2e8f0',
                      background: isSelected ? '#EFEAF8' : '#ffffff',
                      color: isSelected ? '#6B4FA8' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <TopicIcon icon={iconVal} size={17} />
                  </button>
                );
              })
            )}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
            {searchQuery
              ? `검색 결과 ${lucideResults.length}개 · 클릭하면 바로 선택되고 내 아이콘 목록에 저장됩니다.`
              : '추천 Lucide 아이콘 · 검색어를 입력하면 1,600개 이상의 전체 아이콘을 찾을 수 있습니다.'}
          </div>
        </div>
      ) : (
        /* Mode 2: Direct Custom Emoji or Lucide Icon Name Entry */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          {/* Direct Emoji Input */}
          <div>
            <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <Smile size={13} />
              <span>이모지 직접 입력</span>
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="원하는 이모지 입력 (예: 🦋, 🌻, 🧸)"
                value={directEmoji}
                onChange={e => setDirectEmoji(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDirectEmoji();
                  }
                }}
                style={{ flex: 1, height: '36px', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <button
                type="button"
                onClick={handleAddDirectEmoji}
                disabled={!directEmoji.trim()}
                className="btn"
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  background: directEmoji.trim() ? '#8265BD' : '#e2e8f0',
                  color: directEmoji.trim() ? '#ffffff' : '#94a3b8',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}
              >
                추가 및 적용
              </button>
            </div>
          </div>

          {/* Direct Lucide Icon Name Input */}
          <div>
            <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <Sparkles size={13} />
              <span>Lucide 아이콘 이름 직접 입력</span>
            </label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: directLucideResolved ? '#6B4FA8' : '#94a3b8',
                  flexShrink: 0
                }}
                title={directLucideResolved ? `미리보기: ${directLucideResolved}` : '유효한 이름을 입력하면 미리보기가 표시됩니다'}
              >
                {directLucideResolved ? <TopicIcon icon={`lucide:${directLucideResolved}`} size={17} /> : '?'}
              </div>
              <input
                type="text"
                placeholder="예: HeartHandshake, book-open, bell"
                value={directLucideName}
                onChange={e => setDirectLucideName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDirectLucide();
                  }
                }}
                style={{ flex: 1, height: '36px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <button
                type="button"
                onClick={handleAddDirectLucide}
                disabled={!directLucideResolved}
                className="btn"
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  background: directLucideResolved ? '#8265BD' : '#e2e8f0',
                  color: directLucideResolved ? '#ffffff' : '#94a3b8',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}
              >
                추가 및 적용
              </button>
            </div>
            {directLucideName.trim() && !directLucideResolved && (
              <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '3px' }}>
                일치하는 Lucide 아이콘 이름이 없습니다. 철자를 확인하거나 [아이콘 검색] 탭을 이용해 주세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
