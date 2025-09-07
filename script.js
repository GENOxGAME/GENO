// Game State
let gameState = {
    id: null, // Will be set based on environment
    geno: 0,
    energy: 100,
    maxEnergy: 100,
    lastEnergyRecovery: Date.now(),
    stageIndex: 0,
    upgrades: {
        click: {}, // { stageId: { upgradeId: level } }
        passive: {} // { stageId: { upgradeId: level } }
    },
    lastActiveTime: Date.now(),
    lastPassiveGenTime: Date.now(),
    lastPassiveCollection: Date.now(),
    passiveAccumulated: 0,
    passiveCollections: 0,
    activeBoosters: {},
    completedTasks: [],
    referredBy: null,
    referrals: [],
    lastAirdrop: 0,
    totalClicks: 0,
    totalGenoEarned: 0,
    telegramStars: 0,
    version: "1.0.0"
};

// Telegram Web App Integration
let isTelegramWebApp = false;
let telegramUserId = null;
let botUsername = null;

// Backend configuration
const backendUrl = 'https://server-ebpy.onrender.com';

// Notify backend about app launch
function notifyBackendAppLaunch() {
    if (isInTelegramWebApp()) {
        const initData = window.Telegram.WebApp.initData;
        const user = window.Telegram.WebApp.initDataUnsafe?.user;
        
        fetch(`${backendUrl}/api/app-launch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initData: initData,
                user: user,
                timestamp: Date.now(),
                platform: 'telegram_web_app'
            })
        }).catch(error => {
            // Silent fail for app launch notification
        });
    }
}

// Get bot username from backend
async function getBotUsername() {
    try {
        const response = await fetch(`${backendUrl}/api/bot-info`);
        const data = await response.json();
        
        if (data.success && data.bot && data.bot.username) {
            botUsername = data.bot.username;
            return botUsername;
        }
    } catch (error) {
        // Silent fail, will use fallback
    }
    return null;
}

// Initialize Telegram Web App
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        isTelegramWebApp = true;
        telegramUserId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
        
        // Set correct player ID for Telegram Web App
        if (telegramUserId) {
            gameState.id = `TG-${telegramUserId}`;
        }
        
        // Initialize Web App
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        
        // Get bot username and notify backend about app launch
        getBotUsername().then(() => {
            notifyBackendAppLaunch();
        });
        
        return true;
    } else {
        isTelegramWebApp = false;
        // Set fallback ID for testing
        gameState.id = `GENO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        return false;
    }
}

// Check if running in Telegram Web App
function isInTelegramWebApp() {
    return isTelegramWebApp && window.Telegram && window.Telegram.WebApp;
}

let currentPage = 'evolution';
let clickPower = 1;
let passiveIncome = 0;

// Evolution Stages
const stages = [
    { name: "Клетка", desc: "Ты — капля в океане. Но в тебе — потенциал вселенной.", threshold: 0, color: "from-blue-400 to-cyan-500" },
    { name: "Амёба", desc: "Ты научился двигаться. Первый шаг к чему-то большему...", threshold: 1000, color: "from-green-400 to-emerald-500" },
    { name: "Медуза", desc: "Ты паришь в бездне. Свет притягивает тебя вверх.", threshold: 5000, color: "from-purple-400 to-pink-500" },
    { name: "Рыба", desc: "Ты покорил глубины. Что скрывает поверхность?", threshold: 25000, color: "from-cyan-400 to-blue-500" },
    { name: "Ящер", desc: "Ты вышел на сушу. Мир стал больше.", threshold: 150000, color: "from-amber-400 to-orange-500" },
    { name: "Птица", desc: "Крылья. Ветер. Свобода. Но кто дал тебе их?..", threshold: 1000000, color: "from-rose-400 to-pink-500" },
    { name: "Обезьяна", desc: "Ты думаешь. Ты создаёшь. Ты — не просто плоть.", threshold: 7000000, color: "from-amber-600 to-yellow-700" },
    { name: "Человек", desc: "Цивилизация. Технологии. Но куда ведёт этот путь?", threshold: 50000000, color: "from-slate-600 to-slate-800" },
    { name: "Киборг", desc: "Плоть и сталь. Ты больше не человек. Ты — следующий шаг.", threshold: 400000000, color: "from-gray-700 to-blue-900" },
    { name: "Пришелец", desc: "Ты покинул свою планету. Вселенная зовёт.", threshold: 3500000000, color: "from-indigo-600 to-purple-800" },
    { name: "Бог Генома", desc: "Ты — создатель. Ты — генезис. Что дальше?", threshold: 50000000000, color: "from-yellow-400 via-red-500 to-purple-600" }
];

// Upgrades by Evolution Stage
const stageUpgrades = {
    // Клетка (Stage 0)
    0: {
        click: [
            { id: "cell_membrane", name: "Усиление мембраны", effect: 1, cost: 100, desc: "+1 GENO за клик", level: 0 },
            { id: "cell_energy", name: "Клеточная энергия", effect: 5, cost: 200, desc: "+5 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "basic_metabolism", name: "Базовый метаболизм", effect: 0.5, cost: 300, desc: "+0.5 GENO/мин", level: 0 },
            { id: "cell_division", name: "Деление клетки", effect: 1, cost: 500, desc: "+1 GENO/мин", level: 0 },
            { id: "protein_synthesis", name: "Синтез белков", effect: 2, cost: 800, desc: "+2 GENO/мин", level: 0 }
        ]
    },
    // Амёба (Stage 1)
    1: {
        click: [
            { id: "pseudopod_strength", name: "Сила псевдоподий", effect: 2, cost: 2000, desc: "+2 GENO за клик", level: 0 },
            { id: "amoeba_energy", name: "Энергия амёбы", effect: 10, cost: 3000, desc: "+10 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "amoeba_movement", name: "Движение амёбы", effect: 3, cost: 4000, desc: "+3 GENO/мин", level: 0 },
            { id: "phagocytosis", name: "Фагоцитоз", effect: 5, cost: 6000, desc: "+5 GENO/мин", level: 0 },
            { id: "cytoplasm_flow", name: "Ток цитоплазмы", effect: 8, cost: 10000, desc: "+8 GENO/мин", level: 0 }
        ]
    },
    // Медуза (Stage 2)
    2: {
        click: [
            { id: "tentacle_strike", name: "Удар щупалец", effect: 5, cost: 15000, desc: "+5 GENO за клик", level: 0 },
            { id: "jellyfish_energy", name: "Энергия медузы", effect: 15, cost: 20000, desc: "+15 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "bioluminescence", name: "Биолюминесценция", effect: 12, cost: 25000, desc: "+12 GENO/мин", level: 0 },
            { id: "water_jet", name: "Водяная струя", effect: 18, cost: 35000, desc: "+18 GENO/мин", level: 0 },
            { id: "nervous_net", name: "Нервная сеть", effect: 25, cost: 50000, desc: "+25 GENO/мин", level: 0 }
        ]
    },
    // Рыба (Stage 3)
    3: {
        click: [
            { id: "fin_power", name: "Мощность плавников", effect: 10, cost: 100000, desc: "+10 GENO за клик", level: 0 },
            { id: "fish_energy", name: "Энергия рыбы", effect: 20, cost: 120000, desc: "+20 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "swimming_muscles", name: "Плавательные мышцы", effect: 40, cost: 150000, desc: "+40 GENO/мин", level: 0 },
            { id: "gills_efficiency", name: "Эффективность жабр", effect: 60, cost: 200000, desc: "+60 GENO/мин", level: 0 },
            { id: "lateral_line", name: "Боковая линия", effect: 80, cost: 300000, desc: "+80 GENO/мин", level: 0 }
        ]
    },
    // Ящер (Stage 4)
    4: {
        click: [
            { id: "claw_strength", name: "Сила когтей", effect: 20, cost: 800000, desc: "+20 GENO за клик", level: 0 },
            { id: "lizard_energy", name: "Энергия ящера", effect: 25, cost: 1000000, desc: "+25 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "scales_protection", name: "Защита чешуи", effect: 120, cost: 1200000, desc: "+120 GENO/мин", level: 0 },
            { id: "tail_balance", name: "Баланс хвоста", effect: 180, cost: 1800000, desc: "+180 GENO/мин", level: 0 },
            { id: "cold_blood", name: "Холоднокровность", effect: 250, cost: 2500000, desc: "+250 GENO/мин", level: 0 }
        ]
    },
    // Птица (Stage 5)
    5: {
        click: [
            { id: "wing_beat", name: "Взмах крыльев", effect: 50, cost: 5000000, desc: "+50 GENO за клик", level: 0 },
            { id: "bird_energy", name: "Энергия птицы", effect: 30, cost: 6000000, desc: "+30 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "flight_muscles", name: "Летательные мышцы", effect: 400, cost: 7000000, desc: "+400 GENO/мин", level: 0 },
            { id: "hollow_bones", name: "Полые кости", effect: 600, cost: 10000000, desc: "+600 GENO/мин", level: 0 },
            { id: "air_sacs", name: "Воздушные мешки", effect: 800, cost: 15000000, desc: "+800 GENO/мин", level: 0 }
        ]
    },
    // Обезьяна (Stage 6)
    6: {
        click: [
            { id: "grip_strength", name: "Сила хвата", effect: 100, cost: 30000000, desc: "+100 GENO за клик", level: 0 },
            { id: "monkey_energy", name: "Энергия обезьяны", effect: 35, cost: 35000000, desc: "+35 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "tool_use", name: "Использование орудий", effect: 1200, cost: 40000000, desc: "+1200 GENO/мин", level: 0 },
            { id: "social_intelligence", name: "Социальный интеллект", effect: 1800, cost: 60000000, desc: "+1800 GENO/мин", level: 0 },
            { id: "opposable_thumbs", name: "Противопоставленные пальцы", effect: 2500, cost: 80000000, desc: "+2500 GENO/мин", level: 0 }
        ]
    },
    // Человек (Stage 7)
    7: {
        click: [
            { id: "human_intelligence", name: "Человеческий интеллект", effect: 200, cost: 200000000, desc: "+200 GENO за клик", level: 0 },
            { id: "human_energy", name: "Энергия человека", effect: 40, cost: 250000000, desc: "+40 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "language", name: "Язык", effect: 4000, cost: 300000000, desc: "+4000 GENO/мин", level: 0 },
            { id: "agriculture", name: "Земледелие", effect: 6000, cost: 450000000, desc: "+6000 GENO/мин", level: 0 },
            { id: "technology", name: "Технологии", effect: 8000, cost: 600000000, desc: "+8000 GENO/мин", level: 0 }
        ]
    },
    // Киборг (Stage 8)
    8: {
        click: [
            { id: "cyber_enhancement", name: "Кибер-усиление", effect: 500, cost: 1500000000, desc: "+500 GENO за клик", level: 0 },
            { id: "cyborg_energy", name: "Энергия киборга", effect: 50, cost: 1800000000, desc: "+50 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "neural_interface", name: "Нейроинтерфейс", effect: 15000, cost: 2000000000, desc: "+15000 GENO/мин", level: 0 },
            { id: "artificial_organs", name: "Искусственные органы", effect: 22000, cost: 3000000000, desc: "+22000 GENO/мин", level: 0 },
            { id: "quantum_processor", name: "Квантовый процессор", effect: 30000, cost: 4000000000, desc: "+30000 GENO/мин", level: 0 }
        ]
    },
    // Пришелец (Stage 9)
    9: {
        click: [
            { id: "alien_technology", name: "Инопланетные технологии", effect: 1000, cost: 12000000000, desc: "+1000 GENO за клик", level: 0 },
            { id: "alien_energy", name: "Энергия пришельца", effect: 60, cost: 15000000000, desc: "+60 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "telepathy", name: "Телепатия", effect: 50000, cost: 18000000000, desc: "+50000 GENO/мин", level: 0 },
            { id: "dimensional_travel", name: "Межпространственные путешествия", effect: 75000, cost: 25000000000, desc: "+75000 GENO/мин", level: 0 },
            { id: "cosmic_consciousness", name: "Космическое сознание", effect: 100000, cost: 35000000000, desc: "+100000 GENO/мин", level: 0 }
        ]
    },
    // Бог Генома (Stage 10)
    10: {
        click: [
            { id: "divine_power", name: "Божественная сила", effect: 2000, cost: 100000000000, desc: "+2000 GENO за клик", level: 0 },
            { id: "god_energy", name: "Энергия бога", effect: 100, cost: 120000000000, desc: "+100 к максимальной энергии", level: 0, type: "energy" }
        ],
        passive: [
            { id: "creation_power", name: "Сила творения", effect: 200000, cost: 150000000000, desc: "+200000 GENO/мин", level: 0 },
            { id: "universal_control", name: "Контроль вселенной", effect: 300000, cost: 200000000000, desc: "+300000 GENO/мин", level: 0 },
            { id: "genome_mastery", name: "Мастерство генома", effect: 500000, cost: 300000000000, desc: "+500000 GENO/мин", level: 0 }
        ]
    }
};

// Tasks
const tasks = [
    // Stage progression tasks
    { id: "reach_amoeba", title: "Эволюция в амёбу", desc: "Достигни этапа 'Амёба'", reward: 2000, check: (data) => data.stageIndex >= 1, unlockLevel: 0 },
    { id: "reach_jellyfish", title: "Эволюция в медузу", desc: "Достигни этапа 'Медуза'", reward: 10000, check: (data) => data.stageIndex >= 2, unlockLevel: 1 },
    { id: "reach_fish", title: "Эволюция в рыбу", desc: "Достигни этапа 'Рыба'", reward: 50000, check: (data) => data.stageIndex >= 3, unlockLevel: 2 },
    { id: "reach_lizard", title: "Эволюция в ящера", desc: "Достигни этапа 'Ящер'", reward: 200000, check: (data) => data.stageIndex >= 4, unlockLevel: 3 },
    { id: "reach_bird", title: "Эволюция в птицу", desc: "Достигни этапа 'Птица'", reward: 1000000, check: (data) => data.stageIndex >= 5, unlockLevel: 4 },
    { id: "reach_monkey", title: "Эволюция в обезьяну", desc: "Достигни этапа 'Обезьяна'", reward: 5000000, check: (data) => data.stageIndex >= 6, unlockLevel: 5 },
    { id: "reach_human", title: "Эволюция в человека", desc: "Достигни этапа 'Человек'", reward: 20000000, check: (data) => data.stageIndex >= 7, unlockLevel: 6 },
    { id: "reach_cyborg", title: "Эволюция в киборга", desc: "Достигни этапа 'Киборг'", reward: 100000000, check: (data) => data.stageIndex >= 8, unlockLevel: 7 },
    { id: "reach_alien", title: "Эволюция в пришельца", desc: "Достигни этапа 'Пришелец'", reward: 500000000, check: (data) => data.stageIndex >= 9, unlockLevel: 8 },
    { id: "reach_god", title: "Эволюция в бога", desc: "Достигни этапа 'Бог Генома'", reward: 2000000000, check: (data) => data.stageIndex >= 10, unlockLevel: 9 },
    
    // Other tasks
    { id: "first_click", title: "Первый контакт", desc: "Сделай 100 кликов", reward: 100, check: (data) => data.totalClicks >= 100, unlockLevel: 0 },
    { id: "energy_master", title: "Мастер энергии", desc: "Восстанови энергию 10 раз", reward: 500, check: (data) => (data.lastEnergyRecovery - data.lastActiveTime) / 30000 > 10, unlockLevel: 1 },
    { id: "first_upgrade", title: "Пробуждение гена", desc: "Купи первое улучшение", reward: 1000, check: (data) => [...data.upgrades.click, ...data.upgrades.passive].length > 0, unlockLevel: 2 },
    { id: "reach_lizard", title: "Выход на сушу", desc: "Достигни стадии Ящер", reward: 5000, check: (data) => data.stageIndex >= 4, unlockLevel: 3 },
    { id: "invite_friend", title: "Распространение гена", desc: "Пригласи друга", reward: 10000, check: (data) => data.referrals.length > 0, unlockLevel: 4 },
    { id: "click_master", title: "Мастер кликов", desc: "Сделай 1000 кликов", reward: 2000, check: (data) => data.totalClicks >= 1000, unlockLevel: 5 },
    { id: "geno_collector", title: "Собиратель GENO", desc: "Заработай 10000 GENO", reward: 5000, check: (data) => data.totalGenoEarned >= 10000, unlockLevel: 6 },
    { id: "upgrade_expert", title: "Эксперт улучшений", desc: "Купи 5 улучшений", reward: 3000, check: (data) => [...data.upgrades.click, ...data.upgrades.passive].length >= 5, unlockLevel: 7 },
    { id: "energy_optimizer", title: "Оптимизатор энергии", desc: "Достигни 200 максимальной энергии", reward: 4000, check: (data) => data.maxEnergy >= 200, unlockLevel: 8 },
    { id: "evolution_master", title: "Мастер эволюции", desc: "Достигни стадии Человек", reward: 10000, check: (data) => data.stageIndex >= 7, unlockLevel: 9 },
    { id: "passive_income", title: "Пассивный доход", desc: "Заработай 1000 GENO пассивно", reward: 2000, check: (data) => data.passiveAccumulated >= 1000, unlockLevel: 10 },
    { id: "click_power", title: "Сила клика", desc: "Достигни 100 GENO за клик", reward: 5000, check: (data) => getClickPower() >= 100, unlockLevel: 11 },
    { id: "energy_efficiency", title: "Энергоэффективность", desc: "Купи 3 энергетических улучшения", reward: 3000, check: (data) => data.upgrades.click.filter(id => clickUpgrades.find(u => u.id === id)?.type === "energy").length >= 3, unlockLevel: 12 },
    { id: "genome_god", title: "Бог генома", desc: "Достигни финальной стадии", reward: 50000, check: (data) => data.stageIndex >= 10, unlockLevel: 13 },
    { id: "referral_network", title: "Реферальная сеть", desc: "Пригласи 3 друзей", reward: 15000, check: (data) => data.referrals.length >= 3, unlockLevel: 14 },
    { id: "task_completer", title: "Выполнитель заданий", desc: "Выполни 10 заданий", reward: 8000, check: (data) => data.completedTasks.length >= 10, unlockLevel: 15 },
    { id: "energy_overflow", title: "Переполнение энергии", desc: "Достигни 500 максимальной энергии", reward: 10000, check: (data) => data.maxEnergy >= 500, unlockLevel: 16 },
    { id: "passive_master", title: "Мастер пассивного дохода", desc: "Заработай 10000 GENO пассивно", reward: 12000, check: (data) => data.passiveAccumulated >= 10000, unlockLevel: 17 },
    { id: "click_legend", title: "Легенда кликов", desc: "Сделай 10000 кликов", reward: 20000, check: (data) => data.totalClicks >= 10000, unlockLevel: 18 },
    { id: "ultimate_evolution", title: "Ультимативная эволюция", desc: "Достигни всех стадий и выполни все задания", reward: 100000, check: (data) => data.stageIndex >= 10 && data.completedTasks.length >= 19, unlockLevel: 19 },
    { id: "genetic_engineer", title: "Генетический инженер", desc: "Купи 15 улучшений", reward: 15000, check: (data) => [...data.upgrades.click, ...data.upgrades.passive].length >= 15, unlockLevel: 20 },
    { id: "energy_tycoon", title: "Энергетический магнат", desc: "Достигни 1000 максимальной энергии", reward: 25000, check: (data) => data.maxEnergy >= 1000, unlockLevel: 21 },
    { id: "click_tycoon", title: "Магнат кликов", desc: "Сделай 50000 кликов", reward: 30000, check: (data) => data.totalClicks >= 50000, unlockLevel: 22 },
    { id: "passive_tycoon", title: "Магнат пассивного дохода", desc: "Заработай 100000 GENO пассивно", reward: 35000, check: (data) => data.passiveAccumulated >= 100000, unlockLevel: 23 },
    { id: "referral_king", title: "Король рефералов", desc: "Пригласи 10 друзей", reward: 40000, check: (data) => data.referrals.length >= 10, unlockLevel: 24 },
    { id: "booster_master", title: "Мастер бустеров", desc: "Активируй 20 бустеров", reward: 20000, check: (data) => Object.keys(data.activeBoosters).length >= 20, unlockLevel: 25 },
    { id: "genome_collector", title: "Коллекционер генома", desc: "Заработай 1 миллиард GENO", reward: 50000, check: (data) => data.totalGenoEarned >= 1000000000, unlockLevel: 26 },
    { id: "evolution_speedrun", title: "Спидран эволюции", desc: "Достигни стадии Человек за 1 день", reward: 30000, check: (data) => data.stageIndex >= 7 && (Date.now() - data.lastActiveTime) < 86400000, unlockLevel: 27 },
    { id: "perfect_efficiency", title: "Идеальная эффективность", desc: "Достигни 100% эффективности энергии", reward: 25000, check: (data) => data.upgrades.click.filter(id => clickUpgrades.find(u => u.id === id)?.type === "efficiency").length >= 5, unlockLevel: 28 }
];

// Boosters
const boosters = [
    { id: "energy_boost_12h", name: "Энергетический буст 12ч", duration: 12 * 60 * 60 * 1000, basePrice: 10, desc: "Пассивный доход не останавливается 12 часов", currency: "stars" },
    { id: "energy_boost_24h", name: "Энергетический буст 24ч", duration: 24 * 60 * 60 * 1000, basePrice: 18, desc: "Пассивный доход не останавливается 24 часа", currency: "stars" },
    { id: "energy_boost_48h", name: "Энергетический буст 48ч", duration: 48 * 60 * 60 * 1000, basePrice: 32, desc: "Пассивный доход не останавливается 48 часов", currency: "stars" },
    { id: "energy_boost_72h", name: "Энергетический буст 72ч", duration: 72 * 60 * 60 * 1000, basePrice: 45, desc: "Пассивный доход не останавливается 72 часа", currency: "stars" },
    { id: "click_multiplier_1h", name: "Множитель кликов 1ч", duration: 60 * 60 * 1000, basePrice: 15, desc: "x2 к силе кликов на 1 час", currency: "stars" },
    { id: "click_multiplier_3h", name: "Множитель кликов 3ч", duration: 3 * 60 * 60 * 1000, basePrice: 25, desc: "x2 к силе кликов на 3 часа", currency: "stars" },
    { id: "passive_multiplier_6h", name: "Множитель пассивного дохода 6ч", duration: 6 * 60 * 60 * 1000, basePrice: 20, desc: "x3 к пассивному доходу на 6 часов", currency: "stars" },
    { id: "energy_refill", name: "Полное восстановление энергии", duration: 0, basePrice: 1, desc: "Мгновенно восстанавливает всю энергию", currency: "stars" },
    { id: "genetic_accelerator", name: "Генетический ускоритель", duration: 12 * 60 * 60 * 1000, basePrice: 35, desc: "x5 к скорости эволюции на 12 часов", currency: "stars" },
    { id: "cosmic_harvester", name: "Космический сборщик", duration: 48 * 60 * 60 * 1000, basePrice: 50, desc: "Автоматически собирает пассивный доход 48 часов", currency: "stars" }
];

// Utility Functions
function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return Math.floor(num).toString();
}

function getClickPower() {
    let power = 1;
    
    // Calculate power from all stages
    for (let stageId = 0; stageId <= gameState.stageIndex; stageId++) {
        if (stageUpgrades[stageId] && gameState.upgrades.click[stageId]) {
            stageUpgrades[stageId].click.forEach(upgrade => {
                if (upgrade.type !== "energy" && gameState.upgrades.click[stageId][upgrade.id]) {
                    const level = gameState.upgrades.click[stageId][upgrade.id];
                    power += upgrade.effect * (1 + Math.sqrt(level) * 0.8);
                }
            });
        }
    }
    
    return Math.floor(power);
}

function getPassiveIncome() {
    let income = 0;
    
    // Calculate income from all stages
    for (let stageId = 0; stageId <= gameState.stageIndex; stageId++) {
        if (stageUpgrades[stageId] && gameState.upgrades.passive[stageId]) {
            stageUpgrades[stageId].passive.forEach(upgrade => {
                if (gameState.upgrades.passive[stageId][upgrade.id]) {
                    const level = gameState.upgrades.passive[stageId][upgrade.id];
                    income += upgrade.effect * (1 + Math.sqrt(level) * 0.5);
                }
            });
        }
    }
    
    return Math.floor(income);
}

function getUpgradeCost(upgrade) {
    return Math.floor(upgrade.cost * Math.pow(2, upgrade.level));
}

function getCurrentStage() {
    return stages[gameState.stageIndex];
}

function getNextStage() {
    return stages[gameState.stageIndex + 1] || null;
}

function checkStageEvolution() {
    const currentStage = getCurrentStage();
    const nextStage = getNextStage();
    
    if (nextStage && gameState.geno >= nextStage.threshold) {
        gameState.stageIndex++;
        showNotification(`Эволюция! Теперь ты ${nextStage.name}!`);
        updateStageInfo();
        
        // Reset progress bar for new stage
        updateProgressBar();
        
        // Check and complete stage progression tasks
        checkTasks();
    }
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Game Actions
function handleClick() {
    const power = getClickPower();
    
    if (gameState.energy < power) {
        showNotification('Недостаточно энергии!');
        return;
    }
    
    gameState.geno += power;
    gameState.energy -= power; // Энергия = GENO за клик
    gameState.totalClicks++;
    gameState.totalGenoEarned += power;
    gameState.lastActiveTime = Date.now();
    
    // Visual effect
    const clickEffect = document.getElementById('clickEffect');
    clickEffect.classList.add('active');
    setTimeout(() => {
        clickEffect.classList.remove('active');
    }, 600);
    
    updateDisplay();
    checkStageEvolution();
    saveGame();
    sendChangesToBackend();
}

function buyUpgrade(upgrade, type, stageId) {
    const currentLevel = gameState.upgrades[type][stageId] ? 
        (gameState.upgrades[type][stageId][upgrade.id] || 0) : 0;
    const cost = Math.floor(upgrade.cost * Math.pow(2, currentLevel));
    
    
    if (gameState.geno < cost) {
        showNotification(`Недостаточно GENO! Нужно: ${formatNumber(cost)}, есть: ${formatNumber(gameState.geno)}`);
        return;
    }
    
    gameState.geno -= cost;
    
    // Initialize stage upgrades if not exists
    if (!gameState.upgrades[type][stageId]) {
        gameState.upgrades[type][stageId] = {};
    }
    
    // Increase upgrade level
    gameState.upgrades[type][stageId][upgrade.id] = currentLevel + 1;
    
    // Handle energy upgrades
    if (upgrade.type === "energy") {
        gameState.maxEnergy += upgrade.effect;
        gameState.energy = Math.min(gameState.energy + upgrade.effect, gameState.maxEnergy);
    }
    
    updateDisplay();
    generateUpgrades();
    showNotification(`Куплено: ${upgrade.name} (Ур. ${currentLevel + 1})`);
    saveGame();
    sendChangesToBackend();
}

function checkTasks() {
    // Check all tasks and auto-complete stage progression tasks
    tasks.forEach(task => {
        if (!gameState.completedTasks.includes(task.id) && task.check(gameState)) {
            // Auto-complete stage progression tasks
            if (task.id.startsWith('reach_')) {
                gameState.geno += task.reward;
                gameState.completedTasks.push(task.id);
                gameState.totalGenoEarned += task.reward;
                showNotification(`Задание выполнено: ${task.title} (+${formatNumber(task.reward)} GENO)`);
            }
        }
    });
    
    updateDisplay();
    generateTasks();
}

function completeTask(task) {
    if (gameState.completedTasks.includes(task.id)) return;
    
    gameState.geno += task.reward;
    gameState.completedTasks.push(task.id);
    gameState.totalGenoEarned += task.reward;
    
    updateDisplay();
    generateTasks();
    showNotification(`Задание выполнено: ${task.title} (+${task.reward} GENO)`);
    saveGame();
}

function buyBooster(booster) {
    if (booster.currency === 'stars') {
        if (!spendTelegramStars(booster.basePrice)) {
            showNotification('Недостаточно Telegram Stars!');
            return;
        }
    } else {
        if (gameState.geno < booster.basePrice) {
            showNotification('Недостаточно GENO!');
            return;
        }
        gameState.geno -= booster.basePrice;
    }
    
    // Handle instant boosters (duration = 0)
    if (booster.duration === 0) {
        if (booster.id === 'energy_refill') {
            // Полное восстановление энергии
            gameState.energy = gameState.maxEnergy;
            gameState.lastEnergyRecovery = Date.now(); // Reset recovery timer
            showNotification(`Энергия полностью восстановлена! (${gameState.maxEnergy})`);
        }
    } else {
        // Handle timed boosters
        gameState.activeBoosters[booster.id] = Date.now() + booster.duration;
        showNotification(`Активирован: ${booster.name}`);
    }
    
    updateDisplay();
    generateBoosters();
    saveGame();
}

// Display Updates
function updateDisplay() {
    // Update GENO
    document.getElementById('genoValue').textContent = formatNumber(gameState.geno);
    
    // Update Telegram Stars
    document.getElementById('starsValue').textContent = formatNumber(gameState.telegramStars);
    
    // Update Energy
    const energyPercent = (gameState.energy / gameState.maxEnergy) * 100;
    document.getElementById('energyFill').style.width = `${energyPercent}%`;
    document.getElementById('energyText').textContent = `${gameState.energy}/${gameState.maxEnergy}`;
    
    // Update Click Power
    clickPower = getClickPower();
    document.getElementById('clickPower').textContent = `+${formatNumber(clickPower)} GENO`;
    
    // Update Stage Progress
    updateStageInfo();
    updateProgressBar();
}

function updateStageInfo() {
    const currentStage = getCurrentStage();
    const nextStage = getNextStage();
    
    document.getElementById('stageName').textContent = currentStage.name;
    document.getElementById('stageDesc').textContent = currentStage.desc;
    
    // Update next stage info on enhancement page
    const nextStageInfo = document.getElementById('nextStageInfo');
    if (nextStageInfo) {
        const nextStageDetails = nextStageInfo.querySelector('.next-stage-details');
        if (nextStageDetails) {
            if (nextStage) {
                nextStageDetails.innerHTML = `
                    <div class="next-stage-name">${nextStage.name}</div>
                    <div class="next-stage-desc">${nextStage.desc}</div>
                `;
            } else {
                nextStageDetails.innerHTML = `
                    <div class="next-stage-name">Бог Генома</div>
                    <div class="next-stage-desc">Ты достиг вершины эволюции!</div>
                `;
            }
        }
    }
}

function updateProgressBar() {
    const currentStage = getCurrentStage();
    const nextStage = getNextStage();
    
    const progressFill = document.getElementById('stageProgress');
    const progressText = document.getElementById('stageProgressText');
    
    // Debug information
    console.log('updateProgressBar called:', {
        currentStage: currentStage?.name,
        nextStage: nextStage?.name,
        geno: gameState.geno,
        progressFill: !!progressFill,
        progressText: !!progressText
    });
    
    if (nextStage) {
        // Calculate progress from current stage threshold
        const currentThreshold = currentStage.threshold;
        const nextThreshold = nextStage.threshold;
        
        // Ensure we don't go below current threshold
        const currentProgress = Math.max(0, gameState.geno - currentThreshold);
        const totalNeeded = nextThreshold - currentThreshold;
        const progress = Math.min(currentProgress / totalNeeded, 1);
        const progressPercent = progress * 100;
        
        console.log('Progress calculation:', {
            currentThreshold,
            nextThreshold,
            currentProgress,
            totalNeeded,
            progress,
            progressPercent
        });
        
        // Update progress bar
        if (progressFill) {
            progressFill.style.width = `${progressPercent}%`;
            console.log('Progress bar updated to:', `${progressPercent}%`);
        } else {
            console.error('Progress fill element not found!');
        }
        
        // Update progress text
        if (progressText) {
            progressText.textContent = `${formatNumber(currentProgress)} / ${formatNumber(totalNeeded)} GENO`;
            console.log('Progress text updated to:', progressText.textContent);
        } else {
            console.error('Progress text element not found!');
        }
    } else {
        // Maximum stage reached
        if (progressFill) {
            progressFill.style.width = '100%';
        }
        if (progressText) {
            progressText.textContent = 'Максимальная стадия достигнута!';
        }
    }
}

function generateUpgrades() {
    const clickUpgradesList = document.getElementById('clickUpgrades');
    const passiveUpgradesList = document.getElementById('passiveUpgrades');
    
    clickUpgradesList.innerHTML = '';
    passiveUpgradesList.innerHTML = '';
    
    // Generate upgrades only for current stage
    const currentStageId = gameState.stageIndex;
    if (stageUpgrades[currentStageId]) {
        const stage = stages[currentStageId];
        
        // Add stage header
        const stageHeader = document.createElement('div');
        stageHeader.className = 'stage-upgrade-header';
        stageHeader.innerHTML = `
            <h4>${stage.name}</h4>
            <div class="stage-upgrade-line"></div>
        `;
        
        // Click Upgrades for current stage
        stageUpgrades[currentStageId].click.forEach(upgrade => {
            const currentLevel = gameState.upgrades.click[currentStageId] ? 
                (gameState.upgrades.click[currentStageId][upgrade.id] || 0) : 0;
            const cost = Math.floor(upgrade.cost * Math.pow(2, currentLevel));
            const canAfford = gameState.geno >= cost;
            
            const upgradeElement = document.createElement('div');
            upgradeElement.className = `upgrade-item ${!canAfford ? 'disabled' : ''}`;
            upgradeElement.innerHTML = `
                <div class="upgrade-icon">
                    <div class="upgrade-glow"></div>
                </div>
                <div class="upgrade-details">
                    <div class="upgrade-name">${upgrade.name} ${currentLevel > 0 ? `(Ур. ${currentLevel})` : ''}</div>
                    <div class="upgrade-desc">${upgrade.desc}</div>
                    <div class="upgrade-cost">${formatNumber(cost)} GENO</div>
                </div>
            `;
            
            if (canAfford) {
                upgradeElement.addEventListener('click', () => buyUpgrade(upgrade, 'click', currentStageId));
            }
            
            clickUpgradesList.appendChild(upgradeElement);
        });
        
        // Passive Upgrades for current stage
        stageUpgrades[currentStageId].passive.forEach(upgrade => {
            const currentLevel = gameState.upgrades.passive[currentStageId] ? 
                (gameState.upgrades.passive[currentStageId][upgrade.id] || 0) : 0;
            const cost = Math.floor(upgrade.cost * Math.pow(2, currentLevel));
            const canAfford = gameState.geno >= cost;
            
            const upgradeElement = document.createElement('div');
            upgradeElement.className = `upgrade-item ${!canAfford ? 'disabled' : ''}`;
            upgradeElement.innerHTML = `
                <div class="upgrade-icon">
                    <div class="upgrade-glow"></div>
                </div>
                <div class="upgrade-details">
                    <div class="upgrade-name">${upgrade.name} ${currentLevel > 0 ? `(Ур. ${currentLevel})` : ''}</div>
                    <div class="upgrade-desc">${upgrade.desc}</div>
                    <div class="upgrade-cost">${formatNumber(cost)} GENO</div>
                </div>
            `;
            
            if (canAfford) {
                upgradeElement.addEventListener('click', () => buyUpgrade(upgrade, 'passive', currentStageId));
            }
            
            passiveUpgradesList.appendChild(upgradeElement);
        });
    }
}

function generateTasks() {
    const tasksList = document.getElementById('tasksList');
    tasksList.innerHTML = '';
    
    // Show more tasks since we have scroll now
    const availableTasks = tasks.filter(task => 
        !gameState.completedTasks.includes(task.id) && 
        task.unlockLevel <= gameState.completedTasks.length
    ).slice(0, 10); // Show 10 tasks instead of 5
    
    availableTasks.forEach(task => {
        const isCompleted = task.check(gameState);
        
        const taskElement = document.createElement('div');
        taskElement.className = `task-item ${isCompleted ? 'completed' : ''}`;
        taskElement.innerHTML = `
            <div class="task-icon">
                ${isCompleted ? '✓' : '○'}
            </div>
            <div class="task-details">
                <div class="task-title">${task.title}</div>
                <div class="task-desc">${task.desc}</div>
                <div class="task-reward">+${formatNumber(task.reward)} GENO</div>
            </div>
        `;
        
        if (isCompleted) {
            taskElement.addEventListener('click', () => completeTask(task));
        }
        
        tasksList.appendChild(taskElement);
    });
}

function generateBoosters() {
    const boostersList = document.getElementById('boostersList');
    boostersList.innerHTML = '';
    
    boosters.forEach(booster => {
        const canAfford = booster.currency === 'stars' ? 
            gameState.telegramStars >= booster.basePrice : 
            gameState.geno >= booster.basePrice;
        const isActive = gameState.activeBoosters[booster.id] && gameState.activeBoosters[booster.id] > Date.now();
        
        const boosterElement = document.createElement('div');
        boosterElement.className = `booster-item ${!canAfford ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
        boosterElement.innerHTML = `
            <div class="booster-icon">
                <div class="booster-glow"></div>
            </div>
            <div class="booster-details">
                <div class="booster-name">${booster.name}</div>
                <div class="booster-desc">${booster.desc}</div>
                <div class="booster-cost">${formatNumber(booster.basePrice)} ${booster.currency === 'stars' ? '⭐' : 'GENO'}</div>
            </div>
        `;
        
        if (canAfford && !isActive) {
            boosterElement.addEventListener('click', () => buyBooster(booster));
        }
        
        boostersList.appendChild(boosterElement);
    });
}

// Page Navigation
function switchPage(page) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.querySelector(`[data-page="${page}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
    }
    
    // Update page content
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(page + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    currentPage = page;
    
    // Update content based on page
    if (page === 'enhancement') {
        generateUpgrades();
        generateTasks();
    } else if (page === 'laboratory') {
        generateBoosters();
        updateReferralInfo();
    } else if (page === 'leaderboard') {
        loadLeaderboard();
    }
}

// Tab Navigation
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
}

// Referral System
function updateReferralInfo() {
    const referralInput = document.getElementById('referralInput');
    const referralCount = document.getElementById('referralCount');
    const referralBonus = document.getElementById('referralBonus');
    
    referralInput.value = getReferralLink();
    referralCount.textContent = gameState.referrals ? gameState.referrals.length : 0;
    referralBonus.textContent = formatNumber((gameState.referrals ? gameState.referrals.length : 0) * 1000);
}

function copyReferralLink() {
    const referralInput = document.getElementById('referralInput');
    referralInput.select();
    document.execCommand('copy');
    showNotification('Ссылка скопирована!');
}

// Game Loop
function gameLoop() {
    const now = Date.now();
    
    // Energy Recovery (1 hour for full recovery regardless of max energy)
    const energyRecoveryRate = gameState.maxEnergy / 3600; // Energy per second for 1 hour recovery
    const secondsPassed = (now - gameState.lastEnergyRecovery) / 1000;
    
    if (secondsPassed > 0) {
        const energyToAdd = Math.floor(energyRecoveryRate * secondsPassed);
        if (energyToAdd > 0) {
            const oldEnergy = gameState.energy;
            gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + energyToAdd);
            
            // Always update lastEnergyRecovery when we process energy recovery
            gameState.lastEnergyRecovery = now;
            
            // Debug log for energy recovery
            if (gameState.energy !== oldEnergy) {
                console.log(`Energy recovered: ${oldEnergy} -> ${gameState.energy} (+${energyToAdd})`);
            }
        }
    }
    
    // Passive Income
    const minutesPassed = (now - gameState.lastPassiveGenTime) / 60000;
    if (minutesPassed > 0) {
        const passivePerMinute = getPassiveIncome();
        if (passivePerMinute > 0) {
            const passiveEarned = Math.floor(passivePerMinute * minutesPassed);
            gameState.passiveAccumulated += passiveEarned;
            gameState.lastPassiveGenTime = now;
        }
    }
    
    // Check for passive income collection timeout (3 hours)
    const hoursSinceCollection = (now - gameState.lastPassiveCollection) / 3600000;
    if (hoursSinceCollection >= 3) {
        // Check if any active boosters prevent timeout
        let hasActiveBooster = false;
        Object.keys(gameState.activeBoosters).forEach(boosterId => {
            if (gameState.activeBoosters[boosterId] > now) {
                hasActiveBooster = true;
            }
        });
        
        if (!hasActiveBooster) {
            // Passive income stops
            gameState.passiveAccumulated = 0;
        }
    }
    
    updateDisplay();
    saveGame();
    
    // Send data to backend every 5 seconds
    if (Math.floor(now / 1000) % 5 === 0) {
        sendChangesToBackend();
    }
    
    // Submit to leaderboard every 30 seconds
    if (Math.floor(now / 1000) % 30 === 0) {
        submitToLeaderboard();
    }
}

// Save/Load Game
async function saveGame() {
    if (isInTelegramWebApp()) {
        // Save to backend via API
        try {
            const response = await fetch(`${backendUrl}/api/update-player/${gameState.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gameState)
            });
            
            if (response.ok) {
                console.log('Game saved to backend');
            } else {
                console.error('Error saving to backend:', response.status);
                // Fallback to Telegram Cloud Storage
                window.Telegram.WebApp.CloudStorage.setItem('genoPlayer', JSON.stringify(gameState), (error) => {
                    if (error) {
                        console.error('Error saving to Telegram Cloud Storage:', error);
                    } else {
                        console.log('Game saved to Telegram Cloud Storage (fallback)');
                    }
                });
            }
        } catch (error) {
            console.error('Error saving to backend:', error);
            // Fallback to Telegram Cloud Storage
            window.Telegram.WebApp.CloudStorage.setItem('genoPlayer', JSON.stringify(gameState), (error) => {
                if (error) {
                    console.error('Error saving to Telegram Cloud Storage:', error);
                } else {
                    console.log('Game saved to Telegram Cloud Storage (fallback)');
                }
            });
        }
        
        // Also ping backend to keep it alive
        pingBackend();
    } else {
        // Fallback to localStorage for testing
        localStorage.setItem('genoPlayer', JSON.stringify(gameState));
        console.log('Game saved to localStorage (testing mode)');
    }
}

async function loadGame() {
    if (isInTelegramWebApp()) {
        // Try to load from backend first
        try {
            const response = await fetch(`${backendUrl}/api/player-data/${gameState.id}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.player) {
                    gameState = { ...gameState, ...data.player };
                    // Reset energy recovery timer to prevent instant energy recovery
                    gameState.lastEnergyRecovery = Date.now();
                    console.log('Game loaded from backend');
                    checkReferral();
                    updateDisplay();
                    return;
                }
            }
        } catch (error) {
            console.log('Backend not available, trying Telegram Cloud Storage');
        }
        
        // Fallback to Telegram Cloud Storage
        window.Telegram.WebApp.CloudStorage.getItem('genoPlayer', (error, result) => {
            if (!error && result) {
                const savedData = JSON.parse(result);
                gameState = { ...gameState, ...savedData };
                // Reset energy recovery timer to prevent instant energy recovery
                gameState.lastEnergyRecovery = Date.now();
                console.log('Game loaded from Telegram Cloud Storage');
            } else {
                console.log('No saved data found, creating new player');
                // ID is already set in initTelegramWebApp()
            }
            
            // Check for referral after loading
            checkReferral();
            updateDisplay();
        });
    } else {
        // Fallback to localStorage for testing
        const saved = localStorage.getItem('genoPlayer');
        if (saved) {
            const savedData = JSON.parse(saved);
            gameState = { ...gameState, ...savedData };
            console.log('Game loaded from localStorage (testing mode)');
        }
        
        // Check for referral
        checkReferral();
        updateDisplay();
    }
}

function checkReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('ref');
    if (refId && refId !== gameState.id && !gameState.referredBy) {
        gameState.referredBy = refId;
        gameState.geno += 1000; // Referral bonus
        showNotification('Бонус за приглашение: +1000 GENO!');
        saveGame();
    }
}

function getReferralLink() {
    if (isInTelegramWebApp()) {
        // Generate referral link for Telegram bot
        if (botUsername) {
            return `https://t.me/${botUsername}?start=ref_${gameState.id}`;
        } else {
            // Fallback if bot username not loaded yet
            return `https://t.me/genogame_bot?start=ref_${gameState.id}`;
        }
    } else {
        // Fallback for testing
        return `${window.location.origin}${window.location.pathname}?ref=${gameState.id}`;
    }
}

function shareReferralLink() {
    const referralLink = getReferralLink();
    
    if (isInTelegramWebApp()) {
        // Use Telegram Web App sharing
        window.Telegram.WebApp.openTelegramLink(referralLink);
    } else {
        // Fallback for testing - copy to clipboard
        navigator.clipboard.writeText(referralLink).then(() => {
            showNotification('Реферальная ссылка скопирована в буфер обмена!');
        }).catch(() => {
            showNotification('Реферальная ссылка: ' + referralLink);
        });
    }
}


// Ping backend to prevent it from sleeping
function pingBackend() {
    if (isInTelegramWebApp()) {
        fetch(`${backendUrl}/api/ping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: gameState.id || telegramUserId,
                timestamp: Date.now(),
                action: 'keep_alive'
            })
        }).catch(error => {
            console.log('Backend ping failed (this is normal if backend is not deployed yet):', error);
        });
    }
}

// Set up periodic backend pings
function setupBackendPings() {
    if (isInTelegramWebApp()) {
        // Ping every 5 minutes (300000 ms)
        setInterval(pingBackend, 300000);
        console.log('Backend ping system activated');
    }
}

// Telegram Stars management
function addTelegramStars(amount) {
    gameState.telegramStars += amount;
    updateDisplay();
    showNotification(`Получено ${amount} ⭐ Telegram Stars!`);
    saveGame();
}

function spendTelegramStars(amount) {
    if (gameState.telegramStars >= amount) {
        gameState.telegramStars -= amount;
        updateDisplay();
        saveGame();
        return true;
    }
    return false;
}

// Show Telegram Stars purchase interface
function showStarsPurchase() {
    if (isInTelegramWebApp()) {
        // Use Telegram Web App payment interface
        window.Telegram.WebApp.showPopup({
            title: 'Пополнить Telegram Stars',
            message: 'Выберите количество звезд для покупки:',
            buttons: [
                { id: 'stars_10', type: 'default', text: '10 ⭐ - 100₽' },
                { id: 'stars_50', type: 'default', text: '50 ⭐ - 450₽' },
                { id: 'stars_100', type: 'default', text: '100 ⭐ - 800₽' },
                { id: 'cancel', type: 'cancel', text: 'Отмена' }
            ]
        }, (buttonId) => {
            if (buttonId === 'stars_10') {
                purchaseStars(10);
            } else if (buttonId === 'stars_50') {
                purchaseStars(50);
            } else if (buttonId === 'stars_100') {
                purchaseStars(100);
            }
        });
    } else {
        // Show error message for non-Telegram environment
        showNotification('Пополнение доступно только в Telegram!');
    }
}

function purchaseStars(amount) {
    if (isInTelegramWebApp()) {
        // Request payment from backend (backend will handle bot token)
        fetch(`${backendUrl}/api/create-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: gameState.id || telegramUserId,
                amount: amount,
                currency: 'RUB'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.invoice) {
                // Use the invoice data from backend
                window.Telegram.WebApp.openInvoice(data.invoice, (status) => {
                    if (status === 'paid') {
                        addTelegramStars(amount);
                        showNotification(`Покупка ${amount} ⭐ успешна!`);
                    } else if (status === 'failed') {
                        showNotification('Ошибка при покупке. Попробуйте еще раз.');
                    } else if (status === 'cancelled') {
                        showNotification('Покупка отменена.');
                    }
                });
            } else {
                showNotification('Ошибка создания платежа. Попробуйте еще раз.');
            }
        })
        .catch(error => {
            console.error('Payment creation error:', error);
            showNotification('Ошибка соединения с сервером.');
        });
    } else {
        showNotification('Пополнение доступно только в Telegram!');
    }
}

// Leaderboard functions
async function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const userRankElement = document.getElementById('userRank');
    const totalPlayersElement = document.getElementById('totalPlayers');
    
    // Show loading state
    leaderboardList.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Загрузка рейтинга...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`${backendUrl}/api/leaderboard?userId=${gameState.id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard');
        }
        
        const data = await response.json();
        const leaderboard = data.leaderboard || [];
        const userRank = data.userRank || null;
        const totalPlayers = data.totalPlayers || 0;
        
        // Update stats
        userRankElement.textContent = userRank ? `#${userRank}` : '-';
        totalPlayersElement.textContent = totalPlayers;
        
        // Display leaderboard
        if (leaderboard.length === 0) {
            leaderboardList.innerHTML = `
                <div class="leaderboard-error">
                    <h4>Рейтинг пуст</h4>
                    <p>Пока никто не играет. Станьте первым!</p>
                </div>
            `;
            return;
        }
        
        leaderboardList.innerHTML = leaderboard.map((player, index) => {
            const isCurrentUser = player.id === gameState.id;
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            
            // Get player name with fallback
            let playerName = 'Аноним';
            if (player.name) {
                playerName = player.name;
            } else if (player.first_name) {
                playerName = player.first_name;
                if (player.last_name) {
                    playerName += ` ${player.last_name}`;
                }
            }
            
            return `
                <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}">
                    <div class="leaderboard-rank ${rankClass}">${rank}</div>
                    <div class="leaderboard-player">
                        <div class="leaderboard-name">${playerName}</div>
                        <div class="leaderboard-stage">${player.stage || 'Клетка'}</div>
                    </div>
                    <div class="leaderboard-score">
                        ${formatNumber(player.geno || 0)}
                        <div class="leaderboard-score-label">GENO</div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        leaderboardList.innerHTML = `
            <div class="leaderboard-error">
                <h4>Ошибка загрузки</h4>
                <p>Не удалось загрузить рейтинг</p>
                <button class="leaderboard-refresh" onclick="loadLeaderboard()">Попробовать снова</button>
            </div>
        `;
    }
}

// Submit player data to leaderboard
async function submitToLeaderboard() {
    if (!isInTelegramWebApp()) return;
    
    try {
        const user = window.Telegram.WebApp.initDataUnsafe?.user;
        
        // Debug: Log user data
        console.log('Telegram user data:', user);
        
        // Get user name with fallback
        let userName = 'Аноним';
        if (user?.first_name) {
            userName = user.first_name;
            if (user.last_name) {
                userName += ` ${user.last_name}`;
            }
        }
        
        const playerData = {
            id: gameState.id,
            name: userName,
            username: user?.username || null,
            first_name: user?.first_name || null,
            last_name: user?.last_name || null,
            geno: gameState.geno,
            stage: stages[gameState.stageIndex]?.name || 'Клетка',
            stageIndex: gameState.stageIndex,
            totalClicks: gameState.totalClicks,
            totalGenoEarned: gameState.totalGenoEarned,
            lastActive: Date.now()
        };
        
        await fetch(`${backendUrl}/api/leaderboard/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(playerData)
        });
    } catch (error) {
        // Silent fail - leaderboard is not critical
    }
}

// Функция для отправки изменений в backend (вызывается при каждом изменении)
async function sendChangesToBackend() {
    if (!isInTelegramWebApp()) return;
    
    try {
        const response = await fetch(`${backendUrl}/api/update-player/${gameState.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(gameState)
        });
        
        if (response.ok) {
            console.log('Changes sent to backend');
        } else {
            console.error('Error sending changes to backend:', response.status);
        }
    } catch (error) {
        console.error('Error sending changes to backend:', error);
    }
}

// Initialize Game
async function initGame() {
    // Initialize Telegram Web App first
    initTelegramWebApp();
    
    // Load game data
    await loadGame();
    
    // Event Listeners
    document.getElementById('dnaButton').addEventListener('click', handleClick);
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
        });
    });
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Copy referral link
    document.getElementById('copyBtn').addEventListener('click', copyReferralLink);
    
    // Initial display update
    updateDisplay();
    generateUpgrades();
    generateTasks();
    generateBoosters();
    updateReferralInfo();
    
    // Start game loop
    setInterval(gameLoop, 1000);
    
    // Setup backend pings to prevent Render from sleeping
    setupBackendPings();
    
    // Debug functions for testing
    window.debugEnergy = function() {
        console.log('=== Energy Debug Info ===');
        console.log('Current energy:', gameState.energy);
        console.log('Max energy:', gameState.maxEnergy);
        console.log('Last recovery time:', new Date(gameState.lastEnergyRecovery));
        console.log('Time since last recovery:', (Date.now() - gameState.lastEnergyRecovery) / 1000, 'seconds');
        console.log('Energy recovery rate:', gameState.maxEnergy / 3600, 'per second');
        console.log('Expected energy to recover:', Math.floor((gameState.maxEnergy / 3600) * ((Date.now() - gameState.lastEnergyRecovery) / 1000)));
    };
    
    window.testEnergyRecovery = function() {
        console.log('Testing energy recovery...');
        gameState.energy = 0;
        gameState.lastEnergyRecovery = Date.now();
        console.log('Energy set to 0, recovery timer reset');
    };
    
    window.debugUserData = function() {
        console.log('=== User Data Debug ===');
        console.log('Telegram Web App available:', !!window.Telegram?.WebApp);
        console.log('Init data unsafe:', window.Telegram?.WebApp?.initDataUnsafe);
        console.log('User data:', window.Telegram?.WebApp?.initDataUnsafe?.user);
        console.log('Game state ID:', gameState.id);
        console.log('Telegram user ID:', telegramUserId);
    };
    
    // Show welcome message
    if (gameState.totalClicks === 0) {
        setTimeout(() => {
            showNotification('Добро пожаловать в GENO! Нажмите на ДНК для начала эволюции!');
        }, 1000);
    }
    
    // Telegram Stars start at 0 - no initial balance
    // Stars can be earned through gameplay or purchased
    
    // Ensure display is updated after all initialization
    updateDisplay();
}

// Start the game
document.addEventListener('DOMContentLoaded', initGame);
