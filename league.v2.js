const K = 32, initial = 1000;
let currentSeason = "1";

// === Chart color palette (dark sports theme) ===
const chartColors = [
  "#2196f3", // blue
  "#ffd600", // gold
  "#00c853", // green
  "#e53935", // red
  "#ff9800", // orange
  "#9c27b0"  // purple
];

// === Helper: render player name with emoji if injured ===
function renderName(name){
  let status = (playerProfiles[name] && playerProfiles[name].status) || "";
  let emoji = status === "injured" ? " 🩼" : "";
  return `${name}${emoji}`;
}

// === League Builder (Elo system) ===
function buildLeague(fixtures){
  const players = {};
  function ensurePlayer(n){
    if(!players[n]) players[n] = {
      name:n,rating:initial,played:0,wins:0,losses:0,
      points:0,for:0,against:0,h2h:{},eloHistory:[initial]
    };
    return players[n];
  }

  fixtures.forEach((m)=>{
    let A=ensurePlayer(m.A), B=ensurePlayer(m.B);
    if(!A.h2h[B.name]) A.h2h[B.name]={played:0,wins:0,losses:0,for:0,against:0,mmr:0};
    if(!B.h2h[A.name]) B.h2h[A.name]={played:0,wins:0,losses:0,for:0,against:0,mmr:0};
    
    let Ea=1/(1+10**((B.rating-A.rating)/400));
    let Sa=(m.Winner===m.A)?1:0; 
    let Sb=1-Sa;

    let changeA = K*(Sa-Ea);
    let changeB = -changeA;

    // Save only winner's MMR gain
    if (Sa === 1) {
      m.mmrGain = changeA.toFixed(1);
    } else {
      m.mmrGain = changeB.toFixed(1);
    }

    if(Sa){
      A.wins++;B.losses++;
      A.h2h[B.name].wins++;B.h2h[A.name].losses++;
    } else {
      B.wins++;A.losses++;
      B.h2h[A.name].wins++;A.h2h[B.name].losses++;
    }
    A.played++;B.played++;
    A.points+=Sa*3;B.points+=Sb*3;
    A.for+=m.Ascore;A.against+=m.Bscore;
    B.for+=m.Bscore;B.against+=m.Ascore;

    A.h2h[B.name].played++;B.h2h[A.name].played++;
    A.h2h[B.name].for+=m.Ascore;A.h2h[B.name].against+=m.Bscore;
    B.h2h[A.name].for+=m.Bscore;B.h2h[A.name].against+=m.Ascore;

    A.h2h[B.name].mmr += changeA;
    B.h2h[A.name].mmr += changeB;

    A.rating+=changeA;
    B.rating+=changeB;

    A.eloHistory.push(A.rating);
    B.eloHistory.push(B.rating);
  });

  // Ensure every player in profiles exists
  Object.keys(playerProfiles).forEach(name=>{
    if(!players[name]){
      players[name] = {
        name, rating: initial, played: 0, wins: 0, losses: 0,
        points: 0, for: 0, against: 0, h2h: {}, eloHistory:[initial]
      };
    }
  });

  return players;
}

