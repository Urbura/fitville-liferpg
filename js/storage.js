// FitQuest save parsing and validation.
// Existing browser storage keys and saved data formats are intentionally unchanged.
(function (root) {
  'use strict';
  function createStorage(config) {
    const skillCount = config.skills.length;
    const legacyRates = [1, 3, 6, 12, 20, 35];
    function validSharedSave(s) {
      return (
        s &&
        Number.isFinite(s.coins) &&
        s.coins >= 0 &&
        Array.isArray(s.skills) &&
        s.skills.length === 5 &&
        s.skills.every(
          (x) =>
            x &&
            Number.isFinite(x.xp) &&
            x.xp >= 0 &&
            Number.isInteger(x.tier) &&
            x.tier >= 0 &&
            x.tier < 6,
        ) &&
        s.days &&
        typeof s.days === 'object' &&
        !Array.isArray(s.days) &&
        Number.isFinite(s.last) &&
        Number.isFinite(s.bank)
      );
    }
    // Normalize older check-in entries while rejecting malformed imported history.
    // Keep this shared between normal startup and backup imports.
    function validateCheckInHistory(save) {
      for (const entry of Object.values(save.days)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
          throw Error('Invalid check-in history');
        if (entry.scores === undefined) entry.scores = Array(skillCount).fill(null);
        if (
          !Array.isArray(entry.scores) ||
          entry.scores.length !== skillCount ||
          !entry.scores.every((n) => n === null || (Number.isInteger(n) && n >= 0 && n <= 5))
        )
          throw Error('Invalid check-in scores');
        if (entry.bonuses !== undefined &&
          (!Array.isArray(entry.bonuses) || entry.bonuses.length !== skillCount ||
            !entry.bonuses.every((bonus, i) =>
              bonus === null || (entry.scores[i] !== null && Number.isInteger(bonus) &&
                bonus >= 0 && bonus <= 4 && (entry.scores[i] !== 0 || bonus === 0)))))
          throw Error('Invalid check-in bonuses');
        if (entry.bonusBases !== undefined &&
          (!Array.isArray(entry.bonusBases) || entry.bonusBases.length !== skillCount ||
            !entry.bonusBases.every((bonus, i) => bonus === null ||
              (entry.scores[i] !== null && Number.isInteger(bonus) && bonus >= 0 && bonus <= 4))))
          throw Error('Invalid original check-in bonuses');
        if (entry.rates === undefined) entry.rates = Array(skillCount).fill(null);
        if (!Array.isArray(entry.rates)) throw Error('Invalid check-in rates');
        entry.rates = entry.scores.map((score, i) => {
          if (score === null) return null;
          const rate = entry.rates[i];
          if (rate === null || rate === undefined) return legacyRates[save.skills[i].tier];
          if (!Number.isFinite(rate) || rate < 0) throw Error('Invalid check-in rate');
          return rate;
        });
      }
    }
    function readSave(raw) {
      const s = JSON.parse(raw);
      if (!validSharedSave(s) || s.bank < 0) throw Error('Invalid save');
      validateCheckInHistory(s);
      return s;
    }

    return { readSave };
  }
  root.FitQuestStorage = { createStorage };
  if (typeof module !== 'undefined' && module.exports)
    module.exports = { createStorage };
})(typeof globalThis !== 'undefined' ? globalThis : this);
