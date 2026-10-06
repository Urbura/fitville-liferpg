const SKILLS=[
{name:'Sleep',building:'Rest Lodge',icon:'🌙',hint:'Your proposed 5/5 target: 7½–8½ hours of sleep.'},
{name:'Healthy Eating',building:'Fresh Market',icon:'🥗',hint:'Rate how well you followed your personal eating goals.'},
{name:'Stretching',building:'Wellness Studio',icon:'🧘',hint:'Rate completion of your planned mobility routine.'},
{name:'Cardio',building:'Walking Trail',icon:'🚶',hint:'Rate completion of your movement or cardio goal.'},
{name:'Strength',building:'Training Gym',icon:'🏋️',hint:'Rate following your workout plan; planned recovery counts.'}
];
const SKILL_DISPLAY_ORDER=[4,3,2,1,0];
const TIERS=['Starter','Basic','Improved','Advanced','Elite','Master'];
const RATES=[1,3,6,12,20,35], COSTS=[0,200,700,2200,5500,10500];
const KEY='fitville-v1', CAP=8*60*60*1000;
const DEV_PARAMS=new URLSearchParams(location.search),DEV_REQUESTED=DEV_PARAMS.has('dev')||DEV_PARAMS.get('test')==='1',DEV_BACKUP='fitville-dev-backup';
let DEV=DEV_REQUESTED||sessionStorage.getItem('fitville-dev-active')==='1';
function setupDevUI(){const panel=document.getElementById('dev-tools'),open=document.getElementById('dev-open');if(!panel||!open)return;if(DEV){sessionStorage.setItem('fitville-dev-active','1');panel.hidden=false;open.hidden=true;}else{panel.hidden=true;open.hidden=true;}}
const XP_ANCHORS=[[1,0],[2,7],[10,100],[20,400],[30,1100],[40,3000],[50,8000],[60,20000],[70,50000],[80,110000],[90,210000],[99,350000]];
const XP=Array(100).fill(0);for(let a=0;a<XP_ANCHORS.length-1;a++){const [l1,x1]=XP_ANCHORS[a],[l2,x2]=XP_ANCHORS[a+1];for(let l=l1;l<=l2;l++){const p=(l-l1)/(l2-l1);XP[l]=Math.round(x1+(x2-x1)*p);}}
function level(x){let l=1;while(l<99&&x>=XP[l+1])l++;return l;}
function fresh(){return{coins:0,skills:SKILLS.map(()=>({xp:0,tier:0})),days:{},last:Date.now(),bank:0};}
let state=fresh(),storageOK=true;
try{let raw=localStorage.getItem(KEY);if(raw){let s=JSON.parse(raw);if(!s||!Number.isFinite(s.coins)||s.coins<0||!Array.isArray(s.skills)||s.skills.length!==5||!s.skills.every(x=>Number.isFinite(x.xp)&&x.xp>=0&&Number.isInteger(x.tier)&&x.tier>=0&&x.tier<6)||!s.days||!Number.isFinite(s.last)||!Number.isFinite(s.bank))throw Error('Invalid save');state=s;}}catch(e){storageOK=false;}
// Normalize older saves before any UI or achievement code reads them.
state.days=(state.days&&typeof state.days==='object')?state.days:{};
for(const [k,d] of Object.entries(state.days)){
 if(!d||typeof d!=='object'){delete state.days[k];continue;}
 if(!Array.isArray(d.scores))d.scores=[null,null,null,null,null];
 d.scores=Array.from({length:5},(_,i)=>Number.isInteger(d.scores[i])&&d.scores[i]>=0&&d.scores[i]<=5?d.scores[i]:null);
 if(!Array.isArray(d.rates))d.rates=[null,null,null,null,null];
 d.rates=Array.from({length:5},(_,i)=>d.scores[i]===null?null:(Number.isFinite(d.rates[i])?d.rates[i]:RATES[state.skills[i].tier]));
}
if(state.wardrobe){
 state.wardrobe.owned=Array.isArray(state.wardrobe.owned)?state.wardrobe.owned:[];
 state.wardrobe.earned=Array.isArray(state.wardrobe.earned)?state.wardrobe.earned:[];
 state.wardrobe.equipped=state.wardrobe.equipped&&typeof state.wardrobe.equipped==='object'?state.wardrobe.equipped:{};
}
if(DEV&&!sessionStorage.getItem(DEV_BACKUP)){const existing=localStorage.getItem(KEY);sessionStorage.setItem(DEV_BACKUP,existing===null?'__EMPTY__':existing);}
let tab='town',draft=[],timer,selectedBuilding=0;
const RESET_UTC_HOUR=9,RESET_UTC_MINUTE=30,RESET_SHIFT=(RESET_UTC_HOUR*60+RESET_UTC_MINUTE)*60*1000;
function day(now=Date.now()){return new Date(now-RESET_SHIFT).toISOString().slice(0,10);}
function nextReset(now=Date.now()){const d=new Date(now),reset=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),RESET_UTC_HOUR,RESET_UTC_MINUTE);return now<reset?reset:reset+86400000;}
function weekKey(now=Date.now()){const shifted=new Date(now-RESET_SHIFT),d=new Date(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate()));const dow=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dow);return d.toISOString().slice(0,10);}
function questState(){state.quests??={daily:{},weekly:{}};state.quests.daily??={};state.quests.weekly??={};state.quests.chest??={points:0,ready:0,opened:0};return state.quests;}
function townLevel(){return 1+state.skills.reduce((n,s)=>n+s.tier,0);}
function townTitle(l=townLevel()){return l>=26?'Grand Fitville':l>=21?'Thriving City':l>=16?'Bustling Town':l>=11?'Growing Town':l>=6?'Village':'New Settlement';}
function townXpBonus(l=townLevel()){return (l-1)*2;}
function townGoldBonus(l=townLevel()){return (l-1)*2;}
function addChestProgress(n){const chest=questState().chest;chest.points+=n;while(chest.points>=5){chest.points-=5;chest.ready++;}}
function checkedCount(entry){return entry&&Array.isArray(entry.scores)?entry.scores.filter(Number.isInteger).length:0;}
function weeklyProgress(){const start=weekKey(),startMs=new Date(start+'T00:00:00Z').getTime(),endMs=startMs+7*86400000;let days=0,allFiveDays=0;for(const [k,e] of Object.entries(state.days)){const ms=new Date(k+'T00:00:00Z').getTime();if(ms>=startMs&&ms<endMs){const n=checkedCount(e);if(n)days++;if(n===5)allFiveDays++;}}return{days,allFiveDays};}
const WEEKLY_QUESTS=[
{id:'steady',name:'Steady Adventurer',desc:'Check in on 3 different days this week.',goal:3,reward:15,metric:'days'},
{id:'habit',name:'Building a Habit',desc:'Check in on 5 different days this week.',goal:5,reward:25,metric:'days'},
{id:'regular',name:'Fitville Regular',desc:'Check in all 5 skills on 4 different days this week.',goal:4,reward:40,metric:'allFiveDays'}
];
function dailyEntry(){const key=day();let e=state.days[key];if(e){state.dailyResetVersion=2;return e;}
// Old versions stored local calendar dates. Preserve any skill check-ins already completed during migration.
const local=new Date(),oldKey=local.getFullYear()+'-'+String(local.getMonth()+1).padStart(2,'0')+'-'+String(local.getDate()).padStart(2,'0');
if((state.dailyResetVersion||0)<2){state.dailyResetVersion=2;const old=state.days[oldKey];if(old&&old.scores.some(Number.isInteger)){if(oldKey!==key){state.days[key]=old;delete state.days[oldKey];}e=old;}save();}
return e;}
function resetText(){const remaining=Math.max(0,nextReset()-Date.now()),hours=Math.floor(remaining/3600000),minutes=Math.floor(remaining%3600000/60000);return 'Resets at 3:30 a.m. CST (UTC−6) · '+hours+'h '+minutes+'m remaining';}
function baseIncome(){return 2+state.skills.reduce((n,s)=>n+s.tier*2,0);}
function income(){return baseIncome()*(1+townGoldBonus()/100);}
function accrue(){const now=Date.now();state.bank=Math.min(income()*8,state.bank+Math.min(CAP,Math.max(0,now-state.last))/3600000*income());state.last=now;}
function save(){if(DEV)return;try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch(e){storageOK=false;notify('Saving is unavailable. Keep this page open or export a backup.');}}
function notify(t){document.getElementById('notice').textContent=t;clearTimeout(timer);timer=setTimeout(()=>document.getElementById('notice').textContent='',5000);}

