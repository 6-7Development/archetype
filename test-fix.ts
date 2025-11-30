// Test file for Scout to fix
export function testFunction(name: string): string {
  // Intentional issue: missing return type annotation
  return `Hello, ${name}!`;
}

// Another test: unused variable
const unusedVar = "This should be removed";

export function add(a: number, b: number) {
  // Missing space before brace in comment
  return a + b;
}
