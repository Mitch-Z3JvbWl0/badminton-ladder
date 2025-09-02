const K = 32, initial = 1000;

function getParam(name){
  let params=new URLSearchParams(window.location.search);
  return params.get(name);
}

const playerName=getParam("name");
if(!playerName){
  document.body.innerHTML="<p style='text-align:center;margin-top:3rem;'>No player selected.</p>";
} else {
  // ensure league results exist
  if(!window.leagueResults){
    window.leagueResults = buildLeagueSelfContained(fixturesBySeason["1"]);
  }
  renderPlayer(playerName);
}

// === Local Elo engine (same as league.js) ===
function buildLeagueSelfContained(fixtures){
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

// === Render player profile ===
function renderPlayer(name){
  const prof = playerProfiles[name];
  if(!prof){
    document.body.innerHTML="<p style='text-align:center;margin-top:3rem;'>Player not found.</p>";
    return;
  }

  const player = window.leagueResults[name];
  if(!player){
    document.body.innerHTML="<p style='text-align:center;margin-top:3rem;'>No stats available.</p>";
    return;
  }

  // Header
  document.getElementById("playerName").textContent=name;
  document.getElementById("playerImage").src=prof.image;
  document.getElementById("playerTag").textContent=prof.racket;

  // Info table
  let tbl=document.getElementById("playerInfoTable");
  tbl.innerHTML=`<tr><th>Hand</th><td>${prof.hand}</td></tr>
                 <tr><th>Height</th><td>${prof.height}</td></tr>
                 <tr><th>Age</th><td>${prof.age}</td></tr>
                 <tr><th>Racket</th><td>${prof.racket}</td></tr>`;

  // Summary
  document.getElementById("playerSummary").textContent=
    `${name} has played ${player.played} matches, with ${player.wins} wins and ${player.losses} losses. Current Elo: ${player.rating.toFixed(1)}.`;

  // Elo Chart
  let ctx=document.getElementById("eloChart").getContext("2d");
  new Chart(ctx,{
    type:'line',
    data:{labels:player.eloHistory.map((_,i)=>i),datasets:[{label:`${name} Elo`,data:player.eloHistory,borderColor:'#004080',fill:false}]},
    options:{responsive:true,interaction:{mode:'index'}}
  });

  // H2H
  let div=document.getElementById("headToHead");
  let h2hHtml="<table><tr><th>Opponent</th><th>Played</th><th>W</th><th>L</th><th>For</th><th>Against</th><th>MMR ±</th></tr>";
  if(Object.keys(player.h2h).length===0){
    h2hHtml+=`<tr><td colspan="7">No matches yet</td></tr>`;
  } else {
    Object.entries(player.h2h).forEach(([opp,stats])=>{
      let mmr=(stats.mmr||0).toFixed(1);
      h2hHtml+=`<tr>
        <td>${opp}</td><td>${stats.played}</td><td>${stats.wins}</td><td>${stats.losses}</td>
        <td>${stats.for}</td><td>${stats.against}</td><td>${mmr}</td>
      </tr>`;
    });
  }
  h2hHtml+="</table>";
  div.innerHTML=h2hHtml;
}