const COLORS=['#7962a6','#4f7836','#267b7d','#ad5b28','#3b6daa'];
const BUILDING_FORMS=[
['Rest Tent','Moonlit Cabin','Rest Lodge','Dreamer Inn','Moonlight Retreat','Celestial Rest Lodge'],
['Produce Stall','Fresh Kiosk','Fresh Market','Garden Market','Harvest Hall','Grand Harvest Market'],
['Stretching Mat','Wellness Nook','Wellness Studio','Flow Pavilion','Harmony Hall','Grand Wellness Sanctuary'],
['Dirt Trail','Walking Path','Walking Trail','Runner’s Circuit','Endurance Park','Grand Adventure Trail'],
['Training Yard','Small Gym','Training Gym','Iron Hall','Champion Gym','Grand Training Arena']
];
function buildingForm(i,t){return BUILDING_FORMS[i][t];}
function levelOneHouse(i){
const data=[
{roof:'#5a56a7',trim:'#433c83',sign:'☾',banner:'#5965b8'},
{roof:'#4f9a43',trim:'#347032',sign:'✿',banner:'#5aa04d'},
{roof:'#238f9b',trim:'#176b78',sign:'◇',banner:'#2b9aa0'},
{roof:'#dd7442',trim:'#a94e31',sign:'ϟ',banner:'#3d8fc2'},
{roof:'#c94538',trim:'#92312d',sign:'◆',banner:'#d64a3c'}
][i],r=data.roof,tr=data.trim,sg=data.sign,bn=data.banner;
const themed=[
'<g><rect x="18" y="79" width="28" height="12" rx="3" fill="#8a6548"/><rect x="22" y="72" width="20" height="8" rx="3" fill="#f5e6cf"/><circle cx="112" cy="78" r="7" fill="#f4cf55"/><path d="M112 66V91" stroke="#76513b" stroke-width="3"/></g>',
'<g><rect x="13" y="74" width="28" height="20" rx="3" fill="#9a633e"/><g fill="#e95843"><circle cx="20" cy="77" r="4"/><circle cx="29" cy="79" r="4"/></g><g fill="#72b83f"><circle cx="37" cy="77" r="4"/></g><path d="M104 94V69M114 94V67M124 94V72" stroke="#7b5a3a" stroke-width="2"/><path d="M99 77H130M99 86H130" stroke="#7b5a3a" stroke-width="2"/></g>',
'<g><circle cx="24" cy="85" r="14" fill="#8ed4e4"/><circle cx="24" cy="85" r="8" fill="#dff8ff"/><path d="M111 93Q115 71 126 64Q129 82 119 94" fill="#78c96a"/><path d="M100 93Q104 73 94 67Q91 84 98 94" fill="#65b95b"/></g>',
'<g><path d="M103 94V69Q112 58 121 69V94" fill="#e56f54" stroke="#a94e31" stroke-width="2"/><path d="M106 72H119M106 79H119M106 86H119" stroke="#fff3d5" stroke-width="2"/><rect x="14" y="80" width="28" height="6" rx="3" fill="#92704c"/><circle cx="20" cy="78" r="5" fill="#66a8e8"/></g>',
'<g><path d="M15 90H43" stroke="#544a43" stroke-width="4"/><path d="M20 84V96M38 84V96" stroke="#544a43" stroke-width="3"/><circle cx="25" cy="90" r="6" fill="#3d4650"/><circle cx="34" cy="90" r="6" fill="#3d4650"/><rect x="104" y="74" width="24" height="20" rx="3" fill="#9a714a"/><path d="M108 74V67M124 74V67" stroke="#755037" stroke-width="3"/></g>'
][i];
return '<svg viewBox="0 0 140 110" aria-hidden="true"><ellipse cx="70" cy="101" rx="55" ry="7" fill="#214d31" opacity=".24"/><rect x="31" y="49" width="78" height="47" rx="4" fill="#f5e5c8" stroke="#76533d" stroke-width="2"/><path d="M20 52L70 16L120 52Z" fill="'+r+'" stroke="'+tr+'" stroke-width="4" stroke-linejoin="round"/><path d="M28 49L70 22L112 49" fill="none" stroke="#f5c66b" stroke-width="3" opacity=".85"/><path d="M36 52V95M104 52V95" stroke="#c79c6e" stroke-width="3"/><rect x="60" y="68" width="21" height="28" rx="3" fill="#79553b" stroke="#513727" stroke-width="2"/><rect x="40" y="62" width="13" height="14" rx="2" fill="#9ddcf0" stroke="#68b4c7"/><rect x="87" y="62" width="13" height="14" rx="2" fill="#9ddcf0" stroke="#68b4c7"/><rect x="55" y="42" width="30" height="18" rx="3" fill="#fff4d8" stroke="'+tr+'" stroke-width="2"/><text x="70" y="56" text-anchor="middle" font-size="16" fill="'+tr+'">'+sg+'</text><path d="M109 45V82" stroke="#70503a" stroke-width="3"/><path d="M111 47H132V66H111Z" fill="'+bn+'" stroke="#fff3d0" stroke-width="2"/><text x="121.5" y="61" text-anchor="middle" font-size="12" fill="white">'+sg+'</text>'+themed+'</svg>';
}
function house(i,t){if(t===0)return levelOneHouse(i);
if(i===4){
 const stage=Math.max(0,Math.min(5,t)), red=['#b83b32','#b6332e','#aa2928','#982323','#8d1e21','#7c171d'][stage];
 const side=stage>=2?'<rect x="18" y="62" width="28" height="31" rx="4" fill="#ead7b2" stroke="#79543b" stroke-width="2"/><path d="M14 64L32 47L50 64Z" fill="'+red+'" stroke="#6e3a2d" stroke-width="2"/>':'';
 const stone=stage>=3?'<rect x="96" y="54" width="27" height="40" rx="3" fill="#d7d0c0" stroke="#6f6257" stroke-width="2"/><path d="M92 56L109 38L127 56Z" fill="'+red+'" stroke="#6e3a2d" stroke-width="2"/><path d="M101 68H118M101 77H118" stroke="#b4aa99" stroke-width="2"/>':'';
 const towers=stage>=4?'<g fill="#d8d0bf" stroke="#6e5c50" stroke-width="2"><rect x="5" y="49" width="17" height="44"/><rect x="118" y="49" width="17" height="44"/></g><g fill="'+red+'" stroke="#6e3a2d" stroke-width="2"><path d="M2 50L14 31L25 50Z"/><path d="M115 50L127 31L138 50Z"/></g><g fill="#d89b35"><circle cx="14" cy="31" r="3"/><circle cx="127" cy="31" r="3"/></g>':'';
 const grand=stage>=5?'<path d="M52 23L58 9L66 15L70 4L75 15L83 9L88 23Z" fill="#ffd35b" stroke="#9d691d" stroke-width="2"/><path d="M24 95H116V102H24Z" fill="#c9b69b"/><path d="M48 95L70 80L92 95Z" fill="#d4c5aa"/><g fill="#f2b53d"><circle cx="30" cy="78" r="5"/><circle cx="110" cy="78" r="5"/></g>':'';
 const props=stage>=1?'<g stroke="#49413d" stroke-width="3" stroke-linecap="round"><path d="M12 95H38M17 89V101M33 89V101"/></g>':'';
 return '<svg viewBox="0 0 140 110" aria-hidden="true"><ellipse cx="70" cy="101" rx="'+(43+stage*3)+'" ry="7" fill="#315c35" opacity=".28"/>'+towers+side+stone+'<rect x="'+(36-stage*2)+'" y="'+(54-stage)+'" width="'+(68+stage*4)+'" height="'+(42+stage)+'" rx="4" fill="'+(stage>=3?'#e6dcc7':'#e8cfaa')+'" stroke="#76533c" stroke-width="2"/><path d="M'+(27-stage*2)+' '+(55-stage)+'L70 '+(22-stage*2)+'L'+(113+stage*2)+' '+(55-stage)+'Z" fill="'+red+'" stroke="#6e382d" stroke-width="3" stroke-linejoin="round"/><path d="M42 55L70 34L98 55" fill="none" stroke="#f1c45a" stroke-width="'+(stage>=4?4:2)+'"/><rect x="61" y="68" width="19" height="28" rx="3" fill="#704b36" stroke="#493326" stroke-width="2"/><rect x="43" y="64" width="12" height="13" rx="2" fill="#9ddcf0"/><rect x="86" y="64" width="12" height="13" rx="2" fill="#9ddcf0"/><rect x="56" y="48" width="29" height="17" rx="2" fill="#f3e3c3" stroke="#8f4b36" stroke-width="2"/><text x="70" y="61" text-anchor="middle" font-size="15">🏋️</text>'+props+grand+'</svg>';
}
const c=COLORS[i],roof=['#8871b4','#6e954d','#479a98','#d48550','#588ac2'][i],icon=SKILLS[i].icon;
const extras=[t>=1?'<rect x="91" y="21" width="9" height="25" rx="2" fill="#bd8d68"/>':'',t>=2?'<rect x="12" y="58" width="27" height="36" rx="4" fill="#f4dfb9"/><path d="M8 59L25 42L43 59Z" fill="'+roof+'"/>':'',t>=3?'<path d="M35 80H106V89H35Z" fill="'+roof+'"/><rect x="108" y="56" width="12" height="38" rx="2" fill="#dbc49a"/><circle cx="20" cy="91" r="8" fill="#51b54c"/><circle cx="122" cy="91" r="8" fill="#51b54c"/>':'',t>=4?'<path d="M112 16V59" stroke="#76573f" stroke-width="3"/><path d="M113 17H137L125 26L137 35H113Z" fill="#ffd15d"/>':'',t>=5?'<path d="M57 17L62 5L70 12L78 5L83 17Z" fill="#ffd85e" stroke="#a87920" stroke-width="2"/>':''].join('');
return '<svg viewBox="0 0 140 110" aria-hidden="true"><ellipse cx="70" cy="99" rx="'+(42+t*2)+'" ry="8" fill="#628957" opacity=".25"/><rect x="'+(38-t*2)+'" y="'+(52-t)+'" width="'+(64+t*4)+'" height="'+(43+t)+'" rx="5" fill="'+(t>=4?'#fff3d2':'#fff0cf')+'"/><path d="M'+(28-t*2)+' '+(53-t)+'L70 '+(22-t*2)+'L'+(112+t*2)+' '+(53-t)+'Z" fill="'+roof+'" stroke="'+c+'" stroke-width="'+(3+(t>=4?1:0))+'" stroke-linejoin="round"/><rect x="61" y="67" width="19" height="28" rx="5" fill="#866947"/><rect x="44" y="62" width="12" height="14" rx="3" fill="#a9d9e1"/><rect x="85" y="62" width="12" height="14" rx="3" fill="#a9d9e1"/>'+extras+'<text x="70" y="55" text-anchor="middle" font-size="'+(19+t)+'">'+icon+'</text></svg>';
}
function village(){
const l=townLevel();
const zones=SKILL_DISPLAY_ORDER.map(i=>{const s=SKILLS[i],t=state.skills[i].tier,ready=t<5&&state.coins>=COSTS[t+1];return '<button class="scene-building scene-skill-'+i+'" data-building="'+i+'" aria-label="'+s.name+' building, level '+(t+1)+' — check in or view upgrades">'+(ready?'<span class="scene-upgrade">UPGRADE!</span>':'')+'<span class="sr-only">'+s.name+' Lv '+(t+1)+'</span></button>';}).join('');
return '<div class="row town-heading"><div><span class="anime-tag">Home</span><h2>'+townTitle()+'</h2></div><span class="pill">Town '+l+' / 26</span></div><div class="town-hero"><div class="town-map illustrated-town" aria-label="Fitville illustrated village"><img class="town-scene" src="assets/fitville-crossroads-mobile.jpg" alt="Illustrated Fitville village with five skill buildings">'+zones+'</div></div><p class="map-caption">Tap a building to check in or view upgrades</p>';
}
function reward(text){let el=document.createElement('div');el.className='reward';el.textContent=text;document.body.append(el);setTimeout(()=>el.remove(),1900);}


