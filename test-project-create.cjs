const AdmZip = require('adm-zip');
const zip = new AdmZip();

// Create a small test project
const files = {
  'index.html': `<!DOCTYPE html>
<html>
<head>
  <title>Test Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>Hello from Test Project!</h1>
    <p>This is a simple test to verify upload works.</p>
    <button onclick="sayHello()">Click Me</button>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
  
  'styles.css': `.container {
  max-width: 800px;
  margin: 50px auto;
  padding: 20px;
  font-family: Arial, sans-serif;
  background: #f5f5f5;
  border-radius: 10px;
}

h1 { color: #333; }
button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}`,
  
  'script.js': `function sayHello() {
  alert('Hello from SySop test project!');
  console.log('Button clicked at:', new Date());
}

console.log('Test project loaded successfully');`,
  
  'README.md': `# Test Project

A simple test project to verify Archetype's upload functionality.

## Files:
- index.html
- styles.css
- script.js
`
};

// Add files to zip
for (const [filename, content] of Object.entries(files)) {
  zip.addFile(filename, Buffer.from(content, 'utf8'));
}

zip.writeZip('test-project.zip');
console.log('✓ Created test-project.zip (4 files, small size)');
