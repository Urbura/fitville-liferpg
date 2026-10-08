'use strict';
// Exercise the production tracker logic without starting its browser UI.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { createProgression } = require('../js/progression.js');

const source = readFileSync(join(__dirname, '../js/fitville.js'), 'utf8');
const configSource = readFileSync(join(__dirname, '../js/config.js'), 'utf8');
const progressionSource = readFileSync(join(__dirname, '../js/progression.js'), 'utf8');
const configContext = vm.createContext({});
vm.runInContext(configSource, configContext);
const config = configContext.FitQuestConfig;
const startup = '    // Startup and browser lifecycle';
assert.equal(source.split(startup).length, 2, 'Tracker startup marker must remain unique');

function tracker(now = '2026-10-08T16:00:00Z') {
  const storage = () => {
    const data = new Map();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    };
  };
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { open: true, addEventListener() {} });
    return nodes.get(id);
  };
  const clock = Date.parse(now);
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const context = vm.createContext({
    Date: Clock, URLSearchParams, Map, localStorage: storage(), sessionStorage: storage(),
    location: { search: '' },
    document: { addEventListener() {}, getElementById: node },
    console: { error: (...args) => { throw new Error(args.map(String).join(' ')); } },
  });
  const instrumented = source.replace(startup, `
    globalThis.tracker = {
      XP, MAX_LEVEL, MAX_TOTAL_LEVEL, fresh, level, readSave, recordCheckIn, skillBonus, checkInXP,
      totalSkillLevel, totalReward, TOTAL_REWARDS, weeklyCheckInCount,
      day, nextReset, nextRewardText, queueLevels, dashboard,
      state: () => state,
      setState: (value) => { state = value; },
      preview: (value) => { DEV = value !== null; devTotalLevel = value; },
      queued: () => celebrations,
    };
    return;
` + startup);
  vm.runInContext(configSource, context, { filename: 'js/config.js' });
  vm.runInContext(progressionSource, context, { filename: 'js/progression.js' });
  vm.runInContext(instrumented, context, { filename: 'js/fitville.js', timeout: 1000 });
  assert.ok(context.tracker, 'Tracker logic must load without a startup error');
  return context.tracker;
}

test('each skill level costs strictly more XP and all boundaries are correct', () => {
  const progression = createProgression(config);
  const { xpThresholds, levelForXP } = progression;
  assert.equal(levelForXP(0), 1);
  for (let skillLevel = 2; skillLevel <= 50; skillLevel++) {
    assert.equal(xpThresholds[skillLevel] - xpThresholds[skillLevel - 1], skillLevel + 3);
    assert.equal(levelForXP(xpThresholds[skillLevel] - 1), skillLevel - 1);
    assert.equal(levelForXP(xpThresholds[skillLevel]), skillLevel);
  }
  assert.equal(xpThresholds[50], 1421);
  assert.equal(levelForXP(100000), 50);
});

test('Total Level adds skill levels, ranging from 5 to 250', () => {
  const progression = createProgression(config);
  const skills = Array.from({ length: 5 }, () => ({ xp: 0 }));
  assert.equal(progression.calculateTotalLevel(skills), 5);
  skills[0].xp = 5;
  assert.equal(progression.calculateTotalLevel(skills), 6);
  skills.forEach((skill) => { skill.xp = progression.xpThresholds[50]; });
  assert.equal(progression.calculateTotalLevel(skills), 250);
});

test('check-ins award rating XP once per skill per reset day, including zero', () => {
  const t = tracker();
  assert.equal(t.recordCheckIn(0, 5).status, 'recorded');
  assert.equal(t.state().skills[0].xp, 5);
  assert.equal(t.recordCheckIn(0, 5).status, 'duplicate');
  assert.equal(t.state().skills[0].xp, 5);
  assert.equal(t.recordCheckIn(1, 0).status, 'recorded');
  assert.equal(t.recordCheckIn(1, 5).status, 'duplicate');
  assert.equal(t.recordCheckIn(2, 6).status, 'invalid');
  assert.equal(t.recordCheckIn(-1, 5).status, 'invalid');
  assert.equal(t.recordCheckIn(2, 1.5).status, 'invalid');
  assert.equal(t.recordCheckIn(2, 3).status, 'recorded');
  assert.equal(t.state().skills[2].xp, 3);
});

test('a skill can be checked in again after the daily reset', () => {
  const before = tracker('2026-10-08T09:29:59Z');
  before.recordCheckIn(0, 5);
  const after = tracker('2026-10-08T09:30:00Z');
  after.setState(after.readSave(JSON.stringify(before.state())));
  assert.equal(after.recordCheckIn(0, 4).status, 'recorded');
  assert.equal(after.state().skills[0].xp, 9);
});