let appearance={hair:0,outfit:0,skin:0};
const HAIR=['#34314e','#9a613f','#e1bb66'], OUTFIT=['#687dc5','#638f76','#bc778d'], SKIN=['#f8d8bc','#c99571','#82533f'];
function baseAvatar(a){const hair=HAIR[a.hair]||HAIR[0],outfit=OUTFIT[a.outfit]||OUTFIT[0],skin=SKIN[a.skin]||SKIN[0];return '<svg viewBox="0 0 180 210" role="img" aria-label="Your anime-inspired adventurer"><circle cx="90" cy="95" r="79" fill="#fff7e8"/><path d="M38 205Q35 147 90 144Q145 147 142 205" fill="'+outfit+'" stroke="#343650" stroke-width="3"/><path d="M73 143L90 169L107 143" fill="#fff3db" stroke="#343650" stroke-width="2"/><path d="M79 125V148Q90 162 101 148V125" fill="'+skin+'" stroke="#343650" stroke-width="2"/><path d="M39 87Q31 20 90 21Q151 20 141 104L129 129H50Z" fill="'+hair+'" stroke="#343650" stroke-width="3"/><ellipse cx="45" cy="93" rx="9" ry="13" fill="'+skin+'"/><ellipse cx="135" cy="93" rx="9" ry="13" fill="'+skin+'"/><path d="M47 64Q90 33 133 64V101Q128 139 90 144Q52 138 47 101Z" fill="'+skin+'" stroke="#343650" stroke-width="2"/><path d="M40 83L44 48Q90 3 137 49L142 87L115 57L97 79L94 48L72 74L65 53Z" fill="'+hair+'" stroke="#343650" stroke-width="2"/><path d="M57 90Q67 81 78 89M102 89Q113 81 124 90" stroke="#343650" fill="none" stroke-width="3"/><ellipse cx="69" cy="100" rx="8" ry="12" fill="white"/><ellipse cx="112" cy="100" rx="8" ry="12" fill="white"/><ellipse cx="70" cy="102" rx="5" ry="9" fill="#667daf"/><ellipse cx="111" cy="102" rx="5" ry="9" fill="#667daf"/><circle cx="72" cy="98" r="2.5" fill="white"/><circle cx="113" cy="98" r="2.5" fill="white"/><path d="M83 122Q90 128 98 121" fill="none" stroke="#9c6259" stroke-width="2.5" stroke-linecap="round"/><path d="M53 113H66M116 113H129" stroke="#d38387" stroke-width="3" opacity=".6"/><path d="M51 179H73M107 179H129" stroke="#fff2da" stroke-width="4"/><circle cx="90" cy="180" r="7" fill="#e8c66f" stroke="#343650" stroke-width="2"/></svg>';}
function safeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function creator(){return '<section class="card creator"><span class="anime-tag">A new adventure begins</span><h2>Create your adventurer</h2><div class="portrait">'+avatar(appearance)+'</div><label for="character-name">Character name</label><input id="character-name" maxlength="24" placeholder="Your adventurer’s name" autocomplete="off"><fieldset><legend>Hair</legend><div class="choices">'+['Midnight','Chestnut','Golden'].map((n,i)=>'<button data-look="hair" data-value="'+i+'" aria-pressed="'+(appearance.hair===i)+'">'+n+'</button>').join('')+'</div></fieldset><fieldset><legend>Outfit</legend><div class="choices">'+['Sky','Forest','Rose'].map((n,i)=>'<button data-look="outfit" data-value="'+i+'" aria-pressed="'+(appearance.outfit===i)+'">'+n+'</button>').join('')+'</div></fieldset><fieldset><legend>Skin tone</legend><div class="choices">'+['Light','Medium','Deep'].map((n,i)=>'<button data-look="skin" data-value="'+i+'" aria-pressed="'+(appearance.skin===i)+'">'+n+'</button>').join('')+'</div></fieldset><p class="muted">All five skills begin at level 1 with 0 XP.</p><button id="begin" class="wide">Begin your adventure</button>'+(state.skills.some(s=>s.xp>0)||state.coins>0?'<p class="muted">You already have saved progress. Creating this character keeps it. Use “Start a new adventure” in Town to reset to 0 XP.</p>':'')+'</section>';}
function characterCard(){const c=state.character;return '<section class="card character-card"><div class="portrait">'+avatar(c)+'</div><div><span class="anime-tag">Fitville adventurer</span><h2>'+safeText(c.name)+'</h2><p class="character-meta">Five skills. One adventure.</p><b>'+state.skills.reduce((n,s)=>n+s.xp,0).toLocaleString()+' total XP</b></div></section>';}


