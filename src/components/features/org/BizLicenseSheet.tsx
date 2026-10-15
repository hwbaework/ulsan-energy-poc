'use client';

/**
 * 사업자등록증 보기 — 올린 파일이 있으면 그대로(이미지 · PDF), 없으면(데모) 기업 정보로 등록증 양식을 그린다.
 * 승인 관리의 가입 검토 · 기업 정보 변경 검토가 같이 쓴다
 */
export interface LicenseFields {
  businessNumber?: string;
  name?: string;
  representativeName?: string;
  address?: string;
  bizType?: string;
  bizCategory?: string;
  phone?: string;
}

export function BizLicenseSheet({ fileUrl, fileName, f }: { fileUrl?: string; fileName: string; f: LicenseFields }) {
  const isImage = fileUrl?.startsWith('data:image/');
  const isPdf = fileUrl?.startsWith('data:application/pdf');
  return (
    <div className="h-[460px] overflow-auto rounded-lg bg-white ring-1 ring-white/10">
      {isImage ? (
        <img src={fileUrl} alt={fileName} className="w-full" />
      ) : isPdf ? (
        <iframe src={fileUrl} title={fileName} className="h-full w-full" />
      ) : (
        <div className="mx-auto max-w-md space-y-4 px-8 py-10 text-slate-900">
          <p className="text-center text-xl font-bold tracking-[0.3em]">사업자등록증</p>
          <p className="text-center text-sm text-slate-600">(법인사업자)</p>
          <dl className="space-y-2 text-sm">
            {(
              [
                ['등록번호', f.businessNumber || '-'],
                ['법인명(단체명)', f.name || '-'],
                ['대표자', f.representativeName || '-'],
                ['사업장 소재지', f.address || '-'],
                ['사업의 종류', `업태 ${f.bizType || '-'} · 종목 ${f.bizCategory || '-'}`],
                ['연락처', f.phone || '-'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-200 pb-1.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="pt-6 text-center text-sm text-slate-600">울산세무서장</p>
        </div>
      )}
    </div>
  );
}
