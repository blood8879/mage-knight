# Google Play Store Listing

## App Information

- **Package Name**: com.mageknightgame.app
- **Category**: Board / Strategy
- **Content Rating**: Everyone

## Title (30 char max)

- EN: Mage Knight Board Game
- KO: 메이지 나이트 보드게임
- ES: Mage Knight Juego de Mesa

## Short Description (80 char max)

- EN: Solo play Mage Knight - Explore, fight, conquer in the First Reconnaissance!
- KO: 메이지 나이트 솔로 플레이 - 첫 번째 정찰 시나리오를 정복하세요!
- ES: Mage Knight en solitario - Explora, lucha y conquista en el Primer Reconocimiento!

## Full Description (4000 char max)

### EN

Mage Knight Digital Board Game brings the acclaimed solo board game experience to your mobile device. Play as Arythea in the First Reconnaissance scenario — explore a dynamically generated hex map, recruit units, learn powerful spells, and conquer cities to earn the highest score.

Features:
- Complete First Reconnaissance solo scenario
- Full rule automation — the app handles all game mechanics
- Hex-based exploration with dynamic map generation
- Deep combat system with ranged, siege, blocking, and melee phases
- Deck building with Advanced Actions, Spells, and Artifacts
- Unit recruitment and management
- Fame and Reputation tracking
- Day/Night cycle affecting gameplay
- Mana dice pool management
- Undo support for tactical decisions
- Auto-save with multiple save slots
- Available in English, Korean, and Spanish
- Works offline — no internet required for gameplay
- Dark mode support

### KO

메이지 나이트 디지털 보드게임은 호평받는 솔로 보드게임 경험을 모바일에서 즐길 수 있습니다. 첫 번째 정찰 시나리오에서 Arythea로 플레이하세요 — 동적으로 생성되는 헥스 맵을 탐험하고, 유닛을 모집하고, 강력한 주문을 배우고, 도시를 정복하여 최고 점수를 획득하세요.

주요 기능:
- 완전한 첫 번째 정찰 솔로 시나리오
- 완전 자동화된 규칙 — 앱이 모든 게임 메커니즘 처리
- 헥스 기반 탐험과 동적 맵 생성
- 원거리, 공성, 방어, 근접 단계의 깊은 전투 시스템
- 고급 행동, 주문, 아티팩트로 덱 빌딩
- 유닛 모집 및 관리
- 명성 및 평판 추적
- 게임플레이에 영향을 미치는 낮/밤 사이클
- 마나 주사위 풀 관리
- 전술적 결정을 위한 되돌리기 지원
- 여러 저장 슬롯의 자동 저장
- 영어, 한국어, 스페인어 지원
- 오프라인 작동 — 게임플레이에 인터넷 불필요
- 다크 모드 지원

## Privacy Policy URL

- Page: `app/public/privacy.html` (EN/KO/ES, AdMob 고지 포함) — 빌드에 포함되어 정적 서빙됨
- **URL: https://mage-knight-seven.vercel.app/privacy.html** (배포 확인됨, 2026-06-11)

## Screenshots (generated → `store-listing/screenshots/`)

생성 명령: `cd app && STORE_SHOTS=1 npx playwright test store-screenshots` (1920x1080 PNG)

1. ✅ `01-main-menu.png` — Main Menu
2. ✅ `02-game-board.png` — Game Board with hex map + card hand
3. ✅ `03-combat.png` — Combat view (Ranged & Siege phase)
4. ✅ `04-card-play.png` — Card play in combat tray
5. ✅ `05-tactic-selection.png` — Tactic selection overlay
6. ✅ `06-settings.png` — Settings with language selection
- [ ] Score screen (게임오버 도달 필요 — 선택 사항, 최소 2장 요건은 이미 충족)

## Icon / Graphics

- ✅ 512x512 PNG (app icon): `app/public/assets/icons/icon-512x512.png`
- ✅ Feature graphic: `screenshots/feature-graphic-1024x500.png`

## Technical

- Min SDK: 24 (Android 7.0)
- Target SDK: 34 (Android 14)
- Architecture: arm64-v8a, armeabi-v7a
- Permissions: INTERNET (for ads only)
