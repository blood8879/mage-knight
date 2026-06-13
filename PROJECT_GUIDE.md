# Mage Knight Digital Board Game — 프로젝트 가이드

> **최종 수정**: 2026-02-21

---

## 1. 프로젝트 개요

Mage Knight 보드게임을 **솔로 플레이** 가능한 디지털 웹/모바일 앱으로 구현하는 프로젝트입니다.

| 항목 | 내용 |
|------|------|
| **게임 모드** | 솔로 모드 전용 (더미 플레이어와 2인 플레이 구조) |
| **시나리오** | First Reconnaissance (첫 번째 정찰) |
| **영웅** | Arythea 고정 |
| **플랫폼** | 웹 (PWA) + Android WebView (Capacitor) |
| **네트워크** | 오프라인 전용 (백엔드 없음) |
| **다국어** | 영어 / 한국어 / 스페인어 |
| **수익화** | 광고 기반 (AdSense + AdMob) |
| **패키지명** | `com.mageknightgame.app` |

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| **프레임워크** | React + TypeScript | React 19, TS ~5.9 |
| **빌드** | Vite | 7.x |
| **상태 관리** | Zustand | 5.x |
| **스타일링** | Tailwind CSS + Headless UI | Tailwind 4.x |
| **애니메이션** | Framer Motion | 12.x |
| **다국어** | react-i18next + i18next | 15.x / 25.x |
| **로컬 저장** | Dexie.js (IndexedDB) | 4.x |
| **라우팅** | react-router-dom | 7.x |
| **모바일 래퍼** | Capacitor (Ionic) | 8.x |
| **테스트** | Vitest + React Testing Library + Playwright | Vitest 4.x |
| **린트** | ESLint + Prettier | ESLint 9.x |

---

## 3. 사전 요구사항

### 필수

| 도구 | 최소 버전 | 확인 명령 |
|------|----------|----------|
| **Node.js** | 18+ (22 LTS 권장) | `node -v` |
| **npm** | 9+ | `npm -v` |

### Android 빌드 시 추가 필요

| 도구 | 설명 |
|------|------|
| **Java JDK** | 17+ |
| **Android Studio** | SDK 35 (compileSdk), minSdk 23 |
| **Android SDK** | Build-Tools, Platform-Tools |
| **Gradle** | Android Studio에 포함 |

---

## 4. 프로젝트 구조

