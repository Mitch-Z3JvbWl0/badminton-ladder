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
  const prof = playerProfiles[name];
  if(!prof){
    document.body.innerHTML="<p style='text-align:center;margin-top:3rem;'>Player not found.</p>";
    return;
  }

  // Grab computed results from league.js
  const player = window.leagueResults ? window.leagueResults[name] : null;
  if(!player){
    document.body.innerHTML="<p style='text-align:center;margin-top:3rem;'>No stats available. Visit main page first.</p>";
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