const TITLES=[
['Dreamer','Rest Seeker','Moon Walker','Night Guardian','Dream Weaver','Rest Keeper','Moonlight Adept','Dream Sage','Twilight Warden','Rest Champion','Dream Knight','Moonlight Master','Celestial Sleeper','Dream Sovereign','Dream Ascendant'],
['Fresh Starter','Balanced Bite','Nourished Explorer','Garden Guardian','Balanced Builder','Nourishment Keeper','Harvest Adept','Harvest Sage','Garden Warden','Nourishment Champion','Harvest Knight','Balance Master','Nourishment Legend','Harvest Sovereign','Nourishment Ascendant'],
['First Stretch','Limber Learner','Flow Seeker','Flexible Explorer','Flow Adept','Mobility Keeper','Balance Adept','Flow Sage','Mobility Warden','Flexibility Champion','Flow Knight','Mobility Master','Flow Legend','Flow Sovereign','Flow Ascendant'],
['Trail Starter','Steady Strider','Distance Seeker','Swift Runner','Endurance Adept','Trail Keeper','Fleetfoot','Endurance Sage','Trail Warden','Cardio Champion','Wind Knight','Endurance Master','Trail Legend','Wind Sovereign','Wind Ascendant'],
['First Lift','Iron Learner','Power Builder','Iron Guardian','Strength Adept','Power Keeper','Ironheart','Strength Sage','Iron Warden','Strength Champion','Iron Knight','Power Master','Iron Legend','Iron Sovereign','Iron Ascendant']
];
const CROWNS=['Moonlight Crown','Harvest Crown','Harmony Crown','Wind Crown','Iron Crown'];
const SYMBOLS=['☾','✿','◇','ϟ','◆'];
function titleFor(i,l){return l===99?TITLES[i][14]:l<7?'Novice':TITLES[i][Math.floor(l/7)-1];}
function crown(i){return '<svg class="skill-crown" viewBox="0 0 120 85" role="img" aria-label="'+CROWNS[i]+'"><path d="M15 62L7 22L34 39L60 7L86 39L113 22L105 62Z" fill="'+COLORS[i]+'" stroke="#d6a642" stroke-width="5" stroke-linejoin="round"/><rect x="15" y="62" width="90" height="14" rx="4" fill="#f0c965" stroke="#b6892e" stroke-width="3"/><circle cx="60" cy="43" r="15" fill="#fff2bd"/><text x="60" y="49" text-anchor="middle" fill="'+COLORS[i]+'" font-size="21">'+SYMBOLS[i]+'</text></svg>';}
let celebrations=[],celebrationFocus;
function queueLevels(i,before,after){for(let l=before+1;l<=after;l++)celebrations.push({i,l});if(celebrations.length&&!document.getElementById('level-dialog').open){celebrationFocus=document.activeElement;showLevel();}}
function showLevel(){const item=celebrations[0];if(!item)return;const {i,l}=item,unlock=l===99?'Mastery title: '+titleFor(i,l)+' · '+CROWNS[i]:l%7===0?'New title: '+titleFor(i,l):'No new item at this level. Next title at level '+(Math.min(99,Math.ceil(l/7)*7))+'.';
document.getElementById('level-content').innerHTML='<span class="anime-tag">'+SKILLS[i].name+' level up</span><h2 id="level-heading"><span class="congratulations">Congratulations!</span>You reached level '+l+'!</h2>'+(l===99?crown(i):'<div class="level-emblem">'+SKILLS[i].icon+'</div>')+'<p><b>'+safeText(unlock)+'</b></p><p class="muted">'+(l===99?'Your skill crown is permanently displayed on your Skills page.':'Current title: '+titleFor(i,l))+'</p>';
document.getElementById('level-next').textContent=celebrations.length>1?'Next level celebration ('+(celebrations.length-1)+' remaining)':'Continue adventure';
const dialog=document.getElementById('level-dialog');if(!dialog.open)dialog.showModal();document.getElementById('level-next').focus();fireworks();}
function fireworks(){const field=document.getElementById('fireworks');field.innerHTML='';if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let burst=0;burst<4;burst++){const x=15+Math.random()*70,y=15+Math.random()*40;for(let j=0;j<16;j++){const p=document.createElement('span'),angle=j*Math.PI/8;p.className='spark';p.style.cssText='left:'+x+'%;top:'+y+'%;background:'+['#ffd35d','#69d9ff','#ff8aca','#96f06c'][burst]+';--dx:'+Math.cos(angle)*110+'px;--dy:'+Math.sin(angle)*110+'px;animation-delay:'+burst*.2+'s';field.append(p);}}}
function nextCelebration(){celebrations.shift();if(celebrations.length)showLevel();else{document.getElementById('level-dialog').close();document.getElementById('fireworks').innerHTML='';if(celebrationFocus&&celebrationFocus.isConnected)celebrationFocus.focus();}}


