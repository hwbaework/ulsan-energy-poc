'use client';

// 내 건물 절감 테스트 — TerraWatt BuildingTestPanel 이식 (Next.js·lucide).
// [검색] → 카카오(다음) 우편번호 팝업(키 불필요) → 주소 선택 → Mapbox 지오코딩(기존 토큰) → 설치.
// [내 위치] → geolocation. [핀으로 이동] → 현재 설치 위치로 카메라 복귀.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Search, ChevronDown, X, LocateFixed, Crosshair } from 'lucide-react';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_KEY || '';

type GeoResult = { label: string; lng: number; lat: number };
type DaumPostcodeData = { roadAddress: string; jibunAddress: string; address: string };
declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: { oncomplete: (data: DaumPostcodeData) => void; width?: string; height?: string }) => {
        embed: (el: HTMLElement) => void;
      };
    };
  }
}

let postcodeLoader: Promise<void> | null = null;
function loadPostcode(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (!postcodeLoader) {
    postcodeLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('postcode load fail'));
      document.head.appendChild(s);
    });
  }
  return postcodeLoader;
}

interface KakaoDoc {
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  road_address?: { address_name?: string };
  x: string;
  y: string;
}
async function searchKakao(q: string): Promise<GeoResult[]> {
  const headers = { Authorization: `KakaoAK ${KAKAO_KEY}` };
  for (const path of ['address', 'keyword'] as const) {
    const r = await fetch(`https://dapi.kakao.com/v2/local/search/${path}.json?query=${encodeURIComponent(q)}&size=5`, {
      headers,
    });
    if (!r.ok) continue;
    const j = (await r.json()) as { documents?: KakaoDoc[] };
    const list = (j.documents ?? [])
      .map((d) => ({
        label: d.place_name
          ? `${d.place_name} (${d.road_address_name || d.address_name || ''})`
          : d.road_address?.address_name || d.address_name || '',
        lng: Number(d.x),
        lat: Number(d.y),
      }))
      .filter((v) => v.label && Number.isFinite(v.lng) && Number.isFinite(v.lat));
    if (list.length) return list;
  }
  return [];
}

async function geocode(q: string): Promise<GeoResult[]> {
  if (KAKAO_KEY) {
    const k = await searchKakao(q);
    if (k.length) return k;
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=kr&language=ko&limit=5&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  const j = (await r.json()) as { features?: { place_name?: string; text?: string; center: [number, number] }[] };
  return (j.features ?? []).map((f) => ({ label: f.place_name ?? f.text ?? '', lng: f.center[0], lat: f.center[1] }));
}

export function BuildingSearchPanel({
  onPick,
  onRecenter,
  hasPlaced,
}: {
  onPick: (lng: number, lat: number, label: string) => void;
  onRecenter: () => void;
  hasPlaced: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const postcodeBoxRef = useRef<HTMLDivElement | null>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) {
      setPostcodeOpen(true);
      return;
    }
    setBusy(true);
    setErr('');
    setResults([]);
    try {
      const list = await geocode(q);
      if (!list.length) setErr('결과가 없어요. 다른 주소로 시도해 보세요.');
      setResults(list);
    } catch {
      setErr('검색 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  const pickByAddress = async (addr: string) => {
    setBusy(true);
    setErr('');
    setResults([]);
    try {
      const list = await geocode(addr);
      if (list.length) onPick(list[0]!.lng, list[0]!.lat, addr);
      else setErr('좌표를 찾지 못했어요. 입력창에 직접 검색해 보세요.');
    } catch {
      setErr('좌표 변환 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!postcodeOpen) return;
    let cancelled = false;
    loadPostcode()
      .then(() => {
        if (cancelled || !postcodeBoxRef.current || !window.daum) return;
        postcodeBoxRef.current.innerHTML = '';
        new window.daum.Postcode({
          oncomplete: (data) => {
            const addr = data.roadAddress || data.jibunAddress || data.address;
            setPostcodeOpen(false);
            setQuery(addr);
            pickByAddress(addr);
          },
          width: '100%',
          height: '100%',
        }).embed(postcodeBoxRef.current);
      })
      .catch(() => {
        setErr('주소 검색 창을 불러오지 못했어요.');
        setPostcodeOpen(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcodeOpen]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setErr('이 브라우저는 위치를 지원하지 않아요.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onPick(pos.coords.longitude, pos.coords.latitude, '내 위치');
      },
      () => {
        setBusy(false);
        setErr('위치 권한을 확인해 주세요.');
      },
    );
  };

  return (
    <div className="w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-2xl backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <MapPin className="h-4 w-4 text-blue-600" /> 내 건물 절감 테스트
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="주소 입력 또는 붙여넣기"
              className="w-full flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => setPostcodeOpen(true)}
              disabled={busy}
              className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              {busy ? '…' : '검색'}
            </button>
          </div>

          {err && <p className="mt-2 text-[11px] text-red-500">{err}</p>}

          {results.length > 0 && (
            <div className="mt-2 flex flex-col overflow-hidden rounded-lg border border-slate-200">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPick(r.lng, r.lat, r.label)}
                  className="border-b border-slate-100 px-3 py-2 text-left text-[12px] text-slate-700 transition-colors last:border-0 hover:bg-slate-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <LocateFixed className="h-4 w-4" /> 내 위치
            </button>
            <button
              type="button"
              onClick={onRecenter}
              disabled={!hasPlaced}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              <Crosshair className="h-4 w-4" /> 핀으로 이동
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">지도 클릭 = 건물 설치 · 주소 검색으로도 가능</p>
        </div>
      )}

      {postcodeOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            onClick={() => setPostcodeOpen(false)}
          >
            <div
              className="flex h-[520px] w-[440px] max-w-[92vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Search className="h-4 w-4 text-slate-500" /> 주소 검색
                </span>
                <button
                  type="button"
                  onClick={() => setPostcodeOpen(false)}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>
              <div ref={postcodeBoxRef} className="min-h-0 flex-1" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
