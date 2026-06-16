# Mage Knight — 룰 구현 스펙 (AI 구현용)

> **목적**: RULES_STRUCTURED.md를 기반으로 각 룰을 독립적으로 구현 가능한 단위(Unit)로 분해하고,
> 각 단위마다 **입력/출력/상태 변화/엣지케이스/검증 조건**을 명시한다.
> AI가 이 문서만 보고 게임 엔진을 구현할 수 있어야 한다.

---

## 용어 정의

| 용어 | 의미 |
|------|------|
| **Pure Mana** | Source에서 가져오거나 효과로 얻은 일회성 마나. 턴 종료 시 소멸 |
| **Crystal** | Inventory에 저장된 영구 마나. 기본 색상만 가능, 각 최대 3개 |
| **Sideways** | 카드를 옆으로 플레이하여 Move/Influence/Attack/Block 1을 얻는 것 |
| **Fortified** | 요새화 상태. Ranged/Siege Phase에서 Siege만 가능 |
| **Rampaging** | 맵 위에 표시된 적. 도전하거나 인접 이동 시 도발됨 |
| **Deed Deck** | 플레이어의 개인 카드 덱 (Basic Action + 획득한 AA/Spell/Artifact + Wound) |
| **Offer** | 공용 구매/획득 가능 카드 풀 (AA 오퍼, Spell 오퍼, Unit 오퍼) |

---

## UNIT-01: 마나 시스템

### 01-A: Source 다이스 풀 생성

**시점**: 게임 시작, 라운드 시작 시
**입력**: 플레이어 수(솔로=1), 다이스 개수 = 플레이어 수 + 2
**로직**:
1. `diceCount = playerCount + 2` 개의 다이스를 굴린다
2. 각 다이스는 6면: red, blue, green, white, gold, black
3. 기본 색상(red, blue, green, white) 다이스가 **전체의 절반 이상**인지 확인
4. 조건 불충족 → gold + black 다이스만 전부 다시 굴림
5. 조건 충족할 때까지 반복

**엣지케이스**:
- **EC-01-A-1**: 무한루프 방지. 재굴림 10회 초과 시 강제로 gold/black을 기본 색상으로 변환
- **EC-01-A-2**: 다이스 0개인 경우는 없음 (최소 playerCount=1 → 3개)
- **EC-01-A-3**: "절반 이상" = `Math.ceil(diceCount / 2)` 이상이 기본 색상

**출력**: `ManaDie[]` (각 die에 color, isInSource=true)

---

### 01-B: Source에서 다이스 가져오기

**시점**: 플레이어 턴 중 아무 때나 (턴당 1회)
**입력**: 선택한 다이스 ID
**로직**:
1. `sourceDieTakenThisTurn === false` 확인
2. 선택한 다이스가 Source에 있는지 확인 (`isInSource === true`)
3. 다이스를 Source에서 제거 → 플레이어 영역으로 이동
4. 해당 색상의 Pure Mana 토큰 생성
5. `sourceDieTakenThisTurn = true`

**엣지케이스**:
- **EC-01-B-1**: 가져온 후 "사용하지 않기로" 할 수 없음. 가져오면 반드시 소비해야 함 → UI에서 확인 다이얼로그
- **EC-01-B-2**: Gold 다이스 → Day에만 가져올 수 있음. Night에는 Gold가 Source에 있어도 선택 불가
- **EC-01-B-3**: Black 다이스 → Night에만 가져올 수 있음. Day에는 Black이 Source에 있어도 선택 불가
- **EC-01-B-4**: Tactic 카드 "Mana Steal"에 의해 다이스가 이미 가져가진 경우 선택 불가
- **EC-01-B-5**: 일부 스킬/효과로 턴당 2개 이상 가져오는 경우 있음 → 해당 효과가 `sourceDieTakenThisTurn` 제한을 무시하는지 체크

---

### 01-C: Gold Mana 사용

**시점**: Day 라운드에서만
**로직**: Gold Mana는 아무 기본 색상(red/blue/green/white)을 대체
**엣지케이스**:
- **EC-01-C-1**: Night에는 Gold Mana 사용 불가. Source에 Gold 다이스가 있어도 가져갈 수 없음
- **EC-01-C-2**: Gold Mana로 Crystal을 만들 수 없음 (Gold Crystal은 존재하지 않음)
- **EC-01-C-3**: Gold Mana는 "any basic color" 요구 시에만 대체. "specifically red" 같은 효과에도 대체 가능 (원문: "substituted for any basic color")
- **EC-01-C-4**: Gold 마나 1개로 strong effect를 위한 색상 마나를 대체할 수 있지만, 추가로 필요한 다른 마나까지 대체하진 않음

---

### 01-D: Black Mana 사용

**시점**: Night 라운드에서만
**로직**:
- Night에 Action 카드 Strong Effect를 사용하려면: 해당 색상 마나 + Black 마나 1개
- Night에 Spell 카드는 해당 색상 마나만으로 Strong Effect 가능 (Black 불필요)
- Black Mana 자체로 기본 색상을 대체하지 **않음**

**엣지케이스**:
- **EC-01-D-1**: Day에는 Black Mana 사용 불가
- **EC-01-D-2**: Black Mana로 Crystal을 만들 수 없음
- **EC-01-D-3**: "powered by black mana"인 효과가 별도로 존재 (일부 Spell의 야간 보너스)
- **EC-01-D-4**: Black Mana를 Gold Mana로 대체 불가 (Night에 Gold 없음, Day에 Black 없음 → 자연스레 상호배타)

---

### 01-E: Crystal 관리

**입력**: 색상, 동작(추가/사용)
**로직**:
- Crystal은 Inventory에 영구 저장 (턴 종료에도 유지)
- 기본 4색만 가능, 각 색상 최대 3개
- Crystal → Pure Mana 변환: 아무 때나 가능
- Pure Mana → Crystal 변환: **불가** (특정 효과가 명시하지 않는 한)

**엣지케이스**:
- **EC-01-E-1**: "Gain a crystal" 효과 시 해당 색상이 이미 3개 → Crystal 대신 해당 색상 Pure Mana 토큰으로 대체
- **EC-01-E-2**: 랜덤 크리스탈 획득(전투 보상) 시 다이스 굴림 → black=1 Fame 대신, gold=색상 선택
- **EC-01-E-3**: Crystal Mine에서 턴 종료 시 해당 색상 Crystal 1개 획득 (이미 3개면 무효)
- **EC-01-E-4**: Crystal을 Pure Mana로 변환 후 사용하지 않으면 턴 종료 시 소멸 (Crystal로 되돌아가지 않음)

---

### 01-F: 턴 종료 시 마나 정리

**시점**: 턴 종료
**로직**:
1. 사용한 마나 다이스를 다시 굴려 Source에 반환 (가장 먼저)
2. 플레이 영역의 미사용 Pure Mana 토큰 → Bank 반환 (소멸)
3. Crystal은 유지

**엣지케이스**:
- **EC-01-F-1**: 다이스 반환 시 새로 굴린 결과가 즉시 Source에 반영 → 다음 플레이어(더미)가 이를 사용할 수 없음 (솔로에서는 무관)
- **EC-01-F-2**: 효과로 얻은 마나 토큰(Source 외)도 턴 종료 시 소멸

---

## UNIT-02: 카드 시스템

### 02-A: 카드 플레이 — Action 카드 (Basic/Advanced)

**입력**: 카드 ID, 선택한 효과(basic/strong), 마나 (있다면)
**로직**:
- **Action 카드 Basic**: 마나 불필요, 그냥 플레이
- **Action 카드 Strong**: 카드 색상 마나 1개 소비 (낮/밤 무관, Black 불필요. 골드는 낮에만 색 대체)
- **Spell Basic**: 카드 색상 마나 1개 (골드는 낮에만)
- **Spell Strong**: 카드 색상 마나 1개 + Black 1개, **밤 전용** (낮엔 불가)
- ※ 룰북: Black 마나 추가 요구는 **Spell Strong에만** 해당. Action 카드는 밤에도 색 마나만.

**엣지케이스**:
- **EC-02-A-1**: 다색 카드 (color가 배열). Strong effect에 필요한 마나 색상은 배열 중 하나를 선택
- **EC-02-A-2**: Strong effect 사용 시 마나 소비 시점은 카드 플레이 시. 이후에 마나를 추가로 붙일 수 없음
- **EC-02-A-3**: Gold Mana로 해당 색상 마나를 대체 가능 (Day만)
- **EC-02-A-4**: 마나가 부족하면 Strong effect 선택 자체가 불가

---

### 02-B: 카드 플레이 — Spell 카드

**입력**: 카드 ID, 선택한 효과(basic/strong), 마나
**로직**:
- **Basic Effect (Day)**: 카드 색상 마나 1개 소비
- **Basic Effect (Night)**: 카드 색상 마나 1개 소비
- **Strong Effect (Day)**: 카드 색상 마나 1개 + Black 마나 1개 → **Day에 Black 없으므로 Day에 Strong Spell 불가**
- **Strong Effect (Night)**: 카드 색상 마나 1개만으로 가능

**엣지케이스**:
- **EC-02-B-1**: Spell은 마나 없이 플레이 불가 (Basic도 마나 필요). 마나 없으면 Sideways로만 사용 가능
- **EC-02-B-2**: Day에 Spell Strong Effect를 쓰려면 해당 색상 마나 + Black 마나 → Day에 Black 사용 불가이므로 **Day에 Spell Strong은 절대 불가**
- **EC-02-B-3**: Night에 해당 색상 마나 1개만으로 Strong Effect 사용 가능 (Black 불필요)
- **EC-02-B-4**: ENERGY FLOW / ENERGY STEAL Spell의 두 효과는 Healing 이펙트 (Special이 아님) → 전투 중 사용 불가
- **EC-02-B-5**: 다색 Spell의 경우 색상 중 하나로 마나 비용 지불

---

### 02-C: 카드 플레이 — Artifact 카드

**입력**: 카드 ID, 선택한 효과(basic/strong)
**로직**:
- **Basic Effect**: 마나 불필요, 그냥 플레이 → discard 더미
- **Strong Effect**: 카드를 **게임에서 제거**(thrown away)하여 사용

