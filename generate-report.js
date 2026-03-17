const { spawn } = require('child_process');
const fs = require('fs');

function runGitLog() {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['log', '--max-count=40', '--pretty=format:COMMIT_START|%H|%an|%ae|%ad|%s|%b', '--date=iso', '--patch', 'phu/dev']);
    let output = '';
    let errorOutput = '';

    git.stdout.on('data', (data) => {
      output += data.toString();
    });

    git.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    git.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Git command failed: ${errorOutput}`));
      }
    });
  });
}

async function generateReport() {
  try {
    const output = await runGitLog();

    const commits = [];
    const lines = output.split('\n');
    let currentCommit = null;
    let inDiff = false;
    let diffLines = [];

    for (const line of lines) {
      if (line.startsWith('COMMIT_START|')) {
        // บันทึก commit ก่อนหน้า
        if (currentCommit) {
          currentCommit.diff = diffLines.join('\n');
          commits.push(currentCommit);
        }
        // เริ่ม commit ใหม่
        const parts = line.substring('COMMIT_START|'.length).split('|');
        currentCommit = {
          hash: parts[0],
          author: parts[1],
          email: parts[2],
          date: parts[3],
          message: parts[4],
          body: parts[5] || '',
          diff: ''
        };
        inDiff = false;
        diffLines = [];
      } else if (line.startsWith('diff --git')) {
        inDiff = true;
        diffLines.push(line);
      } else if (inDiff) {
        diffLines.push(line);
      }
    }
    // บันทึก commit สุดท้าย
    if (currentCommit) {
      currentCommit.diff = diffLines.join('\n');
      commits.push(currentCommit);
    }

    // Sort commits โดย date (ใหม่สุดก่อน)
    commits.sort((a, b) => new Date(b.date) - new Date(a.date));

    // สร้าง Markdown report
    let report = '# Git Commits Report - Branch phu/dev\n\n';
    report += `Generated on: ${new Date().toISOString()}\n\n`;
    report += '## Timeline of Development\n\n';

    commits.forEach((commit, index) => {
      report += `### ${index + 1}. Commit: ${commit.hash.substring(0, 8)}\n`;
      report += `- **Author:** ${commit.author} (${commit.email})\n`;
      report += `- **Date:** ${commit.date}\n`;
      report += `- **Message:** ${commit.message}\n`;
      if (commit.body.trim()) {
        report += `- **Body:** ${commit.body.replace(/\n/g, '\n  ')}\n`;
      }
      report += '\n#### Code Changes (Diff):\n\n```diff\n' + commit.diff + '\n```\n\n---\n\n';
    });

    // เขียนไฟล์
    fs.writeFileSync('git-report.md', report);
    console.log('Report generated: git-report.md');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generateReport();