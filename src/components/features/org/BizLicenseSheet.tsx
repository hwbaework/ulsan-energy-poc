'use client';

import { fitPdf } from '@/lib/utils/fitPdf';

/**
 * 사업자등록증 보기 — 가입 · 변경 때 올린 파일(PDF 또는 사진)을 그대로 띄운다.
 * 데모 데이터처럼 파일이 없으면 국세청 샘플 이미지(public/samples)를 대신 보여 준다.
 * 승인 관리의 기업 검토 · 기업 정보 변경 창이 같이 쓴다
 */
export const DEMO_LICENSE_URL = '/samples/biz-license-sample.webp';

/** 감싸는 칸은 relative + 최소 높이 — 옆 칸 높이만큼 늘어난다(LicenseBox) */
export function BizLicenseSheet({ fileUrl, fileName }: { fileUrl?: string; fileName: string }) {
  const src = fileUrl || DEMO_LICENSE_URL;
  const isPdf = src.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(src);
  return (
    // 옆 칸(신청 내용) 높이만큼 늘어나고, 등록증은 잘리지 않게 통째로 맞춘다
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-white/10">
      {isPdf ? (
        <iframe src={fitPdf(src)} title={fileName} className="h-full w-full" />
      ) : (
        <img src={src} alt={fileName} className="h-full w-full object-contain" />
      )}
    </div>
  );
}

/** 등록증 칸 — 옆(신청 내용) 높이만큼 늘어나는 상자 */
export function LicenseBox({ fileUrl, fileName }: { fileUrl?: string; fileName: string }) {
  return (
    <div className="relative min-h-[520px]">
      <BizLicenseSheet fileUrl={fileUrl} fileName={fileName} />
    </div>
  );
}
