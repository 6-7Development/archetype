import React from 'react';

export function NewRunForm({onSubmit}:{onSubmit:(text:string)=>void}){
  const [text, setText] = React.useState('');
  return (
    <div className="card">
      <h3 className="section-title">Start a new run</h3>
      <p className="sub">Describe the issue. We’ll propose steps before executing.</p>
      <div className="form-row">
        <textarea
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="e.g., API latency spiking to p95 3s since 14:05 UTC. Suspect rate limiter regression after v1.9.2."/>
        <button className="btn primary" onClick={()=>text.trim() && onSubmit(text.trim())}>Analyze &amp; Fix</button>
      </div>
    </div>
  );
}
