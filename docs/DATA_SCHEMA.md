# Mage Knight Card Data Schema

> 모든 JSON 데이터 파일의 스키마 정의서.
> Base Game + Lost Legion Expansion + Ultimate Edition 포함.
> 카드 세트는 `set: "base" | "expansion" | "ultimate"` 필드로 구분.

---

## 파일 구조

```
docs/data/
  ├── basic_actions.json       # 16장 공통 + 히어로 고유 카드
  ├── advanced_actions.json    # 44장 (28 Base + 12 Expansion + 4 Ultimate)
  ├── spells.json              # 24장 (20 Base + 4 Expansion)
  ├── artifacts.json           # 25장 (16 Base + 8 Expansion + 1 Ultimate)
  ├── units_regular.json       # 15종 28장 Silver (11종 20장 Base + 4종 8장 Expansion)
  ├── units_elite.json         # 15종 28장 Gold (9종 20장 Base + 6종 8장 Expansion)
  ├── enemies.json             # 61종 적 토큰 (6색상: green/grey/violet/brown/red/white)
  ├── tactics.json             # 12장 Day/Night 택틱 카드
  ├── sites.json               # 13종 장소 상호작용 데이터
  ├── tiles.json               # 맵 타일 인벤토리 (Starting + 14 Countryside + 10 Core)
  ├── heroes/
  │   └── arythea.json         # Arythea 히어로: 스탯, 덱, 스킬 10개, 레벨업 테이블
  └── scenarios/
      └── first_recon.json     # First Reconnaissance 시나리오 설정
```

---

## 1. Basic Action Card

```jsonc
{
  "id": 1,                          // 카드 번호
  "name": "Rage",                   // 카드 이름
  "type": "basic_action",           // 카드 유형
  "color": "red",                   // 카드 색상: "red" | "blue" | "green" | "white"
  "basicEffect": {
    "text": "Attack or Block 2",    // 원문 효과 텍스트
    "actions": [                    // 구조화된 효과 배열
      { "type": "attack", "value": 2 },
      { "type": "block", "value": 2 }
    ]
  },
  "strongEffect": {
    "text": "Attack 4",
    "manaCost": "red",              // strong effect 발동에 필요한 마나 색상
    "actions": [
      { "type": "attack", "value": 4 }
    ]
  },
  "copies": 2,                     // 기본 덱에 포함되는 수량
  "heroSpecific": null,            // null이면 공통 카드. 히어로 이름이면 고유 카드
  "replaces": null,                // 고유 카드가 대체하는 공통 카드 이름
  "set": "base"                    // "base" | "expansion" | "ultimate"
}
```

## 2. Advanced Action Card

```jsonc
{
  "id": 1,
  "name": "Fire Bolt",
  "type": "advanced_action",
  "color": "red",                   // 카드 색상: "red" | "blue" | "green" | "white"
                                     // Ultimate Edition 듀얼컬러: ["green", "blue"] 등 배열 가능
  "basicEffect": {
    "text": "Gain a red crystal to your Inventory.",
    "actions": [
      { "type": "gain_crystal", "color": "red" }
    ]
  },
  "strongEffect": {
    "text": "Ranged Fire Attack 3",
    "manaCost": "red",
    "actions": [
      { "type": "ranged_attack", "element": "fire", "value": 3 }
    ]
  },
  "set": "base"
}
```

## 3. Spell Card

Spell은 basic/strong에 각각 다른 이름을 가짐.

```jsonc
{
  "id": 1,
  "name": "Fireball / Firestorm",   // 표시용 통합 이름
  "type": "spell",
  "color": "red",                    // Spell 색상 = 마나 파워 색상
  "basicSpell": {
    "name": "Fireball",
    "text": "Ranged Fire Attack 5.",
    "manaCost": "red",               // basic = 해당 색상 마나 1개
    "actions": [
      { "type": "ranged_attack", "element": "fire", "value": 5 }
    ]
  },
  "strongSpell": {
    "name": "Firestorm",
    "text": "Take a Wound. Siege Fire Attack 8.",
    "manaCost": ["red", "black"],    // strong = 색상 마나 + black (Day), 색상 마나만 (Night)
    "actions": [
      { "type": "take_wound" },
      { "type": "siege_attack", "element": "fire", "value": 8 }
    ]
  },
  "competitive": false,              // true = 솔로에서 제거되는 경쟁 Spell (17-20번)
  "set": "base"
}
```

## 4. Artifact Card

```jsonc
{
  "id": 1,
  "name": "Banner of Glory",
  "type": "artifact",
  "subtype": "banner",               // "banner" | "ring" | "weapon" | "item"
  "basicEffect": {
    "text": "Assign this to a unit you control. The assigned unit gets armor +1 and +1 to any attacks or blocks it makes. Whenever this unit attacks or blocks, fame +1",
    "actions": [
      { "type": "assign_to_unit", "bonus_armor": 1, "bonus_attack": 1, "bonus_block": 1, "bonus_fame": 1 }
    ]
  },
  "strongEffect": {
    "text": "Units you control get armor +1 and +1 to any attacks or blocks they make this turn. Fame +1 for each unit that attacks or blocks this turn.",
    "throwAway": true,                // strong effect 사용 시 게임에서 제거
    "actions": [
      { "type": "all_units_bonus", "bonus_armor": 1, "bonus_attack": 1, "bonus_block": 1, "fame_per_unit": 1 }
    ]
  },
  "set": "base"
}
```

## 5. Unit Card