**엣지케이스**:
- **EC-02-C-1**: Strong Effect 사용 시 카드가 영구 제거됨. discard로 가지 않음
- **EC-02-C-2**: Artifact는 마나로 파워업하지 않음 (Action/Spell과 다름)
- **EC-02-C-3**: Banner Artifact는 유닛에 부착하는 특수 Artifact. 부착 중에는 유닛의 basic effect만 사용 가능

---

### 02-D: Wound 카드

**로직**: Wound 카드는 **절대** 플레이할 수 없음
**엣지케이스**:
- **EC-02-D-1**: Sideways로도 플레이 불가
- **EC-02-D-2**: 자발적으로 버리기(discard) 불가 (효과가 명시하지 않는 한)
- **EC-02-D-3**: Healing 효과로만 제거 가능 (핸드 → Wound 더미)
- **EC-02-D-4**: Resting 시에만 예외적으로 discard 가능 (Standard Rest/Slow Recovery)
- **EC-02-D-5**: Wound가 discard 더미에 있으면 다음 라운드에 드로우될 수 있음 → 핸드에 Wound가 쌓이는 원인
- **EC-02-D-6**: "throw away a Wound"는 Wound를 Wound 더미로 반환 (게임에서 완전 제거)
- **EC-02-D-7**: Wound 카드는 고유 ID 필요 (`wound_1`, `wound_2` 등) — 같은 턴에 여러 장 받을 수 있음

---

### 02-E: Sideways 플레이

**입력**: 카드 ID, 선택한 효과(move/influence/attack/block)
**로직**: non-Wound 카드를 옆으로 플레이 → Move 1, Influence 1, Attack 1, Block 1 중 택 1

**엣지케이스**:
- **EC-02-E-1**: Ranged Attack, Siege Attack으로는 사용 **불가**
- **EC-02-E-2**: 원소 공격(Fire/Ice/Cold Fire Attack)으로는 사용 **불가** → 항상 Physical
- **EC-02-E-3**: 원소 방어(Fire/Ice/Cold Fire Block)으로도 사용 **불가** → 항상 Physical Block
- **EC-02-E-4**: Wound 카드는 Sideways 플레이 불가
- **EC-02-E-5**: Attack 1은 Phase 4(Melee Attack)에서만 유효. Phase 1(Ranged/Siege)에서 Sideways Attack 불가
- **EC-02-E-6**: Block은 Physical Block으로 처리됨

---

### 02-F: 카드 효과 누적

**로직**: 같은 유형의 효과를 제공하는 여러 카드를 합산
**엣지케이스**:
- **EC-02-F-1**: Move 효과 합산: "Move 2" 카드 + Sideways "Move 1" = Move 3
- **EC-02-F-2**: Attack 합산: "Attack 3" + "Attack 2" = 5 Attack → 하나의 적에 대해 적용
- **EC-02-F-3**: 다른 효과는 합산 불가. "Move 2" + "Attack 3"을 하나로 합산하는 것은 불가
- **EC-02-F-4**: 단, **하나의 공격 선언** 내에서 여러 카드의 Attack을 합산하는 것은 가능
- **EC-02-F-5**: Ranged Attack과 Siege Attack은 같은 Phase에서 합산 가능 (비 Fortified 적에 대해)
- **EC-02-F-6**: Ranged Attack과 일반 Attack을 Phase 1에서 합산하는 것은 불가 (일반 Attack은 Phase 4 전용)

---

### 02-G: Discard vs Throw Away

**로직**:
- **Discard**: 카드 → Discard 더미 (라운드 종료 시 Deed 덱에 셔플됨)
- **Throw Away**: 카드 → 게임에서 영구 제거. Wound면 Wound 더미로 반환

**엣지케이스**:
- **EC-02-G-1**: Wound는 일반적으로 discard 불가
- **EC-02-G-2**: "throw away a card from hand" 효과에 Wound 포함 가능 → Wound는 Wound 더미로
- **EC-02-G-3**: Artifact Strong Effect = throw away. 해당 Artifact가 덱에서 영구 제거
- **EC-02-G-4**: throw away된 non-Wound 카드는 어떤 더미에도 가지 않음 → 완전 소멸

---

## UNIT-03: 턴 구조

### 03-A: 턴 시작 조건 판정

**입력**: 핸드 카드 목록, Deed 덱 잔여 카드 수, endOfRoundDeclared 상태
**로직**:
```
IF 핸드 비어있음 AND Deed 덱 비어있음:
    → 반드시 End of Round 선언
ELIF Deed 덱 비어있음 AND 핸드에 카드 있음:
    → End of Round 선언 또는 플레이 선택
ELIF endOfRoundDeclared 이미 true:
    → 더 이상 플레이 불가 (오류 상태)
ELSE:
    → 정상 플레이
```

**엣지케이스**:
- **EC-03-A-1**: 핸드에 Wound만 있는 경우: 플레이 가능한 카드가 없지만, Wound도 "카드"이므로 핸드가 비어있지 않음 → Resting(Slow Recovery) 선택 가능
- **EC-03-A-2**: Deed 덱이 비었지만 핸드에 Wound만 있으면 End of Round 선언 가능 (또는 Slow Recovery)
- **EC-03-A-3**: End of Round 선언은 **턴 시작 시**에만 가능. 턴 중간에 선언 불가

---

### 03-B: Regular Turn

**로직**:
```
1. [선택적] 이동 (Movement)
   └ 이동 중 타일 공개 가능
2. [선택적] 액션 (Action)
   └ 전투 / 주민 상호작용 / 탐험 / PvP / 아무것도 안 함
```

**제약사항**:
- 이동은 반드시 액션 **전에** 완료
- 최소 1장의 카드를 플레이하거나 버려야 함

**엣지케이스**:
- **EC-03-B-1**: 이동과 액션 둘 다 안 하려면 → 최소 1장 카드 버리기 필요
- **EC-03-B-2**: 핸드가 비어있고 Deed 덱에 카드 있으면 → 아무것도 안 하고 턴 종료 가능 (카드 0장 사용)
- **EC-03-B-3**: 이동 후 정복되지 않은 요새에 도착하면 → 액션이 **필수** (수비대와 전투)
- **EC-03-B-4**: 이동 중 rampaging enemy 도발 → 이동 즉시 종료 + 전투 필수
- **EC-03-B-5**: 한 턴에 이동 + 전투 후 추가 이동은 불가 (이동은 액션 전에 끝남)
- **EC-03-B-6**: Special 이펙트(⚡)는 턴 중 아무 때나 사용 가능 (이동 중, 전투 중 포함)
- **EC-03-B-7**: Healing 이펙트(💚)는 전투 중 사용 불가. 그 외 아무 때나 가능

---

### 03-C: Resting

**입력**: 핸드 카드 목록
**로직**:
```
IF 핸드에 non-Wound 카드 1장 이상:
    → Standard Rest: non-Wound 1장 + Wound 원하는 만큼 → discard 더미
ELIF 핸드에 Wound만 있음:
    → Slow Recovery: 핸드 전체 공개 → Wound 1장만 → discard 더미
```

**엣지케이스**:
- **EC-03-C-1**: Standard Rest에서 non-Wound는 **정확히 1장** 버려야 함 (0장 또는 2장 이상 불가)
- **EC-03-C-2**: Standard Rest에서 Wound는 0장 이상 자유롭게 버릴 수 있음
- **EC-03-C-3**: Resting 중에도 Healing/Special 이펙트 사용 가능 (Resting 전후에)
- **EC-03-C-4**: Resting 시 이동 불가, 전투 불가, 상호작용 불가
- **EC-03-C-5**: discard된 Wound는 discard 더미에 놓임 → **다음 라운드 덱에 섞임** (완전 제거 아님)
- **EC-03-C-6**: Resting도 "최소 1장 카드 플레이/버리기" 조건을 충족함

---

### 03-D: 턴 종료 처리

**시점**: 액션 완료 후
**로직** (순서 중요):
1. 마나 다이스 반환 (Source에 다시 굴려 넣기)
2. Forced Withdrawal 체크
3. Play Area 정리 (마나 토큰 → Bank, 플레이 카드 → discard)
4. 장소 혜택 (Magical Glade: Wound throw away, Crystal Mine: Crystal 획득)
5. 전투 보상 처리 (있는 경우)
6. 레벨업 체크 (Fame 트랙)
7. 카드 드로우 (핸드 → Hand Limit까지)

**엣지케이스**:
- **EC-03-D-1**: Forced Withdrawal — 안전하지 않은 칸에서 턴 종료 시 안전한 칸으로 역추적. 역추적하는 칸마다 Wound 1장
- **EC-03-D-2**: 안전한 칸 = 적이 없고 + 다른 Hero가 없고 + 접근 가능한 칸
- **EC-03-D-3**: 장소 혜택은 **최종 위치**에서 적용 (Forced Withdrawal로 이동한 후의 위치)
- **EC-03-D-4**: Magical Glade에서 Wound throw away = discard 더미나 핸드의 Wound 1장을 Wound 더미로 반환
- **EC-03-D-5**: 카드 드로우 전에 non-Wound 카드 자발적 버리기 가능
- **EC-03-D-6**: 전체 턴에서 카드를 하나도 플레이/버리지 않았으면 → **최소 1장 버려야** 함 (드로우 전)
- **EC-03-D-7**: Deed 덱이 드로우 중 소진 → 멈춤. discard 더미를 셔플하지 않음 (Night Tactic "Long Night" 제외)
- **EC-03-D-8**: Hand Limit 보너스: keep 위/인접 → 소유한 keep 수만큼 +, 정복된 city 위/인접 → Shield 1+ 이면 +1, Leader이면 +2. keep과 city 보너스가 동시이면 **높은 쪽만**
- **EC-03-D-9**: 레벨업이 여러 번 발생할 수 있음 (한 턴에 여러 Fame 획득 시)

---

## UNIT-04: 라운드 구조

### 04-A: 라운드 준비

**시점**: 라운드 시작 (첫 라운드 제외)
**로직** (순서 중요):
1. Day/Night 보드 뒤집기
2. Source 리셋 (모든 다이스 재굴림, 01-A 조건 적용)
3. Unit 오퍼 갱신: 기존 Unit → 덱 밑, AA 있으면 AA 덱 밑 → 새 Unit 배치
4. AA 오퍼 갱신: 최하위 카드 제거(덱 밑) → 나머지 한 칸씩 아래 → 새 카드 상위 추가
5. Spell 오퍼 갱신: AA 오퍼와 동일 방식
6. Tactic 카드 수거 + 새 Tactic 공개
7. 각 플레이어 준비: 스킬/유닛 Ready, Deed 덱 셔플(discard → 덱에 합쳐서), Hand Limit까지 드로우

