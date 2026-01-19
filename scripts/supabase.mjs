import { spawnSync } from 'node:child_process';

const [command, ...restArgs] = process.argv.slice(2);

const envLookup = {
  dev: 'SUPABASE_PROJECT_REF_DEV',
  prod: 'SUPABASE_PROJECT_REF_PROD',
};

function runSupabase(args) {
  const result = spawnSync('supabase', args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[lock-in] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

switch (command) {
  case 'start':
    runSupabase(['start']);
    break;
  case 'stop':
    runSupabase(['stop']);
    break;
  case 'status':
    runSupabase(['status']);
    break;
  case 'migration:new':
    runSupabase(['migration', 'new', ...restArgs]);
    break;
  case 'migration:diff':
    runSupabase(['db', 'diff', ...restArgs]);
    break;
  case 'push:dev': {
    const projectRef = requireEnv(envLookup.dev);
    runSupabase(['db', 'push', '--project-ref', projectRef]);
    break;
  }
  case 'push:prod': {
    const projectRef = requireEnv(envLookup.prod);
    runSupabase(['db', 'push', '--project-ref', projectRef]);
    break;
  }
  default:
    console.error(
      `[lock-in] Unknown command: ${command}\n` +
        'Usage: node scripts/supabase.mjs <start|stop|status|migration:new|migration:diff|push:dev|push:prod> [...args]',
    );
    process.exit(1);
}
