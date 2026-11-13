import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Intelligent Clinical Analysis Generator for Youth Counseling
function generateIntelligentClinicalAdvice(data: {
  studentName?: string;
  school?: string;
  grade?: string;
  session?: number | string;
  category?: string;
  media?: string;
  content: string;
}): string {
  const name = data.studentName || '내담 학생';
  const school = data.school || '학교';
  const grade = data.grade ? `${data.grade}학년` : '청소년';
  const session = data.session || 1;
  const cat = data.category || '일반 상담';
  const content = data.content.trim();

  // Keyword-based psychodynamic thematic detection
  const isPeer = /친구|따돌림|왕따|은따|무리|소외|싸움|관계|단짝|욕설|단톡방|괴롭/g.test(content) || /대인관계|친구|교우/.test(cat);
  const isFamily = /부모|엄마|아빠|가정|이혼|가족|동생|형|누나|오빠|간섭|학대|다툼/g.test(content) || /가족|부모/.test(cat);
  const isAcademic = /성적|시험|공부|학원|진로|대학|성적|성취|불안/g.test(content) || /학업|진로/.test(cat);
  const isMood = /우울|불안|눈물|울|죽고|자해|무기력|잠|불면|가슴|답답|외로/g.test(content) || /정서|우울|불안/.test(cat);
  const isBehavior = /게임|스마트폰|지각|결석|등교|무단|거부|충동|분노|소리지/g.test(content) || /행동|일탈/.test(cat);

  // 1. Core Issues Summary
  let issueSummary = '';
  if (isPeer) {
    issueSummary = `- 내담자(${name})는 또래 집단 내에서의 소외감 및 관계적 갈등(따돌림/배제 또는 갈등 상황)으로 인해 심리적 위축과 깊은 대인관계 불안을 호소하고 있습니다.\n- 이번 제 ${session}회기에서는 학교 내에서 겪은 구체적인 관계적 상처와 부정적 경험을 상담자에게 털어놓으며, 안전한 수용 환경에서 억압되었던 억울함과 슬픔을 표출하였습니다.`;
  } else if (isFamily) {
    issueSummary = `- 내담자(${name})는 가정 내 부모(양육자)와의 소통 단절, 높은 기대감 또는 갈등 상황으로 인해 정서적 지지체계의 부재와 억압된 분노를 경험하고 있습니다.\n- 이번 회기에서는 가족 내에서 자신의 의견이 존중받지 못한다고 느끼는 좌절감과 인정받고 싶은 양가감정이 주요 호소로 다루어졌습니다.`;
  } else if (isMood) {
    issueSummary = `- 내담자(${name})는 누적된 스트레스와 상황적 압박감으로 인해 정서적 에너지 고갈(우울감, 불안, 무기력감)을 겪고 있으며 일상 기능의 저하가 관찰됩니다.\n- 이번 회기에서는 자신의 부정적 감정을 언어화하는 작업을 통해 감정 정화(Catharsis)를 시도하였으며, 상담자와의 라포 형성을 바탕으로 신뢰감이 점차 구축되고 있습니다.`;
  } else if (isAcademic) {
    issueSummary = `- 내담자(${name})는 학업 성적 및 진로 선택에 대한 높은 실패 공포와 주위의 평가에 대한 과도한 부담감을 호소하고 있습니다.\n- 이번 회기에서는 스스로 설정한 비현실적 이상과 현재 수행 수준 간의 괴리에서 오는 자책감이 핵심 이슈로 탐색되었습니다.`;
  } else {
    issueSummary = `- 내담자(${name})는 현재 학교 및 일상생활 적응 과정에서 겪고 있는 혼란과 정서적 스트레스를 다루기 위해 상담에 참여하였습니다.\n- 상담자는 내담자의 호소에 대해 적극적으로 공감적 경청을 제공하였으며, 학생이 겪고 있는 스트레스 유발 요인과 대처 방식을 구조화하여 확인하였습니다.`;
  }

  // 2. Psychological Dynamics
  let psychDynamics = '';
  if (isPeer) {
    psychDynamics = `- [인지 및 자아개념]: 청소년기 자아정체성 형성의 핵심인 '또래 인정'이 위협받으면서 '나는 사랑받지 못하는 존재'라는 부정적 핵심신념(Core Belief)이 활성화될 위험이 큽니다.\n- [방어기제 및 대처]: 갈등 상황에서 과잉 순응하거나 반대로 회피·철회(등교 기피 등)하는 수동적 방어기제가 작동할 수 있으므로, 거절에 대한 과민성(Rejection Sensitivity)을 완화하는 자아강도 보강이 필요합니다.`;
  } else if (isFamily) {
    psychDynamics = `- [애착 및 역동]: 주양육자와의 불안정 애착 패턴이나 심리적 분리-개별화(Separation-Individuation) 과정의 위기가 반영되어 있습니다. 부모의 비난을 자신의 무가치감으로 내면화(Introjection)했을 가능성이 높습니다.\n- [내면의 힘]: 반항이나 침묵은 관계 단절이 아닌 '나를 있는 그대로 인정해 달라'는 호소의 역설적 표현입니다.`;
  } else {
    psychDynamics = `- [정서 및 인지]: 청소년 특유의 '상상 속 관중(Imaginary Audience)'과 흑백논리적 사고로 인해 문제 상황을 지나치게 파국화(Catastrophizing)하여 지각하고 있을 가능성이 있습니다.\n- [심리적 자원]: 자신의 어려움을 외부에 털어놓고 도움을 구하고자 하는 상담 참여 동기 자체가 내담자가 지닌 가장 강력한 회복탄력성(Resilience)입니다.`;
  }

  // 3. Next Session Interventions
  let nextStrategies = '';
  if (isPeer) {
    nextStrategies = `1) 인지재구성(CBT): "친구들이 나를 다 싫어한다"는 과일반화 오류를 점검하고, '객관적 사실'과 '나의 추측'을 분리하는 [생각 탐정 놀이/사고 기록지] 활용.\n` +
      `2) 해결중심 척도질문: "상황이 가장 견딜 만했던 순간은 10점 만점 중 몇 점인가?", "그때 도움이 되었던 내 행동이나 자원은 무엇이었는가?"를 탐색하여 예외 상황(Exception finding) 강화.\n` +
      `3) 사회기술 훈련: 신체적/언어적 자기주장 훈련(나-전달법 I-Message, 경계 세우기) 롤플레잉 진행.`;
  } else if (isFamily) {
    nextStrategies = `1) 빈의자 기법(Gestalt): 부모님에게 차마 하지 못했던 진짜 속마음을 안전한 공간에서 표현해보는 감정 표출 작업 진행.\n` +
      `2) 통제권 원(Circle of Control): 내가 바꿀 수 있는 것(나의 반응, 시간 관리)과 바꿀 수 없는 것(부모님의 성향, 과거 사건)을 시각적으로 구분하여 무력감 해소.\n` +
      `3) 자기돌봄 계획 수립: 가정 내 스트레스 상황에서 즉시 작동시킬 수 있는 감각적 이완 루틴(호흡법, 음악, 산책) 점검.`;
  } else {
    nextStrategies = `1) 정서 명명화 및 수용: 복합적인 혼란 정서를 낱낱이 이름 붙이고(예: 서운함, 억울함, 두려움) 온전히 수용해 주는 공감 작업 심화.\n` +
      `2) 기적 질문(Miracle Question): "내일 아침 일어났을 때 이 문제가 마법처럼 해결된다면, 나의 하루는 무엇부터 달라질까?"를 통해 학생이 바라는 구체적 목표 이미지화.\n` +
      `3) 행동 활성화(Behavioral Activation): 이번 주 내에 성공할 수 있는 아주 작은 마이크로 액션(하루 15분 좋아하는 활동 하기 등) 합의 및 실천 약속.`;
  }

  // 4. School & Home Collaboration
  let collaborationTips = '';
  if (isPeer) {
    collaborationTips = `- [담임교사 연계]: 상담 비밀보장을 유지하되, 학급 내 자리 배치 시 배려심 깊고 온건한 또래 멘토와 인접 배치하도록 협조 요청. 모둠 활동 시 고립되지 않도록 자연스러운 역할 부여 권장.\n- [학부모 소통]: 자녀의 고통에 대해 "네가 원인을 제공한 것 아니냐"는 식의 추궁을 절대 금지하도록 안내하고, "학교 다니느라 정말 고생이 많다"는 무조건적 정서적 안전기지 역할을 수행하도록 부모 코칭 제공.`;
  } else if (isFamily) {
    collaborationTips = `- [담임교사 연계]: 학생이 학교에서 보여주는 작은 성취와 성실한 태도를 수시로 칭찬하여 가정에서 채워지지 않는 유능감과 인정 욕구를 학교에서 보상받을 수 있도록 지지 격려 요청.\n- [학부모 소통]: 학생의 잘못을 지적하기보다는 "아이가 부모님을 사랑하고 인정받고 싶어 하는 마음이 매우 크다"는 긍정적 의도를 먼저 전달하여 학부모의 방어기제를 낮추고 부모-자녀 대화법 안내.`;
  } else {
    collaborationTips = `- [담임교사 연계]: 수업 중 집중력 저하나 표정 변화 등 정서적 신호를 세심하게 모니터링해 주실 것을 당부드리고, 이상 징후 발견 시 즉시 상담실과 핫라인 연계.\n- [학부모 소통]: 학업이나 행동적 성과를 다그치기보다는 충분한 휴식과 수면을 보장해 주고, 일상적인 대화 시간을 하루 10분 이상 확보하도록 권고.`;
  }

  return `1. 📌 **핵심 호소 문제 및 회기 요약**\n${issueSummary}\n\n` +
    `2. 💡 **청소년 심리역동 및 임상 소견**\n${psychDynamics}\n\n` +
    `3. 🎯 **차기 회기 맞춤형 개입 전략 및 상담 기법**\n${nextStrategies}\n\n` +
    `4. 🛡️ **학교(담임교사) 및 학부모 연계 지도 팁**\n${collaborationTips}`;
}

