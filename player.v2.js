const K = 32;      // Elo constant
const initial = 1000; // Starting rating

function getParam(name){
  let params=new URLSearchParams(window.location.search);
  return params.get(name);
}

const playerName=getParam("name");
if(!playerName){
  document.body.innerHTML="<p style='text-align:center;margin-top:3rem;'>No player selected.</p>";
} else {
  renderPlayer(playerName);
}

function renderPlayer(name){
  const prof=playerProfiles[name];
  const fixtures=fixturesBySeason["1"]; // can extend later for multi-season
  if(!prof){
    document.body.innerHTML="<p style='text-align:center;margin-top:3rem;'>Player not found.</p>";
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

  // === Elo + Stats ===
  let wins=0, losses=0, elo=[initial], eloNow=initial;
  let h2h={}; // opponent-specific record & mmr changes

  fixtures.forEach(m=>{
    if(m.A===name || m.B===name){
      let isA=(m.A===name);
      let opp=isA ? m.B : m.A;
      let scoreFor=isA ? m.Ascore : m.Bscore;
      let scoreAgainst=isA ? m.Bscore : m.Ascore;
      let won=(m.Winner===name);

      // init H2H entry
      if(!h2h[opp]) h2h[opp]={played:0,wins:0,losses:0,for:0,against:0,mmr:0,rating:initial};

      // update record
      if(won){wins++; h2h[opp].wins++;} else {losses++; h2h[opp].losses++;}
      h2h[opp].played++; h2h[opp].for+=scoreFor; h2h[opp].against+=scoreAgainst;

      // === Elo calculation vs this opponent ===
      let Ra = eloNow;
      let Rb = h2h[opp].rating; // opponent shadow rating
      let Ea = 1/(1+10**((Rb-Ra)/400));
      let Eb = 1 - Ea;
      let Sa = won ? 1 : 0;
      let Sb = 1 - Sa;

      let changeA = K*(Sa-Ea);
      let changeB = K*(Sb-Eb);

      eloNow += changeA;
      h2h[opp].rating += changeB;

      elo.push(eloNow);

      // track mmr gain/loss vs this opponent
      h2h[opp].mmr += changeA;
    }
  });

  // Summary
  document.getElementById("playerSummary").textContent=
    `${name} has played ${wins+losses} matches, with ${wins} wins and ${losses} losses. Current Elo: ${eloNow.toFixed(0)}.`;

  // Elo chart
  let ctx=document.getElementById("eloChart").getContext("2d");
  new Chart(ctx,{
    type:'line',
    data:{labels:elo.map((_,i)=>i),datasets:[{label:`${name} Elo`,data:elo,borderColor:'#004080',fill:false}]},
    options:{responsive:true,interaction:{mode:'index'}}
  });

  // Head-to-Head Table
  let div=document.getElementById("headToHead");
  let h2hHtml="<table><tr><th>Opponent</th><th>Played</th><th>W</th><th>L</th><th>For</th><th>Against</th><th>MMR ±</th></tr>";
  if(Object.keys(h2h).length===0){
    h2hHtml+=`<tr><td colspan="7">No matches yet</td></tr>`;
  } else {
    Object.entries(h2h).forEach(([opp,stats])=>{
      let mmr=(stats.mmr||0).toFixed(1);
      h2hHtml+=`<tr>
        <td>${opp}</td>
        <td>${stats.played}</td>
        <td>${stats.wins}</td>
        <td>${stats.losses}</td>
        <td>${stats.for}</td>
        <td>${stats.against}</td>
        <td>${mmr}</td>
      </tr>`;
    });
  }
  h2hHtml+="</table>";
  div.innerHTML=h2hHtml;
}
