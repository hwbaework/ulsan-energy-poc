import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona, PERSONA_HOME } from '@/lib/persona';

/** 현재 로그인 역할의 홈 경로 — 루트(/)는 로그인 화면이므로 앱 내부 "홈" 링크는 이 값을 쓴다 */
export function getHomePath(): string {
  return PERSONA_HOME[getPersona(useAuthStore.getState().user)];
}
