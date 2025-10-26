'use client';
import React from 'react';
import { Chip } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { RunCard, RunPhase } from '../../components/RunCard';
import { NewRunForm } from '../../components/NewRunForm';
import { Feed } from '../../components/Feed';
import { Step } from '../../components/Steps';
import '../../styles/theme.css';

export default function PlatformHealingPage(){
  const [autoCommit, setAutoCommit] = React.useState(false);
  const [autoPush, setAutoPush] = React.useState(false);
  const [phase, setPhase] = React.useState<RunPhase>('idle');
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [pct, setPct] = React.useState(0);
  const [subtitle, setSubtitle] = React.useState('No run in progress. Start a new run below.');
  const [meta, setMeta] = React.useState('');
  const [feed, setFeed] = React.useState<string[]>([]);

  React.useEffect(()=>{
    if(!autoCommit) setAutoPush(false);
  }, [autoCommit]);

  function startRun(text:string){
    setFeed(f=>[`▶️ New run started: ${text.slice(0,80)}${text.length>80?'…':''}`, ...f]);
    // Simulate 5 steps
    const list: Step[] = [
      {id:'1', name:'Read logs & metrics', state:'pending'},
      {id:'2', name:'Detect anomalies', state:'pending'},
      {id:'3', name:'Propose fix plan', state:'pending'},
      {id:'4', name:'Apply fixes (dry run)', state:'pending'},
      {id:'5', name:'Validate & summarize', state:'pending'},
    ];
    setSteps(list);
    setPhase('analyzing'); setPct(0);
    setSubtitle('Reading logs & telemetry'); setMeta('Step 1 of 5');
    let i = 0, completed = 0;
    function advance(){
      if(i>0){
        list[i-1].state = 'ok';
        completed++; setPct((completed/list.length)*100);
      }
      if(i === list.length){
        setPhase('completed');
        setSubtitle('Run finished successfully');
        setMeta(`${list.length}/${list.length} steps${autoCommit? ' • auto‑commit':''}${autoPush? ' • auto‑push':''}`);
        setFeed(f=>['✅ Run succeeded • ' + new Date().toLocaleTimeString(), ...f]);
        setSteps([...list]); return;
      }
      list[i].state = 'running'; setSteps([...list]);
      setPhase(i < 3 ? 'analyzing' : 'executing');
      setSubtitle(list[i].name);
      setMeta(`Step ${i+1} of ${list.length}${autoCommit? ' • auto‑commit':''}${autoPush? ' • auto‑push':''}`);
      i++; setTimeout(advance, 700 + i*120);
    }
    advance();
  }

  return (
    <div className="container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{fontWeight:700, letterSpacing:'.4px'}}>ARCHETYPE</div>
        <nav className="nav" style={{display:'flex',flexDirection:'column',gap:6, marginTop:8}}>
          <a className="btn" style={{background:'var(--panel-2)'}}>Dashboard</a>
          <a className="btn">Builder</a>
          <a className="btn">Marketplace</a>
          <a className="btn">Analytics</a>
          <a className="btn">Team</a>
          <a className="btn">API Keys</a>
        </nav>
        <div style={{marginTop:'auto', color:'var(--muted)', fontSize:12}}>Signed in as <strong>Admin</strong></div>
      </aside>

      {/* Main */}
      <section className="main">
        {/* Header */}
        <div className="header">
          <div className="crumb">Home / Agents</div>
          <div className="title">Meta‑SysOp • Platform Healing</div>
          <Chip tone="ok">● Healthy</Chip>
          <div className="controls">
            <Toggle label="Auto‑commit" checked={autoCommit} onChange={setAutoCommit} title="Automatically commit fixes to Git" />
            <Toggle label="Auto‑push" checked={autoPush} onChange={setAutoPush} title="Automatically deploy after commit" disabled={!autoCommit}/>
            <button className="btn primary" onClick={()=>document.getElementById('issue')?.scrollIntoView({behavior:'smooth'})}>New Run</button>
          </div>
        </div>

        <RunCard phase={phase} steps={steps} percent={pct} subtitle={subtitle} meta={meta} />
        <div id="issue"></div>
        <NewRunForm onSubmit={startRun} />
      </section>

      {/* Aside */}
      <aside className="aside">
        <div className="card">
          <h3 className="section-title">Recent Activity</h3>
          <Feed items={feed} />
        </div>
        <div className="card">
          <h3 className="section-title">Pro Tips</h3>
          <div className="feed-item">Be specific about the issue (when it started, what changed, scope).</div>
          <div className="feed-item">Use “Analyze only” (no commit) when investigating incidents.</div>
          <div className="feed-item">Enable Auto‑commit only when your tests are reliable.</div>
        </div>
      </aside>
    </div>
  );
}