**엣지케이스**:
- **EC-04-A-1**: AA 오퍼 갱신 시 "최하위 카드"를 Dummy Player가 가져감 (솔로 시나리오)
- **EC-04-A-2**: Spell 오퍼 갱신 시 "최하위 카드"는 Spell 덱 밑으로 + 해당 Spell 색상 Crystal을 Dummy Player에게 추가
- **EC-04-A-3**: Unit 오퍼에 Core 타일 공개 이전에는 Regular만. Core 공개 후에는 Regular/Elite 교대
- **EC-04-A-4**: 덱 셔플 시 discard 더미의 Wound도 포함됨 → 다음 라운드에 Wound가 드로우될 수 있음
- **EC-04-A-5**: monastery가 맵에 있으면 monastery당 AA 카드 1장을 Unit 오퍼에 추가
- **EC-04-A-6**: 7단계 모두 순서대로 처리. Unit 오퍼 갱신 전에 Source를 리셋

---

### 04-B: Tactic 카드 선택

**시점**: 라운드 준비 후
**로직** (솔로):
1. Dummy Player가 먼저 랜덤 1장 선택
2. 나머지에서 플레이어가 1장 선택
3. Tactic 카드의 숫자로 Round Order 결정 (낮은 숫자 = 먼저)

**엣지케이스**:
- **EC-04-B-1**: 솔로 정복 시나리오: 사용된 Tactic 2장 모두 **게임에서 제거** (각 Tactic은 정확히 1번만 사용)
- **EC-04-B-2**: Tactic 카드 효과에 따라 라운드 중 특수 규칙 적용 (예: "Long Night", "Mana Steal" 등)
- **EC-04-B-3**: 같은 숫자의 Tactic이 나올 수 없음 (각 번호가 유일)
- **EC-04-B-4**: Dummy Player의 Tactic 효과는 적용되지 않음 (번호만 사용)

---

### 04-C: End of Round

**시점**: 모든 플레이어가 End of Round 선언 후
**로직**:
1. 한 플레이어가 End of Round 선언 → 다른 모든 플레이어에게 **1턴씩** 추가
2. 모든 플레이어 End of Round 후 라운드 종료
3. 시나리오 종료 조건 확인

**엣지케이스**:
- **EC-04-C-1**: 솔로에서 Dummy Player가 먼저 End of Round → 실제 플레이어에게 1턴 추가
- **EC-04-C-2**: 실제 플레이어가 먼저 End of Round → Dummy Player 턴 반복 (Deed 덱 빌 때까지)
- **EC-04-C-3**: Dummy Player는 Deed 덱이 비면 자동 End of Round
- **EC-04-C-4**: End of Round 선언 후에는 해당 플레이어 턴이 더 이상 없음
- **EC-04-C-5**: 마지막 라운드가 아닌 경우 다음 라운드로 진행

---

## UNIT-05: 이동 시스템

### 05-A: 기본 이동

**입력**: Move 포인트 총합, 현재 위치, 목표 칸
**로직**:
1. Move 효과를 제공하는 카드/스킬/유닛 합산 → Move 포인트
2. 각 칸 진입 시 해당 지형의 이동 비용 차감
3. 비용이 남아있는 한 계속 이동 가능

**지형 비용표**:

| 지형 | Day | Night |
|------|-----|-------|
| Plains | 2 | 2 |
| Hills | 3 | 3 |
| Forest | 3 | 5 |
| Wasteland | 4 | 4 |
| Desert | 5 | 3 |
| Swamp | 5 | 5 |
| Lake/Sea | ∞ (진입불가) | ∞ |
| Mountain | ∞ (진입불가) | ∞ |

**엣지케이스**:
- **EC-05-A-1**: 이동 비용이 0으로 감소된 지형은 무료 진입
- **EC-05-A-2**: 진입 불가 지형은 **특수 효과**가 허용하지 않는 한 절대 진입 불가
- **EC-05-A-3**: 이동 중 추가 카드 플레이 가능 (Move 포인트 추가)
- **EC-05-A-4**: 새 타일 공개 후에도 추가 이동 카드 플레이 가능
- **EC-05-A-5**: **이전에 플레이한 카드에 마나를 추가하여 Strong Effect로 업그레이드 불가** (카드 플레이 시점에 결정)
- **EC-05-A-6**: 이동 비용은 **진입하는 칸**의 지형으로 결정 (출발 칸 아님)

---

### 05-B: 이동 제한 — Rampaging Enemy

**로직**:
- rampaging enemy가 있는 칸에 진입하려면 → 해당 적을 먼저 격파해야 함
- rampaging enemy에 **인접한 칸에서 다른 인접 칸으로 이동** 시 → 도발(provoke) → 이동 즉시 종료 + 전투

**엣지케이스**:
- **EC-05-B-1**: "인접 이동"만 도발 유발. 해당 칸에서 **출발**하는 것은 도발이 아님
- **EC-05-B-2**: Leap(한 번에 여러 칸 이동) 효과는 중간 칸을 무시 → 도발 안 함
- **EC-05-B-3**: rampaging enemy 칸에 직접 도전(challenge)은 선택 액션으로 가능
- **EC-05-B-4**: 여러 rampaging enemy에 동시 도발될 경우 → 모든 도발된 적과 **한 전투**로 처리
- **EC-05-B-5**: 도발로 인해 이동이 중단된 위치에서 턴을 마침 (해당 위치로 이동 완료)

---

### 05-C: 이동 제한 — 요새화 장소 진입

**로직**: 정복되지 않은 keep, mage tower, city에 진입 시
- 이동 **즉시 종료**
- 수비대와 **필수 전투** (assault)
- city assault 시 Reputation -1

**엣지케이스**:
- **EC-05-C-1**: 이미 정복된 요새는 자유 진입 가능
- **EC-05-C-2**: 요새 진입 시 남은 Move 포인트는 소멸
- **EC-05-C-3**: 본인이 소유한 keep은 정복된 것으로 취급 → 자유 진입 + 상호작용

---

### 05-D: 타일 공개 (Reveal)

**입력**: 현재 위치, 인접 빈 공간, Move 포인트
**로직**:
1. 인접 빈 공간에 타일 배치 가능한 칸을 점유
2. Move 포인트 2 소비
3. Tile 덱 상단에서 타일 가져옴
4. 타일 방향 고정 (모서리 심볼 기준)

**엣지케이스**:
- **EC-05-D-1**: 타일 배치 가능 위치가 2개 이상이면 → 공개 **전에** 위치 선언
- **EC-05-D-2**: Countryside 타일: 최소 2개 다른 타일에 인접해야 함 (또는 그런 타일에 인접)
- **EC-05-D-3**: Core 타일: 최소 2개 다른 타일에 인접해야 함
- **EC-05-D-4**: 해안선 뒤에는 타일 배치 불가
- **EC-05-D-5**: Tile 덱이 비었으면 타일 공개 불가
- **EC-05-D-6**: 타일 공개 후 새 타일의 적/장소가 즉시 활성화
- **EC-05-D-7**: 타일 공개는 이동의 일부. 타일 공개 후 계속 이동 가능

---

## UNIT-06: 주민 상호작용

### 06-A: Influence 계산

**입력**: 플레이한 Influence 카드/효과, Reputation 위치, City Shield 토큰
**로직**:
1. Influence 효과 합산
2. Reputation 보정 적용 (트랙 위치에 따른 +/- 값)
3. 정복된 city에서 Shield 토큰당 +1

**엣지케이스**:
- **EC-06-A-1**: Reputation 트랙 X 칸 → **상호작용 자체가 불가**
- **EC-06-A-2**: Reputation 보정과 Shield 보너스는 **턴당 1번만** 적용
- **EC-06-A-3**: 음수 Reputation → Influence 총합이 음수가 될 수 있음 → 구매 불가
- **EC-06-A-4**: 같은 턴에 여러 구매 가능 (Influence가 충분하면)
- **EC-06-A-5**: 사용하지 않은 Influence는 소멸 (저장 불가)

---

### 06-B: 장소별 구매

| 장소 | 구매 항목 | 비용 | 특이사항 |
|------|----------|------|---------|
| Village | Healing | 3 Influence = 1 Healing | |
| Monastery | Healing | 2 Influence = 1 Healing | |
| Monastery | AA 학습 | 6 Influence | Unit 오퍼에서 AA 카드 선택 |
| Mage Tower | Spell 학습 | 7 Influence + 같은 색상 마나 | Spell 오퍼에서 선택 |
| Keep (소유) | Site Description 참조 | 다양 | |
| Red City | Artifact | 12 Influence 각 | 턴 종료 시 Artifact 덱에서 드로우 |
| Blue City | Spell | Mage Tower와 동일 | |
| White City | 모든 유형 Unit | 일반 비용 | 2 Influence 추가 시 Elite 1장 오퍼 추가 |
| Green City | AA 카드 | 6 Influence | AA 오퍼 또는 AA 덱 탑 랜덤 |

**엣지케이스**:
- **EC-06-B-1**: Mage Tower에서 Spell 학습 시 같은 색상 마나 1개 **추가 소비** (Influence 외에)
- **EC-06-B-2**: Monastery에서 AA 학습 시 **Unit 오퍼**에서 AA 카드를 선택 (AA 오퍼가 아님!)
- **EC-06-B-3**: White City에서 모든 유형 Unit 모집 가능 (일반적으로는 장소 유형에 맞는 유닛만)
- **EC-06-B-4**: Red City의 Artifact: 턴 종료 시 수량+1장 드로우, 1장은 덱 밑으로
- **EC-06-B-5**: Unit 오퍼에서 가져간 카드는 다음 **라운드** 시작까지 보충되지 않음
- **EC-06-B-6**: 같은 턴에 같은 종류 여러 번 구매 가능 (Influence 충분하면)
- **EC-06-B-7**: 정복되지 않은 city에서는 상호작용 불가 (전투만 가능)

---

### 06-C: Unit 모집

**입력**: Unit 오퍼, Influence 포인트, 현재 장소, Command 토큰
**로직**:
1. Unit 오퍼에서 유닛 선택
2. 유닛 비용 ≤ Influence 포인트 확인
3. 유닛 모집 유형(아이콘)이 현재 장소에서 허용되는 유형과 일치 확인
4. Command 토큰 여유 확인 (없으면 기존 유닛 해산)
5. 새 유닛 = Ready & non-Wounded

