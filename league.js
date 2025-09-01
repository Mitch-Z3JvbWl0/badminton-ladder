const K = 32, initial = 1000;
let currentSeason = "1";

// === League Builder ===
function buildLeague(fixtures){
  const players = {};
  function ensurePlayer(n){
    if(!players[n]) players[n] = {
      name:n, rating:initial, played:0,wins:0,losses:0,
      points:0, for:0, against:0, h2h:{}, eloHistory:[initial]
    };
    return players[n];
  }

  fixtures.forEach((m,i)=>{
    let A=ensurePlayer(m.A), B=ensurePlayer(m.B);
    if(!A.h2h[B.name]) A.h2h[B.name]={played:0,wins:0,losses:0,for:0,against:0};
    if(!B.h2h[A.name]) B.h2h[A.name]={played:0,wins:0,losses:0,for:0,against:0};

    let Ea=1/(1+10**((B.rating-A.rating)/400));
    let Sa=(m.Winner===m.A)?1:0; let Sb=1-Sa;

    if(Sa){A.wins++;B.losses++; A.h2h[B.name].wins++; B.h2h[A.name].losses++;}
    else {B.wins++;A.losses++; B.h2h[A.name].wins++; A.h2h[B.name].losses++;}

    A.played++; B.played++;
    A.points+=Sa*3; B.points+=Sb*3;
    A.for+=m.Ascore; A.against+=m.Bscore;
    B.for+=m.Bscore; B.against+=m.Ascore;

    A.h2h[B.name].played++; B.h2h[A.name].played++;
    A.h2h[B.name].for+=m.Ascore; A.h2h[B.name].against+=m.Bscore;
    B.h2h[A.name].for+=m.Bscore; B.h2h[A.name].against+=m.Ascore;

    A.rating=A.rating+K*(Sa-Ea);
    B.rating=B.rating+K*(Sb-(1-Ea));

    A.eloHistory.push(A.rating);
    B.eloHistory.push(B.rating);
  });

  return players;
}

