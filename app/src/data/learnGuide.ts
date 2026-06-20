// ─────────────────────────────────────────────────────────────────────────────
// "Learn by Playing" guided steps — derived from the First Reconnaissance
// walkthrough (walkthrought.pdf), which teaches the rulebook. Unlike loose tips,
// these form an ORDERED sequence: each step tells the player exactly what to do
// next, then auto-advances when the game state shows it was done (a manual
// "Next" is always available too). Nothing here contradicts the rulebook — the
// real engine runs the game; the guide only directs and explains.
// ─────────────────────────────────────────────────────────────────────────────

export type GuideLang = 'en' | 'ko' | 'es'

export interface LearnContext {
  round: number
  phase: string
  turnCount: number
  combatActive: boolean
  interactionActive: boolean
  hasInteractableSite: boolean
  hasEnemyNearby: boolean
  pendingLevelUp: boolean
  pendingReward: boolean
  finalTurnPending: boolean
  movePoints: number
  positionKey: string
  exploredTiles: number
  fame: number
  conqueredCount: number
}

interface Localized {
  title: string
  body: string
}

export interface GuideStep {
  id: string
  /** 'action' steps auto-advance when done() fires; 'info' steps wait for Next. */
  kind: 'action' | 'info' | 'terminal'
  text: Record<GuideLang, Localized>
  /** Completion check (action steps). `base` is the context snapshot taken when
   *  the step became active, so we can detect changes (moved, explored, …). */
  done?: (ctx: LearnContext, base: LearnContext) => boolean
  /** CSS selector of the UI element to spotlight for this step (data-tutorial). */
  spotlight?: string
  /** One-line confirmation shown briefly when an action step completes. */
  feedback?: Record<GuideLang, string>
}