**엣지케이스**:
- **EC-06-C-1**: Command 토큰 0개 남아있으면 → 기존 유닛 1개 해산 필수
- **EC-06-C-2**: 해산된 유닛은 게임에서 제거 (해당 유닛 카드는 Unit 덱 밑으로)
- **EC-06-C-3**: Wounded 유닛도 해산 가능
- **EC-06-C-4**: Banner가 부착된 유닛 해산 시 Banner는 discard 더미로
- **EC-06-C-5**: Elite 유닛은 Core 타일 공개 후에만 Unit 오퍼에 등장
- **EC-06-C-6**: 모집된 유닛은 즉시 활성화 가능 (같은 턴에)

---

## UNIT-07: 전투 시스템

### 07-A: 전투 개시

**입력**: 전투 원인, 적 토큰 목록, 장소 유형
**로직**:
1. 적 토큰을 EnemyInstance로 변환
2. 요새화 사이트 보너스 적용
3. City 보너스 적용 (있는 경우)
4. CombatState 생성, phase = 'ranged_siege'

**엣지케이스**:
- **EC-07-A-1**: 요새(keep/mage tower/city) 적은 기본적으로 Fortified
- **EC-07-A-2**: 적 자체가 fortified 능력 + 요새 사이트 → **Double Fortified** (Phase 1에서 Ranged/Siege 모두 불가)
- **EC-07-A-3**: City 보너스 (07-F 참조)가 적에게 적용
- **EC-07-A-4**: 모험 장소(dungeon, tomb 등)의 적은 비공개 → 전투 시작 시 공개
- **EC-07-A-5**: monastery 소각 시 → Reputation -3 + 랜덤 보라 적 토큰 드로우

---

### 07-B: Phase 1 — Ranged & Siege Attack

**입력**: 공격 선언 (대상 적, 공격값, 원소, siege 여부)
**로직**:
1. 공격 대상 선택
2. Ranged/Siege Attack 효과 합산
3. Fortified 적 → Siege만 가능
4. Double Fortified → 공격 불가
5. 저항 체크 → 비효율 공격 반감 (`Math.floor(value / 2)`)
6. 총 Attack ≥ 적 Armor → 적 제거, Fame 획득

**엣지케이스**:
- **EC-07-B-1**: Sideways 카드는 Ranged/Siege Attack에 **사용 불가**
- **EC-07-B-2**: 여러 공격 선언 가능 (각각 별도 열)
- **EC-07-B-3**: 하나의 공격에 Ranged + Siege 합산 가능 (non-fortified 적 대상)
- **EC-07-B-4**: Fortified 적에게 Ranged Attack은 효과 없음 → Siege만
- **EC-07-B-5**: 저항에 의한 반감 = `Math.floor()` (내림)
- **EC-07-B-6**: Cold Fire Attack → Fire **그리고** Ice 저항 **모두** 있는 적에게만 반감
- **EC-07-B-7**: 패스(공격 안 함) 가능 → 바로 Phase 2로

---

### 07-C: Phase 2 — Block

**입력**: Block 선언 (대상 적, Block 값, Block 원소)
**로직**:
1. 살아있고 Block되지 않은 적 각각에 대해 Block 시도
2. Block 유형 효율 계산
3. Swift 적 → Block 필요값 2배
4. Block ≥ 필요값 → 성공 (적 isBlocked = true)
5. Block < 필요값 → **완전 실패** (부분 차단 없음)

**Block 효율표**:

| 적 Attack Type | 효율적 Block | 비효율적 Block (반감) |
|---------------|-------------|-------------------|
| Physical/Normal | 모든 Block | - |
| Fire | Ice, Cold Fire | Physical, Fire (반감) |
| Ice | Fire, Cold Fire | Physical, Ice (반감) |
| Cold Fire | Cold Fire만 | 나머지 전부 (반감) |

**엣지케이스**:
- **EC-07-C-1**: Block은 **적 1개씩** 개별 처리. 여러 적을 한 번에 Block 불가
- **EC-07-C-2**: Block 실패 시 사용한 카드/효과 **모두 낭비** (전체 공격이 그대로 통과)
- **EC-07-C-3**: 성공적으로 Block된 적은 Phase 3에서 데미지를 주지 않음
- **EC-07-C-4**: Block된 적은 Phase 4에서 제거 기회 있음
- **EC-07-C-5**: **Summon 능력**: Block Phase **시작 시** 갈색 적 토큰 랜덤 드로우하여 추가
- **EC-07-C-6**: Summon으로 추가된 적도 Block/Attack 대상이 됨
- **EC-07-C-7**: Sideways Block은 Physical Block으로 처리 → Fire/Ice 적 공격에 대해 반감

---

### 07-D: Phase 3 — Assign Damage

**입력**: Block되지 않은 적 목록, 유닛 목록, Hero Armor
**로직**:
1. 각 미Block 적의 Attack = 데미지 (Brutal이면 2배)
2. 모든 데미지를 **반드시** 할당해야 함
3. 할당 대상: Unwounded Unit 또는 Hero

**유닛에 할당**:
- 1 포인트 이상의 데미지로 유닛 Wound 가능
- 유닛 Armor만큼 데미지 흡수
- 이미 Wounded 유닛에는 할당 불가

**Hero에 할당**:
- Hero Armor만큼 데미지 흡수
- `ceil(damage / armor)` 장의 Wound 카드

**엣지케이스**:
- **EC-07-D-1**: Poison → 유닛 Wound 시 Wound 카드 2장 (1장 대신). Hero Wound 시 각 Wound당 discard에 1장 추가
- **EC-07-D-2**: Paralyze → 유닛 Wound 시 즉시 파괴 (게임에서 제거). Hero Wound 시 핸드의 non-Wound 전부 버리기
- **EC-07-D-3**: Brutal → Block 안 되면 데미지 2배. Block 시도 실패해도 2배 적용
- **EC-07-D-4**: 유닛에 1 데미지만 할당해도 Wound 됨 (Armor만큼 추가 흡수는 보너스)
- **EC-07-D-5**: 유닛 저항이 해당 원소와 일치하면 → Armor로 한 번 감소 (Wound 없이) + 남으면 Wound 후 다시 Armor 감소 → 2배 흡수
- **EC-07-D-6**: **Knock Out** — 핸드 Wound 수 ≥ Hand Limit → 핸드의 non-Wound 전부 버리기
- **EC-07-D-7**: Knock Out 상태에서도: 유닛 활성화, 스킬 사용, 추가 Wound 수용 가능
- **EC-07-D-8**: 여러 적의 데미지를 자유롭게 분배 가능 (순서는 플레이어 선택)
- **EC-07-D-9**: 데미지 할당 시 남은 데미지가 있으면 반드시 Hero에게 (유닛이 다 Wounded이면)
- **EC-07-D-10**: Poison의 discard 효과: Hero가 Wound 카드 1장 받을 때마다 핸드에서 non-Wound 1장을 **추가로** discard 더미에 버림

---

### 07-E: Phase 4 — Melee Attack

**입력**: 공격 선언 (대상 적, 공격값, 원소)
**로직**:
1. 모든 유형의 Attack 사용 가능 (Ranged, Siege, 일반 구분 없음)
2. **Fortification 무시** — 이 단계에서 모든 적 공격 가능
3. Sideways 카드 = Physical Attack 1 (사용 가능)
4. 저항 체크 → 비효율 공격 반감
5. 총 Attack ≥ 적 Armor → 적 제거 + Fame

**엣지케이스**:
- **EC-07-E-1**: Phase 1에서 사용하지 않은 Ranged/Siege 카드도 Phase 4에서 사용 가능
- **EC-07-E-2**: Block된 적(Phase 2에서 성공적으로 Block)도 Phase 4에서 공격하여 제거 가능
- **EC-07-E-3**: 적을 제거하지 못해도 전투는 종료됨 → 살아남은 적은 그 자리에 그대로
- **EC-07-E-4**: 여러 공격 선언 가능 (Phase 1과 동일)
- **EC-07-E-5**: Sideways Physical Attack 1은 Physical Resistance 적에게 반감 → 0 (floor(1/2))

---

### 07-F: City 보너스

| 도시 색상 | 보너스 | 구현 |
|---------|-------|----|
| White | 모든 수비자 +1 Armor | `currentArmor += 1` |
| Blue | Ice/Fire Attack 수비자 +2 Attack, Cold Fire +1 Attack | attackType 기반 조건부 |
| Red | 물리 Attack 수비자에게 Brutal | `attackType === 'normal'` → abilities에 'brutal' 추가 |
| Green | 물리 Attack 수비자에게 Poison | `attackType === 'normal'` → abilities에 'poison' 추가 |

**엣지케이스**:
- **EC-07-F-1**: City 보너스는 **해당 city의 수비자에게만** 적용 (다른 전투에는 무관)
- **EC-07-F-2**: 이미 Brutal/Poison이 있는 적에게 중복 추가되지 않음
- **EC-07-F-3**: Red City의 Brutal은 **물리 공격 수비자**에게만. Fire/Ice 공격 적에게는 적용 안 됨
- **EC-07-F-4**: Blue City 보너스: attackType이 'cold_fire'인 적에게 +1 Attack (Fire/Ice는 +2)
- **EC-07-F-5**: City assault 시 Reputation -1 (전투 시작 시)

---

### 07-G: 전투 보상

**시점**: 전투 종료 후 (턴 종료 처리 중)
**로직**: 장소/상황에 따라 보상 결정

| 장소 | 보상 |
|------|------|
| Dungeon | Artifact 1개 |
| Tomb | Artifact 1개 + Spell 1개 |
| Ancient Ruins | Artifact 1개 또는 Spell 1개 (선택) |
| Monster Den | 랜덤 (Crystal/Unit/Fame) |
| Spawning Grounds | Crystal 2개 |
| Keep/Mage Tower | 점령 (소유권 획득) |
| City | 점령 + Shield 토큰 |
| Rampaging Enemy | 제거된 적의 Fame만 |
| Monastery 소각 | 없음 (Reputation -3만) |

