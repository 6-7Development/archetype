import React from 'react';
import { Progress } from './ui/Progress';
import { Steps, Step } from './Steps';

export type RunPhase = 'idle'|'analyzing'|'executing'|'completed'|'failed';

export function RunCard({phase, steps, percent, subtitle, meta}:{phase:RunPhase, steps:Step[], percent:number, subtitle:string, meta:string}){
  return (
    <div className="card" aria-labelledby="runTitle">
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <h3 className="section-title" id="runTitle">Current Run</h3>
        <span className={`status-badge ${phase==='idle'?'status-idle':'status-running'}`}>
          {phase==='idle' ? 'Idle' : phase.charAt(0).toUpperCase()+phase.slice(1)}
        </span>
      </div>
      <div className="sub">{subtitle}</div>
      <Progress value={percent} />
      <div className="meta">{meta}</div>
      <Steps steps={steps} />
    </div>
  );
}