export const LEARN_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    kind: 'info',
    text: {
      en: { title: 'Learn by Playing', body: 'This is the real First Reconnaissance scenario — 3 rounds (Day → Night → Day), and it ends the moment a City tile is discovered. Follow the steps: each one tells you what to do next and advances on its own once you do it (or tap Next). Tap Next to begin.' },
      ko: { title: '게임하며 배우기', body: '실제 First Reconnaissance 시나리오입니다 — 3라운드(낮 → 밤 → 낮)이며, 도시 타일을 발견하는 순간 끝납니다. 안내를 따라가세요: 각 단계가 "지금 할 일"을 알려주고, 실행하면 자동으로 넘어갑니다(또는 "다음"을 누르세요). "다음"을 눌러 시작하세요.' },
      es: { title: 'Aprender Jugando', body: 'Este es el escenario real First Reconnaissance — 3 rondas (Día → Noche → Día), y termina en cuanto se descubre una loseta de Ciudad. Sigue los pasos: cada uno te dice qué hacer y avanza solo al hacerlo (o pulsa Siguiente). Pulsa Siguiente para empezar.' },
    },
  },
  {
    id: 'tactic',
    kind: 'action',
    done: (c) => !['setup', 'round_start', 'tactic_selection'].includes(c.phase),
    text: {
      en: { title: 'Now: Choose a Tactic', body: 'Each round starts here. Pick a Tactic card from the overlay — its number sets turn order (lower goes first) and it grants a bonus. For learning, any choice is fine.' },
      ko: { title: '지금 할 일: 전략 선택', body: '각 라운드는 여기서 시작합니다. 오버레이에서 전략(Tactic) 카드를 하나 고르세요 — 숫자가 턴 순서를 정하고(낮은 쪽 먼저) 보너스를 줍니다. 배우는 단계이니 아무거나 골라도 됩니다.' },
      es: { title: 'Ahora: Elige una Táctica', body: 'Cada ronda empieza aquí. Elige una carta de Táctica del panel — su número fija el orden de turno (menor primero) y da un bono. Para aprender, cualquiera vale.' },
    },
  },
  {
    id: 'turn_intro',
    kind: 'info',
    text: {
      en: { title: 'Your Turn: Move, then Act', body: 'A turn is two parts: first Movement, then ONE Action (combat or interaction). So Move→Act or Act-only is fine, but never Act→Move. Cards in your hand power everything — let\'s get some Move first.' },
      ko: { title: '당신의 턴: 이동 후 행동', body: '턴은 두 부분입니다: 먼저 이동, 그다음 행동 하나(전투 또는 상호작용). 이동→행동 또는 행동만은 가능하지만, 행동 후 이동은 불가합니다. 손의 카드가 모든 것의 동력입니다 — 먼저 이동력을 얻어봅시다.' },
      es: { title: 'Tu Turno: Mover, luego Actuar', body: 'El turno tiene dos partes: primero Movimiento, luego UNA Acción (combate o interacción). Mover→Actuar o solo Actuar vale, pero nunca Actuar→Mover. Las cartas lo impulsan todo — consigamos Movimiento primero.' },
    },
  },
  {
    id: 'get_move',
    kind: 'action',
    done: (c) => c.movePoints > 0,
    spotlight: '[data-tutorial="card-hand"]',
    feedback: {
      en: '✓ Move points gained — those power your movement this turn.',
      ko: '✓ 이동력 획득 — 이번 턴 이동에 쓰입니다.',
      es: '✓ Puntos de Movimiento — impulsan tu movimiento este turno.',
    },
    text: {
      en: { title: 'Now: Get Move points', body: 'Tap a card with the boot (Move) icon and play its basic effect. Tip: you can stack same-type cards (two Move 2 → Move 4), or play ANY card "sideways" for +1 Move. Watch your Move total rise.' },
      ko: { title: '지금 할 일: 이동력 얻기', body: '손에서 신발(이동) 아이콘 카드를 탭해 기본효과로 내세요. 팁: 같은 종류 카드를 쌓거나(이동2 ×2 → 이동4), 아무 카드나 "옆으로(sideways)" 내면 이동 +1. 이동 수치가 오르는지 보세요.' },
      es: { title: 'Ahora: Consigue Movimiento', body: 'Toca una carta con el icono de bota (Mover) y juega su efecto básico. Truco: apila cartas del mismo tipo (dos Mover 2 → Mover 4), o juega CUALQUIER carta "de lado" para +1 Mover. Mira subir tu total de Movimiento.' },
    },
  },
  {
    id: 'move_figure',
    kind: 'action',
    done: (c, base) => c.positionKey !== base.positionKey,
    spotlight: '[data-tutorial="hex-map"]',
    feedback: {
      en: '✓ You moved! Terrain cost was deducted from your Move points.',
      ko: '✓ 이동 완료! 지형 비용만큼 이동력이 차감됐어요.',
      es: '✓ ¡Te moviste! Se restó el coste del terreno de tu Movimiento.',
    },
    text: {
      en: { title: 'Now: Move your hero', body: 'Tap a highlighted (reachable) space, then confirm the move. Each terrain costs different Move points (shown on the board; some cost more at Night). Your starting tile has villages to visit and orcs to fight.' },
      ko: { title: '지금 할 일: 영웅 이동', body: '표시된(이동 가능한) 칸을 탭하고 이동을 확정하세요. 지형마다 이동 비용이 다릅니다(보드에 표시, 밤엔 일부 지형이 더 비쌈). 시작 타일에는 방문할 마을과 싸울 오크가 있습니다.' },
      es: { title: 'Ahora: Mueve a tu héroe', body: 'Toca un espacio resaltado (alcanzable) y confirma el movimiento. Cada terreno cuesta distinto (en el tablero; algunos cuestan más de Noche). Tu loseta inicial tiene aldeas que visitar y orcos que combatir.' },
    },
  },
  {
    id: 'village',
    kind: 'info',
    text: {
      en: { title: 'Interact at a Village', body: 'On (or next to) a Village, press Interact. In the hand\'s Influence section, play cards for Influence (or sideways for +1). Your Reputation adjusts the total (positive adds, negative subtracts). Spend Influence to RECRUIT a Unit (with the village icon) or BUY Healing, then press Done. You may also Plunder a village once per turn (Reputation −1, draw 2 cards).' },
      ko: { title: '마을에서 상호작용', body: '마을 칸(또는 인접)에서 "Interact"를 누르세요. 손패의 영향력(Influence) 섹션에서 카드를 내 영향력을 모으세요(옆으로 내면 +1). 평판(Reputation)이 총합을 가감합니다(양수면 더하고 음수면 뺌). 모은 영향력으로 ① 마을 아이콘 유닛 고용 ② 치료 구매를 한 뒤 "Done". 마을 약탈도 턴당 1회 가능합니다(평판 −1, 카드 2장 드로우).' },
      es: { title: 'Interactúa en una Aldea', body: 'Sobre (o junto a) una Aldea, pulsa Interactuar. En la sección de Influencia de la mano, juega cartas por Influencia (o de lado +1). Tu Reputación ajusta el total (positiva suma, negativa resta). Gasta Influencia para RECLUTAR una Unidad (con icono de aldea) o COMPRAR Curación, y pulsa Hecho. También puedes Saquear una aldea una vez por turno (Reputación −1, roba 2 cartas).' },
    },
  },
  {
    id: 'explore',
    kind: 'action',
    done: (c, base) => c.exploredTiles > base.exploredTiles,
    spotlight: '[data-tutorial="hex-map"]',
    feedback: {
      en: '✓ New tile placed — Fame +1, and new places revealed.',
      ko: '✓ 새 타일 공개 — 명성 +1, 새 장소가 드러났어요.',
      es: '✓ Loseta colocada — Fama +1, y se revelan nuevos lugares.',
    },
    text: {
      en: { title: 'Now: Explore a new tile', body: 'Move to the edge of the map, then pay 2 Move to reveal a new tile (Exploration is movement, not your action). In this scenario, placing a tile earns Fame +1! New tiles reveal sites and rampaging enemies.' },
      ko: { title: '지금 할 일: 새 타일 탐험', body: '맵 가장자리로 이동한 뒤, 이동 2를 써서 새 타일을 공개하세요(탐험은 행동이 아니라 이동입니다). 이 시나리오에선 타일을 놓을 때마다 명성 +1! 새 타일에서 장소와 광란하는 적이 나타납니다.' },
      es: { title: 'Ahora: Explora una loseta', body: 'Muévete al borde del mapa y paga 2 de Movimiento para revelar una loseta (Explorar es movimiento, no tu acción). En este escenario, colocar una loseta da Fama +1. Las losetas nuevas revelan sitios y enemigos furiosos.' },
    },
  },
  {
    id: 'combat',
    kind: 'info',
    spotlight: '[data-tutorial="fight-button"]',
    text: {
      en: { title: 'Fighting a Rampaging Orc', body: 'To fight a rampaging enemy, stand in an ADJACENT space and press Fight (you do not move onto it). Combat has 4 phases: 1) Ranged & Siege, 2) Block, 3) Assign Damage, 4) Attack. Deal damage ≥ the enemy\'s Armor to defeat it and earn its Fame. Tap Next when you\'re ready to continue.' },
      ko: { title: '광란하는 오크와 전투', body: '광란하는 적과 싸우려면 그 적의 인접 칸에 서서 "Fight"를 누르세요(적 칸으로 들어가는 게 아닙니다). 전투는 4단계: ① 장거리·공성 ② 방어 ③ 데미지 받기 ④ 공격. 적의 아머 이상으로 데미지를 주면 처치하고 명성을 얻습니다. 계속하려면 "다음"을 누르세요.' },
      es: { title: 'Luchar contra un Orco Furioso', body: 'Para luchar contra un enemigo furioso, sitúate en un espacio ADYACENTE y pulsa Luchar (no te mueves sobre él). El combate tiene 4 fases: 1) A distancia y Asedio, 2) Bloqueo, 3) Asignar Daño, 4) Ataque. Inflige daño ≥ su Armadura para derrotarlo y ganar su Fama. Pulsa Siguiente para continuar.' },
    },
  },
  {
    id: 'progress',
    kind: 'info',
    text: {
      en: { title: 'Levels, Wounds & Rounds', body: 'Defeating enemies earns Fame → Level up (better stats; every 2nd level a Skill + Advanced Action). Wounds clog your hand — heal them at villages or Rest (discard one non-Wound card to throw away all Wounds; never heal in combat). When your deck runs out you declare the round\'s end; a new round flips Day/Night.' },
      ko: { title: '레벨·상처·라운드', body: '적 처치로 명성을 얻어 레벨업(능력치 상승, 2레벨마다 스킬+상급액션). 상처(Wound)는 손을 막습니다 — 마을에서 치료하거나 휴식(상처 아닌 카드 1장을 버리면 손의 모든 상처를 버림, 전투 중 치료 불가). 덱이 떨어지면 라운드 종료를 선언하고, 새 라운드에 낮/밤이 바뀝니다.' },
      es: { title: 'Niveles, Heridas y Rondas', body: 'Derrotar enemigos da Fama → subir de Nivel (mejores stats; cada 2 niveles una Habilidad + Acción Avanzada). Las Heridas atascan tu mano — cúralas en aldeas o Descansa (descarta una carta no-Herida para tirar todas las Heridas; nunca cures en combate). Cuando se acaba el mazo declaras el fin de ronda; la nueva ronda cambia Día/Noche.' },
    },
  },
  {
    id: 'goal',
    kind: 'action',
    done: (c) => c.finalTurnPending,
    text: {
      en: { title: 'Your Goal: Discover a City', body: 'Keep exploring toward the core of the map. The scenario ends the moment a City tile is revealed — then one final turn, and your score is your Fame plus achievements. Go find the City!' },
      ko: { title: '목표: 도시 발견', body: '맵 중심부를 향해 계속 탐험하세요. 도시 타일이 공개되는 순간 시나리오가 끝나고 — 마지막 한 턴 뒤, 점수는 명성과 업적으로 정해집니다. 도시를 찾으러 가세요!' },
      es: { title: 'Tu Objetivo: Descubrir una Ciudad', body: 'Sigue explorando hacia el centro del mapa. El escenario termina en cuanto se revela una loseta de Ciudad — luego un último turno, y tu puntuación es tu Fama más logros. ¡Ve a por la Ciudad!' },
    },
  },
  {
    id: 'free',
    kind: 'terminal',
    text: {
      en: { title: 'You\'ve got the basics!', body: 'A City has been found and the game is wrapping up. You now know how to move, explore, interact and fight. Reopen this guide any time with the 📖 button. Well played, Mage Knight!' },
      ko: { title: '기본기를 익혔어요!', body: '도시를 발견했고 게임이 마무리됩니다. 이제 이동·탐험·상호작용·전투를 모두 익혔습니다. 이 안내는 언제든 📖 버튼으로 다시 열 수 있어요. 잘하셨습니다, 메이지 나이트!' },
      es: { title: '¡Ya tienes lo básico!', body: 'Se ha encontrado una Ciudad y la partida concluye. Ya sabes mover, explorar, interactuar y combatir. Reabre esta guía cuando quieras con el botón 📖. ¡Bien jugado, Mage Knight!' },
    },
  },
]