**엣지케이스**:
- **EC-07-G-1**: Artifact 보상: 수량+1장 드로우, 1장을 덱 밑에, 나머지 Deed 덱 위에
- **EC-07-G-2**: Spell 보상: Spell 오퍼에서 선택 → Deed 덱 위에 + 오퍼 보충
- **EC-07-G-3**: Unit 보상: Unit 오퍼에서 **아무 유닛** (유형/비용 무관, Influence 불필요)
- **EC-07-G-4**: Crystal 보상(랜덤): 다이스 굴림 → black=1 Fame, gold=색상 선택, 기본색=해당 Crystal
- **EC-07-G-5**: Crystal 이미 3개면 해당 색상 Crystal 획득 무효 (다시 굴리지 않음)
- **EC-07-G-6**: 전투에서 지더라도 제거한 적에 대한 Fame은 유지

---

## UNIT-08: 유닛 시스템

### 08-A: 유닛 상태 관리

**상태 전이**:
```
Ready (healthy) ─── 활성화 ──→ Spent
       │                          │
       │─── 데미지 ──→ Wounded    │─── 데미지 ──→ Wounded
                         │                         │
                         │                         │
              Healing(level만큼) → Ready     Healing → Ready(Spent)

라운드 시작 → 모든 유닛 Ready (Wounded는 유지)
```

**엣지케이스**:
- **EC-08-A-1**: Wounded 유닛은 활성화 불가 + 데미지 할당 불가
- **EC-08-A-2**: Spent + Wounded 유닛은 라운드 시작 시 Ready가 되지만 여전히 Wounded
- **EC-08-A-3**: 유닛 Healing = 유닛 Level만큼 Healing 포인트 필요
- **EC-08-A-4**: Poison으로 Wound 2장 받은 유닛: 2배 Healing 필요
- **EC-08-A-5**: "Ready a Unit" 효과: Spent → Ready. 같은 턴에 재활성화 가능
- **EC-08-A-6**: Paralyze로 Wounded → 즉시 파괴 (게임에서 제거)

---

### 08-B: 유닛 활성화

**입력**: 유닛 인스턴스, 선택한 능력
**로직**:
1. Ready & non-Wounded 확인
2. 카드 플레이와 동일하게 취급 (효과 합산 가능)
3. 일부 능력은 마나로 파워업 필요
4. 활성화 후 → Spent

**엣지케이스**:
- **EC-08-B-1**: Banner 부착 유닛은 basic effect만 사용 가능 (strong 불가)
- **EC-08-B-2**: 유닛 능력을 다른 카드/유닛 효과와 합산 가능
- **EC-08-B-3**: 한 턴에 같은 유닛을 2번 활성화하려면 → "Ready a Unit" 효과 필요

---

## UNIT-09: 스킬 시스템

### 09-A: 스킬 획득

**시점**: 짝수 Fame 레벨 도달 시 (레벨업 시)
**로직**:
1. 자기 Skill 더미에서 2개 공개
2. **선택 A**: 1개 가져감 + 나머지 Common Skills로 + AA 오퍼에서 **아무** 카드 1장
3. **선택 B**: Common Skills에서 1개 가져감 + 공개 2개를 Common Skills로 + AA 오퍼 **최하위** 카드

**엣지케이스**:
- **EC-09-A-1**: Common Skills가 비어있으면 선택 B 불가
- **EC-09-A-2**: Skill 더미가 비어있으면 스킬 획득 스킵 (AA 카드만 획득)
- **EC-09-A-3**: 솔로에서 Dummy Player Skill도 공개 → Common Skills에 배치
- **EC-09-A-4**: Common Skills에서 가져오면 AA 오퍼 **최하위**(가장 안 좋은 위치) 카드만

---

### 09-B: 스킬 유형별 사용

| 유형 | 사용 제한 | 리셋 |
|------|----------|------|
| 1회/라운드 | 사용 후 뒤집기 | 라운드 시작 시 복구 |
| 1회/라운드+지속 | 사용 후 공개 배치. 다음 턴 시작까지 효과 지속 | 라운드 시작 시 복구 |
| 매 턴 | 제한 없음 | - |

**엣지케이스**:
- **EC-09-B-1**: "1회/라운드" 스킬을 이미 사용했으면 같은 라운드에 재사용 불가
- **EC-09-B-2**: "지속" 스킬은 다음 **턴 시작**까지 효과 유지 (같은 라운드 내)
- **EC-09-B-3**: Interactive Skill은 솔로에서 제거 (게임 시작 시)

---

## UNIT-10: 레벨업 시스템

### 10-A: Fame 트랙 & 레벨업

**입력**: 현재 Fame, 획득 Fame
**로직**:
1. Fame 트랙에서 현재 위치 + 획득 Fame으로 이동
2. 중간에 레벨 경계를 넘으면 레벨업 발생
3. 레벨업은 **턴 종료 시** 처리

**레벨업 유형** (교대):
- 홀수 레벨: Command 토큰 획득 + 새 Armor/Hand Limit
- 짝수 레벨: Skill + Advanced Action

**엣지케이스**:
- **EC-10-A-1**: 한 턴에 여러 레벨업 가능 (많은 Fame 획득 시) → 순서대로 처리
- **EC-10-A-2**: Level 토큰 더미가 비면 더 이상 Armor/Hand Limit 변화 없음
- **EC-10-A-3**: 제거된 Level 토큰을 뒤집어 Command 토큰으로 사용
- **EC-10-A-4**: 레벨업 시 얻은 AA 카드는 Deed 덱 위에 배치 (즉시 사용 불가, 다음 드로우 시)

---

## UNIT-11: Dummy Player (솔로)

### 11-A: Dummy Player 턴

**로직**:
```
IF (턴 시작 시) Deed 덱 비어있음:
    → End of Round 선언
ELSE:
    1. 3장 뒤집기 → discard (모자라면 가능한 만큼만)
    2. 맨 위(마지막) 카드 색상 C 확인 — 단 한 번만
    3. Crystal[C]개 만큼 추가로 뒤집기
       · Crystal은 소모하지 않음 (라운드 내 템포 카운터)
       · 추가로 뒤집힌 카드의 색상은 무관 (캐스케이드 없음)
    4. 덱이 도중에 비어도 이번 턴엔 End of Round 선언 안 함
       → 다음 턴(덱 비어있음)에 선언
```

**엣지케이스**:
- **EC-11-A-1**: 뒤집기 도중 Deed 덱 소진 → 이번 턴엔 가능한 만큼만 뒤집고, **다음 턴**에 End of Round 선언 (룰북: "flip as many as you can. On his next turn... announces End of the Round")
- **EC-11-A-2**: Crystal이 3개 초과 가능 (Spell 오퍼 갱신으로 추가됨)
- **EC-11-A-3**: Dummy Player는 이동/전투/상호작용 없음 (순수 템포 역할)
- **EC-11-A-4**: Dummy Player의 Deed 덱에 AA 카드 추가됨 (라운드 준비 시)

---

### 11-B: Dummy Player 라운드 준비

**로직**:
1. AA 오퍼 최하위 카드 → Dummy Player Deed 덱에 추가 + 셔플
2. Spell 오퍼 최하위 카드 → Spell 덱 밑으로 + 해당 Spell 색상 Crystal을 Dummy Inventory에 추가

**엣지케이스**:
- **EC-11-B-1**: Dummy Player의 Crystal은 색상당 3개 제한 없음 (초과 가능)
- **EC-11-B-2**: Dummy Player의 discard 더미도 라운드 시작 시 덱에 셔플됨
- **EC-11-B-3**: Dummy Player Hero의 Skill 토큰도 플레이어 레벨업 시 공개 → Common Skills에 배치

---

## UNIT-12: 시나리오 — Solo Conquest

### 12-A: 셋업

| 항목 | 값 |
|------|---|
| 라운드 수 | 6 (Day 3 + Night 3) |
| 맵 형태 | Wedge |
| Countryside 타일 | 7장 |
| Core 도시 타일 | 2장 |
| Core 비도시 타일 | 2장 |
| 첫 번째 도시 레벨 | 5 |
| 두 번째 도시 레벨 | 8 |

**엣지케이스**:
- **EC-12-A-1**: 경쟁 Spell 4장 제거 (id 17-20)
- **EC-12-A-2**: 플레이어 Skill 덱에서 interactive Skill 1장 제거
- **EC-12-A-3**: 도시 레벨 = 수비 적 토큰 수. Level 5 → 5개 적 토큰
- **EC-12-A-4**: Tactic 카드는 각 1번만 사용 → 게임에서 제거

---

### 12-B: 종료 조건

**로직**:
```
IF 모든 도시 정복:
    → 현재 플레이어에게 마지막 1턴 (Dummy 제외)
    → 게임 종료
ELIF 6라운드 완료:
    → 게임 종료
```

**엣지케이스**:
- **EC-12-B-1**: 도시 정복은 전투 종료 시점에 판정 → 같은 턴에 마지막 턴 1번 추가
- **EC-12-B-2**: 실패해도 스코어링 가능

---

### 12-C: 스코어링

| 카테고리 | 점수 |
|---------|------|
| 기본 Fame | 현재 Fame |
| 정복 도시 | 10점/도시 |
| 모든 도시 정복 | 추가 15점 |
| 조기 종료 | 남은 라운드당 30점 |
| Dummy 잔여 카드 | 뒤집히지 않은 카드당 1점 |
| 마지막 라운드 EoR 미선언 | 추가 5점 |

---

## UNIT-13: 적 능력 상세 구현

### 13-A: 방어 능력

| 능력 | 구현 로직 |
|------|----------|
| Fortified | Phase 1에서 Siege만 허용. isFortifield=true |
| Physical Resistance | 물리 Attack → `Math.floor(value/2)` |
| Fire Resistance | Fire Attack → `Math.floor(value/2)`. Red 카드 비공격 효과 무시 |
| Ice Resistance | Ice Attack → `Math.floor(value/2)`. Blue 카드 비공격 효과 무시 |
| Fire+Ice Resistance | Cold Fire도 반감 |

**엣지케이스**:
- **EC-13-A-1**: Fire Resistance가 있는 적에 대한 Red 카드의 **비공격** 효과(예: Red로 Move 감소)는 무시됨
- **EC-13-A-2**: Cold Fire Resistance는 Fire **그리고** Ice 둘 다 있어야 발동
- **EC-13-A-3**: Physical Resistance는 Sideways Attack(Physical 1)에도 적용 → 0

---

### 13-B: 공격 능력