// === Render All Pages ===
function renderAll(){
  if(!window.playerProfiles || !window.fixturesBySeason){
    console.warn("Data not loaded yet.");
    return;
  }

  const fixtures = fixturesBySeason[currentSeason];
  const players = buildLeague(fixtures);

  // expose results globally for player.js
  window.leagueResults = players;

  const standings = Object.values(players).sort((a,b)=>{
    if(a.played===0 && b.played>0) return 1;
    if(b.played===0 && a.played>0) return -1;
    return b.points-a.points||b.rating-a.rating;
  });

  // === Fixtures grouped by Week ===
  const fDiv=document.getElementById("fixturesContainer"); 
  fDiv.innerHTML="";
  const weeks=[...new Set(fixtures.map(f=>f.Week))];
  weeks.forEach((week)=>{
    let details=document.createElement("details");
    details.open=true;
    let summary=document.createElement("summary");
    summary.textContent=week;
    details.appendChild(summary);

    let tbl=document.createElement("table");
    tbl.classList.add("fixtures");
    tbl.innerHTML="<thead><tr><th>ID</th><th>Player A</th><th>Score</th><th>Player B</th><th>Score</th><th>Winner</th><th>MMR +</th></tr></thead>";
    let tb=document.createElement("tbody");

    let weekMatches = fixtures.filter(f=>f.Week===week);
    let mmrByPlayer = {};
    let bestMatch = null;

    weekMatches.forEach((m,i)=>{
      let tr=document.createElement("tr");
      tr.innerHTML=`<td>${i+1}</td>
                    <td>${renderName(m.A)}</td><td>${m.Ascore}</td>
                    <td>${renderName(m.B)}</td><td>${m.Bscore}</td>
                    <td class="winner">${renderName(m.Winner)}</td>
                    <td style="color:green;">+${m.mmrGain || "0"}</td>`;
      tb.appendChild(tr);

      // Track MMR per player (zero-sum: winner +gain, loser -gain)
      if(!mmrByPlayer[m.A]) mmrByPlayer[m.A]=0;
      if(!mmrByPlayer[m.B]) mmrByPlayer[m.B]=0;

      let gain = parseFloat(m.mmrGain||0);
      if(m.Winner===m.A){
        mmrByPlayer[m.A]+=gain;
        mmrByPlayer[m.B]-=gain;
      } else {
        mmrByPlayer[m.B]+=gain;
        mmrByPlayer[m.A]-=gain;
      }

      // Track biggest MMR gain match of this week
      if(!bestMatch || parseFloat(m.mmrGain)>parseFloat(bestMatch.mmrGain)){
        bestMatch=m;
      }
    });

    tbl.appendChild(tb); 
    details.appendChild(tbl); 

    // === Weekly MMR Totals Table (sorted) ===
    let totals=document.createElement("table");
    totals.classList.add("fixtures");
    totals.innerHTML="<thead><tr><th>Player</th><th>Net MMR ±</th></tr></thead>";
    let tBody=document.createElement("tbody");
    Object.entries(mmrByPlayer)
      .sort((a,b)=>b[1]-a[1])
      .forEach(([name,val])=>{
        let tr=document.createElement("tr");
        let color=val>=0?"#00c853":"#e53935";
        tr.innerHTML=`<td>${renderName(name)}</td><td style="color:${color};">${val.toFixed(1)}</td>`;
        tBody.appendChild(tr);
      });
    totals.appendChild(tBody);

    let wrap=document.createElement("div");
    wrap.className="weekly-summary";
    wrap.innerHTML="<h5>Weekly MMR Totals</h5>";
    wrap.appendChild(totals);
    details.appendChild(wrap);

    // === Match of the Week ===
    if(bestMatch){
      let motw=document.createElement("div");
      motw.className="motw-card";
      motw.innerHTML=`<h4>🏆 Match of the Week</h4>
        <p><b>${renderName(bestMatch.Winner)}</b> def. ${bestMatch.Winner===bestMatch.A?renderName(bestMatch.B):renderName(bestMatch.A)} 
        (${bestMatch.Ascore}–${bestMatch.Bscore}) 
        <span style="color:#ffd600;">+${bestMatch.mmrGain} MMR</span></p>`;
      details.appendChild(motw);
    }

    fDiv.appendChild(details);
  });

  // === Standings Table ===
  let sBody=document.querySelector("#standingsTable tbody"); 
  sBody.innerHTML="";
  standings.forEach((p,i)=>{
    let prof = playerProfiles[p.name] || {};
    let status = prof.status || "";
    let badge = "";

    if (status === "injured") {
      badge = `<span class="status-badge status-injured">injured 🩼</span>`;
    }

    let tr=document.createElement("tr");
    let medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
    tr.innerHTML=`<td>${i+1}</td>
                  <td><a href="player.html?name=${p.name}">${medal} ${renderName(p.name)}</a> ${badge}</td>
                  <td>${p.played}</td><td>${p.wins}</td><td>${p.losses}</td>
                  <td>${p.points}</td><td>${p.rating.toFixed(1)}</td>`;
    sBody.appendChild(tr);
  });

  // === Podium Highlight ===
  let podium=document.getElementById("podiumContainer"); 
  podium.innerHTML="";
  standings.slice(0,3).forEach((p)=>{
    let prof=playerProfiles[p.name] || {};
    let status = prof.status || "";
    let badge = "";

    if (status === "injured") {
      badge = `<span class="status-badge status-injured">injured 🩼</span>`;
    }

    let card=document.createElement("div"); 
    card.className="podium-card";
    card.innerHTML=`<img src="${prof.image || "images/default.png"}" alt="${p.name}">
                    <h3>${renderName(p.name)}</h3>
                    <p><b>${p.points}</b> pts • Elo ${p.rating.toFixed(0)}</p>
                    ${badge}`;
    podium.appendChild(card);
  });

  // === Player Stats ===
  let statsDiv=document.getElementById("playerStats"); 
  statsDiv.innerHTML="";
  standings.forEach(p=>{
    let avgMargin=(p.played?(p.for-p.against)/p.played:0).toFixed(1);
    let card=document.createElement("div"); 
    card.className="stats-card";
    let h2h="<div class='table-wrapper'><table><tr><th>Opponent</th><th>Played</th><th>W</th><th>L</th><th>For</th><th>Against</th><th>Margin</th><th>MMR ±</th></tr>";
    if(Object.keys(p.h2h).length===0){
      h2h+=`<tr><td colspan="8">No matches yet</td></tr>`;
    } else {
      Object.entries(p.h2h).forEach(([o,h])=>{
        let margin=((h.for-h.against)/(h.played||1)).toFixed(1);
        let mmr = (h.mmr||0).toFixed(1);
        h2h+=`<tr><td>${renderName(o)}</td><td>${h.played}</td><td>${h.wins}</td><td>${h.losses}</td>
               <td>${h.for}</td><td>${h.against}</td><td>${margin}</td><td>${mmr}</td></tr>`;
      });
    }
    h2h+="</table></div>";
    card.innerHTML=`<h3>${renderName(p.name)}</h3>
      <div class="table-wrapper"><table>
        <tr><th>Played</th><td>${p.played}</td><th>Wins</th><td>${p.wins}</td><th>Losses</th><td>${p.losses}</td></tr>
        <tr><th>Points</th><td>${p.points}</td><th>For</th><td>${p.for}</td><th>Against</th><td>${p.against}</td></tr>
        <tr><th>Avg Margin</th><td>${avgMargin}</td><th>MMR</th><td colspan="3">${p.rating.toFixed(1)}</td></tr>
      </table></div>
      <h4>Head to Head</h4>${h2h}`;
    statsDiv.appendChild(card);
  });

  // === Charts (Points + Elo over season) ===
  let ctx1=document.getElementById("pointsChart").getContext("2d");
  new Chart(ctx1,{
    type:'bar',
    data:{
      labels:standings.map(p=>renderName(p.name)),
      datasets:[{
        label:'Points',
        data:standings.map(p=>p.points),
        backgroundColor:'#2196f3'
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:'#ccc'},grid:{color:'#333'}},
        y:{ticks:{color:'#ccc'},grid:{color:'#333'}}
      }
    }
  });

  let ctx2=document.getElementById("eloChart").getContext("2d");
  new Chart(ctx2,{
    type:'line',
    data:{
      labels:fixtures.map((_,i)=>i+1),
      datasets:standings.map((p,i)=>({
        label:renderName(p.name),
        data:p.eloHistory,
        borderWidth:2,
        fill:false,
        borderColor: chartColors[i % chartColors.length],
        backgroundColor: chartColors[i % chartColors.length],
        tension:0.3
      }))
    },
    options:{
      responsive:true,
      interaction:{mode:'index'},
      plugins:{legend:{labels:{color:'#ccc'}}},
      scales:{
        x:{ticks:{color:'#ccc'},grid:{color:'#333'}},
        y:{ticks:{color:'#ccc'},grid:{color:'#333'}}
      }
    }
  });

  // === Schedule (auto round robin) ===
  let schedBody=document.querySelector("#scheduleTable tbody"); 
  schedBody.innerHTML="";
  const names=Object.keys(playerProfiles).filter(n => playerProfiles[n].status!=="injured");
  if(names.length%2===1) names.push("BYE");
  const n=names.length; 
  let arr=names.slice();
  const rounds=n-1;
  for(let r=0;r<rounds;r++){
    for(let i=0;i<n/2;i++){
      let A=arr[i], B=arr[n-1-i];
      if(A!=="BYE" && B!=="BYE"){
        let court=(i<2)?`Court ${i+1}`:"Overflow";
        let tr=document.createElement("tr");
        tr.innerHTML=`<td>Week ${r+1}</td><td>${renderName(A)}</td><td>${renderName(B)}</td><td>${court}</td>`;
        schedBody.appendChild(tr);
      }
    }
    arr.splice(1,0,arr.pop());
  }

  // === Profiles ===
  let pDiv=document.getElementById("profilesContainer"); 
  pDiv.innerHTML="";
  Object.entries(playerProfiles).forEach(([name,prof])=>{
    let status = prof.status || "";
    let badge = "";
    if (status === "injured") {
      badge = `<span class="status-badge status-injured">injured 🩼</span>`;
    }

    let card=document.createElement("div"); 
    card.className="profile-card";
    card.innerHTML=`
      <img src="${prof.image}" alt="${name}">
      <h3 id="profile-${name}"><a href="player.html?name=${name}">${renderName(name)}</a></h3>
      ${badge}
      <table>
        <tr><th>Hand</th><td>${prof.hand}</td></tr>
        <tr><th>Height</th><td>${prof.height}</td></tr>
        <tr><th>Age</th><td>${prof.age}</td></tr>
        <tr><th>Racket</th><td>${prof.racket}</td></tr>
      </table>`;
    pDiv.appendChild(card);
  });
}