const ITEMS=[
{id:'sky-cape',name:'Sky Cape',slot:'accessory',price:30,description:'A bright blue adventurer’s cape.'},
{id:'rose-scarf',name:'Rose Scarf',slot:'accessory',price:40,description:'A warm rose-coloured scarf.'},
{id:'star-pin',name:'Star Hairpin',slot:'hat',price:25,description:'A golden star for your hairstyle.'},
{id:'explorer-hat',name:'Explorer Hat',slot:'hat',price:60,description:'A blue cap for town adventures.'},
{id:'sunrise-outfit',name:'Sunrise Outfit',slot:'outfit',price:80,description:'A golden outfit for brighter days.'},
{id:'first-ribbon',name:'First Steps Ribbon',slot:'hat',achievement:'first-check',description:'Reward for your first skill check-in.'},
{id:'builder-cape',name:'Builder’s Cape',slot:'accessory',achievement:'first-upgrade',description:'Reward for your first building upgrade.'},
{id:'trail-outfit',name:'Trailblazer Outfit',slot:'outfit',achievement:'25-checks',description:'Reward for 25 individual skill check-ins.'},
{id:'champion-pin',name:'Champion’s Pin',slot:'hat',achievement:'level-50',description:'Reward for reaching level 50 in a skill.'}
];
const ACHIEVEMENTS=[
{id:'first-check',name:'First Steps',goal:1,description:'Complete your first skill check-in.',value:()=>Object.values(state.days).reduce((n,d)=>n+checkedCount(d),0)},
{id:'first-upgrade',name:'Town Builder',goal:1,description:'Upgrade your first building.',value:()=>state.skills.reduce((n,s)=>n+s.tier,0)},
{id:'25-checks',name:'Habit Explorer',goal:25,description:'Complete 25 individual skill check-ins.',value:()=>Object.values(state.days).reduce((n,d)=>n+checkedCount(d),0)},
{id:'level-50',name:'Rising Champion',goal:50,description:'Reach level 50 in any skill.',value:()=>Math.max(...state.skills.map(s=>level(s.xp)))}
];
let characterPanel='wardrobe';
function inventory(){state.wardrobe??={owned:[],equipped:{},earned:[]};return state.wardrobe;}
function awardAchievements(){const w=inventory();for(const a of ACHIEVEMENTS){if(a.value()>=a.goal&&!w.earned.includes(a.id)){w.earned.push(a.id);const item=ITEMS.find(x=>x.achievement===a.id);if(item&&!w.owned.includes(item.id))w.owned.push(item.id);}}}
function avatar(a){let art=baseAvatar(a);if(!state.character||a!==state.character)return art;const e=inventory().equipped;let extra='';
if(e.outfit==='sunrise-outfit')art=art.replace('fill="'+(OUTFIT[a.outfit]||OUTFIT[0])+'"','fill="#e9b650"');
if(e.outfit==='trail-outfit')art=art.replace('fill="'+(OUTFIT[a.outfit]||OUTFIT[0])+'"','fill="#28a38b"');
if(e.accessory==='sky-cape'||e.accessory==='builder-cape')extra+='<path d="M45 152L22 206H55L60 171M135 152L158 206H125L120 171" fill="'+(e.accessory==='sky-cape'?'#338be4':'#b98d50')+'" stroke="#343650" stroke-width="2"/>';
if(e.accessory==='rose-scarf')extra+='<path d="M69 145Q90 164 111 145L112 156Q92 176 68 156Z" fill="#dc779b" stroke="#343650" stroke-width="2"/><path d="M102 157V189L116 184L112 155" fill="#dc779b"/>';
if(e.hat==='star-pin'||e.hat==='champion-pin')extra+='<path d="M121 39L125 49L136 49L127 56L131 66L121 60L112 66L115 56L106 49L117 49Z" fill="'+(e.hat==='star-pin'?'#f7d165':'#74dbef')+'" stroke="#826528" stroke-width="2"/>';
if(e.hat==='first-ribbon')extra+='<path d="M115 45L102 36V58L115 50L130 59V36Z" fill="#ed8aaf" stroke="#343650" stroke-width="2"/><circle cx="115" cy="47" r="4" fill="#ffe3e8"/>';
if(e.hat==='explorer-hat')extra+='<path d="M44 45Q50 8 94 13Q132 15 138 47Z" fill="#328be0" stroke="#343650" stroke-width="2"/><path d="M35 47Q89 33 143 47L146 54H34Z" fill="#226bb2"/>';
if(e.hat&&e.hat.startsWith('crown-')){const i=Number(e.hat.slice(6));if(i>=0&&i<5&&level(state.skills[i].xp)===99)extra+='<path d="M57 27L51 4L73 16L90 1L107 16L129 4L123 27Z" fill="'+COLORS[i]+'" stroke="#e3ba50" stroke-width="3"/><rect x="57" y="27" width="66" height="7" rx="2" fill="#f1ce69"/><text x="90" y="24" text-anchor="middle" font-size="15" fill="white">'+SYMBOLS[i]+'</text>';}
return art.replace('</svg>',extra+'</svg>');}
function characterScreen(){const w=inventory();let html=characterCard()+'<div class="character-tabs"><button data-panel="wardrobe" aria-pressed="'+(characterPanel==='wardrobe')+'">Wardrobe</button><button data-panel="shop" aria-pressed="'+(characterPanel==='shop')+'">Shop</button><button data-panel="achievements" aria-pressed="'+(characterPanel==='achievements')+'">Achievements</button></div>';
if(characterPanel==='achievements'){html+='<h2>Your milestones</h2>';for(const a of ACHIEVEMENTS){const done=w.earned.includes(a.id),v=Math.min(a.goal,a.value()),item=ITEMS.find(x=>x.achievement===a.id);html+='<section class="card"><div class="row"><h3>'+a.name+'</h3><span class="pill">'+(done?'✓ Unlocked':v+' / '+a.goal)+'</span></div><p class="muted">'+a.description+'</p><progress max="'+a.goal+'" value="'+v+'" aria-label="'+a.name+' progress"></progress><p>Reward: <b>'+item.name+'</b></p></section>';}}
if(characterPanel==='shop'){html+='<h2>Town wardrobe shop</h2><p class="muted">Cosmetics let you customize your adventurer. Wear whatever look you like — cosmetics do not affect XP.</p>';for(const item of ITEMS.filter(x=>x.price)){const owned=w.owned.includes(item.id);html+='<section class="card"><div class="row"><h3>'+item.name+'</h3><span class="pill">Cosmetic</span></div><p class="muted">'+item.description+'</p><button class="wide" data-buy="'+item.id+'" '+(owned||state.coins<item.price?'disabled':'')+'>'+(owned?'Owned':item.price+' coins · Buy')+'</button></section>';}}
if(characterPanel==='wardrobe'){html+='<h2>Your collection</h2><p class="muted">Equip one outfit, one accessory, and one headpiece.</p><section class="card"><h3>Starter appearance</h3><div class="choices">'+['Midnight hair','Chestnut hair','Golden hair'].map((n,i)=>'<button data-style="hair" data-value="'+i+'" aria-pressed="'+(state.character.hair===i)+'">'+n+'</button>').join('')+'</div><div class="choices">'+['Sky outfit','Forest outfit','Rose outfit'].map((n,i)=>'<button data-style="outfit" data-value="'+i+'" aria-pressed="'+(state.character.outfit===i&&!w.equipped.outfit)+'">'+n+'</button>').join('')+'</div></section>';
const unlocked=ITEMS.filter(x=>w.owned.includes(x.id));if(!unlocked.length)html+='<section class="card"><p>Your collection is ready to grow. Check in for your first reward, or visit the shop.</p></section>';for(const item of unlocked){let equipped=w.equipped[item.slot]===item.id;html+='<section class="card"><div class="row"><h3>'+item.name+'</h3><span class="pill">Cosmetic</span></div><p class="muted">'+item.description+'</p><button class="wide" data-equip="'+item.id+'">'+(equipped?'Unequip':'Equip')+'</button></section>';}
for(let i=0;i<5;i++)html+='<section class="card crown-unlock">'+crown(i)+'<h3>'+CROWNS[i]+'</h3><p class="muted">'+(level(state.skills[i].xp)===99?'Earned through '+SKILLS[i].name+' mastery. A cosmetic symbol of skill mastery.':'Unlock at '+SKILLS[i].name+' level 99. Cosmetic mastery reward.')+'</p>'+(level(state.skills[i].xp)===99?'<button data-crown="'+i+'">'+(w.equipped.hat==='crown-'+i?'Unequip':'Equip crown')+'</button>':'<span class="pill">Locked</span>')+'</section>';}
return html;}

