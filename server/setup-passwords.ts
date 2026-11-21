import readline from 'readline';
import { getData, saveData } from './db.js';
import { hashPassword, validatePasswordStrength } from './password.js';

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.stdin;
    const onData = (char: Buffer) => {
      const str = char.toString('utf8');
      if (str === '\n' || str === '\r' || str === '\u0004') {
        stdin.removeListener('data', onData);
      } else {
        process.stdout.write('\x1B[2K\x1B[200D' + question + '*'.repeat((rl as any).line?.length || 0));
      }
    };

    if (stdin.isTTY) {
      stdin.on('data', onData);
    }

    rl.question(question, (answer) => {
      if (stdin.isTTY) {
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
      }
      rl.close();
      resolve(answer);
    });
  });
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  const data = getData();
  const users = Array.isArray(data.users) ? data.users : [];

  if (users.length === 0) {
    console.log('No users found in db.json.');
    return;
  }

  console.log('\nExisting Users in db.json:');
  users.forEach((u: any, idx: number) => {
    const status = u.passwordHash ? 'configured' : 'NOT SET';
    console.log(`  [${idx + 1}] ${u.name} <${u.email}> (role: ${u.role}) - password: ${status}`);
  });

  console.log('\nPress Enter to set passwords for users without one, or enter a user number to update a specific user:');
  const choice = await promptLine('Selection (blank = all unconfigured): ');

  const targets =
    choice === ''
      ? users.filter((u: any) => !u.passwordHash)
      : (() => {
          const idx = Number(choice) - 1;
          return Number.isInteger(idx) && idx >= 0 && idx < users.length ? [users[idx]] : [];
        })();

  if (targets.length === 0) {
    console.log('No matching users need password configuration.');
    return;
  }

  for (const target of targets) {
    console.log(`\nConfiguring password for ${target.name} <${target.email}> (${target.role})`);
    const password = await promptHidden('  New password (min 8 chars, letters + numbers): ');
    const check = validatePasswordStrength(password);
    if (!check.valid) {
      console.error(`  Skipped: ${check.message}`);
      continue;
    }
    const confirm = await promptHidden('  Confirm password: ');
    if (password !== confirm) {
      console.error('  Skipped: Passwords do not match.');
      continue;
    }

    target.passwordHash = await hashPassword(password);
    target.passwordUpdatedAt = new Date().toISOString();
    console.log(`  Password hash saved for ${target.email}.`);
  }

  saveData(data);
  console.log('\nDone. Existing user records and timetable data preserved.\n');
}

run().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
