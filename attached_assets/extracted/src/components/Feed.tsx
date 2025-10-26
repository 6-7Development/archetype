import React from 'react';

export function Feed({items}:{items: string[]}){
  if(!items.length) return <div className="feed"><div className="feed-item muted">No runs yet.</div></div>;
  return <div className="feed">{items.map((t,i)=>(<div className="feed-item" key={i}>{t}</div>))}</div>;
}