```
mage-knight/
├── app/                          # 메인 애플리케이션 (Vite + React)
│   ├── src/
│   │   ├── main.tsx              # 앱 진입점
│   │   ├── App.tsx               # 화면 라우팅 (Zustand 기반)
│   │   ├── index.css             # Tailwind 임포트 + 글로벌 스타일
│   │   ├── engine/               # 게임 로직 (순수 TypeScript)
│   │   │   ├── types.ts          # 모든 게임 타입 정의
│   │   │   ├── GameState.ts      # 마스터 게임 상태 + 상수
│   │   │   ├── TurnManager.ts    # 턴/라운드/페이즈 관리
│   │   │   ├── CombatResolver.ts # 4단계 전투 해결
│   │   │   ├── ManaPool.ts       # 마나 다이스 & 크리스탈
│   │   │   ├── DeckManager.ts    # 덱/핸드/디스카드 관리
│   │   │   ├── MapGenerator.ts   # 헥스 맵 생성 & 타일 배치
│   │   │   ├── MovementResolver.ts # 이동 비용 & 경로
│   │   │   ├── UnitManager.ts    # 유닛 모집/명령/해산
│   │   │   ├── LevelUpManager.ts # Fame 트랙 & 레벨업
│   │   │   ├── DummyPlayer.ts    # 더미 플레이어 AI
│   │   │   ├── ScenarioSetup.ts  # 시나리오 초기 설정
│   │   │   ├── ScoringCalculator.ts # 점수 계산
│   │   │   └── ReputationManager.ts # 명성 트랙
│   │   ├── store/                # Zustand 상태 관리
│   │   │   ├── gameStore.ts      # 게임 상태 (라운드, 페이즈, 스탯)
│   │   │   ├── uiStore.ts        # UI 상태 (현재 화면, 모달)
│   │   │   └── settingsStore.ts  # 설정 (언어, 사운드, 테마)
│   │   ├── components/           # React UI 컴포넌트
│   │   │   ├── layout/           # GameBoard, TopBar, BottomPanel
│   │   │   ├── map/              # HexMap (Canvas), MapControls
│   │   │   ├── cards/            # CardHand, CardDetail, CardOffer 등
│   │   │   ├── combat/           # CombatView, EnemyCard, DamageAssign
│   │   │   ├── tracks/           # FameTrack, ReputationTrack, ManaPool, UnitSlots
│   │   │   ├── common/           # Button, Modal, Tooltip, Transitions 등
│   │   │   └── ads/              # AdBanner, AdInterstitial, AdRewarded
│   │   ├── screens/              # 페이지 단위 화면
│   │   │   ├── MainMenu.tsx
│   │   │   ├── GameScreen.tsx
│   │   │   ├── ScoreScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── hooks/                # 커스텀 훅
│   │   │   ├── useGameEngine.ts  # 엔진 초기화 & 상태 동기화
│   │   │   ├── useCardPlay.ts    # 카드 플레이 로직
│   │   │   ├── useCombat.ts      # 전투 UI 로직
│   │   │   ├── useMovement.ts    # 이동 로직
│   │   │   ├── useDragDrop.ts    # 드래그 앤 드롭
│   │   │   ├── useSaveLoad.ts    # 세이브/로드
│   │   │   ├── useUndo.ts        # 되돌리기
│   │   │   ├── useTheme.ts       # 다크/라이트 모드
│   │   │   └── useAudio.ts       # 오디오
│   │   ├── services/             # 외부 서비스
│   │   │   ├── adService.ts      # 광고 관리
│   │   │   ├── saveService.ts    # IndexedDB 세이브/로드
│   │   │   └── audioService.ts   # 효과음/배경음
│   │   ├── data/
│   │   │   └── loader.ts         # JSON 데이터 로더
│   │   ├── i18n/
│   │   │   └── config.ts         # react-i18next 설정
│   │   └── utils/
│   │       ├── hexMath.ts        # 헥스 좌표 계산
│   │       └── random.ts         # 시드 기반 랜덤
│   ├── android/                  # Capacitor Android 프로젝트
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── capacitor.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   └── eslint.config.js
├── docs/                         # 게임 룰 & 데이터
│   ├── RULES_STRUCTURED.md       # 구조화된 전체 게임 규칙
│   ├── EXECUTION_PLAN.md         # 구현 단계별 실행 계획
│   └── data/                     # 게임 카드/유닛 JSON 데이터
│       ├── basic_actions.json
│       ├── advanced_actions.json
│       ├── spells.json
│       ├── artifacts.json
│       ├── units_regular.json
│       └── units_elite.json
├── locales/                      # 다국어 번역 파일
│   ├── en/                       # 영어
│   │   ├── ui.json               # UI 텍스트
│   │   └── cards/                # 카드 번역
│   ├── ko/                       # 한국어
│   └── es/                       # 스페인어
├── store-listing/
│   └── play-store.md             # Google Play 스토어 등록 정보
├── arythea_hero.json             # Arythea 히어로 데이터
├── first_reconnaissance_scenario.json  # 시나리오 데이터
├── map_tiles.json                # 맵 타일 데이터
├── site_locations.json           # 장소 상호작용 데이터
├── tactic_cards.json             # 택틱 카드 데이터
└── MK_rulebook_EN.pdf            # 원본 영문 룰북
```

---

## 5. 설치 및 실행

### 5.1 의존성 설치

```bash
cd app
npm install
```

### 5.2 개발 서버 실행 (웹)

```bash
cd app
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 5.3 프로덕션 빌드

```bash
cd app
npm run build
```

빌드 결과물: `app/dist/`

### 5.4 빌드 미리보기

```bash
cd app
npm run preview
```

### 5.5 Android 빌드

```bash
cd app

# 1. 웹 빌드
npm run build

# 2. Capacitor Android 프로젝트에 웹 에셋 복사
npx cap sync android

# 3. Android Studio에서 열기
npx cap open android

