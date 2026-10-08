(() => {
  try {
    // Skill definitions and XP thresholds
    const SKILLS = [
      { name: 'Sleep', hint: 'Your proposed 5/5 target: 7½–8½ hours of sleep.' },
      { name: 'Healthy Eating', hint: 'Rate how well you followed your personal eating goals.' },
      { name: 'Stretching', hint: 'Rate completion of your planned mobility routine.' },
      { name: 'Cardio', hint: 'Rate completion of your movement or cardio goal.' },
      { name: 'Strength', hint: 'Rate following your workout plan; planned recovery counts.' },
    ];
    const SKILL_DISPLAY_ORDER = [4, 3, 2, 1, 0];
    const SKILL_SYMBOLS = ['moon', 'salad', 'stretching', 'run', 'barbell'];
    function skillIcon(i) {
      return (
        '<span class="skill-symbol" style="--symbol:url(../assets/icons/' +
        SKILL_SYMBOLS[i] +
        '.svg);--skill:' +
        COLORS[i] +
        '" aria-hidden="true"><span></span></span>'
      );
    }
    // Historical XP rates are retained only to read older backups.
    const LEGACY_RATES = [1, 3, 6, 12, 20, 35];
    // Keep the original storage key and legacy fields so existing progress remains readable.
    const KEY = 'fitville-v1';
    // Browser storage and developer session
    const sessionFallback = new Map();
    function readSession(key) {
      if (sessionFallback.has(key)) return sessionFallback.get(key);
      try {
        return sessionStorage.getItem(key);
      } catch (err) {
        return null;
      }
    }
    function writeSession(key, value) {
      sessionFallback.set(key, value);
      try {
        sessionStorage.setItem(key, value);
      } catch (err) {}
    }
    function removeSession(key) {
      sessionFallback.set(key, null);
      try {
        sessionStorage.removeItem(key);
      } catch (err) {}
    }
    const DEV_PARAMS = new URLSearchParams(location.search),
      DEV_REQUESTED = DEV_PARAMS.has('dev') || DEV_PARAMS.get('test') === '1',
      DEV_BACKUP = 'fitville-dev-backup';
    let DEV = DEV_REQUESTED || readSession('fitville-dev-active') === '1';
    function setupDevUI() {
      const panel = document.getElementById('dev-tools'),
        open = document.getElementById('dev-open');
      if (!panel || !open) return;
      if (DEV) {
        writeSession('fitville-dev-active', '1');
        panel.hidden = false;
        open.hidden = true;
      } else {
        panel.hidden = true;
        open.hidden = true;
      }
    }
    // Five XP per day reaches skill level 99 in 210 days (1,050 total XP).
    // Start with 5 XP for level 2; each unrounded level cost grows by ~1.42%.
    // Round cumulative thresholds so rounding does not compound across levels.
    const XP_GROWTH = 1.0141993624136796;
    const XP = Array.from({ length: 100 }, (_, l) =>
      l < 1 ? 0 : Math.round((5 * (Math.pow(XP_GROWTH, l - 1) - 1)) / (XP_GROWTH - 1)),
    );
    function level(x) {
      let l = 1;
      while (l < 99 && x >= XP[l + 1]) l++;
      return l;
    }
    function fresh() {
      return {
        coins: 0,
        skills: SKILLS.map(() => ({ xp: 0, tier: 0 })),
        days: {},
        last: Date.now(),
        bank: 0,
      };
    }
    // Load and protect saved progress
    let state = fresh(),
      storageOK = true,
      storageLoaded = false,
      startupReady = false,
      rejectedSave = null,
      lastSavedRaw = null;
    try {
      const raw = localStorage.getItem(KEY);
      lastSavedRaw = raw;
      storageLoaded = true;
      if (raw !== null) {
        rejectedSave = raw;
        state = readSave(raw);
        rejectedSave = null;
      }
    } catch (err) {
      storageOK = false;
    }
    if (DEV && readSession(DEV_BACKUP) === null && storageLoaded)
      writeSession(DEV_BACKUP, lastSavedRaw === null ? '__EMPTY__' : lastSavedRaw);
    // Daily reset and shared-save synchronization
    let tab = 'dashboard',
      timer,
      renderedDay = null,
      dailyResetTimer;
    const RESET_UTC_HOUR = 9,
      RESET_UTC_MINUTE = 30,
      RESET_SHIFT = (RESET_UTC_HOUR * 60 + RESET_UTC_MINUTE) * 60 * 1000;
    function day(now = Date.now()) {
      return new Date(now - RESET_SHIFT).toISOString().slice(0, 10);
    }
    function nextReset(now = Date.now()) {
      const d = new Date(now),
        reset = Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          RESET_UTC_HOUR,
          RESET_UTC_MINUTE,
        );
      return now < reset ? reset : reset + 86400000;
    }
    function checkedCount(entry) {
      return entry && Array.isArray(entry.scores)
        ? entry.scores.filter(Number.isInteger).length
        : 0;
    }
    function dailyEntry() {
      const key = day();
      let e = state.days[key];
      if (e) {
        state.dailyResetVersion = 2;
        return e;
      }
      // Old versions stored local calendar dates. Preserve any skill check-ins already completed during migration.
      const local = new Date(),
        oldKey =
          local.getFullYear() +
          '-' +
          String(local.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(local.getDate()).padStart(2, '0');
      if ((state.dailyResetVersion || 0) < 2) {
        state.dailyResetVersion = 2;
        const old = state.days[oldKey];
        if (old && old.scores.some(Number.isInteger)) {
          if (oldKey !== key) {
            state.days[key] = old;
            delete state.days[oldKey];
          }
          e = old;
        }
        save();
      }
      return e;
    }
    function resetText() {
      const remaining = Math.max(0, nextReset() - Date.now()),
        hours = Math.floor(remaining / 3600000),
        minutes = Math.floor((remaining % 3600000) / 60000);
      return 'Resets at 3:30 a.m. CST (UTC−6) · ' + hours + 'h ' + minutes + 'm remaining';
    }

    function refreshDayIfNeeded() {
      if (renderedDay === null || renderedDay === day()) return false;
      document.getElementById('check-dialog').close();
      render(false);
      notify('A new check-in day has started. All five skills are available.');
      return true;
    }
    function scheduleDailyReset() {
      clearTimeout(dailyResetTimer);
      dailyResetTimer = setTimeout(
        () => {
          if (document.visibilityState === 'visible') refreshDayIfNeeded();
          scheduleDailyReset();
        },
        Math.max(50, nextReset() - Date.now() + 50),
      );
    }
    function refreshResetCountdown() {
      document.querySelectorAll('.star-reset').forEach((el) => (el.textContent = resetText()));
    }

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
    function readSave(raw) {
      const s = JSON.parse(raw);
      if (!validSharedSave(s) || s.bank < 0) throw Error('Invalid save');
      for (const entry of Object.values(s.days)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
          throw Error('Invalid check-in history');
        if (entry.scores === undefined) entry.scores = Array(SKILLS.length).fill(null);
        if (
          !Array.isArray(entry.scores) ||
          entry.scores.length !== SKILLS.length ||
          !entry.scores.every((n) => n === null || (Number.isInteger(n) && n >= 0 && n <= 5))
        )
          throw Error('Invalid check-in scores');
        if (entry.rates === undefined) entry.rates = Array(SKILLS.length).fill(null);
        if (!Array.isArray(entry.rates)) throw Error('Invalid check-in rates');
        entry.rates = entry.scores.map((score, i) => {
          if (score === null) return null;
          const rate = entry.rates[i];
          if (rate === null || rate === undefined) return LEGACY_RATES[s.skills[i].tier];
          if (!Number.isFinite(rate) || rate < 0) throw Error('Invalid check-in rate');
          return rate;
        });
      }
      return s;
    }
    // Explicit import/reset may replace a save only after its current snapshot is readable.
    function prepareReplacement() {
      try {
        lastSavedRaw = localStorage.getItem(KEY);
        storageLoaded = true;
        return true;
      } catch (err) {
        storageOK = false;
        notify('Device saving is blocked. Export your progress before reloading.');
        return false;
      }
    }
    function syncSharedSave() {
      if (DEV || rejectedSave !== null || !storageLoaded) return false;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw === lastSavedRaw) return false;
        if (raw === null) {
          state = fresh();
        } else {
          let incoming;
          try {
            incoming = readSave(raw);
          } catch (err) {
            rejectedSave = raw;
            lastSavedRaw = raw;
            storageOK = false;
            return true;
          }
          state = incoming;
        }
        lastSavedRaw = raw;
        storageOK = true;
        document.getElementById('check-dialog').close();
        return true;
      } catch (err) {
        storageOK = false;
        return false;
      }
    }
    function save() {
      if (!startupReady) return false;
      if (DEV || rejectedSave !== null || !storageLoaded) return false;
      try {
        if (localStorage.getItem(KEY) !== lastSavedRaw) {
          syncSharedSave();
          render(false);
          notify('Progress changed in another tab. The latest save has been loaded.');
          return false;
        }
        const raw = JSON.stringify(state);
        if (raw !== lastSavedRaw) localStorage.setItem(KEY, raw);
        lastSavedRaw = raw;
        storageOK = true;
        return true;
      } catch (e) {
        storageOK = false;
        notify('Saving is unavailable. Keep this page open or export a backup.');
        return false;
      }
    }

    function dismissNotice() {
      clearTimeout(timer);
      const notice = document.getElementById('notice');
      notice.textContent = '';
      notice.removeAttribute('tabindex');
      if (document.activeElement === notice) notice.blur();
    }
    function notify(t) {
      const notice = document.getElementById('notice');
      clearTimeout(timer);
      notice.textContent = t;
      if (t) notice.setAttribute('tabindex', '0');
      else notice.removeAttribute('tabindex');
      timer = setTimeout(dismissNotice, 5000);
    }
    function setupNoticeDismissal() {
      const notice = document.getElementById('notice');
      notice.title = 'Tap or swipe up to dismiss';
      notice.addEventListener('click', dismissNotice);
      notice.addEventListener('keydown', (event) => {
        if (['Enter', ' ', 'Escape'].includes(event.key)) {
          event.preventDefault();
          dismissNotice();
        }
      });
      let swipeStart = null;
      notice.addEventListener(
        'touchstart',
        (event) => {
          swipeStart =
            event.touches.length === 1
              ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
              : null;
        },
        { passive: true },
      );
      notice.addEventListener(
        'touchend',
        (event) => {
          if (swipeStart && event.changedTouches.length === 1) {
            const touch = event.changedTouches[0];
            const upward = swipeStart.y - touch.clientY;
            const sideways = Math.abs(swipeStart.x - touch.clientX);
            if (upward >= 35 && upward > sideways * 1.5) dismissNotice();
          }
          swipeStart = null;
        },
        { passive: true },
      );
      notice.addEventListener(
        'touchcancel',
        () => {
          swipeStart = null;
        },
        { passive: true },
      );
    }

    // Dashboard and level celebrations
    const COLORS = ['#7962a6', '#4f7836', '#267b7d', '#ad5b28', '#3b6daa'];
    function dashboard() {
      const entry = dailyEntry(),
        doneCount = checkedCount(entry);
      return (
        '<section class="tracker-intro"><h2>Your daily check-in</h2><p class="muted">Tap a skill and rate your day out of 5.</p></section><div class="skill-star" aria-label="Five fitness skills"><div class="star-summary" aria-live="polite"><strong>' +
        doneCount +
        ' / 5</strong><span>checked in</span></div>' +
        SKILL_DISPLAY_ORDER.map((i, position) => {
          const s = SKILLS[i],
            xp = state.skills[i].xp,
            l = level(xp),
            maxed = l === 99,
            progress = maxed ? 1 : (xp - XP[l]) / (XP[l + 1] - XP[l]),
            done = entry && Number.isInteger(entry.scores[i]);
          return (
            '<button class="star-skill star-position-' +
            position +
            (done ? ' is-complete' : '') +
            '" data-open-skill="' +
            i +
            '" style="--skill:' +
            COLORS[i] +
            '" aria-label="' +
            s.name +
            ', level ' +
            l +
            ', ' +
            (maxed ? 'maximum level' : XP[l + 1] - xp + ' XP to next level') +
            ', ' +
            (done ? 'checked in today, ' + entry.scores[i] + ' out of 5' : 'check in out of 5') +
            '"><span class="star-level">Lv ' +
            l +
            '</span>' +
            skillIcon(i) +
            (done ? '<span class="star-check" aria-hidden="true">✓</span>' : '') +
            '<strong>' +
            s.name +
            '</strong>' +
            '<progress class="star-progress" max="1" value="' +
            progress +
            '" aria-label="' +
            s.name +
            ' XP progress"></progress>' +
            '<span class="star-xp">' +
            (maxed
              ? 'MAX'
              : (xp - XP[l]).toLocaleString() +
                ' / ' +
                (XP[l + 1] - XP[l]).toLocaleString() +
                ' XP') +
            '</span>' +
            (done ? '<span class="star-score">' + entry.scores[i] + '/5 today</span>' : '') +
            '</button>'
          );
        }).join('') +
        '</div><p class="star-reset muted">' +
        resetText() +
        '</p>'
      );
    }

    function reward(text) {
      let el = document.createElement('div');
      el.className = 'reward';
      el.textContent = text;
      document.body.append(el);
      setTimeout(() => el.remove(), 1900);
    }

    function safeText(s) {
      return String(s).replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
    }
    const TITLES = [
      [
        'Dreamer',
        'Rest Seeker',
        'Moon Walker',
        'Night Guardian',
        'Dream Weaver',
        'Rest Keeper',
        'Moonlight Adept',
        'Dream Sage',
        'Twilight Warden',
        'Rest Champion',
        'Dream Knight',
        'Moonlight Master',
        'Celestial Sleeper',
        'Dream Sovereign',
        'Dream Ascendant',
      ],
      [
        'Fresh Starter',
        'Balanced Bite',
        'Nourished Explorer',
        'Garden Guardian',
        'Balanced Builder',
        'Nourishment Keeper',
        'Harvest Adept',
        'Harvest Sage',
        'Garden Warden',
        'Nourishment Champion',
        'Harvest Knight',
        'Balance Master',
        'Nourishment Legend',
        'Harvest Sovereign',
        'Nourishment Ascendant',
      ],
      [
        'First Stretch',
        'Limber Learner',
        'Flow Seeker',
        'Flexible Explorer',
        'Flow Adept',
        'Mobility Keeper',
        'Balance Adept',
        'Flow Sage',
        'Mobility Warden',
        'Flexibility Champion',
        'Flow Knight',
        'Mobility Master',
        'Flow Legend',
        'Flow Sovereign',
        'Flow Ascendant',
      ],
      [
        'Trail Starter',
        'Steady Strider',
        'Distance Seeker',
        'Swift Runner',
        'Endurance Adept',
        'Trail Keeper',
        'Fleetfoot',
        'Endurance Sage',
        'Trail Warden',
        'Cardio Champion',
        'Wind Knight',
        'Endurance Master',
        'Trail Legend',
        'Wind Sovereign',
        'Wind Ascendant',
      ],
      [
        'First Lift',
        'Iron Learner',
        'Power Builder',
        'Iron Guardian',
        'Strength Adept',
        'Power Keeper',
        'Ironheart',
        'Strength Sage',
        'Iron Warden',
        'Strength Champion',
        'Iron Knight',
        'Power Master',
        'Iron Legend',
        'Iron Sovereign',
        'Iron Ascendant',
      ],
    ];
    const CROWNS = [
      'Moonlight Crown',
      'Harvest Crown',
      'Harmony Crown',
      'Wind Crown',
      'Iron Crown',
    ];
    const SYMBOLS = ['☾', '✿', '◇', 'ϟ', '◆'];
    function titleFor(i, l) {
      return l === 99 ? TITLES[i][14] : l < 7 ? 'Novice' : TITLES[i][Math.floor(l / 7) - 1];
    }
    function crown(i) {
      return (
        '<svg class="skill-crown" viewBox="0 0 120 85" role="img" aria-label="' +
        CROWNS[i] +
        '"><path d="M15 62L7 22L34 39L60 7L86 39L113 22L105 62Z" fill="' +
        COLORS[i] +
        '" stroke="#d6a642" stroke-width="5" stroke-linejoin="round"/><rect x="15" y="62" width="90" height="14" rx="4" fill="#f0c965" stroke="#b6892e" stroke-width="3"/><circle cx="60" cy="43" r="15" fill="#fff2bd"/><text x="60" y="49" text-anchor="middle" fill="' +
        COLORS[i] +
        '" font-size="21">' +
        SYMBOLS[i] +
        '</text></svg>'
      );
    }
    let celebrations = [],
      celebrationFocus;
    function queueLevels(i, before, after, firstLevel = false) {
      for (let l = before + 1; l <= after; l++)
        celebrations.push({ i, l, firstLevel: firstLevel && l === before + 1 });
      if (celebrations.length && !document.getElementById('level-dialog').open) {
        celebrationFocus = document.activeElement;
        showLevel();
      }
    }
    function showLevel() {
      const item = celebrations[0];
      if (!item) return;
      const { i, l, firstLevel } = item,
        unlock =
          l === 99
            ? 'Mastery title: ' + titleFor(i, l) + ' · ' + CROWNS[i]
            : l % 7 === 0
              ? 'New title: ' + titleFor(i, l)
              : 'No new item at this level. Next title at level ' +
                Math.min(99, Math.ceil(l / 7) * 7) +
                '.';
      document.getElementById('level-content').innerHTML =
        '<span class="anime-tag">' +
        SKILLS[i].name +
        ' level up</span><h2 id="level-heading"><span class="congratulations">Congratulations!</span>You reached level ' +
        l +
        '!</h2>' +
        (l === 99 ? crown(i) : '<div class="level-emblem">' + skillIcon(i) + '</div>') +
        (firstLevel
          ? '<h3>Your first level!</h3><p>You have taken the first step toward building your ' +
            SKILLS[i].name.toLowerCase() +
            ' habit. This level reflects the progress you recorded toward your own goal.</p>' +
            '<p>Small steps count. Keep checking in honestly: every point of experience adds up, ' +
            'and planned rest or recovery can count toward your goal.</p>' +
            '<p class="muted">Your level tracks your check-ins, rather than measuring your fitness or health. ' +
            'Your first skill title unlocks at level 7.</p>'
          : '<p><b>' +
            safeText(unlock) +
            '</b></p><p class="muted">' +
            (l === 99
              ? 'Your skill crown is permanently displayed on your Skills page.'
              : 'Current title: ' + titleFor(i, l)) +
            '</p>');
      document.getElementById('level-next').textContent =
        celebrations.length > 1
          ? 'Next level celebration (' + (celebrations.length - 1) + ' remaining)'
          : 'Continue adventure';
      const dialog = document.getElementById('level-dialog');
      if (!dialog.open) dialog.showModal();
      document.getElementById('level-next').focus();
      fireworks();
    }
    function fireworks() {
      const field = document.getElementById('fireworks');
      field.innerHTML = '';
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (let burst = 0; burst < 4; burst++) {
        const x = 15 + Math.random() * 70,
          y = 15 + Math.random() * 40;
        for (let j = 0; j < 16; j++) {
          const p = document.createElement('span'),
            angle = (j * Math.PI) / 8;
          p.className = 'spark';
          p.style.cssText =
            'left:' +
            x +
            '%;top:' +
            y +
            '%;background:' +
            ['#ffd35d', '#69d9ff', '#ff8aca', '#96f06c'][burst] +
            ';--dx:' +
            Math.cos(angle) * 110 +
            'px;--dy:' +
            Math.sin(angle) * 110 +
            'px;animation-delay:' +
            burst * 0.2 +
            's';
          field.append(p);
        }
      }
    }
    function nextCelebration() {
      celebrations.shift();
      if (celebrations.length) showLevel();
      else {
        document.getElementById('level-dialog').close();
        document.getElementById('fireworks').innerHTML = '';
        if (celebrationFocus && celebrationFocus.isConnected) celebrationFocus.focus();
      }
    }

    // Header, settings, and screen rendering
    function renderHUD() {
      const overallXp = state.skills.reduce((n, s) => n + s.xp, 0);
      document.getElementById('overall-level').textContent = 'Total Level ' + level(overallXp);
    }

    function renderSettings() {
      return '<button class="back-button" data-tab="dashboard">← Back to Dashboard</button><section class="card tools"><h2>⚙ Settings</h2><p class="muted">Progress stays in this browser. Export before switching devices or clearing browser data.</p><button id="export">Export save</button><p><label>Import save backup<br><input id="import" type="file" accept=".json,application/json" style="max-width:100%;margin-top:10px" aria-label="Import save backup"></label></p><button id="restart" class="restart wide">Reset tracker progress</button></section>';
    }
    function renderScreen() {
      if (tab === 'settings') return renderSettings();
      return dashboard();
    }

    function render(persist = true) {
      document.body.classList.remove('map-home');
      document.body.classList.toggle('tracker-home', tab === 'dashboard');
      renderHUD();
      document
        .querySelectorAll('nav button')
        .forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));

      document.querySelector('nav').hidden = false;
      let html =
        rejectedSave !== null
          ? '<section class="card" role="alert"><h2>Your original save is protected</h2><p>We could not read your saved progress. Automatic saving is paused so the original data stays untouched.</p><p>Export the original save first. Then use Settings to import a working backup or explicitly reset progress. Check-ins made while recovery is pending are temporary.</p><button id="export">Export original save</button><button data-tab="settings">Recovery settings</button></section>'
          : storageOK
            ? ''
            : '<p class="card">Device saving is unavailable. Use Settings to export a backup before closing this page.</p>';
      html += renderScreen();
      document.getElementById('view').innerHTML = html;
      renderedDay = day();
      scheduleDailyReset();
      if (persist) save();
    }

    // Apply one daily score. XP remains one point per rating point.
    // Daily check-in updates
    function recordCheckIn(i, score) {
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i >= SKILLS.length ||
        !Number.isInteger(score) ||
        score < 0 ||
        score > 5
      )
        return { status: 'invalid' };
      const key = day(),
        existing = dailyEntry();
      if (existing && Number.isInteger(existing.scores[i])) return { status: 'duplicate' };
      const before = level(state.skills[i].xp),
        firstLevel = state.skills.every((skill) => level(skill.xp) === 1);
      const entry = existing || {
        scores: Array(SKILLS.length).fill(null),
        rates: Array(SKILLS.length).fill(null),
      };
      entry.scores[i] = score;
      entry.rates[i] = 1;
      state.days[key] = entry;
      state.skills[i].xp += score;
      const after = level(state.skills[i].xp);
      return { status: 'recorded', earned: score, before, after, firstLevel: firstLevel && after > before, state };
    }
    function submitCheckIn(i, score) {
      const result = recordCheckIn(i, score);
      if (result.status === 'invalid') return;
      document.getElementById('check-dialog').close();
      if (result.status === 'duplicate') {
        notify(SKILLS[i].name + ' is already checked in today.');
        return;
      }
      const persisted = save();
      render(false);
      // A newer shared save can replace this state during saving.
      if (state !== result.state) return;
      if (result.earned > 0) reward('+' + result.earned + ' XP');
      notify(
        SKILLS[i].name +
          ' · ' +
          score +
          '/5' +
          (DEV
            ? ' · preview only.'
            : persisted
              ? ' · saved.'
              : ' · temporary; export a backup to keep this progress.'),
      );
      queueLevels(i, result.before, result.after, result.firstLevel);
    }

    // User actions and backup import
    function handleTrackerClick(e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (syncSharedSave()) render(false);
      refreshDayIfNeeded();
      if (b.id === 'recovery-reload') {
        location.reload();
        return;
      }
      if (DEV && b.id === 'dev-toggle') {
        document.getElementById('dev-tools').hidden = true;
        document.getElementById('dev-open').hidden = false;
        return;
      }
      if (DEV && b.id === 'dev-open') {
        document.getElementById('dev-tools').hidden = false;
        document.getElementById('dev-open').hidden = true;
        return;
      }
      if (DEV && b.dataset.devLevel !== undefined) {
        const input = document.getElementById('dev-level');
        if (input) input.value = b.dataset.devLevel;
        return;
      }
      if (DEV && b.id === 'dev-set-level') {
        const select = document.getElementById('dev-skill'),
          input = document.getElementById('dev-level'),
          target = Math.max(1, Math.min(99, Math.floor(Number(input && input.value) || 1))),
          indices =
            select && select.value === 'all' ? [0, 1, 2, 3, 4] : [Number(select && select.value)];
        for (const i of indices) {
          if (Number.isInteger(i) && i >= 0 && i < 5) state.skills[i].xp = XP[target];
        }
        render();
        notify(
          (indices.length === 5 ? 'All skills' : SKILLS[indices[0]].name) +
            ' set to Level ' +
            target +
            ' for testing.',
        );
        return;
      }
      if (DEV && b.id === 'dev-restore') {
        const raw = readSession(DEV_BACKUP);
        if (raw === null) {
          notify('No original save backup is available in this session.');
          return;
        }
        if (raw === '__EMPTY__') {
          state = fresh();
        } else {
          try {
            state = readSave(raw);
          } catch (err) {
            notify('Could not restore the original save.');
            return;
          }
        }
        tab = 'dashboard';
        render();
        notify('Original save restored in the preview.');
        return;
      }
      if (DEV && b.id === 'dev-exit') {
        const raw = readSession(DEV_BACKUP);
        if (raw !== null) {
          try {
            state = raw === '__EMPTY__' ? fresh() : readSave(raw);
          } catch (err) {
            state = fresh();
            rejectedSave = raw;
            storageOK = false;
          }
        }
        removeSession(DEV_BACKUP);
        removeSession('fitville-dev-active');
        DEV = false;
        const u = new URL(location.href);
        u.searchParams.delete('dev');
        u.searchParams.delete('test');
        history.replaceState(null, '', u.pathname + u.search + u.hash);
        setupDevUI();
        tab = 'dashboard';
        syncSharedSave();
        render(false);
        notify('Developer Mode closed. Original progress preserved.');
        return;
      }

      if (b.id === 'level-next') {
        nextCelebration();
        return;
      }
      if (b.id === 'restart') {
        if (
          !confirm(
            'Start fresh? This removes all XP and check-ins on this device. Export a backup first if you want to keep them.',
          )
        )
          return;
        if (!prepareReplacement()) return;
        rejectedSave = null;
        state = fresh();
        tab = 'dashboard';
        const persisted = save();
        render(false);
        notify(
          persisted
            ? 'Tracker reset. Every skill starts at 0 XP.'
            : 'Progress reset in this page only. Device saving is unavailable.',
        );
      }
      if (b.dataset.openSkill !== undefined) {
        openSkillCheck(Number(b.dataset.openSkill));
        return;
      }
      if (b.dataset.tab) {
        const targetTab = b.dataset.tab;
        tab = b.closest('nav') && tab === targetTab ? 'dashboard' : targetTab;
        render();
        window.scrollTo(0, 0);
        return;
      }
      if (b.id === 'check-close') {
        document.getElementById('check-dialog').close();
        return;
      }
      if (b.dataset.quickScore !== undefined) {
        submitCheckIn(Number(b.dataset.skill), Number(b.dataset.quickScore));
        return;
      }
      if (b.id === 'export') {
        save();
        const url = URL.createObjectURL(
          new Blob([rejectedSave !== null ? rejectedSave : JSON.stringify(state, null, 2)], {
            type: 'application/json',
          }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download =
          (rejectedSave !== null ? 'fitness-level-up-original-save-' : 'fitness-level-up-save-') +
          day() +
          '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    document.addEventListener('click', (e) => {
      if (!e.target.closest('button')) return;
      if (typeof navigator !== 'undefined' && navigator.locks) {
        navigator.locks
          .request('fitness-level-up-save', () => handleTrackerClick(e))
          .catch((err) => {
            console.error(err);
            notify('Could not update progress. Please try again.');
          });
      } else {
        handleTrackerClick(e);
      }
    });
    document.addEventListener('change', async (e) => {
      if (e.target.id !== 'import' || !e.target.files[0]) return;
      try {
        let s = JSON.parse(await e.target.files[0].text());
        if (
          !Number.isFinite(s.coins) ||
          s.coins < 0 ||
          !Array.isArray(s.skills) ||
          s.skills.length !== 5 ||
          !s.skills.every(
            (x) =>
              Number.isFinite(x.xp) &&
              x.xp >= 0 &&
              Number.isInteger(x.tier) &&
              x.tier >= 0 &&
              x.tier < 6,
          ) ||
          !s.days ||
          typeof s.days !== 'object' ||
          !Number.isFinite(s.bank) ||
          s.bank < 0 ||
          !Number.isFinite(s.last)
        )
          throw Error();
        for (const v of Object.values(s.days)) {
          if (
            !Array.isArray(v.scores) ||
            v.scores.length !== 5 ||
            !v.scores.every((n) => n === null || (Number.isInteger(n) && n >= 0 && n <= 5)) ||
            !Array.isArray(v.rates) ||
            v.rates.length !== 5 ||
            !v.rates.every((n, i) => (v.scores[i] === null ? n === null : LEGACY_RATES.includes(n)))
          )
            throw Error();
        }
        if (!confirm('Replace progress on this device with this backup?')) return;
        if (!prepareReplacement()) return;
        state = s;
        rejectedSave = null;
        const persisted = save();
        render(false);
        notify(
          persisted
            ? 'Backup restored.'
            : 'Backup loaded in this page only. Export before closing; device saving is unavailable.',
        );
      } catch (err) {
        notify('This file is not a valid FitQuest save.');
      }
    });
    document.getElementById('level-dialog').addEventListener('cancel', (e) => {
      e.preventDefault();
      nextCelebration();
    });

    // Check-in dialog
    const RATING_GUIDANCE = [
      'No progress',
      'Small start',
      'Some progress',
      'About halfway',
      'Mostly met',
      'Goal met',
    ];
    function openSkillCheck(i) {
      if (!Number.isInteger(i) || i < 0 || i >= SKILLS.length) return;
      const s = SKILLS[i],
        x = state.skills[i],
        l = level(x.xp),
        entry = dailyEntry(),
        done = entry && Number.isInteger(entry.scores[i]);
      const maxed = l === 99,
        earned = x.xp - XP[l],
        needed = maxed ? 0 : XP[l + 1] - XP[l],
        progress = maxed ? 1 : earned / needed,
        nextTitleLevel = Math.min(99, (Math.floor(l / 7) + 1) * 7);
      const xpPanel =
        '<section class="popup-progress" aria-label="' +
        s.name +
        ' experience"><div class="row"><strong>Skill Level ' +
        l +
        '</strong><span>' +
        titleFor(i, l) +
        '</span></div><progress max="1" value="' +
        progress +
        '" aria-label="' +
        s.name +
        ' progress to next level"></progress><div class="row muted"><span>' +
        x.xp.toLocaleString() +
        ' total XP</span><span>' +
        (maxed
          ? 'Level 99 · MAX'
          : earned.toLocaleString() + ' / ' + needed.toLocaleString() + ' XP this level') +
        '</span></div><p>' +
        (maxed
          ? 'Mastery achieved — ' + CROWNS[i]
          : (XP[l + 1] - x.xp).toLocaleString() + ' XP to level ' + (l + 1)) +
        '</p>' +
        (maxed
          ? crown(i)
          : '<p class="muted">Next title: <strong>' +
            titleFor(i, nextTitleLevel) +
            '</strong> at level ' +
            nextTitleLevel +
            '</p>') +
        '</section>';
      document.getElementById('check-content').innerHTML =
        '<div class="row"><h2 id="check-heading">' +
        skillIcon(i) +
        ' ' +
        s.name +
        '</h2><button id="check-close" class="popup-close" aria-label="Close check-in">×</button></div>' +
        xpPanel +
        (done
          ? '<div class="saved-score">✓ Checked in today · ' +
            entry.scores[i] +
            '/5 — ' +
            RATING_GUIDANCE[entry.scores[i]] +
            '</div><p class="muted">' +
            resetText() +
            '</p>'
          : '<p>' +
            s.hint +
            '</p><p class="rating-intro">Rate progress toward your own goal. Planned rest or recovery can count as meeting your goal.</p><div class="scores guided-scores" role="group" aria-label="' +
            s.name +
            ' score">' +
            RATING_GUIDANCE.map(
              (label, v) =>
                '<button data-quick-score="' +
                v +
                '" data-skill="' +
                i +
                '" aria-label="' +
                v +
                ' out of 5: ' +
                label +
                '"><strong>' +
                v +
                '</strong><span>' +
                label +
                '</span></button>',
            ).join('') +
            '</div><p class="muted rating-save-note">Tap a score to save immediately. One check-in per skill each day.</p>');
      document.getElementById('check-dialog').showModal();
    }

    // Startup and browser lifecycle
    function updateHeaderHeight() {
      const header = document.querySelector('header');
      if (header)
        document.documentElement.style.setProperty(
          '--hud-height',
          header.getBoundingClientRect().height + 'px',
        );
    }
    const topNav = document.querySelector('nav'),
      headerContent = document.querySelector('header>div');
    if (topNav && headerContent) {
      headerContent.appendChild(topNav);
      topNav.querySelectorAll('button').forEach((b) => {
        const label = b.textContent.trim();
        b.setAttribute('aria-label', label);
        b.title = label;
      });
    }
    updateHeaderHeight();
    if (typeof ResizeObserver === 'function') {
      try {
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(document.querySelector('header'));
      } catch (err) {
        window.addEventListener('resize', updateHeaderHeight);
      }
    } else {
      window.addEventListener('resize', updateHeaderHeight);
    }
    document.getElementById('check-dialog').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          e.currentTarget.close();
      }
    });
    setupNoticeDismissal();
    setupDevUI();
    render(false);
    startupReady = true;
    save();
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshDayIfNeeded();
        refreshResetCountdown();
        renderHUD();
      }
    }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (syncSharedSave()) render(false);
        refreshDayIfNeeded();
        refreshResetCountdown();
        renderHUD();
      }
    });
    window.addEventListener('pagehide', () => {
      save();
    });

    window.addEventListener('storage', (e) => {
      if ((e.key === KEY || e.key === null) && syncSharedSave()) {
        render(false);
        notify('Progress updated from another tab.');
      }
    });
  } catch (err) {
    console.error('FitQuest startup error', err);
    const view = document.getElementById('view');
    if (view) {
      view.innerHTML =
        '<section class="card"><h2>FitQuest needs a refresh</h2><p>Startup could not finish. Reload to try again. Avoid clearing browser data if you have progress saved here.</p><button id="startup-reload" class="wide">Reload FitQuest</button></section>';
      document.getElementById('startup-reload').addEventListener('click', () => location.reload());
    }
    const nav = document.querySelector('nav');
    if (nav) nav.hidden = true;
  }
})();
