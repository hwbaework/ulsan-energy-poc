/**
 * POC 목업 진입점 — 레지스트리를 re-export 하고 픽스처를 등록(사이드이펙트)한다.
 * client.ts 는 이 모듈만 import 하면 된다.
 */
export * from './registry';
import './fixtures';