function render(){document.body.classList.toggle('map-home',tab==='town'&&!!state.character);accrue();awardAchievements();const wallet=document.getElementById('wallet'),banked=Math.floor(state.bank);wallet.innerHTML='<span class="gold-coin" aria-hidden="true"></span> '+Math.floor(state.coins).toLocaleString()+' gold';wallet.classList.toggle('gold-ready',banked>0);wallet.classList.toggle('gold-empty',banked<=0);wallet.title=banked>0?'Tap to collect '+banked+' town gold':'Town gold collected';wallet.setAttribute('aria-label',banked>0?'Gold: '+Math.floor(state.coins)+'. '+banked+' town gold ready to collect.':'Gold: '+Math.floor(state.coins)+'. Town gold collected.');const overallXp=state.skills.reduce((n,s)=>n+s.xp,0),adventurerLevel=level(overallXp),xpDisplay=document.getElementById('total');xpDisplay.textContent='✦ Lv '+adventurerLevel+' · '+overallXp.toLocaleString()+(adventurerLevel<99?' / '+XP[adventurerLevel+1].toLocaleString()+' XP':' XP · MAX');xpDisplay.title=adventurerLevel<99?'Combined skill XP · '+(XP[adventurerLevel+1]-overallXp).toLocaleString()+' XP to adventurer level '+(adventurerLevel+1):'Adventurer level 99 reached';
document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===(tab==='building'?'town':tab)));
let html='';

if(!state.character){document.getElementById('view').innerHTML=creator();document.querySelector('nav').hidden=true;return;}document.querySelector('nav').hidden=false;
if(!storageOK)html+='<p class="card">Device saving is unavailable or an old save could not be loaded. Export a backup below to preserve your progress.</p>';
if(tab==='town')html+=village();
if(tab==='settings'){html+='<button class="back-button" data-tab="town">← Back to Town</button><section class="card tools"><h2>⚙ Settings</h2><p class="muted">Progress stays in this browser. Export before switching devices or clearing browser data.</p><button id="export">Export save</button><p><label>Import save backup<br><input id="import" type="file" accept=".json,application/json" style="max-width:100%;margin-top:10px" aria-label="Import save backup"></label></p><button id="restart" class="restart wide">Start a new adventure · reset progress</button></section>';}
if(tab==='building'){
const i=selectedBuilding,s=SKILLS[i],x=state.skills[i],t=x.tier;
html+='<button id="back-town" class="back-button">← Back to Town</button><section class="card building-detail skill-card" style="--skill:'+COLORS[i]+'"><span class="anime-tag">'+s.name+' training</span><h2>'+buildingForm(i,t)+'</h2><p class="muted">'+s.building+' · '+TIERS[t]+' form</p><div class="detail-house">'+house(i,t)+'</div><span class="building-level">Building level '+(t+1)+'</span><p class="title-label">'+TIERS[t]+' training</p><div class="detail-stats"><div><b>'+RATES[t]+'</b><span>XP per score point</span></div><div><b>'+RATES[t]*5+'</b><span>XP for a 5/5 check-in</span></div></div><p class="muted">Your '+s.name+' skill is level '+level(x.xp)+' · '+titleFor(i,level(x.xp))+'</p>'+(t<5?'<div class="upgrade-preview"><h3>Next: '+buildingForm(i,t+1)+'</h3><p>'+TIERS[t+1]+' · Building level '+(t+2)+' · '+RATES[t+1]+' XP per point</p><div class="detail-house">'+house(i,t+1)+'</div><p class="muted">'+(COSTS[t+1]>state.coins?'You need '+Math.ceil(COSTS[t+1]-state.coins).toLocaleString()+' more coins.':'Ready to upgrade!')+'</p><button class="wide" data-upgrade="'+i+'" '+(state.coins<COSTS[t+1]?'disabled':'')+'>Upgrade · '+COSTS[t+1].toLocaleString()+' coins</button></div>':'<div class="upgrade-preview"><h3>Fully upgraded!</h3><p>Your training facility has reached its highest level.</p></div>')+'<button class="wide visit-check" data-tab="check">Open daily check-in</button><p class="muted">Upgrades improve future check-ins and add 2 coins per hour to town income.</p></section>';
}
if(tab==='character')html+=characterScreen();
if(tab==='check'){
const entry=dailyEntry()||{scores:[null,null,null,null,null],rates:[null,null,null,null,null]};if(draft.length!==5)draft=[null,null,null,null,null];
const remainingToday=5-checkedCount(entry);html+='<section class="card check-intro"><div class="row"><div><h2>Daily check-in</h2><p class="muted">'+resetText()+'</p></div><span class="pill">'+remainingToday+' left</span></div><p class="muted">Tap the score that best matches your day. It saves immediately. Planned rest counts.</p></section>';
SKILL_DISPLAY_ORDER.forEach(i=>{const s=SKILLS[i];const done=Number.isInteger(entry.scores[i]);html+='<section class="card skill-card '+(done?'done-card':'')+'" style="--skill:'+COLORS[i]+'"><div class="row"><h3>'+s.icon+' '+s.name+'</h3>'+(done?'<span class="pill">✓ '+entry.scores[i]+'/5</span>':'<span class="pill">Tap to save</span>')+'</div>'+(done?'<div class="saved-score">+'+entry.scores[i]*entry.rates[i]+' base XP today</div>':'<p class="muted">'+s.hint+'</p><div class="scores" role="group" aria-label="'+s.name+' score">'+[0,1,2,3,4,5].map(v=>'<button data-quick-score="'+v+'" data-skill="'+i+'">'+v+'</button>').join('')+'</div><div class="score-labels"><span>None</span><span>Met goal</span></div>')+'</section>';});
}
if(tab==='quests'){
const q=questState(),today=day(),wk=weekKey(),entry=dailyEntry(),dailyDone=checkedCount(entry)>0,dailyClaimed=!!q.daily[today],wp=weeklyProgress(),claimed=q.weekly[wk]||{};
const weekly=WEEKLY_QUESTS.map(x=>({...x,value:wp[x.metric]}));
html+='<section class="card"><h2>📜 Quests</h2><p>Weekly quests reward consistency across different days. Claim each reward when it is complete.</p><p class="muted">Daily quests reset with your check-ins. Weekly quests run Monday through Sunday.</p></section>';
const chest=q.chest;
html+='<section class="card collect-card"><div class="row"><div><span class="anime-tag">Treasure</span><h2>🎁 Quest Chest</h2></div><span class="pill">'+chest.ready+' ready</span></div><p>Claim quests to fill the chest meter. Daily quests give 1 point and weekly quests give 2.</p><progress max="5" value="'+chest.points+'" aria-label="Treasure chest progress"></progress><p class="muted">'+chest.points+' / 5 chest points · Each chest contains 25 <span class="gold-coin" aria-label="gold coin"></span>.</p><button class="wide" data-open-chest '+(chest.ready<1?'disabled':'')+'>'+(chest.ready?'Open Treasure Chest':'Keep questing')+'</button></section>';
html+='<section class="card"><div class="row"><div><span class="anime-tag">Daily Quest</span><h3>Daily Check-In</h3></div><span class="pill"><span class="gold-coin" aria-label="gold coin"></span> 5</span></div><p>Complete any one skill check-in today.</p><progress max="1" value="'+(dailyDone?1:0)+'" aria-label="Daily quest progress"></progress><button class="wide" data-claim-daily '+(!dailyDone||dailyClaimed?'disabled':'')+'>'+(dailyClaimed?'✓ Claimed':dailyDone?'Claim 5 <span class="gold-coin" aria-label="gold coin"></span>':'Complete a check-in first')+'</button></section>';
html+='<h2>Weekly Quests</h2>';
weekly.forEach(x=>{const done=x.value>=x.goal,isClaimed=!!claimed[x.id];html+='<section class="card"><div class="row"><h3>'+x.name+'</h3><span class="pill"><span class="gold-coin" aria-label="gold coin"></span> '+x.reward+'</span></div><p>'+x.desc+'</p><progress max="'+x.goal+'" value="'+Math.min(x.value,x.goal)+'" aria-label="'+x.name+' progress"></progress><p class="muted">'+Math.min(x.value,x.goal)+' / '+x.goal+'</p><button class="wide" data-claim-weekly="'+x.id+'" '+(!done||isClaimed?'disabled':'')+'>'+(isClaimed?'✓ Claimed':done?'Claim '+x.reward+' gold':'Quest in progress')+'</button></section>';});
}
if(tab==='skills'){html+='<section class="card"><h2>Your fitness skills</h2><p class="muted">Every check-in grows your skills. Upgrade your training facilities to earn more XP.</p></section>';SKILL_DISPLAY_ORDER.forEach(i=>{const s=SKILLS[i];let x=state.skills[i],l=level(x.xp),p=l===99?1:(x.xp-XP[l])/(XP[l+1]-XP[l]);html+='<section class="card skill-card" style="--skill:'+COLORS[i]+'"><div class="row"><h3>'+s.icon+' '+s.name+'</h3><b class="level-badge">Level '+l+'</b></div><progress max="1" value="'+p+'" aria-label="'+s.name+' level progress"></progress><div class="row muted"><span>'+x.xp.toLocaleString()+' XP</span><span>'+(l===99?'Mastered 🏆':(XP[l+1]-x.xp).toLocaleString()+' XP to level '+(l+1))+'</span></div><p class="muted">'+TIERS[x.tier]+' training · '+RATES[x.tier]+' XP per point</p><p class="title-label">'+titleFor(i,l)+'</p>'+(l===99?'<div class="crown-unlock">'+crown(i)+'<b>'+CROWNS[i]+'</b><p class="muted">Level 99 mastery reward</p></div>':'<p class="muted">Next title: level '+(Math.min(99,Math.floor(l/7)*7+7))+' · '+titleFor(i,Math.floor(l/7)*7+7)+'</p>')+'</section>';});}
document.getElementById('view').innerHTML=html;save();}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
if(b.id==='wallet'){accrue();let n=Math.floor(state.bank);if(n>0){state.bank-=n;state.coins+=n;render();reward('+'+n+' coins');notify('Collected '+n+' town gold.');}return;}
if(b.id==='recovery-reload'){location.reload();return;}
if(DEV&&b.id==='dev-toggle'){document.getElementById('dev-tools').hidden=true;document.getElementById('dev-open').hidden=false;return;}
if(DEV&&b.id==='dev-open'){document.getElementById('dev-tools').hidden=false;document.getElementById('dev-open').hidden=true;return;}
if(DEV&&b.dataset.devTown!==undefined){let target=Number(b.dataset.devTown),remaining=Math.max(0,target-1);state.skills.forEach(s=>s.tier=0);for(let i=0;i<state.skills.length&&remaining>0;i++){const n=Math.min(5,remaining);state.skills[i].tier=n;remaining-=n;}tab='town';render();notify('Previewing Town Level '+townLevel()+'. Original save is untouched.');return;}
if(DEV&&b.dataset.devLevel!==undefined){const input=document.getElementById('dev-level');if(input)input.value=b.dataset.devLevel;return;}
if(DEV&&b.id==='dev-set-level'){const select=document.getElementById('dev-skill'),input=document.getElementById('dev-level'),target=Math.max(1,Math.min(99,Math.floor(Number(input&&input.value)||1))),indices=select&&select.value==='all'?[0,1,2,3,4]:[Number(select&&select.value)];for(const i of indices){if(Number.isInteger(i)&&i>=0&&i<5)state.skills[i].xp=XP[target];}render();notify((indices.length===5?'All skills':SKILLS[indices[0]].name)+' set to Level '+target+' for testing.');return;}
if(DEV&&b.id==='dev-coins'){state.coins+=10000;render();reward('+10,000 test gold');return;}
if(DEV&&b.id==='dev-restore'){const raw=sessionStorage.getItem(DEV_BACKUP);if(raw===null){notify('No original save backup is available in this session.');return;}if(raw==='__EMPTY__'){state=fresh();}else{try{state=JSON.parse(raw);}catch(err){notify('Could not restore the original save.');return;}}draft=[];tab='town';render();notify('Original save restored in the preview.');return;}
if(DEV&&b.id==='dev-exit'){const raw=sessionStorage.getItem(DEV_BACKUP);if(raw==='__EMPTY__'){localStorage.removeItem(KEY);state=fresh();}else if(raw!==null){try{state=JSON.parse(raw);localStorage.setItem(KEY,raw);}catch(err){notify('Could not restore the original save.');return;}}sessionStorage.removeItem(DEV_BACKUP);sessionStorage.removeItem('fitville-dev-active');DEV=false;const u=new URL(location.href);u.searchParams.delete('dev');u.searchParams.delete('test');history.replaceState(null,'',u.pathname+u.search+u.hash);document.getElementById('dev-tools').hidden=true;document.getElementById('dev-open').hidden=true;draft=[];tab='town';render();notify('Developer Mode closed. Original save restored.');return;}
if(b.hasAttribute('data-claim-daily')){const q=questState(),today=day();if(checkedCount(dailyEntry())>0&&!q.daily[today]){q.daily[today]=true;state.coins+=5;addChestProgress(1);save();render();reward('+5 gold');notify('Daily quest reward claimed! Chest progress +1.');}return;}
if(b.hasAttribute('data-open-chest')){const chest=questState().chest;if(chest.ready>0){chest.ready--;chest.opened++;state.coins+=25;save();render();reward('🎁 +25 gold');notify('Treasure chest opened! You found 25 coins.');}return;}

