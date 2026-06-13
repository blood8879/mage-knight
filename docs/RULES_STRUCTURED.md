# Mage Knight Board Game — 구조화된 룰 문서 (솔로 플레이 앱 기준)

> **목적**: 이 문서는 Mage Knight Board Game의 룰북(영문 원본)을 디지털 솔로 플레이 앱 개발을 위해 구조화한 것입니다.
> 멀티플레이어 전용 규칙은 `[MULTI]`로 표시하며, 솔로에 핵심적인 규칙은 `[SOLO]`로 표시합니다.

---

## 목차

1. [게임 개요](#1-게임-개요)
2. [게임 셋업 (솔로 기준)](#2-게임-셋업-솔로-기준)
3. [게임 흐름 및 라운드 구조](#3-게임-흐름-및-라운드-구조)
4. [플레이어 턴 구조](#4-플레이어-턴-구조)
5. [마나 시스템](#5-마나-시스템)
6. [카드 시스템](#6-카드-시스템)
7. [유닛 시스템](#7-유닛-시스템)
8. [스킬 시스템](#8-스킬-시스템)
9. [이동 시스템](#9-이동-시스템)
10. [주민 상호작용](#10-주민-상호작용-interacting-with-locals)
11. [전투 시스템](#11-전투-시스템)
12. [도시 공격](#12-도시-공격-city-assaults)
13. [상처와 힐링](#13-상처와-힐링)
14. [턴 종료](#14-턴-종료-end-of-turn)
15. [레벨업 시스템](#15-레벨업-시스템)
16. [솔로 정복 시나리오](#16-솔로-정복-시나리오-solo-conquest)
17. [더미 플레이어](#17-더미-플레이어-dummy-player)
18. [적 토큰 능력 레퍼런스](#18-적-토큰-능력-레퍼런스)
19. [스코어링](#19-스코어링)
20. [앱 구현 시 필요한 외부 데이터](#20-앱-구현-시-필요한-외부-데이터)

---

## 1. 게임 개요

- **디자이너**: Vlaada Chvátil
- **장르**: 덱빌딩 + 탐험 + 전투 + RPG
- **핵심 루프**: 맵 탐험 → 전투/상호작용 → 카드 획득/레벨업 → 더 강한 적 도전
- **승리 조건**: 시나리오별로 다름 (일반적으로 모든 도시 정복 + 최고 Fame 점수)
- **솔로 플레이**: 더미 플레이어(Dummy Player)와 함께 2인 플레이처럼 진행

---

## 2. 게임 셋업 (솔로 기준)

### 2.1 공용 영역 셋업

#### Fame & Reputation 보드
- Fame 트랙 0번 칸에 플레이어 실드 토큰 배치
- Reputation 트랙 중앙(0) 칸에 실드 토큰 배치

#### 적 & 폐허 토큰 더미
- 적 토큰(원형)과 폐허 토큰(육각형)을 뒷면 기준으로 분류
- **7개 더미**로 분류하여 뒤집어 쌓기
- 각 더미 옆에 버린 토큰용 공간 확보
- 토큰이 떨어지면 버린 것을 섞어 새 더미 생성

#### Artifact 덱
- 셔플 후 뒤집어 놓기 (오퍼에 공개하지 않음)

#### Wound 더미
- Wound 카드를 앞면으로 쌓아놓기

#### Spell 덱 & Spell 오퍼
- Spell 카드를 셔플 후 뒤집어 놓기
- 상위 3장을 공개하여 Spell 오퍼 구성

#### Advanced Action 덱 & 오퍼
- Advanced Action 카드를 셔플 후 뒤집어 놓기
- Spell 오퍼와 동일한 방식으로 3장 공개

#### Unit 오퍼
- Regular(은색) Unit 덱에서 `플레이어 수 + 2`장 공개 (솔로 = 3장)
- Core 타일이 공개되기 전에는 Regular(은색) Unit만
- Core 타일이 하나라도 공개되면 Elite(금색)과 Regular 교대로 배치
- 맵에 monastery가 있으면 monastery당 Advanced Action 카드 1장을 Unit 오퍼에 추가

#### Round Order 토큰
- 플레이어 + 더미 플레이어의 Round Order 토큰 배치

#### Day/Night 보드
- Day 면이 위로 오도록 배치
- **왼쪽**: 지형별 이동 비용 표시
- **오른쪽**: 소스(Source) — 마나 다이스

#### Source (마나 다이스)
- `플레이어 수 + 2`개의 마나 다이스 굴리기 (솔로 = 3개)
- 기본 색상(빨강, 파랑, 흰색, 초록) 다이스가 **절반 이상** 이어야 함
- 아니면 검정+금색 다이스를 모두 다시 굴리기 (조건 충족할 때까지)

#### Common Skill 오퍼
- 레벨업 시 선택하지 않은 Skill 토큰을 놓는 공간

#### Tile 덱
- **Countryside 타일** (초록 뒷면): 랜덤 선택
- **Core 타일** (갈색 뒷면): 도시 타일과 비도시 타일 분리 후 적절한 수 선택
- Core 타일을 셔플한 뒤 그 위에 Countryside 타일을 올려놓기

#### 맵 초기 배치
- 시나리오에 따라 시작 타일 (A면 또는 B면) 배치
- 시작 타일 기준으로 타일 2~3장 공개 (A면=2장, B면=3장)
- 공개된 타일의 Site Description 카드 확인

#### Day/Night Tactic 카드
- Day Tactic 카드를 쉽게 접근 가능한 곳에 공개
- Night Tactic 카드는 사용하지 않는 곳에 보관

#### Bank
- 마나 토큰과 여분의 마나 다이스를 접근 가능한 곳에 배치

### 2.2 플레이어 영역 셋업

| 컴포넌트 | 설명 |
|----------|------|
| **Hero 카드** | 캐릭터 대표. 하단에 Inventory (크리스탈 저장소) |
| **Level 토큰 더미** | 5개의 8각형 레벨 토큰, 1-2가 맨 위. Armor=2, Hand limit=5 표시 |
| **Command 토큰** | 6번째 빈 레벨 토큰을 뒤집어 Command 토큰으로 사용 (초기 1개) |
| **Deed 덱** | 해당 Hero의 16장 Basic Action 카드로 셔플하여 구성 |
| **Player's Hand** | Deed 덱에서 Hand limit(초기 5장)만큼 드로우 |
| **Discard 더미** | 턴 종료 시 플레이한 카드를 놓는 곳 (앞면) |
| **Unit 영역** | 유닛을 배치하는 곳. Command 토큰 수만큼 유닛 보유 가능 |
| **Shield 토큰** | Fame/Reputation 트랙에 각 1개, 나머지는 맵 마킹용 |
| **Skill 토큰 더미** | 10개의 Skill 토큰을 랜덤 셔플 후 뒤집어 놓기 |
| **Figure** | 히어로 피규어 (첫 턴에 맵에 배치) |

---

## 3. 게임 흐름 및 라운드 구조

### 3.1 전체 게임 흐름

```
1. 시나리오 선택
2. 히어로 선택
3. 게임 셋업
4. 라운드 반복 (시나리오 종료 조건 또는 라운드 한도까지)
5. 게임 종료 → 스코어링
```

### 3.2 하나의 라운드 (Day 또는 Night)

라운드는 **Day** 또는 **Night**이며, 교대로 진행됩니다.

#### Phase 1: 라운드 준비 (첫 라운드 제외)

| 단계 | 설명 |
|------|------|
| a. Day/Night 보드 뒤집기 | Day → Night, Night → Day |
| b. Source 리셋 | 모든 마나 다이스 다시 굴리기 (셋업 조건 동일) |
| c. Unit 오퍼 갱신 | 기존 Unit 카드를 덱 밑으로 → Advanced Action이 있으면 AA 덱 밑으로 → 새 Unit 카드 배치 |
| d. Advanced Action 오퍼 갱신 | 최하위 카드 제거(덱 밑) → 나머지 한 칸씩 아래로 → 새 카드 상위에 추가 |
| e. Spell 오퍼 갱신 | AA 오퍼와 동일한 방식 |
| f. Tactic 카드 수거 | 이전 라운드의 모든 Tactic 카드 수거 후 해당 라운드 Tactic 카드 공개 |
| g. 각 플레이어 준비 | Banner Artifact/Skill 토큰 앞면으로, 모든 Unit Ready 상태로, Deed 덱 셔플, Hand limit까지 드로우 |

#### Phase 2: Tactic 카드 선택

- 각 플레이어가 공개된 Tactic 카드 중 1장 선택
- **Fame이 가장 낮은 플레이어부터** 선택
- Tactic 카드의 숫자로 Round Order 재배치 (낮은 숫자 = 먼저 플레이)

#### Phase 3: 플레이어 턴 진행

- Round Order 토큰 순서대로 (위→아래) 플레이어가 턴 진행
- 마지막 플레이어 턴 후 첫 번째 플레이어가 다시 시작
- Deed 덱이 빈 플레이어는 턴 시작 시 **End of Round** 선언 가능

#### Phase 4: 시나리오 종료 확인

- 시나리오 조건 충족 또는 라운드 한도 도달 → 게임 종료
- 아니면 다음 라운드 진행

---

## 4. 플레이어 턴 구조

### 4.1 턴 시작 조건

- Deed 덱이 비었고 핸드에 카드가 없으면 → **반드시** End of Round 선언
- Deed 덱이 비었지만 핸드에 카드가 있으면 → End of Round 선언 **또는** 플레이 선택
- 핸드에 카드가 있으면 → 플레이 (End of Round가 이미 선언된 경우 제외)

### 4.2 턴 유형 선택

플레이어는 **Regular Turn** 또는 **Resting** 중 선택합니다.

#### Regular Turn

두 부분으로 구성 (둘 다 선택적):

```
1. 이동 (Movement) — 선택적
   └ 맵 타일 공개 가능
2. 액션 (Action) — 선택적 (때로는 필수)
   └ 전투 / 주민 상호작용 / PvP 전투 / 아무것도 안 함
```

**제약사항**:
- 이동은 **액션 전에** 완료해야 함
- 이동 후 액션, 또는 액션만, 또는 이동만, 또는 둘 다 안 함 가능
- 최소 1장의 카드를 플레이하거나 버려야 함 (핸드가 비었고 Deed 덱에 카드가 있으면 예외)

**필수 액션 조건** (이동이 이를 유발한 경우):
- 다른 플레이어가 있는 칸에서 이동 종료 → PvP 전투 `[MULTI]`
- 정복되지 않은 요새화 장소(keep, mage tower, city)에 진입 → 수비대와 전투
- rampaging enemy에 의해 공격받은 경우 → 해당 적과 전투

**선택 액션** (필수 액션이 없는 경우 하나만):
- 거주지(village, monastery, keep, mage tower, city)에서 주민 상호작용
- 모험 장소(ruins, dungeon, tomb, monster den, spawning grounds)에서 탐험 → 전투
- rampaging enemy 도전
- monastery 소각 (Reputation -3)
- 아무것도 안 함

#### Resting

이동, 전투, 상호작용 불가. 핸드 내용에 따라:

| 조건 | Resting 유형 |
|------|-------------|
| Wound 외 카드 1장 이상 보유 | **Standard Rest**: non-Wound 카드 1장 + Wound 카드 원하는 만큼 버리기 |
| Wound 카드만 보유 | **Slow Recovery**: 핸드 공개 → Wound 1장만 버리기 |

### 4.3 Special / Healing 이펙트

- **Special 이펙트** (⚡): 턴 중 아무 때나 사용 가능 (전투 중 포함)
- **Healing 이펙트** (💚): 턴 중 아무 때나 사용 가능 (전투 중에는 불가)
- Resting 전후에도 Healing/Special 이펙트 사용 가능

### 4.4 카드 Sideways 플레이

- **Wound를 제외한** 모든 카드를 옆으로 플레이 가능
- 효과: Move 1, Influence 1, Attack 1, 또는 Block 1 (선택)
- Ranged Attack, Siege Attack, 원소 공격/방어로는 사용 불가

---

## 5. 마나 시스템

### 5.1 마나의 종류

| 유형 | 형태 | 설명 |
|------|------|------|
| **Pure Mana** | 마나 다이스 또는 플레이 영역의 마나 토큰 | 사용하지 않으면 턴 종료 시 소멸 |
| **Crystal** | Hero 카드 Inventory의 마나 토큰 | 영구 저장, 기본 색상 각 최대 3개 |

### 5.2 마나 색상

| 색상 | 용도 |
|------|------|
| 🔴 Red | 기본 색상 |
| 🔵 Blue | 기본 색상 |
| ⚪ White | 기본 색상 |
| 🟢 Green | 기본 색상 |
| 🟡 Gold | **Day 전용**. 아무 기본 색상 대체 가능. 순수 형태로만 존재 (크리스탈 없음) |
| ⚫ Black | **Night 전용**. 일부 효과에 power 용도로 사용. 순수 형태로만 존재 (크리스탈 없음) |

### 5.3 Source (공용 마나 풀)

- 매 턴, 플레이어는 Source에서 **다이스 1개**를 가져와 해당 색상 마나로 사용 가능
- 다이스를 가져온 후 **사용하지 않기로** 결정할 수 없음 (가져오면 반드시 사용)
- 턴 종료 시 사용한 다이스를 다시 굴려 Source에 반환

### 5.4 Crystal 사용

- Crystal은 아무 때나 순수 마나(pure mana)로 변환 가능
- 순수 마나 → Crystal 변환은 **불가** (효과가 명시하지 않는 한)
- Inventory에 같은 색상 크리스탈 3개가 있으면 해당 색상 크리스탈을 더 얻을 수 없음

### 5.5 "Gain" 이펙트

| 효과 | 결과 |
|------|------|
| "Gain a mana of [color]" | 해당 색상 마나 토큰을 플레이 영역에 배치 |
| "Gain a crystal of [color]" | 해당 색상 크리스탈을 Inventory에 배치. 이미 3개면 마나 토큰으로 대체 |
| "Gain a new Deed card" | 새 카드를 Deed 덱 위에 배치 (AA, Spell, Artifact). 오퍼에서 가져온 경우 즉시 보충 |

---

## 6. 카드 시스템 (Deed Cards)

### 6.1 카드 유형

| 유형 | 뒷면 | 설명 |
|------|------|------|
| **Basic Action** | Mage Knight 문양 | 시작 시 16장으로 Deed 덱 구성 |
| **Advanced Action** | Mage Knight 문양 | 레벨업/구매로 획득 |
| **Spell** | Mage Knight 문양 | Mage Tower에서 학습 |
| **Artifact** | Mage Knight 문양 | 전투 보상/구매로 획득 |
| **Wound** | Mage Knight 문양 | 데미지 시 핸드에 추가. **플레이 불가** |

### 6.2 카드 플레이 방식

#### Action 카드 (Basic / Advanced)
- **Basic Effect**: 그냥 플레이
- **Strong Effect**: 해당 색상 마나 1개로 파워업
  - Night에는 해당 색상 마나 1개 + 검정 마나 1개로 파워업

#### Spell 카드
- **Basic Effect**: 해당 색상 마나 1개로 파워
- **Strong Effect**: 해당 색상 마나 1개 + 검정 마나 1개로 파워 (Night)
  - Night에는 해당 색상 마나 1개만으로 strong effect 사용 가능

#### Artifact 카드
- **Basic Effect**: 그냥 플레이
- **Strong Effect**: **게임에서 제거** (thrown away)하여 사용

#### Wound 카드
- **플레이 불가**. 어떤 방식으로도 사용 불가
- 버리기(discard)나 제거(throw away) 불가 (효과가 명시하지 않는 한)

### 6.3 카드 효과 누적

- 같은 유형의 효과를 제공하는 카드들을 함께 플레이 가능
- 다른 유형이라도 같은 효과를 주면 누적 가능
- 플레이한 카드를 같이 모아 총합 계산

### 6.4 Sideways 플레이

모든 non-Wound 카드는 옆으로 놓아 다음 중 하나를 제공:
- Move 1
- Influence 1
- Attack 1
- Block 1

**제한**: Ranged Attack, Siege Attack, 원소 공격/방어로는 사용 불가

### 6.5 카드 버리기 (Discard) vs 제거 (Throw Away)

| 동작 | Discard | Throw Away |
|------|---------|------------|
| 대상 | Discard 더미로 이동 | 게임에서 제거 (Wound는 Wound 더미로) |
| Wound 가능? | ❌ 불가 (효과 명시 시만) | Wound → Wound 더미로 반환 |

---

## 7. 유닛 시스템

### 7.1 유닛 기본 규칙

| 항목 | 설명 |
|------|------|
| **유형** | Regular (은색 뒷면) / Elite (금색 뒷면) |
| **배치** | 플레이어 앞 Unit 영역에 공개 상태로 배치 |
| **Command 토큰** | 각 유닛에 1개 필요. Command 토큰 수 > 유닛 수 이어야 함 |
| **상태** | Ready / Spent / Wounded |

### 7.2 유닛 상태

```
Ready (Command 토큰 위)
  │── 활성화 → Spent (Command 토큰 유닛 위로)
  │── 데미지 → Wounded (Wound 카드 유닛 위에)
  
Spent
  │── 라운드 시작 시 자동으로 Ready
  │── 데미지 → Wounded
  
Wounded
  │── Healing으로 회복 가능 (유닛 레벨만큼 Healing 필요)
  │── 활성화 불가, 데미지 할당 불가
  │── 라운드 시작 시 Ready되지만 여전히 Wounded
```

### 7.3 유닛 활성화

- Ready & non-Wounded 유닛만 활성화 가능
- 핸드에서 카드 플레이하는 것과 동일하게 취급
- 다른 카드/유닛과 효과 결합 가능
- 일부 능력은 마나로 파워업 필요
- 활성화 후 Command 토큰을 유닛 위에 올림 → Spent

### 7.4 유닛 모집

- Unit 오퍼에서 Influence 포인트로 모집
- 모집 비용은 Unit 카드 좌측 상단에 표시
- 유닛 유형(아이콘)이 현재 장소에서 모집 가능한 유형과 일치해야 함
- 새 유닛을 위한 Command 토큰이 없으면 기존 유닛 1개를 **해산(disband)** 해야 함
- 새로 모집된 유닛은 항상 Ready & non-Wounded

### 7.5 "Ready a Unit" 효과

- 효과가 "Ready a Unit"을 허용하면 Command 토큰을 유닛 아래로 이동
- 해당 유닛은 다시 Ready 상태 → 재활성화 가능

### 7.6 Banner Artifact

- Banner를 Unit에 부착 가능 (부분적으로 유닛 카드 아래에 배치)
- Banner가 부착된 동안: 유닛은 basic effect만 사용 가능, strong effect 불가
- 유닛 파괴/해산 시 또는 다른 유닛에 재할당 시: Banner는 discard 더미로
- 라운드 종료 시: Banner를 유닛과 함께 유지하거나 Deed 덱에 셔플

---

## 8. 스킬 시스템

### 8.1 스킬 획득

- 시작 시 스킬 없음
- 짝수 Fame 레벨 도달 시 Skill 토큰 1개 획득
- 다른 캐릭터의 스킬도 획득 가능 (게임에 들어온 스킬은 소속 캐릭터 무관)

### 8.2 스킬 유형

| 아이콘 | 유형 | 사용 제한 |
|--------|------|----------|
| 🔷 (한 번 아이콘) | **라운드 1회** | 사용 후 뒤집기. 다음 라운드 시작 시 복구 |
| 🔶 (지속 아이콘) | **라운드 1회 + 지속** | 다음 턴 시작까지 효과 지속. 중앙에 공개 배치 |
| (아이콘 없음) | **매 턴 사용 가능** | 제한 없이 매 턴 사용 |

### 8.3 스킬 획득 과정 (레벨업 시)

1. Skill 더미에서 상위 2개 토큰 뒤집기
2. **선택 A**: 1개를 가져가고 나머지를 Common Skills 영역에 배치. Advanced Action 오퍼에서 **아무 카드 1장** 획득
3. **선택 B**: 다른 플레이어의 Common Skills 영역에서 1개 가져감 (있는 경우). 양쪽의 공개 스킬을 Common Skills에 배치. Advanced Action 오퍼 **최하위 카드** 획득

---

## 9. 이동 시스템

### 9.1 기본 이동 규칙

- Regular Turn에서만 이동 가능 (Resting 시 불가)
- **액션 전에** 이동을 완료해야 함
- 이동 효과(Move X)를 제공하는 카드, 스킬, 유닛 능력 사용
- Move 포인트를 합산 후 지형 비용에 따라 칸 이동

### 9.2 지형별 이동 비용

| 지형 | Day 비용 | Night 비용 |
|------|---------|-----------|
| **Plains** (평원) | 2 | 2 |
| **Hills** (언덕) | 3 | 3 |
| **Forest** (숲) | 3 | 5 |
| **Wasteland** (황무지) | 4 | 4 |
| **Desert** (사막) | 5 | 3 |
| **Swamp** (늪) | 5 | 5 |
| **Lake/Sea** (호수/바다) | ❌ 진입 불가 | ❌ 진입 불가 |
| **Mountain** (산) | ❌ 진입 불가 | ❌ 진입 불가 |

> Day/Night 보드 좌측에 정확한 비용 표시. X 표시 = 진입 불가.

### 9.3 이동 제한

| 제한 | 설명 |
|------|------|
| 정복되지 않은 요새 진입 | 이동 즉시 종료 → 공격(assault) 개시 |
| rampaging enemy 칸 진입 | 적을 격파할 때까지 진입 불가 |
| rampaging enemy 도발 | 인접 칸에서 다른 인접 칸으로 이동 시 해당 적이 공격 → 이동 즉시 종료 |
| 모험 장소 진입 | 이동을 반드시 종료할 필요 없음 (무시 가능) |

### 9.4 타일 공개 (Reveal)

- 인접한 빈 공간에 새 타일을 배치할 수 있는 칸을 점유해야 함
- 타일 공개 비용: **Move 포인트 2** 소비
- 타일은 Tile 덱 상단에서 가져옴
- 타일 방향은 **고정** (모서리 심볼이 시작 타일과 같은 방향)
- 새 타일 2개 이상 위치가 가능하면 공개 전에 어디에 놓을지 선언

#### 타일 배치 제한

| 타일 유형 | 제한 |
|----------|------|
| Countryside (초록 뒷면) | 최소 2개의 다른 타일에 인접해야 함, 또는 최소 2개 타일에 인접한 타일에 인접 |
| Core (갈색 뒷면) | 최소 2개의 다른 타일에 인접해야 함 |
| 해안선 | 해안선 뒤에는 타일 배치 불가 |

### 9.5 이동 중 카드 추가 플레이

- 이동 중 아무 때나 추가 이동 카드를 플레이 가능
- 새 타일 공개 후에도 추가 카드 플레이 가능
- 탐험과 이동을 교대로 수행 가능
- **이전에 플레이한 카드에 마나를 추가로 파워하는 것은 불가** (strong effect는 카드 플레이 시 결정)

### 9.6 특수 이동 효과

- 일부 효과는 지형 이동 비용을 감소시킴 (최소 0, 0이면 무료 진입)
- 일부 효과는 진입 불가 지형에 진입 허용 (비용 있음)
- 일부 효과는 한 번에 여러 칸 이동 (leap). 건너뛰는 칸은 무시 (rampaging enemy 도발 안 함)

---

## 10. 주민 상호작용 (Interacting with Locals)

### 10.1 상호작용 가능 장소

village, monastery, 본인 소유 keep, mage tower, 정복된 city

### 10.2 Influence 포인트 계산

1. Influence 효과를 제공하는 카드/스킬/유닛 사용 (Influence X = X 포인트)
2. non-Wound 카드를 옆으로 놓으면 Influence 1
3. Special/Healing 이펙트도 동시에 사용 가능
4. **Reputation 보정**: Reputation 트랙 위치에 따라 양수/음수 보정
   - Reputation 트랙의 X 칸 → **상호작용 불가**
5. 정복된 city에서 상호작용 시: 해당 city의 Shield 토큰당 Influence +1

### 10.3 장소별 구매 옵션

| 장소 | 구매 가능 항목 |
|------|-------------|
| **Village** | Healing 포인트 (3 Influence = 1 Healing) |
| **Monastery** | Healing 포인트 (2 Influence = 1 Healing) |
| **Monastery** | Advanced Action 학습 (6 Influence). Unit 오퍼에서 AA 카드 선택 → Deed 덱 위에 배치 |
| **Mage Tower** | Spell 학습 (7 Influence + 같은 색상 마나 1개). Spell 오퍼에서 선택 → Deed 덱 위에 배치 |
| **Keep (소유)** | 해당 장소 Site Description 카드 참조 |
| **Red City** | Artifact 구매 (12 Influence 각). 턴 종료 시 Artifact 덱에서 드로우 |
| **Blue City** | Spell 구매 (Mage Tower와 동일 조건) |
| **White City** | **모든 유형** Unit 모집 가능. 2 Influence 추가 시 Elite Unit 1장을 Unit 오퍼에 추가 |
| **Green City** | 6 Influence로 Advanced Action 오퍼에서 카드 획득 또는 AA 덱 탑에서 랜덤 1장 |

### 10.4 상호작용 규칙

- 한 턴에 같은/다른 종류를 **여러 번** 구매 가능 (Influence가 충분하면)
- Reputation/Shield 토큰 보너스/페널티는 **턴당 1번만** 적용 (city에서)
- Unit 오퍼에서 가져간 카드는 다음 라운드 시작까지 보충되지 않음

---

## 11. 전투 시스템

### 11.1 전투 개시 조건

| 상황 | 전투 유형 |
|------|----------|
| 정복되지 않은 요새(keep, mage tower, city) 진입 | **Assault** (공격 시 Reputation -1) |
| 모험 장소(dungeon, tomb, ruins 등) 진입 선언 | 장소 적과 전투 |
| monastery 소각 선언 | Reputation -3, 랜덤 보라 적 토큰 드로우 |
| rampaging enemy 인접 도전 | 해당 rampaging enemy와 전투 |
| rampaging enemy 도발 (인접 이동) | 해당 enemy가 공격 |

### 11.2 전투 단계 (4단계)

```
Phase 1: Ranged & Siege Attack (원거리/공성 공격)
    ↓
Phase 2: Block (방어)
    ↓
Phase 3: Assign Damage (데미지 할당)
    ↓
Phase 4: Attack (근접 공격)
```

### 11.3 Phase 1: Ranged & Siege Attack

- 하나 이상의 공격을 선언하거나 패스
- 공격 대상: 1개 이상의 적 토큰 선택
- **Ranged Attack**과 **Siege Attack** 효과를 카드/스킬/유닛으로 합산

#### 요새화(Fortified) 적에 대한 공격 제한

| 적 상태 | 허용되는 공격 |
|--------|------------|
| Fortified (요새 방어자 or fortified 능력) | **Siege Attack만** 가능 |
| Fortified x2 (요새 + fortified 능력) | **어떤 공격으로도 Ranged/Siege 불가** |
| Non-fortified | Ranged & Siege 자유롭게 혼합 |

#### 적 저항(Resistance)에 의한 공격 비효율

| 적 저항 | 비효율 공격 유형 |
|--------|--------------|
| Physical Resistance | 물리 공격 (반감) |
| Fire Resistance | Fire 공격 (반감) |
| Ice Resistance | Ice 공격 (반감) |
| Fire + Ice Resistance | Cold Fire 공격도 (반감) |

- **비효율 공격**: 총합을 2로 나누고 내림
- Cold Fire Attack은 Fire **그리고** Ice Resistance가 모두 있는 적에게만 반감

#### 공격 성공 조건

- 총 Attack 값 ≥ 대상 적들의 **총 Armor** 값
- 성공 시 대상 적 제거 → 해당 적 더미의 버린 칸에 배치
- 공격 플레이어는 제거된 적 1개당 **적 토큰 하단의 Fame** 획득

#### 여러 공격 선언

- 한 전투에서 여러 번 공격 선언 가능
- 각 공격은 별도의 열(column)로 카드/효과 관리
- 전략적으로 요새화/비요새화 적을 분리하여 공격 가능

**중요**: Sideways 카드는 Ranged/Siege Attack에 사용 **불가**

### 11.4 Phase 2: Block (방어)

- Ranged/Siege에서 제거되지 않은 적이 공격
- 플레이어는 Block 효과를 사용하여 적의 공격을 **개별적으로** 차단
- **적 1개씩** 선택하여 Block

#### Block 유형별 효율

| 적 공격 유형 | 효율적 Block | 비효율적 Block |
|-----------|-----------|-------------|
| Physical Attack | **모든 Block** 효율적 | - |
| Fire Attack | Ice 또는 Cold Fire Block | 나머지 (반감) |
| Ice Attack | Fire 또는 Cold Fire Block | 나머지 (반감) |
| Cold Fire Attack | Cold Fire Block만 | 나머지 (반감) |

#### Block 성공/실패

| 결과 | 조건 | 효과 |
|------|------|------|
| 성공 | Block 총값 ≥ 적 Attack 값 | 적 공격 무효화, 적 토큰을 옆에 보관 (제거 아님) |
| 실패 | Block 총값 < 적 Attack 값 | **Block 효과 없음** — 전체 공격이 그대로 적용 |

- Block은 **부분 차단 불가** — 전부 막거나 전부 실패
- **Swift 능력**: Block 목적으로 해당 적의 Attack 값이 2배
- 여러 적을 한 번에 Block 불가 (개별 처리)
- 성공적으로 Block된 적은 Phase 4 (Attack)에서 제거 기회 있음

#### Summon 능력

- Summon 아이콘이 있는 적: Block Phase 시작 시 갈색 적 토큰을 랜덤 드로우하여 추가
- 소환된 몬스터가 살아있는 동안 소환자를 대상으로 한 효과는 소환된 몬스터에게도 적용

### 11.5 Phase 3: Assign Damage (데미지 할당)

- Block되지 않은 모든 적이 데미지를 가함
- 각 적의 Attack 값만큼 데미지 발생
  - **Brutal 능력**: Block되지 않으면 Attack 값의 **2배** 데미지
- 데미지를 **반드시 모두 할당**해야 함

#### 데미지 할당 순서 (플레이어 선택)

1. **Unwounded Unit에 할당** — 유닛에 Wound 카드 배치 → 유닛 Armor만큼 데미지 감소
   - 1 포인트 데미지로도 유닛을 Wound 가능 (Armor 값은 흡수량만 결정)
   - 이미 Wounded인 유닛에는 할당 불가
2. **Hero에 할당** — Wound 카드를 핸드에 추가, Hero Armor만큼 데미지 감소
   - Hero Armor = 현재 Level 토큰의 좌측 숫자
   - 효과적으로 X 포인트의 데미지 = ceil(X / Armor) 장의 Wound 카드

#### 유닛 저항과 데미지

- 유닛이 해당 원소에 **저항**이 있는 경우:
  - 먼저 Armor로 데미지 감소 (Wound 없이)
  - 남은 데미지가 있으면 Wound 적용 후 다시 Armor만큼 감소
  - → 저항이 있는 유닛은 해당 공격에 대해 **2배의 데미지 흡수**

#### Poison 능력

- 유닛에 Wound를 줄 데미지 → Wound 카드 **2장** (1장 대신)
- Hero에 Wound 추가 시 각 Wound 카드당 1장을 discard 더미에도 추가

#### Paralyze 능력

- 유닛에 Wound를 줄 데미지 → 유닛 **즉시 파괴** (게임에서 제거)
- Hero에 Wound → 즉시 핸드에서 non-Wound 카드 모두 버리기

#### Knock Out

- 핸드의 Wound 카드 수가 Hand limit 이상 → **Knock Out**
- 즉시 핸드에서 **non-Wound 카드 모두 버리기**
- 전투 중 Wound (카드 효과 포함)도 Knock Out 체크에 포함
- Knock Out 상태에서도: 유닛 활성화, 스킬 사용, Wound 추가 수용 가능

### 11.6 Phase 4: Attack (근접 공격)

- Ranged/Siege에서 사용하지 않은 공격 포함하여 **모든 유형의 Attack** 사용 가능
- Ranged, Siege, 일반 Attack 구분 없음
- **Fortification 무시** — 이 단계에서는 모든 적에게 공격 가능
- non-Wound 카드를 옆으로 놓으면 **물리 Attack 1**
- Attack phase에서만 사용 가능하다고 명시된 효과 있음

#### 여러 공격

- Phase 1과 마찬가지로 여러 공격 선언 가능
- 성공 시 적 제거 + Fame 획득

### 11.7 전투 중 Special 이펙트

- **Special 이펙트 (⚡)**: 전투 중 아무 Phase에서나 사용 가능
- **Healing 이펙트 (💚)**: 전투 중 **사용 불가**
- **Errata**: ENERGY FLOW / ENERGY STEAL Spell의 두 효과는 healing 이펙트 (special이 아님)

### 11.8 전투 종료

- Attack Phase 후 전투 종료
- 적을 제거하지 못해도 전투는 종료됨 (실패 결과 적용)

---

## 12. 도시 공격 (City Assaults)

### 12.1 도시 보너스 (수비 유닛에 적용)

| 도시 색상 | 보너스 |
|---------|-------|
| **White City** | 모든 수비자 +1 Armor |
| **Blue City** | Ice/Fire Attack 수비자 +2 Attack, Cold Fire Attack 수비자 +1 Attack |
| **Red City** | 물리 Attack 수비자에게 **Brutal** 능력 추가 |
| **Green City** | 물리 Attack 수비자에게 **Poison** 능력 추가 |

### 12.2 도시 정복 후

- 도시 카드에 Shield 토큰 배치 (제거한 적마다 1개)
- 가장 많은 Shield 토큰 보유자가 **City Leader**
- Leader가 도시 카드와 모든 Shield 토큰 가져감

---

## 13. 상처와 힐링

### 13.1 Hero 상처

- 데미지 시 Wound 카드를 **핸드에** 추가
- Wound 카드는 **절대 버릴 수 없음** (효과가 명시하지 않는 한)
- Sideways 플레이 불가, 턴 종료 시 버리기 불가

### 13.2 Resting 시 Wound 처리

- **Standard Rest**: 핸드에서 Wound 카드 원하는 만큼 + non-Wound 1장 버리기
  - Wound는 **discard 더미 위에** 놓임 → 다음 라운드에 드로우될 수 있음
- **Slow Recovery** (Wound만 있을 때): Wound 1장만 discard 더미로 버리기

### 13.3 Healing

- Healing 효과로 Wound 제거 가능
- **1 Healing 포인트 = Wound 카드 1장 제거** (핸드에서 → Wound 더미로 반환)
- 유닛 Healing: 유닛 레벨만큼 Healing 포인트 필요 → Wound 카드 제거, 유닛은 non-Wounded
  - 2개 Wound (Poison)인 유닛: 2배 Healing 필요
- 전투 중 Healing **불가** (전투 전후 가능)
- 마을에서 Healing 구매: 3 Influence = 1 Healing 포인트
- 수도원에서 Healing 구매: 2 Influence = 1 Healing 포인트
- 전투에서 받은 데미지도 전투 종료 후 같은 턴에 Heal 가능
- **magical glade**: Healing 제공 아님. Wound 카드 1장을 **throw away** (제거)

---

## 14. 턴 종료 (End of Turn)

### 14.1 마나 반환

- 사용한 마나 다이스를 **다시 굴려** Source에 반환 (가장 먼저 수행)

### 14.2 Forced Withdrawal (강제 철수)

- 안전하지 않은 칸에서 턴을 종료하면 안전한 칸까지 역추적
- **안전한 칸**: 일반적으로 접근 가능한 칸 + 다른 Hero 없는 칸
- 역추적하는 칸마다 Wound 1장 추가

### 14.3 Play Area 정리

- 모든 마나 토큰 → Bank 반환
- 플레이한 카드 → discard 더미 (thrown away 제외)
- Wound 카드 → Wound 더미 반환 (throw away된 것)

### 14.4 장소 혜택

| 장소 | 혜택 |
|------|------|
| **Magical Glade** | Wound 카드 1장 throw away (핸드/discard에서) |
| **Crystal Mine** | 해당 색상 Crystal 1개 획득 (이미 3개면 효과 없음) |

### 14.5 전투 보상 (있는 경우)

| 보상 유형 | 설명 |
|---------|------|
| **Crystal** | Inventory에 추가 (3개 이미 있으면 무효). 랜덤 크리스탈은 다이스 굴림 (검정=1 Fame, 금=색상 선택) |
| **Artifact** | 수량+1장 드로우, 1장을 Artifact 덱 바닥에 배치, 나머지를 Deed 덱 위에 |
| **Spell** | Spell 오퍼에서 선택, Deed 덱 위에 배치, 오퍼 보충 |
| **Advanced Action** | AA 오퍼에서 선택, Deed 덱 위에 배치, 오퍼 보충 |
| **Unit** | Unit 오퍼에서 아무 유닛 (유형/비용 무관). Command 토큰 없으면 해산 또는 포기 |

### 14.6 카드 드로우

1. 드로우 전: non-Wound 카드를 원하는 만큼 버리기 가능
   - 카드를 하나도 플레이/버리지 않았으면 **최소 1장** 버려야 함
2. Deed 덱에서 **Hand limit**까지 드로우
   - 기본 Hand limit = Level 토큰 우측 숫자
   - **keep** 위/인접 시: 소유한 keep 수만큼 Hand limit 증가
   - **정복된 city** 위/인접 시: Shield 토큰 최소 1개 있으면 +1 (leader면 +2). keep과 city 보너스가 모두 적용되면 높은 쪽만
3. Deed 덱이 드로우 중 소진되면 멈춤 (discard 더미 셔플하지 않음)
   - 예외: Night Tactic "Long Night" 사용 시 가능

---

## 15. 레벨업 시스템

### 15.1 Fame 트랙

- 전투에서 적 제거 시 Fame 획득 (적 토큰 하단 숫자)
- Fame 트랙의 줄을 넘을 때 **레벨업** (턴 종료 시 처리)

### 15.2 레벨업 처리

| 레벨 아이콘 | 효과 |
|-----------|------|
| 🔓 (Command) | Level 토큰 제거 → 새 Armor/Hand limit 공개. 제거된 토큰 뒤집어 Command 토큰으로 사용 |
| 🎯 (Skill + AA) | Skill 토큰 1개 + Advanced Action 카드 1장 획득 (8.3 참조) |

### 15.3 Armor & Hand Limit 변화

레벨업 시 Level 토큰 더미에서 맨 위 토큰 제거:
- 새 토큰의 좌측 = 새 Armor 값
- 새 토큰의 우측 = 새 Hand Limit

---

## 16. 솔로 정복 시나리오 (Solo Conquest)

### 16.1 기본 정보

| 항목 | 값 |
|------|---|
| **플레이어 수** | 1 |
| **시나리오 유형** | Solo |
| **라운드 수** | 6 (3 Day + 3 Night) |
| **목표** | 모든 도시 정복 |

### 16.2 셋업

| 항목 | 설정 |
|------|------|
| **맵 형태** | Wedge |
| **Countryside 타일** | 7장 |
| **Core 도시 타일** | 2장 |
| **Core 비도시 타일** | 2장 |
| **도시 레벨** | 첫 번째 공개 도시: Level 5, 두 번째: Level 8 |
| **Dummy Player** | 표준 Dummy Player 1명 |

### 16.3 카드 & 스킬 제거

- Spell 덱에서 경쟁 Spell 4장 제거 (17-20번)
- 플레이어 Skill 덱에서 interactive Skill 1장 제거 (Skill Description 카드에서 어두운 배경인 것)

### 16.4 특수 규칙

- Tactic 선택 시: **Dummy Player가 항상 먼저** 선택 (랜덤 1장)
- Day/Night 종료 시: 사용된 Tactic 2장 모두 게임에서 제거 (각 Tactic은 정확히 1번만 사용)

### 16.5 시나리오 종료

- 모든 도시 정복 시 → 플레이어 마지막 턴 1번 (Dummy Player는 아님)
- 라운드 한도 도달 시 종료

### 16.6 승리 조건

- 모든 도시 정복 = **성공**
- 실패해도 점수 계산 가능 (얼마나 잘했는지 확인)

---

## 17. 더미 플레이어 (Dummy Player)

### 17.1 셋업

| 항목 | 설명 |
|------|------|
| **히어로 선택** | 게임에 없는 히어로 중 랜덤 선택 |
| **필요 컴포넌트** | Hero 카드, Round Order 토큰, 16장 Basic Action 카드 |
| **초기 크리스탈** | Hero 카드 하단의 3색 점에 해당하는 크리스탈 각 1개 (예: Goldyx → 초록, 초록, 파랑) |
| **실제 플레이어 크리스탈** | 없음 (다른 캐릭터는 크리스탈 없이 시작) |

### 17.2 Dummy Player의 Deed 덱

- 셔플 후 준비

### 17.3 Dummy Player의 턴

#### Deed 덱이 비었을 때
- **End of Round 선언** → 다른 플레이어에게 1턴씩 더

#### Deed 덱이 비지 않았을 때
1. Deed 덱에서 **3장 뒤집기** → discard 더미에 배치
2. 마지막 뒤집힌 카드(discard 더미 맨 위)의 **색상** 확인
3. **해당 색상 크리스탈이 Inventory에 없으면** → 턴 종료
4. **해당 색상 크리스탈이 있으면** → 해당 색상 카드를 추가로 뒤집기 계속
   - 크리스탈이 있는 한 같은 색상이 나올 때마다 계속 뒤집기
   - Deed 덱에 카드가 부족하면 End of Round 선언

### 17.4 라운드 준비 시 Dummy Player 처리

| 단계 | Dummy Player 처리 |
|------|------------------|
| AA 오퍼에서 최하위 카드 제거 | 해당 카드를 Dummy Player의 Deed 덱에 추가, 셔플 |
| Spell 오퍼에서 최하위 카드 제거 | Spell 덱 바닥에 배치. 추가로 해당 Spell과 같은 색상 크리스탈을 Dummy Player Inventory에 추가 (3개 초과 가능) |

### 17.5 Skill in Solo Game

- Dummy Player의 Hero에 해당하는 10개 Skill 토큰도 사용
- 셔플 후 Dummy Player Hero 카드 옆에 뒤집어 놓기
- 플레이어가 Skill 토큰 획득할 때마다 Dummy Player Skill 1개도 공개 → Common Skill 오퍼에 배치
- Common Skill에서 스킬 선택 시 최하위 AA 카드를 가져가야 함

### 17.6 주요 참고사항

- Dummy Player는 **이동하지 않음**, **전투하지 않음**, **맵에 존재하지 않음**
- 단지 **게임 템포 조절** 역할 (라운드 종료 타이밍)
- Dummy Player의 덱 소진 속도를 모니터링하여 자신의 플레이 속도 조절

---

## 18. 적 토큰 능력 레퍼런스

### 18.1 방어 능력 (Defensive)

| 능력 | 효과 |
|------|------|
| **Fortified** | Ranged & Siege Attack Phase에서 Siege Attack만 가능. 요새 방어 시 적용 시 공격 자체 불가 |
| **Physical Resistance** | 모든 물리 공격 (sideways 카드 포함) 반감 |
| **Fire Resistance** | 모든 Fire 공격 반감. Red 카드/red mana Unit 능력의 비공격 효과 무시 |
| **Ice Resistance** | 모든 Ice 공격 반감. Blue 카드/blue mana Unit 능력의 비공격 효과 무시 |
| **Fire + Ice Resistance** | Cold Fire 공격에도 저항 |

### 18.2 공격 능력 (Offensive)

| 능력 | 효과 |
|------|------|
| **Fire Attack** | Block 시 Ice 또는 Cold Fire Block만 효율적 (나머지 반감) |
| **Ice Attack** | Block 시 Fire 또는 Cold Fire Block만 효율적 (나머지 반감) |
| **Cold Fire Attack** | Block 시 Cold Fire Block만 효율적 (나머지 반감) |
| **Summon Attack** | Block Phase 시작 시 랜덤 갈색 적 토큰 추가. 소환 몬스터가 교체 |
| **Swift** | Block 시 Attack 값 2배 필요 |
| **Brutal** | Block되지 않으면 데미지 2배 |
| **Poison** | 유닛 Wound 시 Wound 카드 2장. Hero Wound 시 각 Wound당 discard 더미에 1장 추가 |
| **Paralyze** | 유닛 Wound 시 즉시 파괴. Hero Wound 시 핸드의 non-Wound 카드 모두 버리기 |

### 18.3 유닛 저항 (Unit Resistances)

| 유닛 저항 | vs 적 전투 | vs 플레이어 전투 |
|---------|---------|-------------|
| **Physical Resistance** | 물리 공격 + 물리 적 공격에 덜 취약 | 물리 공격에 덜 취약 |
| **Fire Resistance** | Fire 공격에 덜 취약. Red 카드/red mana 비공격 효과 무시 | 저항 원소 포함 공격 시 상대가 2배 데미지 필요 |
| **Ice Resistance** | Ice 공격에 덜 취약. Blue 카드/blue mana 비공격 효과 무시 | (위와 동일) |
| **Fire + Ice Resistance** | Cold Fire 공격에도 저항 | (위와 동일) |

---

## 19. 스코어링

### 19.1 기본 스코어링 (Solo Conquest)

**기본 점수** = 플레이어 Fame

**Achievements 스코어링** (표준):

| 카테고리 | 점수 |
|---------|------|
| 정복한 도시 | 10점 / 도시 |
| 모든 도시 정복 | 추가 15점 |
| 라운드 한도보다 일찍 종료 | 남은 라운드당 30점 |
| Dummy Player Deed 덱 잔여 카드 | 뒤집히지 않은 카드당 1점 |
| 마지막 라운드 End of Round 미선언 | 추가 5점 |

> 타이틀은 솔로에서 수여되지 않음

### 19.2 Scoring 카드 (도시 면)

| 항목 | 점수 |
|------|------|
| 정복한 도시 (leader) | 10점 |
| 모든 도시 정복 | 15점 |
| 라운드 전 종료 | 라운드당 30점 |

---

## 20. 앱 구현 시 필요한 외부 데이터

이 룰 문서에 포함되지 않았지만 앱 구현에 **필수적**인 데이터:

### 20.1 카드 데이터

| 카드 유형 | 필요 데이터 | 수량 |
|---------|----------|------|
| Basic Action | 이름, 색상, basic/strong effect, 카드 이미지 | 캐릭터당 16장 (4종 히어로) |
| Advanced Action | 이름, 색상, basic/strong effect, 카드 이미지 | ~28장 |
| Spell | 이름, 색상, basic/strong effect, 카드 이미지 | ~20장 |
| Artifact | 이름, basic/strong effect, 카드 이미지 | ~12장 |
| Wound | 카드 이미지 | 무제한 |

### 20.2 적 토큰 데이터

| 적 유형 | 필요 데이터 |
|--------|----------|
| 모든 적 토큰 (7가지 색상/유형) | 이름, Armor, Attack 값, 특수 능력, Fame 보상 |

### 20.3 타일 데이터

| 타일 유형 | 필요 데이터 |
|---------|----------|
| Countryside (11장) | 헥스 레이아웃, 각 칸의 지형/장소 |
| Core (5+ 장) | 헥스 레이아웃, 각 칸의 지형/장소, 도시 위치 |
| Starting Tile A/B | 헥스 레이아웃 |

### 20.4 Site Description 데이터

| 장소 | 필요 데이터 |
|------|----------|
| Village, Monastery, Keep, Mage Tower, Dungeon, Tomb, Ruins, Monster Den, Spawning Grounds, Mine, Magical Glade, City | 상호작용 옵션, 적 배치, 보상 |

### 20.5 히어로 데이터

| 항목 | 필요 데이터 |
|------|----------|
| 4종 히어로 | 이름, 고유 Basic Action 카드 16장, 초기 스탯, 스킬 토큰 10개 |

### 20.6 Tactic 카드 데이터

| 유형 | 필요 데이터 |
|------|----------|
| Day Tactics (6장) | 이름, 번호, 효과 |
| Night Tactics (6장) | 이름, 번호, 효과 |

### 20.7 Skill 토큰 데이터

| 히어로 | 필요 데이터 |
|--------|----------|
| 각 히어로 10개 | 이름, 유형 (1회/지속/매턴), 효과 설명 |

---

## 부록: Day/Night 차이 요약

| 항목 | Day | Night |
|------|-----|-------|
| **Gold Mana** | 아무 기본 색상으로 사용 가능 | 사용 불가 |
| **Black Mana** | 사용 불가 | 일부 효과 파워업 |
| **Forest 이동 비용** | 3 | 5 |
| **Desert 이동 비용** | 5 | 3 |
| **Spell Strong Effect** | 해당 색상 + Black Mana | 해당 색상만으로 가능 |
| **Action Strong Effect** | 해당 색상 마나 | 해당 색상 + Black Mana |

---

## 부록: 전투 흐름 다이어그램

```
전투 시작
│
├─ 적 토큰 공개/배치
│
├─ Phase 1: RANGED & SIEGE ATTACK
│   ├─ 공격 선언 (대상 선택)
│   ├─ Ranged/Siege Attack 카드/효과 합산
│   ├─ 적 저항 확인 → 비효율 공격 반감
│   ├─ 총 Attack ≥ 총 Armor → 적 제거 + Fame
│   └─ 여러 공격 가능 (각각 별도 열)
│
├─ Phase 2: BLOCK
│   ├─ 살아있는 적 각각에 대해:
│   │   ├─ Block 카드/효과 합산
│   │   ├─ Block 유형 효율 확인
│   │   ├─ 총 Block ≥ 적 Attack → 성공 (적 옆으로)
│   │   └─ 총 Block < 적 Attack → 실패 (Block 무효)
│   └─ Summon: 갈색 적 추가 드로우
│
├─ Phase 3: ASSIGN DAMAGE
│   ├─ Block 안 된 적마다:
│   │   ├─ 적 Attack 값 = 데미지 (Brutal이면 x2)
│   │   ├─ Unwounded Unit에 할당 → Wound + Armor 감소
│   │   ├─ Hero에 할당 → Wound 카드 + Armor 감소
│   │   └─ Poison/Paralyze 특수 처리
│   └─ 모든 데미지 반드시 할당
│
├─ Phase 4: ATTACK
│   ├─ 모든 유형 Attack 가능 (Fortification 무시)
│   ├─ 적 저항 확인
│   ├─ 총 Attack ≥ Armor → 적 제거 + Fame
│   └─ Block된 적도 이 단계에서 제거 가능
│
└─ 전투 종료 → 결과 처리
```

---

*문서 버전: 1.0*
*기반 자료: Mage Knight Board Game Rulebook (영문 원본, 19페이지 + Scenario Book)*
*마지막 업데이트: 2026-02-18*
