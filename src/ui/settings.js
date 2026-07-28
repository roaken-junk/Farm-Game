// "More" screen: audio/haptics, profile name, share, install help, reset.

import { $, el, onEnter, toast, modal } from './ui.js';
import { load, save, resetSave } from '../core/storage.js';
import { setAudioPrefs, sfx } from '../core/audio.js';
import { HEROES } from '../data/heroes.js';
import { ARENAS } from '../data/arenas.js';

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function initSettings() {
  onEnter('settings', render);
}

function toggleRow(title, sub, key) {
  const p = load();
  const row = el('div', 'set-row');
  const lbl = el('div', 'lbl');
  lbl.appendChild(el('b', null, title));
  lbl.appendChild(el('small', null, sub));
  row.appendChild(lbl);
  const sw = el('div', `switch ${p.settings[key] ? 'on' : ''}`);
  sw.appendChild(el('i'));
  sw.onclick = () => {
    const pp = load();
    pp.settings[key] = !pp.settings[key];
    save(true);
    sw.classList.toggle('on', pp.settings[key]);
    setAudioPrefs({ music: pp.settings.music, sfx: pp.settings.sfx });
    sfx('click');
  };
  row.appendChild(sw);
  return row;
}

function actionRow(title, sub, label, cls, onClick) {
  const row = el('div', 'set-row');
  const lbl = el('div', 'lbl');
  lbl.appendChild(el('b', null, title));
  lbl.appendChild(el('small', null, sub));
  row.appendChild(lbl);
  const btn = el('button', `btn ${cls}`, label);
  btn.style.padding = '10px 16px';
  btn.onclick = onClick;
  row.appendChild(btn);
  return row;
}

function render() {
  const p = load();
  const body = $('#settings-body');
  body.innerHTML = '';

  body.appendChild(el('h3', 'section-title', '<span class="jp">記録</span>RECORD'));
  const stats = el('div', 'set-row');
  stats.innerHTML = `
    <div class="lbl">
      <b>${escapeHtml(p.name)}</b>
      <small>${p.wins}W / ${p.losses}L · best 🏆${p.bestTrophies} · ${Object.keys(p.owned).length}/${HEROES.length} heroes</small>
    </div>`;
  const rename = el('button', 'btn btn-ghost', 'RENAME');
  rename.style.padding = '10px 16px';
  // Not window.prompt: it is silently ignored inside sandboxed frames, which
  // is exactly where this game often ends up being embedded.
  rename.onclick = () => {
    const form = el('div');
    const input = el('input');
    input.type = 'text';
    input.value = p.name;
    input.maxLength = 14;
    input.setAttribute('aria-label', 'Your name');
    input.style.cssText = `width:100%;padding:12px 14px;border-radius:12px;font:800 16px inherit;
      background:rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.2);color:#fdf4e6;text-align:center`;
    form.appendChild(input);
    modal({
      title: 'YOUR NAME', jp: 'なまえ', body: form,
      actions: [
        { label: 'CANCEL' },
        {
          label: 'SAVE', cls: 'btn-gold', onClick: () => {
            const name = input.value.trim();
            if (!name) { toast('Pick a name with at least one character'); return; }
            const pp = load();
            pp.name = name.slice(0, 14);
            save(true);
            render();
            const h = $('#home-name'); if (h) h.textContent = pp.name;
          },
        },
      ],
    });
    setTimeout(() => { input.focus(); input.select(); }, 60);
  };
  stats.appendChild(rename);
  body.appendChild(stats);

  body.appendChild(el('h3', 'section-title', '<span class="jp">設定</span>OPTIONS'));
  body.appendChild(toggleRow('Music', 'Koto arrangement in the background', 'music'));
  body.appendChild(toggleRow('Sound effects', 'Impacts, specials, menus', 'sfx'));
  body.appendChild(toggleRow('Haptics', 'Vibration on hits (supported devices)', 'haptics'));
  body.appendChild(toggleRow('Left-handed aim', 'Move the power meter to the left', 'lefty'));

  body.appendChild(el('h3', 'section-title', '<span class="jp">共有</span>SHARE &amp; INSTALL'));
  body.appendChild(actionRow(
    'Share this game', 'Send the link to a friend', 'SHARE', 'btn-primary',
    async () => {
      const url = location.href.split('#')[0];
      const data = { title: 'Sakura Smash 桜スマッシュ', text: 'Come get smashed — anime physics brawler.', url };
      if (navigator.share) {
        try { await navigator.share(data); } catch { /* cancelled */ }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast('Link copied to clipboard');
      } else {
        modal({
          title: 'SHARE', jp: 'リンク',
          body: `<p style="word-break:break-all">${escapeHtml(url)}</p>`,
          actions: [{ label: 'CLOSE', cls: 'btn-gold' }],
        });
      }
    }));
  body.appendChild(actionRow(
    'Add to Home Screen', 'Play fullscreen, works offline', 'HOW', 'btn-ghost',
    () => modal({
      title: 'INSTALL', jp: 'インストール',
      body: `<p style="text-align:left">
        <b>iPhone / iPad</b><br>
        1. Open this page in Safari<br>
        2. Tap the <b>Share</b> button (□↑)<br>
        3. Choose <b>Add to Home Screen</b><br><br>
        <b>Android</b><br>
        1. Open in Chrome<br>
        2. Menu (⋮) → <b>Install app</b><br><br>
        It then runs fullscreen with no browser bars, and works with no signal.
      </p>`,
      actions: [{ label: 'GOT IT', cls: 'btn-gold' }],
    })));

  body.appendChild(el('h3', 'section-title', '<span class="jp">遊び方</span>HOW TO PLAY'));
  body.appendChild(actionRow('Rules', 'Turn order, damage, specials', 'READ', 'btn-ghost', showRules));
  body.appendChild(actionRow('Leagues', `${ARENAS.length} arenas to climb`, 'VIEW', 'btn-ghost', showLeagues));

  body.appendChild(el('h3', 'section-title', '<span class="jp">危険</span>DANGER ZONE'));
  body.appendChild(actionRow(
    'Reset progress', 'Wipes heroes, trophies and chests', 'RESET', 'btn-ghost',
    () => modal({
      title: 'RESET?', jp: 'ほんとうに',
      body: '<p>This erases your entire save on this device. There is no undo.</p>',
      actions: [
        { label: 'CANCEL' },
        {
          label: 'ERASE', cls: 'btn-primary', onClick: () => {
            resetSave();
            location.reload();
          },
        },
      ],
    })));

  body.appendChild(el('p', 'hint',
    'Sakura Smash — original characters, art and code. Built as a web app so it runs on any phone.'));
}

