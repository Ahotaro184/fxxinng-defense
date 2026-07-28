"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Screen = "menu" | "stages" | "upgrades" | "settings" | "loading" | "battle";
type Overlay = "none" | "pause" | "confirm-exit" | "clear" | "unlock" | "gameover";
type UnitKind = "gunslinger" | "riot" | "rifleman" | "oniyama" | "hyperman" | "mu";
type EnemyKind = "office" | "fat" | "executioner" | "sixarm" | "zeus";
type Anim = "idle" | "walk" | "attack" | "hit" | "death";
type MuOfferStep = "none" | "eligible" | "offer" | "purchase" | "unlocked";
type HeroUnlockName = "鬼山 タケシ" | "HYPERMAN";
type LoadingPhase = "progress" | "hold" | "fade-to-black";
type BattleEntryFade = "none" | "covered" | "releasing";
type LoadingCharacterKind =
  | "gunslinger"
  | "riot"
  | "rifleman"
  | "oniyama"
  | "hyperman"
  | "office"
  | "fat";

type SaveData = {
  unlockedStage: number;
  clearedStages: number[];
  seenHeroUnlocks: HeroUnlockName[];
  materials: number;
  bankCoins: number;
  muUnlocked: boolean;
  muFirstStage4Loss: boolean;
  muOfferStep: MuOfferStep;
  upgrades: { attack: number; coins: number; base: number; initialCoins: number };
};

type Entity = {
  id: number;
  team: "ally" | "enemy";
  kind: UnitKind | EnemyKind;
  x: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  interval: number;
  attackClock: number;
  anim: Anim;
  animClock: number;
  hitFlash: number;
  deadClock?: number;
  attackElapsed?: number;
  attackTargetId?: number;
  appliedHits?: number;
  invincible?: boolean;
};

type Explosion = { x: number; y: number; age: number; maxAge: number; kind?: "normal" | "cute" };
type Shockwave = { x: number; y: number; age: number; maxAge: number };
type LightningStrike = { x: number; age: number; maxAge: number; radius: number };

const WIDTH = 540;
const HEIGHT = 960;
const BATTLE_FLOOR = 590;
const BASE_ATTACK_X = 92;
const ZEUS_BASE_DAMAGE = 300;
const ZEUS_LIGHTNING_RADIUS = 72;
const DURATION = 180;
const MAX_ALLIES = 50;
const STORAGE_KEY = "fxxinng-turret-save-v1";
const UPGRADE_COSTS = [100, 200, 400, 800, 1600];

const STANDARD_ENEMY_STATS: Record<
  1 | 2 | 3 | 4,
  Record<"office" | "fat", { hp: number; damage: number }>
> = {
  1: { office: { hp: 100, damage: 12 }, fat: { hp: 380, damage: 40 } },
  2: { office: { hp: 130, damage: 16 }, fat: { hp: 500, damage: 52 } },
  3: { office: { hp: 170, damage: 21 }, fat: { hp: 650, damage: 66 } },
  4: { office: { hp: 210, damage: 27 }, fat: { hp: 720, damage: 82 } },
};

const ELITE_ENEMY_STATS: Record<
  "executioner" | "sixarm" | "zeus",
  { hp: number; damage: number; speed: number; range: number; interval: number }
> = {
  executioner: { hp: 1800, damage: 100, speed: 5.2, range: 68, interval: 1.75 },
  sixarm: { hp: 3000, damage: 125, speed: 6, range: 74, interval: 1.45 },
  zeus: { hp: 100_000, damage: 9999, speed: 6, range: 220, interval: 5 },
};

const HERO_PATROL_LIMIT_RATIO: Record<UnitKind, number> = {
  gunslinger: 0.48,
  riot: 0.58,
  rifleman: 0.48,
  oniyama: 0.6,
  hyperman: 0.61,
  mu: 0.57,
};
const RANGED_HERO_LIMIT_RATIO = 0.48;
const HERO_CHASE_LIMIT_RATIO = 0.7;
const HERO_COLLISION_RADIUS: Record<UnitKind, number> = {
  gunslinger: 9,
  riot: 9,
  rifleman: 9,
  oniyama: 9,
  hyperman: 9,
  mu: 4.5,
};
const MU_BATTLE_SPRITE_SIZE = 54;

const DEFAULT_SAVE: SaveData = {
  unlockedStage: 1,
  clearedStages: [],
  seenHeroUnlocks: [],
  materials: 0,
  bankCoins: 0,
  muUnlocked: false,
  muFirstStage4Loss: false,
  muOfferStep: "none",
  upgrades: { attack: 0, coins: 0, base: 0, initialCoins: 0 },
};

const UNITS: Record<
  UnitKind,
  {
    label: string;
    subtitle: string;
    cost: number;
    cooldown: number;
    hp: number;
    damage: number;
    speed: number;
    range: number;
    interval: number;
    card: string;
  }
> = {
  gunslinger: {
    label: "伊集院 ひろし",
    subtitle: "コッキング職人",
    cost: 50,
    cooldown: 4,
    hp: 160,
    damage: 34,
    speed: 12.5,
    range: 170,
    interval: 2,
    card: "/game/cards/gunslinger.png",
  },
  riot: {
    label: "佐藤 剛",
    subtitle: "盾で殴るだけ",
    cost: 80,
    cooldown: 8,
    hp: 680,
    damage: 25,
    speed: 9,
    range: 42,
    interval: 0.9,
    card: "/game/cards/riot.png",
  },
  rifleman: {
    label: "諸星 虎太郎",
    subtitle: "4連射→休憩",
    cost: 120,
    cooldown: 10,
    hp: 220,
    damage: 18,
    speed: 11,
    range: 190,
    interval: 2,
    card: "/game/cards/rifleman.png",
  },
  oniyama: {
    label: "鬼山 タケシ",
    subtitle: "長刀・返し二連斬り",
    cost: 150,
    cooldown: 12,
    hp: 360,
    damage: 72,
    speed: 10.5,
    range: 74,
    interval: 2.1,
    card: "/game/cards/oniyama.png",
  },
  hyperman: {
    label: "HYPERMAN",
    subtitle: "前方まとめて555",
    cost: 300,
    cooldown: 30,
    hp: 9999,
    damage: 555,
    speed: 12,
    range: 78,
    interval: 2.2,
    card: "/game/cards/hyperman.png",
  },
  mu: {
    label: "ミスター・ムゥ",
    subtitle: "無敵の白い悪魔",
    cost: 666,
    cooldown: 600,
    hp: 1,
    damage: 30000,
    speed: 9,
    range: 70,
    interval: 2,
    card: "/game/cards/mu.png",
  },
};

const FRAME_COUNTS: Record<string, Partial<Record<Anim, number>>> = {
  gunslinger: { idle: 4, walk: 6, attack: 6, hit: 2, death: 6 },
  riot: { idle: 4, walk: 8, attack: 6, hit: 2, death: 6 },
  rifleman: { idle: 4, walk: 8, attack: 8, hit: 2, death: 6 },
  office: { idle: 1, walk: 6, attack: 6, hit: 2, death: 6 },
  fat: { idle: 1, walk: 6, attack: 6, death: 6 },
  executioner: { idle: 4, walk: 6, attack: 6, death: 6 },
  sixarm: { idle: 4, walk: 6, attack: 6, death: 6 },
  zeus: { idle: 1, walk: 3, attack: 4, death: 1 },
  oniyama: { idle: 2, walk: 8, attack: 14, death: 4 },
  hyperman: { idle: 2, walk: 3, attack: 6, death: 5 },
  mu: { idle: 2, walk: 6, attack: 4 },
};

const LOADING_CHARACTERS: { kind: LoadingCharacterKind; label: string }[] = [
  { kind: "gunslinger", label: "伊集院 ひろし" },
  { kind: "riot", label: "佐藤 剛" },
  { kind: "rifleman", label: "諸星 虎太郎" },
  { kind: "oniyama", label: "鬼山 タケシ" },
  { kind: "hyperman", label: "HYPERMAN" },
  { kind: "office", label: "ノーマルゾンビ" },
  { kind: "fat", label: "デブゾンビ" },
];

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function getMainMenuPlayTarget(clearedStages: number[]) {
  if (!clearedStages.includes(1)) return { stage: 1, label: "ステージ1をプレイ" };
  if (!clearedStages.includes(2)) return { stage: 2, label: "ステージ2をプレイ" };
  if (!clearedStages.includes(3)) return { stage: 3, label: "ステージ3をプレイ" };
  if (!clearedStages.includes(4)) return { stage: 4, label: "ステージ4をプレイ" };
  return { stage: 4, label: "ステージ4を再プレイ" };
}

