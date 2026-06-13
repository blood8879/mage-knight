# Mage Knight 디지털 보드게임 — 실행 계획서

> **버전**: 1.0
> **최종 수정**: 2026-02-19
> **목표**: Mage Knight 보드게임을 솔로 플레이 가능한 웹/앱으로 구현

---

## 0. 프로젝트 요약

| 항목 | 결정 |
|------|------|
| **플랫폼** | 웹 (PWA) + Android WebView 래핑 |
| **게임 모드** | 솔로 모드 전용 |
| **시나리오** | First Reconnaissance (첫 번째 정찰) |
| **영웅** | Arythea 고정 |
| **게임 로직** | 완전 자동화 (모든 규칙 앱이 처리) |
| **네트워크** | 오프라인 전용 (백엔드 없음) |
| **다국어** | 영어/한국어/스페인어 (데이터 준비 완료) |
| **UI** | 깔끔한 디지털 UI |
| **수익화** | 광고 기반 (아래 상세) |

---

## 1. 광고 수익화 전략

### 1.1 보드게임 앱 광고의 핵심 원칙

보드게임은 **깊은 몰입과 긴 세션** (30분~2시간)이 특징입니다. 게임플레이 도중 광고가 끼어들면 사용자 이탈률이 급격히 올라갑니다. 따라서:

> **원칙**: 게임 플레이 도중에는 절대 광고를 삽입하지 않는다.

### 1.2 추천 광고 전략: 3단계 하이브리드

#### ① 라운드 전환 인터스티셜 (핵심 수익원)

| 항목 | 내용 |
|------|------|
| **형식** | Interstitial (전면 광고) |
| **시점** | 라운드 종료 → 다음 라운드 시작 사이 |
| **빈도** | 매 라운드 전환 (총 5~6회/게임) |
| **왜 여기?** | 라운드 전환은 자연스러운 "쉬는 시간". 카드 정리, 새 오퍼 세팅 등의 로딩과 겹침 |
| **UX 처리** | "다음 라운드 준비 중..." 로딩 화면 → 광고 → 새 라운드 시작 |
| **예상 CPM** | $3~8 (지역별 상이) |

#### ② 메인 메뉴/로비 배너 (상시 노출)

| 항목 | 내용 |
|------|------|
| **형식** | Banner (320x50 또는 320x100) |
| **위치** | 메인 메뉴, 설정, 스코어보드 등 비게임 화면 하단 |
| **왜 여기?** | 게임 밖 화면은 몰입이 필요 없으므로 배너가 자연스러움 |
| **주의** | 게임플레이 화면에는 배너 절대 배치 안 함 (보드게임은 화면 공간이 중요) |
| **예상 CPM** | $0.5~2 |

#### ③ 보상형 광고 (선택적)

| 항목 | 내용 |
|------|------|
| **형식** | Rewarded Video (30초 영상) |
| **시점** | 게임 오버 후 "한 번 더 도전" 또는 "힌트 보기" |
| **제공 보상** | ① 패배 시 마지막 라운드 재시도 ② 전투 중 최적 카드 조합 힌트 |
| **왜 여기?** | 유저가 자발적으로 선택. 강제성 없으므로 UX 손상 없음 |
| **주의** | 게임 밸런스를 깨지 않는 수준의 힌트만 제공 |
| **예상 CPM** | $10~30 (가장 높은 단가) |

### 1.3 광고 SDK 선택

| SDK | 장점 | 단점 |
|-----|------|------|
| **Google AdMob** ✅ 추천 | Android 네이티브 지원, 높은 fill rate, Capacitor 플러그인 존재 | 웹에서는 AdSense 별도 |
| **AdSense (웹용)** ✅ 추천 | PWA/웹 직접 지원 | 모바일 WebView에서는 AdMob이 나음 |

**결론**: 
- **웹 버전**: Google AdSense
- **Android 앱**: Capacitor + AdMob 플러그인 (`@capacitor-community/admob`)

### 1.4 오프라인 호환성

광고는 네트워크가 필요합니다. 오프라인 전용 앱에서의 처리:

1. **네트워크 감지**: 앱 시작 시 + 라운드 전환 시 네트워크 상태 확인
2. **온라인**: 광고 정상 표시
3. **오프라인**: 광고 영역 숨김, 자연스럽게 스킵. 게임플레이에 영향 없음
4. **광고 프리로드**: 가능한 시점에 다음 광고를 미리 캐싱