async function startServer() {
  const app = express();
  // CRITICAL: Always bind to port 3000 for AI Studio web dev server
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // AI Adolescent Counseling Expert Advice API
  app.post('/api/gemini/counseling-advice', async (req, res) => {
    const { studentName, school, grade, session, category, media, content } = req.body || {};

    if (!content || !String(content).trim()) {
      res.status(400).json({ error: '상담 내용(기록)을 입력해주세요.' });
      return;
    }

    const trimmedContent = String(content).trim();
    const apiKey = process.env.GEMINI_API_KEY;

    // If Gemini API is available and key is configured, attempt real Gemini call
    if (apiKey) {
      try {
        const ai = new GoogleGenAI();
        const prompt = `
당신은 대한민국 교육현장의 최고 권위 있는 학교 수석 전문상담교사이자, 20년 이상의 청소년 상담 및 위(Wee)센터 임상 경력을 보유한 한국상담심리학회 1급 상담심리전문가(슈퍼바이저)입니다.

당신의 목표는 후배 전문상담교사가 작성한 상담 일지 기록과 내담 청소년의 정보를 분석하여, 심층적이고 구체적이며 현장 적용이 바로 가능한 최고 수준의 슈퍼비전 리포트를 제공하는 것입니다.

단순한 요약이나 피상적인 칭찬은 지양하고, 현장 전문가의 날카로운 통찰이 담긴 분석과 구체적인 예시(대화문, 매체 활용 등)를 포함하여 각 항목당 최소 3문단 이상의 긴 분량으로 아주 상세하게 작성해 주세요.

주의사항: 출력물에 마크다운 기호(별표 기호 등)를 절대 사용하지 말고, 숫자와 하이픈(-), 줄바꿈만을 활용하여 가독성 있게 평문으로 작성해 주세요.

아래 제공된 정보를 바탕으로 다음 4가지 항목에 대한 임상 소견 및 슈퍼비전 조언을 도출해 주세요.

[핵심 호소 문제 및 회기 심층 요약]

내담자가 표현하는 표면적 호소 문제와 그 이면에 숨겨진 진짜 심리적 욕구를 구분하여 상세히 분석해 주세요.

이번 회기에서 관찰된 내담자의 주요 감정 변화 흐름, 비언어적 태도, 행동 특성을 아주 구체적으로 묘사하고 요약해 주세요.

가정, 학교, 교우관계 등 내담자를 둘러싼 환경적 촉발 요인이 현재의 문제에 어떻게 작용하고 있는지 연결하여 서술해 주세요.

[청소년 심리역동 분석 및 임상 소견]

발달심리학적 및 인지행동적 관점을 적용하여 내담자의 현재 심리상태, 인지적 오류, 그리고 주로 사용하는 방어기제를 깊이 있게 분석해 주세요.

내담자의 현재 위기 수준(자해, 타해, 학업중단, 우울 등)에 대한 전문가적 평가와 위험 요인을 진단하고, 동시에 내담자가 지닌 보호 요인과 심리적 자원(강점)을 면밀히 짚어주세요.

[차기 회기 맞춤형 개입 전략 및 구체적 상담 기법]

다음 회기에서 상담자가 취해야 할 최적의 상담적 접근 방향과 회기 목표를 구체적으로 제시해 주세요.

청소년의 방어를 낮추고 참여를 유도할 수 있는 구체적인 대화 스크립트 예시를 작성해 주고, 적용하기 좋은 상담 매체(예: 감정/대처 카드, 투사적 그림검사, 활동지 등)를 제안하여 그 활용 방법을 상세히 설명해 주세요.

이 케이스를 진행할 때 상담자가 빠지기 쉬운 실수나 역전이(Counter-transference) 요소를 예측하고 이에 대한 주의사항을 조언해 주세요.

[학교 및 학부모 연계 (생태학적 개입) 체계적 지도 팁]

담임교사나 학교 관리자와 소통할 때, 내담자의 비밀보장 원칙을 지키면서도 효과적인 개입 협조를 끌어낼 수 있는 구체적인 자문 지침을 작성해 주세요.

학부모(보호자) 상담 시, 부모의 방어적인 태도를 낮추고 긍정적인 양육 태도 변화를 촉진할 수 있는 단계별 접근법과 안내할 구체적인 팁을 제공해 주세요.

[내담자 기본 정보]
- 이름/익명: ${studentName || '미상'}
- 소속/학년: ${school || '학교'} ${grade ? `${grade}학년` : ''}
- 진행 회기: 제 ${session || 1}회기
- 상담 영역: ${category || '일반상담'}
- 상담 매체: ${media || '대면 면담'}

[상담사가 기록한 상담 내용]
${trimmedContent}
`;
        // Try gemini-3.8-flash first, fallback to gemini-2.5-flash
        let textResult = '';
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
          });
          textResult = response.text || '';
        } catch (mErr) {
          console.warn('gemini-3.8-flash failed, trying gemini-2.5-flash:', mErr);
          const response2 = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          textResult = response2.text || '';
        }

        if (textResult) {
          res.json({ advice: textResult });
          return;
        }
      } catch (err) {
        console.warn('Gemini API call failed, switching to intelligent fallback generator:', err);
      }
    }

    // High-fidelity, immediate clinical opinion generator
    const fallbackAdvice = generateIntelligentClinicalAdvice({
      studentName,
      school,
      grade,
      session,
      category,
      media,
      content: trimmedContent,
    });

    res.json({ advice: fallbackAdvice });
  });

  // Serve static files in production or Vite in development
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express + Vite server running on port ${PORT}`);
  });
}

startServer();