function isUnitUnlocked(
  kind: UnitKind,
  clearedStages: number[],
  muUnlocked: boolean,
) {
  if (kind === "oniyama") return clearedStages.includes(1);
  if (kind === "hyperman") return clearedStages.includes(2);
  if (kind === "mu") return muUnlocked;
  return true;
}

function loadSave(): SaveData {
  if (typeof window === "undefined") return DEFAULT_SAVE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw);
    const clearedStages = Array.isArray(parsed.clearedStages)
      ? parsed.clearedStages.filter((stage: unknown) => stage === 1 || stage === 2 || stage === 3 || stage === 4)
      : Number(parsed.unlockedStage) >= 2
        ? [1]
        : [];
    const seenHeroUnlocks = (
      Array.isArray(parsed.seenHeroUnlocks)
        ? parsed.seenHeroUnlocks
            .map((name: unknown) => {
              if (name === "鬼山武士" || name === "鬼山 武士") return "鬼山 タケシ";
              if (name === "ハイパーマン") return "HYPERMAN";
              return name;
            })
            .filter(
              (name: unknown): name is HeroUnlockName =>
                name === "鬼山 タケシ" || name === "HYPERMAN",
            )
        : []
    );
    if (clearedStages.includes(1) && !seenHeroUnlocks.includes("鬼山 タケシ")) {
      seenHeroUnlocks.push("鬼山 タケシ");
    }
    if (clearedStages.includes(2) && !seenHeroUnlocks.includes("HYPERMAN")) {
      seenHeroUnlocks.push("HYPERMAN");
    }
    return {
      unlockedStage: clamp(
        Math.max(Number(parsed.unlockedStage) || 1, clearedStages.includes(3) ? 4 : 1),
        1,
        4,
      ),
      clearedStages,
      seenHeroUnlocks,
      materials: Math.max(0, Number(parsed.materials) || 0),
      bankCoins: Math.max(0, Number(parsed.bankCoins) || 0),
      muUnlocked: Boolean(parsed.muUnlocked),
      muFirstStage4Loss: Boolean(parsed.muFirstStage4Loss),
      muOfferStep:
        parsed.muOfferStep === "eligible" ||
        parsed.muOfferStep === "offer" ||
        parsed.muOfferStep === "purchase" ||
        parsed.muOfferStep === "unlocked"
          ? parsed.muOfferStep
          : "none",
      upgrades: {
        attack: clamp(Number(parsed.upgrades?.attack) || 0, 0, 5),
        coins: clamp(Number(parsed.upgrades?.coins) || 0, 0, 5),
        base: clamp(Number(parsed.upgrades?.base) || 0, 0, 5),
        initialCoins: clamp(Number(parsed.upgrades?.initialCoins) || 0, 0, 4),
      },
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [stage, setStage] = useState(1);
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [muOfferStep, setMuOfferStep] = useState<MuOfferStep>("none");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [loadingBattle, setLoadingBattle] = useState<{
    stage: number;
    character: (typeof LOADING_CHARACTERS)[number];
    durationMs: number;
  } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingFrame, setLoadingFrame] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("progress");
  const [battleEntryFade, setBattleEntryFade] = useState<BattleEntryFade>("none");
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [coins, setCoins] = useState(100);
  const [baseHp, setBaseHp] = useState(2000);
  const [gameSpeed, setGameSpeed] = useState<1 | 2 | 3>(1);
  const [allyCount, setAllyCount] = useState(0);
  const [cooldowns, setCooldowns] = useState<Record<UnitKind, number>>({
    gunslinger: 0,
    riot: 0,
    rifleman: 0,
    oniyama: 0,
    hyperman: 0,
    mu: 0,
  });
  const [reward, setReward] = useState(0);
  const [unlockedHero, setUnlockedHero] = useState<HeroUnlockName | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadingRequestIdRef = useRef(0);
  const stateRef = useRef({
    entities: [] as Entity[],
    explosions: [] as Explosion[],
    shockwaves: [] as Shockwave[],
    lightnings: [] as LightningStrike[],
    timeLeft: DURATION,
    coins: 100,
    bankCoinsEarned: 0,
    baseHp: 2000,
    cooldowns: { gunslinger: 0, riot: 0, rifleman: 0, oniyama: 0, hyperman: 0, mu: 0 } as Record<UnitKind, number>,
    spawnClock: 0,
    passiveClock: 0,
    nextId: 1,
    stage: 1,
    running: false,
    finishing: false,
    bossSpawned: false,
    stage4EliteWaveIndex: 0,
  });
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadSave();
      const restored =
        loaded.muOfferStep === "eligible"
          ? { ...loaded, muOfferStep: "offer" as MuOfferStep }
          : loaded;
      if (restored !== loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
      setSave(restored);
      setMuOfferStep(restored.muOfferStep);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = useCallback((next: SaveData) => {
    setSave(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const image = useCallback((src: string) => {
    let found = imagesRef.current.get(src);
    if (!found) {
      found = new Image();
      found.src = src;
      imagesRef.current.set(src, found);
    }
    return found;
  }, []);

  useEffect(() => {
    image("/game/backgrounds/stage-01.png");
    image("/game/backgrounds/base.png");
    for (let i = 0; i < 5; i++)
      image(`/game/effects/hyperman-wave-sheet/${String(i).padStart(2, "0")}.png`);
    Object.entries(FRAME_COUNTS).forEach(([kind, anims]) =>
      Object.entries(anims).forEach(([anim, count]) => {
        for (let i = 0; i < (count || 0); i++)
          image(`/game/sprites/${kind}/${anim}/${String(i).padStart(2, "0")}.png`);
      }),
    );
  }, [image]);

  const syncHud = useCallback(() => {
    const s = stateRef.current;
    setTimeLeft(Math.max(0, Math.ceil(s.timeLeft)));
    setCoins(Math.floor(s.coins));
    setBaseHp(Math.max(0, Math.ceil(s.baseHp)));
    setAllyCount(s.entities.filter((e) => e.team === "ally" && e.hp > 0).length);
    setCooldowns({ ...s.cooldowns });
  }, []);

  const startBattle = useCallback(
    (which: number) => {
      const maxBase = Math.round(2000 * (1 + save.upgrades.base * 0.15));
      const startingCoins = 100 + save.upgrades.initialCoins * 100;
      stateRef.current = {
        entities: [],
        explosions: [],
        shockwaves: [],
        lightnings: [],
        timeLeft: DURATION,
        coins: startingCoins,
        bankCoinsEarned: 0,
        baseHp: maxBase,
        cooldowns: { gunslinger: 0, riot: 0, rifleman: 0, oniyama: 0, hyperman: 0, mu: 0 },
        spawnClock: which === 2 ? 1.5 : 3,
        passiveClock: 0,
        nextId: 1,
        stage: which,
        running: true,
        finishing: false,
        bossSpawned: false,
        stage4EliteWaveIndex: 0,
      };
      setStage(which);
      setOverlay("none");
      setReward(0);
      setScreen("battle");
      setTimeLeft(DURATION);
      setCoins(startingCoins);
      setBaseHp(maxBase);
      setGameSpeed(1);
      setAllyCount(0);
      setCooldowns({ gunslinger: 0, riot: 0, rifleman: 0, oniyama: 0, hyperman: 0, mu: 0 });
    },
    [save.upgrades.base, save.upgrades.initialCoins],
  );

  const startBattleWithLoading = useCallback(
    (which: number) => {
      const requestId = ++loadingRequestIdRef.current;
      const character =
        LOADING_CHARACTERS[Math.floor(Math.random() * LOADING_CHARACTERS.length)];
      const durationMs = 2000 + Math.random() * 2000;
      const firstFrame = image(`/game/sprites/${character.kind}/walk/00.png`);

      const revealLoadingScreen = async () => {
        if (!firstFrame.complete) {
          await new Promise<void>((resolve) => {
            const finishWaiting = () => {
              firstFrame.removeEventListener("load", finishWaiting);
              firstFrame.removeEventListener("error", finishWaiting);
              resolve();
            };
            firstFrame.addEventListener("load", finishWaiting);
            firstFrame.addEventListener("error", finishWaiting);
            if (firstFrame.complete) finishWaiting();
          });
        }
        try {
          await firstFrame.decode();
        } catch {
          if (firstFrame.naturalWidth === 0) return;
        }
        if (requestId !== loadingRequestIdRef.current) return;
        setLoadingBattle({ stage: which, character, durationMs });
        setLoadingProgress(0);
        setLoadingFrame(0);
        setLoadingPhase("progress");
        setScreen("loading");
      };

      void revealLoadingScreen();
    },
    [image],
  );

  useEffect(() => {
    if (screen !== "loading" || !loadingBattle) return;
    let animationFrame = 0;
    let holdTimer = 0;
    let fadeTimer = 0;
    const startedAt = performance.now();
    const walkFrameCount = FRAME_COUNTS[loadingBattle.character.kind]?.walk || 1;

    const updateLoading = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / loadingBattle.durationMs);
      setLoadingProgress(progress * 100);
      setLoadingFrame(Math.floor((elapsed / 1000) * 7) % walkFrameCount);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(updateLoading);
        return;
      }

      setLoadingProgress(100);
      setLoadingPhase("hold");
      holdTimer = window.setTimeout(() => {
        setLoadingPhase("fade-to-black");
        fadeTimer = window.setTimeout(() => {
          setBattleEntryFade("covered");
          startBattle(loadingBattle.stage);
          setLoadingBattle(null);
        }, 300);
      }, 200);
    };

    animationFrame = requestAnimationFrame(updateLoading);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(holdTimer);
      window.clearTimeout(fadeTimer);
    };
  }, [loadingBattle, screen, startBattle]);

  useEffect(() => {
    if (battleEntryFade === "covered") {
      let releaseFrame = 0;
      const startFrame = requestAnimationFrame(() => {
        releaseFrame = requestAnimationFrame(() => setBattleEntryFade("releasing"));
      });
      return () => {
        cancelAnimationFrame(startFrame);
        cancelAnimationFrame(releaseFrame);
      };
    }
    if (battleEntryFade === "releasing") {
      const finishTimer = window.setTimeout(() => setBattleEntryFade("none"), 300);
      return () => window.clearTimeout(finishTimer);
    }
  }, [battleEntryFade]);

  const addEnemy = useCallback((kind: EnemyKind) => {
    const s = stateRef.current;
    const stage = clamp(s.stage, 1, 4) as 1 | 2 | 3 | 4;
    const standardStats =
      kind === "office" || kind === "fat" ? STANDARD_ENEMY_STATS[stage][kind] : null;
    const eliteStats =
      kind === "executioner" || kind === "sixarm" || kind === "zeus"
        ? ELITE_ENEMY_STATS[kind]
        : null;
    const hp = standardStats?.hp ?? eliteStats?.hp ?? 1;
    const damage = standardStats?.damage ?? eliteStats?.damage ?? 1;
    const speed = kind === "fat" ? 8 : kind === "office" ? 15 : eliteStats?.speed ?? 15;
    const range = kind === "fat" ? 48 : kind === "office" ? 34 : eliteStats?.range ?? 34;
    const interval = kind === "fat" ? 1.5 : kind === "office" ? 1.15 : eliteStats?.interval ?? 1.15;
    s.entities.push({
      id: s.nextId++,
      team: "enemy",
      kind,
      x: WIDTH + 40,
      hp,
      maxHp: hp,
      speed,
      damage,
      range,
      interval,
      attackClock: 0,
      anim: "walk",
      animClock: Math.random(),
      hitFlash: 0,
    });
  }, []);

  const deploy = useCallback(
    (kind: UnitKind) => {
      if (screen !== "battle" || overlay !== "none") return;
      const s = stateRef.current;
      const cfg = UNITS[kind];
      if (!isUnitUnlocked(kind, save.clearedStages, save.muUnlocked)) return;
      const livingAllies = s.entities.filter((e) => e.team === "ally" && e.hp > 0).length;
      if (s.coins < cfg.cost || s.cooldowns[kind] > 0 || !s.running || livingAllies >= MAX_ALLIES) return;
      const hp = cfg.hp;
      s.coins -= cfg.cost;
      s.cooldowns[kind] = cfg.cooldown;
      s.entities.push({
        id: s.nextId++,
        team: "ally",
        kind,
        x: 84,
        hp,
        maxHp: hp,
        speed: cfg.speed,
        damage: cfg.damage * (1 + save.upgrades.attack * 0.1),
        range: cfg.range,
        interval: cfg.interval,
        attackClock: 0,
        anim: "walk",
        animClock: 0,
        hitFlash: 0,
        attackElapsed: undefined,
        attackTargetId: undefined,
        appliedHits: 0,
        invincible: kind === "mu",
      });
      syncHud();
    },
    [overlay, save.clearedStages, save.muUnlocked, save.upgrades.attack, screen, syncHud],
  );

  const finishClear = useCallback(() => {
    const s = stateRef.current;
    if (s.finishing) return;
    s.finishing = true;
    s.running = false;
    const earned = s.stage === 1 ? 100 : s.stage === 2 ? 180 : s.stage === 3 ? 300 : 500;
    const heroName: HeroUnlockName | null =
      s.stage === 1 ? "鬼山 タケシ" : s.stage === 2 ? "HYPERMAN" : null;
    const hero = heroName && !save.seenHeroUnlocks.includes(heroName) ? heroName : null;
    setReward(earned);
    setUnlockedHero(hero);
    const next: SaveData = {
      ...save,
      materials: save.materials + earned,
      bankCoins: save.bankCoins + s.bankCoinsEarned,
      unlockedStage: Math.max(save.unlockedStage, Math.min(4, s.stage + 1)),
      seenHeroUnlocks: hero ? [...save.seenHeroUnlocks, hero] : save.seenHeroUnlocks,
      clearedStages: save.clearedStages.includes(s.stage)
        ? save.clearedStages
        : [...save.clearedStages, s.stage],
    };
    persist(next);
    setTimeout(() => setOverlay(hero ? "unlock" : "clear"), 500);
  }, [persist, save]);

  const finishGameOver = useCallback(() => {
    const s = stateRef.current;
    s.running = false;
    if (s.stage === 4 && !save.muFirstStage4Loss) {
      persist({
        ...save,
        muFirstStage4Loss: true,
        muOfferStep: "eligible",
      });
    }
    setOverlay("gameover");
  }, [persist, save]);

  useEffect(() => {
    if (screen !== "battle") return;
    let raf = 0;
    let last = performance.now();
    let hudClock = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000) * gameSpeed;
      last = now;
      const s = stateRef.current;
      if (overlay === "none" && s.running) {
        s.timeLeft -= dt;
        s.passiveClock += dt;
        hudClock += dt;
        if (s.passiveClock >= 1) {
          s.coins += Math.floor(s.passiveClock);
          s.passiveClock %= 1;
        }
        (Object.keys(s.cooldowns) as UnitKind[]).forEach(
          (key) => (s.cooldowns[key] = Math.max(0, s.cooldowns[key] - dt)),
        );

        const elapsed = DURATION - s.timeLeft;
        if (!s.bossSpawned && s.timeLeft <= 30 && s.timeLeft > 0 && s.stage >= 2) {
          addEnemy(s.stage === 2 ? "executioner" : s.stage === 3 ? "sixarm" : "zeus");
          s.bossSpawned = true;
        }
        if (s.stage === 4) {
          const eliteSchedule: { at: number; kind: EnemyKind }[] = [
            { at: 90, kind: "executioner" },
            { at: 82, kind: "sixarm" },
            { at: 74, kind: "executioner" },
            { at: 66, kind: "sixarm" },
            { at: 58, kind: "executioner" },
            { at: 50, kind: "sixarm" },
          ];
          const nextElite = eliteSchedule[s.stage4EliteWaveIndex];
          if (nextElite && s.timeLeft <= nextElite.at) {
            addEnemy(nextElite.kind);
            s.stage4EliteWaveIndex += 1;
          }
        }
        s.spawnClock -= dt;
        const normalMobSpawnsStopped = s.stage === 4 && s.bossSpawned;
        if (s.spawnClock <= 0 && s.timeLeft > 0 && !normalMobSpawnsStopped) {
          const fatChance =
            s.stage === 1 ? (elapsed > 120 ? 0.22 : 0) : elapsed > 40 ? 0.3 : 0.1;
          addEnemy(Math.random() < fatChance ? "fat" : "office");
          const baseGap =
            s.stage === 1
              ? elapsed < 60
                ? 5.1
                : elapsed < 120
                  ? 3.8
                  : 2.7
              : s.stage === 2 && elapsed < 60
                ? 3.3
                : s.stage === 2 && elapsed < 120
                  ? 2.5
                  : s.stage === 2
                    ? 1.7
                    : elapsed < 60
                      ? 3
                      : elapsed < 120
                        ? 2.25
                        : 1.55;
          const openingSlowdown = elapsed < 60 ? 1.55 : 1;
          s.spawnClock = baseGap / 1.1 * openingSlowdown * (0.78 + Math.random() * 0.45);
          if (s.stage === 2 && elapsed > 100 && Math.random() < 0.24) addEnemy("office");
        }

        const alive = s.entities.filter((e) => e.hp > 0);
        alive.forEach((e) => {
          if (e.hp <= 0) return;
          e.animClock += dt;
          e.hitFlash = Math.max(0, e.hitFlash - dt);
          e.attackClock = Math.max(0, e.attackClock - dt);

          if (e.attackElapsed !== undefined) {
            const hitTimes =
              e.kind === "zeus"
                ? [0.58]
                :
              e.kind === "rifleman"
                ? [1 / 7, 2 / 7, 3 / 7, 4 / 7]
                : e.kind === "oniyama"
                  ? [5 / 7, 10 / 7]
                : e.kind === "gunslinger"
                  ? [1 / 7]
                  : e.kind === "hyperman"
                    ? [3 / 7]
                  : e.kind === "mu"
                    ? [1 / 7]
                  : e.kind === "riot"
                    ? [3 / 7]
                    : e.kind === "fat" || e.kind === "executioner"
                      ? [4 / 7]
                      : e.kind === "sixarm"
                        ? [4 / 7]
                        : [3 / 7];
            const previousElapsed = e.attackElapsed;
            e.attackElapsed += dt;
            while (
              (e.appliedHits || 0) < hitTimes.length &&
              previousElapsed < hitTimes[e.appliedHits || 0] &&
              e.attackElapsed >= hitTimes[e.appliedHits || 0]
            ) {
              const target =
                e.attackTargetId === -1
                  ? undefined
                  : s.entities.find((candidate) => candidate.id === e.attackTargetId && candidate.hp > 0);
              if (e.attackTargetId === -1) {
                if (e.kind === "zeus") {
                  s.lightnings.push({
                    x: BASE_ATTACK_X,
                    age: 0,
                    maxAge: 0.52,
                    radius: ZEUS_LIGHTNING_RADIUS,
                  });
                  s.baseHp -= ZEUS_BASE_DAMAGE;
                } else {
                  s.baseHp -= e.damage;
                }
              } else if (e.kind === "zeus" && target) {
                const strikeX = clamp(target.x, 48, WIDTH - 42);
                s.lightnings.push({
                  x: strikeX,
                  age: 0,
                  maxAge: 0.52,
                  radius: ZEUS_LIGHTNING_RADIUS,
                });
                s.entities
                  .filter(
                    (candidate) =>
                      candidate.team === "ally" &&
                      candidate.hp > 0 &&
                      Math.abs(candidate.x - strikeX) <= ZEUS_LIGHTNING_RADIUS,
                  )
                  .forEach((victim) => {
                    if (!victim.invincible) {
                      victim.hp -= e.damage;
                      victim.hitFlash = 0.18;
                    }
                  });
              } else if (e.kind === "hyperman") {
                const victims = s.entities.filter(
                  (candidate) =>
                    candidate.team === "enemy" &&
                    candidate.hp > 0 &&
                    candidate.x >= e.x &&
                    candidate.x <= e.x + 235,
                );
                victims.forEach((victim) => {
                  victim.hp -= e.damage;
                  victim.hitFlash = 0.12;
                });
                // Attack frame 3 extends the right fist to the sprite's front edge.
                // Anchor the wave there so it visibly leaves the knuckles.
                s.shockwaves.push({ x: e.x + 48, y: BATTLE_FLOOR - 87, age: 0, maxAge: 0.52 });
              } else if (e.kind === "mu" && target) {
                const victims = s.entities.filter(
                  (candidate) =>
                    candidate.team === "enemy" &&
                    candidate.hp > 0 &&
                    Math.abs(candidate.x - target.x) <= 55,
                );
                victims.forEach((victim) => {
                  victim.hp -= e.damage;
                  victim.hitFlash = 0.12;
                });
                s.explosions.push({
                  x: target.x,
                  y: BATTLE_FLOOR - 34,
                  age: 0,
                  maxAge: 0.42,
                  kind: "cute",
                });
              } else if (target) {
                const hitIndex = e.appliedHits || 0;
                const damage = e.kind === "oniyama" && hitIndex === 1 ? e.damage * 1.25 : e.damage;
                if (!target.invincible) {
                  target.hp -= damage;
                  target.hitFlash = 0.12;
                }
                if (e.kind === "oniyama" && hitIndex === 1 && target.kind === "office") {
                  target.x = Math.min(WIDTH + 20, target.x + 18);
                }
              }
              e.appliedHits = (e.appliedHits || 0) + 1;
            }
            const attackDuration = e.kind === "zeus" ? 1.08 : (FRAME_COUNTS[e.kind]?.attack || 1) / 7;
            if (e.attackElapsed >= attackDuration) {
              e.attackElapsed = undefined;
              e.attackTargetId = undefined;
              e.appliedHits = 0;
              e.anim = "idle";
              e.animClock = 0;
            } else {
              e.anim = "attack";
              return;
            }
          }

          if (e.hitFlash > 0 && FRAME_COUNTS[e.kind]?.hit) {
            if (e.anim !== "hit") e.animClock = 0;
            e.anim = "hit";
            return;
          }
          if (e.team === "ally") {
            const advancesToFront =
              e.kind === "riot" || e.kind === "oniyama" || e.kind === "hyperman" || e.kind === "mu";
            const isRanged = e.kind === "gunslinger" || e.kind === "rifleman";
            const patrolLimit = WIDTH * HERO_PATROL_LIMIT_RATIO[e.kind as UnitKind];
            const chaseLimit =
              WIDTH * (isRanged ? RANGED_HERO_LIMIT_RATIO : HERO_CHASE_LIMIT_RATIO);
            const targets = alive
              .filter((x) => x.team === "enemy")
              .sort((a, b) => {
                const aAtBase = a.x <= 112 ? 0 : 1;
                const bAtBase = b.x <= 112 ? 0 : 1;
                return aAtBase - bAtBase || Math.abs(a.x - e.x) - Math.abs(b.x - e.x);
              });
            const target = targets[0];
            if (target && Math.abs(target.x - e.x) <= e.range) {
              if (e.attackClock <= 0) {
                e.attackClock = e.interval;
                e.attackElapsed = 0;
                e.attackTargetId = target.id;
                e.appliedHits = 0;
                e.anim = "attack";
                e.animClock = 0;
              } else {
                e.anim = "idle";
              }
            } else if (target && target.x < e.x) {
              e.x = Math.max(78, e.x - e.speed * dt);
              e.anim = "walk";
            } else {
              if (isRanged) {
                // Ranged allies deliberately ignore every ally, including their
                // own kind. They may overlap and only stop for their own attack
                // range or at the shared forward patrol line.
                const moveLimit = target
                  ? Math.min(chaseLimit, target.x - e.range)
                  : patrolLimit;
                if (e.x < moveLimit) {
                  e.x = Math.min(moveLimit, e.x + e.speed * dt);
                  e.anim = "walk";
                } else {
                  e.anim = "idle";
                }
              } else if (target) {
                const selfCollisionRadius = HERO_COLLISION_RADIUS[e.kind as UnitKind];
                const nearestAllyAhead = alive
                  .filter((x) => {
                    if (x.team !== "ally" || x.id === e.id || x.x <= e.x) return false;
                    const combinedRadius =
                      selfCollisionRadius + HERO_COLLISION_RADIUS[x.kind as UnitKind];
                    return x.x - e.x < combinedRadius + 10;
                  })
                  .sort((a, b) => a.x - b.x)[0];
                const formationLimit = WIDTH * 0.43;
                const collisionLimit = nearestAllyAhead
                  ? nearestAllyAhead.x -
                    (selfCollisionRadius +
                      HERO_COLLISION_RADIUS[nearestAllyAhead.kind as UnitKind])
                  : chaseLimit;
                const moveLimit = advancesToFront
                  ? Math.min(
                      chaseLimit,
                      target.x - e.range,
                      e.kind === "mu" ? collisionLimit : chaseLimit,
                    )
                  : nearestAllyAhead
                      ? Math.min(formationLimit, collisionLimit)
                      : formationLimit;
                if (e.x < moveLimit) {
                  e.x = Math.min(moveLimit, e.x + e.speed * dt);
                  e.anim = "walk";
                } else {
                  e.anim = "idle";
                }
              } else if (advancesToFront && e.x < patrolLimit) {
                e.x = Math.min(patrolLimit, e.x + e.speed * dt);
                e.anim = "walk";
              } else {
                e.anim = "idle";
              }
            }
          } else {
            const hasLivingAllies = alive.some((x) => x.team === "ally");
            const targets = alive
              .filter((x) => x.team === "ally" && x.x <= e.x + 10)
              .sort((a, b) => b.x - a.x);
            const target = targets[0];
            if (target && e.x - target.x <= e.range) {
              if (e.attackClock <= 0) {
                e.attackClock = e.interval;
                e.attackElapsed = 0;
                e.attackTargetId = target.id;
                e.appliedHits = 0;
                e.anim = "attack";
                e.animClock = 0;
              } else if (e.kind === "zeus" && e.x - target.x > 70) {
                e.x = Math.max(target.x + 70, e.x - e.speed * dt);
                e.anim = "walk";
              } else {
                e.anim = "idle";
              }
            } else if (
              !target &&
              (e.kind === "zeus"
                ? !hasLivingAllies && Math.abs(e.x - BASE_ATTACK_X) <= e.range
                : e.x <= BASE_ATTACK_X)
            ) {
              if (e.attackClock <= 0) {
                e.attackClock = e.interval;
                e.attackElapsed = 0;
                e.attackTargetId = -1;
                e.appliedHits = 0;
                e.anim = "attack";
                e.animClock = 0;
              } else {
                e.anim = "idle";
              }
            } else {
              e.anim = "walk";
              e.x -= e.speed * dt;
            }
          }
        });

        s.entities.forEach((e) => {
          if (e.hp <= 0 && e.anim !== "death") {
            e.hp = 0;
            e.anim = "death";
            e.animClock = 0;
            e.deadClock = 0;
            if (e.team === "enemy") {
              const raw = e.kind === "zeus" ? 1000 : e.kind === "executioner" ? 180 : e.kind === "sixarm" ? 260 : e.kind === "fat" ? 40 : 15;
              const gained = Math.round(raw * (1 + save.upgrades.coins * 0.1));
              s.coins += gained;
              s.bankCoinsEarned += gained;
            }
          }
          if (e.anim === "death") {
            e.deadClock = (e.deadClock || 0) + dt;
            e.animClock = e.deadClock;
          }
        });
        s.entities = s.entities.filter(
          (e) => e.deadClock === undefined || e.deadClock < (e.kind === "zeus" ? 7.5 : 1.9),
        );
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          const livingEnemies = s.entities.some((e) => e.team === "enemy" && e.hp > 0);
          const enemyDeathAnimation = s.entities.some(
            (e) => e.team === "enemy" && e.deadClock !== undefined,
          );
          if (!livingEnemies && !enemyDeathAnimation) finishClear();
        }
        if (s.baseHp <= 0) {
          s.baseHp = 0;
          finishGameOver();
        }
        if (hudClock > 0.12) {
          syncHud();
          hudClock = 0;
        }
      }

      s.explosions.forEach((x) => (x.age += dt));
      s.explosions = s.explosions.filter((x) => x.age < x.maxAge);
      s.shockwaves.forEach((x) => (x.age += dt));
      s.shockwaves = s.shockwaves.filter((x) => x.age < x.maxAge);
      s.lightnings.forEach((x) => (x.age += dt));
      s.lightnings = s.lightnings.filter((x) => x.age < x.maxAge);
      drawGame(canvasRef.current, s, image);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [addEnemy, finishClear, finishGameOver, gameSpeed, image, overlay, save.upgrades.coins, screen, syncHud]);

  const buyUpgrade = (key: keyof SaveData["upgrades"]) => {
    const level = save.upgrades[key];
    const maxLevel = key === "initialCoins" ? 4 : 5;
    if (level >= maxLevel) return;
    const price = UPGRADE_COSTS[level];
    if (save.materials < price) return;
    persist({
      ...save,
      materials: save.materials - price,
      upgrades: { ...save.upgrades, [key]: level + 1 },
    });
  };

  const returnMenu = () => {
    stateRef.current.running = false;
    setOverlay("none");
    setScreen("menu");
  };

  const returnMenuFromGameOver = () => {
    stateRef.current.running = false;
    if (stage === 4 && save.muOfferStep === "eligible") {
      const next = { ...save, muOfferStep: "offer" as MuOfferStep };
      persist(next);
      setMuOfferStep("offer");
    }
    setOverlay("none");
    setScreen("menu");
  };

  const retryAfterGameOver = () => {
    if (save.muOfferStep === "eligible") {
      persist({ ...save, muOfferStep: "none" });
    }
    startBattle(stage);
  };

  const advanceMuOffer = (step: MuOfferStep) => {
    const next = {
      ...save,
      muUnlocked: step === "unlocked" ? true : save.muUnlocked,
      muOfferStep: step,
    };
    persist(next);
    setMuOfferStep(step);
  };

  const resetAllProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const mainMenuPlayTarget = getMainMenuPlayTarget(save.clearedStages);

  return (
    <main className="game-page">
      <div className="phone-shell">
        {screen === "loading" && loadingBattle && (
          <section
            className={`loading-screen loading-phase-${loadingPhase}`}
            aria-label={`${loadingBattle.character.label}を表示中。戦闘を読み込んでいます`}
          >
            <div className="loading-content">
              <div className="loading-character-frame" aria-hidden="true">
                {/* Existing sprite frames must swap immediately during the walk animation. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/game/sprites/${loadingBattle.character.kind}/walk/${String(loadingFrame).padStart(2, "0")}.png`}
                  alt=""
                />
              </div>
              <p>Now Loading...</p>
              <div
                className="loading-progress"
                role="progressbar"
                aria-label="ロード進捗"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(loadingProgress)}
              >
                <i style={{ width: `${loadingProgress}%` }} />
              </div>
            </div>
          </section>
        )}
        {screen === "menu" && (
          <section className="menu-screen">
            <div className="menu-shade" />
            <div className="title-block">
              <div className="title-kicker">A VERY SERIOUS DEFENSE GAME</div>
              <h1>Fxxinng<br /><span>DEFENSE</span></h1>
            </div>
            <div className="material-chip">🔩 強化資材 <strong>{save.materials}</strong></div>
            <button className="reset-progress-button" type="button" onClick={() => setResetConfirm(true)}>
              全進捗リセット
            </button>
            <nav className="main-nav">
              <button
                className="primary-menu"
                onClick={() => startBattleWithLoading(mainMenuPlayTarget.stage)}
              >
                <small>PLAY</small>
                {mainMenuPlayTarget.label}
                <b>STAGE {String(mainMenuPlayTarget.stage).padStart(2, "0")}</b>
              </button>
              <button onClick={() => setScreen("stages")}>ステージ選択 <span>›</span></button>
              <button onClick={() => setScreen("upgrades")}>部隊強化 <span>›</span></button>
              <button onClick={() => setScreen("settings")}>設定 <span>›</span></button>
            </nav>
            <div className="version">BUILD 0.2.0 / DEFEND AT ALL COSTS</div>
          </section>
        )}

        {screen === "stages" && (
          <SubScreen title="ステージ選択" kicker="SELECT MISSION" onBack={() => setScreen("menu")}>
            <div className="stage-grid">
              <StageCard
                stage={1}
                cleared={save.clearedStages.includes(1)}
                locked={false}
                onSelect={() => startBattleWithLoading(1)}
              />
              <StageCard
                stage={2}
                cleared={save.clearedStages.includes(2)}
                locked={save.unlockedStage < 2}
                onSelect={() => startBattleWithLoading(2)}
              />
              <StageCard
                stage={3}
                cleared={save.clearedStages.includes(3)}
                locked={save.unlockedStage < 3}
                onSelect={() => startBattleWithLoading(3)}
              />
              <StageCard
                stage={4}
                cleared={save.clearedStages.includes(4)}
                locked={save.unlockedStage < 4}
                onSelect={() => startBattleWithLoading(4)}
              />
            </div>
          </SubScreen>
        )}

        {screen === "upgrades" && (
          <SubScreen title="部隊強化" kicker="SQUAD UPGRADE" materials={save.materials} coins={save.bankCoins} onBack={() => setScreen("menu")}>
            <UpgradeCard icon="⚔" title="攻撃力強化" detail="全味方の攻撃力 +10%" level={save.upgrades.attack} materials={save.materials} onBuy={() => buyUpgrade("attack")} />
            <UpgradeCard icon="🪙" title="キルコインUP" detail="敵撃破時の戦闘コイン +10%" level={save.upgrades.coins} materials={save.materials} onBuy={() => buyUpgrade("coins")} />
            <UpgradeCard icon="⌂" title="拠点耐久強化" detail="拠点最大HP +15%" level={save.upgrades.base} materials={save.materials} onBuy={() => buyUpgrade("base")} />
            <UpgradeCard
              icon="◉"
              title="初期コイン増加"
              detail={`戦闘開始時の所持コイン +100（現在 ${100 + save.upgrades.initialCoins * 100}）`}
              level={save.upgrades.initialCoins}
              maxLevel={4}
              materials={save.materials}
              onBuy={() => buyUpgrade("initialCoins")}
            />
          </SubScreen>
        )}

        {screen === "settings" && (
          <SubScreen title="設定" kicker="SETTINGS" onBack={() => setScreen("menu")}>
            <button className="setting-row" type="button"><span>🔊 サウンド</span><em>準備中</em></button>
            <button className="setting-row" type="button"><span>🌐 言語</span><em>準備中</em></button>
          </SubScreen>
        )}

        {screen === "battle" && (
          <section className={`battle-screen stage-${stage}`}>
            <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
            <div className="battle-vignette" />
            <header className="battle-hud">
              <div className={`timer-box${timeLeft <= 0 ? " extermination" : ""}`}>
                <small>{timeLeft <= 0 ? "FINAL ORDER" : "TIME"}</small>
                <b>{timeLeft <= 0 ? "殲滅せよ" : formatTime(timeLeft)}</b>
              </div>
              <div className="stage-badge"><small>WAVE 1/1</small>STAGE {stage}</div>
              <div className="battle-controls">
                <button
                  className="speed-button"
                  aria-label={`戦闘速度 ${gameSpeed}倍`}
                  onClick={() => setGameSpeed((current) => (current === 1 ? 2 : current === 2 ? 3 : 1))}
                >
                  ×{gameSpeed}
                </button>
                <button className="pause-button" aria-label="ポーズ" onClick={() => setOverlay("pause")}>Ⅱ</button>
              </div>
            </header>
            {stage >= 2 && timeLeft <= 35 && timeLeft > 31 && (
              <div className="boss-warning" role="alert" aria-live="assertive">
                <span aria-hidden="true">⚠</span>
                <div><b>WARNING!</b><small>BOSS INCOMING</small></div>
                <span aria-hidden="true">⚠</span>
              </div>
            )}
            <div className="base-status">
              <span>BASE</span>
              <div><i style={{ width: `${(baseHp / Math.round(2000 * (1 + save.upgrades.base * 0.15))) * 100}%` }} /></div>
              <b>{baseHp}</b>
            </div>
            <div className="deploy-panel">
              <div className="coin-counter"><span>🪙</span><strong>{coins}</strong><small>+1 / sec</small></div>
              <div className={`unit-buttons${save.muUnlocked ? " mu-unlocked" : ""}`}>
                {(Object.keys(UNITS) as UnitKind[])
                  .filter((kind) => kind !== "mu" || save.muUnlocked)
                  .map((kind) => {
                  const cfg = UNITS[kind];
                  const cd = cooldowns[kind];
                  const atMax = allyCount >= MAX_ALLIES;
                  const locked = !isUnitUnlocked(
                    kind,
                    save.clearedStages,
                    save.muUnlocked,
                  );
                  const disabled = locked || coins < cfg.cost || cd > 0 || overlay !== "none" || atMax;
                  return (
                    <button key={kind} className={`unit-card unit-card-${kind}`} disabled={disabled} onClick={() => deploy(kind)}>
                      <img src={cfg.card} alt="" />
                      <span className="unit-name">{cfg.label}</span>
                      <span className="unit-cost">🪙 {cfg.cost}</span>
                      {locked && <span className="unit-lock">🔒<small>LOCKED</small></span>}
                      {atMax && <span className="unit-max">MAX</span>}
                      {cd > 0 && <span className="cooldown" style={{ "--cd": `${(cd / cfg.cooldown) * 100}%` } as React.CSSProperties}><b>{Math.ceil(cd)}</b></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {overlay !== "none" && (
              <div className="overlay">
                {overlay === "pause" && (
                  <Modal kicker="PAUSED" title="一旦休憩">
                    <button className="modal-primary" onClick={() => setOverlay("none")}>再開</button>
                    <button onClick={() => startBattle(stage)}>リスタート</button>
                    <button className="modal-danger" onClick={() => setOverlay("confirm-exit")}>終了</button>
                  </Modal>
                )}
                {overlay === "confirm-exit" && (
                  <Modal kicker="ABORT MISSION?" title="本当に終了？">
                    <p>今回の戦闘コインと進行は失われます。</p>
                    <button className="modal-danger" onClick={returnMenu}>終了してメニューへ</button>
                    <button onClick={() => setOverlay("pause")}>戻る</button>
                  </Modal>
                )}
                {overlay === "clear" && (
                  <Modal kicker="MISSION COMPLETE" title="Congratulations!">
                    <div className="reward-line">🔩 強化資材 <strong>+{reward}</strong></div>
                    {stage < 4 && <button className="modal-primary" onClick={() => startBattle(stage + 1)}>次のステージ</button>}
                    <button onClick={() => startBattle(stage)}>再プレイ</button>
                    <button onClick={returnMenu}>メニューに戻る</button>
                  </Modal>
                )}
                {overlay === "unlock" && unlockedHero && (
                  <Modal kicker="NEW HERO UNLOCKED" title="新ヒーロー解放！">
                    <img
                      className="unlock-hero-card"
                      src={unlockedHero === "鬼山 タケシ" ? "/game/cards/oniyama.png" : "/game/cards/hyperman.png"}
                      alt={unlockedHero}
                    />
                    <p>新ヒーロー・“{unlockedHero}”が<br />アンロックされました！</p>
                    <button className="modal-primary" onClick={() => setOverlay("clear")}>閉じる</button>
                  </Modal>
                )}
                {overlay === "gameover" && (
                  <Modal kicker="MISSION FAILED" title="BASE DESTROYED">
                    <p>拠点がゾンビに食われました。</p>
                    <button className="modal-danger" onClick={retryAfterGameOver}>再プレイ</button>
                    <button onClick={returnMenuFromGameOver}>メニューに戻る</button>
                  </Modal>
                )}
              </div>
            )}
          </section>
        )}

        {muOfferStep !== "none" && muOfferStep !== "eligible" && (
          <div className="mu-offer-overlay" role="dialog" aria-modal="true" aria-label="ミスター・ムゥ特別オファー">
            {muOfferStep === "offer" && (
              <div className="mu-offer-card">
                <div className="mu-ad-badge">緊急特別オファー</div>
                <img src="/game/cards/mu.png" alt="ミスター・ムゥ" />
                <h2>お困りのようですね。<br />ミスター・ムゥを仲間にしませんか？</h2>
                <div className="mu-yes-buttons">
                  <button onClick={() => advanceMuOffer("purchase")}>はい</button>
                  <button onClick={() => advanceMuOffer("purchase")}>はい</button>
                </div>
              </div>
            )}
            {muOfferStep === "purchase" && (
              <div className="mu-offer-card mu-purchase-card">
                <div className="mu-ad-badge">購入確認</div>
                <img src="/game/cards/mu.png" alt="ミスター・ムゥ" />
                <h2>ミスター・ムゥを<br />購入しますか？</h2>
                <p><del>999999円</del><strong>今なら999999円が<br /><b>100%OFF！！</b></strong></p>
                <button className="mu-buy-button" onClick={() => advanceMuOffer("unlocked")}>100%OFFで入手する</button>
              </div>
            )}
            {muOfferStep === "unlocked" && (
              <div className="mu-offer-card mu-unlocked-card">
                <div className="mu-ad-badge">NEW HERO UNLOCKED</div>
                <img src="/game/cards/mu.png" alt="ミスター・ムゥ" />
                <h2>ミスター・ムゥが<br />アンロックされました！</h2>
                <button className="mu-buy-button" onClick={() => advanceMuOffer("none")}>閉じる</button>
              </div>
            )}
          </div>
        )}

        {resetConfirm && (
          <div className="overlay reset-overlay" role="dialog" aria-modal="true" aria-label="全進捗リセット確認">
            <Modal kicker="RESET ALL DATA" title="本当に全消去？">
              <p>ステージ進行・強化・アンロック・ムゥ獲得履歴をすべて初期化します。</p>
              <button className="modal-danger" onClick={resetAllProgress}>全進捗をリセット</button>
              <button onClick={() => setResetConfirm(false)}>キャンセル</button>
            </Modal>
          </div>
        )}
      </div>
      {battleEntryFade !== "none" && (
        <div
          className={`battle-entry-fade battle-entry-${battleEntryFade}`}
          aria-hidden="true"
        />
      )}
    </main>
  );
}

function SubScreen({
  title,
  kicker,
  materials,
  coins,
  onBack,
  children,
}: {
  title: string;
  kicker: string;
  materials?: number;
  coins?: number;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="sub-screen">
      <header>
        <button onClick={onBack} aria-label="戻る">‹</button>
        <div><small>{kicker}</small><h2>{title}</h2></div>
        {materials !== undefined ? (
          <span className="resource-balance">
            <b>🔩 {materials}</b>
            {coins !== undefined && <b>🪙 {coins.toLocaleString()}</b>}
          </span>
        ) : <i />}
      </header>
      <div className="sub-content">{children}</div>
      <button className="back-button" onClick={onBack}>メニューに戻る</button>
    </section>
  );
}

function UpgradeCard({
  icon,
  title,
  detail,
  level,
  maxLevel = 5,
  materials,
  onBuy,
}: {
  icon: string;
  title: string;
  detail: string;
  level: number;
  maxLevel?: number;
  materials: number;
  onBuy: () => void;
}) {
  const max = level >= maxLevel;
  const affordable = max || materials >= UPGRADE_COSTS[level];
  return (
    <article className="upgrade-card">
      <div className="upgrade-icon">{icon}</div>
      <div className="upgrade-copy"><h3>{title}</h3><p>{detail}</p><div className="level-pips">{Array.from({ length: maxLevel }, (_, x) => <i key={x} className={x < level ? "on" : ""} />)}</div></div>
      <button onClick={onBuy} disabled={!affordable}>{max ? "MAX" : <>🔩 {UPGRADE_COSTS[level]}</>}</button>
    </article>
  );
}

function StageCard({
  stage,
  cleared,
  locked,
  onSelect,
}: {
  stage: 1 | 2 | 3 | 4;
  cleared: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`stage-card${locked ? " locked" : ""}`}
      type="button"
      disabled={locked}
      onClick={onSelect}
      aria-label={locked ? `ステージ${stage} 未解放` : `ステージ${stage}を開始`}
    >
      <span className="stage-card-bg" />
      <span className="stage-card-number"><small>STAGE</small>{String(stage).padStart(2, "0")}</span>
      <span className={`stage-enemies stage-enemies-${stage}`}>
        {stage < 4 && <img src="/game/sprites/office/idle/00.png" alt="" />}
        {stage === 2 && <img src="/game/sprites/fat/idle/00.png" alt="" />}
        {stage === 3 && <img src="/game/sprites/fat/idle/00.png" alt="" />}
        {stage === 4 && <img src="/game/sprites/zeus/idle/00.png" alt="" />}
      </span>
      <span className="stage-card-info">
        <em>{cleared ? "✓ クリア済み" : locked ? "未解放" : "未クリア"}</em>
      </span>
      {locked && <span className="stage-lock" aria-hidden="true">🔒</span>}
    </button>
  );
}

function Modal({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="modal-card">
      <small>{kicker}</small>
      <h2>{title}</h2>
      <div className="modal-actions">{children}</div>
    </div>
  );
}

function formatTime(sec: number) {
  const safe = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function drawGame(
  canvas: HTMLCanvasElement | null,
  s: {
    entities: Entity[];
    explosions: Explosion[];
    shockwaves: Shockwave[];
    lightnings: LightningStrike[];
    baseHp: number;
    stage: number;
  },
  getImage: (src: string) => HTMLImageElement,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const activeLightning = s.lightnings.find((strike) => strike.age < 0.28);
  const dyingZeus = s.entities.find(
    (entity) => entity.kind === "zeus" && entity.deadClock !== undefined,
  );
  const zeusDeathTime = dyingZeus?.deadClock || 0;
  const zeusShake =
    dyingZeus && zeusDeathTime >= 4.35 && zeusDeathTime <= 6.5
      ? Math.sin(((zeusDeathTime - 4.35) / 2.15) * Math.PI)
      : 0;
  const shaking = Boolean(activeLightning || zeusShake > 0);
  if (shaking) {
    const lightningStrength = activeLightning
      ? Math.max(0, 1 - activeLightning.age / 0.28)
      : 0;
    ctx.save();
    ctx.translate(
      Math.sin((activeLightning?.age || zeusDeathTime) * 155) * (4 * lightningStrength + 8 * zeusShake),
      Math.cos((activeLightning?.age || zeusDeathTime) * 127) * (2.5 * lightningStrength + 5 * zeusShake),
    );
  }
  const bg = getImage("/game/backgrounds/stage-01.png");
  if (bg.complete) ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
  if (s.stage === 2) {
    ctx.fillStyle = "rgba(118, 42, 22, .15)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (s.stage === 3) {
    ctx.fillStyle = "rgba(42, 30, 92, .18)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (s.stage === 4) {
    ctx.fillStyle = "rgba(74, 46, 12, .22)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  ctx.fillStyle = "rgba(0,0,0,.07)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const base = getImage("/game/backgrounds/base.png");
  if (base.complete) ctx.drawImage(base, -30, 440, 188, 126);

  const sorted = [...s.entities].sort((a, b) => a.x - b.x);
  sorted.forEach((e) => {
    const count = FRAME_COUNTS[e.kind]?.[e.anim] || 1;
    const fps = e.kind === "zeus" && e.anim === "attack"
      ? 3.7
      : e.anim === "death" ? 4 : e.anim === "hit" ? 11 : e.anim === "attack" ? 7 : e.anim === "walk" ? 7 : 3;
    const frame = e.anim === "death"
      ? Math.min(count - 1, Math.floor(e.animClock * fps))
      : Math.floor(e.animClock * fps) % count;
    const src = `/game/sprites/${e.kind}/${e.anim}/${String(frame).padStart(2, "0")}.png`;
    const im = getImage(src);
    const size =
      e.kind === "sixarm"
        ? 184
        : e.kind === "zeus"
          ? 244
        : e.kind === "executioner"
          ? 170
          : e.kind === "fat"
            ? 132
            : e.kind === "riot"
              ? 120
              : e.kind === "hyperman"
                ? 114
                : e.kind === "mu"
                  ? MU_BATTLE_SPRITE_SIZE
                  : e.kind === "oniyama"
                    ? 184
                    : e.kind === "gunslinger"
                      ? 98
                      : 106;
    const x = e.x - size / 2;
    const bob = e.kind === "zeus" ? Math.sin(e.animClock * Math.PI * 1.25) * 4 : 0;
    const y = BATTLE_FLOOR - size + bob;
    const isZeusDeath = e.kind === "zeus" && e.deadClock !== undefined;
    if (isZeusDeath) {
      const t = e.deadClock || 0;
      const pulse = .72 + Math.sin(t * 13) * .22;
      const glowRadius = 62 + Math.min(1, t / 4.3) * 78;
      const bodyGlow = ctx.createRadialGradient(
        e.x,
        y + size * .5,
        0,
        e.x,
        y + size * .5,
        glowRadius,
      );
      bodyGlow.addColorStop(0, `rgba(255,255,230,${.74 * pulse})`);
      bodyGlow.addColorStop(.34, `rgba(255,220,64,${.55 * pulse})`);
      bodyGlow.addColorStop(1, "rgba(255,105,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = bodyGlow;
      ctx.beginPath();
      ctx.arc(e.x, y + size * .5, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (im.complete) {
      ctx.save();
      if (isZeusDeath) {
        const t = e.deadClock || 0;
        ctx.globalAlpha = t < 4.8 ? 1 : Math.max(0, 1 - (t - 4.8) / 1.65);
        ctx.filter = `brightness(${1.45 + Math.min(3.2, t * .5)})`;
        ctx.shadowColor = "#fff3a0";
        ctx.shadowBlur = 18 + Math.min(52, t * 8);
      }
      ctx.drawImage(im, x, y, size, size);
      ctx.restore();
    }
    if (e.anim !== "death") {
      const hpW = e.kind === "zeus" ? 126 : e.kind === "executioner" || e.kind === "sixarm" ? 88 : e.kind === "fat" ? 55 : 44;
      const hpY = e.kind === "oniyama" ? BATTLE_FLOOR - 108 : y + 5;
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.fillRect(e.x - hpW / 2 - 1, hpY, hpW + 2, 6);
      ctx.fillStyle = e.invincible ? "#ffd34e" : e.team === "ally" ? "#4ee88b" : "#ef4b43";
      ctx.fillRect(e.x - hpW / 2, hpY + 1, hpW * (e.hp / e.maxHp), 4);
      if (e.invincible) {
        ctx.fillStyle = "#fff5b8";
        ctx.font = "900 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("∞", e.x, hpY - 2);
      }
    }
  });

  if (dyingZeus) {
    const t = dyingZeus.deadClock || 0;
    const centerX = dyingZeus.x;
    const centerY = BATTLE_FLOOR - 118;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (t < 5.2) {
      const charge = Math.min(1, t / 4.5);
      for (let ray = 0; ray < 14; ray++) {
        const angle = (Math.PI * 2 * ray) / 14 + t * (ray % 2 ? .8 : -.55);
        const inner = 38 + charge * 24;
        const outer = inner + 34 + charge * 70;
        ctx.strokeStyle = `rgba(255,235,112,${.2 + charge * .48})`;
        ctx.lineWidth = ray % 3 === 0 ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
        ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
        ctx.stroke();
      }
    }
    if (t >= 4.35) {
      const blastP = Math.min(1, (t - 4.35) / 3.15);
      const eased = 1 - Math.pow(1 - blastP, 3);
      const radius = 42 + eased * 245;
      const fade = Math.max(0, 1 - blastP * .92);
      const blast = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      blast.addColorStop(0, `rgba(255,255,255,${fade})`);
      blast.addColorStop(.12, `rgba(255,247,174,${.95 * fade})`);
      blast.addColorStop(.38, `rgba(255,167,28,${.78 * fade})`);
      blast.addColorStop(.72, `rgba(255,54,14,${.5 * fade})`);
      blast.addColorStop(1, "rgba(70,0,0,0)");
      ctx.fillStyle = blast;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      for (let particle = 0; particle < 26; particle++) {
        const angle = particle * 2.399 + blastP * .7;
        const distance = eased * (80 + (particle % 7) * 24);
        ctx.fillStyle = `rgba(255,${150 + (particle % 4) * 25},45,${fade})`;
        ctx.beginPath();
        ctx.arc(
          centerX + Math.cos(angle) * distance,
          centerY + Math.sin(angle) * distance * .72,
          Math.max(1, (5 - (particle % 4)) * (1 - blastP * .7)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  s.shockwaves.forEach((wave) => {
    const frame = Math.min(4, Math.floor((wave.age / wave.maxAge) * 5));
    const fx = getImage(`/game/effects/hyperman-wave-sheet/${String(frame).padStart(2, "0")}.png`);
    if (!fx.complete) return;
    const sizes = [
      { w: 54, h: 38 },
      { w: 128, h: 64 },
      { w: 260, h: 131 },
      { w: 180, h: 101 },
      { w: 132, h: 72 },
    ][frame];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(
      fx,
      wave.x,
      wave.y - sizes.h / 2,
      sizes.w,
      sizes.h,
    );
    ctx.restore();
  });

  s.lightnings.forEach((strike) => {
    const p = strike.age / strike.maxAge;
    const fade = Math.max(0, 1 - p);
    const boltX = strike.x;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "#ffe45c";
    ctx.shadowBlur = 18 * fade;
    for (let pass = 0; pass < 3; pass++) {
      ctx.strokeStyle = pass === 0 ? `rgba(255,160,0,${0.45 * fade})` : pass === 1 ? `rgba(255,240,100,${0.8 * fade})` : `rgba(255,255,255,${fade})`;
      ctx.lineWidth = pass === 0 ? 15 : pass === 1 ? 7 : 2.5;
      ctx.beginPath();
      ctx.moveTo(boltX + Math.sin(strike.age * 80) * 4, -8);
      for (let i = 1; i <= 12; i++) {
        const yy = (BATTLE_FLOOR / 12) * i;
        const jag = i === 12 ? 0 : Math.sin(i * 19.73 + strike.age * 71) * (15 - pass * 3);
        ctx.lineTo(boltX + jag, yy);
      }
      ctx.stroke();
    }
    const groundProgress = Math.min(1, p * 4.5);
    for (let branch = 0; branch < 10; branch++) {
      const dir = branch % 2 === 0 ? 1 : -1;
      const length = strike.radius * groundProgress * (0.55 + (branch % 5) * 0.1);
      ctx.strokeStyle = `rgba(255,236,84,${fade * 0.9})`;
      ctx.lineWidth = branch % 3 === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(boltX, BATTLE_FLOOR - 2);
      ctx.lineTo(boltX + dir * length * 0.48, BATTLE_FLOOR - 8 - (branch % 3) * 3);
      ctx.lineTo(boltX + dir * length, BATTLE_FLOOR - 2 + (branch % 2) * 4);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(boltX, BATTLE_FLOOR, 0, boltX, BATTLE_FLOOR, strike.radius);
    glow.addColorStop(0, `rgba(255,255,220,${0.95 * fade})`);
    glow.addColorStop(0.28, `rgba(255,212,38,${0.7 * fade})`);
    glow.addColorStop(1, "rgba(255,116,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(boltX, BATTLE_FLOOR, strike.radius, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  s.explosions.forEach((boom) => {
    const p = boom.age / boom.maxAge;
    if (boom.kind === "cute") {
      const radius = 8 + p * 23;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(boom.x, boom.y, 0, boom.x, boom.y, radius);
      glow.addColorStop(0, `rgba(255,255,255,${1 - p})`);
      glow.addColorStop(.3, `rgba(255,236,110,${.95 - p * .7})`);
      glow.addColorStop(.72, `rgba(255,125,190,${.75 - p * .65})`);
      glow.addColorStop(1, "rgba(255,110,180,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, radius, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + p;
        const distance = 7 + p * 22;
        ctx.fillStyle = `rgba(255,245,180,${1 - p})`;
        ctx.beginPath();
        ctx.arc(
          boom.x + Math.cos(angle) * distance,
          boom.y + Math.sin(angle) * distance,
          Math.max(1, 3.5 * (1 - p)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    const radius = 18 + p * 65;
    const glow = ctx.createRadialGradient(boom.x, boom.y, 0, boom.x, boom.y, radius);
    glow.addColorStop(0, `rgba(255,255,200,${1 - p})`);
    glow.addColorStop(.25, `rgba(255,187,44,${.9 - p * .7})`);
    glow.addColorStop(.6, `rgba(245,55,20,${.75 - p * .7})`);
    glow.addColorStop(1, "rgba(20,20,20,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(boom.x, boom.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  if (shaking) ctx.restore();
  if (activeLightning && activeLightning.age < 0.13) {
    ctx.fillStyle = `rgba(255,255,225,${0.56 * (1 - activeLightning.age / 0.13)})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (dyingZeus && zeusDeathTime >= 4.35 && zeusDeathTime < 4.9) {
    const flash = Math.sin(((zeusDeathTime - 4.35) / .55) * Math.PI);
    ctx.fillStyle = `rgba(255,249,214,${Math.max(0, flash) * .82})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}
