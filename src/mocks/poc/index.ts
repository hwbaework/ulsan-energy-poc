/**
 * POC 목업 진입점 — 레지스트리를 re-export 하고 픽스처를 등록(사이드이펙트)한다.
 * client.ts 는 이 모듈만 import 하면 된다.
 */
export * from './registry';
import './fixtures';
import './tradingFixtures';
import './consultingFixtures';
import './edmFixtures';
import './dxFixtures'; // DX 스마트센서(예지보전 · 전기안전지수)
import './billingFixtures'; // 결제(토스페이먼츠 빌링) 서버 목업