### 1.5 예상 수익 시뮬레이션

| 지표 | 보수적 추정 |
|------|-----------|
| DAU (일일 활성 사용자) | 1,000명 |
| 게임 당 인터스티셜 노출 | 5회 |
| 인터스티셜 CPM | $4 |
| 배너 노출 | 3회/세션 |
| 배너 CPM | $1 |
| 보상형 시청률 | 20% |
| 보상형 CPM | $15 |
| **일일 예상 수익** | **~$25** |
| **월 예상 수익** | **~$750** |

> ※ DAU 10,000명 기준으로는 월 ~$7,500 예상

---

## 2. 기술 스택

### 2.1 프론트엔드

| 기술 | 선택 | 이유 |
|------|------|------|
| **프레임워크** | React 18 + TypeScript | 상태 관리 생태계 최강, 보드게임 복잡한 상태 처리에 적합 |
| **빌드** | Vite | 빠른 HMR, 최적 번들링 |
| **상태 관리** | Zustand | Redux 대비 간결, 보드게임 상태 슬라이스 분리에 최적 |
| **UI 라이브러리** | Tailwind CSS + Headless UI | 깔끔한 디지털 UI, 반응형 쉽게 구현 |
| **애니메이션** | Framer Motion | 카드 이동, 전투 연출, 주사위 굴림 등 |
| **렌더링** | HTML Canvas (맵) + React DOM (UI) | 헥스 맵 렌더링은 Canvas, 나머지 UI는 DOM |
| **i18n** | react-i18next | 이미 준비된 locale JSON과 직접 호환 |

### 2.2 데이터 & 저장

| 기술 | 선택 | 이유 |
|------|------|------|
| **게임 데이터** | Static JSON import | 이미 docs/data/에 완비 |
| **세이브** | IndexedDB (via Dexie.js) | 오프라인 저장, 대용량 게임 상태 지원 |
| **세팅** | localStorage | 언어 설정, 볼륨 등 |

### 2.3 크로스 플랫폼

| 기술 | 선택 | 이유 |
|------|------|------|
| **모바일 래퍼** | Capacitor (Ionic) | 웹앱을 네이티브 래핑. WebView 기반이지만 네이티브 플러그인 접근 가능 |
| **광고** | @capacitor-community/admob | Capacitor용 AdMob 플러그인 |
| **PWA** | Workbox (Service Worker) | 오프라인 캐싱, 설치 가능한 웹앱 |

### 2.4 테스트

| 기술 | 용도 |
|------|------|
| **Vitest** | 게임 로직 단위 테스트 |
| **React Testing Library** | UI 컴포넌트 테스트 |
| **Playwright** | E2E 시나리오 테스트 |

---

## 3. 프로젝트 구조

