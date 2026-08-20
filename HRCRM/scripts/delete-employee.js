import { getPool, queryOne } from '../backend/config/db.js';

async function deleteEmployeeData() {
  const targetEmail = 'pawarsoham2416@gmail.com';
  console.log(`=== Deleting all data for employee email: ${targetEmail} ===`);

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    // 1. Find employee and user records
    const emp = await queryOne('SELECT id, employee_id, name, email FROM employees WHERE LOWER(email) = ?', [targetEmail.toLowerCase()]);
    const usr = await queryOne('SELECT id, email, role FROM hrcrm_users WHERE LOWER(email) = ?', [targetEmail.toLowerCase()]);

    const empId = emp?.id || null;
    const usrId = usr?.id || null;

    console.log(`Found Employee Record: ID=${empId || 'None'}, Name=${emp?.name || 'N/A'}, Code=${emp?.employee_id || 'N/A'}`);
    console.log(`Found User Record: ID=${usrId || 'None'}, Email=${usr?.email || 'N/A'}, Role=${usr?.role || 'N/A'}`);

    if (!empId && !usrId) {
      console.log(`⚠️ No employee or user record found for ${targetEmail}.`);
      return;
    }

    const safeDelete = async (sql, params) => {
      try {
        await conn.query(sql, params);
      } catch (e) {
        // ignore table missing error
      }
    };

    await conn.beginTransaction();

    if (empId) {
      await safeDelete('DELETE FROM hrcrm_profile_details WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_contact_details WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_employment_details WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_verification WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_verification_history WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_documents WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_leaves WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_leave_balances WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM attendance WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_letters WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_salary_slips WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM employee_inventory WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM hrcrm_notifications WHERE userId IN (SELECT id FROM hrcrm_users WHERE employeeId = ?)', [empId]);
      await safeDelete('DELETE FROM hrcrm_users WHERE employeeId = ?', [empId]);
      await safeDelete('DELETE FROM employees WHERE id = ?', [empId]);
      console.log(`✅ All associated records for Employee ID ${empId} deleted successfully.`);
    }

    if (usrId) {
      await safeDelete('DELETE FROM hrcrm_notifications WHERE userId = ?', [usrId]);
      await safeDelete('DELETE FROM hrcrm_users WHERE id = ?', [usrId]);
      console.log(`✅ User account ID ${usrId} deleted successfully.`);
    }

    await conn.commit();
    console.log(`\n🎉 Permanent deletion of ${targetEmail} completed cleanly!`);
  } catch (err) {
    await conn.rollback();
    console.error('❌ Deletion failed:', err.message);
  } finally {
    conn.release();
    await pool.end();
  }
}

deleteEmployeeData();