| 능력 | 구현 로직 |
|------|----------|
| Swift | Block 시 필요 Block = `attack * 2` |
| Brutal | Block 안 되면 데미지 = `attack * 2` |
| Poison | 유닛 Wound: 카드 2장. Hero Wound: 추가 discard |
| Paralyze | 유닛 Wound: 즉시 파괴. Hero Wound: non-Wound 전체 discard |
| Summon | Block Phase 시작 시 갈색 적 랜덤 추가 |

**엣지케이스**:
- **EC-13-B-1**: Swift + Brutal 조합 가능 → Block 시 2배, 실패 시 데미지 2배
- **EC-13-B-2**: Poison + Paralyze 조합 시 → Paralyze가 우선 (유닛 즉시 파괴)
- **EC-13-B-3**: Summon 적이 소환한 몬스터가 살아있는 동안 소환자를 대상으로 한 효과는 소환된 몬스터에게도 적용
- **EC-13-B-4**: Swift는 Block에만 영향. Attack(제거)에는 영향 없음

---

## UNIT-14: Day/Night 차이 통합 체크리스트

구현 시 Day/Night에 따라 분기해야 하는 모든 항목:

| # | 항목 | Day | Night |
|---|------|-----|-------|
| 1 | Gold Mana | 사용 가능 (아무 기본 색상) | 사용 불가 |
| 2 | Black Mana | 사용 불가 | 사용 가능 |
| 3 | Forest 이동 비용 | 3 | 5 |
| 4 | Desert 이동 비용 | 5 | 3 |
| 5 | Action Strong Effect | 해당 색상 마나 | 해당 색상 + Black 마나 |
| 6 | Spell Basic Effect | 해당 색상 마나 | 해당 색상 마나 |
| 7 | Spell Strong Effect | 해당 색상 + Black (=불가) | 해당 색상만 |
| 8 | Source 다이스 제한 | Gold 선택 가능, Black 불가 | Black 선택 가능, Gold 불가 |
| 9 | Tactic 카드 세트 | Day Tactics | Night Tactics |
| 10 | Unit 오퍼 교체 전략 | Regular 위주 | Core 공개 시 Elite 교대 |

---

## 구현 우선순위

1. **UNIT-01** (마나) → 모든 카드 사용의 기반
2. **UNIT-02** (카드) → 게임의 핵심 메커니즘
3. **UNIT-03** (턴) → 게임 흐름 제어
4. **UNIT-05** (이동) → 맵 탐험
5. **UNIT-07** (전투) → 가장 복잡, 가장 많은 엣지케이스
6. **UNIT-06** (상호작용) → 전투 외 액션
7. **UNIT-08** (유닛) → 전투 보조
8. **UNIT-09** (스킬) → 추가 능력
9. **UNIT-10** (레벨업) → 성장
10. **UNIT-04** (라운드) → 전체 흐름
11. **UNIT-11** (Dummy) → 솔로 전용
12. **UNIT-12** (시나리오) → 승리 조건
13. **UNIT-13** (적 능력) → 전투 디테일
14. **UNIT-14** (Day/Night) → 전 영역 관통

---

## 구현 상태 체크리스트

> 마지막 검증: 2026-03-17
> 테스트 파일: `tests/engine/rules-spec-validation.test.ts` (34/34 통과)
> 추가 테스트: `card-play-validation.test.ts` (48), `skill-manager.test.ts` (39), `bugfix-validation.test.ts` (24)
> 전체 엔진 테스트: **807/807 통과** (TypeScript 타입 체크 통과)

### UNIT-01: 마나 시스템

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 01-A: Source 다이스 풀 생성 | [v] | [v] | `ManaPool.initializeSource` — 절반 이상 기본색 검증, 무한루프 방지 |
| 01-B: Source에서 다이스 가져오기 | [v] | [v] | **BUG FIX**: Day/Night에 따른 Gold/Black 제한 추가, 턴당 1회 제한 추가 |
| EC-01-B-1: 턴당 1회 제한 | [v] | [v] | `sourceDieTakenThisTurn` 체크 추가 |
| EC-01-B-2: Gold는 Day만 | [v] | [v] | `takeDieFromSource`에 dayNight 파라미터 추가 |
| EC-01-B-3: Black는 Night만 | [v] | [v] | 동일 |
| 01-C: Gold Mana 사용 | [v] | [v] | `canUseManaColor`에서 Gold → Day만 대체 |
| 01-D: Black Mana 사용 | [v] | [v] | **BUG FIX**: Black이 기본색 대체하던 버그 제거. `hasBlackMana`/`spendBlackMana` 추가 |
| 01-E: Crystal 관리 | [v] | [v] | **BUG FIX**: Crystal 3개 꽉 차면 Pure Mana 토큰으로 대체 |
| 01-F: 턴 종료 시 마나 정리 | [v] | [v] | `resetTurnState` — 다이스 반환+재굴림, 마나 토큰 제거, Crystal 유지 |

### UNIT-02: 카드 시스템

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 02-A: Action 카드 플레이 | [v] | [v] | `CardEffectResolver` — basic/strong 분기 |
| 02-B: Spell 카드 플레이 | [v] | [v] | `CardPlayValidator.validateCardPlay` — Day Strong 불가, Night Strong 가능 (48 tests) |
| 02-C: Artifact 카드 플레이 | [v] | [v] | `CardPlayValidator` — basic=free, strong=throw away |
| 02-D: Wound 카드 | [v] | [v] | **BUG FIX**: `discardFromHand`가 Wound 거부. `discardFromHandForced` 추가 (Resting용) |
| 02-E: Sideways 플레이 | [v] | [v] | `CardPlayValidator.validateSidewaysPlay` — Wound 불가, 원소 불가, Phase 1 Attack 불가 |
| 02-F: 효과 누적 | [v] | [v] | `CardEffectResolver.accumulateResolutions` — 같은 유형 합산, 원소 전파, sideways 지원 (22 tests) |
| 02-G: Discard vs Throw Away | [v] | [v] | `discardFromHand` / `throwAwayCard` 분리 |

### UNIT-03: 턴 구조

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 03-A: 턴 시작 조건 판정 | [v] | [v] | `canDeclareEndOfRound` — must/may 분기 |
| 03-B: Regular Turn | [v] | [v] | 이동→액션 순서, 필수 액션 조건 |
| 03-C: Resting | [v] | [v] | Standard/Slow Recovery 분기 |
| 03-D: 턴 종료 처리 | [v] | [v] | 7단계 순서 처리 |

### UNIT-04: 라운드 구조

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 04-A: 라운드 준비 | [v] | [v] | 7단계 순서 처리, 오퍼 갱신 |
| 04-B: Tactic 카드 선택 | [v] | [v] | **BUG FIX**: Dummy가 랜덤 선택하도록 수정 (이전: 최저번호) |
| 04-C: End of Round | [v] | [v] | Player/Dummy 순서 처리 |

### UNIT-05: 이동 시스템

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 05-A: 기본 이동 | [v] | [v] | `MovementResolver` — 지형 비용, Day/Night 차이 |
| 05-B: Rampaging Enemy 제한 | [v] | [v] | 요새화/rampaging 감지 및 이동 종료 |
| 05-C: 요새화 장소 진입 | [v] | [v] | FORTIFIED_SITES 체크 |
| 05-D: 타일 공개 | [v] | [v] | `canRevealTile` — 테스트 수정 완료 |

### UNIT-06: 주민 상호작용

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 06-A: Influence 계산 | [v] | [v] | **BUG FIX**: City Leader 보너스를 Influence에서 제거 (Hand Limit 전용) |
| 06-B: 장소별 구매 | [v] | [v] | `getAvailableActions` — 장소별 분기 |
| 06-C: Unit 모집 | [v] | [v] | `filterUnitsForSite`, White City 모든 유형 허용 |

### UNIT-07: 전투 시스템

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 07-A: 전투 개시 | [v] | [v] | `initiateCombat` — 요새/City 보너스 적용 |
| 07-B: Phase 1 Ranged/Siege | [v] | [v] | Fortified/Double Fortified, 저항 반감 |
| 07-C: Phase 2 Block | [v] | [v] | 원소 효율, Swift 2배, Summon |
| 07-D: Phase 3 Assign Damage | [v] | [v] | Brutal/Poison/Paralyze, Knock Out |
| 07-E: Phase 4 Melee Attack | [v] | [v] | Fortification 무시, 모든 Attack 유형 |
| 07-F: City 보너스 | [v] | [v] | White/Blue/Red/Green 개별 구현 |
| EC-07-A-2: Double Fortified | [v] | [v] | `isEnemyDoubleFortified` — fortified 카운트 |
| EC-07-E-5: Sideways vs Resistance | [v] | [v] | `calculateEffectiveAttack(1, 'physical', ['physical_resistance']) = 0` |
| EC-07-F-3: Red Brutal 물리만 | [v] | [v] | Fire 적에게 Brutal 미적용 확인 |
| EC-07-F-4: Blue ColdFire +1 | [v] | [v] | Cold Fire는 +1, Fire/Ice는 +2 |
| EC-13-A-2: ColdFire 양쪽 저항 필요 | [v] | [v] | Fire만 또는 Ice만으로는 Cold Fire 반감 안 됨 |

### UNIT-08: 유닛 시스템

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 08-A: 유닛 상태 관리 | [v] | [v] | **BUG FIX**: `readyAllUnits` — Wounded도 status='ready'로 전환 (woundCount 유지) |
| 08-B: 유닛 활성화 | [v] | [v] | Ready + woundCount=0 확인 |

### UNIT-09: 스킬 시스템

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 09-A: 스킬 획득 | [v] | [v] | `SkillManager.processSkillAcquisition` — Choice A/B, Common Skills 분기 (39 tests) |
| 09-B: 스킬 유형별 사용 | [v] | [v] | `SkillManager.activateSkill` — once_per_round/turn/passive 제한, 리셋 로직 |

### UNIT-10: 레벨업 시스템

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 10-A: Fame 트랙 & 레벨업 | [v] | [v] | `addFame`, `processLevelUp`, 다중 레벨업 지원 |

### UNIT-11: Dummy Player

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 11-A: Dummy 턴 | [v] | [v] | 3장 뒤집기, Crystal 소비 연쇄, 덱 소진 시 EoR |
| EC-11-A-1: 덱 소진 mid-flip → 다음 턴 End of Round | [v] | [v] | 2장 덱으로 테스트 |
| 11-B: 라운드 준비 | [v] | [v] | AA 카드 추가, Spell Crystal 추가 |
| EC-11-B-1: Crystal 초과 가능 | [v] | [v] | 3개 제한 없음 확인 |

