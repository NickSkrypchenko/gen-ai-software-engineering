@echo off
SET MODE=%1
IF "%MODE%"=="" SET MODE=dev

IF "%MODE%"=="dev" (
  echo Starting dev server...
  npm run dev
) ELSE IF "%MODE%"=="test" (
  echo Running unit + integration tests...
  npm test
) ELSE IF "%MODE%"=="seed" (
  echo Starting dev server with seed data...
  npm run seed
) ELSE IF "%MODE%"=="e2e" (
  echo Running Postman/Newman e2e tests...
  npm run test:e2e
) ELSE (
  echo Usage: run.bat [dev^|test^|seed^|e2e]
  exit /b 1
)
