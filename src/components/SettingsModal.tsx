import React, { useState } from 'react';
import { X, Copy, Check, Database, KeyRound, RefreshCw, Save } from 'lucide-react';
import { AppConfig } from '../services/googleSyncService';
import { DEFAULT_SCRIPT_URL, DEFAULT_SHEET_URL, DEFAULT_DRIVE_URL } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (newConfig: AppConfig) => void;
  onTestConnection: (scriptUrl: string) => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onTestConnection
}) => {
  const [scriptUrl, setScriptUrl] = useState(config.scriptUrl || DEFAULT_SCRIPT_URL);
  const [sheetUrl, setSheetUrl] = useState(config.sheetUrl || DEFAULT_SHEET_URL);
  const [driveUrl, setDriveUrl] = useState(config.driveUrl || DEFAULT_DRIVE_URL);
  const [calendarUrl, setCalendarUrl] = useState(config.calendarUrl || 'https://hyunji-007.github.io/Calendar/');
  const [password, setPassword] = useState(config.password || '0627');
  const [counselorName, setCounselorName] = useState(config.counselorName || '');
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'gasGuide'>('config');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      scriptUrl: scriptUrl.trim(),
      sheetUrl: sheetUrl.trim(),
      driveUrl: driveUrl.trim(),
      calendarUrl: calendarUrl.trim(),
      password: password.trim(),
      counselorName: counselorName.trim()
    });
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await onTestConnection(scriptUrl.trim());
      if (ok) {
        setTestResult({ ok: true, msg: '✅ 구글 시트 Web App 연결 성공! 양방향 데이터 연동이 가능합니다.' });
      } else {
        setTestResult({ ok: false, msg: '⚠️ 응답을 받았으나 데이터 형식을 확인해주세요.' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: `❌ 연결 실패: ${err.message || 'URL을 다시 확인해주세요.'}` });
    } finally {
      setTesting(false);
    }
  };

  const gasScriptCode = `/**
 * Wee-It 2026 구글 스프레드시트 양방향 연동 Apps Script
 * [설치 방법]
 * 1. 연동할 구글 스프레드시트 열기
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 3. 기존 코드 전체를 지우고 아래 코드를 그대로 붙여넣기
 * 4. 우측 상단 [배포] > [새 배포] 클릭
 * 5. 유형 선택: [웹 앱]
 * 6. 설명: Wee-It 2026 API
 * 7. 다음 사용자로 실행: [나(내 계정)]
 * 8. 액세스 권한이 있는 사용자: [모든 사용자(Anyone)] 필수 선택!
 * 9. [배포] 클릭 후 발급된 "웹 앱 URL"을 복사하여 Wee-It 설정에 입력!
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = (e && e.parameter && e.parameter.action) || '';

  // 관리카드 불러오기 요청
  if (action === 'getCards') {
    var cardSheet = ss.getSheetByName('관리카드');
    if (!cardSheet) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, cards: {} }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var cardData = cardSheet.getDataRange().getValues();
    var cards = {};
    for (var i = 1; i < cardData.length; i++) {
      var name = cardData[i][0];
      var jsonStr = cardData[i][1];
      if (name && jsonStr) {
        try { cards[name] = JSON.parse(jsonStr); } catch (err) {}
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true, cards: cards }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 기본 상담 데이터 불러오기 요청
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);

    // 관리카드 개별 저장
    if (payload.action === 'saveCard') {
      var cardSheet = ss.getSheetByName('관리카드');
      if (!cardSheet) {
        cardSheet = ss.insertSheet('관리카드');
        cardSheet.appendRow(['내담자성명', '카드데이터JSON', '최종수정시각']);
      }
      var cardRows = cardSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < cardRows.length; r++) {
        if (cardRows[r][0] === payload.name) {
          foundRow = r + 1;
          break;
        }
      }
      var cardPayloadStr = JSON.stringify(payload.card);
      var nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
      if (foundRow > 0) {
        cardSheet.getRange(foundRow, 2, 1, 2).setValues([[cardPayloadStr, nowStr]]);
      } else {
        cardSheet.appendRow([payload.name, cardPayloadStr, nowStr]);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: '관리카드 저장 완료' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 기본 상담기록 저장
    var sheet = ss.getSheets()[0];
    var rowNum = payload.rowNum ? Number(payload.rowNum) : null;

    // 첨부파일 드라이브 업로드 처리
    var uploadedAttachments = [];
    if (payload.existingAttachments) {
      try {
        uploadedAttachments = JSON.parse(payload.existingAttachments);
      } catch (err) {}
    }
    if (payload.attachments && payload.attachments.length > 0) {
      var folder;
      var folders = DriveApp.getFoldersByName("Wee-It_첨부파일");
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("Wee-It_첨부파일");
      }
      for (var i = 0; i < payload.attachments.length; i++) {
        var f = payload.attachments[i];
        var decoded = Utilities.base64Decode(f.base64);
        var blob = Utilities.newBlob(decoded, f.mimeType, f.name);
        var driveFile = folder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        uploadedAttachments.push({
          name: f.name,
          url: driveFile.getUrl(),
          fileId: driveFile.getId(),
          mimeType: f.mimeType
        });
      }
    }

    var nextAppointmentStr = (payload.nextDate && payload.nextTime)
      ? (payload.nextDate + ' ' + payload.nextTime)
      : (payload.nextDate || '');

    var rowValues = [
      payload.name || '',
      payload.school || '',
      payload.grade || '',
      payload.classNum || '',
      payload.gender || '남',
      payload.birth || '',
      payload.phone || '',
      payload.parentPhone || '',
      payload.counselor || '',
      payload.caseNum || '2026-',
      payload.big || '',
      payload.mid || '',
      payload.small || '',
      payload.date || '',
      payload.startTime || '',
      payload.endTime || '',
      payload.session || 1,
      payload.neisTitle || '',
      payload.content || '',
      payload.neisContent || '',
      nextAppointmentStr,
      '',
      payload.media || '면담',
      JSON.stringify(uploadedAttachments)
    ];

    if (rowNum && rowNum >= 2) {
      sheet.getRange(rowNum, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: '저장 완료되었습니다.' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyScript = () => {
    navigator.clipboard.writeText(gasScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[99998] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-800">
              구글 양방향 연동 및 시스템 설정
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="닫기"
            aria-label="설정 창 닫기"
            className="app-icon-btn app-icon-btn--circle"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 font-bold text-sm border-b-2 cursor-pointer transition-colors ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            기본 연동 설정
          </button>
          <button
            onClick={() => setActiveTab('gasGuide')}
            className={`py-3 px-4 font-bold text-sm border-b-2 cursor-pointer transition-colors ${
              activeTab === 'gasGuide'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            구글 스프레드시트 배포 스크립트 (GAS)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {activeTab === 'config' ? (
            <>
              {/* Google Apps Script Web App URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🌐 Google Apps Script 웹 앱 URL (양방향 연동 엔드포인트)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-xs font-mono focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="app-btn app-btn--md app-btn--subtle"
                    style={{ height: '40px', borderColor: '#cbd5e1' }}
                  >
                    <RefreshCw size={14} strokeWidth={2} className={testing ? 'animate-spin' : ''} />
                    <span>{testing ? '테스트 중...' : '연결 테스트'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  기본 연동 URL이 자동으로 세팅되어 있습니다. 다른 시트나 개인 구글 계정으로 연결하려면 변경할 수 있습니다.
                </p>
                {testResult && (
                  <div className={`mt-2 p-2.5 rounded-lg text-xs font-medium ${testResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {testResult.msg}
                  </div>
                )}
              </div>

              {/* Google Sheets URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  📚 Wee DB 구글 스프레드시트 바로가기 URL
                </label>
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-mono focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Google Drive URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  📁 첨부파일/스캔본 구글 드라이브 폴더 바로가기 URL
                </label>
                <input
                  type="text"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-mono focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Google Calendar Web URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  📅 구글 캘린더 연동 웹 URL
                </label>
                <input
                  type="text"
                  value={calendarUrl}
                  onChange={(e) => setCalendarUrl(e.target.value)}
                  placeholder="https://hyunji-007.github.io/Calendar/"
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-mono focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Counselor Name Default */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    👤 기본 상담자 성명
                  </label>
                  <input
                    type="text"
                    value={counselorName}
                    onChange={(e) => setCounselorName(e.target.value)}
                    placeholder="예: 전문상담교사 홍길동"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Password Setting */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    🔒 프로그램 잠금 암호
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="기본값: 0627"
                      className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg text-sm font-mono tracking-widest focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 leading-relaxed">
                <p className="font-bold mb-1">💡 직접 구글 시트에 양방향 연동을 구축하고 싶으신가요?</p>
                새로운 구글 스프레드시트의 <strong>[확장 프로그램] &gt; [Apps Script]</strong>에 아래 코드를 복사해서 붙여넣고, <strong>[배포] &gt; [새 배포] &gt; [웹 앱]</strong>(액세스 권한: 모든 사용자)으로 배포하시면 발급된 URL로 완벽하게 연동됩니다.
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Google Apps Script 전체 소스코드</span>
                <button
                  onClick={copyScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedScript ? '복사 완료!' : '전체 코드 복사'}
                </button>
              </div>

              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72 leading-snug">
                {gasScriptCode}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="app-btn app-btn--md app-btn--outline"
          >
            <X size={14} strokeWidth={2} />
            <span>취소</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="app-btn app-btn--md"
            style={{ background: '#059669', color: '#ffffff', boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)' }}
          >
            <Save size={14} strokeWidth={2} />
            <span>설정 저장</span>
          </button>
        </div>
      </div>
    </div>
  );
};