```
mage-knight/
├── docs/                          # 기존 데이터 & 문서 (유지)
│   ├── data/                      # 카드 JSON 데이터
│   ├── DATA_SCHEMA.md
│   └── RULES_STRUCTURED.md
├── locales/                       # 기존 i18n 데이터 (유지)
│   ├── en/
│   ├── ko/
│   └── es/
├── src/
│   ├── main.tsx                   # 앱 진입점
│   ├── App.tsx                    # 라우팅 & 레이아웃
│   ├── engine/                    # 게임 로직 (순수 TypeScript, UI 무관)
│   │   ├── types.ts               # 모든 게임 타입 정의
│   │   ├── GameState.ts           # 마스터 게임 상태 인터페이스
│   │   ├── TurnManager.ts         # 턴/라운드/페이즈 관리
│   │   ├── CombatResolver.ts      # 4단계 전투 해결
│   │   ├── ManaPool.ts            # 마나 다이스 풀 & 크리스탈
│   │   ├── DeckManager.ts         # 덱/핸드/디스카드 관리
│   │   ├── MapGenerator.ts        # 헥스 맵 생성 & 타일 배치
│   │   ├── MovementResolver.ts    # 이동 비용 계산 & 경로
│   │   ├── UnitManager.ts         # 유닛 모집/명령/해산
│   │   ├── LevelUpManager.ts      # Fame 트랙 & 레벨업 처리
│   │   ├── EnemyManager.ts        # 적 토큰 풀 & 배치
│   │   ├── ReputationManager.ts   # 명성 트랙 & 상호작용 비용
│   │   ├── DummyPlayer.ts         # 더미 플레이어 AI
│   │   ├── ScenarioSetup.ts       # First Reconnaissance 시나리오 세팅
│   │   └── ScoringCalculator.ts   # 최종 점수 계산
│   ├── data/                      # 데이터 로더 & 타입
│   │   ├── loader.ts              # JSON 데이터 로드
│   │   ├── cards.ts               # 카드 데이터 타입 & 접근
│   │   ├── enemies.ts             # 적 토큰 데이터
│   │   ├── tiles.ts               # 맵 타일 데이터
│   │   └── hero.ts                # Arythea 히어로 데이터
│   ├── store/                     # Zustand 상태 관리
│   │   ├── gameStore.ts           # 메인 게임 상태
│   │   ├── uiStore.ts             # UI 상태 (모달, 선택 등)
│   │   └── settingsStore.ts       # 설정 (언어, 볼륨 등)
│   ├── components/                # React UI 컴포넌트
│   │   ├── layout/
│   │   │   ├── GameBoard.tsx       # 전체 게임 보드 레이아웃
│   │   │   ├── TopBar.tsx          # 라운드/페이즈 정보
│   │   │   └── BottomPanel.tsx     # 핸드 카드 영역
│   │   ├── map/
│   │   │   ├── HexMap.tsx          # Canvas 기반 헥스맵
│   │   │   ├── HexTile.tsx         # 개별 헥스 타일
│   │   │   └── MapControls.tsx     # 줌/팬 컨트롤
│   │   ├── cards/
│   │   │   ├── CardHand.tsx        # 핸드 카드 표시
│   │   │   ├── CardDetail.tsx      # 카드 상세 팝업
│   │   │   ├── CardOffer.tsx       # AA/Spell/Unit 오퍼
│   │   │   └── CardSlot.tsx        # 카드 플레이 슬롯
│   │   ├── combat/
│   │   │   ├── CombatView.tsx      # 전투 화면
│   │   │   ├── EnemyCard.tsx       # 적 토큰 표시
│   │   │   └── DamageAssign.tsx    # 데미지 할당 UI
│   │   ├── tracks/
│   │   │   ├── FameTrack.tsx       # Fame 트랙
│   │   │   ├── ReputationTrack.tsx # 명성 트랙
│   │   │   └── ManaPool.tsx        # 마나 풀 & 크리스탈
│   │   ├── common/
│   │   │   ├── Modal.tsx
│   │   │   ├── Button.tsx
│   │   │   └── Tooltip.tsx
│   │   └── ads/
│   │       ├── AdBanner.tsx        # 메뉴 배너 광고
│   │       ├── AdInterstitial.tsx  # 라운드 전환 전면 광고
│   │       └── AdRewarded.tsx      # 보상형 광고
│   ├── screens/                   # 페이지/화면
│   │   ├── MainMenu.tsx
│   │   ├── GameScreen.tsx
│   │   ├── ScoreScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/                  # 외부 서비스
│   │   ├── adService.ts           # 광고 로드/표시 관리
│   │   ├── saveService.ts         # IndexedDB 세이브/로드
│   │   └── audioService.ts        # 효과음/배경음
│   ├── hooks/                     # 커스텀 훅
│   │   ├── useGameEngine.ts
│   │   ├── useCardPlay.ts
│   │   └── useCombat.ts
│   ├── i18n/                      # i18n 설정
│   │   └── config.ts              # react-i18next 설정 (locales/ 연결)
│   └── utils/
│       ├── hexMath.ts             # 헥스 좌표 계산
│       ├── random.ts              # 시드 기반 랜덤
│       └── constants.ts           # 게임 상수
├── public/
│   ├── assets/                    # 이미지, 아이콘, 사운드
│   └── manifest.json              # PWA 매니페스트
├── android/                       # Capacitor Android 프로젝트
├── tests/
│   ├── engine/                    # 게임 로직 테스트
│   ├── components/                # UI 테스트
│   └── e2e/                       # E2E 테스트
├── package.json
├── vite.config.ts
├── capacitor.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 4. 수집해야 할 추가 데이터

현재 카드 데이터(AA, Spells, Artifacts, Units)는 완료. 아래 데이터가 추가로 필요합니다:

### 4.1 적 토큰 (`docs/data/enemies.json`)

위키 소스: `https://unofficialmageknighttheboardgame.fandom.com/wiki/`