```jsonc
{
  "id": 1,
  "name": "Peasants",
  "type": "unit",
  "tier": "regular",                 // "regular" (Silver) | "elite" (Gold)
  "level": 1,                        // 유닛 레벨 (1-4)
  "cost": 3,                         // Influence 모집 비용
  "armor": 2,                        // 유닛 Armor
  "recruitSites": ["village"],       // 모집 가능 장소: "village" | "monastery" | "keep" | "mage_tower" | "city" | "glade"
  "abilities": [
    {
      "name": "Attack",
      "text": "Attack 2",
      "manaCost": null,               // 마나 파워 불필요면 null
      "actions": [
        { "type": "attack", "value": 2 }
      ]
    }
  ],
  "resistance": null,                // null | "physical" | "fire" | "ice" | "fire_ice"
                                     // Elite 확장: "physical_fire" | "physical_ice" | "physical_fire_ice"
  "copies": 3,                       // 덱에 포함되는 수량
  "set": "base"
}
```

## 6. Enemy Token

```jsonc
{
  "id": "green_1",
  "name": "Orc Prowlers",
  "tokenColor": "green",             // "green" | "yellow" | "grey" | "violet" | "brown" | "white" | "red"
  "armor": 3,
  "attack": {
    "value": 3,
    "type": "physical",              // "physical" | "fire" | "ice" | "cold_fire"
    "abilities": []                  // ["swift", "brutal", "poison", "paralyze", "summon"]
  },
  "resistances": [],                 // ["physical", "fire", "ice"]
  "fortified": false,
  "fame": 2,                         // 처치 시 Fame 보상
  "copies": 2,                       // 토큰 수량
  "set": "base"
}
```

## 7. Skill Token

```jsonc
{
  "id": 1,
  "name": "Motivation",
  "hero": "Arythea",                 // 소속 히어로
  "skillType": "persistent",         // "once_per_round" | "persistent" | "passive"
  "interactive": false,              // true면 솔로에서 제거
  "text": "On your turn, Ready one of your Units.",
  "actions": [
    { "type": "ready_unit" }
  ],
  "set": "base"
}
```

## 8. Tactic Card

```jsonc
{
  "id": 1,
  "name": "Early Bird",
  "time": "day",                     // "day" | "night"
  "number": 1,                       // Tactic 번호 (턴 순서 결정용)
  "text": "When you take this Tactic, nothing happens to your hand. Play your turn normally...",
  "effect": {
    "description": "No special effect. You play first.",
    "actions": []
  },
  "set": "base"
}
```

---

## Effect Action Types 레퍼런스

| type | 설명 | 주요 파라미터 |
|------|------|------------|
| `move` | 이동 포인트 | `value` |
| `influence` | 영향력 포인트 | `value` |
| `attack` | 물리 공격 | `value` |
| `block` | 물리 방어 | `value` |
| `ranged_attack` | 원거리 공격 | `value`, `element` |
| `siege_attack` | 공성 공격 | `value`, `element` |
| `fire_attack` | 화염 공격 | `value` |
| `ice_attack` | 빙결 공격 | `value` |
| `cold_fire_attack` | 냉화 공격 | `value` |
| `fire_block` | 화염 방어 | `value` |
| `ice_block` | 빙결 방어 | `value` |
| `heal` | 힐링 | `value` |
| `gain_mana` | 마나 획득 | `color` |
| `gain_crystal` | 크리스탈 획득 | `color` |
| `gain_card` | 카드 획득 | `source` |
| `draw_card` | 카드 드로우 | `value` |
| `take_wound` | Wound 받기 | - |
| `throw_away_wound` | Wound 제거 | - |
| `ready_unit` | 유닛 Ready | - |
| `assign_to_unit` | 유닛에 부착 | 보너스들 |
| `special` | 커스텀/복합 효과 | `description` |

---

## 9. Site Location

```jsonc
{
  "id": 1,
  "type": "village",
  "name": "Village",
  "enemyColor": null,
  "isFortified": false,
  "interactions": [
    {
      "type": "heal",
      "description": "Buy 1 Healing for 3 Influence",
      "cost": { "influence": 3 }
    }
  ]
}
```

## 10. Hero Data (heroes/arythea.json)

```jsonc
{
  "hero": {
    "name": "Arythea",
    "startingStats": { "armor": 2, "handLimit": 5, "unitLimit": 1 },
    "startingDeck": { "totalCards": 16, "commonCards": [...], "uniqueCard": {...} },
    "skills": [
      { "id": 1, "name": "Dark Paths", "type": "once_per_turn", "effect": "...", "actions": [...] }
    ],
    "levelProgression": [
      { "level": 1, "fameRequired": 0, "armor": 2, "handLimit": 5, "unitLimit": 1 }
    ]
  }
}
```

## 11. Scenario Data (scenarios/first_recon.json)

```jsonc
{
  "scenario": {
    "name": "First Reconnaissance",
    "rounds": { "total": 3, "pattern": ["day", "night", "day"] },
    "mapSetup": { "startingTile": "A", "countrysideTiles": { "solo": 8 }, "coreTiles": { "city": 1, "nonCity": 2 } },
    "victoryConditions": { "endTrigger": "...", "winner": "..." },
    "specialRules": [...]
  }
}
```

## 12. Map Tiles (tiles.json)

```jsonc
{
  "startingTile": { "id": "start", "sides": ["A", "B"], "hexCount": 7 },
  "countrysideTiles": [
    { "id": 1, "back": "green", "hexCount": 7, "set": "base" }
  ],
  "coreTiles": [
    { "id": 5, "back": "brown", "hexCount": 7, "hasCity": true, "cityColor": "green", "set": "base" }
  ],
  "terrainTypes": [
    { "type": "plains", "moveCostDay": 2, "moveCostNight": 2 }
  ]
}
```

---

*스키마 버전: 1.2*
*마지막 업데이트: 2026-02-19*
*변경 이력: v1.2 — enemies(61종), tactics(12장), sites(13종), tiles, hero/arythea, scenarios/first_recon 추가*
