const K = 32, initial = 1000;
let currentSeason = "1";

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

    // Save MMR gain/loss into the match object
    if (Sa === 1) {
      m.mmrGain = changeA.toFixed(1);
      m.mmrLoss = changeB.toFixed(1);
    } else {
      m.mmrGain = changeB.toFixed(1);
      m.mmrLoss = changeA.toFixed(1);
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
  weeks.forEach(week=>{
    let details=document.createElement("details");
    details.open=true;
    let summary=document.createElement("summary");
    summary.textContent=week;
    details.appendChild(summary);

    let tbl=document.createElement("table");
    tbl.classList.add("fixtures");
    tbl.innerHTML="<thead><tr><th>ID</th><th>Player A</th><th>Score</th><th>Player B</th><th>Score</th><th>Winner</th><th>MMR +</th><th>MMR –</th></tr></thead>";
    let tb=document.createElement("tbody");
    fixtures.filter(f=>f.Week===week).forEach((m,i)=>{
      let tr=document.createElement("tr");
      tr.innerHTML=`<td>${i+1}</td><td>${m.A}</td><td>${m.Ascore}</td>
                    <td>${m.B}</td><td>${m.Bscore}</td><td class="winner">${m.Winner}</td>
                    <td style="color:green;">+${m.mmrGain || "0"}</td>
                    <td style="color:red;">${m.mmrLoss || "0"}</td>`;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); 
    details.appendChild(tbl); 
    fDiv.appendChild(details);
  });

  // === Standings Table ===
  let sBody=document.querySelector("#standingsTable tbody"); 
  sBody.innerHTML="";
  standings.forEach((p,i)=>{
    let tr=document.createElement("tr");
    let medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
    tr.innerHTML=`<td>${i+1}</td>
                  <td><a href="player.html?name=${p.name}">${medal} ${p.name}</a></td>
                  <td>${p.played}</td><td>${p.wins}</td><td>${p.losses}</td>
                  <td>${p.points}</td><td>${p.rating.toFixed(1)}</td>`;
    sBody.appendChild(tr);
  });

  // === Podium Highlight ===
  let podium=document.getElementById("podiumContainer"); 
  podium.innerHTML="";
  standings.slice(0,3).forEach((p)=>{
    let prof=playerProfiles[p.name];
    let card=document.createElement("div"); 
    card.className="podium-card";
    card.innerHTML=`<img src="${prof.image}" alt="${p.name}">
                    <h3>${p.name}</h3>
                    <p><b>${p.points}</b> pts • Elo ${p.rating.toFixed(0)}</p>`;
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
        h2h+=`<tr><td>${o}</td><td>${h.played}</td><td>${h.wins}</td><td>${h.losses}</td>
               <td>${h.for}</td><td>${h.against}</td><td>${margin}</td><td>${mmr}</td></tr>`;
      });
    }
    h2h+="</table></div>";
    card.innerHTML=`<h3>${p.name}</h3>
      <div class="table-wrapper"><table>
        <tr><th>Played</th><td>${p.played}</td><th>Wins</th><td>${p.wins}</td><th>Losses</th><td>${p.losses}</td></tr>
        <tr><th>Points</th><td>${p.points}</td><th>For</th><td>${p.for}</td><th>Against</th><td>${p.against}</td></tr>
        <tr><th>Avg Margin</th><td>${avgMargin}</td><th>MMR</th><td colspan="3">${p.rating.toFixed(1)}</td></tr>
      </table></div>
      <h4>Head to Head</h4>${h2h}`;
    statsDiv.appendChild(card);
  });

  // === Charts ===
  let ctx1=document.getElementById("pointsChart").getContext("2d");
  new Chart(ctx1,{
    type:'bar',
    data:{
      labels:standings.map(p=>p.name),
      datasets:[{label:'Points',data:standings.map(p=>p.points),backgroundColor:'#004080'}]
    }
  });

  let ctx2=document.getElementById("eloChart").getContext("2d");
  new Chart(ctx2,{
    type:'line',
    data:{
      labels:fixtures.map((_,i)=>i+1),
      datasets:standings.map(p=>({
        label:p.name,
        data:p.eloHistory,
        borderWidth:2,
        fill:false
      }))
    },
    options:{responsive:true,interaction:{mode:'index'}}
  });

  // === Schedule (auto round robin) ===
  let schedBody=document.querySelector("#scheduleTable tbody"); 
  schedBody.innerHTML="";
  const names=Object.keys(playerProfiles); 
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
        tr.innerHTML=`<td>Week ${r+1}</td><td>${A}</td><td>${B}</td><td>${court}</td>`;
        schedBody.appendChild(tr);
      }
    }
    arr.splice(1,0,arr.pop());
  }

  // === Profiles ===
  let pDiv=document.getElementById("profilesContainer"); 
  pDiv.innerHTML="";
  Object.entries(playerProfiles).forEach(([name,prof])=>{
    let card=document.createElement("div"); 
    card.className="profile-card";
    card.innerHTML=`
      <img src="${prof.image}" alt="${name}">
      <h3 id="profile-${name}"><a href="player.html?name=${name}">${name}</a></h3>
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