### UNIT-12: 시나리오

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 12-A: 셋업 | [v] | [v] | `ScenarioSetup` |
| 12-B: 종료 조건 | [v] | [v] | `processEndOfRound` |
| 12-C: 스코어링 | [v] | [v] | `calculateSoloConquestScore` — 5개 카테고리 |

### UNIT-13: 적 능력

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| 13-A: 방어 능력 | [v] | [v] | Physical/Fire/Ice/ColdFire 저항 |
| 13-B: 공격 능력 | [v] | [v] | Swift/Brutal/Poison/Paralyze/Summon |

### UNIT-14: Day/Night 차이

| 항목 | 구현 | 테스트 | 비고 |
|------|:----:|:------:|------|
| Gold/Black 마나 제한 | [v] | [v] | Source 선택 + 사용 모두 Day/Night 체크 |
| Forest/Desert 비용 차이 | [v] | [v] | `TERRAIN_MOVE_COST` |
| Spell Strong Day 불가 | [v] | [v] | `CardPlayValidator` — Day에 Spell Strong은 canPlayStrong=false |
| Spell Strong Night = 색+Black | [v] | [v] | `CardPlayValidator` — Spell Strong(밤)에 requiresBlackMana=true. **Action 카드는 색만**(룰북: Black은 Spell 전용) |

---

## 수정 이력

### 2026-06-11: 8차 — Android 패키징 + AdMob 연동

> 검증: 에뮬레이터(API 34) 실기 스모크 — 부팅/메뉴/게임 진입/광고 라이프사이클. 웹 회귀 887 유닛 + 23 E2E 통과

| # | 구현 | 내용 |
|---|------|------|
| 1 | AdMob 네이티브 | `@capacitor-community/admob@8` 설치. `adService` 플랫폼 분기: 네이티브=AdMob(배너/인터스티셜/보상형, 동적 import로 웹 번들 미포함), 웹=AdSense 스텁 유지. **초기화 경합 수정**: `#ensureNative()`가 init 프라미스 대기(이전엔 init 완료 전 loadBanner가 웹 경로로 빠짐) |
| 2 | 광고 ID 체계 | `adConfig.ts` — 기본은 Google 공식 테스트 ID, 실 ID는 `.env`의 `VITE_ADMOB_*`로 무코드 교체. AndroidManifest의 APPLICATION_ID는 테스트 값 + 교체 주석 |
| 3 | 배너 라이프사이클 | 네이티브 배너는 시스템 오버레이 → DOM placeholder 미렌더, 화면 unmount 시 `removeBanner` (게임플레이 중 광고 금지 원칙). 에뮬레이터에서 메뉴 배너 표시→게임 진입 시 제거 확인 |
| 4 | Android 빌드 | Capacitor 8은 JDK 21 필요(시스템 17) → brew openjdk@21 사용. `npm run android:build` 스크립트 추가. 디버그 APK 8.8MB 빌드/설치/실행 검증 |
| 5 | 튜토리얼 캐스케이드 | advanceWhen 충족 스텝을 한 스냅샷 평가로 연속 통과(setStepIdx 내 루프) — 빠른 진행 시 스텝 고착 잔여 케이스 해소 |

**출시 전 교체 체크리스트**: ① AndroidManifest APPLICATION_ID ② `.env.production`의 VITE_ADMOB_* 3종 ③ 서명 키(release build).

---

### 2026-06-11: 7차 — 출시 준비 단계 (세이브/로드·PWA·i18n)

> 검증: 전체 엔진 테스트 **887/887 통과**, E2E **23/23 통과** (save-load.spec 신규), 프로덕션 빌드(`npm run build`) 통과

| # | 구현 | 내용 |
|---|------|------|
| 1 | 세이브/로드 | `restoreGame(state)`로 로드 시 엔진 싱글톤 재구성(Wound id 카운터 복원 포함, RNG는 시드에서 재시작). 턴/라운드 경계마다 IndexedDB 자동저장(튜토리얼·종료 게임 제외), 메인 메뉴 **Continue** 버튼(라운드/낮밤 표시), 인게임 메뉴 **Save & Main Menu**, 게임 종료 시 오토세이브 삭제 |
| 2 | PWA | manifest가 참조하던 PNG 아이콘 8종(72~512px)이 누락 상태였음 → SVG에서 생성. SW(network-first HTML, cache-first 에셋) 등록·활성 확인, 프로덕션 빌드에서 manifest/sw/아이콘 서빙 검증 |
| 3 | i18n | 코드에서 사용 중인데 **세 언어 모두에 누락**돼 defaultValue 폴백으로만 돌던 키 133개를 en/ko/es에 추가(메뉴·코치·레벨업·보상·스킬·상호작용 전반). 프로덕션 빌드에서 한국어 전환 검증 |
| 4 | 타입 정정 | `tsc -b`(빌드 모드)에서만 드러난 타입 오류 4건 수정(removePlay의 usedSkillIndices 누락 등) |
| 5 | QA | save→continue 라운드트립 E2E 신규(상태 동일성+재개 후 플레이 가능 검증), E2E 클릭 스왈로우 재시도 패턴 적용 |

다음 후보: Capacitor Android 패키징(로컬 SDK 필요), 실제 광고 ID 연동(AdSense/AdMob 계정 필요), 효과음.

---

### 2026-06-11: 6차 — 마지막 갭 완료 (Leadership/Bonds/Banner 특수효과)

> 검증: 전체 엔진 테스트 **887/887 통과**, E2E **22/22 통과**

| # | 구현 | 내용 |
|---|------|------|
| 1 | Leadership | 해당 페이즈에서 유닛을 활성화한 뒤 트레이에 Ranged Attack +1(원거리) / Attack +2(멜레) / Block +3(블록) 부스트 등장 (`unit_boost`) |
| 2 | Bonds of Loyalty | 획득 시 Command 토큰 +1(레벨업 스탯 적용에도 유지 — `applyFameGain`이 passive 보너스 합산), 보너스(마지막) 슬롯 모집 시 Influence -5(min 0, UI에 할인 표시) |
| 3 | Banner of Fear | 블록 페이즈에서 부착 유닛을 소비해 적 공격 1개 취소(압도적 블록 99로 모델링) + Fame +1 |
| 4 | Banner of Glory | 부착 유닛이 공격/블록할 때마다 Fame +1 (`bonus_fame`) |
| 5 | Banner of Courage | basic: 라운드 1회 플립으로 부착 유닛 Ready(비전투, 유닛 칩의 Ready↺ 버튼) / strong: 모든 유닛 Ready |
| 6 | Banner of Fortitude | basic: 라운드 1회, 부착 유닛이 부상 받을 때 자동 무효(플립) / strong: 모든 유닛 완전 치료. 플립은 라운드 시작 시 복구 |
| 7 | 튜토리얼 견고성 | 챕터 1 advanceWhen을 단조 조건으로 변경 — 빠른 진행/배치된 업데이트로 페이즈 전환을 놓쳐도 스텝이 멈추지 않음 |

미구현(의도적 보류): Glory/Fear/Protection/Command의 strong 효과(전투 범위 버프/적 공격 무효화 등)는 Strong 버튼이 사유와 함께 비활성화됨(조용한 no-op 방지). Invocation 마나 "즉시 소비" 강제는 토큰이 턴 종료 시 소멸하므로 실효 차이 없음(문서화).

---

### 2026-06-11: 5차 — 잔여 갭 완료 (특수 스킬/Banner/더미 스킬/도시 오퍼)

> 검증: 전체 엔진 테스트 **885/885 통과**, E2E **22/22 통과**

| # | 구현 | 스펙 | 내용 |
|---|------|------|------|
| 1 | 특수 스킬 3종 | UNIT-09-B | Power of Pain(Wound 사이드웨이 +2 — 비전투 Move/Influence + 전투 트레이 Attack/Block, Wound는 플레이 영역 경유 discard), Polarization(마나 토큰 반대색 변환: red↔blue, green↔white, gold↔black), Invocation(Wound 버리고 red/black 마나, 카드 버리고 white/green 마나) |
| 2 | Banner 부착 | EC-02-C-3, EC-08-B-1, EC-06-C-4 | Banner 기본 효과=유닛 부착(핸드에서 제거, 유닛에 보관). 부착 유닛: 아머/공격/방어 보너스 적용(Banner of Glory 등), 마나 파워 능력 사용 불가. 해산 시 Banner는 discard로. 유닛 해산 UI(EC-06-C-1) 추가 |
| 3 | 더미 스킬 공개 | EC-09-A-3 | Norowas 스킬 9종 데이터 신규 작성(`docs/data/heroes/norowas.json`), 더미 스킬덱 초기화, 플레이어 스킬 획득 시 1장 공개→Common Skills(Choice B 풀 형성) |
| 4 | White City Elite | UNIT-06-B | 정복된 White City에서 2 Influence로 Elite 덱 상단 1장을 오퍼에 추가 |
| 5 | 신규 스킬 액션 | — | move_per_ready_unit(Forward March), heal_unit_wound(Inspiration), 전투 스킬의 Day/Night 조건 필터(Day Sharpshooting) |
| 6 | QA 인프라 | — | `?debug` URL 파라미터로 `window.__MK_STATE__` 노출 (E2E 상태 검증용) |

미구현(영향 낮음): Leadership(유닛 부스트)·Bonds of Loyalty(추가 Command)·Banner 특수효과(Fear/Courage/Fortitude 플립 효과)는 효과 텍스트만 표시되고 자동 적용되지 않음. Invocation의 "즉시 소비" 강제 없음(토큰이 풀에 남음).

---

### 2026-06-11: 4차 — 잔여 갭 구현 (스킬 활성화/유닛 힐링/수도원·오퍼 규칙)

> 검증: 전체 엔진 테스트 **882/882 통과**, E2E **22/22 통과**

