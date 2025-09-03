// === Config ===
const K = 32, initial = 1000;
let currentSeason = "1";

// === Chart color palette (dark sports theme) ===
const chartColors = ["#2196f3","#ffd600","#00c853","#e53935","#ff9800","#9c27b0"];

// === Helper: render player name with emoji if injured ===
function renderName(name){
  const status = (window.playerProfiles?.[name]?.status) || "";
  const emoji = status === "injured" ? " 🩼" : "";
  return `${name}${emoji}`;
}

// === League Builder (Elo system) ===
function buildLeague(fixtures = []){
  const players = {};

  function ensurePlayer(n){
    if(!players[n]) {
      players[n] = {
        name:n, rating:initial, played:0, wins:0, losses:0,
        points:0, for:0, against:0, h2h:{}, eloHistory:[initial]
      };
    }
    return players[n];
  }

  fixtures.forEach((m) => {
    const A = ensurePlayer(m.A);
    const B = ensurePlayer(m.B);

    if(!A.h2h[B.name]) A.h2h[B.name] = { played:0, wins:0, losses:0, for:0, against:0, mmr:0 };
    if(!B.h2h[A.name]) B.h2h[A.name] = { played:0, wins:0, losses:0, for:0, against:0, mmr:0 };

    const Ea = 1 / (1 + 10 ** ((B.rating - A.rating) / 400));
    const Sa = (m.Winner === m.A) ? 1 : 0;
    const Sb = 1 - Sa;

    const changeA = K * (Sa - Ea);
    const changeB = -changeA;

    // Store the winner's gain as a positive number for UI
    m.mmrGain = (Sa ? changeA : changeB).toFixed(1);

    // W/L + points
    if (Sa) {
      A.wins++; B.losses++;
      A.h2h[B.name].wins++; B.h2h[A.name].losses++;
    } else {
      B.wins++; A.losses++;
      B.h2h[A.name].wins++; A.h2h[B.name].losses++;
    }
    A.played++; B.played++;
    A.points += Sa * 3; B.points += Sb * 3;

    // Scores
    A.for += m.Ascore; A.against += m.Bscore;
    B.for += m.Bscore; B.against += m.Ascore;

    // H2H stats
    A.h2h[B.name].played++; B.h2h[A.name].played++;
    A.h2h[B.name].for += m.Ascore; A.h2h[B.name].against += m.Bscore;
    B.h2h[A.name].for += m.Bscore; B.h2h[A.name].against += m.Ascore;

    // H2H MMR deltas (can go negative)
    A.h2h[B.name].mmr += changeA;
    B.h2h[A.name].mmr += changeB;

    // Apply Elo & track history
    A.rating += changeA; B.rating += changeB;
    A.eloHistory.push(A.rating); B.eloHistory.push(B.rating);
  });

  // Ensure all profiles appear even if they haven't played yet
  Object.keys(window.playerProfiles || {}).forEach(name => {
    if (!players[name]) {
      players[name] = {
        name, rating: initial, played: 0, wins: 0, losses: 0,
        points: 0, for: 0, against: 0, h2h: {}, eloHistory:[initial]
      };
    }
  });

  return players;
}

// === Build News Feed ===
function buildNews(fixtures = [], standings = []){
  const news = [];
  if(!fixtures.length) return ["No matches played yet."];

  // Sort weeks sensibly before picking the last one
  const weeks = [...new Set(fixtures.map(f => f.Week))].sort((a,b)=>{
    // natural sort: extract trailing numbers if present
    const na = parseInt(String(a).match(/\d+/)?.[0] ?? '0', 10);
    const nb = parseInt(String(b).match(/\d+/)?.[0] ?? '0', 10);
    return na - nb || String(a).localeCompare(String(b));
  });
  const lastWeek = weeks[weeks.length - 1];
  const matches = fixtures.filter(f => f.Week === lastWeek);

  if(matches.length){
    // Biggest MMR gain in the latest week
    const topMatch = matches.reduce((a,b) =>
      parseFloat(a.mmrGain||0) > parseFloat(b.mmrGain||0) ? a : b
    );
    const opp = (topMatch.Winner === topMatch.A) ? topMatch.B : topMatch.A;
    news.push(
      `<strong>${renderName(topMatch.Winner)}</strong> earned the biggest MMR gain in ${lastWeek} (+${topMatch.mmrGain}), beating ${renderName(opp)}.`
    );

    // Closest match by score differential
    const closeMatch = matches.reduce((a,b)=>{
      const diffA = Math.abs(a.Ascore - a.Bscore);
      const diffB = Math.abs(b.Ascore - b.Bscore);
      return diffA < diffB ? a : b;
    });
    news.push(
      `The closest battle in ${lastWeek} was <strong>${renderName(closeMatch.A)}</strong> vs <strong>${renderName(closeMatch.B)}</strong>, ending ${closeMatch.Ascore}–${closeMatch.Bscore}.`
    );
  }

  // Injury notes
  Object.entries(window.playerProfiles || {}).forEach(([name, prof])=>{
    if (prof.status === "injured") {
      news.push(`${renderName(name)} is currently sidelined with an injury 🩼.`);
    }
  });

  // New/idle players
  standings.forEach(p=>{
    if (p.played === 0) {
      news.push(`${renderName(p.name)} has joined the league and awaits their debut!`);
    }
  });

  return news;
}