# 또는 CLI로 직접 빌드
cd android && ./gradlew assembleDebug
```

---

## 6. 테스트

### 6.1 단위 테스트

```bash
cd app
npm test              # 한 번 실행
npm run test:watch    # 감시 모드
npm run test:coverage # 커버리지 리포트
```

- 테스트 환경: `happy-dom`
- 설정 파일: `app/vitest.config.ts`
- 셋업 파일: `app/src/test-setup.ts` (jest-dom matchers 로드)
- 테스트 대상: `src/**/*.test.{ts,tsx}`, `tests/**/*.test.{ts,tsx}`

### 6.2 E2E 테스트

```bash
cd app
npm run test:e2e      # Playwright 실행
```

> Playwright 설치가 필요할 수 있음: `npx playwright install`

### 6.3 린트

```bash
cd app
npm run lint
```

---

## 7. 경로 별칭 (Path Aliases)

`vite.config.ts`와 `tsconfig.app.json` 모두에 설정됨:

| 별칭 | 실제 경로 | 용도 |
|------|----------|------|
| `@/*` | `app/src/*` | 소스 코드 |
| `@data/*` | `docs/data/*` | 게임 데이터 JSON |
| `@locales/*` | `locales/*` | 다국어 번역 파일 |

사용 예:
```typescript
import { useGameStore } from '@/store/gameStore'
import enUI from '@locales/en/ui.json'
import spells from '@data/spells.json'
```

---

## 8. 화면 네비게이션

react-router-dom 대신 **Zustand `uiStore`** 기반 화면 전환 사용:

```
main_menu → game → score
    ↓
  settings
```

- `MainMenu`: 새 게임 시작, 설정, 언어 선택
- `GameScreen`: 메인 게임 보드 (헥스맵 + 카드 핸드 + 트랙)
- `ScoreScreen`: 게임 종료 후 점수 표시
- `SettingsScreen`: 사운드, 테마, 언어 설정

GameScreen, ScoreScreen, SettingsScreen은 `lazy()` 로딩으로 코드 스플리팅됨.

---

## 9. 상태 관리 구조

### Zustand Stores

| Store | 파일 | 역할 |
|-------|------|------|
| `useGameStore` | `store/gameStore.ts` | 게임 상태 (라운드, 페이즈, 스탯, 전투, 로그) |
| `useUIStore` | `store/uiStore.ts` | UI 상태 (현재 화면, 모달, 선택) |
| `useSettingsStore` | `store/settingsStore.ts` | 설정 (언어, 사운드, 테마) |

### 게임 엔진 ↔ Store 동기화

`engine/` 디렉토리의 순수 TypeScript 로직이 `GameState` 객체를 생성/변경하고,
`gameStore.syncFromEngine(state)`를 호출하여 UI에 반영합니다.

```
engine (순수 로직) → GameState → gameStore.syncFromEngine() → React UI
```

---

## 10. 다국어 (i18n) 설정

### 구조

- 설정 파일: `app/src/i18n/config.ts`
- 번역 파일: `locales/{en,ko,es}/`
  - `ui.json`: UI 텍스트
  - `cards/`: 카드 이름/효과 번역

### 언어 저장

`localStorage`의 `mageknightLang` 키에 저장 (기본값: `en`)

### 지원 언어

| 코드 | 언어 |
|------|------|
| `en` | English |
| `ko` | 한국어 |
| `es` | Español |

### 사용 예

```tsx
const { t } = useTranslation('ui')
<h1>{t('app.title')}</h1>
```

---

## 11. 게임 엔진 아키텍처

게임 로직은 `app/src/engine/` 아래에 **UI와 독립적인 순수 TypeScript**로 구현됩니다.

### 핵심 모듈

| 모듈 | 역할 |
|------|------|
| `types.ts` | 모든 게임 엔터티 타입 정의 (마나, 카드, 유닛, 적, 맵, 전투 등) |
| `GameState.ts` | 마스터 상태 인터페이스 + 초기값 상수 (이동 비용, 명성 테이블, Fame 레벨) |
| `TurnManager.ts` | 턴/라운드 흐름, Day/Night 사이클, End of Round |
| `CombatResolver.ts` | 4단계 전투 (Ranged/Siege → Block → Damage → Attack) |
| `ManaPool.ts` | 마나 다이스 풀, 크리스탈, Source 관리 |
| `DeckManager.ts` | 덱 셔플, 드로우, 디스카드, Wound 카드 |
| `MapGenerator.ts` | 헥스 좌표계, 타일 배치, 맵 생성 |
| `MovementResolver.ts` | 지형별 이동 비용, Day/Night 비용 차이 |
| `UnitManager.ts` | 유닛 모집, 활성화, 해산, Wound |
| `DummyPlayer.ts` | 더미 플레이어 덱 소모 & 턴 로직 |
| `ScenarioSetup.ts` | First Reconnaissance 시나리오 초기화 |
| `ScoringCalculator.ts` | 최종 점수 계산 |

### 핵심 게임 상수

| 상수 | 값 |
|------|---|
| 라운드 수 | 6 (Day 3 + Night 3) |
| 시작 Hand Limit | 5 |
| 시작 Armor | 2 |
| 시작 Unit Limit | 1 |
| 크리스탈 최대 (색상당) | 3 |
| Fame 레벨업 임계값 | 0, 3, 8, 15, 24, 35, 48, 63, 80, 99 |

---

## 12. 빌드 최적화

`vite.config.ts`에서 수동 청크 분리 설정:

| 청크 | 포함 패키지 |
|------|-----------|
| `vendor-react` | react, react-dom |
| `vendor-framer` | framer-motion |
| `vendor-i18n` | i18next, react-i18next |
| `vendor-zustand` | zustand |

---

## 13. 데이터 저장

| 저장소 | 용도 | 라이브러리 |
|--------|------|-----------|
| **IndexedDB** | 게임 세이브/로드 | Dexie.js |
| **localStorage** | 언어 설정, 테마 등 경량 설정 | 네이티브 |
| **Static JSON** | 게임 카드/유닛/타일 데이터 | Vite import |

---

## 14. Android 설정

### Capacitor 설정 (`capacitor.config.ts`)

```typescript
{
  appId: 'com.mageknightgame.app',
  appName: 'Mage Knight',
  webDir: 'dist',
  server: { androidScheme: 'https' }
}
```

### Android SDK 버전 (`android/variables.gradle`)

| 항목 | 값 |
|------|---|
| minSdkVersion | 23 (Android 6.0) |
| compileSdkVersion | 35 |
| targetSdkVersion | 35 |

### 권한

- `INTERNET`: 광고 로딩 전용

---

## 15. 광고 전략

| 유형 | 시점 | 형식 |
|------|------|------|
| **배너** | 메인 메뉴, 설정 화면 하단 | 320x50 / 320x100 |
| **인터스티셜** | 라운드 전환 (5~6회/게임) | 전면 광고 |
| **보상형** | 게임 오버 후 재시도/힌트 | 30초 영상 (선택적) |

- 웹: Google AdSense
- Android: `@capacitor-community/admob`
- 오프라인 시 광고 graceful skip (게임플레이 영향 없음)

---

## 16. 주요 npm 스크립트 요약

모든 명령은 `app/` 디렉토리에서 실행합니다.

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (localhost:3000) |
| `npm run build` | TypeScript 컴파일 + Vite 프로덕션 빌드 |
| `npm run preview` | 빌드 결과물 프리뷰 서버 |
| `npm run lint` | ESLint 실행 |
| `npm test` | Vitest 단위 테스트 (1회 실행) |
| `npm run test:watch` | Vitest 감시 모드 |
| `npm run test:coverage` | 테스트 커버리지 리포트 |
| `npm run test:e2e` | Playwright E2E 테스트 |

---

## 17. 개발 시 주의사항

1. **작업 디렉토리**: 대부분의 명령은 `app/` 디렉토리에서 실행해야 함 (루트가 아님)
2. **TypeScript Strict**: `strict: true` + `noUnusedLocals` + `noUnusedParameters` 활성화
3. **게임 로직 분리**: `engine/` 코드는 React/DOM 의존성 없이 순수 TypeScript로 유지
4. **저작권**: 원본 카드 이미지 사용 불가 — 텍스트 + 아이콘 기반 UI
5. **데이터 경로**: 게임 데이터는 `docs/data/`에, 번역 파일은 `locales/`에 위치하며 별칭으로 접근
6. **화면 전환**: react-router-dom이 설치되어 있으나, 실제로는 `uiStore`의 `navigate()` 사용

---

## 18. 참고 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 게임 규칙 | `docs/RULES_STRUCTURED.md` | 솔로 플레이 기준 전체 규칙 (전투, 이동, 마나 등) |
| 실행 계획 | `docs/EXECUTION_PLAN.md` | 7단계 구현 로드맵 (약 3~5주) |
| Play Store | `store-listing/play-store.md` | 앱 등록 정보 (설명, 스크린샷 요구사항) |
| 원본 룰북 | `MK_rulebook_EN.pdf` | Mage Knight 영문 룰북 PDF |

---

## 19. 현재 구현 상태

### 완료된 것

- [x] 프로젝트 초기화 (Vite + React + TypeScript + Tailwind)
- [x] 디렉토리 구조 생성 (engine, components, screens, hooks, services 등)
- [x] 모든 게임 타입 정의 (`engine/types.ts` — 527라인)
- [x] 게임 상태 인터페이스 + 초기값 상수 (`engine/GameState.ts`)
- [x] Zustand stores (gameStore, uiStore, settingsStore)
- [x] i18n 설정 (EN/KO/ES 3개 언어)
- [x] 화면 라우팅 (MainMenu, GameScreen, ScoreScreen, Settings)
- [x] UI 컴포넌트 스캐폴딩 (맵, 카드, 전투, 트랙, 광고 등)
- [x] 커스텀 훅 스캐폴딩 (useGameEngine, useCardPlay, useCombat 등)
- [x] Capacitor Android 프로젝트 설정
- [x] 게임 데이터 JSON 준비 (카드, 유닛, 타일, 히어로, 시나리오, 장소)
- [x] Vitest + Playwright 테스트 설정
- [x] 접근성 기본 대응 (skip link, aria 속성)
- [x] 코드 스플리팅 (lazy loading)
- [x] 빌드 최적화 (수동 청크 분리)

### 다음 단계

- [ ] 게임 엔진 코어 로직 구현 (덱, 마나, 맵, 전투, 턴)
- [ ] Canvas 기반 헥스맵 렌더링
- [ ] 카드/전투 UI 구현
- [ ] 게임 세이브/로드 기능
- [ ] 광고 SDK 연동
- [ ] Android 빌드 & 테스트

---

*자세한 구현 단계는 `docs/EXECUTION_PLAN.md`를 참조하세요.*