test('daily reset changes at 09:30 UTC, including month and year boundaries', () => {
  const t = tracker();
  assert.equal(t.day(Date.parse('2026-10-08T09:29:59Z')), '2026-10-07');
  assert.equal(t.day(Date.parse('2026-10-08T09:30:00Z')), '2026-10-08');
  assert.equal(t.day(Date.parse('2027-01-01T09:29:59Z')), '2026-12-31');
  assert.equal(t.nextReset(Date.parse('2026-10-08T09:29:59Z')), Date.parse('2026-10-08T09:30:00Z'));
  assert.equal(t.nextReset(Date.parse('2026-10-08T09:30:00Z')), Date.parse('2026-10-09T09:30:00Z'));
});

test('weekly encouragement counts distinct days, includes zero scores, excludes other weeks', () => {
  const t = tracker();
  const entry = (score) => ({ scores: [score, null, null, null, null] });
  t.state().days = {
    '2026-10-04': entry(5), '2026-10-05': entry(0),
    '2026-10-06': { scores: [5, 4, 3, null, null] },
    '2026-10-07': entry(null), '2026-10-08': entry(2), '2026-10-09': entry(5),
  };
  assert.equal(t.weeklyCheckInCount(), 3);
  assert.equal(t.weeklyCheckInCount(Date.parse('2026-10-05T09:29:59Z')), 1);
  assert.equal(t.weeklyCheckInCount(Date.parse('2026-10-05T09:30:00Z')), 1);
});

test('reward milestones have distinct titles and themes and unlock at the correct total', () => {
  const t = tracker();
  assert.deepEqual(Array.from(t.TOTAL_REWARDS, (r) => r.level), [5, 10, 25, 50, 75, 100, 150, 200, 250]);
  assert.equal(new Set(t.TOTAL_REWARDS.map((r) => r.title)).size, 9);
  assert.equal(new Set(t.TOTAL_REWARDS.map((r) => r.theme)).size, 9);
  for (const reward of t.TOTAL_REWARDS) {
    assert.equal(t.totalReward(reward.level).title, reward.title);
    if (reward.level > 5) assert.notEqual(t.totalReward(reward.level - 1).title, reward.title);
  }
  t.preview(50);
  assert.match(t.nextRewardText(), /75: Habit Wayfinder.*Lagoon/);
  t.preview(250);
  assert.equal(t.nextRewardText(), 'All Total Level rewards unlocked!');
});

test('first Total Level and reward celebrations queue once, with skill celebrations retained', () => {
  const first = tracker();
  first.queueLevels(0, 1, 2, 5, 6);
  assert.equal(first.queued().length, 2);
  assert.equal(first.queued()[0].l, 6);
  assert.equal(first.queued()[0].total, true);
  const milestone = tracker();
  milestone.queueLevels(0, 9, 10, 49, 50);
  assert.equal(milestone.queued()[0].milestone.title, 'Habit Explorer');
  const later = tracker();
  later.queueLevels(0, 10, 10, 50, 50);
  assert.equal(later.queued().length, 0);
});

test('current saves round-trip without losing XP or check-in history', () => {
  const t = tracker();
  t.recordCheckIn(0, 5);
  t.recordCheckIn(1, 0);
  const raw = JSON.stringify(t.state());
  assert.equal(JSON.stringify(t.readSave(raw)), raw);
});

test('legacy saves normalize missing scores and rates', () => {
  const t = tracker(), legacy = t.fresh();
  legacy.skills[0].tier = 2;
  legacy.days.old = { scores: [5, null, null, null, null] };
  legacy.days.empty = {};
  const loaded = t.readSave(JSON.stringify(legacy));
  assert.equal(loaded.days.old.rates[0], 6);
  assert.equal(loaded.days.empty.scores.length, 5);
  assert.ok(loaded.days.empty.scores.every((score) => score === null));
});

test('malformed saves are rejected without modifying current progress', () => {
  const t = tracker();
  t.recordCheckIn(0, 3);
  const before = JSON.stringify(t.state());
  const mutations = [
    (s) => { s.days = []; }, (s) => { s.skills[0] = null; },
    (s) => { s.bank = -1; }, (s) => { s.skills[0].xp = -1; },
    (s) => { s.days.bad = []; },
    (s) => { s.days.bad = { scores: [6, null, null, null, null] }; },
    (s) => { s.days.bad = { scores: [1, null, null, null, null], rates: [-1] }; },
    (s) => { s.days.bad = { scores: [1, null, null, null, null], rates: 'bad' }; },
  ];
  for (const mutate of mutations) {
    const bad = t.fresh();
    mutate(bad);
    assert.throws(() => t.readSave(JSON.stringify(bad)));
  }
  assert.throws(() => t.readSave('{invalid'));
  assert.equal(JSON.stringify(t.state()), before);
});

