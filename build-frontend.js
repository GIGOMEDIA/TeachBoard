const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('Installing frontend dependencies...');
  execSync('npm install --prefix frontend', { stdio: 'inherit' });

  console.log('Building frontend...');
  execSync('npm run build --prefix frontend', { stdio: 'inherit' });

  console.log('Copying build output to root dist...');
  const src = path.resolve(__dirname, 'frontend', 'dist');
  const dest = path.resolve(__dirname, 'dist');

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  
  if (fs.cpSync) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.mkdirSync(dest, { recursive: true });
    copyFolderRecursiveSync(src, dest);
  }
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build script failed:', error);
  process.exit(1);
}

function copyFolderRecursiveSync(source, target) {
  const files = fs.readdirSync(source);
  files.forEach(function (file) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      fs.mkdirSync(curTarget, { recursive: true });
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}
