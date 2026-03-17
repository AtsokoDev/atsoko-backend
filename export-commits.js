const { execSync } = require('child_process');
const fs = require('fs');

try {
  // รัน git log กับ stat เพื่อได้ข้อมูลการเปลี่ยนแปลง
  const output = execSync('git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso --stat phu/dev', { encoding: 'utf8' });

  const lines = output.split('\n');
  const commits = [];
  let currentCommit = null;

  for (const line of lines) {
    if (line.includes('|')) {
      // บรรทัด commit
      const parts = line.split('|');
      if (parts.length >= 5) {
        currentCommit = {
          hash: parts[0],
          author: parts[1],
          email: parts[2],
          date: parts[3],
          message: parts[4],
          filesChanged: '',
          insertions: 0,
          deletions: 0
        };
        commits.push(currentCommit);
      }
    } else if (line.trim() && currentCommit) {
      // บรรทัด stat
      const statMatch = line.match(/(\d+) file[s]? changed(?:, (\d+) insertion[s]?\(\+\))?(?:, (\d+) deletion[s]?\(-\))?/);
      if (statMatch) {
        currentCommit.filesChanged = statMatch[1];
        currentCommit.insertions = statMatch[2] || 0;
        currentCommit.deletions = statMatch[3] || 0;
      }
    }
  }

  // สร้าง CSV
  const csvHeader = 'Commit Hash,Author,Email,Date,Message,Files Changed,Insertions,Deletions\n';
  const csvRows = commits.map(commit =>
    `"${commit.hash}","${commit.author}","${commit.email}","${commit.date}","${commit.message}","${commit.filesChanged}","${commit.insertions}","${commit.deletions}"`
  ).join('\n');

  const csvContent = csvHeader + csvRows;

  // เขียนไฟล์
  fs.writeFileSync('commits_detailed.csv', csvContent);
  console.log('Exported to commits_detailed.csv');
} catch (error) {
  console.error('Error:', error.message);
}