| 색상 | 유형 | 예상 수량 |
|------|------|----------|
| 🟢 Green | Marauding (오크 등) | ~4종 |
| ⚪ Gray | Citizen (가디언, 골렘) | ~4종 |
| 🟣 Violet | Magical (Mage, Drakken) | ~4종 |
| 🟤 Brown | Dungeon (Spider, Swordsman) | ~4종 |
| 🔴 Red | Draconum | ~3종 |
| 🔵 Blue | City (City Guards 등) | ~3종 |
| ⚫ White | Ruins (Ruins Guardian 등) | ~3종 |

**필요 필드**: name, color, armor, attack, attackType, abilities[], fameReward

### 4.2 맵 타일 (`docs/data/tiles.json`)

| 타일 유형 | 수량 | 데이터 |
|---------|------|--------|
| Starting Tile (A/B) | 2 | 7 hexes each, terrain + sites |
| Countryside (초록) | 11 | 7 hexes, terrain + sites + enemies |
| Core (갈색) | 5+ | 7 hexes, terrain + city + sites |

**필요 필드**: tileId, side (A/B), hexes[7] = { position, terrain, site?, enemyColor? }

### 4.3 택틱 카드 (`docs/data/tactics.json`)

| 유형 | 수량 |
|------|------|
| Day Tactics | 6장 |
| Night Tactics | 6장 |

**필요 필드**: id, name, type (day/night), number, effect

### 4.4 Arythea 히어로 데이터 (`docs/data/heroes/arythea.json`)

| 항목 | 내용 |
|------|------|
| 시작 덱 | 16장 (공통 12 + 고유 4) |
| 스킬 토큰 | 10개 (이름, 유형, 효과) |
| 시작 스탯 | Armor 2, Hand Limit 5, Unit Limit 1 |
| 레벨업 보상 | 레벨별 핸드/유닛/아머 증가 + AA or Spell 선택 |

### 4.5 First Reconnaissance 시나리오 (`docs/data/scenarios/first_recon.json`)

| 항목 | 내용 |
|------|------|
| 라운드 수 | 6 (Day3 + Night3) |
| 타일 구성 | Countryside 타일 수, Core 타일 수 |
| 승리 조건 | 가능한 많은 도시 정복 + 최고 점수 |
| 특수 규칙 | 제한 사항 등 |

### 4.6 장소 상호작용 (`docs/data/sites.json`)

| 장소 | 상호작용 |
|------|---------|
| Village | Heal, Recruit, Buy |
| Monastery | Heal + Spell burn |
| Keep | Unit 모집 (할인) |
| Mage Tower | Spell 습득 |
| Dungeon / Tomb | 전투 → Artifact 보상 |
| Monster Den | 전투 → Random 보상 |
| Spawning Grounds | 전투 → Crystal 보상 |
| Mine | Crystal 생산 |
| Magical Glade | 마나 생산 |
| City | 도시 공격 |
| Ancient Ruins | 전투 → 보상 |

---

## 5. 구현 단계

### Phase 0: 프로젝트 초기화 (1일)

**산출물**: 빌드 가능한 빈 프로젝트

- [ ] Vite + React + TypeScript 프로젝트 생성
- [ ] Tailwind CSS, Zustand, Framer Motion, react-i18next 설치
- [ ] 디렉터리 구조 생성
- [ ] 기존 `docs/data/` JSON → `src/data/` 로더 연결
- [ ] 기존 `locales/` → i18n 설정 연결
- [ ] Capacitor 초기화
- [ ] ESLint + Prettier 설정
- [ ] Vitest 설정
- [ ] 기본 라우팅 (메인메뉴 → 게임 → 결과)

**검증**: `npm run dev`로 빈 페이지 표시, `npm test` 통과

---

### Phase 1: 추가 데이터 수집 (2~3일)

**산출물**: 모든 게임 데이터 JSON 완비

- [ ] 적 토큰 데이터 크롤링 → `enemies.json`
- [ ] 맵 타일 데이터 정리 → `tiles.json`
- [ ] 택틱 카드 데이터 → `tactics.json`
- [ ] Arythea 히어로 데이터 → `heroes/arythea.json`
- [ ] First Reconnaissance 시나리오 → `scenarios/first_recon.json`
- [ ] 장소 상호작용 데이터 → `sites.json`
- [ ] 새 데이터 i18n 추가 (EN/KO/ES)
- [ ] DATA_SCHEMA.md 업데이트

**검증**: 모든 JSON 유효성 검증 스크립트 통과

---

### Phase 2: 게임 엔진 코어 (5~7일)