if(b.dataset.claimWeekly){const q=questState(),wk=weekKey(),wp=weeklyProgress(),x=WEEKLY_QUESTS.find(q=>q.id===b.dataset.claimWeekly);q.weekly[wk]??={};if(x&&wp[x.metric]>=x.goal&&!q.weekly[wk][x.id]){q.weekly[wk][x.id]=true;state.coins+=x.reward;addChestProgress(2);save();render();reward('+'+x.reward+' gold');notify(x.name+' claimed! Chest progress +2.');}return;}
if(b.dataset.panel){characterPanel=b.dataset.panel;render();}
if(b.dataset.style){const k=b.dataset.style,v=Number(b.dataset.value);if(['hair','outfit'].includes(k)&&Number.isInteger(v)&&v>=0&&v<3){state.character[k]=v;if(k==='outfit')delete inventory().equipped.outfit;render();}}
if(b.dataset.buy){const item=ITEMS.find(x=>x.id===b.dataset.buy),w=inventory();if(item&&item.price&&!w.owned.includes(item.id)&&state.coins>=item.price){state.coins-=item.price;w.owned.push(item.id);render();notify(item.name+' added to your wardrobe.');}}
if(b.dataset.equip){const item=ITEMS.find(x=>x.id===b.dataset.equip),w=inventory();if(item&&w.owned.includes(item.id)){if(w.equipped[item.slot]===item.id)delete w.equipped[item.slot];else w.equipped[item.slot]=item.id;render();}}
if(b.dataset.crown!==undefined){const i=Number(b.dataset.crown),w=inventory();if(Number.isInteger(i)&&i>=0&&i<5&&level(state.skills[i].xp)===99){if(w.equipped.hat==='crown-'+i)delete w.equipped.hat;else w.equipped.hat='crown-'+i;render();}}
if(b.id==='level-next'){nextCelebration();return;}
if(b.dataset.look){const name=document.getElementById('character-name').value;appearance[b.dataset.look]=Number(b.dataset.value);render();document.getElementById('character-name').value=name;}
if(b.id==='begin'){const name=document.getElementById('character-name').value.trim();if(!name){notify('Enter a name for your adventurer.');document.getElementById('character-name').focus();return;}state.character={name:name.slice(0,24),...appearance};save();render();notify('Welcome to Fitville, '+name+'!');}
if(b.id==='restart'){if(!confirm('Start fresh? This removes all XP, coins, upgrades and check-ins on this device. Export a backup first if you want to keep them.'))return;state=fresh();appearance={hair:0,outfit:0,skin:0};draft=[];tab='town';save();render();notify('New adventure ready. Every skill starts at 0 XP.');}
if(b.dataset.building!==undefined){openBuildingCheck(Number(b.dataset.building));return;}
if(b.id==='back-town'){tab='town';render();window.scrollTo(0,0);}
if(b.dataset.tab){const targetTab=b.dataset.tab;tab=(b.closest('nav')&&tab===targetTab)?'town':targetTab;draft=[];render();window.scrollTo(0,0);return;}
if(b.id==='check-close'){document.getElementById('check-dialog').close();return;}
if(b.id==='check-upgrade'){document.getElementById('check-dialog').close();tab='building';render();window.scrollTo(0,0);return;}
if(b.dataset.quickScore!==undefined){document.getElementById('check-dialog').close();const i=Number(b.dataset.skill),score=Number(b.dataset.quickScore);if(!Number.isInteger(i)||i<0||i>=SKILLS.length||!Number.isInteger(score)||score<0||score>5)return;const existing=dailyEntry();if(existing&&Number.isInteger(existing.scores[i])){notify(SKILLS[i].name+' is already checked in today.');return;}const rate=RATES[state.skills[i].tier],before=level(state.skills[i].xp),baseXp=score*rate,xpBonus=townXpBonus(),earned=Math.ceil(baseXp*(1+xpBonus/100)),coins=score*2;const entry=existing||{scores:[null,null,null,null,null],rates:[null,null,null,null,null]};entry.scores[i]=score;entry.rates[i]=rate;state.days[day()]=entry;state.skills[i].xp+=earned;state.coins+=coins;save();render();if(earned>0)reward('+'+earned+' XP · +'+coins+' gold');notify(SKILLS[i].name+' saved · '+score+'/5.');queueLevels(i,before,level(state.skills[i].xp));return;}
if(b.dataset.score!==undefined){draft[Number(b.dataset.skill)]=Number(b.dataset.score);render();}
if(b.id==='collect'){accrue();let n=Math.floor(state.bank);state.bank-=n;state.coins+=n;render();if(n>0)reward('+'+n+' coins');notify('Collected '+n+' coins.');}
if(b.dataset.upgrade!==undefined){accrue();let s=state.skills[Number(b.dataset.upgrade)],cost=COSTS[s.tier+1];if(s.tier<5&&state.coins>=cost){state.coins-=cost;s.tier++;render();reward('Town Level '+townLevel()+'!');notify('Town Level increased! Passive bonuses are now +'+townXpBonus()+'% XP and +'+townGoldBonus()+'% gold.');}}
if(b.dataset.saveSkill!==undefined){
const i=Number(b.dataset.saveSkill);if(!Number.isInteger(i)||i<0||i>=SKILLS.length)return;
const existing=dailyEntry();if(existing&&Number.isInteger(existing.scores[i])){notify(SKILLS[i].name+' has already been checked in today. '+resetText());render();return;}
const score=draft[i];if(!Number.isInteger(score)||score<0||score>5)return;
const rate=RATES[state.skills[i].tier],before=level(state.skills[i].xp),baseXp=score*rate,townBonus=townXpBonus(),xpBonus=townBonus,earned=Math.ceil(baseXp*(1+xpBonus/100)),coins=score*2;
const entry=existing||{scores:[null,null,null,null,null],rates:[null,null,null,null,null]};
entry.scores[i]=score;entry.rates[i]=rate;state.days[day()]=entry;state.skills[i].xp+=earned;state.coins+=coins;draft[i]=null;render();
if(earned>0)reward('+'+earned+' XP · +'+coins+' <span class="gold-coin" aria-label="gold coin"></span>');notify(SKILLS[i].name+' check-in saved.'+(townBonus?' Town bonus: +'+townBonus+'% XP.':'')+' '+resetText());queueLevels(i,before,level(state.skills[i].xp));
}
if(b.id==='export'){accrue();save();const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fitville-save-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
document.addEventListener('change',async e=>{if(e.target.id!=='import'||!e.target.files[0])return;try{let s=JSON.parse(await e.target.files[0].text());if(!Number.isFinite(s.coins)||s.coins<0||!Array.isArray(s.skills)||s.skills.length!==5||!s.skills.every(x=>Number.isFinite(x.xp)&&x.xp>=0&&Number.isInteger(x.tier)&&x.tier>=0&&x.tier<6)||!s.days||typeof s.days!=='object'||!Number.isFinite(s.bank)||s.bank<0||!Number.isFinite(s.last))throw Error();
if(s.character&&(!s.character.name||typeof s.character.name!=='string'||s.character.name.length>24||!['hair','outfit','skin'].every(k=>Number.isInteger(s.character[k])&&s.character[k]>=0&&s.character[k]<3)))throw Error();
if(s.wardrobe&&(!Array.isArray(s.wardrobe.owned)||!s.wardrobe.owned.every(x=>ITEMS.some(i=>i.id===x))||!s.wardrobe.equipped||typeof s.wardrobe.equipped!=='object'||!Array.isArray(s.wardrobe.earned)||!s.wardrobe.earned.every(x=>ACHIEVEMENTS.some(a=>a.id===x))))throw Error();
for(const v of Object.values(s.days)){if(!Array.isArray(v.scores)||v.scores.length!==5||!v.scores.every(n=>n===null||(Number.isInteger(n)&&n>=0&&n<=5))||!Array.isArray(v.rates)||v.rates.length!==5||!v.rates.every((n,i)=>v.scores[i]===null?n===null:RATES.includes(n)))throw Error();}
if(!confirm('Replace progress on this device with this backup?'))return;state=s;draft=[];render();notify('Backup restored.');}catch(err){notify('This file is not a valid Fitville save.');}});
document.getElementById('level-dialog').addEventListener('cancel',e=>{e.preventDefault();nextCelebration();});

function openBuildingCheck(i){
 if(!Number.isInteger(i)||i<0||i>=SKILLS.length)return;
 selectedBuilding=i;
 const s=SKILLS[i],x=state.skills[i],entry=dailyEntry(),done=entry&&Number.isInteger(entry.scores[i]);
 document.getElementById('check-content').innerHTML='<div class="row"><h2 id="check-heading">'+s.icon+' '+s.name+'</h2><button id="check-close" class="popup-close" aria-label="Close check-in">×</button></div><div class="popup-house">'+house(i,x.tier)+'</div><p class="muted">'+s.building+' · Building level '+(x.tier+1)+' · Skill level '+level(x.xp)+'</p>'+(done?'<div class="saved-score">✓ Checked in today · '+entry.scores[i]+'/5</div><p class="muted">'+resetText()+'</p>':'<p>'+s.hint+'</p><p class="muted">Tap your score to save today’s check-in. Planned rest counts.</p><div class="scores" role="group" aria-label="'+s.name+' score">'+[0,1,2,3,4,5].map(v=>'<button data-quick-score="'+v+'" data-skill="'+i+'">'+v+'</button>').join('')+'</div><div class="score-labels"><span>None</span><span>Met goal</span></div>')+'<button id="check-upgrade" class="wide popup-upgrade">View building & upgrades</button>';
 document.getElementById('check-dialog').showModal();
}
const headerResize=new ResizeObserver(entries=>{document.documentElement.style.setProperty('--hud-height',entries[0].target.getBoundingClientRect().height+'px');});headerResize.observe(document.querySelector('header'));
const topNav=document.querySelector('nav');
document.querySelector('header>div').appendChild(topNav);
topNav.querySelectorAll('button').forEach(b=>{const label=b.textContent.trim();b.setAttribute('aria-label',label);b.title=label;});
document.getElementById('check-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();}});

setupDevUI();try{render();}catch(err){console.error('Fitville startup error',err);document.getElementById('view').innerHTML='<section class="card"><h2>Fitville needs a quick refresh</h2><p>The game hit a startup error, but your save is still stored on this device.</p><p class="muted">Error: '+safeText(err&&err.message?err.message:'Unknown startup error')+'</p><button id="recovery-reload" class="wide">Reload Fitville</button></section>';document.querySelector('nav').hidden=true;}setInterval(()=>{if((tab==='town'||tab==='check')&&document.visibilityState==='visible')render();},60000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){draft=[];render();}});window.addEventListener('pagehide',()=>{accrue();save();});
