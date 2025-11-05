/**
 * 🔍 DIAGNOSTIC TEST FILE - Contains intentional bug for LomuAI to find
 * 
 * BUG: This file has a TypeScript error that should be detected and fixed
 */

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

function getUserInfo(user: User): string {
  // BUG: Trying to access property that doesn't exist on User interface
  return `${user.name} (${user.username}) - Age: ${user.age}`;
}

const testUser: User = {
  id: '123',
  name: 'Lomu Tester',
  email: 'lomu@test.com',
  age: 25
};

console.log(getUserInfo(testUser));

export { getUserInfo };
