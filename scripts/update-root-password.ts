import { db } from '../server/db';
import { users } from '../shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

async function updateRootPassword() {
  const email = 'root@getdc360.com';
  const newPassword = 'admin123@*';

  console.log(`\n🔐 Updating password for ${email}...`);

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  console.log(`✅ New password hashed`);

  const result = await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (result.length > 0) {
    console.log(`✅ Password updated successfully for ${email}`);
    console.log(`   User ID: ${result[0].id}`);
    console.log(`\n🎉 You can now login with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}\n`);
  } else {
    console.error('❌ User not found');
  }

  process.exit(0);
}

updateRootPassword().catch((error) => {
  console.error('❌ Error updating password:', error);
  process.exit(1);
});
