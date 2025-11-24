import { useState } from 'react';

// BUG: This component has a TypeScript error that LomuAI should fix
export function App() {
  const [todos, setTodos] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, input]);
      setInput('');
    }
  };

  // BUG: 'index' is used but not defined - intentional error for LomuAI to find
  const removeTodo = () => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>LomuAI Test Project ✨</h1>
      <p>If you see this, the IDE is working!</p>
      
      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Todo App</h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a todo..."
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button
            onClick={addTodo}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </div>
        
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {todos.map((todo, i) => (
            <li
              key={i}
              style={{
                padding: '12px',
                backgroundColor: '#f5f5f5',
                marginBottom: '8px',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{todo}</span>
              <button
                onClick={() => removeTodo()}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        
        {todos.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center' }}>No todos yet. Add one!</p>
        )}
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <h3>Test This IDE:</h3>
        <ul>
          <li>💻 Edit this file in the Editor tab (fix the TypeScript error)</li>
          <li>👀 See live updates in the Preview tab</li>
          <li>🔴 Check the Problems tab (it shows the error)</li>
          <li>💬 Ask LomuAI to fix the bug</li>
          <li>✅ Verify the changes work!</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
