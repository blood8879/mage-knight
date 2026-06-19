// ─────────────────────────────────────────────────────────────────────────────
// "Learn by Playing" guide content — derived from the First Reconnaissance
// walkthrough (walkthrought.pdf), which itself teaches the rulebook. Each topic
// fires when the matching situation appears during a real game, so the player
// learns the rules in the order they actually encounter them. Nothing here may
// contradict the rulebook — it only explains what the real engine already does.
// ─────────────────────────────────────────────────────────────────────────────

export type GuideLang = 'en' | 'ko' | 'es'

export interface LearnContext {
  round: number
  phase: string
  combatActive: boolean
  interactionActive: boolean
  hasInteractableSite: boolean
  hasEnemyNearby: boolean
  pendingLevelUp: boolean
  pendingReward: boolean
  finalTurnPending: boolean
  movePoints: number
}

interface Localized {
  title: string
  body: string
}

export interface GuideTopic {
  id: string
  /** Lower number = higher priority when several topics could fire at once. */
  priority: number
  trigger: (ctx: LearnContext) => boolean
  text: Record<GuideLang, Localized>
}

export const LEARN_TOPICS: GuideTopic[] = [
  {
    id: 'welcome',
    priority: 0,
    trigger: () => true, // shown first, once
    text: {
      en: {
        title: 'Welcome — Learn by Playing',
        body: 'This is the real First Reconnaissance scenario, with a guide on the side. The game lasts 3 rounds (Day → Night → Day) and ends the moment someone discovers a City tile. Your aim: explore the realm and earn the most Fame. Tips appear as you reach each new situation.',
      },
      ko: {
        title: '환영합니다 — 게임하며 배우기',
        body: '실제 First Reconnaissance 시나리오를 안내와 함께 플레이합니다. 게임은 3라운드(낮 → 밤 → 낮)이며, 누군가 도시 타일을 발견하는 순간 끝납니다. 목표는 왕국을 탐험하며 가장 많은 명성(Fame)을 얻는 것입니다. 새로운 상황마다 설명이 나타납니다.',
      },
      es: {
        title: 'Bienvenido — Aprender Jugando',
        body: 'Este es el escenario real First Reconnaissance, con una guía al lado. La partida dura 3 rondas (Día → Noche → Día) y termina en cuanto alguien descubre una loseta de Ciudad. Tu objetivo: explorar el reino y ganar más Fama. Los consejos aparecen al llegar a cada situación.',
      },
    },
  },
  {
    id: 'tactics',
    priority: 1,
    trigger: (c) => c.phase === 'round_start' || c.phase === 'tactic_selection',
    text: {
      en: {
        title: 'Choose a Tactic',
        body: 'Each round begins by choosing a Tactic card. Its number sets turn order (lower goes first) and it grants a special bonus — some are instant, some once per turn or round. Day Tactics are used in Day rounds, Night Tactics at Night.',
      },
      ko: {
        title: '전략 선택',
        body: '각 라운드는 전략(Tactic) 카드 선택으로 시작합니다. 숫자가 턴 순서를 정하고(낮은 쪽이 먼저), 특수 보너스를 줍니다 — 즉시 발동, 턴당, 라운드당 등 종류가 있습니다. 낮 라운드엔 낮 전략, 밤엔 밤 전략을 씁니다.',
      },
      es: {
        title: 'Elige una Táctica',
        body: 'Cada ronda empieza eligiendo una carta de Táctica. Su número fija el orden de turno (menor va primero) y otorga un bono especial — instantáneo, por turno o por ronda. Las Tácticas de Día se usan en rondas de Día y las de Noche por la Noche.',
      },
    },
  },
  {
    id: 'turn_structure',
    priority: 2,
    trigger: (c) => c.phase === 'player_turn_start',
    text: {
      en: {
        title: 'Your Turn: Move, then Act',
        body: 'A turn has two parts: first Movement, then one Action (combat or interaction). So Move→Act or Act (no move) is fine, but you cannot Act then Move, nor Move→Act→Move. Play cards from your hand for their effect; stack same-type cards to add up (e.g. two Move 2 → Move 4), or play any card sideways for +1 Move/Influence/Attack/Block.',
      },
      ko: {
        title: '당신의 턴: 이동 후 행동',
        body: '턴은 두 부분입니다: 먼저 이동, 그다음 행동 하나(전투 또는 상호작용). 즉 이동→행동, 또는 행동만은 가능하지만, 행동 후 이동이나 이동→행동→이동은 불가합니다. 손의 카드를 효과대로 사용하고, 같은 종류 카드를 쌓아 합산(예: 이동2 ×2 → 이동4)하거나, 아무 카드나 옆으로(sideways) 내면 이동/영향력/공격/방어 +1을 얻습니다.',
      },
      es: {
        title: 'Tu Turno: Mover, luego Actuar',
        body: 'El turno tiene dos partes: primero Movimiento, luego una Acción (combate o interacción). Mover→Actuar o solo Actuar vale, pero no Actuar→Mover ni Mover→Actuar→Mover. Juega cartas por su efecto; apila cartas del mismo tipo para sumar (p. ej. dos Mover 2 → Mover 4), o juega cualquier carta de lado para +1 Mov/Influencia/Ataque/Bloqueo.',
      },
    },
  },
  {
    id: 'movement',
    priority: 3,
    trigger: (c) => c.phase === 'movement' || (c.phase === 'player_turn_start' && c.movePoints > 0),
    text: {
      en: {
        title: 'Movement & Exploration',
        body: 'Each terrain costs Move points (shown on the board; some terrain is harder at Night). Spend points to step into adjacent spaces. At the map edge you may explore: pay 2 Move to place a new tile — and in this scenario placing a tile earns Fame +1. New tiles reveal villages, keeps, ruins and rampaging enemies.',
      },
      ko: {
        title: '이동과 탐험',
        body: '지형마다 이동 비용이 다릅니다(보드에 표시, 밤엔 일부 지형이 더 비쌈). 포인트를 써서 인접 공간으로 이동합니다. 맵 끝에서는 탐험할 수 있습니다: 이동 2를 내고 새 타일을 놓습니다 — 이 시나리오에선 타일을 놓으면 명성 +1. 새 타일에서 마을·아성·폐허·광란하는 적이 나타납니다.',
      },
      es: {
        title: 'Movimiento y Exploración',
        body: 'Cada terreno cuesta puntos de Movimiento (en el tablero; algunos cuestan más de Noche). Gasta puntos para entrar en espacios adyacentes. En el borde puedes explorar: paga 2 de Movimiento para colocar una loseta — y en este escenario colocar una loseta da Fama +1. Las losetas nuevas revelan aldeas, fortalezas, ruinas y enemigos furiosos.',
      },
    },
  },
  {
    id: 'rampaging',
    priority: 2,
    trigger: (c) => c.hasEnemyNearby && !c.combatActive,
    text: {
      en: {
        title: 'Rampaging Enemies',
        body: 'A rampaging enemy (orc) blocks the space it stands on. To fight, be in an ADJACENT space and declare the attack with the Fight button — you do not move onto it. Beware: moving from one space adjacent to it to another adjacent space also provokes it into combat. Defeating it ends your action.',
      },
      ko: {
        title: '광란하는 적',
        body: '광란하는 적(오크)은 자신이 선 공간을 막습니다. 싸우려면 인접한 공간에서 Fight 버튼으로 공격을 선언합니다 — 적 위로 이동하는 게 아닙니다. 주의: 적의 인접 공간에서 또 다른 인접 공간으로 이동해도 적을 자극해 전투가 벌어집니다. 처치하면 그 턴의 행동이 끝납니다.',
      },
      es: {
        title: 'Enemigos Furiosos',
        body: 'Un enemigo furioso (orco) bloquea su espacio. Para luchar, sitúate en un espacio ADYACENTE y declara el ataque con el botón Luchar — no te mueves sobre él. Cuidado: moverte de un espacio adyacente a otro adyacente también lo provoca al combate. Derrotarlo termina tu acción.',
      },
    },
  },
  {
    id: 'combat_phases',
    priority: 0,
    trigger: (c) => c.combatActive,
    text: {
      en: {
        title: 'Combat — Four Phases',
        body: '1) Ranged & Siege: hit before they reach you (only Ranged/Siege count). 2) Block: block each enemy fully or take the full hit (partial blocks do nothing). 3) Assign Damage: unblocked attacks wound your hero or a Unit. 4) Attack: melee + any leftover Ranged/Siege to defeat them. Defeat an enemy by dealing damage ≥ its Armor; damage does not carry between enemies.',
      },
      ko: {
        title: '전투 — 4단계',
        body: '1) 장거리·공성: 적이 닿기 전에 처치(장거리/공성만 유효). 2) 방어: 각 적을 완전히 막거나 공격을 그대로 받습니다(부분 방어는 무의미). 3) 데미지 배정: 못 막은 공격이 영웅이나 유닛에 상처를 줍니다. 4) 공격: 근접 + 남은 장거리/공성으로 처치. 적의 아머 이상으로 데미지를 줘야 처치되며, 데미지는 적 간에 이월되지 않습니다.',
      },
      es: {
        title: 'Combate — Cuatro Fases',
        body: '1) A distancia y Asedio: golpea antes de que lleguen (solo cuentan A distancia/Asedio). 2) Bloqueo: bloquea por completo a cada enemigo o recibe el golpe entero (los bloqueos parciales no sirven). 3) Asignar Daño: los ataques no bloqueados hieren a tu héroe o a una Unidad. 4) Ataque: cuerpo a cuerpo + lo que quede de A distancia/Asedio. Derrotas si el daño ≥ su Armadura; el daño no se transfiere entre enemigos.',
      },
    },
  },
  {
    id: 'interaction',
    priority: 3,
    trigger: (c) => (c.hasInteractableSite && !c.combatActive) || c.interactionActive,
    text: {
      en: {
        title: 'Interaction (Villages & more)',
        body: 'Spend Influence (from cards played for Influence, or sideways for +1) to interact. In a Village you can recruit Units shown with the village icon, or buy Healing. Your total Influence is adjusted by your Reputation — positive adds, negative subtracts. After acting in a Village you may also Plunder it once (Reputation −1, draw 2 cards).',
      },
      ko: {
        title: '상호작용 (마을 등)',
        body: '영향력(Influence 카드, 또는 sideways +1)을 써서 상호작용합니다. 마을에선 마을 아이콘이 있는 유닛을 고용하거나 치료를 구매합니다. 총 영향력은 평판(Reputation)에 따라 가감됩니다 — 양수면 더하고 음수면 뺍니다. 마을에서 행동한 뒤 한 번 약탈도 가능합니다(평판 −1, 카드 2장 드로우).',
      },
      es: {
        title: 'Interacción (Aldeas y más)',
        body: 'Gasta Influencia (de cartas jugadas por Influencia, o de lado +1) para interactuar. En una Aldea puedes reclutar Unidades con el icono de aldea o comprar Curación. Tu Influencia total se ajusta por tu Reputación — positiva suma, negativa resta. Tras actuar en una Aldea puedes Saquearla una vez (Reputación −1, roba 2 cartas).',
      },
    },
  },
  {
    id: 'level_up',
    priority: 0,
    trigger: (c) => c.pendingLevelUp,
    text: {
      en: {
        title: 'Level Up!',
        body: 'Enough Fame raised your Level. Each level-up improves your stats; every second level also lets you learn a Skill and gain an Advanced Action card (it joins your deck for the rest of the game). Higher levels raise your Armor, hand limit, and how many Units you can command.',
      },
      ko: {
        title: '레벨 업!',
        body: '명성이 충분히 쌓여 레벨이 올랐습니다. 레벨업마다 능력치가 오르고, 두 레벨마다 스킬을 배우고 상급 액션 카드를 얻습니다(남은 게임 동안 덱에 추가). 레벨이 오르면 아머, 핸드 제한, 지휘할 수 있는 유닛 수가 늘어납니다.',
      },
      es: {
        title: '¡Subes de Nivel!',
        body: 'Suficiente Fama subió tu Nivel. Cada subida mejora tus estadísticas; cada dos niveles además aprendes una Habilidad y ganas una carta de Acción Avanzada (se une a tu mazo el resto de la partida). Más nivel sube tu Armadura, el límite de mano y cuántas Unidades puedes mandar.',
      },
    },
  },
  {
    id: 'rest',
    priority: 4,
    trigger: (c) => c.phase === 'player_turn_start' && !c.combatActive,
    text: {
      en: {
        title: 'Resting & Wounds',
        body: 'Wounds clog your hand and are never discarded normally. Healing removes them (from villages, or Heal cards/Units — but never during combat). If a turn is hopeless you can Rest instead of a normal turn: discard one non-Wound card to throw away all Wounds in your hand. Standard rest needs a non-Wound card; if only Wounds remain you must take a slow recovery.',
      },
      ko: {
        title: '휴식과 상처',
        body: '상처(Wound) 카드는 손을 막고 평소엔 버릴 수 없습니다. 치료로만 제거됩니다(마을, 또는 치료 카드/유닛 — 단 전투 중엔 불가). 턴이 가망 없으면 일반 턴 대신 휴식할 수 있습니다: 상처 아닌 카드 1장을 버리면 손의 모든 상처를 버립니다. 일반 휴식엔 상처 아닌 카드가 필요하고, 상처만 남았다면 느린 회복을 해야 합니다.',
      },
      es: {
        title: 'Descanso y Heridas',
        body: 'Las Heridas atascan tu mano y no se descartan normalmente. Solo se quitan curando (aldeas, o cartas/Unidades de Curación — nunca en combate). Si el turno es inútil puedes Descansar: descarta una carta que no sea Herida para tirar todas las Heridas de tu mano. El descanso normal requiere una carta no-Herida; si solo quedan Heridas, haces recuperación lenta.',
      },
    },
  },
  {
    id: 'round_end',
    priority: 1,
    trigger: (c) => c.phase === 'end_of_round',
    text: {
      en: {
        title: 'End of the Round',
        body: 'When your deck runs out (or you choose), you declare the end of the round. Everyone else takes one last turn, then a new round begins: reshuffle your discard into your deck, draw a fresh hand, refresh the offers, and the Day/Night flips. Remember the game only lasts 3 rounds here.',
      },
      ko: {
        title: '라운드의 끝',
        body: '덱이 떨어지면(또는 원할 때) 라운드 종료를 선언합니다. 다른 모두가 마지막 턴을 한 번씩 갖고 새 라운드가 시작됩니다: 버린 더미를 덱으로 섞고, 새 손패를 뽑고, 오퍼를 갱신하고, 낮/밤이 바뀝니다. 이 시나리오는 3라운드까지만 진행됨을 기억하세요.',
      },
      es: {
        title: 'Fin de la Ronda',
        body: 'Cuando se acaba tu mazo (o cuando quieras), declaras el fin de la ronda. Los demás juegan un último turno y empieza una nueva ronda: baraja tu descarte en el mazo, roba mano nueva, refresca las ofertas y cambia Día/Noche. Recuerda que aquí la partida solo dura 3 rondas.',
      },
    },
  },
  {
    id: 'city_goal',
    priority: 0,
    trigger: (c) => c.finalTurnPending,
    text: {
      en: {
        title: 'A City is Discovered!',
        body: 'The scenario goal is met — a City tile has been revealed. The game now ends after one final turn. Your score comes from Fame plus achievements (conquered sites, leftover crystals, and more). Well played, Mage Knight!',
      },
      ko: {
        title: '도시 발견!',
        body: '시나리오 목표 달성 — 도시 타일이 공개되었습니다. 이제 마지막 한 턴 후 게임이 끝납니다. 점수는 명성과 업적(점령한 장소, 남은 크리스탈 등)으로 계산됩니다. 잘하셨습니다, 메이지 나이트!',
      },
      es: {
        title: '¡Se descubre una Ciudad!',
        body: 'Se cumple el objetivo — se ha revelado una loseta de Ciudad. La partida termina tras un último turno. Tu puntuación viene de la Fama más logros (sitios conquistados, cristales restantes y más). ¡Bien jugado, Mage Knight!',
      },
    },
  },
]
