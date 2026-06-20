// ─────────────────────────────────────────────────────────────────────────────
// "Learn by Playing" curriculum — derived from the First Reconnaissance
// walkthrough (walkthrought.pdf), which teaches the rulebook. Two layers:
//   • LEARN_STEPS    — an ORDERED, guided spine (lesson by lesson) that tells the
//                      player exactly what to do next and auto-advances.
//   • LEARN_REACTIVE — just-in-time lessons that interrupt once when a special
//                      situation first appears (level-up, wounds, swift enemies…).
// Nothing here contradicts the rulebook — the real engine runs the game; the
// guide only directs and explains.
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
  handWoundCount: number
  combatAbilities: string[]
}

interface Localized { title: string; body: string }

export interface GuideStep {
  id: string
  kind: 'action' | 'info' | 'terminal'
  /** Lesson label shown above the title, e.g. "Lesson 2 · Exploration". */
  section: Record<GuideLang, string>
  text: Record<GuideLang, Localized>
  /** Expandable rule rationale ("Why?"). */
  why?: Record<GuideLang, string>
  done?: (ctx: LearnContext, base: LearnContext) => boolean
  spotlight?: string
  feedback?: Record<GuideLang, string>
}

export interface ReactiveLesson {
  id: string
  priority: number
  trigger: (ctx: LearnContext) => boolean
  section: Record<GuideLang, string>
  text: Record<GuideLang, Localized>
  why?: Record<GuideLang, string>
  spotlight?: string
}

const S = {
  basics: { en: 'Lesson 1 · Basics', ko: '레슨 1 · 기본기', es: 'Lección 1 · Básicos' },
  explore: { en: 'Lesson 2 · Exploration', ko: '레슨 2 · 탐험', es: 'Lección 2 · Exploración' },
  interact: { en: 'Lesson 3 · Interaction', ko: '레슨 3 · 상호작용', es: 'Lección 3 · Interacción' },
  combat: { en: 'Lesson 4 · Combat', ko: '레슨 4 · 전투', es: 'Lección 4 · Combate' },
  goal: { en: 'Lesson 5 · The Goal', ko: '레슨 5 · 목표', es: 'Lección 5 · El Objetivo' },
  just: { en: 'Rule', ko: '규칙', es: 'Regla' },
}

