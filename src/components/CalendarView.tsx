import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  CornerDownRight,
  Ellipsis,
  FileCode2,
  GripVertical,
  HeartHandshake,
  Info,
  Layers,
  Link2,
  ListTodo,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  X
} from 'lucide-react';
import { CounselingRecord } from '../types';
import { cleanDateStr, cleanTimeStr, splitDateTime, pad2 } from '../utils/dateTime';
import { AppSelect } from './common/AppSelect';

const cleanLabelText = (raw?: string): string => {
  if (!raw) return '';
  return raw
    .replace(/:\s*#[0-9a-fA-F]{3,8}\b/gi, '')
    .replace(/#[0-9a-fA-F]{3,8}\b/gi, '')
    .replace(/^:+|:+$/g, '')
    .trim();
};

const cleanGoogleTitleText = (raw?: string): string => {
  if (!raw) return '(제목 없음)';
  const cleaned = raw
    .replace(/\[([^:\]]*?):\s*#[0-9a-fA-F]{3,8}\]/gi, (_m, lbl) => {
      const c = String(lbl || '').trim();
      return c ? `[${c}]` : '';
    })
    .replace(/\[\s*#[0-9a-fA-F]{3,8}\s*\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || '(제목 없음)';
};

const BASE_GOOGLE_PREFIX_TAGS = new Set([
  'wee',
  'wee센터',
  'wee클래스',
  '순회',
  '순회상담',
  '기관'
]);

const parseCalendarNicknames = (calIdConfig?: string): string[] => {
  if (!calIdConfig) return [];
  return calIdConfig
    .split(',')
    .map(entry => {
      const idx = entry.indexOf(':');
      if (idx === -1) return '';
      return cleanLabelText(entry.slice(idx + 1)).toLowerCase();
    })
    .filter(Boolean);
};

const formatGoogleDisplayTitle = (
  rawTitle?: string,
  extraCalendarNicknames: string[] = []
): string => {
  const base = cleanGoogleTitleText(rawTitle);
  if (!base || base === '(제목 없음)') return base || '(제목 없음)';

  const prefixSet = new Set(BASE_GOOGLE_PREFIX_TAGS);
  extraCalendarNicknames.forEach(nick => {
    const cleaned = cleanLabelText(nick).toLowerCase();
    if (cleaned) prefixSet.add(cleaned);
  });

  let remaining = base;
  // Strip stacked leading calendar prefix tags like [Wee] [기관] ... while preserving general brackets
  while (true) {
    const match = remaining.match(/^\s*\[([^\]]+)\]\s*/);
    if (!match) break;
    const normalizedTag = cleanLabelText(match[1]).toLowerCase();
    if (!normalizedTag || !prefixSet.has(normalizedTag)) {
      break;
    }
    remaining = remaining.slice(match[0].length);
  }

  const collapsed = remaining.replace(/\s{2,}/g, ' ').trim();
  return collapsed || base;
};

interface CalendarViewProps {
  records: CounselingRecord[];
  onSelectStudent: (studentName: string) => void;
  googleCalendarUrl?: string;
  initialMode?: 'counseling' | 'google';
}

export type FilterCategory = '전체' | 'Wee' | '순회' | 'To Do';

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  category: 'Wee' | '순회' | 'To Do' | 'default';
  studentName?: string;
  counselingType?: 'completed' | 'appointment' | 'custom' | 'google';
  source?: 'counseling' | 'custom' | 'google';
  googleEventId?: string;
  googleCalendarId?: string;
}

export interface ToDoItem {
  id: string;
  text: string;
  detail?: string;
  date: string;
  done: boolean;
  createdAt: number;
  googleTaskId?: string;
  googleTaskListId?: string;
  source?: 'local' | 'google';
}

const FILTER_CONFIG = {
  '전체': { bg: '#FFE8EE', color: '#E0658B' },
  'Wee': { bg: '#EFEAF8', color: '#8265BD' },
  '순회': { bg: '#E3F2FD', color: '#3A86C8' },
  'To Do': { bg: '#E8F5E9', color: '#43A047' },
  'default': { bg: '#FFE8EE', color: '#E0658B' }
};

const renderCategoryIcon = (category: FilterCategory | 'default', size = 13) => {
  switch (category) {
    case '전체':
      return <Layers size={size} strokeWidth={2} />;
    case 'Wee':
      return <HeartHandshake size={size} strokeWidth={2} />;
    case '순회':
      return <Navigation size={size} strokeWidth={2} />;
    case 'To Do':
      return <CheckSquare size={size} strokeWidth={2} />;
    default:
      return <Calendar size={size} strokeWidth={2} />;
  }
};

const CALENDAR_TASKS_GAS_CODE = `/**
 * Wee-It 2026 다른 구글 계정 캘린더 + 태스크(Tasks) 양방향 연동 Apps Script
 * [설치 및 배포 방법]
 * 1. 연동하고 싶은 구글 계정으로 로그인한 상태에서 https://script.google.com 접속
 * 2. [새 프로젝트] 클릭 후 기존 코드를 모두 지우고 아래 코드 전체 붙여넣기
 * 3. (중요!) 왼쪽 메뉴 [서비스 (+)] 클릭 > "Google Tasks API" 선택 > [추가] 클릭
 *    (태스크/할 일까지 양방향 연동하려면 반드시 추가해야 합니다!)
 * 4. 상단 [배포] > [새 배포] > 유형: [웹 앱]
 * 5. 다음 사용자로 실행: [나(내 계정)] / 액세스 권한: [모든 사용자(Anyone)] 필수!
 * 6. [배포] 클릭 후 권한 승인 > 발급된 웹 앱 URL을 달력 ⚙️ 설정에 붙여넣기
 */

function getTz_() {
  return Session.getScriptTimeZone() || 'Asia/Seoul';
}

function fmtDate_(d, tz) {
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function fmtTime_(d, tz) {
  return Utilities.formatDate(d, tz, 'HH:mm');
}

function parseDateTime_(dateStr, timeStr, tz) {
  return Utilities.parseDate(dateStr + ' ' + (timeStr || '00:00'), tz, 'yyyy-MM-dd HH:mm');
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'sync';
    var tz = getTz_();

    if (action === 'ping') {
      return jsonOut_({
        ok: true,
        tasksEnabled: typeof Tasks !== 'undefined',
        calendarName: CalendarApp.getDefaultCalendar().getName()
      });
    }

    var now = new Date();
    var timeMin = params.timeMin ? new Date(params.timeMin) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var timeMax = params.timeMax ? new Date(params.timeMax) : new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

    var calSpecs = [];
    if (params.calIds && params.calIds.trim()) {
      var parts = params.calIds.split(',');
      for (var i = 0; i < parts.length; i++) {
        var raw = parts[i].trim();
        if (!raw) continue;
        var idx = raw.indexOf(':');
        if (idx > -1) {
          var rawLabel = raw.substring(idx + 1).trim();
          var cleanedLbl = rawLabel.replace(/:\s*#[0-9a-fA-F]{3,8}\s*$/i, '').replace(/^#[0-9a-fA-F]{3,8}$/i, '').trim();
          calSpecs.push({ id: raw.substring(0, idx).trim(), label: cleanedLbl });
        } else {
          calSpecs.push({ id: raw, label: '' });
        }
      }
    } else {
      calSpecs.push({ id: 'primary', label: '' });
    }

    var eventsOut = [];
    for (var c = 0; c < calSpecs.length; c++) {
      var spec = calSpecs[c];
      var cal = (spec.id === 'primary')
        ? CalendarApp.getDefaultCalendar()
        : CalendarApp.getCalendarById(spec.id);
      if (!cal) continue;

      var calId = cal.getId();
      var rawEvents = cal.getEvents(timeMin, timeMax);
      for (var j = 0; j < rawEvents.length; j++) {
        var ev = rawEvents[j];
        var isAllDay = ev.isAllDayEvent();
        var startStr = '';
        var endStr = '';
        var startTime = '';
        var endTime = '';

        if (isAllDay) {
          var sDate = ev.getAllDayStartDate();
          var eDateEx = ev.getAllDayEndDate();
          startStr = fmtDate_(sDate, tz);
          var eDateIn = new Date(eDateEx.getTime());
          eDateIn.setDate(eDateIn.getDate() - 1);
          endStr = fmtDate_(eDateIn, tz);
          if (endStr < startStr) endStr = startStr;
        } else {
          var sTime = ev.getStartTime();
          var eTime = ev.getEndTime();
          startStr = fmtDate_(sTime, tz);
          endStr = fmtDate_(eTime, tz);
          startTime = fmtTime_(sTime, tz);
          endTime = fmtTime_(eTime, tz);
        }

        eventsOut.push({
          googleEventId: ev.getId(),
          googleCalendarId: calId,
          label: spec.label || '',
          title: ev.getTitle() || '(제목 없음)',
          date: startStr,
          endDate: endStr > startStr ? endStr : '',
          startTime: startTime,
          endTime: endTime,
          allDay: isAllDay
        });
      }
    }

    var tasksOut = [];
    var tasksEnabled = (typeof Tasks !== 'undefined');
    if (tasksEnabled) {
      try {
        var listsResp = Tasks.Tasklists.list({ maxResults: 20 });
        var taskLists = (listsResp && listsResp.items) ? listsResp.items : [{ id: '@default', title: '내 할 일' }];
        for (var l = 0; l < taskLists.length; l++) {
          var tl = taskLists[l];
          var tasksResp = Tasks.Tasks.list(tl.id, {
            showCompleted: true,
            showHidden: true,
            maxResults: 100
          });
          var items = (tasksResp && tasksResp.items) ? tasksResp.items : [];
          for (var t = 0; t < items.length; t++) {
            var tk = items[t];
            if (!tk.title || tk.deleted) continue;
            tasksOut.push({
              googleTaskId: tk.id,
              googleTaskListId: tl.id,
              text: tk.title,
              detail: tk.notes || '',
              date: tk.due ? tk.due.substring(0, 10) : '',
              done: tk.status === 'completed'
            });
          }
        }
      } catch (taskErr) {}
    }

    return jsonOut_({
      ok: true,
      events: eventsOut,
      tasks: tasksOut,
      tasksEnabled: tasksEnabled
    });
  } catch (err) {
    return jsonOut_({ ok: false, message: err.toString() });
  }
}

function doPost(e) {
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = p.action || '';
    var tz = getTz_();

    if (action === 'createEvent') {
      var cal = (p.calendarId && p.calendarId !== 'primary')
        ? (CalendarApp.getCalendarById(p.calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();
      var createdEv;
      if (p.allDay) {
        var sDay = parseDateTime_(p.startDate, '00:00', tz);
        if (p.endDate && p.endDate > p.startDate) {
          var eDay = parseDateTime_(p.endDate, '00:00', tz);
          eDay.setDate(eDay.getDate() + 1);
          createdEv = cal.createAllDayEvent(p.title, sDay, eDay, { description: p.description || '' });
        } else {
          createdEv = cal.createAllDayEvent(p.title, sDay, { description: p.description || '' });
        }
      } else {
        var sDt = parseDateTime_(p.startDate, p.startTime || '09:00', tz);
        var eBase = (p.endDate && p.endDate >= p.startDate) ? p.endDate : p.startDate;
        var eDt = parseDateTime_(eBase, p.endTime || '10:00', tz);
        if (eDt <= sDt) eDt = new Date(sDt.getTime() + 50 * 60000);
        createdEv = cal.createEvent(p.title, sDt, eDt, { description: p.description || '' });
      }
      return jsonOut_({
        ok: true,
        googleEventId: createdEv.getId(),
        googleCalendarId: cal.getId()
      });
    }

    if (action === 'moveEvent') {
      var mCal = (p.calendarId && p.calendarId !== 'primary')
        ? (CalendarApp.getCalendarById(p.calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();
      var mEv = mCal.getEventById(p.eventId);
      if (!mEv) return jsonOut_({ ok: false, message: '일정을 찾을 수 없습니다.' });

      if (mEv.isAllDayEvent() || p.allDay) {
        var msDay = parseDateTime_(p.startDate, '00:00', tz);
        if (p.endDate && p.endDate > p.startDate) {
          var meDay = parseDateTime_(p.endDate, '00:00', tz);
          meDay.setDate(meDay.getDate() + 1);
          mEv.setAllDayDates(msDay, meDay);
        } else {
          mEv.setAllDayDate(msDay);
        }
      } else {
        var msDt = parseDateTime_(p.startDate, p.startTime || fmtTime_(mEv.getStartTime(), tz), tz);
        var meBase = (p.endDate && p.endDate >= p.startDate) ? p.endDate : p.startDate;
        var meDt = parseDateTime_(meBase, p.endTime || fmtTime_(mEv.getEndTime(), tz), tz);
        if (meDt <= msDt) meDt = new Date(msDt.getTime() + 50 * 60000);
        mEv.setTime(msDt, meDt);
      }
      return jsonOut_({ ok: true });
    }

    if (action === 'deleteEvent') {
      var dCal = (p.calendarId && p.calendarId !== 'primary')
        ? (CalendarApp.getCalendarById(p.calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();
      var dEv = dCal.getEventById(p.eventId);
      if (dEv) dEv.deleteEvent();
      return jsonOut_({ ok: true });
    }

    if (typeof Tasks === 'undefined') {
      return jsonOut_({ ok: false, message: 'Apps Script 왼쪽 [서비스(+)]에서 Google Tasks API를 추가해주세요.' });
    }

    if (action === 'createTask') {
      var targetList = p.taskListId || '@default';
      var taskBody = {
        title: p.title,
        notes: p.notes || '',
        status: p.done ? 'completed' : 'needsAction'
      };
      if (p.due) taskBody.due = p.due + 'T00:00:00.000Z';
      var newTk = Tasks.Tasks.insert(taskBody, targetList);
      return jsonOut_({
        ok: true,
        googleTaskId: newTk.id,
        googleTaskListId: targetList
      });
    }

    if (action === 'updateTask') {
      var uList = p.taskListId || '@default';
      var patchBody = {};
      if (p.status !== undefined) {
        patchBody.status = p.status;
        if (p.status === 'needsAction') patchBody.completed = null;
      }
      if (p.due !== undefined) {
        patchBody.due = p.due ? (p.due + 'T00:00:00.000Z') : null;
      }
      if (p.title !== undefined) patchBody.title = p.title;
      if (p.notes !== undefined) patchBody.notes = p.notes;
      Tasks.Tasks.patch(patchBody, uList, p.taskId);
      return jsonOut_({ ok: true });
    }

    if (action === 'deleteTask') {
      Tasks.Tasks.remove(p.taskListId || '@default', p.taskId);
      return jsonOut_({ ok: true });
    }

    return jsonOut_({ ok: false, message: '알 수 없는 action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, message: err.toString() });
  }
}`;

export const CalendarView: React.FC<CalendarViewProps> = ({
  records,
  onSelectStudent
}) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  // View year and month state
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth()); // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('전체');
  const [isPanelExpanded, setIsPanelExpanded] = useState<boolean>(true);
  const [rightTab, setRightTab] = useState<'all' | 'events' | 'todos'>('all');

  // Drag over day state (calendar grid) & right-tab-only event order state
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [rightEventOrderMap, setRightEventOrderMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('oneul_right_event_order_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [draggedRightEventId, setDraggedRightEventId] = useState<string | null>(null);
  const [dragOverRightEventId, setDragOverRightEventId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('oneul_right_event_order_v1', JSON.stringify(rightEventOrderMap));
  }, [rightEventOrderMap]);

  // Google Sync & Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'config' | 'gasGuide'>('config');
  const [gcalGasUrl, setGcalGasUrl] = useState(() => localStorage.getItem('gcal_gas_url') || '');
  const [gcalCalId, setGcalCalId] = useState(() => localStorage.getItem('gcal_calid') || '');
  const [gcalApiKey, setGcalApiKey] = useState(() => localStorage.getItem('gcal_apikey') || '');
  const [gcalClientId, setGcalClientId] = useState(() => localStorage.getItem('gcal_clientid') || '');
  const [showAdvancedApi, setShowAdvancedApi] = useState(false);
  const [copiedGasScript, setCopiedGasScript] = useState(false);
  const [testingGas, setTestingGas] = useState(false);
  const [gasTestResult, setGasTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Google Calendar Cached Events (auto-clean legacy :#HEX tags)
  const [googleEvents, setGoogleEvents] = useState<CalendarEventItem[]>(() => {
    try {
      const saved = localStorage.getItem('oneul_google_cached_events');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((ev: CalendarEventItem) => ({
        ...ev,
        title: cleanGoogleTitleText(ev.title)
      }));
    } catch {
      return [];
    }
  });

  // Custom User Events
  const [customEvents, setCustomEvents] = useState<CalendarEventItem[]>(() => {
    try {
      const saved = localStorage.getItem('oneul_custom_events_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // To-Do items (User-created only, removed all arbitrary preset todos)
  const [todos, setTodos] = useState<ToDoItem[]>(() => {
    try {
      const saved = localStorage.getItem('oneul_todos_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(t => 
            t.id !== 'todo-1' && 
            t.id !== 'todo-2' && 
            !t.text?.includes('위(Wee) 클래스 주간 상담 실적') && 
            !t.text?.includes('순회상담 학교 방문 일정 확인')
          );
        }
      }
      return [];
    } catch {
      return [];
    }
  });


  // Form inputs
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<'Wee' | '순회' | 'default'>('Wee');
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [newEventStartTime, setNewEventStartTime] = useState('14:00');
  const [newEventEndTime, setNewEventEndTime] = useState('14:50');
  const [newEventIsMultiDay, setNewEventIsMultiDay] = useState(false);
  const [newEventStartDate, setNewEventStartDate] = useState(todayStr);
  const [newEventEndDate, setNewEventEndDate] = useState(todayStr);

  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDetail, setNewTodoDetail] = useState('');
  const [newTodoDate, setNewTodoDate] = useState(todayStr);

  // Sync date inputs when selected date changes
  useEffect(() => {
    if (!newEventIsMultiDay) {
      setNewEventStartDate(selectedDateStr);
      setNewEventEndDate(selectedDateStr);
    }
  }, [selectedDateStr, newEventIsMultiDay]);

  // Toast, Confirm dialog & Refs
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteEventIdConfirm, setDeleteEventIdConfirm] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const calendarLeftRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState<number>(0);

  useEffect(() => {
    const el = calendarLeftRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isCompactLanes = gridWidth > 0 && gridWidth < 680;
  const isUltraNarrowGrid = gridWidth > 0 && gridWidth < 500;
  const maxVisibleLanes = isCompactLanes ? 2 : 3;

  const googleCalendarNicknames = useMemo(
    () => parseCalendarNicknames(gcalCalId),
    [gcalCalId]
  );

  const getEventDisplayTitle = (ev: CalendarEventItem): string => {
    if (ev.source === 'google' || ev.counselingType === 'google') {
      return formatGoogleDisplayTitle(ev.title, googleCalendarNicknames);
    }
    return ev.title;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Helper: check if event is active on a specific date (supports multi-day spans)
  const isEventOnDate = (ev: CalendarEventItem, targetDate: string): boolean => {
    if (!ev.date) return false;
    const start = cleanDateStr(ev.date);
    const end = ev.endDate ? cleanDateStr(ev.endDate) : start;
    if (!end || end === start) {
      return start === targetDate;
    }
    return start <= targetDate && targetDate <= end;
  };

  // Persist State to LocalStorage
  useEffect(() => {
    localStorage.setItem('oneul_todos_v2', JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem('oneul_custom_events_v2', JSON.stringify(customEvents));
  }, [customEvents]);


  // Apply theme accent color dynamically
  useEffect(() => {
    const meta = FILTER_CONFIG[activeFilter] || FILTER_CONFIG['default'];
    document.documentElement.style.setProperty('--cal-accent', meta.color);
    document.documentElement.style.setProperty('--cal-accent-light', meta.bg);
  }, [activeFilter]);

  // Convert Wee-It Counseling Records into Calendar Events
  const counselingEvents = useMemo(() => {
    const list: CalendarEventItem[] = [];
    const completedSet = new Set<string>();

    (records || []).forEach((rec, idx) => {
      const d = cleanDateStr(rec.date);
      const t = cleanTimeStr(rec.startTime);
      if (d) {
        const isRoaming = (rec.caseNum && /R/i.test(rec.caseNum)) || (rec.school && rec.school.includes('순회'));
        const category: 'Wee' | '순회' = isRoaming ? '순회' : 'Wee';
        const sessionTxt = rec.session ? ` (${rec.session}회기)` : '';

        list.push({
          id: `rec-done-${rec.rowNum || idx}`,
          title: `${rec.name}${sessionTxt}`,
          date: d,
          startTime: t,
          endTime: cleanTimeStr(rec.endTime),
          allDay: !t,
          category,
          studentName: rec.name,
          counselingType: 'completed',
          source: 'counseling'
        });
        completedSet.add(`${rec.name}|${d}`);
      }
    });

    (records || []).forEach((rec, idx) => {
      if (rec.nextAppointment) {
        const nextInfo = splitDateTime(rec.nextAppointment);
        if (nextInfo.date && !completedSet.has(`${rec.name}|${nextInfo.date}`)) {
          const isRoaming = (rec.caseNum && /R/i.test(rec.caseNum)) || (rec.school && rec.school.includes('순회'));
          const category: 'Wee' | '순회' = isRoaming ? '순회' : 'Wee';

          list.push({
            id: `rec-appt-${rec.rowNum || idx}`,
            title: `[예약] ${rec.name}`,
            date: nextInfo.date,
            startTime: nextInfo.time,
            allDay: !nextInfo.time,
            category,
            studentName: rec.name,
            counselingType: 'appointment',
            source: 'counseling'
          });
        }
      }
    });

    return list;
  }, [records]);

  // Combined all events (deduplicate synced customEvents vs googleEvents by googleEventId)
  const allEvents = useMemo(() => {
    const customGoogleIds = new Set(
      customEvents.map(e => e.googleEventId).filter(Boolean) as string[]
    );
    const dedupedGoogle = googleEvents.filter(
      e => !e.googleEventId || !customGoogleIds.has(e.googleEventId)
    );
    return [...counselingEvents, ...customEvents, ...dedupedGoogle];
  }, [counselingEvents, customEvents, googleEvents]);

  // Week-Row Spanning Calendar Engine (supports continuous multi-day bars & non-overlapping lanes)

  interface WeekDayCell {
    dateStr: string;
    dayNum: number;
    col: number;
    isCurrentMonth: boolean;
    isSun: boolean;
    isSat: boolean;
    isToday: boolean;
    isSelected: boolean;
  }

  interface MultiDayBar {
    ev: CalendarEventItem;
    startCol: number;
    endCol: number;
    lane: number;
    continuesFromPrevWeek: boolean;
    continuesToNextWeek: boolean;
  }

  interface SingleDayCellItem {
    kind: 'event' | 'todo';
    item: CalendarEventItem | ToDoItem;
    col: number;
    dateStr: string;
    lane: number;
  }

  const calendarWeeks = useMemo(() => {
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalWeeks = Math.ceil((firstDayOfWeek + daysInCurrentMonth) / 7);

    const isTodoOnly = activeFilter === 'To Do';
    const filteredEvents = isTodoOnly
      ? []
      : allEvents.filter(e => activeFilter === '전체' || e.category === activeFilter);
    const filteredTodos =
      activeFilter === '전체' || isTodoOnly ? todos : [];

    const multiDayEventsAll = filteredEvents
      .filter(ev => {
        const s = cleanDateStr(ev.date);
        const e = ev.endDate ? cleanDateStr(ev.endDate) : '';
        return Boolean(s && e && e > s);
      })
      .sort((a, b) => {
        const aStart = cleanDateStr(a.date);
        const bStart = cleanDateStr(b.date);
        if (aStart !== bStart) return aStart.localeCompare(bStart);
        const aEnd = cleanDateStr(a.endDate || a.date);
        const bEnd = cleanDateStr(b.endDate || b.date);
        if (aEnd !== bEnd) return bEnd.localeCompare(aEnd); // longer bars first
        return (a.title || '').localeCompare(b.title || '');
      });

    const singleDayEventsAll = filteredEvents.filter(ev => {
      const s = cleanDateStr(ev.date);
      const e = ev.endDate ? cleanDateStr(ev.endDate) : '';
      return Boolean(s) && (!e || e <= s);
    });

    const weeks: {
      weekStartStr: string;
      days: WeekDayCell[];
      multiDayBars: MultiDayBar[];
      singleDayItems: SingleDayCellItem[];
      hiddenCounts: number[];
    }[] = [];

    for (let w = 0; w < totalWeeks; w++) {
      const days: WeekDayCell[] = [];
      for (let col = 0; col < 7; col++) {
        const dayOffset = w * 7 + col - firstDayOfWeek;
        const dObj = new Date(currentYear, currentMonth, 1 + dayOffset);
        const dateStr = `${dObj.getFullYear()}-${pad2(dObj.getMonth() + 1)}-${pad2(dObj.getDate())}`;
        days.push({
          dateStr,
          dayNum: dObj.getDate(),
          col,
          isCurrentMonth: dObj.getMonth() === currentMonth,
          isSun: col === 0,
          isSat: col === 6,
          isToday: dateStr === todayStr,
          isSelected: dateStr === selectedDateStr
        });
      }

      const weekStartStr = days[0].dateStr;
      const weekEndStr = days[6].dateStr;
      const occupied: boolean[][] = [];
      const ensureLane = (lane: number) => {
        if (!occupied[lane]) {
          occupied[lane] = [false, false, false, false, false, false, false];
        }
      };

      const multiDayBars: MultiDayBar[] = [];
      for (const ev of multiDayEventsAll) {
        const evStart = cleanDateStr(ev.date);
        const evEnd = cleanDateStr(ev.endDate || ev.date);
        if (evStart > weekEndStr || evEnd < weekStartStr) continue;

        const continuesFromPrevWeek = evStart < weekStartStr;
        const continuesToNextWeek = evEnd > weekEndStr;
        const startCol = continuesFromPrevWeek ? 0 : days.findIndex(d => d.dateStr === evStart);
        const endCol = continuesToNextWeek ? 6 : days.findIndex(d => d.dateStr === evEnd);
        if (startCol < 0 || endCol < 0 || startCol > endCol) continue;

        let lane = 0;
        while (true) {
          ensureLane(lane);
          let free = true;
          for (let c = startCol; c <= endCol; c++) {
            if (occupied[lane][c]) {
              free = false;
              break;
            }
          }
          if (free) break;
          lane++;
        }

        for (let c = startCol; c <= endCol; c++) {
          occupied[lane][c] = true;
        }

        multiDayBars.push({
          ev,
          startCol,
          endCol,
          lane,
          continuesFromPrevWeek,
          continuesToNextWeek
        });
      }

      const singleDayItems: SingleDayCellItem[] = [];
      for (let col = 0; col < 7; col++) {
        const dateStr = days[col].dateStr;
        const dayEvents = singleDayEventsAll
          .filter(ev => cleanDateStr(ev.date) === dateStr)
          .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || (a.title || '').localeCompare(b.title || ''));
        const dayTodos = filteredTodos.filter(t => t.date === dateStr);

        for (const ev of dayEvents) {
          let lane = 0;
          while (true) {
            ensureLane(lane);
            if (!occupied[lane][col]) break;
            lane++;
          }
          occupied[lane][col] = true;
          singleDayItems.push({ kind: 'event', item: ev, col, dateStr, lane });
        }

        for (const td of dayTodos) {
          let lane = 0;
          while (true) {
            ensureLane(lane);
            if (!occupied[lane][col]) break;
            lane++;
          }
          occupied[lane][col] = true;
          singleDayItems.push({ kind: 'todo', item: td, col, dateStr, lane });
        }
      }

      const hiddenCounts = [0, 0, 0, 0, 0, 0, 0];
      for (const bar of multiDayBars) {
        if (bar.lane >= maxVisibleLanes) {
          for (let c = bar.startCol; c <= bar.endCol; c++) {
            hiddenCounts[c]++;
          }
        }
      }
      for (const sItem of singleDayItems) {
        if (sItem.lane >= maxVisibleLanes) {
          hiddenCounts[sItem.col]++;
        }
      }

      weeks.push({
        weekStartStr,
        days,
        multiDayBars: multiDayBars.filter(b => b.lane < maxVisibleLanes),
        singleDayItems: singleDayItems.filter(s => s.lane < maxVisibleLanes),
        hiddenCounts
      });
    }

    return weeks;
  }, [currentYear, currentMonth, activeFilter, allEvents, todos, todayStr, selectedDateStr, maxVisibleLanes]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(y => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(y => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleGoToToday = () => {
    const todayDate = new Date();
    setCurrentYear(todayDate.getFullYear());
    setCurrentMonth(todayDate.getMonth());
    setSelectedDateStr(todayStr);
    setNewTodoDate(todayStr);
    setIsPanelExpanded(true);
    showToast('오늘 날짜로 이동했습니다 ☁️');
  };

  // Day selection
  const handleSelectDay = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setNewTodoDate(dateStr);
    if (!isPanelExpanded) {
      setIsPanelExpanded(true);
    }
  };

  // Helper: POST to Calendar/Tasks Apps Script (text/plain avoids CORS preflight)
  const postToCalendarGas = async (url: string, payload: Record<string, any>) => {
    if (!url) return null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('GAS Calendar/Tasks POST error:', err);
      return null;
    }
  };

  // Helper: shift multi-day endDate proportionally when dragging start date
  const shiftEndDate = (oldStart: string, oldEnd: string | undefined, newStart: string): string | undefined => {
    if (!oldEnd || oldEnd <= oldStart) return undefined;
    const [sy, sm, sd] = oldStart.split('-').map(Number);
    const [ey, em, ed] = oldEnd.split('-').map(Number);
    const [ny, nm, nd] = newStart.split('-').map(Number);
    const diffDays = Math.round(
      (new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000
    );
    const shifted = new Date(ny, nm - 1, nd + diffDays);
    return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}-${pad2(shifted.getDate())}`;
  };

  // Add Event (Supports single and multi-day spans + two-way Google Calendar push)
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) {
      showToast('일정 제목을 입력해 주세요.');
      return;
    }

    const start = newEventIsMultiDay ? (newEventStartDate || selectedDateStr) : selectedDateStr;
    const rawEnd = newEventIsMultiDay ? (newEventEndDate || start) : undefined;
    const finalEnd = rawEnd && rawEnd > start ? rawEnd : undefined;
    const tempId = `custom-${Date.now()}`;

    const item: CalendarEventItem = {
      id: tempId,
      title: newEventTitle.trim(),
      date: start,
      endDate: finalEnd,
      startTime: newEventAllDay ? undefined : newEventStartTime,
      endTime: newEventAllDay ? undefined : newEventEndTime,
      allDay: newEventAllDay,
      category: newEventCategory,
      source: 'custom',
      counselingType: 'custom'
    };

    setCustomEvents(prev => [...prev, item]);
    setNewEventTitle('');
    setNewEventIsMultiDay(false);

    const activeGasUrl = gcalGasUrl.trim();
    if (activeGasUrl) {
      showToast('달력 및 구글 캘린더에 등록 중...');
      const firstCalSpec = gcalCalId.split(',')[0]?.split(':')[0]?.trim() || 'primary';
      const resp = await postToCalendarGas(activeGasUrl, {
        action: 'createEvent',
        calendarId: firstCalSpec,
        title: item.title,
        startDate: item.date,
        endDate: item.endDate || '',
        allDay: !!item.allDay,
        startTime: item.startTime || '',
        endTime: item.endTime || ''
      });
      if (resp?.ok && resp.googleEventId) {
        setCustomEvents(prev =>
          prev.map(ev =>
            ev.id === tempId
              ? { ...ev, googleEventId: resp.googleEventId, googleCalendarId: resp.googleCalendarId }
              : ev
          )
        );
        showToast('새 일정이 구글 캘린더에도 양방향 등록되었습니다 ✨');
      } else {
        showToast('달력에는 저장되었으나 구글 반영 응답을 확인해주세요.');
      }
    } else {
      showToast(finalEnd ? '연속 일정이 등록되었습니다 🗓️' : '새 일정이 등록되었습니다 🌸');
    }
  };

  // Delete Custom or Google Event
  const handleDeleteCustomEvent = (id: string) => {
    setDeleteEventIdConfirm(id);
  };

  const confirmDeleteCustomEvent = async () => {
    if (!deleteEventIdConfirm) return;
    const targetId = deleteEventIdConfirm;
    const targetEv =
      customEvents.find(e => e.id === targetId) ||
      googleEvents.find(e => e.id === targetId);

    setCustomEvents(prev => prev.filter(e => e.id !== targetId));
    setGoogleEvents(prev => {
      const next = prev.filter(e => e.id !== targetId);
      localStorage.setItem('oneul_google_cached_events', JSON.stringify(next));
      return next;
    });
    setDeleteEventIdConfirm(null);

    const activeGasUrl = gcalGasUrl.trim();
    if (activeGasUrl && targetEv?.googleEventId) {
      const resp = await postToCalendarGas(activeGasUrl, {
        action: 'deleteEvent',
        eventId: targetEv.googleEventId,
        calendarId: targetEv.googleCalendarId || 'primary'
      });
      if (resp?.ok) {
        showToast('일정이 달력과 구글 캘린더에서 모두 삭제되었습니다.');
        return;
      }
    }
    showToast('일정이 삭제되었습니다.');
  };

  // Add To-Do (with two-way Google Tasks push)
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) {
      showToast('할 일 제목을 입력해 주세요.');
      return;
    }

    const tempId = `todo-${Date.now()}`;
    const item: ToDoItem = {
      id: tempId,
      text: newTodoTitle.trim(),
      detail: newTodoDetail.trim(),
      date: newTodoDate || selectedDateStr,
      done: false,
      createdAt: Date.now(),
      source: 'local'
    };

    setTodos(prev => [item, ...prev]);
    setNewTodoTitle('');
    setNewTodoDetail('');

    const activeGasUrl = gcalGasUrl.trim();
    if (activeGasUrl) {
      const resp = await postToCalendarGas(activeGasUrl, {
        action: 'createTask',
        title: item.text,
        notes: item.detail || '',
        due: item.date,
        done: false
      });
      if (resp?.ok && resp.googleTaskId) {
        setTodos(prev =>
          prev.map(t =>
            t.id === tempId
              ? {
                  ...t,
                  googleTaskId: resp.googleTaskId,
                  googleTaskListId: resp.googleTaskListId || '@default',
                  source: 'google'
                }
              : t
          )
        );
        showToast('To Do가 구글 태스크에도 등록되었습니다 🍀');
      } else {
        showToast(resp?.message || 'To Do 추가 완료 (구글 태스크 API 활성화 여부를 확인하세요)');
      }
    } else {
      showToast('To Do가 추가되었습니다 🍀');
    }
  };

  // Toggle To-Do (with two-way Google Tasks status patch)
  const handleToggleTodo = async (id: string) => {
    const targetTodo = todos.find(t => t.id === id);
    if (!targetTodo) return;
    const nextDone = !targetTodo.done;

    setTodos(prev =>
      prev.map(t => (t.id === id ? { ...t, done: nextDone } : t))
    );
    showToast(nextDone ? 'To Do 완료! 수고하셨습니다 ✨' : 'To Do를 다시 진행 중으로 변경했습니다.');

    const activeGasUrl = gcalGasUrl.trim();
    if (activeGasUrl && targetTodo.googleTaskId) {
      await postToCalendarGas(activeGasUrl, {
        action: 'updateTask',
        taskId: targetTodo.googleTaskId,
        taskListId: targetTodo.googleTaskListId || '@default',
        status: nextDone ? 'completed' : 'needsAction'
      });
    }
  };

  // Delete To-Do (with two-way Google Tasks removal)
  const handleDeleteTodo = async (id: string) => {
    const targetTodo = todos.find(t => t.id === id);
    setTodos(prev => prev.filter(t => t.id !== id));

    const activeGasUrl = gcalGasUrl.trim();
    if (activeGasUrl && targetTodo?.googleTaskId) {
      const resp = await postToCalendarGas(activeGasUrl, {
        action: 'deleteTask',
        taskId: targetTodo.googleTaskId,
        taskListId: targetTodo.googleTaskListId || '@default'
      });
      if (resp?.ok) {
        showToast('To Do가 구글 태스크에서도 삭제되었습니다.');
        return;
      }
    }
    showToast('To Do가 삭제되었습니다.');
  };


  // Drag and Drop Handling (Moving Events / To-Dos to a new day + syncing to Google)
  const handleDragStart = (e: React.DragEvent, type: 'event' | 'todo', id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleDragLeave = (dateStr: string) => {
    if (dragOverDate === dateStr) {
      setDragOverDate(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDate(null);

    const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      const activeGasUrl = gcalGasUrl.trim();

      if (data.type === 'todo') {
        const targetTodo = todos.find(t => t.id === data.id);
        setTodos(prev =>
          prev.map(t => (t.id === data.id ? { ...t, date: targetDateStr } : t))
        );
        showToast(`To Do가 ${targetDateStr}로 이동되었습니다 🍀`);
        if (activeGasUrl && targetTodo?.googleTaskId) {
          await postToCalendarGas(activeGasUrl, {
            action: 'updateTask',
            taskId: targetTodo.googleTaskId,
            taskListId: targetTodo.googleTaskListId || '@default',
            due: targetDateStr
          });
        }
      } else if (data.type === 'event') {
        const customMatch = customEvents.find(ev => ev.id === data.id);
        const googleMatch = googleEvents.find(ev => ev.id === data.id);
        const targetEv = customMatch || googleMatch;
        if (!targetEv) return;

        const nextEnd = shiftEndDate(targetEv.date, targetEv.endDate, targetDateStr);
        if (customMatch) {
          setCustomEvents(prev =>
            prev.map(ev => (ev.id === data.id ? { ...ev, date: targetDateStr, endDate: nextEnd } : ev))
          );
        } else if (googleMatch) {
          setGoogleEvents(prev => {
            const next = prev.map(ev =>
              ev.id === data.id ? { ...ev, date: targetDateStr, endDate: nextEnd } : ev
            );
            localStorage.setItem('oneul_google_cached_events', JSON.stringify(next));
            return next;
          });
        }
        showToast(`일정이 ${targetDateStr}로 이동되었습니다 🌸`);

        if (activeGasUrl && targetEv.googleEventId) {
          await postToCalendarGas(activeGasUrl, {
            action: 'moveEvent',
            eventId: targetEv.googleEventId,
            calendarId: targetEv.googleCalendarId || 'primary',
            startDate: targetDateStr,
            endDate: nextEnd || '',
            allDay: !!targetEv.allDay,
            startTime: targetEv.startTime || '',
            endTime: targetEv.endTime || ''
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Google Calendar & Tasks Synchronization (Primary: Apps Script Web App, Fallback: Public API Key)
  const handleSyncGoogle = async (silent = false) => {
    setIsSyncing(true);
    if (!silent) {
      showToast('구글 양방향 동기화 중...');
    }

    try {
      const timeMinDate = new Date(currentYear, currentMonth - 1, 1);
      const timeMaxDate = new Date(currentYear, currentMonth + 2, 0, 23, 59, 59);
      const timeMin = timeMinDate.toISOString();
      const timeMax = timeMaxDate.toISOString();
      const windowStartStr = `${timeMinDate.getFullYear()}-${pad2(timeMinDate.getMonth() + 1)}-${pad2(timeMinDate.getDate())}`;
      const windowEndStr = `${timeMaxDate.getFullYear()}-${pad2(timeMaxDate.getMonth() + 1)}-${pad2(timeMaxDate.getDate())}`;
      const activeGasUrl = gcalGasUrl.trim();

      if (activeGasUrl) {
        const sep = activeGasUrl.includes('?') ? '&' : '?';
        const calParam = gcalCalId.trim() ? `&calIds=${encodeURIComponent(gcalCalId.trim())}` : '';
        const url = `${activeGasUrl}${sep}action=sync&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}${calParam}&_t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Apps Script 응답 오류');

        const remoteEventsRaw: any[] = Array.isArray(data.events) ? data.events : [];
        const remoteById = new Map<string, any>();
        remoteEventsRaw.forEach(ev => {
          if (ev.googleEventId) remoteById.set(ev.googleEventId, ev);
        });

        // Two-way reconcile local customEvents that already synced with Google
        setCustomEvents(prev =>
          prev
            .filter(ev => {
              if (!ev.googleEventId) return true;
              const inWindow = ev.date >= windowStartStr && ev.date <= windowEndStr;
              if (inWindow && !remoteById.has(ev.googleEventId)) {
                return false; // Deleted on Google Calendar
              }
              return true;
            })
            .map(ev => {
              if (ev.googleEventId && remoteById.has(ev.googleEventId)) {
                const r = remoteById.get(ev.googleEventId);
                return {
                  ...ev,
                  title: r.title || ev.title,
                  date: r.date || ev.date,
                  endDate: r.endDate || undefined,
                  startTime: r.startTime || undefined,
                  endTime: r.endTime || undefined,
                  allDay: !!r.allDay
                };
              }
              return ev;
            })
        );

        const mappedEvents: CalendarEventItem[] = remoteEventsRaw.map((ev, idx) => {
          const cleanedLabel = cleanLabelText(ev.label);
          const cleanedRawTitle = cleanGoogleTitleText(ev.title);
          const isRoaming = /순회/i.test(cleanedLabel) || /순회/i.test(cleanedRawTitle);
          const isWee = /wee/i.test(cleanedLabel) || /wee/i.test(cleanedRawTitle);
          const category: 'Wee' | '순회' | 'default' = isRoaming ? '순회' : isWee ? 'Wee' : 'default';

          return {
            id: `gcal-${ev.googleEventId || idx}`,
            title: cleanedRawTitle,
            date: ev.date,
            endDate: ev.endDate || undefined,
            startTime: ev.startTime || undefined,
            endTime: ev.endTime || undefined,
            allDay: !!ev.allDay,
            category,
            source: 'google',
            counselingType: 'google',
            googleEventId: ev.googleEventId,
            googleCalendarId: ev.googleCalendarId
          };
        });

        setGoogleEvents(mappedEvents);
        localStorage.setItem('oneul_google_cached_events', JSON.stringify(mappedEvents));

        // Merge Google Tasks if Tasks Advanced Service is enabled in GAS
        let syncedTasksCount = 0;
        if (data.tasksEnabled !== false && Array.isArray(data.tasks)) {
          const remoteTasks: any[] = data.tasks;
          syncedTasksCount = remoteTasks.length;
          setTodos(prev => {
            const localUnsynced = prev.filter(t => !t.googleTaskId);
            const prevByGoogleId = new Map<string, ToDoItem>();
            prev.forEach(t => {
              if (t.googleTaskId) prevByGoogleId.set(t.googleTaskId, t);
            });
            const mergedRemote: ToDoItem[] = remoteTasks.map((tk, idx) => {
              const existing = prevByGoogleId.get(tk.googleTaskId);
              return {
                id: existing?.id || `gtask-${tk.googleTaskId || idx}`,
                text: tk.text || '(제목 없음)',
                detail: tk.detail || '',
                date: tk.date || existing?.date || todayStr,
                done: !!tk.done,
                createdAt: existing?.createdAt || Date.now(),
                googleTaskId: tk.googleTaskId,
                googleTaskListId: tk.googleTaskListId || '@default',
                source: 'google'
              };
            });
            return [...mergedRemote, ...localUnsynced];
          });
        }

        if (!silent) {
          const taskNote = data.tasksEnabled
            ? ` · 태스크 ${syncedTasksCount}건`
            : ' (태스크 연동은 스크립트 서비스 추가 시 활성화)';
          showToast(`구글 일정 ${mappedEvents.length}건${taskNote} 양방향 동기화 완료 ✨`);
        }
      } else if (gcalApiKey && gcalCalId) {
        const calIds = gcalCalId.split(',').map(s => s.trim()).filter(Boolean);
        const fetched: CalendarEventItem[] = [];

        for (const item of calIds) {
          const [calAddress, nickname] = item.split(':').map(x => x.trim());
          const targetId = calAddress || item;
          const label = cleanLabelText(nickname);

          try {
            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&key=${gcalApiKey}`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (data.items) {
                data.items.forEach((ev: any) => {
                  const startStr = ev.start?.dateTime || ev.start?.date || '';
                  const endStr = ev.end?.dateTime || ev.end?.date || '';
                  const d = startStr.substring(0, 10);
                  let endD = endStr.substring(0, 10);
                  if (ev.start?.date && ev.end?.date && endD > d) {
                    const [ey, em, ed] = endD.split('-').map(Number);
                    const endDateObj = new Date(ey, em - 1, ed);
                    endDateObj.setDate(endDateObj.getDate() - 1);
                    const inclusiveEnd = `${endDateObj.getFullYear()}-${pad2(endDateObj.getMonth() + 1)}-${pad2(endDateObj.getDate())}`;
                    endD = inclusiveEnd >= d ? inclusiveEnd : d;
                  }
                  const finalEndDate = endD && endD > d ? endD : undefined;

                  const cleanedSummary = cleanGoogleTitleText(ev.summary);
                  const isRoaming = /순회/i.test(label) || /순회/i.test(cleanedSummary);
                  const isWee = /wee/i.test(label) || /wee/i.test(cleanedSummary);
                  const category = isRoaming ? '순회' : isWee ? 'Wee' : 'default';

                  fetched.push({
                    id: `gcal-${ev.id}`,
                    title: cleanedSummary,
                    date: d,
                    endDate: finalEndDate,
                    startTime: ev.start?.dateTime ? ev.start.dateTime.substring(11, 16) : undefined,
                    endTime: ev.end?.dateTime ? ev.end.dateTime.substring(11, 16) : undefined,
                    allDay: !ev.start?.dateTime,
                    category,
                    source: 'google',
                    googleEventId: ev.id,
                    googleCalendarId: targetId
                  });
                });
              }
            }
          } catch (err) {
            console.warn(`Error fetching ${targetId}:`, err);
          }
        }

        setGoogleEvents(fetched);
        localStorage.setItem('oneul_google_cached_events', JSON.stringify(fetched));
        if (!silent) {
          showToast(`구글 캘린더 ${fetched.length}개 일정이 동기화되었습니다! ✨`);
        }
      } else if (!silent) {
        setTimeout(() => {
          showToast('동기화 완료! Wee-It 상담 데이터가 최신 반영되었습니다 ☁️');
        }, 400);
      }
    } catch (e: any) {
      console.error(e);
      if (!silent) {
        showToast(`동기화 오류: ${e?.message || '연동 URL을 확인해 주세요.'}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync silently on mount & month change when saved GAS URL is configured
  useEffect(() => {
    const savedUrl = localStorage.getItem('gcal_gas_url') || '';
    if (savedUrl.trim()) {
      handleSyncGoogle(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth]);

  const handleTestGasConnection = async () => {
    const url = gcalGasUrl.trim();
    if (!url) {
      setGasTestResult({ ok: false, msg: 'Apps Script 웹 앱 URL을 먼저 입력해 주세요.' });
      return;
    }
    setTestingGas(true);
    setGasTestResult(null);
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}action=ping&_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        const taskMsg = data.tasksEnabled
          ? 'Google Tasks 양방향 연동 활성됨'
          : 'Google Tasks API 미추가 (일정만 연동됨)';
        setGasTestResult({
          ok: true,
          msg: `✅ 연결 성공! 캘린더 "${data.calendarName || '기본'}" · ${taskMsg}`
        });
      } else {
        setGasTestResult({ ok: false, msg: `⚠️ ${data.message || '응답 형식을 확인해 주세요.'}` });
      }
    } catch (err: any) {
      setGasTestResult({ ok: false, msg: `❌ 연결 실패: ${err?.message || 'URL 및 배포 권한(모든 사용자)을 확인해 주세요.'}` });
    } finally {
      setTestingGas(false);
    }
  };

  const handleCopyGasScript = () => {
    navigator.clipboard.writeText(CALENDAR_TASKS_GAS_CODE);
    setCopiedGasScript(true);
    setTimeout(() => setCopiedGasScript(false), 2000);
  };

  const handleSaveGoogleSettings = () => {
    localStorage.setItem('gcal_gas_url', gcalGasUrl.trim());
    localStorage.setItem('gcal_calid', gcalCalId.trim());
    localStorage.setItem('gcal_apikey', gcalApiKey.trim());
    localStorage.setItem('gcal_clientid', gcalClientId.trim());
    setIsSettingsOpen(false);
    showToast('구글 양방향 연동 설정이 저장되었습니다 ☁️');
    handleSyncGoogle(false);
  };

  // Selected date events & todos (Using isEventOnDate for multi-day matching + right-tab-only custom ordering)
  const selectedDayEvents = useMemo(() => {
    const raw = allEvents.filter(e => isEventOnDate(e, selectedDateStr));
    const orderIds = rightEventOrderMap[selectedDateStr];
    if (!orderIds || orderIds.length === 0) return raw;
    const orderMap = new Map<string, number>(orderIds.map((id, idx) => [id, idx]));
    return [...raw].sort((a, b) => {
      const aIdx = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bIdx = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  }, [allEvents, selectedDateStr, rightEventOrderMap]);

  const selectedDayTodos = todos.filter(t => t.date === selectedDateStr);

  // Right-tab-only event drag-and-drop reordering
  const handleRightEventDragStart = (e: React.DragEvent, evId: string) => {
    e.stopPropagation();
    setDraggedRightEventId(evId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'right-event-reorder', id: evId }));
  };

  const handleRightEventDragOver = (e: React.DragEvent, evId: string) => {
    if (!draggedRightEventId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRightEventId !== evId) {
      setDragOverRightEventId(evId);
    }
  };

  const handleRightEventDrop = (e: React.DragEvent, targetEvId: string) => {
    if (!draggedRightEventId) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedRightEventId !== targetEvId) {
      const currentIds = selectedDayEvents.map(ev => ev.id);
      const fromIdx = currentIds.indexOf(draggedRightEventId);
      const toIdx = currentIds.indexOf(targetEvId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const nextIds = [...currentIds];
        const [moved] = nextIds.splice(fromIdx, 1);
        nextIds.splice(toIdx, 0, moved);
        setRightEventOrderMap(prev => ({
          ...prev,
          [selectedDateStr]: nextIds
        }));
      }
    }
    setDraggedRightEventId(null);
    setDragOverRightEventId(null);
  };

  const handleRightEventDragEnd = () => {
    setDraggedRightEventId(null);
    setDragOverRightEventId(null);
  };

  const selectedDateKorean = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${y}년 ${m}월 ${d}일 (${dayNames[dateObj.getDay()]})`;
  }, [selectedDateStr]);

  return (
    <div id="calPage" style={{ position: 'relative' }}>
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

      {/* Main Oneul Calendar Window Widget */}
      <div className="oneul-widget">
        {/* Mac OS Window Bar */}
        <div className="oneul-mac-bar">
          <div className="oneul-mac-dots">
            <span className="oneul-mac-dot close"></span>
            <span className="oneul-mac-dot minimize"></span>
            <span className="oneul-mac-dot maximize"></span>
            <span className="oneul-mac-title">Oneul Calendar</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem' }}>
            <span style={{ color: '#8265BD', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <HeartHandshake size={13} strokeWidth={2} />
              <span>Wee {counselingEvents.filter(e => e.category === 'Wee').length}건</span>
            </span>
            <span style={{ color: '#3A86C8', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Navigation size={13} strokeWidth={2} />
              <span>순회 {counselingEvents.filter(e => e.category === '순회').length}건</span>
            </span>
            <span style={{ color: '#43A047', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckSquare size={13} strokeWidth={2} />
              <span>To Do {todos.filter(t => !t.done).length}건</span>
            </span>
          </div>
        </div>

        {/* Calendar Body: Left (Grid) + Right (Drawer) */}
        <div className="oneul-main-content">
          {/* Left Column: Calendar Main Grid */}
          <div ref={calendarLeftRef} className="oneul-left">
            {/* Header: Month Nav & Tools */}
            <div className="oneul-header">
              <div className="oneul-month-nav" style={{ gap: '6px' }}>
                <button
                  type="button"
                  className="app-icon-btn app-icon-btn--md app-icon-btn--circle app-icon-btn--outline"
                  onClick={handlePrevMonth}
                  title="이전 달"
                  aria-label="이전 달"
                >
                  <ChevronLeft size={16} strokeWidth={2.1} />
                </button>
                <button
                  type="button"
                  className="app-icon-btn app-icon-btn--md app-icon-btn--circle app-icon-btn--outline"
                  onClick={handleNextMonth}
                  title="다음 달"
                  aria-label="다음 달"
                >
                  <ChevronRight size={16} strokeWidth={2.1} />
                </button>
                <button
                  type="button"
                  className="app-btn app-btn--sm app-btn--outline app-btn--pill"
                  onClick={handleGoToToday}
                  style={{ height: '34px', padding: '0 13px', background: '#f8fafc' }}
                >
                  <CalendarCheck size={14} strokeWidth={2} style={{ color: 'var(--cal-accent)' }} />
                  <span>Today</span>
                </button>
                <span className="oneul-month-label" style={{ marginLeft: '6px', fontSize: '1.42rem' }}>
                  {currentYear}년 {currentMonth + 1}월
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="app-icon-btn app-icon-btn--md app-icon-btn--circle app-icon-btn--outline"
                  onClick={() => handleSyncGoogle(false)}
                  disabled={isSyncing}
                  title="새로고침 / 구글 동기화"
                  aria-label="새로고침 / 구글 동기화"
                >
                  <RefreshCw size={15} strokeWidth={2} className={isSyncing ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  className="app-icon-btn app-icon-btn--md app-icon-btn--circle app-icon-btn--outline"
                  onClick={() => setIsSettingsOpen(true)}
                  title="구글 캘린더 연동 설정"
                  aria-label="구글 캘린더 연동 설정"
                >
                  <Settings size={15} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className={`app-icon-btn app-icon-btn--md app-icon-btn--circle app-icon-btn--outline ${isPanelExpanded ? 'app-icon-btn--active' : ''}`}
                  onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                  style={
                    isPanelExpanded
                      ? {
                          background: 'var(--cal-accent-light)',
                          color: 'var(--cal-accent)',
                          borderColor: 'var(--cal-accent)'
                        }
                      : undefined
                  }
                  title={isPanelExpanded ? '상세 패널 닫기' : '상세 패널 열기'}
                  aria-label={isPanelExpanded ? '상세 패널 닫기' : '상세 패널 열기'}
                >
                  {isPanelExpanded ? (
                    <PanelLeftClose size={15} strokeWidth={2} />
                  ) : (
                    <PanelLeftOpen size={15} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            {/* Filter Bar Chips (전체, Wee, 순회, To Do) */}
            <div className="oneul-filter-bar">
              {(['전체', 'Wee', '순회', 'To Do'] as FilterCategory[]).map(cat => {
                const meta = FILTER_CONFIG[cat];
                const isActive = activeFilter === cat;

                return (
                  <button
                    key={cat}
                    type="button"
                    className={`oneul-tag-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveFilter(cat)}
                    style={{
                      background: isActive ? meta.bg : '#ffffff',
                      color: isActive ? meta.color : 'var(--cal-text-sub)',
                      borderColor: isActive ? meta.color : 'var(--cal-border)',
                      fontWeight: isActive ? 900 : 700
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', color: isActive ? meta.color : '#94a3b8' }}>
                      {renderCategoryIcon(cat, 13)}
                    </span>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>

            {/* Weekday Names Header */}
            <div className="oneul-weekday-grid">
              <div className="oneul-weekday sun">일</div>
              <div className="oneul-weekday">월</div>
              <div className="oneul-weekday">화</div>
              <div className="oneul-weekday">수</div>
              <div className="oneul-weekday">목</div>
              <div className="oneul-weekday">금</div>
              <div className="oneul-weekday sat">토</div>
            </div>

            {/* 7 Columns Week-Row Grid (Continuous Multi-Day Bars + Non-Overlapping Lanes) */}
            <div className="oneul-weeks-container">
              {calendarWeeks.map(week => (
                <div key={week.weekStartStr} className={`oneul-week-row ${isCompactLanes ? 'compact-lanes' : ''}`}>
                  {/* Background Day Cells (Day Number + More Badge + Drop Target) */}
                  <div className="oneul-week-cells">
                    {week.days.map(day => {
                      const isDragOver = dragOverDate === day.dateStr;
                      const hiddenCount = week.hiddenCounts[day.col] || 0;

                      return (
                        <div
                          key={day.dateStr}
                          className={`oneul-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.isSelected ? 'selected' : ''} ${day.isSun ? 'sun' : ''} ${day.isSat ? 'sat' : ''}`}
                          style={{
                            border: isDragOver ? '2px dashed var(--cal-accent)' : undefined,
                            background: isDragOver ? 'rgba(224, 101, 139, 0.14)' : undefined
                          }}
                          onClick={() => handleSelectDay(day.dateStr)}
                          onDoubleClick={() => {
                            setSelectedDateStr(day.dateStr);
                            setNewTodoDate(day.dateStr);
                            setRightTab('events');
                            setIsPanelExpanded(true);
                          }}
                          onDragOver={e => handleDragOver(e, day.dateStr)}
                          onDragLeave={() => handleDragLeave(day.dateStr)}
                          onDrop={e => handleDrop(e, day.dateStr)}
                        >
                          <div className="oneul-day-num">
                            {(day.isToday || day.isSelected) && (
                              <svg className="oneul-heart-bg" viewBox="0 0 36 32" aria-hidden="true">
                                <path d="M 18 7.5 C 15.2 2.2, 6.2 1.8, 3.2 7.8 C 0.5 13.2, 3.5 20.5, 16.0 29.2 Q 18 30.6, 20.0 29.2 C 32.5 20.5, 35.5 13.2, 32.8 7.8 C 29.8 1.8, 20.8 2.2, 18 7.5 Z" />
                              </svg>
                            )}
                            <span>{day.dayNum}</span>
                          </div>

                          <div className="oneul-day-lanes-spacer" />

                          <div className="oneul-day-footer">
                            {hiddenCount > 0 && (
                              <button
                                type="button"
                                className="oneul-more-badge"
                                style={{ border: 'none' }}
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedDateStr(day.dateStr);
                                  setNewTodoDate(day.dateStr);
                                  setRightTab('all');
                                  setIsPanelExpanded(true);
                                  if (window.innerWidth < 960) {
                                    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
                                  }
                                }}
                                title={`${day.dateStr} 전체 일정 ${hiddenCount}개 더보기`}
                              >
                                <Ellipsis size={11} strokeWidth={2.3} />
                                <span>{isUltraNarrowGrid ? `+${hiddenCount}` : `+${hiddenCount}개 더보기`}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unified Week Lanes Overlay (Continuous Multi-Day Bars + Single-Day Pills) */}
                  <div className="oneul-week-lanes">
                    {/* Long-Term / Multi-Day Continuous Horizontal Bars */}
                    {week.multiDayBars.map(bar => {
                      const ev = bar.ev;
                      const displayTitle = getEventDisplayTitle(ev);
                      const meta = FILTER_CONFIG[ev.category] || FILTER_CONFIG['default'];
                      const isDraggable = ev.source === 'custom' || ev.source === 'google';
                      const isTrueStart = !bar.continuesFromPrevWeek;
                      const isTrueEnd = !bar.continuesToNextWeek;
                      const spanCols = bar.endCol - bar.startCol + 1;

                      const radius =
                        isTrueStart && isTrueEnd
                          ? '9999px'
                          : isTrueStart
                          ? '9999px 3px 3px 9999px'
                          : isTrueEnd
                          ? '3px 9999px 9999px 3px'
                          : '3px';

                      const resolveBarColDate = (clientX: number, targetEl: HTMLElement): string => {
                        const rect = targetEl.getBoundingClientRect();
                        const ratio = rect.width > 0 ? Math.max(0, Math.min(0.999, (clientX - rect.left) / rect.width)) : 0;
                        const colOffset = Math.floor(ratio * spanCols);
                        const dayObj = week.days[bar.startCol + colOffset];
                        return dayObj ? dayObj.dateStr : week.days[bar.startCol].dateStr;
                      };

                      return (
                        <div
                          key={`${week.weekStartStr}-${ev.id}`}
                          className="oneul-bar-item"
                          draggable={isDraggable}
                          onDragStart={e => handleDragStart(e, 'event', ev.id)}
                          onDragOver={e => {
                            const dStr = resolveBarColDate(e.clientX, e.currentTarget);
                            handleDragOver(e, dStr);
                          }}
                          onDrop={e => {
                            const dStr = resolveBarColDate(e.clientX, e.currentTarget);
                            handleDrop(e, dStr);
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            const clickedDate = resolveBarColDate(e.clientX, e.currentTarget);
                            setSelectedDateStr(clickedDate);
                            setNewTodoDate(clickedDate);
                            setRightTab('all');
                            setIsPanelExpanded(true);
                          }}
                          title={`${displayTitle} (${ev.date} ~ ${ev.endDate}${!ev.allDay && ev.startTime ? ` · ${ev.startTime}` : ''})`}
                          style={{
                            gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                            gridRow: `${bar.lane + 1}`,
                            backgroundColor: meta.bg,
                            color: meta.color,
                            borderRadius: radius,
                            borderLeft: isTrueStart ? `3.5px solid ${meta.color}` : '1px dashed rgba(0,0,0,0.08)',
                            borderRight: isTrueEnd ? `3.5px solid ${meta.color}` : '1px dashed rgba(0,0,0,0.08)',
                            marginLeft: isTrueStart ? '2px' : '0',
                            marginRight: isTrueEnd ? '2px' : '0',
                            opacity: bar.continuesFromPrevWeek ? 0.92 : 1
                          }}
                        >
                          {bar.continuesFromPrevWeek ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }} title="이전 주에서 이어지는 일정">
                              <CornerDownRight size={10} strokeWidth={2.4} />
                            </span>
                          ) : (
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: meta.color,
                                flexShrink: 0
                              }}
                            />
                          )}

                          <span className="oneul-bar-label" style={{ fontWeight: isTrueStart ? 800 : 700 }}>
                            {isTrueStart && !ev.allDay && ev.startTime ? `${ev.startTime} ` : ''}
                            {displayTitle}
                          </span>

                          {bar.continuesToNextWeek && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 'auto', flexShrink: 0, opacity: 0.8 }} title="다음 주로 이어짐">
                              <ArrowRight size={10} strokeWidth={2.4} />
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Single-Day Events & To-Dos */}
                    {week.singleDayItems.map(sItem => {
                      if (sItem.kind === 'event') {
                        const ev = sItem.item as CalendarEventItem;
                        const displayTitle = getEventDisplayTitle(ev);
                        const meta = FILTER_CONFIG[ev.category] || FILTER_CONFIG['default'];
                        const isDraggable = ev.source === 'custom' || ev.source === 'google';

                        return (
                          <div
                            key={`${week.weekStartStr}-ev-${ev.id}`}
                            className="oneul-single-pill"
                            draggable={isDraggable}
                            onDragStart={e => handleDragStart(e, 'event', ev.id)}
                            onDragOver={e => handleDragOver(e, sItem.dateStr)}
                            onDrop={e => handleDrop(e, sItem.dateStr)}
                            onClick={e => {
                              e.stopPropagation();
                              handleSelectDay(sItem.dateStr);
                            }}
                            title={`${displayTitle}${ev.startTime ? ` (${ev.startTime}${ev.endTime ? `~${ev.endTime}` : ''})` : ''} · 클릭 시 상세 보기`}
                            style={{
                              gridColumn: `${sItem.col + 1} / ${sItem.col + 2}`,
                              gridRow: `${sItem.lane + 1}`,
                              backgroundColor: meta.bg,
                              color: meta.color
                            }}
                          >
                            {ev.startTime ? `${ev.startTime} ` : ''}
                            {displayTitle}
                          </div>
                        );
                      } else {
                        const td = sItem.item as ToDoItem;
                        const meta = FILTER_CONFIG['To Do'];

                        return (
                          <div
                            key={`${week.weekStartStr}-td-${td.id}`}
                            className={`oneul-single-pill ${td.done ? 'completed' : ''}`}
                            draggable
                            onDragStart={e => handleDragStart(e, 'todo', td.id)}
                            onDragOver={e => handleDragOver(e, sItem.dateStr)}
                            onDrop={e => handleDrop(e, sItem.dateStr)}
                            onClick={e => {
                              e.stopPropagation();
                              handleToggleTodo(td.id);
                            }}
                            title={`${td.text} (클릭 시 완료 토글 / 드래그하여 날짜 이동)`}
                            style={{
                              gridColumn: `${sItem.col + 1} / ${sItem.col + 2}`,
                              gridRow: `${sItem.lane + 1}`,
                              backgroundColor: meta.bg,
                              color: meta.color,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                              {td.done ? <Check size={10} strokeWidth={2.5} /> : <CheckSquare size={10} strokeWidth={2.2} />}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{td.text}</span>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Cheer Quote Bar */}
            <div className="oneul-cheer-bar">
              ✨ Believe in yourself. Today is going to be a wonderful day! 🤍
            </div>
          </div>

          {/* Right Column: Sliding Drawer Panel (Width: 360px) */}
          <div ref={panelRef} className={`oneul-right ${!isPanelExpanded ? 'collapsed' : ''}`}>
            {isPanelExpanded && (
              <div className="oneul-panel-inner">
                {/* Panel Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexShrink: 0 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--cal-text-main)' }}>
                      {selectedDateKorean}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--cal-text-sub)', marginTop: '2px', fontWeight: 700 }}>
                      일정 {selectedDayEvents.length}건 · To Do {selectedDayTodos.length}건
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPanelExpanded(false)}
                    className="app-icon-btn app-icon-btn--circle app-icon-btn--outline"
                    title="패널 닫기"
                    aria-label="패널 닫기"
                  >
                    <X size={14} strokeWidth={2.2} />
                  </button>
                </div>

                {/* Panel Tabs */}
                <div className="oneul-panel-tabs">
                  <button
                    type="button"
                    className={`oneul-panel-tab ${rightTab === 'all' ? 'active' : ''}`}
                    onClick={() => setRightTab('all')}
                  >
                    <Layers size={13} strokeWidth={2} />
                    <span>전체</span>
                  </button>
                  <button
                    type="button"
                    className={`oneul-panel-tab ${rightTab === 'events' ? 'active' : ''}`}
                    onClick={() => setRightTab('events')}
                  >
                    <CalendarDays size={13} strokeWidth={2} />
                    <span>일정</span>
                  </button>
                  <button
                    type="button"
                    className={`oneul-panel-tab ${rightTab === 'todos' ? 'active' : ''}`}
                    onClick={() => setRightTab('todos')}
                  >
                    <CheckSquare size={13} strokeWidth={2} />
                    <span>To Do</span>
                  </button>
                </div>

                {/* Tab Content 1: 전체 (All) */}
                {rightTab === 'all' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                    {/* Quick Add Action Bar */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
                      <button
                        type="button"
                        onClick={() => setRightTab('events')}
                        className="app-btn app-btn--sm app-btn--pill"
                        style={{
                          flex: 1,
                          borderColor: 'rgba(224, 101, 139, 0.35)',
                          background: 'var(--cal-accent-light)',
                          color: 'var(--cal-accent)'
                        }}
                      >
                        <Plus size={14} strokeWidth={2.2} />
                        <span>일정 추가</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRightTab('todos')}
                        className="app-btn app-btn--sm app-btn--pill"
                        style={{
                          flex: 1,
                          borderColor: 'rgba(67, 160, 71, 0.35)',
                          background: '#E8F5E9',
                          color: '#2e7d32'
                        }}
                      >
                        <Plus size={14} strokeWidth={2.2} />
                        <span>To Do 추가</span>
                      </button>
                    </div>

                    {selectedDayEvents.length === 0 && selectedDayTodos.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '26px 10px', color: 'var(--cal-text-sub)', fontSize: '0.84rem' }}>
                        선택된 날짜에 등록된 일정이 없습니다.
                      </div>
                    ) : (
                      <>
                        {selectedDayEvents.map(ev => {
                          const displayTitle = getEventDisplayTitle(ev);
                          const meta = FILTER_CONFIG[ev.category] || FILTER_CONFIG['default'];
                          const isDragging = draggedRightEventId === ev.id;
                          const isDragOver = dragOverRightEventId === ev.id && draggedRightEventId !== ev.id;

                          return (
                            <div
                              key={ev.id}
                              draggable
                              onDragStart={e => handleRightEventDragStart(e, ev.id)}
                              onDragOver={e => handleRightEventDragOver(e, ev.id)}
                              onDragLeave={() => {
                                if (dragOverRightEventId === ev.id) setDragOverRightEventId(null);
                              }}
                              onDrop={e => handleRightEventDrop(e, ev.id)}
                              onDragEnd={handleRightEventDragEnd}
                              className="oneul-card-item"
                              style={{
                                borderLeft: `4px solid ${meta.color}`,
                                opacity: isDragging ? 0.45 : 1,
                                boxShadow: isDragOver ? '0 0 0 2px #8265BD' : undefined,
                                background: isDragOver ? '#f9f6ff' : undefined,
                                cursor: isDragging ? 'grabbing' : 'grab'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <span
                                      title="드래그하여 오른쪽 목록 순서 변경"
                                      style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', userSelect: 'none', flexShrink: 0 }}
                                    >
                                      <GripVertical size={14} strokeWidth={2} />
                                    </span>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: meta.bg,
                                        color: meta.color
                                      }}
                                    >
                                      {renderCategoryIcon(ev.category, 11)}
                                      <span>{ev.category}</span>
                                    </span>
                                    {ev.startTime && (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--cal-text-sub)', fontWeight: 700 }}>
                                        {ev.startTime} {ev.endTime ? `~ ${ev.endTime}` : ''}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--cal-text-main)' }}>
                                    {displayTitle}
                                  </div>
                                  {ev.endDate && ev.endDate > ev.date && (
                                    <div style={{ fontSize: '0.74rem', color: '#8265BD', fontWeight: 800, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <CalendarDays size={12} strokeWidth={2} />
                                      <span>기간 일정: {ev.date} ~ {ev.endDate}</span>
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  {ev.studentName && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectStudent(ev.studentName!);
                                      }}
                                      className="app-btn app-btn--xs"
                                      title="해당 학생의 전체 사례관리 탭으로 이동"
                                      style={{
                                        borderRadius: '6px',
                                        borderColor: 'rgba(224, 101, 139, 0.3)',
                                        background: 'var(--accent-light)',
                                        color: 'var(--accent)'
                                      }}
                                    >
                                      <span className="menu-emoji menu-emoji--sm" aria-hidden="true">🧸</span>
                                      <span>사례관리 이동</span>
                                    </button>
                                  )}
                                  {(ev.source === 'custom' || ev.source === 'google') && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomEvent(ev.id)}
                                      className="app-icon-btn app-icon-btn--danger has-mobile-label"
                                      title="일정 삭제"
                                      aria-label="일정 삭제"
                                    >
                                      <Trash2 size={14} strokeWidth={2} />
                                      <span className="app-icon-btn-label">삭제</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {selectedDayTodos.map(td => (
                          <div
                            key={td.id}
                            className="oneul-card-item"
                            style={{ borderLeft: '4px solid #43A047', display: 'flex', alignItems: 'center', gap: '10px' }}
                          >
                            <input
                              type="checkbox"
                              checked={td.done}
                              onChange={() => handleToggleTodo(td.id)}
                              style={{ width: '18px', height: '18px', accentColor: '#43A047', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0, textDecoration: td.done ? 'line-through' : 'none', opacity: td.done ? 0.6 : 1 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--cal-text-main)' }}>
                                {td.text}
                              </div>
                              {td.detail && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--cal-text-sub)' }}>
                                  {td.detail}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteTodo(td.id)}
                              className="app-icon-btn app-icon-btn--danger has-mobile-label"
                              title="할 일 삭제"
                              aria-label="할 일 삭제"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                              <span className="app-icon-btn-label">삭제</span>
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Tab Content 2: 일정 (Events) */}
                {rightTab === 'events' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                    {/* Add Event Form with multi-day support */}
                    <form onSubmit={handleAddEvent} className="oneul-quick-form">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 900, color: 'var(--cal-text-main)' }}>
                        <CalendarPlus size={14} strokeWidth={2} style={{ color: 'var(--cal-accent)' }} />
                        <span>새 일정 등록 ({selectedDateStr})</span>
                      </div>
                      <input
                        type="text"
                        placeholder="새 일정 제목 입력"
                        value={newEventTitle}
                        onChange={e => setNewEventTitle(e.target.value)}
                        style={{ height: '36px', fontSize: '0.84rem' }}
                      />

                      {/* Multi-day schedule toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 800, color: 'var(--cal-text-main)' }}>
                          <input
                            type="checkbox"
                            checked={newEventIsMultiDay}
                            onChange={e => {
                              setNewEventIsMultiDay(e.target.checked);
                              if (e.target.checked && !newEventEndDate) {
                                setNewEventEndDate(selectedDateStr);
                              }
                            }}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--cal-accent)' }}
                          />
                          여러 일에 걸친 일정 (기간/다일)
                        </label>
                      </div>

                      {newEventIsMultiDay && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="date"
                            value={newEventStartDate || selectedDateStr}
                            onChange={e => setNewEventStartDate(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8rem', flex: 1, borderRadius: '9999px', padding: '0 12px', border: '1px solid var(--cal-border)' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--cal-text-sub)' }}>~</span>
                          <input
                            type="date"
                            value={newEventEndDate || selectedDateStr}
                            onChange={e => setNewEventEndDate(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8rem', flex: 1, borderRadius: '9999px', padding: '0 12px', border: '1px solid var(--cal-border)' }}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <AppSelect
                          variant="pill"
                          value={newEventCategory}
                          onChange={e => setNewEventCategory(e.target.value as any)}
                          wrapperStyle={{ flex: 1 }}
                          style={{ height: '36px', fontSize: '0.82rem' }}
                        >
                          <option value="Wee">Wee (위센터 상담)</option>
                          <option value="순회">순회 (순회상담)</option>
                          <option value="default">일반 일정</option>
                        </AppSelect>

                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={newEventAllDay}
                            onChange={e => setNewEventAllDay(e.target.checked)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          종일
                        </label>
                      </div>

                      {!newEventAllDay && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="time"
                            value={newEventStartTime}
                            onChange={e => setNewEventStartTime(e.target.value)}
                            style={{ height: '36px', fontSize: '0.82rem', flex: 1, borderRadius: '9999px', padding: '0 10px' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--cal-text-sub)' }}>~</span>
                          <input
                            type="time"
                            value={newEventEndTime}
                            onChange={e => setNewEventEndTime(e.target.value)}
                            style={{ height: '36px', fontSize: '0.82rem', flex: 1, borderRadius: '9999px', padding: '0 10px' }}
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        className="app-btn app-btn--md app-btn--pill"
                        style={{
                          background: 'var(--cal-accent)',
                          color: '#ffffff',
                          width: '100%'
                        }}
                      >
                        <Plus size={15} strokeWidth={2.2} />
                        <span>일정 추가</span>
                      </button>
                    </form>

                    {/* Events List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--cal-text-sub)' }}>
                        등록된 일정 ({selectedDayEvents.length}건)
                      </div>
                      {selectedDayEvents.map(ev => {
                        const displayTitle = getEventDisplayTitle(ev);
                        const meta = FILTER_CONFIG[ev.category] || FILTER_CONFIG['default'];
                        const isDragging = draggedRightEventId === ev.id;
                        const isDragOver = dragOverRightEventId === ev.id && draggedRightEventId !== ev.id;

                        return (
                          <div
                            key={ev.id}
                            draggable
                            onDragStart={e => handleRightEventDragStart(e, ev.id)}
                            onDragOver={e => handleRightEventDragOver(e, ev.id)}
                            onDragLeave={() => {
                              if (dragOverRightEventId === ev.id) setDragOverRightEventId(null);
                            }}
                            onDrop={e => handleRightEventDrop(e, ev.id)}
                            onDragEnd={handleRightEventDragEnd}
                            className="oneul-card-item"
                            style={{
                              borderLeft: `4px solid ${meta.color}`,
                              opacity: isDragging ? 0.45 : 1,
                              boxShadow: isDragOver ? '0 0 0 2px #8265BD' : undefined,
                              background: isDragOver ? '#f9f6ff' : undefined,
                              cursor: isDragging ? 'grabbing' : 'grab'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                                  <span
                                    title="드래그하여 오른쪽 목록 순서 변경"
                                    style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', userSelect: 'none', flexShrink: 0 }}
                                  >
                                    <GripVertical size={14} strokeWidth={2} />
                                  </span>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: meta.bg,
                                      color: meta.color
                                    }}
                                  >
                                    {renderCategoryIcon(ev.category, 11)}
                                    <span>{ev.category}</span>
                                  </span>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--cal-text-main)' }}>
                                    {displayTitle}
                                  </span>
                                </div>
                                {ev.startTime && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--cal-text-sub)', marginTop: '2px' }}>
                                    {ev.startTime} {ev.endTime ? `~ ${ev.endTime}` : ''}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                                {ev.studentName && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectStudent(ev.studentName!);
                                    }}
                                    className="app-btn app-btn--xs"
                                    title="해당 학생의 전체 사례관리 탭으로 이동"
                                    style={{
                                      borderRadius: '6px',
                                      borderColor: 'rgba(224, 101, 139, 0.3)',
                                      background: 'var(--accent-light)',
                                      color: 'var(--accent)'
                                    }}
                                  >
                                    <span className="menu-emoji menu-emoji--sm" aria-hidden="true">🧸</span>
                                    <span>사례관리 이동</span>
                                  </button>
                                )}
                                {(ev.source === 'custom' || ev.source === 'google') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomEvent(ev.id)}
                                    className="app-icon-btn app-icon-btn--danger has-mobile-label"
                                    title="일정 삭제"
                                    aria-label="일정 삭제"
                                  >
                                    <Trash2 size={14} strokeWidth={2} />
                                    <span className="app-icon-btn-label">삭제</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab Content 3: To Do */}
                {rightTab === 'todos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                    {/* Add To-Do Form */}
                    <form onSubmit={handleAddTodo} className="oneul-quick-form">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 900, color: 'var(--cal-text-main)' }}>
                        <ListTodo size={14} strokeWidth={2} style={{ color: '#43A047' }} />
                        <span>오늘 할 일 입력</span>
                      </div>
                      <input
                        type="text"
                        placeholder="할 일 제목 입력"
                        value={newTodoTitle}
                        onChange={e => setNewTodoTitle(e.target.value)}
                        style={{ height: '36px', fontSize: '0.84rem' }}
                      />
                      <input
                        type="text"
                        placeholder="세부 메모 (선택사항)"
                        value={newTodoDetail}
                        onChange={e => setNewTodoDetail(e.target.value)}
                        style={{ height: '34px', fontSize: '0.82rem' }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="date"
                          value={newTodoDate}
                          onChange={e => setNewTodoDate(e.target.value)}
                          style={{ height: '36px', fontSize: '0.82rem', flex: 1, borderRadius: '9999px', padding: '0 12px' }}
                        />
                        <button
                          type="submit"
                          className="app-btn app-btn--md app-btn--green app-btn--pill"
                        >
                          <Plus size={14} strokeWidth={2.2} />
                          <span>추가</span>
                        </button>
                      </div>
                    </form>

                    {/* Day To-Dos */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--cal-text-sub)' }}>
                        선택일 To Do ({selectedDayTodos.length}건)
                      </div>
                      {selectedDayTodos.map(td => (
                        <div
                          key={td.id}
                          className="oneul-card-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <input
                            type="checkbox"
                            checked={td.done}
                            onChange={() => handleToggleTodo(td.id)}
                            style={{ width: '18px', height: '18px', accentColor: '#43A047', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, minWidth: 0, textDecoration: td.done ? 'line-through' : 'none', opacity: td.done ? 0.55 : 1 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--cal-text-main)' }}>
                              {td.text}
                            </div>
                            {td.detail && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--cal-text-sub)' }}>
                                {td.detail}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTodo(td.id)}
                            className="app-icon-btn app-icon-btn--danger has-mobile-label"
                            title="할 일 삭제"
                            aria-label="할 일 삭제"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                            <span className="app-icon-btn-label">삭제</span>
                          </button>
                        </div>
                      ))}

                      {/* All Incomplete To-Dos */}
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--cal-text-sub)', marginTop: '12px' }}>
                        미완료 할 일 전체 ({todos.filter(t => !t.done).length}건)
                      </div>
                      {todos.filter(t => !t.done && t.date !== selectedDateStr).map(td => (
                        <div
                          key={td.id}
                          className="oneul-card-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fafafa' }}
                        >
                          <input
                            type="checkbox"
                            checked={td.done}
                            onChange={() => handleToggleTodo(td.id)}
                            style={{ width: '17px', height: '17px', accentColor: '#43A047', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--cal-text-main)' }}>
                              {td.text}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--cal-text-sub)' }}>
                              {td.date ? `기한: ${td.date}` : '기한 없음'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTodo(td.id)}
                            className="app-icon-btn app-icon-btn--danger has-mobile-label"
                            title="할 일 삭제"
                            aria-label="할 일 삭제"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                            <span className="app-icon-btn-label">삭제</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Google Calendar & Tasks Two-Way Settings Modal (Viewport Popup) */}
      {isSettingsOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: '16px'
          }}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '22px',
              maxWidth: '640px',
              width: '100%',
              boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfbff' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 900, color: 'var(--cal-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cloud size={18} strokeWidth={2} style={{ color: '#8265BD' }} />
                  <span>다른 구글 계정 캘린더 · 태스크 양방향 연동</span>
                </h3>
                <div style={{ fontSize: '0.76rem', color: 'var(--cal-text-sub)', marginTop: '2px' }}>
                  연동할 구글 계정의 Apps Script 웹 앱 URL을 연결하면 일정 및 할 일이 양방향 동기화됩니다.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="app-icon-btn app-icon-btn--md app-icon-btn--circle app-icon-btn--outline"
                title="닫기"
                aria-label="닫기"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px', background: '#ffffff', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSettingsTab('config')}
                style={{
                  padding: '12px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  borderBottom: settingsTab === 'config' ? '3px solid #8265BD' : '3px solid transparent',
                  color: settingsTab === 'config' ? '#6B4FA8' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Link2 size={15} strokeWidth={2} />
                <span>연동 URL 설정</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('gasGuide')}
                style={{
                  padding: '12px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  borderBottom: settingsTab === 'gasGuide' ? '3px solid #8265BD' : '3px solid transparent',
                  color: settingsTab === 'gasGuide' ? '#6B4FA8' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileCode2 size={15} strokeWidth={2} />
                <span>다른 계정 배포 스크립트</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {settingsTab === 'config' ? (
                <>
                  {/* Primary: GAS Web App URL */}
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>구글 캘린더·태스크 Apps Script 웹 앱 URL (추천)</span>
                      <button
                        type="button"
                        onClick={() => setSettingsTab('gasGuide')}
                        className="app-btn app-btn--xs app-btn--secondary app-btn--pill"
                      >
                        <span>스크립트 발급 방법</span>
                        <ArrowRight size={12} strokeWidth={2.2} />
                      </button>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={gcalGasUrl}
                        onChange={e => setGcalGasUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        style={{ height: '42px', fontSize: '0.82rem', flex: 1, borderRadius: '12px', fontFamily: 'monospace' }}
                      />
                      <button
                        type="button"
                        onClick={handleTestGasConnection}
                        disabled={testingGas}
                        className="app-btn app-btn--secondary"
                        style={{ height: '42px', borderRadius: '12px', padding: '0 14px' }}
                      >
                        <RefreshCw size={14} strokeWidth={2} className={testingGas ? 'animate-spin' : ''} />
                        <span>{testingGas ? '확인 중...' : '연결 테스트'}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--cal-text-sub)', marginTop: '5px', display: 'block' }}>
                      연결하려는 <strong>그 구글 계정</strong>에서 배포한 웹 앱 URL을 넣으면, 해당 계정의 캘린더와 Google Tasks가 양방향으로 연동됩니다.
                    </span>
                    {gasTestResult && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: gasTestResult.ok ? '#f0fdf4' : '#fef2f2',
                          color: gasTestResult.ok ? '#166534' : '#b91c1c',
                          border: `1px solid ${gasTestResult.ok ? '#bbf7d0' : '#fecaca'}`
                        }}
                      >
                        {gasTestResult.msg}
                      </div>
                    )}
                  </div>

                  {/* Calendar ID Filter (Optional) */}
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>캘린더 ID 지정 (선택사항 · 비워두면 기본 캘린더 자동 사용)</label>
                    <textarea
                      value={gcalCalId}
                      onChange={e => setGcalCalId(e.target.value)}
                      placeholder="예: primary:기본, xxx@group.calendar.google.com:Wee (쉼표로 구분)"
                      style={{ height: '66px', fontSize: '0.82rem', borderRadius: '12px' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--cal-text-sub)' }}>
                      여러 캘린더를 함께 불러오려면 <code>캘린더ID:별칭</code> 형태로 쉼표로 구분하세요. 새 일정은 첫 번째 캘린더에 등록됩니다.
                    </span>
                  </div>

                  {/* Legacy / Public API Key Fallback Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedApi(!showAdvancedApi)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#64748b',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        padding: '4px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {showAdvancedApi ? (
                        <ChevronDown size={14} strokeWidth={2.2} />
                      ) : (
                        <ChevronRight size={14} strokeWidth={2.2} />
                      )}
                      <span>고급 / 기존 공개 캘린더 API Key 설정 (읽기 전용 대체용)</span>
                    </button>
                    {showAdvancedApi && (
                      <div style={{ marginTop: '10px', padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Google API Key (공개 캘린더 읽기 전용)</label>
                          <input
                            type="text"
                            value={gcalApiKey}
                            onChange={e => setGcalApiKey(e.target.value)}
                            placeholder="Google Cloud Console에서 발급받은 API 키"
                            style={{ height: '38px', fontSize: '0.82rem', borderRadius: '10px' }}
                          />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>참고용 OAuth Client ID (선택)</label>
                          <input
                            type="text"
                            value={gcalClientId}
                            onChange={e => setGcalClientId(e.target.value)}
                            placeholder="xxx.apps.googleusercontent.com"
                            style={{ height: '38px', fontSize: '0.82rem', borderRadius: '10px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#EFEAF8', padding: '12px 14px', borderRadius: '12px', fontSize: '0.79rem', color: '#4c387a', border: '1px solid #D7CCF0', lineHeight: 1.55 }}>
                    <div style={{ fontWeight: 900, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={14} strokeWidth={2.2} />
                      <span>양방향 연동 안내</span>
                    </div>
                    <div>• <strong>구글 → Wee-It</strong>: 새로고침 시 구글 캘린더 일정과 Google Tasks 할 일을 불러옵니다.</div>
                    <div>• <strong>Wee-It → 구글</strong>: 일정/To Do를 추가, 완료 체크, 날짜 드래그 이동, 삭제하면 연동된 구글 계정에 즉시 반영됩니다.</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: '#EFEAF8', border: '1px solid #D7CCF0', borderRadius: '14px', padding: '14px 16px', fontSize: '0.8rem', color: '#3b2c63', lineHeight: 1.65 }}>
                    <div style={{ fontWeight: 900, marginBottom: '6px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={15} strokeWidth={2.2} />
                      <span>다른 구글 계정 연동 5단계 (OAuth 클라이언트 ID 불필요)</span>
                    </div>
                    <div>1. 브라우저에서 <strong>연동할 구글 계정</strong>으로 로그인 후 <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: '#6B4FA8', fontWeight: 800, textDecoration: 'underline' }}>script.google.com</a> 열기 → <strong>[새 프로젝트]</strong></div>
                    <div>2. 아래 코드를 전체 복사해 기존 코드를 지우고 붙여넣기 (상단 저장)</div>
                    <div>3. 왼쪽 메뉴 <strong>[서비스 (+)]</strong> 클릭 → <strong>Google Tasks API</strong> 선택 → <strong>[추가]</strong> (To Do 양방향 연동용)</div>
                    <div>4. 우측 상단 <strong>[배포] → [새 배포]</strong> → 유형: <strong>웹 앱</strong> · 실행: <strong>나</strong> · 액세스 권한: <strong>모든 사용자(Anyone)</strong> 선택 후 배포</div>
                    <div>5. 승인 후 발급된 <strong>웹 앱 URL (<code>.../exec</code>)</strong>을 복사해 <strong>[연동 URL 설정]</strong> 탭에 붙여넣고 저장!</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--cal-text-main)' }}>
                      구글 캘린더 + 태스크 양방향 Apps Script 전체 코드
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyGasScript}
                      className={`app-btn app-btn--sm app-btn--pill ${copiedGasScript ? 'app-btn--green' : 'app-btn--purple'}`}
                    >
                      {copiedGasScript ? <Check size={14} strokeWidth={2.3} /> : <Copy size={14} strokeWidth={2} />}
                      <span>{copiedGasScript ? '복사 완료!' : '전체 코드 복사'}</span>
                    </button>
                  </div>

                  <pre
                    style={{
                      margin: 0,
                      padding: '14px',
                      background: '#1e1b2e',
                      color: '#f1f5f9',
                      borderRadius: '14px',
                      fontSize: '0.73rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      maxHeight: '280px',
                      lineHeight: 1.5
                    }}
                  >
                    {CALENDAR_TASKS_GAS_CODE}
                  </pre>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="app-btn app-btn--md app-btn--subtle app-btn--pill"
                onClick={() => setIsSettingsOpen(false)}
              >
                <X size={15} strokeWidth={2} />
                <span>취소</span>
              </button>
              <button
                type="button"
                className="app-btn app-btn--md app-btn--purple app-btn--pill"
                onClick={handleSaveGoogleSettings}
              >
                <Save size={15} strokeWidth={2} />
                <span>저장 및 양방향 동기화</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Confirm Modal for Deleting Calendar Event (Viewport Popup) */}
      {deleteEventIdConfirm && createPortal(
        <div
          className="modal"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}
          onClick={() => setDeleteEventIdConfirm(null)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: '360px', width: '90%', borderRadius: '20px', padding: '24px', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '9999px',
                background: '#fef2f2',
                color: '#ef4444',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px'
              }}
            >
              <Trash2 size={20} strokeWidth={2} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)' }}>
              일정 삭제
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.86rem', color: 'var(--text-sub)', lineHeight: 1.5 }}>
              이 일정을 삭제하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="app-btn app-btn--md app-btn--subtle app-btn--pill"
                onClick={() => setDeleteEventIdConfirm(null)}
                style={{ flex: 1 }}
              >
                <X size={15} strokeWidth={2} />
                <span>취소</span>
              </button>
              <button
                type="button"
                className="app-btn app-btn--md app-btn--danger app-btn--pill"
                onClick={confirmDeleteCustomEvent}
                style={{ flex: 1 }}
              >
                <Trash2 size={15} strokeWidth={2} />
                <span>삭제</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
