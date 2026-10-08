// 온실가스 인벤토리 — 메뉴 6개(배출시설 정보 · 배출원 등록 · 배출계수 관리 · 배출량 산정 · 명세서 · 보고서)가 각자 화면.
// 태양광 감축량만 다뤄 단계 순서가 없으므로 MRV 10단계 진행 막대는 두지 않는다(2026-10-08).
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