export const LEARN_STEPS: GuideStep[] = [
  {
    id: 'welcome', kind: 'info', section: S.basics,
    text: {
      en: { title: 'Welcome — Learn by Playing', body: 'This is the real First Reconnaissance scenario — 3 rounds (Day → Night → Day), ending the moment a City tile is discovered. I\'ll walk you through it lesson by lesson: each step says what to do, highlights where, and advances on its own once you do it (or tap Next). Tap Next to begin.' },
      ko: { title: '환영합니다 — 게임하며 배우기', body: '실제 First Reconnaissance 시나리오입니다 — 3라운드(낮 → 밤 → 낮), 도시 타일을 발견하는 순간 끝납니다. 레슨별로 차근차근 안내할게요: 각 단계가 "할 일"을 알려주고, 어디인지 강조하고, 실행하면 자동으로 넘어갑니다(또는 "다음"). "다음"을 눌러 시작하세요.' },
      es: { title: 'Bienvenido — Aprender Jugando', body: 'Este es el escenario real First Reconnaissance — 3 rondas (Día → Noche → Día), que termina al descubrir una Ciudad. Te guiaré lección a lección: cada paso dice qué hacer, resalta dónde y avanza solo al hacerlo (o pulsa Siguiente). Pulsa Siguiente para empezar.' },
    },
  },
  {
    id: 'tactic', kind: 'action', section: S.basics,
    done: (c) => !['setup', 'round_start', 'tactic_selection'].includes(c.phase),
    text: {
      en: { title: 'Choose a Tactic', body: 'Each round starts here. Pick a Tactic card — its number sets turn order (lower goes first) and gives a bonus. Any choice is fine while learning.' },
      ko: { title: '전략 선택', body: '각 라운드는 여기서 시작합니다. 전략 카드를 하나 고르세요 — 숫자가 턴 순서를 정하고(낮은 쪽 먼저) 보너스를 줍니다. 배우는 중엔 아무거나 좋아요.' },
      es: { title: 'Elige una Táctica', body: 'Cada ronda empieza aquí. Elige una Táctica — su número fija el orden de turno (menor primero) y da un bono. Cualquiera vale mientras aprendes.' },
    },
    why: {
      en: 'Tactics are the only thing chosen before turns. In solo, turn order barely matters, but the bonus (extra cards, mana, etc.) can shape your round.',
      ko: '전략은 턴 시작 전 유일한 선택입니다. 솔로에선 턴 순서 영향은 적지만, 보너스(추가 카드/마나 등)가 라운드를 좌우할 수 있어요.',
      es: 'Las Tácticas son lo único que se elige antes de los turnos. En solitario el orden importa poco, pero el bono (cartas, maná…) puede marcar tu ronda.',
    },
  },
  {
    id: 'turn_intro', kind: 'info', section: S.basics,
    text: {
      en: { title: 'Your Turn: Move, then Act', body: 'A turn is two parts: first Movement, then ONE Action (combat or interaction). Move→Act or Act-only is fine, but never Act→Move. Your hand of cards powers everything.' },
      ko: { title: '당신의 턴: 이동 후 행동', body: '턴은 두 부분입니다: 먼저 이동, 그다음 행동 하나(전투/상호작용). 이동→행동 또는 행동만은 가능하지만, 행동 후 이동은 불가합니다. 손의 카드가 모든 동력입니다.' },
      es: { title: 'Tu Turno: Mover, luego Actuar', body: 'El turno tiene dos partes: primero Movimiento, luego UNA Acción (combate/interacción). Mover→Actuar o solo Actuar vale, pero nunca Actuar→Mover. Tu mano lo impulsa todo.' },
    },
  },
  {
    id: 'mana_intro', kind: 'info', section: S.basics,
    spotlight: '[data-tutorial="mana-source"]',
    text: {
      en: { title: 'Mana & Crystals', body: 'Cards have a basic effect (free) and a stronger effect that needs mana of the card\'s colour. Each turn you may take ONE die from the Mana Source (top), or spend a Crystal from your inventory. Gold mana is a wild basic colour by Day; Black powers spells by Night.' },
      ko: { title: '마나와 크리스탈', body: '카드는 기본효과(무료)와, 카드 색의 마나가 필요한 강한 효과가 있습니다. 매 턴 마나 원천(위)에서 주사위 하나를 가져오거나, 인벤토리의 크리스탈을 쓸 수 있어요. 골드는 낮에 아무 기본색으로 쓰는 만능, 블랙은 밤에 스펠에 쓰입니다.' },
      es: { title: 'Maná y Cristales', body: 'Las cartas tienen efecto básico (gratis) y uno fuerte que necesita maná del color de la carta. Cada turno tomas UN dado de la Fuente (arriba) o gastas un Cristal. El oro es comodín de Día; el negro impulsa hechizos de Noche.' },
    },
    why: {
      en: 'Mana is the engine of "strong" plays. Crystals are saved mana (permanent until spent); loose mana from dice is lost at end of turn.',
      ko: '마나는 "강한" 플레이의 핵심입니다. 크리스탈은 저장된 마나(쓸 때까지 영구), 주사위에서 온 일반 마나는 턴 종료 시 사라집니다.',
      es: 'El maná impulsa las jugadas "fuertes". Los cristales son maná guardado (permanente); el maná suelto de dados se pierde al final del turno.',
    },
  },
  {
    id: 'get_move', kind: 'action', section: S.basics,
    done: (c) => c.movePoints > 0,
    spotlight: '[data-tutorial="card-hand"] [data-learn-move]',
    feedback: { en: '✓ Move points gained — they power your movement this turn.', ko: '✓ 이동력 획득 — 이번 턴 이동에 쓰입니다.', es: '✓ Movimiento obtenido — impulsa tu desplazamiento este turno.' },
    text: {
      en: { title: 'Get Move points', body: 'Tap the highlighted Move card (boot icon) and play its basic effect. Tip: stack same-type cards (two Move 2 → Move 4), or play ANY card "sideways" for +1 Move.' },
      ko: { title: '이동력 얻기', body: '강조된 이동 카드(신발 아이콘)를 탭해 기본효과로 내세요. 팁: 같은 종류를 쌓거나(이동2 ×2 → 이동4), 아무 카드나 "옆으로(sideways)" 내면 이동 +1.' },
      es: { title: 'Consigue Movimiento', body: 'Toca la carta de Movimiento resaltada (icono de bota) y juega su efecto básico. Truco: apila del mismo tipo (dos Mover 2 → Mover 4), o juega cualquier carta "de lado" para +1 Mover.' },
    },
    why: {
      en: 'You can\'t move without Move points, and they only come from cards. "Sideways" turns any card into +1 of Move/Influence/Attack/Block — flexible but weak.',
      ko: '이동력 없이는 이동 불가하고, 이동력은 카드에서만 나옵니다. "옆으로"는 아무 카드나 이동/영향력/공격/방어 +1로 바꿔줍니다 — 유연하지만 약해요.',
      es: 'No puedes moverte sin Movimiento, y solo viene de cartas. "De lado" convierte cualquier carta en +1 de Mov/Influencia/Ataque/Bloqueo — flexible pero débil.',
    },
  },
  {
    id: 'move_figure', kind: 'action', section: S.basics,
    done: (c, base) => c.positionKey !== base.positionKey,
    spotlight: '[data-tutorial="hex-map"]',
    feedback: { en: '✓ You moved! The terrain\'s cost was deducted from your Move.', ko: '✓ 이동 완료! 지형 비용만큼 이동력이 차감됐어요.', es: '✓ ¡Te moviste! Se restó el coste del terreno de tu Movimiento.' },
    text: {
      en: { title: 'Move your hero', body: 'Tap a highlighted (reachable) space, then confirm. Each terrain costs different Move points (some cost more at Night). Your start tile has villages to visit and orcs to fight.' },
      ko: { title: '영웅 이동', body: '강조된(이동 가능한) 칸을 탭하고 확정하세요. 지형마다 비용이 다릅니다(밤엔 일부 더 비쌈). 시작 타일엔 방문할 마을과 싸울 오크가 있어요.' },
      es: { title: 'Mueve a tu héroe', body: 'Toca un espacio resaltado (alcanzable) y confirma. Cada terreno cuesta distinto (algunos más de Noche). Tu loseta inicial tiene aldeas y orcos.' },
    },
  },
  {
    id: 'explore', kind: 'action', section: S.explore,
    done: (c, base) => c.exploredTiles > base.exploredTiles,
    spotlight: '[data-tutorial="hex-map"]',
    feedback: { en: '✓ New tile placed — Fame +1, and new places revealed.', ko: '✓ 새 타일 공개 — 명성 +1, 새 장소가 드러났어요.', es: '✓ Loseta colocada — Fama +1, nuevos lugares revelados.' },
    text: {
      en: { title: 'Explore a new tile', body: 'Move to the edge of the map, then pay 2 Move to reveal a new tile (exploration is movement, not your action). Here, placing a tile earns Fame +1! New tiles bring sites and rampaging enemies.' },
      ko: { title: '새 타일 탐험', body: '맵 가장자리로 이동한 뒤 이동 2를 써서 새 타일을 공개하세요(탐험은 행동이 아니라 이동). 이 시나리오에선 타일을 놓을 때마다 명성 +1! 새 타일에서 장소와 광란하는 적이 나옵니다.' },
      es: { title: 'Explora una loseta', body: 'Muévete al borde y paga 2 de Movimiento para revelar una loseta (explorar es movimiento, no tu acción). Aquí colocar una loseta da Fama +1. Trae sitios y enemigos furiosos.' },
    },
    why: {
      en: 'Exploring is how the realm — and the hidden City you\'re looking for — gets revealed. It uses Move points, so it competes with travelling.',
      ko: '탐험으로 왕국과, 당신이 찾는 숨은 도시가 드러납니다. 이동 포인트를 쓰므로 이동과 경쟁합니다.',
      es: 'Explorar revela el reino — y la Ciudad oculta que buscas. Usa Movimiento, así que compite con desplazarte.',
    },
  },
  {
    id: 'village', kind: 'info', section: S.interact,
    spotlight: '[data-tutorial="card-hand"]',
    text: {
      en: { title: 'Interact at a Village', body: 'On (or next to) a Village, press Interact. Play cards for Influence (or sideways for +1) — your Reputation adjusts the total. Spend Influence to RECRUIT a Unit (village icon) or BUY Healing, then Done. You may also Plunder a village once per turn (Reputation −1, draw 2 cards). Units fight alongside you — activate one per round.' },
      ko: { title: '마을에서 상호작용', body: '마을 칸(또는 인접)에서 "Interact". 영향력 카드를 내(옆으로 내면 +1) 영향력을 모으세요 — 평판이 총합을 가감합니다. 모은 영향력으로 ① 마을 아이콘 유닛 고용 ② 치료 구매 후 "Done". 마을 약탈도 턴당 1회(평판 −1, 카드 2장). 유닛은 함께 싸우며 라운드당 1번 활성화합니다.' },
      es: { title: 'Interactúa en una Aldea', body: 'Sobre (o junto a) una Aldea, pulsa Interactuar. Juega cartas por Influencia (o de lado +1) — tu Reputación ajusta el total. Gasta Influencia para RECLUTAR una Unidad (icono de aldea) o COMPRAR Curación, y Hecho. También Saquear una vez por turno (Reputación −1, roba 2). Las Unidades luchan contigo — activa una por ronda.' },
    },
    why: {
      en: 'Influence is "social power": it buys Units, healing and cards. Reputation reflects how you treat the land — plundering is strong but makes locals like you less.',
      ko: '영향력은 "사회적 힘"입니다: 유닛·치료·카드를 삽니다. 평판은 당신이 땅을 어떻게 대하는지 반영 — 약탈은 강하지만 주민 호감을 떨어뜨립니다.',
      es: 'La Influencia es "poder social": compra Unidades, curación y cartas. La Reputación refleja cómo tratas la tierra — saquear es fuerte pero te hace menos querido.',
    },
  },
  {
    id: 'combat', kind: 'info', section: S.combat,
    spotlight: '[data-tutorial="fight-button"]',
    text: {
      en: { title: 'Fighting a Rampaging Orc', body: 'To fight a rampaging enemy, stand in an ADJACENT space and press Fight (you don\'t move onto it). Combat has 4 phases: 1) Ranged & Siege, 2) Block, 3) Assign Damage, 4) Attack. Deal damage ≥ the enemy\'s Armour to defeat it and earn its Fame.' },
      ko: { title: '광란하는 오크와 전투', body: '광란하는 적과 싸우려면 그 적의 인접 칸에 서서 "Fight"를 누르세요(적 칸으로 들어가는 게 아닙니다). 전투는 4단계: ① 장거리·공성 ② 방어 ③ 데미지 받기 ④ 공격. 적의 아머 이상으로 데미지를 주면 처치하고 명성을 얻습니다.' },
      es: { title: 'Luchar contra un Orco Furioso', body: 'Para luchar, sitúate en un espacio ADYACENTE y pulsa Luchar (no te mueves sobre él). 4 fases: 1) A distancia y Asedio, 2) Bloqueo, 3) Asignar Daño, 4) Ataque. Inflige daño ≥ su Armadura para derrotarlo y ganar Fama.' },
    },
    why: {
      en: 'The phase order matters: ranged hits before they reach you; blocking fully stops a hit (partial blocks do nothing); only then do you assign damage and counter-attack.',
      ko: '단계 순서가 중요합니다: 장거리는 적이 닿기 전에 타격; 방어는 완전히 막아야 의미(부분 방어는 무효); 그 뒤에 데미지 배정과 반격을 합니다.',
      es: 'El orden importa: a distancia golpea antes de que lleguen; bloquear detiene del todo (parcial no sirve); luego asignas daño y contraatacas.',
    },
  },
  {
    id: 'goal', kind: 'action', section: S.goal,
    done: (c) => c.finalTurnPending,
    spotlight: '[data-tutorial="hex-map"]',
    text: {
      en: { title: 'Your Goal: Discover a City', body: 'Keep exploring toward the core of the map. The scenario ends the moment a City tile is revealed — then one final turn, and your score is Fame plus achievements. Go find the City!' },
      ko: { title: '목표: 도시 발견', body: '맵 중심부를 향해 계속 탐험하세요. 도시 타일이 공개되는 순간 시나리오가 끝나고 — 마지막 한 턴 뒤, 점수는 명성과 업적으로 정해집니다. 도시를 찾으러 가세요!' },
      es: { title: 'Tu Objetivo: Descubrir una Ciudad', body: 'Sigue explorando hacia el centro. El escenario termina al revelar una Ciudad — luego un último turno, y tu puntuación es Fama más logros. ¡Busca la Ciudad!' },
    },
  },
  {
    id: 'free', kind: 'terminal', section: S.goal,
    text: {
      en: { title: 'You\'ve got the basics!', body: 'A City has been found and the game is wrapping up. You now know how to manage mana, move, explore, interact and fight. Reopen this guide any time with 📖. Well played, Mage Knight!' },
      ko: { title: '기본기를 익혔어요!', body: '도시를 발견했고 게임이 마무리됩니다. 이제 마나 운용·이동·탐험·상호작용·전투를 모두 익혔습니다. 📖로 언제든 다시 열 수 있어요. 잘하셨습니다, 메이지 나이트!' },
      es: { title: '¡Ya tienes lo básico!', body: 'Se encontró una Ciudad y la partida concluye. Ya sabes maná, mover, explorar, interactuar y combatir. Reabre la guía con 📖. ¡Bien jugado!' },
    },
  },
]

