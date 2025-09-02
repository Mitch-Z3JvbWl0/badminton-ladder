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

  const standings = Object.values(players).sort((a,b)=>b.points-a.points||b.rating-a.rating);

  // ... [everything else stays the same: fixtures, standings, podium, charts, profiles]
}

function changeSeason(val){
  currentSeason=val;
  document.getElementById("seasonLabel").textContent=val;
  renderAll();
}

function showPage(id,link){
  document.querySelectorAll(".nav-page").forEach(sec=>sec.style.display="none");
  document.getElementById(id).style.display="block";
  document.querySelectorAll("nav a").forEach(a=>a.classList.remove("active"));
  if(link) link.classList.add("active");
}

function toggleDark(){
  document.body.classList.toggle("dark");
}

document.addEventListener("DOMContentLoaded", renderAll);
