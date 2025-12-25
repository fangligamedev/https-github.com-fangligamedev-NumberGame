
import { Badge, UserStats, Operator } from './types';

export const LEVEL_Thresholds = Array.from({ length: 101 }, (_, i) => 
  i === 0 ? 0 : Math.floor(100 * Math.pow(i, 1.5))
);

// --- Badge Generators ---

const createBadge = (
  id: string, 
  name: string, 
  desc: string, 
  icon: string, 
  category: Badge['category'],
  condition: (s: UserStats) => boolean
): Badge => ({ id, name, description: desc, icon, category, unlocked: false, condition });

const badges: Badge[] = [];

// 1. Level Badges (Lv 1 to Lv 100) - 100 Badges
for (let i = 1; i <= 100; i++) {
  badges.push(createBadge(
    `level_${i}`,
    `等级 ${i}`,
    `达到等级 ${i}`,
    i % 10 === 0 ? '👑' : i % 5 === 0 ? '🌟' : '🌱',
    'level',
    (s) => s.level >= i
  ));
}

// 2. Total Questions (Milestones up to 10,000) - ~50 Badges
const questionMilestones = [
    1, 10, 20, 50, 80, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 
    1200, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000
];
questionMilestones.forEach(count => {
    let icon = '📝';
    if (count >= 100) icon = '🥉';
    if (count >= 500) icon = '🥈';
    if (count >= 1000) icon = '🥇';
    if (count >= 5000) icon = '🏆';
    
    badges.push(createBadge(
        `total_${count}`,
        `题海战术 ${count}`,
        `累计答对 ${count} 道题`,
        icon,
        'total',
        (s) => s.correctAnswers >= count
    ));
});

// 3. Streak Badges (Up to 100) - 20 Badges
for (let i = 5; i <= 100; i += 5) {
    badges.push(createBadge(
        `streak_${i}`,
        `专注大师 ${i}`,
        `连续答对 ${i} 道题`,
        '🔥',
        'streak',
        (s) => s.maxStreak >= i
    ));
}

// 4. Operator Mastery (4 Operators * ~20 Tiers) - 80 Badges
const ops = [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE];
const opNames = { [Operator.ADD]: '加法', [Operator.SUBTRACT]: '减法', [Operator.MULTIPLY]: '乘法', [Operator.DIVIDE]: '除法' };
const opMilestones = [10, 50, 100, 200, 500, 1000];
const opTiers = ['新手', '熟练', '高手', '大师', '王者', '传说'];

ops.forEach(op => {
    opMilestones.forEach((count, idx) => {
        badges.push(createBadge(
            `op_${op}_${count}`,
            `${opNames[op]}${opTiers[idx] || '传说'}`,
            `在${opNames[op]}中累计答对 ${count} 题`,
            '⚡',
            'operator',
            (s) => (s.operatorStats[op]?.correct || 0) >= count
        ));
    });
});

// 5. Boss Slayer - 20 Badges
for (let i = 1; i <= 20; i++) {
    badges.push(createBadge(
        `boss_${i}`,
        `屠龙勇士 ${i}`,
        `累计击败 ${i} 个BOSS`,
        '⚔️',
        'boss',
        (s) => s.bossesDefeated >= i
    ));
}

export const BADGES = badges;

// --- Rewards System ---
export const REWARDS: any[] = [
    { id: 'toy_1', name: '一个新玩具', cost: 100, icon: '🧸', type: 'toy' },
    { id: 'snack_1', name: '美味冰淇淋', cost: 50, icon: '🍦', type: 'snack' },
    { id: 'time_1', name: '玩手机 30分钟', cost: 80, icon: '🎮', type: 'time' },
    { id: 'time_2', name: '看电视 1小时', cost: 120, icon: '📺', type: 'time' },
    { id: 'snack_2', name: '一顿大餐', cost: 300, icon: '🍕', type: 'snack' },
    { id: 'custom_1', name: '实现一个愿望', cost: 1000, icon: '🧞', type: 'custom' },
];
