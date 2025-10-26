import React from 'react';

export type StepState = 'pending'|'running'|'ok'|'fail';

export interface Step {
  id: string;
  name: string;
  state: StepState;
  info?: string;
  startedAt?: number;
  endedAt?: number;
}

export function Steps({steps}:{steps: Step[]}){
  return (
    <ul className="steps" aria-label="Run steps">
      {steps.map(s=> (
        <li className="step" key={s.id}>
          <span className={`dot ${s.state==='running'?'run': s.state}`}></span>
          <div className="name">{s.name}</div>
          <div className="time">{s.state==='ok' ? '✓' : s.state==='fail' ? '×' : s.state==='running' ? '…' : ''}</div>
        </li>
      ))}
    </ul>
  );
}
