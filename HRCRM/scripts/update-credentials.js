import bcrypt from 'bcryptjs';
import { query, queryOne, getPool } from '../backend/config/db.js';

async function updateCredentials() {
  console.log('=== Unlocking Accounts & Updating IT & Director Login Credentials in MySQL Database ===');
  
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    // 0. Unlock ALL locked accounts
    await conn.query('UPDATE hrcrm_users SET failedLoginAttempts = 0, lockedUntil = NULL');
    console.log('🔓 All accounts unlocked successfully! (failedLoginAttempts = 0, lockedUntil = NULL)');

    // 1. IT Department Account
    const itEmail = 'it@payivva.com';
    const itPassword = 'Payivva@7030';
    const itHash = await bcrypt.hash(itPassword, 10);

    const existingIt = await queryOne('SELECT id FROM hrcrm_users WHERE LOWER(email) = ? OR role = ? LIMIT 1', [itEmail, 'it']);
    if (existingIt) {
      await conn.query(
        `UPDATE hrcrm_users SET email = ?, password = ?, role = 'it', status = 'active', name = 'Payivva IT Department', failedLoginAttempts = 0, lockedUntil = NULL WHERE id = ?`,
        [itEmail, itHash, existingIt.id]
      );
      console.log(`✅ IT Department login updated & unlocked successfully!`);
      console.log(`   Email: ${itEmail}`);
      console.log(`   Password: ${itPassword}`);
    } else {
      await conn.query(
        `INSERT INTO hrcrm_users (employeeId, email, password, role, status, name)
         VALUES (NULL, ?, ?, 'it', 'active', 'Payivva IT Department')`,
        [itEmail, itHash]
      );
      console.log(`✅ IT Department login created successfully!`);
      console.log(`   Email: ${itEmail}`);
      console.log(`   Password: ${itPassword}`);
    }

    // 2. Director Account
    const directorEmail = 'admin@payivva.com';
    const directorPassword = 'PayivvaDirector@7030';
    const directorHash = await bcrypt.hash(directorPassword, 10);

    const existingDirector = await queryOne('SELECT id FROM hrcrm_users WHERE LOWER(email) = ? OR role = ? LIMIT 1', [directorEmail, 'director']);
    if (existingDirector) {
      await conn.query(
        `UPDATE hrcrm_users SET email = ?, password = ?, role = 'director', status = 'active', name = 'Payivva Director', failedLoginAttempts = 0, lockedUntil = NULL WHERE id = ?`,
        [directorEmail, directorHash, existingDirector.id]
      );
      console.log(`\n✅ Director / Admin login updated & unlocked successfully!`);
      console.log(`   Email: ${directorEmail}`);
      console.log(`   Password: ${directorPassword}`);
    } else {
      await conn.query(
        `INSERT INTO hrcrm_users (employeeId, email, password, role, status, name)
         VALUES (NULL, ?, ?, 'director', 'active', 'Payivva Director')`,
        [directorEmail, directorHash]
      );
      console.log(`\n✅ Director / Admin login created successfully!`);
      console.log(`   Email: ${directorEmail}`);
      console.log(`   Password: ${directorPassword}`);
    }

  } catch (err) {
    console.error('❌ Failed to update credentials:', err.message);
  } finally {
    conn.release();
    await pool.end();
  }
}

updateCredentials();
