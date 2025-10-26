import React from 'react';
export function Progress({value}:{value:number}){
  const pct = Math.max(0, Math.min(100, value));
  return <div className="progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} role="progressbar"><div className="bar" style={{width: pct + '%'}}/></div>;
}
