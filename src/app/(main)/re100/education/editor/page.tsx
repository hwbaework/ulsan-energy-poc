'use client';

import { BackButton } from '@/components/layout/PageTitle';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, ImagePlus, Paperclip, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useEducationContentStore } from '@/stores/useEducationContentStore';
import { useToastStore } from '@/stores/useToastStore';
import { getCollectedArticle } from '@/lib/mock-education-collect';
import type { EduAttachment, EduReport } from '@/types/education';

interface SectionForm {
  heading: string;
  /** 빈 줄로 문단 구분 */
  body: string;
  images: { url: string; caption?: string }[];
}

interface QuestionForm {
  question: string;
  options: string[];
  answerIndex: number;
}

interface SourceForm {
  label: string;
  url: string;
}

const EMPTY_SECTION: SectionForm = { heading: '', body: '', images: [] };

/** 업로드한 이미지를 인라인 data URL로 변환 (POC — 백엔드 저장 대신) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
const EMPTY_SOURCE: SourceForm = { label: '', url: '' };
const EMPTY_QUESTION: QuestionForm = { question: '', options: ['', '', '', ''], answerIndex: 0 };

function EducationEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const reports = useEducationContentStore((s) => s.reports);
  const upsertReport = useEducationContentStore((s) => s.upsertReport);
  const toast = useToastStore((s) => s.add);

  const editing = editId ? reports.find((r) => r.id === editId) : undefined;

  // 자료 수집에서 넘어온 초안 프리필 파라미터
  const draftTitle = searchParams.get('draftTitle');
  const draftUrl = searchParams.get('draftUrl');
  const draftDate = searchParams.get('draftDate');
  const draftSource = searchParams.get('draftSource');
  const draftOrg = searchParams.get('draftOrg');

  const [title, setTitle] = useState('');
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [sections, setSections] = useState<SectionForm[]>([{ ...EMPTY_SECTION }]);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [sources, setSources] = useState<SourceForm[]>([]);
  const [attachments, setAttachments] = useState<EduAttachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);
  // 초안 진입 시 자동 본문 로드를 1회로 제한 (Strict Mode의 effect 이중 실행 방지)
  const autoLoadedRef = useRef(false);

  // 원문 URL에서 본문을 크롤링해 채운다 (자동: 초안 진입 시 replace / 수동: [본문 불러오기] append)
  const loadBody = useCallback(
    async (url: string, opts?: { append?: boolean }) => {
      setBodyLoading(true);
      try {
        // POC: 원문 크롤링 서버(/api/collect)는 가져오지 않았다 — 수집 목업의 원문 본문을 채운다
        await new Promise((r) => setTimeout(r, 400)); // 원문 불러오는 시간 — 초안 프리필(제목·발행일) 뒤에 전체 제목으로 바뀐다
        const article = getCollectedArticle(url);
        const res = { ok: !!article };
        const data: { title?: string; body?: string; attachments?: string[]; error?: string } = article ?? {
          error: '원문 본문을 찾지 못했습니다. 직접 작성해 주세요.',
        };
        if (!res.ok || !data.body) {
          toast('warning', data.error ?? '원문에서 본문을 가져오지 못했습니다. 직접 작성해 주세요.');
          return;
        }
        // 목록 제목은 잘려 오므로, 자동 로드(초안 진입) 시 상세 페이지에서 긁은 전체 제목으로 교체
        if (!opts?.append && data.title) setTitle(data.title);
        const block: SectionForm = { heading: '', body: data.body, images: [] };
        setSections((prev) => {
          if (!opts?.append) return [block];
          // 이미 쓴 내용은 보존하고 뒤에 새 블록으로 추가 (빈 블록만 정리)
          const kept = prev.filter((s) => s.body.trim() || s.images.length);
          return [...kept, block];
        });
        if (data.attachments?.length) {
          setAttachments((prev) => {
            const have = new Set(prev.map((a) => a.name));
            return [...prev, ...data.attachments!.filter((n) => !have.has(n)).map((name) => ({ name }))];
          });
        }
        if (opts?.append) toast('success', '원문 본문을 불러왔습니다. 내용을 검토·정리해 주세요.');
      } catch {
        toast('warning', '원문 불러오기에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        setBodyLoading(false);
      }
    },
    [toast],
  );

  // [본문 불러오기] 버튼 — 출처에 입력된 원문 URL에서 본문을 추가로 불러온다
  const handleLoadBody = () => {
    const url = sources.find((s) => /^https?:\/\//.test(s.url.trim()))?.url.trim();
    if (!url) {
      toast('warning', '먼저 출처에 원문 URL을 입력해 주세요.');
      return;
    }
    loadBody(url, { append: true });
  };

  // [AI 문항 생성] 버튼 — 지금은 LLM 미연동 POC. 본문을 바탕으로 문항을 자동 생성할 자리.
  const handleGenerateQuestions = () => {
    const bodyText = sections
      .map((s) => s.body)
      .join('\n')
      .trim();
    if (!bodyText) {
      toast('warning', '본문을 먼저 작성하거나 불러온 뒤 생성해 주세요.');
      return;
    }
    // TODO: LLM 연동 — bodyText를 프롬프트로 4지선다 문항을 자동 생성해 setQuestions로 반영
    setQuestions((prev) => [...prev, { ...EMPTY_QUESTION, options: ['', '', '', ''] }]);
    toast('info', 'AI 문항 생성은 LLM 연동 후 본문 기반으로 자동 작성됩니다. 지금은 검토용 빈 문항을 추가했어요.');
  };

  // 수정 모드: 기존 자료를 폼에 1회 로드
  useEffect(() => {
    if (loaded) return;
    if (editing) {
      setTitle(editing.title);
      setPublishedAt(editing.publishedAt);
      setSections(
        editing.sections.map((s) => ({
          heading: s.heading,
          body: s.body.join('\n\n'),
          images: s.images ?? [],
        })),
      );
      setQuestions(
        editing.questions.map((q) => ({
          question: q.question,
          options: [...q.options],
          answerIndex: q.answerIndex,
        })),
      );
      setSources((editing.sources ?? []).map((s) => ({ label: s.label, url: s.url ?? '' })));
      setAttachments(editing.attachments ?? []);
    } else if (draftTitle) {
      // 자료 수집에서 "초안 만들기"로 진입 — 제목·발행일·출처 프리필
      setTitle(draftTitle);
      if (draftDate) setPublishedAt(draftDate);
      if (draftUrl || draftSource) {
        setSources([{ label: draftSource || draftUrl || '', url: draftUrl ?? '' }]);
      }
      // 원문 링크가 있으면 본문을 크롤링해 자동으로 채운다 (ref 가드로 1회만)
      if (draftUrl && !autoLoadedRef.current) {
        autoLoadedRef.current = true;
        loadBody(draftUrl);
      }
    }
    setLoaded(true);
  }, [loaded, editing, draftTitle, draftUrl, draftDate, draftSource, loadBody]);

  if (editId && !editing) {
    return (
      <EmptyState
        title="수정할 교육 자료를 찾을 수 없습니다"
        action={
          <Button variant="secondary" onClick={() => router.push('/re100/education')}>
            목록으로 돌아가기
          </Button>
        }
      />
    );
  }

  const updateSection = (i: number, patch: Partial<SectionForm>) =>
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addImages = async (sectionIdx: number, files: FileList) => {
    const urls = await Promise.all([...files].filter((f) => f.type.startsWith('image/')).map(fileToDataUrl));
    setSections((prev) =>
      prev.map((s, idx) => (idx === sectionIdx ? { ...s, images: [...s.images, ...urls.map((url) => ({ url }))] } : s)),
    );
  };

  const removeImage = (sectionIdx: number, imgIdx: number) =>
    setSections((prev) =>
      prev.map((s, idx) => (idx === sectionIdx ? { ...s, images: s.images.filter((_, k) => k !== imgIdx) } : s)),
    );
  const updateQuestion = (i: number, patch: Partial<QuestionForm>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const handleSave = (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast('warning', '제목을 입력해 주세요.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
      toast('warning', '발행일을 선택해 주세요.');
      return;
    }
    // 소제목은 선택 — 내용(글 또는 이미지)이 있는 섹션만 저장
    const validSections = sections
      .map((s) => ({
        heading: s.heading.trim(),
        body: s.body
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
        images: s.images.length ? s.images : undefined,
      }))
      .filter((s) => s.body.length > 0 || (s.images?.length ?? 0) > 0);
    if (validSections.length === 0) {
      toast('warning', '내용(글 또는 이미지)이 있는 본문 블록이 1개 이상 필요합니다.');
      return;
    }
    for (const q of questions) {
      if (!q.question.trim() || q.options.some((o) => !o.trim())) {
        toast('warning', '문항의 질문과 보기 4개를 모두 입력해 주세요.');
        return;
      }
    }

    const id = editing?.id ?? `rpt-${Date.now()}`;
    const report: EduReport = {
      id,
      title: title.trim(),
      publishedAt,
      sections: validSections,
      questions: questions.map((q, i) => ({
        id: `${id}:${i + 1}`,
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        answerIndex: q.answerIndex,
      })),
      sources: sources.map((s) => ({ label: s.label.trim(), url: s.url.trim() || undefined })).filter((s) => s.label),
      // 수집에서 온 초안은 출처 기관 칩 유지, 직접 작성은 미지정(→ "직접 작성" 표시)
      sourceName: editing ? editing.sourceName : (draftOrg ?? undefined),
      attachments: attachments.length ? attachments : undefined,
      status,
    };
    upsertReport(report);
    toast(
      'success',
      status === 'published'
        ? '교육 자료가 발행되었습니다. 문항이 월간 쪽지시험에 포함됩니다.'
        : '초안으로 저장되었습니다. 발행 전까지 사용자에게 보이지 않습니다.',
    );
    router.push(`/re100/education/report?id=${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: 'RE100', path: '/re100' },
            { label: 'RE100 교육', path: '/re100/education' },
            { label: '교육 자료', path: '/re100/education' },
            { label: editing ? '자료 수정' : '새 자료 작성' },
          ]}
        />
      </div>

      {/* 제목 · 오른쪽에 취소 · 저장 — 스크롤해도 상단(헤더 100px 아래)에 따라다닌다 */}
      <div className="sticky top-[100px] z-20 flex flex-wrap items-center justify-between gap-3 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <BackButton label="돌아가기" />
          <h1 className="text-2xl font-bold text-white">{editing ? '교육 자료 수정' : '새 교육 자료 작성'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="cancel" onClick={() => router.back()}>
            취소
          </Button>
          <Button onClick={() => handleSave('published')}>
            <Save size={14} className="mr-1" /> 저장
          </Button>
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-white/[0.06] space-y-4">
        <Input
          label="제목"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 직접 PPA 제도 개편 핵심 정리"
        />
        <div className="max-w-xs">
          <Input
            label="발행일"
            required
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </div>
      </div>

      {/* 본문 섹션 */}
      <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-white/[0.06] space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">본문</h2>
            {bodyLoading && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Spinner size="sm" /> 원문 불러오는 중...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleLoadBody} loading={bodyLoading}>
              <Download size={13} className="mr-1" /> 본문 불러오기
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSections((p) => [...p, { ...EMPTY_SECTION }])}>
              <Plus size={13} className="mr-1" /> 블록 추가
            </Button>
          </div>
        </div>
        {sections.map((section, i) => (
          <div key={i} className="rounded-lg bg-white/[0.02] p-4 ring-1 ring-white/[0.06] space-y-3">
            <Textarea
              value={section.body}
              onChange={(e) => updateSection(i, { body: e.target.value })}
              placeholder="내용을 입력하세요"
              rows={12}
              className="resize-none"
            />

            {/* 이 블록의 사진 (본문 = 글 + 사진) */}
            {section.images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {section.images.map((img, ii) => (
                  <div key={ii} className="space-y-1.5">
                    <div className="rounded-lg bg-white p-2 ring-1 ring-white/[0.06]">
                      <img src={img.url} alt="" className="mx-auto max-h-32 w-auto" />
                    </div>
                    <input
                      type="text"
                      value={img.caption ?? ''}
                      onChange={(e) =>
                        updateSection(i, {
                          images: section.images.map((x, k) => (k === ii ? { ...x, caption: e.target.value } : x)),
                        })
                      }
                      placeholder="사진 설명 (선택)"
                      className="w-full rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                    <Button variant="danger" size="sm" className="w-full" onClick={() => removeImage(i, ii)}>
                      <Trash2 size={14} className="mr-1" /> 사진 삭제
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-b from-slate-500 to-slate-600 px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-colors hover:from-slate-400 hover:to-slate-500">
              <ImagePlus size={14} /> 사진 추가
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addImages(i, e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            {/* 원본(첫) 본문은 지울 수 없다 — 추가한 블록만 삭제 */}
            {i > 0 && (
              <Button variant="danger" size="sm" onClick={() => setSections((prev) => prev.filter((_, idx) => idx !== i))}>
                <Trash2 size={14} className="mr-1" /> 블록 삭제
              </Button>
            )}
            </div>
          </div>
        ))}
      </div>

      {/* 출처 */}
      <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">출처</h2>
          <Button variant="secondary" size="sm" onClick={() => setSources((p) => [...p, { ...EMPTY_SOURCE }])}>
            <Plus size={13} className="mr-1" /> 출처 추가
          </Button>
        </div>
        {sources.map((source, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                value={source.label}
                onChange={(e) =>
                  setSources((prev) => prev.map((s, idx) => (idx === i ? { ...s, label: e.target.value } : s)))
                }
                placeholder="출처명 (예: 산업통상자원부 보도자료, 2026.7.)"
              />
            </div>
            <div className="flex-1">
              <Input
                value={source.url}
                onChange={(e) =>
                  setSources((prev) => prev.map((s, idx) => (idx === i ? { ...s, url: e.target.value } : s)))
                }
                placeholder="URL (선택)"
              />
            </div>
            <Button variant="danger" size="sm" onClick={() => setSources((prev) => prev.filter((_, idx) => idx !== i))}>
              <Trash2 size={14} className="mr-1" /> 삭제
            </Button>
          </div>
        ))}
        {sources.length === 0 && <p className="text-sm text-slate-500 text-center py-2">등록된 출처가 없습니다.</p>}

        {/* 별첨 — 파일이 있을 때만. url 있으면 사이트에서 열람, 없으면 파일명만(원문에서 받기) */}
        {attachments.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
              <Paperclip size={14} /> 별첨
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/[0.08]"
                >
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400/90 hover:text-sky-300 transition-colors"
                    >
                      {att.name}
                    </a>
                  ) : (
                    att.name
                  )}
                  <Button variant="danger" size="sm" className="ml-1 h-6 px-2 text-xs" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 size={12} className="mr-0.5" /> 삭제
                  </Button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 쪽지시험 문항 */}
      <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-white/[0.06] space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">쪽지시험 문항</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleGenerateQuestions}>
              <Sparkles size={13} className="mr-1" /> AI 문항 생성
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setQuestions((p) => [...p, { ...EMPTY_QUESTION, options: ['', '', '', ''] }])}
            >
              <Plus size={13} className="mr-1" /> 문항 추가
            </Button>
          </div>
        </div>
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-lg bg-white/[0.03] p-4 ring-1 ring-white/[0.06] space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-emerald-400 shrink-0">Q{qi + 1}.</span>
              <div className="flex-1">
                <Input
                  value={q.question}
                  onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                  placeholder="질문을 입력하세요"
                />
              </div>
              <Button variant="danger" size="sm" onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== qi))}>
                <Trash2 size={14} className="mr-1" /> 문항 삭제
              </Button>
            </div>
            <div className="space-y-2">
              {q.options.map((option, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="radio"
                      name={`answer-${qi}`}
                      checked={q.answerIndex === oi}
                      onChange={() => updateQuestion(qi, { answerIndex: oi })}
                      className="accent-emerald-500"
                    />
                    정답
                  </label>
                  <div className="flex-1">
                    <Input
                      value={option}
                      onChange={(e) =>
                        updateQuestion(qi, {
                          options: q.options.map((o, idx) => (idx === oi ? e.target.value : o)),
                        })
                      }
                      placeholder={`보기 ${oi + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {questions.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">
            문항이 없습니다. 문항을 추가하면 이 자료가 월간 쪽지시험에 출제됩니다.
          </p>
        )}
      </div>

    </div>
  );
}

export default function EducationEditorPage() {
  return (
    <Suspense fallback={null}>
      <EducationEditor />
    </Suspense>
  );
}