// === Render All Pages ===
function renderAll(){
  const fixtures = fixturesBySeason[currentSeason];
  const players = buildLeague(fixtures);
  const standings = Object.values(players).sort((a,b)=>b.points-a.points||b.rating-a.rating);

  // Fixtures grouped by week
  const fDiv=document.getElementById("fixturesContainer"); fDiv.innerHTML="";
  const weeks=[...new Set(fixtures.map(f=>f.Week))];
  weeks.forEach(week=>{
    const details=document.createElement("details");
    details.open=true;
    const summary=document.createElement("summary");
    summary.textContent=week;
    details.appendChild(summary);

    const tbl=document.createElement("table");
    tbl.classList.add("fixtures");
    tbl.innerHTML="<thead><tr><th>ID</th><th>Player A</th><th>Score</th><th>Player B</th><th>Score</th><th>Winner</th></tr></thead>";
    const tb=document.createElement("tbody");
    fixtures.filter(f=>f.Week===week).forEach((m,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${i+1}</td><td>${m.A}</td><td>${m.Ascore}</td>
                    <td>${m.B}</td><td>${m.Bscore}</td><td class="winner">${m.Winner}</td>`;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); details.appendChild(tbl); fDiv.appendChild(details);
  });

  // Standings
  const sBody=document.querySelector("#standingsTable tbody"); sBody.innerHTML="";
  standings.forEach((p,i)=>{
    const tr=document.createElement("tr");
    if(i===0) tr.classList.add("gold");
    if(i===1) tr.classList.add("silver");
    if(i===2) tr.classList.add("bronze");
    let medal = (i===0?"🥇":i===1?"🥈":i===2?"🥉":"");
    tr.innerHTML=`<td>${i+1}</td><td><a href="#profiles" onclick="showProfile('${p.name}')">${medal} ${p.name}</a></td>
                  <td>${p.played}</td><td>${p.wins}</td><td>${p.losses}</td>
                  <td>${p.points}</td><td>${p.rating.toFixed(1)}</td>`;
    sBody.appendChild(tr);
  });

  // Player Stats
  const statsDiv=document.getElementById("playerStats"); statsDiv.innerHTML="";
  standings.forEach(p=>{
    let avgMargin=(p.played?(p.for-p.against)/p.played:0).toFixed(1);
    let card=document.createElement("div");
    let h2hTable="<div class='table-wrapper'><table><tr><th>Opponent</th><th>Played</th><th>W</th><th>L</th><th>For</th><th>Against</th><th>Margin</th></tr>";
    Object.keys(p.h2h).forEach(o=>{
      let h=p.h2h[o];
      let margin=((h.for-h.against)/(h.played||1)).toFixed(1);
      h2hTable+=`<tr><td>${o}</td><td>${h.played}</td><td>${h.wins}</td><td>${h.losses}</td>
                 <td>${h.for}</td><td>${h.against}</td><td>${margin}</td></tr>`;
    });
    h2hTable+="</table></div>";
    card.innerHTML=`<h3>${p.name}</h3>
      <div class="table-wrapper"><table>
        <tr><th>Played</th><td>${p.played}</td><th>Wins</th><td>${p.wins}</td><th>Losses</th><td>${p.losses}</td></tr>
        <tr><th>Points</th><td>${p.points}</td><th>For</th><td>${p.for}</td><th>Against</th><td>${p.against}</td></tr>
        <tr><th>Avg Margin</th><td>${avgMargin}</td><th>MMR</th><td colspan="3">${p.rating.toFixed(1)}</td></tr>
      </table></div>
      <h4>Head to Head</h4>${h2hTable}`;
    statsDiv.appendChild(card);
  });

  // Charts
  const ctx1=document.getElementById("pointsChart").getContext("2d");
  new Chart(ctx1,{type:'bar',data:{labels:standings.map(p=>p.name),
    datasets:[{label:'Points',data:standings.map(p=>p.points),backgroundColor:'#004080'}]}});
  const ctx2=document.getElementById("eloChart").getContext("2d");
  new Chart(ctx2,{type:'line',
    data:{labels:fixtures.map((_,i)=>i+1),
    datasets:standings.map(p=>({label:p.name,data:p.eloHistory,borderWidth:2,fill:false}))},
    options:{responsive:true,interaction:{mode:'index'}}});

  // Schedule (auto round robin)
  const schedBody=document.querySelector("#scheduleTable tbody"); schedBody.innerHTML="";
  const names=standings.map(p=>p.name);
  if(names.length%2===1) names.push("BYE");
  const n=names.length; let arr=names.slice();
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

  // Profiles page
const pDiv=document.getElementById("profilesContainer"); 
pDiv.innerHTML="";
Object.keys(playerProfiles).forEach(name=>{
  const prof=playerProfiles[name];
  const card=document.createElement("div");
  card.style.marginBottom="2rem";
  card.innerHTML=`
    <h3 id="profile-${name}">${name}</h3>
    ${prof.image ? `<img src="${prof.image}" alt="${name}" style="max-width:200px;border-radius:8px;margin-bottom:1rem;">` : ""}
    <div class="table-wrapper"><table>
      <tr><th>Hand</th><td>${prof.hand}</td></tr>
      <tr><th>Height</th><td>${prof.height}</td></tr>
      <tr><th>Age</th><td>${prof.age}</td></tr>
      <tr><th>Racket</th><td>${prof.racket}</td></tr>
    </table></div>`;
  pDiv.appendChild(card);
});

}

// === Season change ===
function changeSeason(val){
  currentSeason = val;
  document.getElementById("seasonLabel").textContent=val;
  renderAll();
}

// === Show specific profile ===
function showProfile(name){
  showPage("profiles", document.querySelector("nav a[href='#profiles']"));
  const el=document.getElementById("profile-"+name);
  if(el) el.scrollIntoView({behavior:"smooth"});
}

// === Page nav ===
function showPage(id,link){
 document.querySelectorAll(".nav-page").forEach(sec=>sec.style.display="none");
 document.getElementById(id).style.display="block";
 document.querySelectorAll("nav a").forEach(a=>a.classList.remove("active"));
 if(link) link.classList.add("active");
}

// Init
renderAll();
