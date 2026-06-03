import { writeFileSync, mkdirSync } from 'node:fs';
import { signedToken, unsignedToken } from '../tests/jwt-fixtures';

mkdirSync('tests/fixtures', { recursive: true });

writeFileSync(
  'tests/fixtures/valid-token.txt',
  signedToken({ sub: 'alice', exp: 9_999_999_999 }) + '\n',
);

writeFileSync(
  'tests/fixtures/alg-none-token.txt',
  unsignedToken({ sub: 'alice', exp: 9_999_999_999 }) + '\n',
);

writeFileSync(
  'tests/fixtures/expired-token.txt',
  signedToken({ sub: 'alice', exp: 1_577_836_800 }) + '\n',
);

console.log('Generated tests/fixtures/{valid,alg-none,expired}-token.txt');
