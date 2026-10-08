// FitQuest editable configuration. Loaded before fitville.js.
// IMPORTANT: Skill array positions identify existing saved progress; never reorder skills.
// Change skillDisplayOrder to rearrange the interface.
// Milestones must remain sorted from lowest to highest.
// Daily reset uses fixed UTC time: 09:30 UTC is 03:30 CST (UTC-6), year-round.
globalThis.FitQuestConfig = {
  "maxSkillLevel": 50,
  "xp": {
    "firstLevelCost": 5,
    "costIncrease": 1
  },
  "bonusMilestones": [
    {
      "level": 10,
      "xp": 1
    },
    {
      "level": 20,
      "xp": 2
    },
    {
      "level": 30,
      "xp": 3
    },
    {
      "level": 40,
      "xp": 4
    }
  ],
  "dailyReset": {
    "utcHour": 9,
    "utcMinute": 30,
    "label": "3:30 a.m. CST (UTC−6)"
  },
  "skillDisplayOrder": [
    4,
    3,
    2,
    1,
    0
  ],
  "skills": [
    {
      "name": "Sleep",
      "hint": "Your proposed 5/5 target: 7½–8½ hours of sleep.",
      "icon": "moon",
      "color": "#7962a6",
      "titles": [
        "Dreamer",
        "Rest Seeker",
        "Moon Walker",
        "Night Guardian",
        "Dream Weaver",
        "Rest Keeper",
        "Moonlight Adept"
      ],
      "masteryTitle": "Dream Ascendant",
      "crown": "Moonlight Crown",
      "crownSymbol": "☾"
    },
    {
      "name": "Healthy Eating",
      "hint": "Rate how well you followed your personal eating goals.",
      "icon": "salad",
      "color": "#4f7836",
      "titles": [
        "Fresh Starter",
        "Balanced Bite",
        "Nourished Explorer",
        "Garden Guardian",
        "Balanced Builder",
        "Nourishment Keeper",
        "Harvest Adept"
      ],
      "masteryTitle": "Nourishment Ascendant",
      "crown": "Harvest Crown",
      "crownSymbol": "✿"
    },
    {
      "name": "Stretching",
      "hint": "Rate completion of your planned mobility routine.",
      "icon": "stretching",
      "color": "#267b7d",
      "titles": [
        "First Stretch",
        "Limber Learner",
        "Flow Seeker",
        "Flexible Explorer",
        "Flow Adept",
        "Mobility Keeper",
        "Balance Adept"
      ],
      "masteryTitle": "Flow Ascendant",
      "crown": "Harmony Crown",
      "crownSymbol": "◇"
    },
    {
      "name": "Cardio",
      "hint": "Rate completion of your movement or cardio goal.",
      "icon": "run",
      "color": "#ad5b28",
      "titles": [
        "Trail Starter",
        "Steady Strider",
        "Distance Seeker",
        "Swift Runner",
        "Endurance Adept",
        "Trail Keeper",
        "Fleetfoot"
      ],
      "masteryTitle": "Wind Ascendant",
      "crown": "Wind Crown",
      "crownSymbol": "ϟ"
    },
    {
      "name": "Strength",
      "hint": "Rate following your workout plan; planned recovery counts.",
      "icon": "barbell",
      "color": "#3b6daa",
      "titles": [
        "First Lift",
        "Iron Learner",
        "Power Builder",
        "Iron Guardian",
        "Strength Adept",
        "Power Keeper",
        "Ironheart"
      ],
      "masteryTitle": "Iron Ascendant",
      "crown": "Iron Crown",
      "crownSymbol": "◆"
    }
  ],
  "totalRewards": [
    {
      "level": 5,
      "title": "Habit Starter",
      "theme": "sky",
      "themeName": "Sky"
    },
    {
      "level": 10,
      "title": "Habit Beginner",
      "theme": "pearl",
      "themeName": "Pearl"
    },
    {
      "level": 25,
      "title": "Habit Pathfinder",
      "theme": "rose",
      "themeName": "Rose"
    },
    {
      "level": 50,
      "title": "Habit Explorer",
      "theme": "ice",
      "themeName": "Ice Blue"
    },
    {
      "level": 75,
      "title": "Habit Wayfinder",
      "theme": "lagoon",
      "themeName": "Lagoon"
    },
    {
      "level": 100,
      "title": "Habit Builder",
      "theme": "ocean",
      "themeName": "Ocean"
    },
    {
      "level": 150,
      "title": "Habit Keeper",
      "theme": "meadow",
      "themeName": "Meadow"
    },
    {
      "level": 200,
      "title": "Habit Guardian",
      "theme": "lavender",
      "themeName": "Lavender"
    },
    {
      "level": 250,
      "title": "Habit Champion",
      "theme": "sunrise",
      "themeName": "Sunrise"
    }
  ],
  "themes": {
    "sky": "linear-gradient(145deg, #d8f3ff, #eefbff)",
    "ocean": "linear-gradient(145deg, #c9eef2, #e9f8fc)",
    "meadow": "linear-gradient(145deg, #d8f0df, #f0f9e9)",
    "lavender": "linear-gradient(145deg, #e6def7, #f7f1fc)",
    "sunrise": "linear-gradient(145deg, #ffe7bf, #fff5e5)",
    "ice": "linear-gradient(145deg, #c4dcf5, #e4edfc)",
    "pearl": "linear-gradient(145deg, #e2e7f0, #f7f9fc)",
    "rose": "linear-gradient(145deg, #f7dce5, #fff1f5)",
    "lagoon": "linear-gradient(145deg, #bfece2, #e6fbf5)"
  }
};