**산출물**: UI 없이 동작하는 게임 로직

#### 2A: 타입 & 상태 정의

- [ ] `engine/types.ts` — 모든 게임 엔터티 타입
- [ ] `engine/GameState.ts` — 전체 게임 상태 인터페이스
- [ ] Zustand store 기본 구조

#### 2B: 덱 & 카드 시스템

- [ ] `DeckManager.ts` — 셔플, 드로우, 디스카드, Wound 추가
- [ ] 카드 플레이 로직 (basic/strong effect 판정)
- [ ] ✅ 단위 테스트

#### 2C: 마나 시스템

- [ ] `ManaPool.ts` — 다이스 풀 굴림, Source 관리
- [ ] 크리스탈 관리 (획득/소비)
- [ ] Day/Night 마나 규칙 차이
- [ ] ✅ 단위 테스트

#### 2D: 맵 & 이동

- [ ] `MapGenerator.ts` — 헥스 좌표계, 타일 배치
- [ ] `MovementResolver.ts` — 지형별 이동 비용, Day/Night 차이
- [ ] 타일 탐색 (뒤집기) 로직
- [ ] ✅ 단위 테스트

#### 2E: 전투 시스템

- [ ] `CombatResolver.ts` — 4단계 전투
  - Ranged/Siege Attack → Block → Assign Damage → Attack
- [ ] 적 특수능력 처리 (Fortified, Swift, Brutal, Poison, Paralyze 등)
- [ ] 저항 계산 (Physical, Fire, Ice, ColdFire)
- [ ] Fame 보상 처리
- [ ] ✅ 단위 테스트 (각 전투 단계별)

#### 2F: 턴/라운드 관리

- [ ] `TurnManager.ts` — 턴 구조, 라운드 전환, Day/Night 사이클
- [ ] 택틱 카드 선택 로직
- [ ] End of Round 처리 (핸드 리필, 오퍼 갱신, Source 리롤)
- [ ] ✅ 단위 테스트

#### 2G: 유닛 & 상호작용

- [ ] `UnitManager.ts` — 모집, 명령, 해산, Wound
- [ ] `ReputationManager.ts` — 명성에 따른 상호작용 비용
- [ ] 마을/수도원/탑 등 장소 상호작용
- [ ] ✅ 단위 테스트

#### 2H: 레벨업 & 더미 플레이어

- [ ] `LevelUpManager.ts` — Fame 트랙, 레벨업 보상 선택
- [ ] `DummyPlayer.ts` — 더미 플레이어 덱 소모 로직
- [ ] ✅ 단위 테스트

#### 2I: 시나리오 & 스코어링

- [ ] `ScenarioSetup.ts` — First Reconnaissance 초기 설정
- [ ] `ScoringCalculator.ts` — 최종 점수 계산
- [ ] ✅ 단위 테스트

**검증**: 모든 엔진 테스트 통과. 콘솔에서 전체 게임 시뮬레이션 가능.

---

### Phase 3: UI 쉘 & 핵심 화면 (5~7일)

**산출물**: 플레이 가능한 기본 UI

#### 3A: 레이아웃 & 네비게이션

- [ ] 메인 메뉴 (새 게임, 이어하기, 설정)
- [ ] 게임 보드 레이아웃 (맵 영역, 핸드 영역, 정보 바)
- [ ] 결과 화면 (스코어보드)
- [ ] 반응형 (데스크톱 + 모바일)

#### 3B: 헥스 맵 렌더링

- [ ] Canvas 기반 헥스맵 렌더링
- [ ] 타일 그래픽 (지형 색상 + 아이콘)
- [ ] 영웅 토큰 표시 & 이동 애니메이션
- [ ] 줌/팬 (터치 지원)
- [ ] 적/장소 아이콘 표시

#### 3C: 카드 UI

- [ ] 카드 핸드 (하단 패널, 좌우 스크롤)
- [ ] 카드 상세 팝업 (탭/클릭 시)
- [ ] 카드 플레이 영역 (드래그 또는 탭)
- [ ] 오퍼 표시 (AA, Spell, Unit)
- [ ] Wound 카드 시각적 구분

#### 3D: 전투 UI

- [ ] 전투 화면 (적 표시, 4단계 진행)
- [ ] 카드/유닛 선택 → 공격/방어 할당
- [ ] 데미지 할당 UI (적 → 유닛/히어로)
- [ ] 전투 결과 애니메이션

#### 3E: 트랙 & 풀

