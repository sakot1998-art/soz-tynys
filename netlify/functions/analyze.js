const GROUPS = ['Жаңалықтар мен БАҚ','Білім және ғылым','Әдебиет және мәдениет','Әлеуметтік желілер','Сөздіктер мен анықтамалықтар','Басқа дереккөздер'];
const DOMAIN = {
  'Жаңалықтар мен БАҚ':['inform.kz','24.kz','tengrinews.kz','zakon.kz','qazaqstan.tv','azattyq.org','egemen.kz','baq.kz'],
  'Білім және ғылым':['edu.kz','bilimland.kz','ust.kz','ustaz.kz','qazcorpus.kz','kaznu.kz','enu.kz'],
  'Әдебиет және мәдениет':['adebiportal.kz','kitap.kz','kitapхана.kz','museum.kz'],
  'Әлеуметтік желілер':['instagram.com','tiktok.com','youtube.com','youtu.be','facebook.com','threads.net','t.me','telegram.me','vk.com'],
  'Сөздіктер мен анықтамалықтар':['sozdikqor.kz','sozdik.kz','wiktionary.org','wikipedia.org','termincom.kz']
};
function category(result){
  let host=''; try {host=new URL(result.link || '').hostname.replace(/^www\./,'').toLowerCase()}catch{}
  for(const [cat, domains] of Object.entries(DOMAIN)) if(domains.some(d=>host===d||host.endsWith('.'+d))) return cat;
  const text=`${result.title||''} ${result.snippet||''}`.toLowerCase();
  if(/ғылыми мақала|университет|оқулық|зерттеу жұмысы/.test(text)) return 'Білім және ғылым';
  if(/өлең|роман|әдебиет|мәдени мұра/.test(text)) return 'Әдебиет және мәдениет';
  return 'Басқа дереккөздер';
}
function percentages(items){
  const counts=Object.fromEntries(GROUPS.map(g=>[g,0]));
  for(const item of items) counts[category(item)]++;
  if(!items.length) return Object.fromEntries(GROUPS.map(g=>[g,null]));
  const exact=GROUPS.map(g=>100*counts[g]/items.length);
  const floors=exact.map(Math.floor);
  const order=GROUPS.map((_,i)=>i).sort((a,b)=>(exact[b]-floors[b])-(exact[a]-floors[a]));
  for(let i=0;i<100-floors.reduce((a,b)=>a+b,0);i++) floors[order[i]]++;
  return Object.fromEntries(GROUPS.map((g,i)=>[g,floors[i]]));
}
exports.handler=async(event)=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
  if(event.httpMethod==='OPTIONS') return {statusCode:204,headers,body:''};
  if(event.httpMethod!=='GET') return {statusCode:405,headers,body:JSON.stringify({error:'GET сұранысы қажет'})};
  const word=(event.queryStringParameters?.word||'').trim().toLowerCase();
  if(!/^[а-яәіңғүұқөһё-]{1,45}$/iu.test(word)) return {statusCode:400,headers,body:JSON.stringify({error:'Бір қазақ сөзін енгізіңіз'})};
  const key=process.env.SERPAPI_KEY;
  if(!key) return {statusCode:503,headers,body:JSON.stringify({error:'SERPAPI_KEY Netlify Environment variables бөліміне енгізілмеген'})};
  try {
    const u=new URL('https://serpapi.com/search.json');
    Object.entries({engine:'google',q:'"'+word+'"',gl:'kz',hl:'kk',num:'20',api_key:key}).forEach(([k,v])=>u.searchParams.set(k,v));
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),18000);
    let response; try{response=await fetch(u,{signal:controller.signal})}finally{clearTimeout(timer)}
    const data=await response.json();
    if(!response.ok||data.error) throw new Error(String(data.error||`SerpApi HTTP ${response.status}`));
    const items=(data.organic_results||[]).slice(0,20).map(x=>({title:String(x.title||''),snippet:String(x.snippet||''),link:String(x.link||'')}));
    const raw=data.search_information?.total_results;
    let total=null;
    if(raw!==undefined&&raw!==null){const value=Number(String(raw).replace(/[^\d]/g,''));if(Number.isSafeInteger(value)&&value>=0)total=value}
    const contexts=percentages(items);
    return {statusCode:200,headers,body:JSON.stringify({word,total_results:total,context:contexts,context_sample_size:items.length,results:items,frequency_score:null,current_activity:null,vitality:null,status:'Деректерге негізделген шолу',conclusion:items.length?`«${word}» сөзі бойынша ${items.length} ашық іздеу нәтижесі қаралды. Санаттар осы нәтижелердің үлесін көрсетеді, сөздің бүкіл интернеттегі өміршеңдігін дәл өлшемейді.`:'Іздеу нәтижелері табылмады немесе көрсетілмеді.',note:'Google нәтижелерінің жалпы саны шамаланған және тұрақсыз болуы мүмкін. Өміршеңдік индексі сенімді уақыттық деректерсіз есептелмейді.'})};
  }catch(err){return {statusCode:502,headers,body:JSON.stringify({error:'SerpApi сұранысы орындалмады: '+err.message})}}
};