function showRules() {
  modal({
    title: 'HOW TO PLAY', jp: 'あそびかた', wide: true,
    body: `<p style="text-align:left">
      <b>Aim and fire.</b> Drag back from one of your heroes and release — like a slingshot.
      Pull further for more power. A dotted line previews the path, including wall bounces.<br><br>
      <b>Damage is force.</b> Whoever is moving faster into the collision deals the damage.
      Slam enemies into hazards, or knock them off the edge entirely.<br><br>
      <b>Rage builds specials.</b> The gold bar under each hero fills as they deal and take damage.
      When it is full the hero glows — their next shot triggers their special ability.<br><br>
      <b>Turns alternate.</b> You fire one hero, then your rival fires one. Frozen heroes lose a turn.<br><br>
      <b>Win</b> by knocking out all four enemy heroes. Drag out too long and the arena starts to collapse
      on everyone.
    </p>`,
    actions: [{ label: 'READY', cls: 'btn-gold' }],
  });
}

function showLeagues() {
  const p = load();
  const body = el('div');
  for (const a of ARENAS) {
    const unlocked = p.trophies >= a.minTrophies;
    const row = el('div', 'set-row');
    row.style.opacity = unlocked ? '1' : '.5';
    row.innerHTML = `
      <div class="lbl">
        <b>${a.jp} ${a.name}</b>
        <small>${a.minTrophies}🏆 · ${a.hazards.length ? `${a.hazards.length} hazards` : 'no hazards'} · +${a.reward.trophy}🏆 per win</small>
      </div>`;
    row.style.borderColor = unlocked ? a.theme.glow : 'rgba(255,255,255,.12)';
    body.appendChild(row);
  }
  modal({ title: 'LEAGUES', jp: 'りーぐ', body, wide: true, actions: [{ label: 'CLOSE', cls: 'btn-gold' }] });
}
