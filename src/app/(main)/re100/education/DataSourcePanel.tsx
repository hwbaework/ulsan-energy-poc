'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ExternalLink, FilePlus2, KeyRound, RefreshCw, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useEducationSourceStore, type EduDataSource } from '@/stores/useEducationSourceStore';
import { formatMonthKo } from '@/types/education';
import { MOCK_COLLECTED, type CollectedItem } from '@/lib/mock-education-collect';

/** 기본 표시 건수 — 나머지는 "더 보기" */
const PREVIEW_COUNT = 10;

type FeedItem = CollectedItem;

/**
 * 자료 수집 — 연결된 소스에서 마지막 수집 이후 새 글만 모아 보여준다.
 * 항목마다 출처 칩이 붙고, "초안 만들기"로 에디터에 넘긴다.
 */
export function DataSourcePanel() {
  const router = useRouter();
  const sources = useEducationSourceStore((s) => s.sources);
  const seenLinks = useEducationSourceStore((s) => s.seenLinks);
  const markSeen = useEducationSourceStore((s) => s.markSeen);

  // 수집 대상 = 커넥터가 연결된 비참고 소스 — 화면 위에 '어디서 가져오는지' 항목으로 표시
  const feedSources = sources.filter((s) => s.endpoint && !s.reference && !(s.requiresKey && !s.apiKey));

  // POC: 수집 서버(/api/collect)는 가져오지 않았다 — 수집 결과는 목업, [수집]은 다시 불러오는 시늉만
  const [isFetching, setIsFetching] = useState(false);
  const fetchedItems = useMemo(
    () => [...MOCK_COLLECTED].sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || '')),
    [],
  );

  // 게시판은 최근 여러 달치가 섞여 오므로, 기본 화면은 이번 달로 한정한다.
  const nowMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  // 오늘 날짜 — "새 글"은 오늘 올라온 글만 (seen 여부가 아니라 발행일 기준)
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const seen = useMemo(() => new Set(seenLinks), [seenLinks]);
  const isNew = (it: FeedItem) => it.pubDate === today;
  // [발행 안 함]으로 치운(dismiss) 글은 기본 목록에서 숨긴다.
  const monthItems = fetchedItems.filter((it) => it.pubDate.startsWith(nowMonth) && !seen.has(it.id ?? it.link));
  const newCount = monthItems.filter(isNew).length;

  const [showAll, setShowAll] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // 보기 — 'new' = 이번 달 새 글(기본), 'range' = 기간(시작 월 ~ 끝 월). 몇 달 걸러 수집할 수 있어 기간으로 고른다
  const [mode, setMode] = useState<'new' | 'range'>('new');

  // 고를 수 있는 달 — 수집된 글의 가장 오래된 달부터 이번 달까지 빠짐없이 (최신순)
  const months = useMemo(() => {
    const got = fetchedItems.map((it) => it.pubDate.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m));
    const first = got.length ? got.reduce((a, b) => (a < b ? a : b)) : nowMonth;
    const out: string[] = [];
    let [y, m] = first.split('-').map(Number) as [number, number];
    for (let guard = 0; guard < 240; guard++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      out.push(key);
      if (key >= nowMonth) break;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out.reverse();
  }, [fetchedItems, nowMonth]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // 기간 기본값 — 가장 오래된 달 ~ 이번 달. 시작이 끝보다 늦으면 서로 바꿔 읽는다
  const rangeFrom = from || months[months.length - 1] || nowMonth;
  const rangeTo = to || months[0] || nowMonth;
  const [lo, hi] = rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
  const periodLabel = lo === hi ? formatMonthKo(lo) : `${formatMonthKo(lo)} ~ ${formatMonthKo(hi)}`;

  const listItems =
    mode === 'range'
      ? fetchedItems.filter((it) => {
          const mm = it.pubDate.slice(0, 7);
          return mm >= lo && mm <= hi;
        })
      : monthItems;

  const visibleItems = showAll ? listItems : listItems.slice(0, PREVIEW_COUNT);
  const hiddenCount = listItems.length - visibleItems.length;

  const handleCollect = () => {
    // 다시 긁어오기만 — 기존 글은 그대로 두고, 새로 들어온 글은 '새 글' 뱃지로 표시된다.
    // (개별 확인 처리는 항목의 [초안 만들기]/[발행 안 함]에서 seen 처리)
    setIsFetching(true);
    setTimeout(() => setIsFetching(false), 600);
  };

  return (
    <div className="rounded-xl bg-[#1a2332] ring-1 ring-white/[0.06]">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
        <h3 className="text-md font-semibold text-white">
          자료 수집
          <Badge variant="primary" className="ml-2">
            {mode === 'range'
              ? `${periodLabel} ${listItems.length}건`
              : `${formatMonthKo(nowMonth)} ${monthItems.length}건${newCount ? ` · 새 글 ${newCount}` : ''}`}
          </Badge>
        </h3>
        <div className="flex items-center gap-2">
          <select
            aria-label="보기"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as 'new' | 'range');
              setShowAll(false);
            }}
            className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          >
            <option value="new">새 글만</option>
            <option value="range">기간</option>
          </select>
          {/* 기간 — 시작 월 ~ 끝 월 */}
          {mode === 'range' && (
            <>
              <select
                aria-label="시작 월"
                value={rangeFrom}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setShowAll(false);
                }}
                className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthKo(m)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">~</span>
              <select
                aria-label="끝 월"
                value={rangeTo}
                onChange={(e) => {
                  setTo(e.target.value);
                  setShowAll(false);
                }}
                className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthKo(m)}
                  </option>
                ))}
              </select>
            </>
          )}
          <Button size="sm" onClick={handleCollect} loading={isFetching}>
            <RefreshCw size={13} className="mr-1" /> 수집
          </Button>
          <button
            type="button"
            title="데이터 소스"
            onClick={() => setSourcesOpen(true)}
            className="rounded-md p-2 text-slate-500 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>

      {/* 수집 소스 — 어디서 가져오는지 (API·크롤링) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-white/[0.06] px-5 py-2.5 text-sm">
        <span className="text-slate-500 shrink-0">수집 소스</span>
        {feedSources.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-300 hover:text-sky-300 transition-colors"
          >
            {s.org} {s.name}
            <span className="text-xs text-slate-500">· {s.method}</span>
            <ExternalLink size={11} className="text-slate-600" />
          </a>
        ))}
      </div>

      {/* 수집 목록 */}
      {isFetching && !fetchedItems.length ? (
        <div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-400">
          <Spinner size="sm" /> 수집 중...
        </div>
      ) : !listItems.length ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          {mode === 'range'
            ? `${periodLabel}에 수집된 글이 없습니다.`
            : `${formatMonthKo(nowMonth)}에 수집된 글이 없습니다.`}
        </p>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {visibleItems.map((item, i) => (
            <div key={item.id ?? `${item.link}-${i}`} className="flex items-center gap-4 px-5 py-3">
              <div className="w-[76px] shrink-0 text-xs text-slate-500 tabular-nums">{item.pubDate || '—'}</div>
              {/* 오늘 올라온 글만 '새 글' — 제목 왼쪽에 표시 */}
              {isNew(item) && (
                <Badge variant="primary" className="shrink-0">
                  새 글
                </Badge>
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white hover:text-sky-300 transition-colors break-words"
                >
                  {item.title}
                  <ExternalLink size={11} className="ml-1 inline-block shrink-0 align-middle text-slate-500" />
                </a>
                {item.summary && <p className="mt-0.5 text-xs text-slate-500">{item.summary}</p>}
              </div>
              <Badge variant="default" className="shrink-0">
                {item.dept ? `${item.org} : ${item.dept}` : item.org}
              </Badge>
              {/* 건별 판단: 초안으로 올릴지(→검토·발행) / 발행하지 않을지 */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams({
                    draftTitle: item.title,
                    draftUrl: item.link,
                    draftOrg: item.org,
                    draftSource: item.dept ? `${item.org} ${item.dept}` : item.org,
                    ...(item.pubDate && /^\d{4}-\d{2}-\d{2}$/.test(item.pubDate) ? { draftDate: item.pubDate } : {}),
                  });
                  router.push(`/re100/education/editor?${params.toString()}`);
                }}
              >
                <FilePlus2 size={13} className="mr-1" /> 초안 만들기
              </Button>
              <Button variant="ghost" size="sm" onClick={() => markSeen([item.id ?? item.link])}>
                발행 안 함
              </Button>
            </div>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex w-full items-center justify-center gap-1.5 px-5 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/[0.03] transition-colors"
            >
              <ChevronDown size={14} /> 더 보기 ({hiddenCount}건)
            </button>
          )}
        </div>
      )}

      <SourceModal open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  );
}


