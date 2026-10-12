'use strict';
const GROUPS = ['Жаңалықтар мен БАҚ','Білім және ғылым','Әдебиет және мәдениет','Әлеуметтік желілер','Сөздіктер мен анықтамалықтар','Басқа дереккөздер'];
const DOMAIN = {
  'Жаңалықтар мен БАҚ':['inform.kz','24.kz','tengrinews.kz','zakon.kz','qazaqstan.tv','azattyq.org','egemen.kz','baq.kz'],
  'Білім және ғылым':['edu.kz','bilimland.kz','ust.kz','ustaz.kz','qazcorpus.kz','kaznu.kz','enu.kz'],
  'Әдебиет және мәдениет':['adebiportal.kz','kitap.kz','museum.kz'],
  'Әлеуметтік желілер':['instagram.com','tiktok.com','youtube.com','youtu.be','facebook.com','threads.net','t.me','telegram.me','vk.com'],
  'Сөздіктер мен анықтамалықтар':['sozdikqor.kz','sozdik.kz','wiktionary.org','wikipedia.org','termincom.kz']
};
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
function hostOf(link){try{return new URL(link).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}}
function category(result){
  const host=hostOf(result.link||'');
  for(const [cat,domains] of Object.entries(DOMAIN)) if(domains.some(d=>host===d||host.endsWith('.'+d))) return cat;
  const text=`${result.title||''} ${result.snippet||''}`.toLowerCase();
  if(/ғылыми мақала|университет|оқулық|зерттеу жұмысы/.test(text))return 'Білім және ғылым';
  if(/өлең|роман|әдебиет|мәдени мұра/.test(text))return 'Әдебиет және мәдениет';
  return 'Басқа дереккөздер';
}
function percentages(items){
  const counts=Object.fromEntries(GROUPS.map(g=>[g,0]));
  for(const item of items)counts[category(item)]++;
  if(!items.length)return Object.fromEntries(GROUPS.map(g=>[g,null]));
  const exact=GROUPS.map(g=>100*counts[g]/items.length);
  const floors=exact.map(Math.floor);
  const order=GROUPS.map((_,i)=>i).sort((a,b)=>(exact[b]-floors[b])-(exact[a]-floors[a]));
  for(let i=0;i<100-floors.reduce((a,b)=>a+b,0);i++)floors[order[i]]++;
  return Object.fromEntries(GROUPS.map((g,i)=>[g,floors[i]]));
}
function parseDate(raw){
  if(!raw)return null;
  const text=String(raw).trim().toLowerCase();
  const now=Date.now();
  const rel=text.match(/(?:^|\s)(\d+)\s*(day|days|week|weeks|month|months|year|years|күн|апта|ай|жыл)(?:\s+ago|\s+бұрын)?/i);
  if(rel){const count=Number(rel[1]);const unit=rel[2];const days=/day|күн/.test(unit)?count:/week|апта/.test(unit)?count*7:/month|ай/.test(unit)?count*30.44:count*365.25;return new Date(now-days*86400000)}
  const date=new Date(raw);
  return Number.isFinite(date.getTime())?date:null;
}
function relevantToWord(item,word){
  const txt=`${item.title} ${item.snippet}`.toLocaleLowerCase('kk-KZ');
  // Whole-word matching avoids counting substrings inside unrelated words.
  const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`,'iu').test(txt);
}
function scoreResults(items,word){
  const relevant=items.filter(item=>relevantToWord(item,word));
  const hosts=new Set(relevant.map(item=>hostOf(item.link)).filter(Boolean));
  const categories=new Set(relevant.map(category));
  const now=Date.now();
  const dated=relevant.map(x=>parseDate(x.date)).filter(d=>d&&d.getTime()<=now+86400000);
  const recent=dated.filter(d=>now-d.getTime()<=365.25*86400000);
  const S=100*relevant.length/items.length;
  const D=100*clamp(hosts.size,0,10)/10;
  const C=100*categories.size/6;
  const R=dated.length?100*recent.length/dated.length:null;
  const weighted=35*S+25*D+20*C+(R===null?0:20*R);
  const index=Math.round(clamp(weighted/(R===null?80:100)));
  // Confidence reflects sample coverage and verifiable dates, not statistical certainty.
  const confidence=clamp(Math.round(50*Math.min(items.length/20,1)+30*(relevant.length/items.length)+20*(dated.length/Math.max(relevant.length,1))));
  const quality=items.length>=15&&relevant.length>=12&&dated.length>=8?'Жоғары':items.length>=10&&relevant.length>=6?'Орташа':'Төмен';
  return {index,quality,confidence,matched:relevant.length,domains:hosts.size,categories:categories.size,dated:dated.length,recent:recent.length,components:{relevance:Math.round(S),domain_diversity:Math.round(D),category_coverage:Math.round(C),recency:R===null?null:Math.round(R)}};
}
exports.handler=async(event)=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
  const reply=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
  if(event.httpMethod==='OPTIONS')return {statusCode:204,headers,body:''};
  if(event.httpMethod!=='GET')return reply(405,{error:'GET сұранысы қажет'});
  const word=(event.queryStringParameters?.word||'').trim().toLocaleLowerCase('kk-KZ');
  if(!/^[а-яәіңғүұқөһё-]{1,45}$/iu.test(word))return reply(400,{error:'Бір қазақ сөзін енгізіңіз'});
  const key=process.env.SERPAPI_KEY;
  if(!key)return reply(503,{error:'SERPAPI_KEY Netlify Environment variables бөліміне енгізілмеген'});
  try{
    const u=new URL('https://serpapi.com/search.json');
    Object.entries({engine:'google',q:'"'+word+'"',gl:'kz',hl:'kk',num:'20',api_key:key}).forEach(([k,v])=>u.searchParams.set(k,v));
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
    let response;try{response=await fetch(u,{signal:controller.signal})}finally{clearTimeout(timer)}
    const data=await response.json();
    if(!response.ok||data.error)throw new Error(String(data.error||`SerpApi HTTP ${response.status}`));
    const items=(data.organic_results||[]).slice(0,20).map(x=>({title:String(x.title||''),snippet:String(x.snippet||''),link:String(x.link||''),date:x.date||null}));
    const raw=data.search_information?.total_results;
    let total=null;
    if(raw!==undefined&&raw!==null){const n=Number(String(raw).replace(/[^\d]/g,''));if(Number.isSafeInteger(n)&&n>=0)total=n}
    const context=percentages(items);
    const metric=items.length>=5?scoreResults(items,word):null;
    const index=metric?.index??null;
    const status=index===null?'⚪ Дерек жеткіліксіз':index>=80?'🟢 Өте кең көрінеді':index>=60?'🟢 Кең көрінеді':index>=40?'🟡 Орташа көрінеді':index>=20?'🟠 Төмен көрінеді':'🔴 Өте төмен көрінеді';
    return reply(200,{
      live:true,word,total_results:total,context,context_sample_size:items.length,results:items,
      frequency_score:index,current_activity:index,vitality:index,status,
      data_quality:metric?.quality||'Жеткіліксіз',confidence_score:metric?.confidence??null,
      index_method:'Іздеу нәтижелерінің шартты цифрлық көріну индексі (0–100)',index_components:metric?.components||null,
      evidence:{matched_results:metric?.matched??0,distinct_domains:metric?.domains??0,covered_categories:metric?.categories??0,dated_results:metric?.dated??0,recent_results:metric?.recent??0},
      conclusion:metric?`«${word}» сөзі бойынша ${items.length} іздеу нәтижесі қаралды, оның ${metric.matched} нәтижесінде сөз анық кездесті. Шартты цифрлық көріну индексі — ${index}/100. Дерек сапасы: ${metric.quality.toLowerCase()}. Бұл сөздің болашақтағы тағдырын болжамайды.`:'Іздеу нәтижелері аз болғандықтан шартты индекс есептелмеді.',
      note:'Индекс тек алғашқы іздеу нәтижелеріне негізделген эксперименттік баға. Google жалпы нәтиже саны индекске кірмейді. Мерзімі жоқ материалдар жаңалық көрсеткішінен алынып тасталады; дерек сапасы бөлек көрсетіледі.'
    });
  }catch(err){return reply(502,{error:'SerpApi сұранысы орындалмады: '+err.message})}
};
