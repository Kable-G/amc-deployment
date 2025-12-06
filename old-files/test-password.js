const bcrypt = require('bcryptjs');

async function testPassword() {
  const storedHash = '$2b$10$u7JVaoPtmVOpCqZy.SM7cuNdugW95YhDsr3AFBnnEYoxft3YjhvDe';
  const password = 'password123';
  
  console.log('Testing password verification...');
  console.log('Password:', password);
  console.log('Stored hash:', storedHash);
  
  const isValid = await bcrypt.compare(password, storedHash);
  console.log('Password verification result:', isValid ? '✅ VALID' : '❌ INVALID');
  
  if (!isValid) {
    console.log('\n🔧 Creating new hash for password123...');
    const newHash = await bcrypt.hash('password123', 10);
    console.log('New hash:', newHash);
    console.log('\nTo fix this, update the database with the new hash.');
  }
}

testPassword().catch(console.error);