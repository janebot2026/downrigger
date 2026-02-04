const { execSync, execFileSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

function getPlatform() {
  const platform = os.platform();
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  throw new Error(`Platform ${platform} not supported for devtools installation`);
}

function isCommandAvailable(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getNodeVersion() {
  try {
    return execFileSync('node', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getRustVersion() {
  try {
    return execFileSync('rustc', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getPythonVersion() {
  // Try python3 first (preferred on modern systems), then python
  for (const cmd of ['python3', 'python']) {
    try {
      const version = execFileSync(cmd, ['--version'], { encoding: 'utf8' }).trim();
      // Python outputs to stderr, so catch both stdout and stderr
      if (!version) {
        return execFileSync(cmd, ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      }
      return version;
    } catch {
      continue;
    }
  }
  return null;
}

async function installNode(targetDir, options = {}) {
  const { force = false } = options;
  const platform = getPlatform();
  
  const existingVersion = getNodeVersion();
  if (existingVersion && !force) {
    console.log(`Node.js already installed: ${existingVersion}`);
    return { installed: false, version: existingVersion };
  }

  console.log('Installing Node.js...');
  
  if (platform === 'macos') {
    // Check if brew is available
    if (isCommandAvailable('brew')) {
      try {
        execSync('brew install node', { stdio: 'inherit' });
        return { installed: true, version: getNodeVersion() };
      } catch (e) {
        throw new Error(`Failed to install Node.js via Homebrew: ${e.message}`);
      }
    } else {
      // Install Homebrew first, then Node
      console.log('Homebrew not found. Installing Homebrew first...');
      try {
        execSync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', { stdio: 'inherit' });
        execSync('brew install node', { stdio: 'inherit' });
        return { installed: true, version: getNodeVersion() };
      } catch (e) {
        throw new Error(`Failed to install Homebrew/Node.js: ${e.message}`);
      }
    }
  } else if (platform === 'linux') {
    // Use NodeSource or nvm for Linux
    const nvmDir = path.join(os.homedir(), '.nvm');
    
    if (!fs.existsSync(nvmDir)) {
      console.log('Installing nvm (Node Version Manager)...');
      try {
        execSync('curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash', {
          stdio: 'inherit',
          shell: '/bin/bash'
        });
      } catch (e) {
        throw new Error(`Failed to install nvm: ${e.message}`);
      }
    }
    
    // Source nvm and install latest LTS Node
    const nvmScript = path.join(nvmDir, 'nvm.sh');
    if (fs.existsSync(nvmScript)) {
      try {
        execSync(`export NVM_DIR="${nvmDir}" && [ -s "${nvmScript}" ] && . "${nvmScript}" && nvm install --lts && nvm use --lts && nvm alias default lts/*`, {
          stdio: 'inherit',
          shell: '/bin/bash'
        });
        return { installed: true, version: getNodeVersion() };
      } catch (e) {
        throw new Error(`Failed to install Node.js via nvm: ${e.message}`);
      }
    }
  }
  
  throw new Error('Failed to install Node.js on unsupported platform');
}

async function installRust(targetDir, options = {}) {
  const { force = false } = options;

  const existingVersion = getRustVersion();
  if (existingVersion && !force) {
    console.log(`Rust already installed: ${existingVersion}`);
    return { installed: false, version: existingVersion };
  }

  console.log('Installing Rust and Cargo...');
  
  // Use rustup for both macOS and Linux
  const rustupPath = path.join(os.homedir(), '.cargo', 'bin', 'rustup');
  
  if (!fs.existsSync(rustupPath) || force) {
    try {
      // Download and run rustup-init
      const installScript = `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable`;
      execSync(installScript, { 
        stdio: 'inherit',
        shell: '/bin/bash'
      });
    } catch (e) {
      throw new Error(`Failed to install Rust via rustup: ${e.message}`);
    }
  }
  
  // Source cargo environment and verify installation
  const cargoEnv = path.join(os.homedir(), '.cargo', 'env');
  if (fs.existsSync(cargoEnv)) {
    try {
      // Add cargo bin to PATH for this session
      process.env.PATH = `${path.join(os.homedir(), '.cargo', 'bin')}:${process.env.PATH}`;
      
      const version = getRustVersion();
      if (version) {
        console.log(`Rust installed successfully: ${version}`);
        return { installed: true, version };
      }
    } catch (e) {
      throw new Error(`Failed to verify Rust installation: ${e.message}`);
    }
  }
  
  throw new Error('Rust installation failed - cargo not found');
}

async function installPython(targetDir, options = {}) {
  const { force = false } = options;
  const platform = getPlatform();

  const existingVersion = getPythonVersion();
  if (existingVersion && !force) {
    console.log(`Python already installed: ${existingVersion}`);
    return { installed: false, version: existingVersion };
  }

  console.log('Installing Python...');

  if (platform === 'macos') {
    // Check if brew is available
    if (isCommandAvailable('brew')) {
      try {
        execSync('brew install python', { stdio: 'inherit' });
        return { installed: true, version: getPythonVersion() };
      } catch (e) {
        throw new Error(`Failed to install Python via Homebrew: ${e.message}`);
      }
    } else {
      // Install Homebrew first, then Python
      console.log('Homebrew not found. Installing Homebrew first...');
      try {
        execSync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', { stdio: 'inherit' });
        execSync('brew install python', { stdio: 'inherit' });
        return { installed: true, version: getPythonVersion() };
      } catch (e) {
        throw new Error(`Failed to install Homebrew/Python: ${e.message}`);
      }
    }
  } else if (platform === 'linux') {
    // Use apt for Debian/Ubuntu based systems
    console.log('Installing Python via apt...');
    try {
      execSync('apt-get update && apt-get install -y python3 python3-pip', {
        stdio: 'inherit',
        shell: '/bin/bash'
      });

      // Create symlinks if they don't exist
      if (!isCommandAvailable('python')) {
        try {
          execSync('ln -sf $(which python3) /usr/local/bin/python', { stdio: 'ignore' });
        } catch {
          // Ignore if symlink fails
        }
      }

      return { installed: true, version: getPythonVersion() };
    } catch (e) {
      throw new Error(`Failed to install Python via apt: ${e.message}`);
    }
  }

  throw new Error('Failed to install Python on unsupported platform');
}

async function setupDevtools(targetDir, options = {}) {
  const { force = false } = options;
  const results = {
    node: null,
    rust: null,
    python: null
  };

  console.log('Setting up development tools...');
  console.log(`Platform: ${getPlatform()}`);
  console.log();

  // Install Node.js
  try {
    results.node = await installNode(targetDir, { force });
    console.log();
  } catch (e) {
    console.error(`❌ Node.js installation failed: ${e.message}`);
    results.node = { installed: false, error: e.message };
  }

  // Install Rust
  try {
    results.rust = await installRust(targetDir, { force });
    console.log();
  } catch (e) {
    console.error(`❌ Rust installation failed: ${e.message}`);
    results.rust = { installed: false, error: e.message };
  }

  // Install Python
  try {
    results.python = await installPython(targetDir, { force });
    console.log();
  } catch (e) {
    console.error(`❌ Python installation failed: ${e.message}`);
    results.python = { installed: false, error: e.message };
  }

  // Print summary
  console.log('Installation Summary:');
  console.log('---------------------');
  
  if (results.node?.installed) {
    console.log(`✅ Node.js: ${results.node.version} ${results.node.installed ? '(newly installed)' : '(already present)'}`);
  } else if (results.node?.error) {
    console.log(`❌ Node.js: Failed - ${results.node.error}`);
  } else {
    console.log(`ℹ️  Node.js: Already installed (${results.node?.version || 'unknown version'})`);
  }
  
  if (results.rust?.installed) {
    console.log(`✅ Rust: ${results.rust.version} ${results.rust.installed ? '(newly installed)' : '(already present)'}`);
  } else if (results.rust?.error) {
    console.log(`❌ Rust: Failed - ${results.rust.error}`);
  } else {
    console.log(`ℹ️  Rust: Already installed (${results.rust?.version || 'unknown version'})`);
  }

  if (results.python?.installed) {
    console.log(`✅ Python: ${results.python.version} ${results.python.installed ? '(newly installed)' : '(already present)'}`);
  } else if (results.python?.error) {
    console.log(`❌ Python: Failed - ${results.python.error}`);
  } else {
    console.log(`ℹ️  Python: Already installed (${results.python?.version || 'unknown version'})`);
  }

  // Return instructions for next steps
  console.log();
  console.log('Next steps:');
  if (results.rust?.installed) {
    console.log('  - Reload your shell or run: source $HOME/.cargo/env');
    console.log('  - Verify: rustc --version && cargo --version');
  }
  if (results.node?.installed) {
    if (getPlatform() === 'linux') {
      console.log('  - Reload your shell or run: export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"');
    }
    console.log('  - Verify: node --version && npm --version');
  }
  if (results.python?.installed) {
    console.log('  - Verify: python --version && pip --version (or python3 --version)');
  }

  return results;
}

module.exports = {
  setupDevtools,
  installNode,
  installRust,
  installPython,
  getNodeVersion,
  getRustVersion,
  getPythonVersion
};