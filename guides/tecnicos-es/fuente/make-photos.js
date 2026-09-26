const { chromium } = require('playwright');
const scenes = {
  living: `<div style="position:absolute;inset:0;background:linear-gradient(#d9d2c3 0 62%,#9b7b5a 62%)"></div>
    <div style="position:absolute;left:12%;top:14%;width:26%;height:34%;background:linear-gradient(135deg,#bfe0f5,#eaf6ff);border:10px solid #f4f1ea;box-shadow:0 0 0 2px #cfc6b4"></div>
    <div style="position:absolute;right:10%;top:40%;width:38%;height:22%;background:#6d7f8c;border-radius:10px 10px 0 0"></div>
    <div style="position:absolute;right:13%;top:32%;width:32%;height:12%;background:#7e909c;border-radius:12px"></div>
    <div style="position:absolute;left:0;right:0;top:62%;height:6px;background:#efe9dd"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:38%;background:repeating-linear-gradient(90deg,#9b7b5a 0 60px,#8f7050 60px 62px)"></div>`,
  kitchen: `<div style="position:absolute;inset:0;background:#e9e6df"></div>
    <div style="position:absolute;left:0;right:0;top:8%;height:26%;background:#fff;border-bottom:4px solid #d8d2c6;display:flex;gap:6px;padding:0 4%">${'<div style="flex:1;border:3px solid #e2ddd2;margin:8px 0"></div>'.repeat(5)}</div>
    <div style="position:absolute;left:0;right:0;top:36%;height:18%;background:repeating-linear-gradient(90deg,#dfe7ea 0 40px,#cfd9dd 40px 42px),#dfe7ea"></div>
    <div style="position:absolute;left:0;right:0;top:54%;height:5%;background:#3b3b3b"></div>
    <div style="position:absolute;left:0;right:0;top:59%;bottom:0;background:#fff;display:flex;gap:6px;padding:0 4%">${'<div style="flex:1;border:3px solid #e2ddd2;margin:14px 0"></div>'.repeat(5)}</div>
    <div style="position:absolute;left:44%;top:47%;width:12%;height:8%;border:6px solid #9aa3a7;border-bottom:none;border-radius:40px 40px 0 0"></div>`,
  bathroom: `<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,#f3f5f6 0 58px,#dde3e6 58px 60px),repeating-linear-gradient(90deg,transparent 0 58px,#dde3e6 58px 60px);background-blend-mode:multiply"></div>
    <div style="position:absolute;left:30%;top:10%;width:40%;height:30%;background:linear-gradient(135deg,#cfe3ee,#f7fbfd);border:8px solid #b9c2c7;border-radius:8px"></div>
    <div style="position:absolute;left:25%;top:50%;width:50%;height:12%;background:#fff;border:4px solid #c9d0d4;border-radius:10px"></div>
    <div style="position:absolute;left:32%;top:62%;width:36%;height:38%;background:#e9ecee;border:4px solid #c9d0d4"></div>`,
  hallway: `<div style="position:absolute;inset:0;background:#cfc7b8"></div>
    <div style="position:absolute;left:30%;right:30%;top:20%;bottom:28%;background:#b9ae9a"></div>
    <div style="position:absolute;left:0;top:0;bottom:0;width:30%;background:linear-gradient(90deg,#ddd5c6,#c9c0b0);clip-path:polygon(0 0,100% 20%,100% 72%,0 100%)"></div>
    <div style="position:absolute;right:0;top:0;bottom:0;width:30%;background:linear-gradient(270deg,#ddd5c6,#c9c0b0);clip-path:polygon(0 20%,100% 0,100% 100%,0 72%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:28%;background:#7a8a8f;clip-path:polygon(30% 0,70% 0,100% 100%,0 100%)"></div>
    <div style="position:absolute;left:44%;top:30%;width:12%;height:42%;background:#8d6b4b"></div>`,
  carpet: `<div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 40%,#b9ad97,#a39680);"></div>
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(0,0,0,.04) 0 3px,transparent 3px 6px)"></div>
    <div style="position:absolute;left:0;right:0;top:0;height:22%;background:#e7e1d5;border-bottom:10px solid #fff"></div>`,
  office: `<div style="position:absolute;inset:0;background:linear-gradient(#e8e8e4 0 60%,#8b949a 60%)"></div>
    <div style="position:absolute;left:8%;top:34%;width:40%;height:6%;background:#6b5846"></div>
    <div style="position:absolute;left:12%;top:40%;width:3%;height:20%;background:#555"></div><div style="position:absolute;left:41%;top:40%;width:3%;height:20%;background:#555"></div>
    <div style="position:absolute;left:18%;top:18%;width:18%;height:16%;background:#222;border:5px solid #444"></div>
    <div style="position:absolute;right:8%;top:10%;width:34%;height:44%;background:linear-gradient(135deg,#bcd8ea,#eef6fb);border:8px solid #fafafa"></div>`,
  lobby: `<div style="position:absolute;inset:0;background:linear-gradient(#efece6 0 58%,#d7d2c8 58%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:42%;background:repeating-conic-gradient(#e6e1d8 0 25%,#d3cdc2 0 50%) 0 0/80px 80px"></div>
    <div style="position:absolute;left:36%;top:22%;width:28%;height:20%;background:#6c5a48;border-radius:6px"></div>
    <div style="position:absolute;left:8%;top:8%;width:18%;height:50%;background:linear-gradient(135deg,#cfe5ef,#f4fafc);border:6px solid #fff"></div>
    <div style="position:absolute;right:8%;top:8%;width:18%;height:50%;background:linear-gradient(135deg,#cfe5ef,#f4fafc);border:6px solid #fff"></div>`,
  restroom: `<div style="position:absolute;inset:0;background:#dfe6ea"></div>
    ${[0,1,2].map(i=>`<div style="position:absolute;left:${6+i*31}%;top:10%;width:27%;height:80%;background:#b8c4cb;border:4px solid #a3b0b8"><div style="position:absolute;right:10%;top:48%;width:10px;height:10px;border-radius:50%;background:#777"></div></div>`).join('')}`,
  drywall: `<div style="position:absolute;inset:0;background:#e4dfd6"></div>
    <div style="position:absolute;left:38%;top:30%;width:22%;height:26%;background:#f4f2ee;border-radius:40% 30% 45% 35%;box-shadow:0 0 0 12px rgba(255,255,255,.5)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:12%;background:#fff;border-top:6px solid #d0c8ba"></div>`
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 720 } });
  for (const [k, html] of Object.entries(scenes)) {
    await p.setContent(`<body style="margin:0"><div style="position:relative;width:960px;height:720px;overflow:hidden;filter:saturate(.95) contrast(1.02)">${html}</div></body>`);
    await p.screenshot({ path: `photos/${k}.jpg`, type: 'jpeg', quality: 82 });
  }
  // sample PDF for the doc viewer
  await p.setContent(`<body style="font-family:Arial;padding:40px"><h1 style="font-size:22px">Scope of Work — Unit 214</h1><p>Maple Ridge Apartments · Building 3</p><ul><li>Paint walls (Level 2)</li><li>Replace carpet — bedrooms</li><li>Deep clean kitchen</li></ul><p>Notes: tenant moved out 09/20. Keys at the leasing office.</p></body>`);
  await p.pdf({ path: 'photos/scope.pdf', format: 'Letter' });
  await b.close();
})();