// === Season change ===
function changeSeason(val){
  currentSeason=val;
  document.getElementById("seasonLabel").textContent=val;
  renderAll();
}
// === News Feed ===
function buildNews(fixtures, standings) {
  let news = [];

  // Latest week
  const lastWeek = [...new Set(fixtures.map(f=>f.Week))].pop();
  const matches = fixtures.filter(f=>f.Week === lastWeek);

  if(matches.length){
    // Biggest MMR gain
    let topMatch = matches.reduce((a,b)=> parseFloat(a.mmrGain) > parseFloat(b.mmrGain) ? a : b);
    news.push(`<strong>${renderName(topMatch.Winner)}</strong> earned the biggest MMR gain (+${topMatch.mmrGain}) beating ${renderName(topMatch.Winner === topMatch.A ? topMatch.B : topMatch.A)} in ${lastWeek}.`);

    // Closest match
    let closeMatch = matches.reduce((a,b)=>{
      let diffA=Math.abs(a.Ascore-a.Bscore), diffB=Math.abs(b.Ascore-b.Bscore);
      return diffA < diffB ? a : b;
    });
    news.push(`The closest battle was <strong>${renderName(closeMatch.A)}</strong> vs <strong>${renderName(closeMatch.B)}</strong>, ending ${closeMatch.Ascore}–${closeMatch.Bscore}.`);
  }

  // Injury updates
  Object.entries(playerProfiles).forEach(([name,prof])=>{
    if(prof.status === "injured"){
      news.push(`${renderName(name)} is currently sidelined with an injury 🩼.`);
    }
  });

  // New players
  standings.forEach(p=>{
    if(p.played === 0){
      news.push(`${renderName(p.name)} has joined the league and awaits their debut!`);
    }
  });

  return news;
}

const newsItems = buildNews(fixtures, standings);
let nc = document.getElementById("newsContainer");
if(nc){
  nc.innerHTML = "";
  newsItems.forEach(n=>{
    let card=document.createElement("div");
    card.className="news-card";
    card.innerHTML=`<p>${n}</p>`;
    nc.appendChild(card);
  });
}

// === Page nav ===
function showPage(id,link){
  document.querySelectorAll(".nav-page").forEach(sec=>sec.style.display="none");
  document.getElementById(id).style.display="block";
  document.querySelectorAll("nav a").forEach(a=>a.classList.remove("active"));
  if(link) link.classList.add("active");
}

// === Dark mode toggle ===
function toggleDark(){
  document.body.classList.toggle("dark");
}

document.addEventListener("DOMContentLoaded", renderAll);