- [ ] Fame 트랙 (진행 바)
- [ ] Reputation 트랙
- [ ] 마나 풀 표시 (다이스 + 크리스탈)
- [ ] 유닛 슬롯

**검증**: 전체 게임 1회 플레이스루 가능

---

### Phase 4: 게임 UX 폴리시 (3~4일)

**산출물**: 매끄러운 플레이 경험

- [ ] 카드 드래그 & 드롭 (터치 포함)
- [ ] 애니메이션 연출 (카드 드로우, 전투, 레벨업)
- [ ] 턴/라운드 전환 연출
- [ ] 효과음 & 배경음 (무료 에셋)
- [ ] 튜토리얼 / 도움말 오버레이
- [ ] Undo 기능 (턴 내 액션 취소)
- [ ] 게임 세이브/로드 (IndexedDB)
- [ ] 다국어 전환 UI (설정에서 EN/KO/ES 선택)
- [ ] 다크 모드

**검증**: 3회 이상 완전 플레이스루, UX 이슈 없음

---

### Phase 5: 광고 통합 (2~3일)

**산출물**: 광고가 동작하는 웹앱

- [ ] `adService.ts` — 광고 로드/표시/네트워크 감지 통합 서비스
- [ ] 웹: Google AdSense 배너 + 인터스티셜 연동
- [ ] 라운드 전환 시 인터스티셜 트리거
- [ ] 메인 메뉴/설정 배너 배치
- [ ] 보상형 광고 (게임 오버 시 재시도/힌트)
- [ ] 오프라인 시 광고 graceful skip
- [ ] 광고 로드 실패 핸들링

**검증**: 온라인 시 광고 정상 표시, 오프라인 시 게임플레이 영향 없음

---

### Phase 6: Android 앱 패키징 (2~3일)

**산출물**: Google Play 제출 가능한 APK/AAB

- [ ] Capacitor Android 프로젝트 설정
- [ ] `@capacitor-community/admob` 설치 & 설정
- [ ] AdMob 광고 유닛 ID 연동
- [ ] 앱 아이콘, 스플래시 스크린
- [ ] PWA manifest 최적화
- [ ] Service Worker 오프라인 캐싱
- [ ] Android 빌드 & 테스트
- [ ] 성능 최적화 (WebView 렌더링)

**검증**: Android 실기기에서 전체 플레이스루 + 광고 동작 확인

---

### Phase 7: QA & 출시 준비 (2~3일)

**산출물**: 출시 가능한 상태

- [ ] E2E 테스트 (전체 게임 시나리오)
- [ ] 게임 로직 엣지 케이스 검증
- [ ] 3개 언어 전체 번역 검증
- [ ] 성능 프로파일링 (60fps 목표)
- [ ] 접근성 기본 대응 (키보드, 스크린리더)
- [ ] Google Play Store 등록 준비 (설명, 스크린샷)
- [ ] 웹 호스팅 배포 (Vercel / Netlify)

---

## 6. 타임라인 요약

| Phase | 기간 | 누적 |
|-------|------|------|
| 0: 프로젝트 초기화 | 1일 | 1일 |
| 1: 추가 데이터 수집 | 2~3일 | 3~4일 |
| 2: 게임 엔진 코어 | 5~7일 | 8~11일 |
| 3: UI 쉘 & 핵심 화면 | 5~7일 | 13~18일 |
| 4: UX 폴리시 | 3~4일 | 16~22일 |
| 5: 광고 통합 | 2~3일 | 18~25일 |
| 6: Android 패키징 | 2~3일 | 20~28일 |
| 7: QA & 출시 | 2~3일 | 22~31일 |

**총 예상**: 약 3~5주

---

## 7. 리스크 & 주의사항

| 리스크 | 대응 |
|--------|------|
| 게임 로직 복잡도 과소평가 | Phase 2에 충분한 시간 배정. 전투 시스템이 가장 복잡 |
| 맵 타일 데이터 부정확 | 위키 + 룰북 교차 검증 |
| 광고 오프라인 호환 | 네트워크 감지 + graceful degradation |
| WebView 성능 | Canvas 최적화, 불필요한 리렌더 방지 |
| 저작권 | 카드 이미지는 사용 불가 → 텍스트 + 아이콘 기반 UI |
| 보드게임 규칙 해석 모호성 | RULES_STRUCTURED.md 기준, 모호한 경우 BGG 포럼 참조 |

---

*문서 끝*