test('bonuses use the skill level before check-in and do not stack', () => {
  const t = tracker();
  const progression = createProgression(config);
  for (const [l, bonus] of [[1, 0], [9, 0], [10, 1], [19, 1], [20, 2], [30, 3], [40, 4], [50, 4]]) {
    assert.equal(progression.bonusForLevel(l), bonus);
    assert.equal(progression.experienceForCheckIn(5, l), 5 + bonus);
    assert.equal(progression.experienceForCheckIn(0, l), 0);
  }
  t.state().skills[0].xp = t.XP[10] - 1;
  assert.equal(t.recordCheckIn(0, 5).earned, 5);
  t.state().skills[1].xp = t.XP[20];
  assert.equal(t.recordCheckIn(1, 3).earned, 5);
  assert.equal(t.state().days[t.day()].bonuses[1], 2);
  assert.equal(t.recordCheckIn(1, 5).status, 'duplicate');
  t.state().skills[2].xp = t.XP[40];
  assert.equal(t.recordCheckIn(2, 0).earned, 0);
});

test('perfect check-ins reach skill level 50 in 191 days with bonuses', () => {
  const progression = createProgression(config);
  let days = 0, experience = 0;
  while (progression.levelForXP(experience) < 50) {
    experience += progression.experienceForCheckIn(5, progression.levelForXP(experience));
    days++;
    assert.ok(days <= 191);
  }
  assert.equal(days, 191);
});

test('bonus history round-trips and malformed bonuses are rejected', () => {
  const t = tracker();
  t.state().skills[0].xp = t.XP[40];
  t.recordCheckIn(0, 5);
  const raw = JSON.stringify(t.state());
  assert.equal(JSON.stringify(t.readSave(raw)), raw);
  const bad = JSON.parse(raw);
  bad.days[t.day()].bonuses[0] = 5;
  assert.throws(() => t.readSave(JSON.stringify(bad)));
});

test('completion message appears after all five check-ins, including zero ratings', () => {
  const t = tracker();
  assert.match(t.dashboard(), /Your daily check-in/);
  for (let i = 0; i < 4; i++) t.recordCheckIn(i, i);
  assert.doesNotMatch(t.dashboard(), /Today’s check-in is complete/);
  t.recordCheckIn(4, 0);
  assert.match(t.dashboard(), /Today’s check-in is complete/);
  assert.match(t.dashboard(), /Every small step adds up/);
  const tomorrow = tracker('2026-10-09T16:00:00Z');
  tomorrow.setState(tomorrow.readSave(JSON.stringify(t.state())));
  assert.doesNotMatch(tomorrow.dashboard(), /Today’s check-in is complete/);
  assert.match(tomorrow.dashboard(), /Your daily check-in/);
});

test('configuration keeps skill metadata and rewards internally consistent', () => {
  const context = vm.createContext({});
  vm.runInContext(configSource, context);
  const config = context.FitQuestConfig;
  assert.equal(config.skills.length, 5);
  assert.deepEqual(Array.from(config.skillDisplayOrder).sort(), [0, 1, 2, 3, 4]);
  for (const skill of config.skills) {
    assert.ok(skill.name && skill.icon && skill.color && skill.masteryTitle && skill.crown);
    assert.equal(skill.titles.length, Math.floor((config.maxSkillLevel - 1) / 7));
  }
  const maximum = config.maxSkillLevel * config.skills.length;
  assert.equal(config.totalRewards.at(-1).level, maximum);
  for (let i = 0; i < config.totalRewards.length; i++) {
    const reward = config.totalRewards[i];
    assert.ok(config.themes[reward.theme]);
    if (i > 0) assert.ok(reward.level > config.totalRewards[i - 1].level);
  }
  for (let i = 1; i < config.bonusMilestones.length; i++) {
    assert.ok(config.bonusMilestones[i].level > config.bonusMilestones[i - 1].level);
  }
});

test('reward selection is directly testable without tracker startup', () => {
  const progression = createProgression(config);
  for (const reward of config.totalRewards) {
    assert.equal(progression.rewardForTotalLevel(reward.level).title, reward.title);
    if (reward.level > 5)
      assert.notEqual(progression.rewardForTotalLevel(reward.level - 1).title, reward.title);
  }
  assert.equal(progression.nextRewardForTotalLevel(50).level, 75);
  assert.equal(progression.nextRewardForTotalLevel(250), null);
});

test('progression uses the supplied configuration rather than fixed constants', () => {
  const custom = JSON.parse(JSON.stringify(config));
  custom.maxSkillLevel = 3;
  custom.xp = { firstLevelCost: 2, costIncrease: 3 };
  custom.bonusMilestones = [{ level: 2, xp: 1 }];
  custom.totalRewards = [{ level: 5, title: 'Start' }, { level: 15, title: 'Finish' }];
  const progression = createProgression(custom);
  assert.deepEqual(progression.xpThresholds, [0, 0, 2, 7]);
  assert.equal(progression.maxTotalLevel, 15);
  assert.equal(progression.levelForXP(100), 3);
  assert.equal(progression.experienceForCheckIn(5, 2), 6);
});