// === Render All Pages ===
function renderAll(){
  if(!window.playerProfiles || !window.fixturesBySeason){
    console.warn("Data not loaded yet.");
    return;
  }

  const fixtures = window.fixturesBySeason[currentSeason] || [];
  const players = buildLeague(fixtures);
  window.leagueResults = players;

  const standings = Object.values(players).sort((a,b)=>{
    if (a.played===0 && b.played>0) return 1;
    if (b.played===0 && a.played>0) return -1;
    return (b.points - a.points) || (b.rating - a.rating);
  });

  // === Fixtures ===
  const fDiv = document.getElementById("fixturesContainer");
  if (fDiv){
    fDiv.innerHTML = "";
    const weeks = [...new Set(fixtures.map(f=>f.Week))].sort((a,b)=>{
      const na = parseInt(String(a).match(/\d+/)?.[0] ?? '0', 10);
      const nb = parseInt(String(b).match(/\d+/)?.[0] ?? '0', 10);
      return na - nb || String(a).localeCompare(String(b));
    });

    weeks.forEach((week)=>{
      const details = document.createElement("details");
      details.open = true;

      const summary = document.createElement("summary");
      summary.textContent = week;
      details.appendChild(summary);

      const tbl = document.createElement("table");
      tbl.classList.add("fixtures");
      tbl.innerHTML = `
        <thead>
          <tr><th>#</th><th>Player A</th><th>Score</th><th>Player B</th><th>Score</th><th>Winner</th><th>MMR +</th></tr>
        </thead>`;
      const tb = document.createElement("tbody");

      const weekMatches = fixtures.filter(f=>f.Week===week);
      const mmrByPlayer = {};
      let bestMatch = null;

      weekMatches.forEach((m,i)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${renderName(m.A)}</td><td>${m.Ascore}</td>
          <td>${renderName(m.B)}</td><td>${m.Bscore}</td>
          <td class="winner">${renderName(m.Winner)}</td>
          <td style="color:green;">+${m.mmrGain || "0.0"}</td>`;
        tb.appendChild(tr);

        if(!mmrByPlayer[m.A]) mmrByPlayer[m.A]=0;
        if(!mmrByPlayer[m.B]) mmrByPlayer[m.B]=0;

        const gain = parseFloat(m.mmrGain || "0");
        if(m.Winner === m.A){ mmrByPlayer[m.A]+=gain; mmrByPlayer[m.B]-=gain; }
        else { mmrByPlayer[m.B]+=gain; mmrByPlayer[m.A]-=gain; }

        if(!bestMatch || parseFloat(m.mmrGain||0) > parseFloat(bestMatch.mmrGain||0)) bestMatch = m;
      });

      tbl.appendChild(tb);
      details.appendChild(tbl);

      // Weekly totals
      const totals = document.createElement("table");
      totals.classList.add("fixtures");
      totals.innerHTML = `<thead><tr><th>Player</th><th>Net MMR ±</th></tr></thead>`;
      const tBody = document.createElement("tbody");
      Object.entries(mmrByPlayer)
        .sort((a,b)=>b[1]-a[1])
        .forEach(([name,val])=>{
          const tr = document.createElement("tr");
          const color = val >= 0 ? "#00c853" : "#e53935";
          tr.innerHTML = `<td>${renderName(name)}</td><td style="color:${color};">${val.toFixed(1)}</td>`;
          tBody.appendChild(tr);
        });
      totals.appendChild(tBody);

      const wrap = document.createElement("div");
      wrap.className = "weekly-summary";
      wrap.innerHTML = "<h5>Weekly MMR Totals</h5>";
      wrap.appendChild(totals);
      details.appendChild(wrap);

      if (bestMatch){
        const motw = document.createElement("div");
        motw.className = "motw-card";
        const loser = (bestMatch.Winner===bestMatch.A) ? bestMatch.B : bestMatch.A;
        motw.innerHTML = `
          <h4>🏆 Match of the Week</h4>
          <p><b>${renderName(bestMatch.Winner)}</b> def. ${renderName(loser)}
          (${bestMatch.Ascore}–${bestMatch.Bscore})
          <span style="color:#ffd600;">+${bestMatch.mmrGain} MMR</span></p>`;
        details.appendChild(motw);
      }

      fDiv.appendChild(details);
    });
  }

  // === Standings ===
  const sBody = document.querySelector("#standingsTable tbody");
  if (sBody){
    sBody.innerHTML = "";
    standings.forEach((p,i)=>{
      const prof = window.playerProfiles[p.name] || {};
      const badge = (prof.status === "injured") ? `<span class="status-badge status-injured">injured 🩼</span>` : "";
      const medal = i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><a href="player.html?name=${encodeURIComponent(p.name)}">${medal} ${renderName(p.name)}</a> ${badge}</td>
        <td>${p.played}</td><td>${p.wins}</td><td>${p.losses}</td>
        <td>${p.points}</td><td>${p.rating.toFixed(1)}</td>`;
      sBody.appendChild(tr);
    });
  }

  // === Player Stats ===
  const statsDiv = document.getElementById("playerStats");
  if (statsDiv){
    statsDiv.innerHTML = "";
    standings.forEach(p=>{
      const avgMargin = (p.played ? (p.for - p.against) / p.played : 0).toFixed(1);
      const card = document.createElement("div");
      card.className = "stats-card";

      let h2h = `<div class='table-wrapper'><table>
        <tr><th>Opponent</th><th>Played</th><th>W</th><th>L</th><th>For</th><th>Against</th><th>Margin</th><th>MMR ±</th></tr>`;
      if (Object.keys(p.h2h).length === 0){
        h2h += `<tr><td colspan="8">No matches yet</td></tr>`;
      } else {
        Object.entries(p.h2h).forEach(([o,h])=>{
          const margin = ((h.for - h.against) / (h.played || 1)).toFixed(1);
          const mmr = (h.mmr || 0).toFixed(1);
          h2h += `<tr>
            <td>${renderName(o)}</td><td>${h.played}</td><td>${h.wins}</td><td>${h.losses}</td>
            <td>${h.for}</td><td>${h.against}</td><td>${margin}</td><td>${mmr}</td>
          </tr>`;
        });
      }
      h2h += "</table></div>";

      card.innerHTML = `
        <h3>${renderName(p.name)}</h3>
        <div class="table-wrapper"><table>
          <tr><th>Played</th><td>${p.played}</td><th>Wins</th><td>${p.wins}</td><th>Losses</th><td>${p.losses}</td></tr>
          <tr><th>Points</th><td>${p.points}</td><th>For</th><td>${p.for}</td><th>Against</th><td>${p.against}</td></tr>
          <tr><th>Avg Margin</th><td>${avgMargin}</td><th>MMR</th><td colspan="3">${p.rating.toFixed(1)}</td></tr>
        </table></div>
        <h4>Head to Head</h4>${h2h}`;
      statsDiv.appendChild(card);
    });
  }

  // === Charts ===
  // Guard if Chart.js isn't loaded
  if (window.Chart){
    const pointsEl = document.getElementById("pointsChart");
    if(pointsEl){
      const ctx1 = pointsEl.getContext("2d");
      new Chart(ctx1, {
        type: 'bar',
        data:{
          labels: standings.map(p => renderName(p.name)),
          datasets:[{ label:'Points', data: standings.map(p => p.points), backgroundColor:'#2196f3' }]
        },
        options:{
          responsive:true,
          plugins:{ legend:{ display:false }},
          scales:{
            x:{ ticks:{ color:'#ccc' }, grid:{ color:'#333' }},
            y:{ ticks:{ color:'#ccc' }, grid:{ color:'#333' }}
          }
        }
      });
    }

    const eloEl = document.getElementById("eloChart");
    if(eloEl){
      const ctx2 = eloEl.getContext("2d");
      const matchIndexLabels = Array.from({length: Math.max(0, (window.fixturesBySeason?.[currentSeason]?.length || 0) + 1)}, (_,i)=>i); // 0..N
      new Chart(ctx2, {
        type:'line',
        data:{
          labels: matchIndexLabels,
          datasets: standings.map((p,i)=>({
            label: renderName(p.name),
            data: p.eloHistory, // length may be < labels; Chart.js handles it
            borderWidth: 2, fill: false,
            borderColor: chartColors[i % chartColors.length],
            backgroundColor: chartColors[i % chartColors.length],
            tension: 0.3
          }))
        },
        options:{
          responsive:true,
          interaction:{ mode:'index' },
          plugins:{ legend:{ labels:{ color:'#ccc' }}},
          scales:{
            x:{ ticks:{ color:'#ccc' }, grid:{ color:'#333' }},
            y:{ ticks:{ color:'#ccc' }, grid:{ color:'#333' }}
          }
        }
      });
    }
  }

  // === Schedule ===
  const schedBody = document.querySelector("#scheduleTable tbody");
  if (schedBody){
    schedBody.innerHTML = "";
    const names = Object.keys(window.playerProfiles || {}).filter(n => window.playerProfiles[n].status !== "injured");
    if (names.length % 2 === 1) names.push("BYE");
    const n = names.length;
    const arr = names.slice();
    const rounds = n - 1;

    for (let r = 0; r < rounds; r++){
      for (let i = 0; i < n/2; i++){
        const A = arr[i], B = arr[n-1-i];
        if (A !== "BYE" && B !== "BYE"){
          const court = (i < 2) ? `Court ${i+1}` : "Overflow";
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>Week ${r+1}</td><td>${renderName(A)}</td><td>${renderName(B)}</td><td>${court}</td>`;
          schedBody.appendChild(tr);
        }
      }
      // rotate
      arr.splice(1, 0, arr.pop());
    }
  }

  // === Profiles ===
  const pDiv = document.getElementById("profilesContainer");
  if (pDiv){
    pDiv.innerHTML = "";
    Object.entries(window.playerProfiles || {}).forEach(([name, prof])=>{
      const badge = (prof.status === "injured") ? `<span class="status-badge status-injured">injured 🩼</span>` : "";
      const card = document.createElement("div");
      card.className = "profile-card";
      card.innerHTML = `
        <img src="${prof.image}" alt="${name}">
        <h3 id="profile-${name}"><a href="player.html?name=${encodeURIComponent(name)}">${renderName(name)}</a></h3>${badge}
        <table>
          <tr><th>Hand</th><td>${prof.hand ?? "-"}</td></tr>
          <tr><th>Height</th><td>${prof.height ?? "-"}</td></tr>
          <tr><th>Age</th><td>${prof.age ?? "-"}</td></tr>
          <tr><th>Racket</th><td>${prof.racket ?? "-"}</td></tr>
        </table>`;
      pDiv.appendChild(card);
    });
  }

  // === News Feed ===
  const nc = document.getElementById("newsContainer");
  if (nc){
    const newsItems = buildNews(fixtures, standings);
    nc.innerHTML = "";
    newsItems.forEach(n=>{
      const card = document.createElement("div");
      card.className = "news-card";
      card.innerHTML = `<p>${n}</p>`;
      nc.appendChild(card);
    });
  }
}

// === Season change ===
function changeSeason(val){
  currentSeason = val;
  const label = document.getElementById("seasonLabel");
  if (label) label.textContent = val;
  renderAll();
}

// === Page nav ===
function showPage(id, link){
  document.querySelectorAll(".nav-page").forEach(sec => sec.style.display = "none");
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
  document.querySelectorAll("nav a").forEach(a => a.classList.remove("active"));
  if (link) link.classList.add("active");
}

// === Dark mode toggle ===
function toggleDark(){ document.body.classList.toggle("dark"); }

// === Init: default to News Feed (first page) ===
document.addEventListener("DOMContentLoaded", ()=>{
  renderAll();
  const newsLink = document.querySelector("nav a[href='#newsFeed']");
  showPage("newsFeed", newsLink);
});