| # | 구현 | 스펙 | 내용 |
|---|------|------|------|
| 1 | 스킬 활성화 | UNIT-09-B | 비전투: `activateSkill` — move/influence(상호작용 중)/healing/gain_crystal/gain_mana_token(색 선택)/free_unit_activation(스펜트 유닛 Ready, EC-08-A-5). Day/Night 조건 액션 검증. 전투: CombatCardTray에 스킬 행 추가(sourceType 'skill'), 확정 시 SkillManager로 사용 마킹. 사이드바/드로어에 SkillPanel, InteractionPanel에 Influence 스킬 섹션 |
| 2 | 유닛 힐링 | EC-08-A-3/4 | 치료 비용 = 유닛 레벨 × 부상 수(포이즌 2배 자동 반영). 유닛 칩 탭으로 치료 |
| 3 | Monastery AA | EC-06-B-2, EC-04-A-5 | 라운드 준비 시 공개 수도원당 AA 1장을 Unit 오퍼에 추가, 수도원 AA 학습은 Unit 오퍼에서 선택(보충 없음, EC-06-B-5). `purchaseMonasteryAA` 신설 |
| 4 | Unit 오퍼 갱신 | EC-04-A step3, EC-04-A-3 | 롤링 교체 → **전체 교체**로 수정(기존 유닛은 덱 밑, AA는 AA 덱 밑). Core 타일 공개 후 Regular/Elite 교대 배치 |
| 5 | 멜레 공격 유형 | EC-07-E-1 | Phase 4에서 ranged/siege 액션도 사용 가능하도록 필터 수정(이전엔 type==='attack'만 허용) |
| 6 | 도시 상호작용 | UNIT-06-B | 검증 결과 기존 구현 완비 확인(Red=Artifact/Blue=Spell/Green=AA/White=전 유닛) — 변경 없음 |

미구현(다음 후보): wound_as_card·mana_conversion·discard계 스킬 액션, Banner 부착(EC-02-C-3), 더미 스킬 공개(EC-09-A-3 — Norowas 스킬 데이터 부재), White City Elite 추가 오퍼(+2 Influence).

---

### 2026-06-10: 3차 — UI↔엔진 통합 완성 (풀 플레이스루 가능화)

> 검증: 전체 엔진 테스트 **881/881 통과**, E2E **22/22 통과** (전투 승리→레벨업→보상 체인, 튜토리얼 챕터1 완주 포함)
> 신규 테스트: `tests/engine/gameplay-completion.test.ts` (16), `tests/e2e/deep-combat.spec.ts`, `tests/e2e/tutorial-chapter1.spec.ts`

엔진은 완성돼 있었으나 UI에서 호출되지 않아 실제 플레이가 불가능했던 경로를 모두 연결:

| # | 구현 | 스펙 | 내용 |
|---|------|------|------|
| 1 | 레벨업 보상 선택 | UNIT-09-A, UNIT-10 | `PendingLevelUp` 큐 + LevelUpOverlay 재작성. 짝수 레벨: 스킬 2장 공개 → Choice A(공개 스킬+AA 오퍼 아무 카드)/Choice B(Common Skill+AA 최하위). 획득 AA는 Deed 덱 위(EC-10-A-4). 다중 레벨업 시 공개 스킬 비중첩(EC-10-A-1) |
| 2 | 전투 보상 | UNIT-07-G | `PendingReward` 큐 + RewardOverlay 신규. Dungeon/Tomb=Artifact(수량+1 드로우 후 선택, EC-07-G-1), Tomb/보상=Spell 오퍼 선택, Ruins=Artifact/Spell 택1, MonsterDen/SpawningGrounds=크리스탈 다이스(black=+1 Fame, gold=색 선택, EC-07-G-4) |
| 3 | 점령 처리 | UNIT-12-B | keep/mageTower/city 정복 시 owner 설정(이전엔 미설정→keep 상호작용 불가 버그), city Shield 토큰 +1, 전 도시 정복→마지막 1턴→게임 종료 |
| 4 | 턴 종료 장소 혜택 | EC-03-D | Magical Glade(Wound throw away, 핸드 우선), Crystal Mine(크리스탈, 3개 초과 무효 EC-01-E-3), Forced Withdrawal(적 잔존 칸에서 턴 종료 시 턴 시작 위치로 후퇴+Wound, EC-03-D-1) |
| 5 | 카드 플레이 검증 | EC-02-A-4, UNIT-14 | Strong 마나 미지불 시 플레이 거부(이전엔 무료 통과), 야간 Action Strong에 Black 마나 추가 비용 강제, CardPlayValidator를 CardDetail에 연결(Basic/Strong 버튼 활성화+사유 표시) |
| 6 | 힐링 경로 | EC-02-D-3 | healing 효과 → `turn.healingAvailable` 누적 → Heal Wound 버튼(전투 중 비활성, EC-03-B-7) |
| 7 | 램페이징 도발 | UNIT-05-B | 적 hex 진입 시 강제 전투(요새/램페이징), 인접→인접 이동 시 도발 전투(EC-05-B). 모험 장소는 자발적 전투 유지 |
| 8 | 전투 UX 버그 | — | 활성 타겟에 pending attack 없을 때 카드 플레이가 조용히 버려지던 문제 → 자동 attack 생성 (`useCombatCards.autoAssignPlay`) |
| 9 | Rest 규칙 | EC-03-C | 핸드가 전부 Wound면 자동 Slow Recovery (이전엔 휴식 불가 상태에 빠짐) |
| 10 | QA 인프라 | — | `?seed=` URL 파라미터로 결정적 게임 재현 가능 |

**UI/UX (모바일 우선)**: 코치 오버레이 겹침 해소(모바일 풀폭 배치), BottomPanel 컴팩트 마나 바(모바일 전용), 히어로 토큰 이동 보간 애니메이션, 마나 다이스 롤 애니메이션, 게임 이벤트 토스트(Fame/크리스탈/부상/정복), TopBar 스탯 오버플로 스크롤.

---

### 2026-03-17: 2차 스펙 대비 코드 검증 및 버그 수정 (7건)

> 검증: 전체 엔진 테스트 **807/807 통과**, TypeScript 타입 체크 통과
> E2E 테스트: `full-playthrough.spec.ts` — 3라운드 풀 플레이스루 통과 (콘솔 에러 0개)
> 테스트 파일: `tests/engine/bugfix-validation.test.ts` (24개 테스트)

| # | 버그 | 심각도 | 수정 | 테스트 | 설명 |
|---|------|:------:|:----:|:------:|------|
| 1 | Tactic 선택 순서 반대 (UNIT-04-B) | CRITICAL | [v] | [v] | 더미→플레이어 순서 수정 + 충돌 시 더미 재선택 로직 추가 |
| 2 | Units 매 턴 종료시 Ready (UNIT-08-A) | CRITICAL | [v] | [v] | `endTurn`에서 `readyAllUnits` 제거, `processEndOfRound`로 이동 |
| 3 | Skills 리셋 미호출 (UNIT-09-B) | CRITICAL | [v] | [v] | `SkillManager` 연동 추가. `resetSkillsForRound`(라운드), `resetSkillsForTurn`(턴) 호출 |
| 4 | City assault Reputation -1 누락 (EC-07-F-5) | MEDIUM | [v] | [v] | `CombatResolver.initiateCombat`에서 cityColor 시 reputationChange=-1 |
| 5 | Dice 재시도 제한 불일치 (EC-01-A-1) | LOW | [v] | [v] | 100→10회 + 초과시 gold/black→basic 강제변환 |
| 6 | 잘못된 스코어링 함수 사용 (UNIT-12-C) | CRITICAL | [v] | [v] | `calculateFinalScore`→`calculateSoloConquestScore`로 변경 |
| 7 | Tactic 선택 더미-플레이어 충돌 크래시 | CRITICAL | [v] | [v] | 더미가 플레이어 선택과 동일한 택틱 선택 시 throw → 충돌 해소 로직 추가 |

**수정된 파일:**
- `src/engine/ManaPool.ts` — `createAndValidateDice` 재시도 10회 + 강제변환 (EC-01-A-1)
- `src/engine/CombatResolver.ts` — `initiateCombat`에 city assault reputation -1 추가 (EC-07-F-5)
- `src/hooks/useGameEngine.ts` — Tactic 순서 수정(더미 먼저), Units ready 타이밍(라운드 시작), Skills 리셋 연동, Solo Conquest 스코어링 함수 교체

**추가된 테스트:**
- `tests/engine/bugfix-validation.test.ts` — 24개 테스트 (6건 버그 수정 검증)

---

### 2025-03-15: 1차 스펙 대비 코드 검증 및 버그 수정

**수정된 파일 (버그 수정):**
- `src/engine/ManaPool.ts` — takeDieFromSource에 dayNight 파라미터 추가, sourceDieTakenThisTurn 체크, Black 기본색 대체 제거, Crystal 오버플로우→Pure Mana, hasBlackMana/spendBlackMana 추가
- `src/engine/DeckManager.ts` — discardFromHand가 Wound 거부, discardFromHandForced 추가 (Resting용)
- `src/engine/CombatResolver.ts` — processSummons 추가 (Block Phase 시작 시 Summon 자동 트리거)
- `src/engine/UnitManager.ts` — readyAllUnits에서 Wounded도 status='ready' (woundCount 유지)
- `src/engine/DummyPlayer.ts` — selectDummyTactic을 랜덤 선택으로 변경
- `src/engine/TurnManager.ts` — selectTacticForDummy를 랜덤 선택으로 변경
- `src/engine/ReputationManager.ts` — getInteractionInfluence 추가, City Leader 보너스를 Influence에서 제거
- `src/hooks/useGameEngine.ts` — takeDieFromSource에 dayNight 전달, Resting 로직 수정 (Standard: 1 non-wound + wounds, Slow: 1 wound만)

**신규 구현:**
- `src/engine/CardPlayValidator.ts` — 카드 플레이 검증 (Spell/Action/Artifact/Wound/Sideways 규칙 전체)
- `src/engine/SkillManager.ts` — 스킬 시스템 (획득 Choice A/B, 활성화 제한, 라운드/턴 리셋)

**추가된 테스트:**
- `tests/engine/rules-spec-validation.test.ts` — 34개 테스트 (버그 수정 검증 + 엣지케이스)
- `tests/engine/card-play-validation.test.ts` — 48개 테스트 (Spell/Action/Artifact/Sideways 전체)
- `tests/engine/skill-manager.test.ts` — 39개 테스트 (스킬 획득/활성화/리셋)

---

*문서 버전: 1.3*
*기반 자료: RULES_STRUCTURED.md + BGG 공식 FAQ*
*최초 작성: 2025-03-15*
*마지막 업데이트: 2026-03-17 (2차 코드 검증 및 버그 수정 6건)*