/**
 * 실제 동작 기준의 정직한 상태:
 * - 연결됨: 지금 이 화면에서 실수집이 되는 소스
 * - 키 필요: 인증키를 등록해야 연결할 수 있는 소스
 * - 챗봇 미구현: 챗봇(RAG)에 적재할 원전 자료 — 챗봇 구축 후 활용
 * - 연결 대기: 등록만 된 소스 (커넥터 연결은 개발)
 */
function sourceStatus(source: EduDataSource): { label: string; variant: 'success' | 'warning' | 'danger' } {
  if (source.method === '원전') return { label: '챗봇 미구현', variant: 'warning' };
  if (source.requiresKey && !source.apiKey) return { label: '키 필요', variant: 'danger' };
  if (source.requiresKey && source.apiKey) return { label: '키 등록됨 · 연결 확인 중', variant: 'warning' };
  if (source.endpoint) return { label: '연결됨', variant: 'success' };
  return { label: '연결 대기', variant: 'warning' };
}

/** 데이터 소스 팝업 — 연결 상태 확인 + 키 등록 (새 소스 등록은 뺌 — 수집 연결 개발이 따라붙어 일이 커짐) */
function SourceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sources = useEducationSourceStore((s) => s.sources);
  const updateSource = useEducationSourceStore((s) => s.updateSource);
  const toast = useToastStore((s) => s.add);

  const [keyInputId, setKeyInputId] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="데이터 소스" size="md">
      <div className="space-y-4">
        <div className="divide-y divide-white/[0.06] rounded-lg ring-1 ring-white/[0.08]">
          {sources.map((source) => {
            const status = sourceStatus(source);
            return (
              <div key={source.id}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-12 shrink-0 text-xs text-slate-500">{source.method}</span>
                  <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                    <span className="text-slate-500 shrink-0">{source.org}</span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors truncate',
                        // 원전 자료(챗봇/RAG용)는 아직 활용처가 없어 비활성으로 표시
                        source.method === '원전'
                          ? 'text-slate-500 line-through decoration-slate-600 hover:text-slate-400'
                          : 'text-white hover:text-sky-300',
                      )}
                    >
                      {source.name} <ExternalLink size={10} className="shrink-0 text-slate-600" />
                    </a>
                    {source.method === '원전' && (
                      <span className="shrink-0 text-xs text-slate-500">(챗봇 활용 예정)</span>
                    )}
                  </div>
                  {source.requiresKey && !source.apiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setKeyInputId(keyInputId === source.id ? null : source.id);
                        setKeyValue('');
                      }}
                      className="inline-flex shrink-0 items-center gap-1 text-xs text-sky-400/90 hover:text-sky-300 transition-colors"
                    >
                      <KeyRound size={11} /> 키 입력
                    </button>
                  )}
                  <Badge variant={status.variant} className="shrink-0">
                    {status.label}
                  </Badge>
                </div>
                {keyInputId === source.id && (
                  <div className="flex items-center gap-2 px-4 pb-3">
                    <div className="flex-1">
                      <Input
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        placeholder="발급받은 인증키를 붙여넣으세요"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!keyValue.trim()) {
                          toast('warning', '인증키를 입력해 주세요.');
                          return;
                        }
                        updateSource(source.id, { apiKey: keyValue.trim() });
                        toast('success', '인증키가 등록되었습니다. 연결 확인 후 수집이 시작됩니다.');
                        setKeyInputId(null);
                      }}
                    >
                      등록
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </Modal>
  );
}