// ── Just-in-time lessons that interrupt once when a situation first appears ──
export const LEARN_REACTIVE: ReactiveLesson[] = [
  {
    id: 'r_levelup', priority: 0, trigger: (c) => c.pendingLevelUp, section: S.just,
    text: {
      en: { title: 'Level Up!', body: 'Enough Fame raised your Level. Every level improves your stats; every SECOND level also lets you learn a Skill and gain an Advanced Action card (it joins your deck for the rest of the game). Pick your rewards in the dialog.' },
      ko: { title: '레벨 업!', body: '명성이 충분히 쌓여 레벨이 올랐습니다. 레벨업마다 능력치가 오르고, 두 레벨마다 스킬을 배우고 상급 액션 카드를 얻습니다(남은 게임 동안 덱에 추가). 대화창에서 보상을 고르세요.' },
      es: { title: '¡Subes de Nivel!', body: 'Suficiente Fama subió tu Nivel. Cada nivel mejora stats; cada DOS niveles aprendes una Habilidad y ganas una Acción Avanzada (se une a tu mazo). Elige recompensas en el diálogo.' },
    },
    why: {
      en: 'Levels make your hero stronger and your deck bigger/better — the main way you grow during a game.',
      ko: '레벨은 영웅을 강하게, 덱을 크고 좋게 만듭니다 — 게임 중 성장의 핵심 수단이에요.',
      es: 'Los niveles hacen a tu héroe más fuerte y tu mazo mejor — la forma principal de crecer en la partida.',
    },
  },
  {
    id: 'r_wounds', priority: 1, trigger: (c) => c.handWoundCount > 0 && !c.combatActive, section: S.just,
    text: {
      en: { title: 'Wounds & Healing', body: 'A Wound card sits in your hand and is never discarded normally — it just clogs your hand. Remove Wounds by Healing (villages, or Heal cards/Units — never during combat). If a turn looks hopeless, Rest instead: discard one non-Wound card to throw ALL Wounds from your hand into the discard.' },
      ko: { title: '상처와 치료', body: '상처(Wound) 카드는 손에 남아 평소엔 버릴 수 없습니다 — 손만 막아요. 치료로 제거합니다(마을, 또는 치료 카드/유닛 — 전투 중엔 불가). 턴이 가망 없으면 휴식: 상처 아닌 카드 1장을 버리면 손의 모든 상처를 버립니다.' },
      es: { title: 'Heridas y Curación', body: 'Una Herida se queda en tu mano y no se descarta normalmente — solo estorba. Quítalas Curando (aldeas, o cartas/Unidades — nunca en combate). Si el turno es inútil, Descansa: descarta una carta no-Herida para tirar TODAS las Heridas.' },
    },
    why: {
      en: 'Wounds are the main "damage" in Mage Knight — they don\'t kill you, they choke your hand. Managing them is half the game.',
      ko: '상처는 메이지 나이트의 주된 "피해"입니다 — 죽이지 않고 손을 옥죕니다. 상처 관리가 게임의 절반이에요.',
      es: 'Las Heridas son el "daño" principal — no te matan, ahogan tu mano. Gestionarlas es media partida.',
    },
  },
  {
    id: 'r_fortified', priority: 2, trigger: (c) => c.combatActive && c.combatAbilities.includes('fortified'), section: S.just,
    text: {
      en: { title: 'Fortified Enemy', body: 'This enemy is Fortified: in the Ranged & Siege phase it can only be hit by SIEGE attacks (ranged won\'t reach). Plain melee in phase 4 still works. Sites like keeps and cities fortify their defenders.' },
      ko: { title: '수성(Fortified) 적', body: '이 적은 수성 상태: 장거리·공성 단계에서 오직 공성(Siege) 공격만 맞습니다(장거리는 안 닿음). 4단계의 일반 근접은 됩니다. 아성·도시 같은 장소는 방어자에게 수성을 부여합니다.' },
      es: { title: 'Enemigo Fortificado', body: 'Está Fortificado: en la fase a distancia/Asedio solo le dañan ataques de ASEDIO (a distancia no llega). El cuerpo a cuerpo de la fase 4 sí. Fortalezas y ciudades fortifican a sus defensores.' },
    },
  },
  {
    id: 'r_swift', priority: 2, trigger: (c) => c.combatActive && c.combatAbilities.includes('swift'), section: S.just,
    text: {
      en: { title: 'Swift Enemy', body: 'This enemy is Swift: to Block it you need DOUBLE its attack value in Block. If you can\'t reach double, don\'t bother blocking — you\'ll take the full hit anyway.' },
      ko: { title: '신속(Swift) 적', body: '이 적은 신속: 방어하려면 공격력의 2배의 방어가 필요합니다. 2배를 못 채우면 방어해도 의미 없어요 — 어차피 전부 맞습니다.' },
      es: { title: 'Enemigo Veloz', body: 'Es Veloz: para Bloquearlo necesitas el DOBLE de su ataque en Bloqueo. Si no llegas al doble, no bloquees — recibirás el golpe completo igual.' },
    },
  },
  {
    id: 'r_brutal', priority: 2, trigger: (c) => c.combatActive && c.combatAbilities.includes('brutal'), section: S.just,
    text: {
      en: { title: 'Brutal Enemy', body: 'This enemy is Brutal: if you don\'t block it, the damage you take is DOUBLE its attack value. Block it fully if you can!' },
      ko: { title: '치명타(Brutal) 적', body: '이 적은 치명타: 막지 못하면 받는 데미지가 공격력의 2배입니다. 가능하면 완전히 막으세요!' },
      es: { title: 'Enemigo Brutal', body: 'Es Brutal: si no lo bloqueas, el daño que recibes es el DOBLE de su ataque. ¡Bloquéalo del todo si puedes!' },
    },
  },
  {
    id: 'r_resist', priority: 3, trigger: (c) => c.combatActive && c.combatAbilities.some((a) => a.endsWith('_resistance')), section: S.just,
    text: {
      en: { title: 'Resistant Enemy', body: 'This enemy resists an element. Physical resistance halves your physical attack; fire/ice resistance ignores that element entirely. Match the right attack type (or use Siege/Ranged of another element) to get through.' },
      ko: { title: '저항(Resistance) 적', body: '이 적은 속성 저항이 있습니다. 피지컬 저항은 일반 공격을 반으로, 화염/얼음 저항은 그 속성 공격을 완전히 무시합니다. 알맞은 공격 속성을(또는 다른 속성의 공성/장거리) 사용해 뚫으세요.' },
      es: { title: 'Enemigo Resistente', body: 'Resiste un elemento. La resistencia física reduce a la mitad tu ataque físico; la de fuego/hielo ignora ese elemento por completo. Usa el tipo de ataque adecuado para superarla.' },
    },
  },
  {
    id: 'r_roundend', priority: 4, trigger: (c) => c.phase === 'end_of_round', section: S.just,
    text: {
      en: { title: 'End of the Round', body: 'When your deck runs out (or you choose), you declare the round\'s end. A new round begins: reshuffle your discard into your deck, draw a fresh hand, refresh the offers, and Day/Night flips. This learning game lasts 3 rounds.' },
      ko: { title: '라운드의 끝', body: '덱이 떨어지면(또는 원할 때) 라운드 종료를 선언합니다. 새 라운드 시작: 버린 더미를 덱으로 섞고, 새 손패를 뽑고, 오퍼를 갱신하고, 낮/밤이 바뀝니다. 이 학습 게임은 3라운드입니다.' },
      es: { title: 'Fin de la Ronda', body: 'Cuando se acaba tu mazo (o quieras), declaras el fin de ronda. Nueva ronda: baraja el descarte, roba mano nueva, refresca ofertas y cambia Día/Noche. Esta partida dura 3 rondas.' },
    },
  },
]
